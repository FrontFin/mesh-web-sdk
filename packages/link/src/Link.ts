import {
  LinkOptions,
  Link,
  EventType,
  AccessTokenPayload,
  DelayedAuthPayload,
  TransferFinishedPayload,
  LinkPayload,
  MeshBackupConfig,
  MeshBackupOptions,
  MeshBackupJitRequestPayload,
  MeshBackupJitResponsePayload
} from './utils/types'
import {
  addPopup,
  buildIframeAllowPolicy,
  iframeId,
  removePopup
} from './utils/popup'
import { LinkEventType, isLinkEventTypeKey } from './utils/event-types'
import { sdkSpecs } from './utils/sdk-specs'
import { appendQueryParam } from './utils/url'
import {
  BACKUP_CONFIG_MESSAGE_TYPE,
  DEFAULT_BACKUP_WIDGET_ORIGIN,
  JIT_REQUEST_MESSAGE_TYPE,
  JIT_RESPONSE_MESSAGE_TYPE,
  buildBackupWidgetUrl
} from './utils/backup'
import {
  BackupTierController,
  BackupTierFallbackReason,
  createBackupTierController
} from './utils/backupTier'
import { BridgeParent } from '@meshconnect/uwc-bridge-parent'
import { createPrewarmIframe, removePrewarmIframe } from './utils/prewarm'

let currentOptions: LinkOptions | undefined
let targetOrigin: string | undefined
let linkTokenOrigin: string | undefined
let currentIframeId = iframeId
let bridgeParent: BridgeParent | null = null
// Set by `openLinkBackup`, delivered to the widget on its `loaded` handshake.
// Cleared by `openLink` so a prior backup session can never leak its deposit
// config into a subsequent primary (token) flow.
let backupSession: MeshBackupConfig | undefined
// Tier-1 → Tier-2 cascade state machine, live only during a backup session.
let backupTierController: BackupTierController | null = null

/**
 * Tear down any in-flight backup session state. Called when a session ends or
 * when the primary (token) flow starts, so a pending Tier-1 timeout can never
 * fire against a later iframe and a stale config can never be re-delivered.
 */
function resetBackupState() {
  backupSession = undefined
  backupTierController?.destroy()
  backupTierController = null
}

const iframeElement = () => {
  return document.getElementById(currentIframeId) as HTMLIFrameElement
}

function sendMessageToIframe<T extends { type: string }>(message: T) {
  const iframe = iframeElement()
  if (!iframe) {
    console.warn(
      `Mesh SDK: Failed to deliver ${message.type} message to the iframe - no iframe element found`
    )
    return
  }
  if (!linkTokenOrigin) {
    console.warn(
      `Mesh SDK: Failed to deliver ${message.type} message to the iframe - no link token origin found`
    )
    return
  }
  try {
    iframe.contentWindow?.postMessage(message, linkTokenOrigin)
  } catch (e) {
    console.error(
      `Mesh SDK: Failed to deliver ${message.type} message to the iframe`
    )
    console.error(e)
  }
}

type MessageLinkEvent = {
  type: EventType
  payload?: AccessTokenPayload | DelayedAuthPayload | TransferFinishedPayload
  link?: string
}

async function handleLinkEvent(
  event: MessageEvent<MessageLinkEvent> | MessageEvent<LinkEventType>
) {
  // Backup JIT RPC: the widget asks the host to run its `onAddressInit` /
  // `onStatusPoll` callbacks for an address-less destination (OR-452). Only ever
  // sent by the backup widget, so it is gated on an active backup session.
  if (
    (event.data as { type?: string }).type === JIT_REQUEST_MESSAGE_TYPE &&
    backupSession
  ) {
    await handleBackupJitRequest(
      (event.data as unknown as { payload?: MeshBackupJitRequestPayload })
        .payload
    )
    return
  }

  switch (event.data.type) {
    case 'brokerageAccountAccessToken': {
      const payload: LinkPayload = {
        accessToken: event.data.payload as AccessTokenPayload
      }
      currentOptions?.onEvent?.({
        type: 'integrationConnected',
        payload: payload
      })
      currentOptions?.onIntegrationConnected?.(payload)
      break
    }
    case 'delayedAuthentication': {
      const payload: LinkPayload = {
        delayedAuth: event.data.payload as DelayedAuthPayload
      }
      currentOptions?.onEvent?.({
        type: 'integrationConnected',
        payload: payload
      })
      currentOptions?.onIntegrationConnected?.(payload)
      break
    }
    case 'transferFinished': {
      const payload = event.data.payload as TransferFinishedPayload

      currentOptions?.onEvent?.({
        type: 'transferCompleted',
        payload: payload
      })
      currentOptions?.onTransferFinished?.(payload)
      break
    }
    case 'close':
    case 'done': {
      const payload = event.data?.payload
      currentOptions?.onExit?.(payload?.errorMessage, payload)
      bridgeParent?.destroy()
      removePopup()
      // A closed backup session must not be re-delivered to a later iframe, and
      // its pending tier timer must be cleared.
      resetBackupState()
      break
    }
    case 'loaded': {
      sendMessageToIframe({
        type: 'meshSDKSpecs',
        payload: { ...sdkSpecs }
      })

      // Never forward integration access tokens to the backup widget: it is a
      // deposit-only flow served from an independent origin (no shared failure
      // domain with Mesh) and has no use for them — forwarding would leak the
      // user's credentials cross-origin.
      if (currentOptions?.accessTokens && !backupSession) {
        sendMessageToIframe({
          type: 'frontAccessTokens',
          payload: currentOptions.accessTokens
        })
      }

      if (backupSession) {
        // This `loaded` IS the ready handshake — cancel the pending tier timeout
        // (Tier-1 healthy, or Tier-2 mounted) before delivering the config.
        backupTierController?.markReady()
        sendMessageToIframe({
          type: BACKUP_CONFIG_MESSAGE_TYPE,
          payload: backupSession
        })
      }

      currentOptions?.onEvent?.({ type: 'pageLoaded' })
      break
    }
    default: {
      if (isLinkEventTypeKey(event.data.type)) {
        currentOptions?.onEvent?.(event.data)
      }
      break
    }
  }
}

async function eventsListener(
  event: MessageEvent<LinkEventType | { type: EventType }>
) {
  if (event.origin !== targetOrigin && event.origin !== linkTokenOrigin) {
    console.warn('Received message from untrusted origin:', event.origin)
  } else {
    await handleLinkEvent(event as MessageEvent<{ type: EventType }>)
  }
}

/**
 * Run the host's JIT callback for a widget request and post the result back over
 * the bridge, correlated by `callId` (OR-452). `addressInit` runs `onAddressInit`
 * (its return is ignored — a throw/reject is a failure); `statusPoll` runs
 * `onStatusPoll` and returns its `{ status, address?, addressTag? }`. A missing
 * callback fails closed so an address-less destination surfaces an error rather
 * than hanging. The callbacks run in the host app with the client's own session —
 * their credentials never enter the widget; only `(symbol, networkId)` and the
 * resolved address cross the bridge.
 */
async function handleBackupJitRequest(
  payload: MeshBackupJitRequestPayload | undefined
) {
  if (!payload || typeof payload.callId !== 'string') return
  const { callId, method, symbol, networkId } = payload

  const respond = (response: MeshBackupJitResponsePayload) =>
    sendMessageToIframe({ type: JIT_RESPONSE_MESSAGE_TYPE, payload: response })

  try {
    // The request drives real address generation against the client's backend —
    // reject a malformed one rather than passing garbage to the callbacks.
    if (typeof symbol !== 'string' || typeof networkId !== 'string') {
      throw new Error('backup JIT request is missing a string symbol/networkId')
    }
    if (method === 'addressInit') {
      const onAddressInit = currentOptions?.onAddressInit
      if (!onAddressInit) {
        throw new Error(
          'onAddressInit callback is required to resolve an address-less backup destination'
        )
      }
      await onAddressInit(symbol, networkId)
      respond({ callId, ok: true })
    } else if (method === 'statusPoll') {
      const onStatusPoll = currentOptions?.onStatusPoll
      if (!onStatusPoll) {
        throw new Error(
          'onStatusPoll callback is required to resolve an address-less backup destination'
        )
      }
      const result = await onStatusPoll(symbol, networkId)
      respond({ callId, ok: true, result })
    } else {
      throw new Error(`Unknown backup JIT method: ${String(method)}`)
    }
  } catch (e) {
    respond({
      callId,
      ok: false,
      error: e instanceof Error ? e.message : 'JIT callback failed'
    })
  }
}

/**
 * Fail the backup flow closed: tear down the popup/bridge and listener and exit
 * with an error (never leave a blank or hung screen — design §5A/§5H). Teardown
 * runs before `onExit`, and `resetBackupState` clears the session, so the removed
 * iframe cannot emit a later `close`/`done` that would call `onExit` twice.
 */
function failBackupClosed(errorMessage: string) {
  bridgeParent?.destroy()
  bridgeParent = null
  removePopup()
  window.removeEventListener('message', eventsListener)
  const onExit = currentOptions?.onExit
  resetBackupState()
  onExit?.(errorMessage)
}

/**
 * Cascade the backup flow from Tier 1 (widget from the backup origin) to Tier 2
 * (the SDK-bundled offline widget) when the backup origin is unreachable (design
 * §5H). Emits `backupTierChanged`, then swaps the current iframe to the bundled
 * HTML via `srcdoc`. The bundle is imported dynamically so Tier-1-only consumers
 * can code-split the ~135 KB asset out of their main chunk.
 *
 * Tier 2 is our own inline document, same-origin with the host page, so the
 * message origin is re-pinned to `window.location.origin`: this also drops any
 * late message from the abandoned (cross-origin) Tier-1 surface at the origin
 * gate, so it cannot re-`markReady` and defeat the Tier-2 fail-closed timer.
 */
async function cascadeBackupToTier2(reason: BackupTierFallbackReason) {
  currentOptions?.onEvent?.({
    type: 'backupTierChanged',
    payload: { from: 'tier1', to: 'tier2', reason }
  })

  // Re-pin the message origin to the host page and tear down the Tier-1 surface
  // synchronously (before the async import) so nothing from it races the swap.
  linkTokenOrigin = window.location.origin
  const tier1Iframe = iframeElement()
  if (tier1Iframe) {
    bridgeParent?.destroy()
    bridgeParent = null
    tier1Iframe.removeAttribute('src')
  }

  let html: string
  try {
    const bundle = await import('./backup-bundle')
    html = bundle.getBundledOfflineWidget().html
  } catch {
    // The bundled chunk could not be loaded (e.g. the host's own asset host is
    // unreachable). Fail closed — never a blank QR.
    failBackupClosed('Backup deposit flow is unavailable')
    return
  }

  // The session may have been torn down while the bundle was importing.
  if (!backupSession) return

  const iframe = iframeElement()
  if (!iframe) {
    failBackupClosed('Backup deposit flow is unavailable')
    return
  }

  iframe.srcdoc = html
  bridgeParent = new BridgeParent(iframe)
}

export const createLink = (options: LinkOptions): Link => {
  const openLink = (linkToken: string, customIframeId?: string) => {
    removePrewarmIframe()
    // Clear any prior backup session so its config can't leak into the token
    // path and its pending tier timer can't fire against this iframe.
    resetBackupState()

    if (!linkToken) {
      options?.onExit?.('Invalid link token!')
      return
    }

    if (options?.renderType === 'embedded' && !customIframeId) {
      const msg =
        'Mesh SDK: Failed to open link - renderType "embedded" requires a customIframeId'
      console.error(msg)
      options?.onExit?.(msg)
      return
    }

    currentOptions = options
    let linkUrl = window.atob(linkToken)
    const isProtocolValid =
      linkUrl.startsWith('http://') || linkUrl.startsWith('https://')
    if (!isProtocolValid) {
      options?.onExit?.('Invalid link token!')
      return
    }

    linkUrl = addLanguage(linkUrl, currentOptions?.language)
    linkUrl = addDisplayFiatCurrency(
      linkUrl,
      currentOptions?.displayFiatCurrency
    )
    linkUrl = addTheme(linkUrl, currentOptions?.theme)
    linkUrl = addRenderType(linkUrl, currentOptions?.renderType)
    linkTokenOrigin = new URL(linkUrl).origin
    window.removeEventListener('message', eventsListener)
    if (customIframeId) {
      const iframe = document.getElementById(
        customIframeId
      ) as HTMLIFrameElement
      if (iframe) {
        iframe.allow = buildIframeAllowPolicy(linkTokenOrigin!)
        iframe.src = linkUrl
        currentIframeId = customIframeId
      } else {
        console.warn(`Mesh SDK: No iframe found with id ${customIframeId}`)
      }
    } else {
      currentIframeId = iframeId
      addPopup(linkUrl)
    }

    window.addEventListener('message', eventsListener)

    targetOrigin = window.location.origin

    const iframe = iframeElement()

    if (iframe) {
      bridgeParent = new BridgeParent(iframe)
    }
  }

  const openLinkBackup = (
    session: MeshBackupConfig,
    backupOptions?: MeshBackupOptions
  ) => {
    removePrewarmIframe()

    if (!session) {
      options?.onExit?.('Invalid backup session!')
      return
    }

    const customIframeId = backupOptions?.customIframeId

    if (options?.renderType === 'embedded' && !customIframeId) {
      const msg =
        'Mesh SDK: Failed to open backup link - renderType "embedded" requires a customIframeId'
      console.error(msg)
      options?.onExit?.(msg)
      return
    }

    // Start a fresh backup session (clears any prior controller/timer).
    resetBackupState()
    currentOptions = options
    backupSession = session

    const widgetOrigin =
      backupOptions?.widgetOrigin || DEFAULT_BACKUP_WIDGET_ORIGIN

    let widgetUrl: string
    try {
      // The widget reads only `theme=dark|light`; `system`/unset is left to its
      // own `prefers-color-scheme` fallback.
      const theme =
        currentOptions?.theme === 'dark' || currentOptions?.theme === 'light'
          ? currentOptions.theme
          : undefined
      widgetUrl = buildBackupWidgetUrl(widgetOrigin, {
        platform: sdkSpecs.platform,
        sdkVersion: sdkSpecs.version,
        theme
      })
      linkTokenOrigin = new URL(widgetUrl).origin
    } catch {
      resetBackupState()
      options?.onExit?.('Invalid backup widget origin!')
      return
    }

    window.removeEventListener('message', eventsListener)
    if (customIframeId) {
      const iframe = document.getElementById(
        customIframeId
      ) as HTMLIFrameElement
      if (iframe) {
        iframe.allow = buildIframeAllowPolicy(linkTokenOrigin!)
        iframe.src = widgetUrl
        currentIframeId = customIframeId
      } else {
        console.warn(`Mesh SDK: No iframe found with id ${customIframeId}`)
      }
    } else {
      currentIframeId = iframeId
      addPopup(widgetUrl)
    }

    window.addEventListener('message', eventsListener)

    targetOrigin = window.location.origin

    const iframe = iframeElement()

    if (iframe) {
      bridgeParent = new BridgeParent(iframe)

      // Arm the Tier-1 → Tier-2 cascade. If the backup origin never completes its
      // ready handshake (unreachable / served-but-broken), fall back to the
      // bundled offline widget; if even that never becomes ready, fail closed.
      backupTierController = createBackupTierController({
        onFallback: (reason: BackupTierFallbackReason) => {
          void cascadeBackupToTier2(reason)
        },
        onTier2Unavailable: () => {
          failBackupClosed('Backup deposit flow is unavailable')
        }
      })
      // Best-effort hard-failure signal: a cross-origin iframe rarely fires
      // `error` for a failed navigation (the ready-handshake timeout is the
      // authoritative Tier-1 signal), but when it does fire we cascade at once
      // instead of waiting the timeout out.
      iframe.addEventListener('error', () =>
        backupTierController?.reportLoadError()
      )
      backupTierController.start()
    }
  }

  const closeLink = () => {
    bridgeParent?.destroy()
    removePopup()
    window.removeEventListener('message', eventsListener)
    resetBackupState()
    options.onExit?.()
  }

  const closeLinkRequested = () => {
    if (currentOptions?.renderType === 'embedded') {
      sendMessageToIframe({ type: 'closeRequested' })
    } else {
      closeLink()
    }
  }

  return {
    openLink,
    openLinkBackup,
    closeLink,
    closeLinkRequested
  }
}

function addLanguage(linkUrl: string, language: string | undefined) {
  if (language === 'system') {
    language =
      typeof navigator !== 'undefined' && navigator.language
        ? encodeURIComponent(navigator.language)
        : undefined
  }

  return appendQueryParam(linkUrl, 'lng', language || 'en')
}

function addDisplayFiatCurrency(
  linkUrl: string,
  displayFiatCurrency: string | undefined
) {
  if (displayFiatCurrency) {
    return appendQueryParam(linkUrl, 'fiatCur', displayFiatCurrency)
  }
  return linkUrl
}

function addTheme(linkUrl: string, theme: LinkOptions['theme']) {
  if (theme) {
    return appendQueryParam(linkUrl, 'th', theme)
  }
  return linkUrl
}

function addRenderType(linkUrl: string, renderType: LinkOptions['renderType']) {
  if (renderType === 'embedded') {
    return appendQueryParam(linkUrl, 'rt', 'embedded')
  }
  return linkUrl
}

if (!window.meshLinkShouldSkipPrewarm) {
  createPrewarmIframe()
}

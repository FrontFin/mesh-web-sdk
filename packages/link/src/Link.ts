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
// Monotonic id for the current backup session. Every async operation (JIT reply,
// cascade import, iframe `error`) captures the id it started under and re-checks
// it before acting, so work from a session that has ended or been replaced can
// never post into / clobber a later one (a reused `callId` must never associate a
// deposit address with the wrong session — money path).
let backupSessionId = 0
// The widget iframe's window for the active backup session. JIT requests are only
// honoured when they come from this exact window (`event.source`), so another
// same-origin frame cannot drive the client's address-generation callbacks.
let backupIframeWindow: Window | null = null
// Removes the Tier-1 `error` listener bound to the current backup iframe.
let removeBackupIframeErrorListener: (() => void) | null = null

/**
 * Tear down any in-flight backup session state. Called when a session ends or
 * when the primary (token) flow starts, so a pending Tier-1 timeout can never
 * fire against a later iframe and a stale config can never be re-delivered.
 * Bumping `backupSessionId` invalidates any async work still bound to the old id.
 */
function resetBackupState() {
  backupSession = undefined
  backupTierController?.destroy()
  backupTierController = null
  backupIframeWindow = null
  removeBackupIframeErrorListener?.()
  removeBackupIframeErrorListener = null
  backupSessionId += 1
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
  // sent by the backup widget, so it is gated on an active backup session AND on
  // the message coming from that widget's own window — otherwise any other
  // same-origin frame could drive the client's backend address-generation calls.
  if ((event.data as { type?: string }).type === JIT_REQUEST_MESSAGE_TYPE) {
    if (backupSession && event.source && event.source === backupIframeWindow) {
      await handleBackupJitRequest(
        (event.data as unknown as { payload?: MeshBackupJitRequestPayload })
          .payload
      )
    }
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

  // Bind the reply to the session/widget that made the request. The callback is
  // async, so by the time it settles the session may have ended or been replaced;
  // posting the result then (or with a reused callId) could associate a deposit
  // address with the wrong session. Capture the target now and only reply if this
  // is still the same session.
  const sessionId = backupSessionId
  const targetWindow = backupIframeWindow
  const targetOrigin = linkTokenOrigin
  const respond = (response: MeshBackupJitResponsePayload) => {
    if (backupSessionId !== sessionId || !targetWindow || !targetOrigin) return
    try {
      targetWindow.postMessage(
        { type: JIT_RESPONSE_MESSAGE_TYPE, payload: response },
        targetOrigin
      )
    } catch (e) {
      console.error('Mesh SDK: Failed to deliver JIT response to the widget')
      console.error(e)
    }
  }

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
async function cascadeBackupToTier2(
  reason: BackupTierFallbackReason,
  sessionId: number
) {
  currentOptions?.onEvent?.({
    type: 'backupTierChanged',
    payload: { from: 'tier1', to: 'tier2', reason }
  })

  // Re-pin the message origin to the host page and tear down the Tier-1 surface
  // synchronously (before the async import) so nothing from it races the swap.
  linkTokenOrigin = window.location.origin
  backupIframeWindow = null
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
    // unreachable). Fail closed — never a blank QR. Only if still this session.
    if (backupSessionId === sessionId) {
      failBackupClosed('Backup deposit flow is unavailable')
    }
    return
  }

  // The session may have ended or been replaced while the bundle was importing —
  // do not touch the current (possibly different) session's iframe.
  if (backupSessionId !== sessionId) return

  const iframe = iframeElement()
  if (!iframe) {
    failBackupClosed('Backup deposit flow is unavailable')
    return
  }

  iframe.srcdoc = html
  bridgeParent = new BridgeParent(iframe)
  // Tier-2 is our own inline document, same-origin with the host — track its
  // window so JIT requests from it are accepted (event.source check).
  backupIframeWindow = iframe.contentWindow
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
        // Clear any leftover Tier-2 `srcdoc` from a prior backup session — it
        // takes precedence over `src` and would otherwise pin this iframe there.
        iframe.removeAttribute('srcdoc')
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
      // Only http(s) origins may be loaded into the iframe. `new URL().origin`
      // alone would accept `javascript:`/`data:` schemes, which could execute in
      // the iframe's initial same-origin context — reject anything else, matching
      // the primary flow's protocol check.
      const parsedOrigin = new URL(widgetOrigin)
      if (
        parsedOrigin.protocol !== 'http:' &&
        parsedOrigin.protocol !== 'https:'
      ) {
        throw new Error('widgetOrigin must be an http(s) URL')
      }
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
      if (!iframe) {
        // No surface to render into — fail closed rather than leave the session
        // active with no iframe/controller (which would hang with no onExit).
        const msg = `Mesh SDK: No iframe found with id ${customIframeId}`
        console.warn(msg)
        resetBackupState()
        options?.onExit?.(msg)
        return
      }
      iframe.allow = buildIframeAllowPolicy(linkTokenOrigin!)
      // A reused embedded iframe may still carry a Tier-2 `srcdoc` from a prior
      // backup session; `srcdoc` takes precedence over `src`, so clear it first.
      iframe.removeAttribute('srcdoc')
      iframe.src = widgetUrl
      currentIframeId = customIframeId
    } else {
      currentIframeId = iframeId
      addPopup(widgetUrl)
    }

    window.addEventListener('message', eventsListener)

    targetOrigin = window.location.origin

    const iframe = iframeElement()

    if (iframe) {
      bridgeParent = new BridgeParent(iframe)
      // Track this session's widget window so JIT requests are only honoured when
      // they come from it (event.source check in handleLinkEvent).
      backupIframeWindow = iframe.contentWindow

      // Capture the session id so the cascade/fail-closed/error callbacks below
      // only act while this session is still the active one.
      const sessionId = backupSessionId

      // Arm the Tier-1 → Tier-2 cascade. If the backup origin never completes its
      // ready handshake (unreachable / served-but-broken), fall back to the
      // bundled offline widget; if even that never becomes ready, fail closed.
      backupTierController = createBackupTierController({
        onFallback: (reason: BackupTierFallbackReason) => {
          if (backupSessionId === sessionId) {
            void cascadeBackupToTier2(reason, sessionId)
          }
        },
        onTier2Unavailable: () => {
          if (backupSessionId === sessionId) {
            failBackupClosed('Backup deposit flow is unavailable')
          }
        }
      })
      // Best-effort hard-failure signal: a cross-origin iframe rarely fires
      // `error` for a failed navigation (the ready-handshake timeout is the
      // authoritative Tier-1 signal), but when it does fire we cascade at once
      // instead of waiting the timeout out. Session-bound + removed on teardown so
      // a late error from an old (embedded) iframe can't cascade a later session.
      const onIframeError = () => {
        if (backupSessionId === sessionId) {
          backupTierController?.reportLoadError()
        }
      }
      iframe.addEventListener('error', onIframeError)
      removeBackupIframeErrorListener = () =>
        iframe.removeEventListener('error', onIframeError)

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

import {
  LinkOptions,
  Link,
  EventType,
  AccessTokenPayload,
  DelayedAuthPayload,
  TransferFinishedPayload,
  LinkPayload,
  MeshBackupConfig,
  MeshBackupOptions
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
import { JIT_REQUEST_MESSAGE_TYPE, SESSION_NONCE_PARAM } from './utils/backup'
import { BackupFlowHost, createBackupFlow } from './backupFlow'
import { BridgeParent } from '@meshconnect/uwc-bridge-parent'
import { createPrewarmIframe, removePrewarmIframe } from './utils/prewarm'

let currentOptions: LinkOptions | undefined
let targetOrigin: string | undefined
let linkTokenOrigin: string | undefined
let currentIframeId = iframeId
let bridgeParent: BridgeParent | null = null

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
  // Tier 2 is a sandboxed, opaque-origin iframe (no pinnable origin) — post with a
  // '*' target; the widget is our own bundled content and authenticates us in turn.
  const target = backup.isTier2() ? '*' : linkTokenOrigin
  if (!target) {
    console.warn(
      `Mesh SDK: Failed to deliver ${message.type} message to the iframe - no link token origin found`
    )
    return
  }
  try {
    iframe.contentWindow?.postMessage(message, target)
  } catch (e) {
    console.error(
      `Mesh SDK: Failed to deliver ${message.type} message to the iframe`
    )
    console.error(e)
  }
}

// The SDK-backup (deposit-only fallback) flow lives in its own module. It reads and
// writes the shared Link state through this host bridge; the message handlers below
// query it for backup state (`isTier2`/`getActiveFlow`/`isFromActiveWidget`) and
// delegate the backup branches to it (`handleJitRequest`/`completeReadyHandshake`).
const backupHost: BackupFlowHost = {
  getOptions: () => currentOptions,
  setOptions: options => {
    currentOptions = options
  },
  getLinkTokenOrigin: () => linkTokenOrigin,
  setLinkTokenOrigin: origin => {
    linkTokenOrigin = origin
  },
  setTargetOrigin: origin => {
    targetOrigin = origin
  },
  iframeElement,
  setCurrentIframeId: id => {
    currentIframeId = id
  },
  getBridgeParent: () => bridgeParent,
  setBridgeParent: bridge => {
    bridgeParent = bridge
  },
  addMessageListener: () => window.addEventListener('message', eventsListener),
  removeMessageListener: () =>
    window.removeEventListener('message', eventsListener),
  sendMessageToIframe
}
const backup = createBackupFlow(backupHost)

type MessageLinkEvent = {
  type: EventType
  payload?: AccessTokenPayload | DelayedAuthPayload | TransferFinishedPayload
  link?: string
}

async function handleLinkEvent(
  event: MessageEvent<MessageLinkEvent> | MessageEvent<LinkEventType>
) {
  // Backup JIT RPC: the widget asks the host to run its `onAddressInit` /
  // `onStatusPoll` callbacks for an address-less destination (OR-452). Handled
  // BEFORE the switch (not as a case) on purpose: its type is not in the `EventType`
  // union the switch discriminates on, so folding it in would need a cast on the
  // switch subject, which breaks the union narrowing the `default` case relies on
  // (`onEvent(event.data)` expects a `LinkEventType`). It is also an RPC, not a Link
  // event forwarded to `onEvent`. The backup flow gates it on the active session +
  // widget window.
  if ((event.data as { type?: string }).type === JIT_REQUEST_MESSAGE_TYPE) {
    await backup.handleJitRequest(event)
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
      // The widget emits BOTH `done` and `close` (and `exit`) on teardown. Remove
      // the listener FIRST so the second message can't re-invoke onExit, then tear
      // down fully (also clears the backup session/timer), and only then call
      // onExit — so a callback can't synchronously reopen a flow we then tear down.
      const onExit = currentOptions?.onExit
      window.removeEventListener('message', eventsListener)
      bridgeParent?.destroy()
      removePopup()
      backup.reset()
      onExit?.(payload?.errorMessage, payload)
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
      // user's credentials cross-origin. Gate on the POSITIVE `activeFlow ===
      // 'primary'` (not `!backupSession`): after an aborted re-open the stale
      // backup iframe can still fire `loaded` with the session cleared, and only
      // this positive check withholds the tokens in that dead window.
      if (
        currentOptions?.accessTokens &&
        backup.getActiveFlow() === 'primary'
      ) {
        sendMessageToIframe({
          type: 'frontAccessTokens',
          payload: currentOptions.accessTokens
        })
      }

      // The backup flow completes its ready handshake + config delivery here, but
      // only for a `loaded` from its own widget window (no-op otherwise).
      backup.completeReadyHandshake(event)

      currentOptions?.onEvent?.({ type: 'pageLoaded' })
      break
    }
    default: {
      // `backupTierChanged` is generated by the SDK itself (backupFlow) — never
      // accept it from a widget, which could otherwise forge tier transitions.
      if (
        isLinkEventTypeKey(event.data.type) &&
        event.data.type !== 'backupTierChanged'
      ) {
        // Backup widget messages carry the internal session nonce (`sid`) — it is
        // transport-only, not part of the public event contract, so strip it.
        const linkEvent = { ...event.data } as LinkEventType & {
          [SESSION_NONCE_PARAM]?: string
        }
        delete linkEvent[SESSION_NONCE_PARAM]
        currentOptions?.onEvent?.(linkEvent)
      }
      break
    }
  }
}

async function eventsListener(
  event: MessageEvent<LinkEventType | { type: EventType }>
) {
  // Tier 2 runs sandboxed with an opaque origin (event.origin === 'null').
  // Authenticate by BOTH the source window AND the opaque origin: navigating the
  // iframe from Tier 1 to the blob doc does NOT change its WindowProxy, so a late
  // Tier-1 message queued before the swap still has `event.source ===
  // backupIframeWindow` — but it carries the Tier-1 (non-'null') origin, so the
  // origin check rejects it and it can't spuriously complete the Tier-2 handshake.
  if (backup.isTier2()) {
    if (backup.isFromActiveWidget(event) && event.origin === 'null') {
      await handleLinkEvent(event as MessageEvent<{ type: EventType }>)
    } else {
      console.warn('Ignored backup Tier-2 message from an unexpected source')
    }
    return
  }
  if (event.origin !== targetOrigin && event.origin !== linkTokenOrigin) {
    console.warn('Received message from untrusted origin:', event.origin)
    return
  }
  // No flow is live. An aborted re-open (`openLink` with a bad token, or
  // `openLinkBackup` with a bad origin) calls `backup.reset()` — clearing the
  // active-flow marker — but returns early WITHOUT removing the previous iframe or
  // this listener. A late `close`/`transferFinished` from that stale iframe still
  // passes the retained origin check, so gate on the POSITIVE active flow: drop
  // everything while no flow is active.
  if (backup.getActiveFlow() === null) {
    console.warn('Ignored message: no active Link flow')
    return
  }
  // During a BACKUP flow, additionally require the message to come from the active
  // widget window — not just the backup ORIGIN. In embedded mode a reopen into a
  // different iframe leaves the previous one alive on the SAME backup origin, so an
  // origin-only check would let a late `close`/`done`/`transferFinished` from the
  // stale iframe tear down or report a transfer for the current session. A reopen
  // into the SAME embedded iframe keeps its window AND origin, so the message must
  // also echo this open's session nonce (`isFromActiveWidget`). (Primary flow has
  // no backup widget window, so it is gated by origin only, as before.)
  if (
    backup.getActiveFlow() === 'backup' &&
    !backup.isFromActiveWidget(event)
  ) {
    console.warn('Ignored backup message from an unexpected source')
    return
  }
  await handleLinkEvent(event as MessageEvent<{ type: EventType }>)
}

export const createLink = (options: LinkOptions): Link => {
  const openLink = (linkToken: string, customIframeId?: string) => {
    removePrewarmIframe()
    // Clear any prior backup session so its config can't leak into the token
    // path and its pending tier timer can't fire against this iframe.
    backup.reset()

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

    // Committed to the primary (token) flow — safe to forward access tokens on the
    // `loaded` handshake. (`backup.reset()` above cleared any prior flow.)
    backup.setPrimaryFlow()

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
        // Clear any leftover Tier-2 state from a prior backup session on this
        // reused iframe: `srcdoc` (takes precedence over `src`) and the `sandbox`
        // attribute (would otherwise keep it opaque-origin).
        iframe.removeAttribute('srcdoc')
        iframe.removeAttribute('sandbox')
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
    backup.open(options, session, backupOptions)
  }

  const closeLink = () => {
    bridgeParent?.destroy()
    removePopup()
    window.removeEventListener('message', eventsListener)
    backup.reset()
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

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
  MeshBackupJitResponsePayload,
  MeshBackupStatusResult
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
// Which flow is currently live. A POSITIVE discriminator for "safe to forward
// integration access tokens" (`'primary'` only) — `!backupSession` is NOT safe,
// because an aborted re-open (`openLink` with a bad token, or `openLinkBackup`
// with a bad origin) clears `backupSession` while the previous backup iframe +
// listener are still live; a late `loaded` from that stale backup iframe would
// then pass a `!backupSession` check and ship `frontAccessTokens` to the
// independent backup origin. In that aborted/dead window `activeFlow` is `null`,
// so tokens are withheld. Set only after a flow commits; cleared on every
// teardown/abort via `resetBackupState`.
let activeFlow: 'primary' | 'backup' | null = null
// Tier-1 → Tier-2 cascade state machine, live only during a backup session.
let backupTierController: BackupTierController | null = null
// Monotonic id for the current backup session. Every async operation (JIT reply,
// cascade import, iframe `error`) captures the id it started under and re-checks
// it before acting, so work from a session that has ended or been replaced can
// never post into / clobber a later one (a reused `callId` must never associate a
// deposit address with the wrong session — money path).
let backupSessionId = 0
// The widget iframe's window for the active backup session. Backup messages
// (`loaded`, JIT) are only honoured when they come from this exact window
// (`event.source`), so another frame cannot drive the client's callbacks.
let backupIframeWindow: Window | null = null
// Removes the Tier-1 `error` listener bound to the current backup iframe.
let removeBackupIframeErrorListener: (() => void) | null = null
// True once cascaded to Tier 2, which loads the bundled widget in a SANDBOXED,
// opaque-origin iframe (blob: URL). Its `event.origin` is `'null'`, so messages
// are authenticated by `event.source` instead, and we post to it with a `'*'`
// target. (Tier 1 stays origin-pinned.)
let backupTier2 = false
// Object URL backing the Tier-2 iframe; revoked on teardown to avoid a leak.
let backupTier2BlobUrl: string | null = null

/**
 * Tear down any in-flight backup session state. Called when a session ends or
 * when the primary (token) flow starts, so a pending Tier-1 timeout can never
 * fire against a later iframe and a stale config can never be re-delivered.
 * Bumping `backupSessionId` invalidates any async work still bound to the old id.
 */
function resetBackupState() {
  backupSession = undefined
  // Entering a fresh/dead state: no flow is live until one re-commits below. This
  // is what makes a late `loaded` from a stale backup iframe fail the token-
  // forwarding gate (`activeFlow === 'primary'`) during an aborted re-open.
  activeFlow = null
  backupTierController?.destroy()
  backupTierController = null
  backupIframeWindow = null
  removeBackupIframeErrorListener?.()
  removeBackupIframeErrorListener = null
  backupTier2 = false
  if (backupTier2BlobUrl) {
    URL.revokeObjectURL(backupTier2BlobUrl)
    backupTier2BlobUrl = null
  }
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
  // Tier 2 is a sandboxed, opaque-origin iframe (no pinnable origin) — post with a
  // '*' target; the widget is our own bundled content and authenticates us in turn.
  const target = backupTier2 ? '*' : linkTokenOrigin
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
      // The widget emits BOTH `done` and `close` (and `exit`) on teardown. Remove
      // the listener FIRST so the second message can't re-invoke onExit, then tear
      // down fully (also clears the backup session/timer), and only then call
      // onExit — so a callback can't synchronously reopen a flow we then tear down.
      const onExit = currentOptions?.onExit
      window.removeEventListener('message', eventsListener)
      bridgeParent?.destroy()
      removePopup()
      resetBackupState()
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
      // backup iframe can still fire `loaded` with `backupSession` cleared, and
      // only this positive check withholds the tokens in that dead window.
      if (currentOptions?.accessTokens && activeFlow === 'primary') {
        sendMessageToIframe({
          type: 'frontAccessTokens',
          payload: currentOptions.accessTokens
        })
      }

      // Only the backup widget's OWN window may complete the ready handshake.
      // `eventsListener` also admits host-origin messages (Tier 1), so without
      // this an unrelated same-origin frame posting `{ type: 'loaded' }` would
      // call `markReady()` and permanently cancel the Tier-1 → Tier-2 fallback.
      if (
        backupSession &&
        event.source &&
        event.source === backupIframeWindow
      ) {
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
  // Tier 2 runs sandboxed with an opaque origin (event.origin === 'null').
  // Authenticate by BOTH the source window AND the opaque origin: navigating the
  // iframe from Tier 1 to the blob doc does NOT change its WindowProxy, so a late
  // Tier-1 message queued before the swap still has `event.source ===
  // backupIframeWindow` — but it carries the Tier-1 (non-'null') origin, so the
  // origin check rejects it and it can't spuriously complete the Tier-2 handshake.
  if (backupTier2) {
    if (
      event.source &&
      event.source === backupIframeWindow &&
      event.origin === 'null'
    ) {
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
  // During a backup session, additionally require the message to come from the
  // active widget window — not just the backup ORIGIN. In embedded mode a reopen
  // into a different iframe leaves the previous one alive on the SAME backup
  // origin, so an origin-only check would let a late `close`/`done`/
  // `transferFinished` from the stale iframe tear down or report a transfer for
  // the current session. `loaded`/JIT already check this per-case; this covers
  // every event. (Primary flow has no `backupIframeWindow`, so it is unaffected.)
  if (backupSession && event.source !== backupIframeWindow) {
    console.warn('Ignored backup message from an unexpected source')
    return
  }
  await handleLinkEvent(event as MessageEvent<{ type: EventType }>)
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
  // Tier 2 is opaque-origin → reply with a '*' target; Tier 1 is origin-pinned.
  const replyTarget = backupTier2 ? '*' : linkTokenOrigin
  const respond = (response: MeshBackupJitResponsePayload) => {
    if (backupSessionId !== sessionId || !targetWindow || !replyTarget) return
    try {
      targetWindow.postMessage(
        { type: JIT_RESPONSE_MESSAGE_TYPE, payload: response },
        replyTarget
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
      // Post only the contract fields to the widget's (independent) origin. The
      // callback's return may structurally contain extra fields (e.g. a raw
      // backend response with identifiers/credentials); never forward those.
      const safeResult: MeshBackupStatusResult =
        result?.status === 'ready'
          ? result.addressTag
            ? {
                status: 'ready',
                address: result.address,
                addressTag: result.addressTag
              }
            : { status: 'ready', address: result.address }
          : { status: result?.status === 'failed' ? 'failed' : 'pending' }
      respond({ callId, ok: true, result: safeResult })
    } else {
      throw new Error(`Unknown backup JIT method: ${String(method)}`)
    }
  } catch (e) {
    // Log the real error host-side, but send the widget a fixed, non-revealing
    // message — callback exceptions can contain URLs / identifiers / credentials,
    // which must not cross to the independent widget origin.
    console.error('Mesh SDK: backup JIT callback failed', e)
    respond({ callId, ok: false, error: 'JIT callback failed' })
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
 * widget loaded as a SANDBOXED, opaque-origin `blob:` URL (not `srcdoc`) — see the
 * detailed rationale at the swap below. The bundle is imported dynamically so
 * Tier-1-only consumers can code-split the ~135 KB asset out of their main chunk.
 *
 * ⚠️ Host CSP: navigating the iframe to a `blob:` URL requires the embedding page's
 * CSP to permit `blob:` in `frame-src`/`child-src` (or `default-src`). A host that
 * only allows the Tier-1 origin there will block the Tier-2 frame and the fallback
 * will time out — this is a documented integration requirement (see README).
 */
async function cascadeBackupToTier2(
  reason: BackupTierFallbackReason,
  sessionId: number
) {
  currentOptions?.onEvent?.({
    type: 'backupTierChanged',
    payload: { from: 'tier1', to: 'tier2', reason }
  })

  // `onEvent` ran consumer code synchronously; if it opened a new flow,
  // `resetBackupState` advanced the session id — bail before touching any iframe.
  if (backupSessionId !== sessionId) return

  // Tear down the Tier-1 surface synchronously (before the async import) so
  // nothing from it races the swap.
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

  // Load the bundled widget in a SANDBOXED, opaque-origin iframe via a blob: URL —
  // NOT `srcdoc`. An `about:srcdoc` document (a) runs same-origin with the host, so
  // its scripts could reach the host DOM / storage / same-origin credentials, and
  // (b) inherits the host page's CSP, so a strict host `script-src` (no
  // 'unsafe-inline') would block the widget's inline script and it would never send
  // `loaded` (every fallback then times out despite a valid bundle). A blob:
  // document has its own opaque origin (isolated from the host) and its own empty
  // CSP context (the inline script runs), fixing both. Because the origin is opaque
  // ('null'), bridge messages are authenticated by `event.source` (see
  // `eventsListener`/`handleLinkEvent`) rather than by origin, and we post to it
  // with a '*' target.
  const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  backupTier2BlobUrl = blobUrl
  backupTier2 = true
  iframe.removeAttribute('srcdoc')
  // allow-scripts WITHOUT allow-same-origin ⇒ opaque origin. The iframe's `allow`
  // (Permissions-Policy, incl. clipboard) set at mount is preserved for copy-address.
  iframe.setAttribute('sandbox', 'allow-scripts')
  iframe.src = blobUrl
  bridgeParent = new BridgeParent(iframe)
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

    // Committed to the primary (token) flow — safe to forward access tokens on the
    // `loaded` handshake. (`resetBackupState()` above cleared any prior flow.)
    activeFlow = 'primary'

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

    // Origin validated — this backup flow is now the live one. (A later no-iframe
    // abort below calls `resetBackupState()`, which clears this again.) Access
    // tokens are never forwarded while `activeFlow === 'backup'`.
    activeFlow = 'backup'

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
      // A reused embedded iframe may still carry Tier-2 state from a prior backup
      // session — clear `srcdoc` (precedence over `src`) and `sandbox` (opaque).
      iframe.removeAttribute('srcdoc')
      iframe.removeAttribute('sandbox')
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

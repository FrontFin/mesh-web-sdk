import {
  LinkOptions,
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
import { sdkSpecs } from './utils/sdk-specs'
import {
  BACKUP_CONFIG_MESSAGE_TYPE,
  DEFAULT_BACKUP_WIDGET_ORIGIN,
  JIT_RESPONSE_MESSAGE_TYPE,
  SESSION_NONCE_PARAM,
  buildBackupWidgetUrl,
  createSessionNonce
} from './utils/backup'
import {
  BackupTierController,
  BackupTierFallbackReason,
  createBackupTierController
} from './utils/backupTier'
import { BridgeParent } from '@meshconnect/uwc-bridge-parent'
import { removePrewarmIframe } from './utils/prewarm'

/**
 * Validate a host `onStatusPoll` result against the three-variant contract and
 * return ONLY the contract fields. Throws on anything malformed — a missing,
 * misspelled, or non-string `status`, or a `'ready'` without a non-empty string
 * `address` — so the handler's catch fails the poll closed (`ok: false`). The
 * previous builder silently coerced any unknown status to `'pending'` (which
 * polls forever) and forwarded `'ready'` without an address (an invalid
 * success); both are money-path failure modes. Extra fields (e.g. a raw backend
 * response carrying identifiers/credentials) are dropped, never forwarded across
 * the bridge to the widget's independent origin.
 */
export function sanitizeStatusResult(result: unknown): MeshBackupStatusResult {
  const status =
    typeof result === 'object' && result !== null
      ? (result as { status?: unknown }).status
      : undefined
  if (status === 'pending') return { status: 'pending' }
  if (status === 'failed') return { status: 'failed' }
  if (status === 'ready') {
    const address = (result as { address?: unknown }).address
    if (typeof address !== 'string' || address.length === 0) {
      throw new Error(
        "onStatusPoll returned status 'ready' without a valid address"
      )
    }
    const addressTag = (result as { addressTag?: unknown }).addressTag
    // A memo/tag chain deposit without its tag can strand funds, so a tag that is
    // present but not a string is malformed — fail closed rather than drop it and
    // report a tag-less 'ready'. `null`/`undefined`/`''` mean "no tag".
    if (
      addressTag !== undefined &&
      addressTag !== null &&
      typeof addressTag !== 'string'
    ) {
      throw new Error(
        "onStatusPoll returned status 'ready' with a non-string addressTag"
      )
    }
    return typeof addressTag === 'string' && addressTag.length > 0
      ? { status: 'ready', address, addressTag }
      : { status: 'ready', address }
  }
  throw new Error(
    `onStatusPoll returned an invalid status: ${JSON.stringify(
      status
    )} (expected 'pending' | 'ready' | 'failed')`
  )
}

/** Which flow is currently live. A POSITIVE discriminator for "safe to forward
 *  integration access tokens" (`'primary'` only). */
export type ActiveFlow = 'primary' | 'backup' | null

/**
 * The shared Link state/helpers the backup flow needs from its host (`Link.ts`).
 * Injected (rather than imported) so the two files don't form an import cycle and
 * the shared primary/backup state keeps a single owner. The message listener and
 * `sendMessageToIframe` (which reads `isTier2()` below) live in the host.
 */
export interface BackupFlowHost {
  getOptions(): LinkOptions | undefined
  setOptions(options: LinkOptions): void
  getLinkTokenOrigin(): string | undefined
  setLinkTokenOrigin(origin: string): void
  setTargetOrigin(origin: string): void
  /** The current iframe element (resolved from the host's `currentIframeId`). */
  iframeElement(): HTMLIFrameElement
  setCurrentIframeId(id: string): void
  getBridgeParent(): BridgeParent | null
  setBridgeParent(bridge: BridgeParent | null): void
  addMessageListener(): void
  removeMessageListener(): void
  sendMessageToIframe<T extends { type: string }>(message: T): void
}

/**
 * Owns the entire SDK-backup (deposit-only fallback) flow — Tier-1 init, the
 * Tier-1 → Tier-2 cascade, the JIT callback bridge, and all of its session state —
 * extracted from `Link.ts`. The host keeps the primary (token) flow and the shared
 * message handlers, which query this controller for backup state via the getters.
 */
export interface BackupFlow {
  /** Tear down any in-flight backup session + clear the live-flow marker. */
  reset(): void
  /** Mark the primary (token) flow as the live one (enables token forwarding). */
  setPrimaryFlow(): void
  getActiveFlow(): ActiveFlow
  /** True once cascaded to the sandboxed, opaque-origin Tier-2 blob iframe. */
  isTier2(): boolean
  /**
   * True only for a message from the ACTIVE open: an active backup session, sent
   * by its widget window (`event.source`), echoing this open's session nonce
   * (`event.data.sid`). The nonce is what isolates a reopen into the SAME embedded
   * iframe, where `event.source` and the origin are unchanged.
   */
  isFromActiveWidget(event: MessageEvent): boolean
  /** Open the deposit-only backup flow (replaces `openLink` for an outage).
   *  `options` is the owning `createLink`'s options (kept as the live options so
   *  the async JIT/cascade/exit callbacks resolve against this session). */
  open(
    options: LinkOptions | undefined,
    session: MeshBackupConfig,
    backupOptions?: MeshBackupOptions
  ): void
  /** Handle a widget→host JIT RPC, gated on the active backup widget window. */
  handleJitRequest(event: MessageEvent): Promise<void>
  /** On the widget's `loaded` handshake (from its own window): mark the tier ready
   *  and deliver the config. No-op for any other source. */
  completeReadyHandshake(event: MessageEvent): void
}

export function createBackupFlow(host: BackupFlowHost): BackupFlow {
  // Set by `open`, delivered to the widget on its `loaded` handshake.
  let backupSession: MeshBackupConfig | undefined
  // See `ActiveFlow`: `!backupSession` is NOT a safe token-forwarding gate, because
  // an aborted re-open (`openLink` with a bad token, or `open` with a bad origin)
  // clears `backupSession` while the previous backup iframe + listener are still
  // live; a late `loaded` from that stale iframe would then pass a `!backupSession`
  // check and ship `frontAccessTokens` to the independent backup origin. In that
  // aborted/dead window `activeFlow` is `null`, so tokens are withheld.
  let activeFlow: ActiveFlow = null
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
  // This open's session nonce, put on the widget URL (`?sid=` / Tier-2 `#sid=`) and
  // echoed by the widget on every message. Navigating a reused embedded iframe
  // keeps its WindowProxy and Tier-1 sessions share an origin, so this is the only
  // thing that tells a stale message from the previous document apart from the
  // current open's — e.g. a queued `close` (spurious onExit) or `loaded` (would
  // cancel the Tier-1 → Tier-2 fallback).
  let sessionNonce: string | null = null

  /**
   * Tear down any in-flight backup session state. Called when a session ends or
   * when the primary (token) flow starts, so a pending Tier-1 timeout can never
   * fire against a later iframe and a stale config can never be re-delivered.
   * Bumping `backupSessionId` invalidates any async work still bound to the old id.
   */
  function reset() {
    backupSession = undefined
    // Entering a fresh/dead state: no flow is live until one re-commits. This is
    // what makes a late `loaded` from a stale backup iframe fail the token-
    // forwarding gate (`activeFlow === 'primary'`) during an aborted re-open.
    activeFlow = null
    backupTierController?.destroy()
    backupTierController = null
    backupIframeWindow = null
    removeBackupIframeErrorListener?.()
    removeBackupIframeErrorListener = null
    backupTier2 = false
    sessionNonce = null
    if (backupTier2BlobUrl) {
      URL.revokeObjectURL(backupTier2BlobUrl)
      backupTier2BlobUrl = null
    }
    backupSessionId += 1
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
  async function runJitRequest(
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
    const replyTarget = backupTier2 ? '*' : host.getLinkTokenOrigin()
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
        throw new TypeError(
          'backup JIT request is missing a string symbol/networkId'
        )
      }
      // The session's ADDRESS-LESS destinations are the RPC allowlist: never run
      // the client's backend callbacks for a pair it did not declare for JIT (or one
      // that already carries a static address), even if the request comes from the
      // authenticated widget window — a faulty or compromised widget must not be
      // able to generate addresses for arbitrary assets. Mirrors the RN SDK.
      const isJitDestination = backupSession?.destinations.some(
        d => d.symbol === symbol && d.networkId === networkId && !d.address
      )
      if (!isJitDestination) {
        throw new Error(
          'backup JIT request is not for an address-less destination in the session'
        )
      }
      if (method === 'addressInit') {
        const onAddressInit = host.getOptions()?.onAddressInit
        if (!onAddressInit) {
          throw new Error(
            'onAddressInit callback is required to resolve an address-less backup destination'
          )
        }
        await onAddressInit(symbol, networkId)
        respond({ callId, ok: true })
      } else if (method === 'statusPoll') {
        const onStatusPoll = host.getOptions()?.onStatusPoll
        if (!onStatusPoll) {
          throw new Error(
            'onStatusPoll callback is required to resolve an address-less backup destination'
          )
        }
        const result = await onStatusPoll(symbol, networkId)
        // Validate against the three-variant contract and post ONLY the contract
        // fields to the widget's (independent) origin. A malformed result throws
        // here, so the catch fails the poll closed (`ok: false`) rather than
        // silently polling forever on a coerced 'pending' or forwarding a 'ready'
        // with no address. Extra fields (e.g. a raw backend response with
        // identifiers/credentials) are dropped, never forwarded.
        respond({ callId, ok: true, result: sanitizeStatusResult(result) })
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
   * runs before `onExit`, and `reset` clears the session, so the removed iframe
   * cannot emit a later `close`/`done` that would call `onExit` twice.
   */
  function failBackupClosed(errorMessage: string) {
    host.getBridgeParent()?.destroy()
    host.setBridgeParent(null)
    removePopup()
    host.removeMessageListener()
    const onExit = host.getOptions()?.onExit
    reset()
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
    host.getOptions()?.onEvent?.({
      type: 'backupTierChanged',
      payload: { from: 'tier1', to: 'tier2', reason }
    })

    // `onEvent` ran consumer code synchronously; if it opened a new flow, `reset`
    // advanced the session id — bail before touching any iframe.
    if (backupSessionId !== sessionId) return

    // Tear down the Tier-1 surface synchronously (before the async import) so
    // nothing from it races the swap.
    backupIframeWindow = null
    const tier1Iframe = host.iframeElement()
    if (tier1Iframe) {
      host.getBridgeParent()?.destroy()
      host.setBridgeParent(null)
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

    const iframe = host.iframeElement()
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
    // ('null'), bridge messages are authenticated by `event.source` (see the host's
    // message handler) rather than by origin, and we post to it with a '*' target.
    const blobUrl = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
    backupTier2BlobUrl = blobUrl
    backupTier2 = true
    iframe.removeAttribute('srcdoc')
    // allow-scripts WITHOUT allow-same-origin ⇒ opaque origin. The iframe's `allow`
    // (Permissions-Policy, incl. clipboard) set at mount is preserved for copy-address.
    iframe.setAttribute('sandbox', 'allow-scripts')
    // A blob: URL can't take a query, so the session nonce rides in the fragment.
    iframe.src = `${blobUrl}#${SESSION_NONCE_PARAM}=${sessionNonce ?? ''}`
    host.setBridgeParent(new BridgeParent(iframe))
    backupIframeWindow = iframe.contentWindow
  }

  function open(
    options: LinkOptions | undefined,
    session: MeshBackupConfig,
    backupOptions?: MeshBackupOptions
  ) {
    removePrewarmIframe()

    // Every abort below tears down any prior backup flow first (reset) so a stale
    // iframe from it can't keep reporting after this failed re-open calls onExit.
    if (!session) {
      reset()
      options?.onExit?.('Invalid backup session!')
      return
    }

    const customIframeId = backupOptions?.customIframeId

    if (options?.renderType === 'embedded' && !customIframeId) {
      const msg =
        'Mesh SDK: Failed to open backup link - renderType "embedded" requires a customIframeId'
      console.error(msg)
      reset()
      options?.onExit?.(msg)
      return
    }

    // Start a fresh backup session (clears any prior controller/timer), then make
    // THIS createLink's options the live ones so the async JIT/cascade/exit
    // callbacks below (which read `host.getOptions()`) resolve against this session.
    reset()
    if (options) host.setOptions(options)
    backupSession = session
    sessionNonce = createSessionNonce()

    const widgetOrigin =
      backupOptions?.widgetOrigin || DEFAULT_BACKUP_WIDGET_ORIGIN

    let widgetUrl: string
    let widgetOriginParsed: string
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
        options?.theme === 'dark' || options?.theme === 'light'
          ? options.theme
          : undefined
      widgetUrl = buildBackupWidgetUrl(widgetOrigin, {
        platform: sdkSpecs.platform,
        sdkVersion: sdkSpecs.version,
        theme,
        sessionNonce
      })
      widgetOriginParsed = new URL(widgetUrl).origin
      host.setLinkTokenOrigin(widgetOriginParsed)
    } catch {
      reset()
      options?.onExit?.('Invalid backup widget origin!')
      return
    }

    // Origin validated — this backup flow is now the live one. (A later no-iframe
    // abort below calls `reset()`, which clears this again.) Access tokens are never
    // forwarded while `activeFlow === 'backup'`.
    activeFlow = 'backup'

    host.removeMessageListener()
    if (customIframeId) {
      const iframe = document.getElementById(
        customIframeId
      ) as HTMLIFrameElement
      if (!iframe) {
        // No surface to render into — fail closed rather than leave the session
        // active with no iframe/controller (which would hang with no onExit).
        const msg = `Mesh SDK: No iframe found with id ${customIframeId}`
        console.warn(msg)
        reset()
        options?.onExit?.(msg)
        return
      }
      iframe.allow = buildIframeAllowPolicy(widgetOriginParsed)
      // A reused embedded iframe may still carry Tier-2 state from a prior backup
      // session — clear `srcdoc` (precedence over `src`) and `sandbox` (opaque).
      iframe.removeAttribute('srcdoc')
      iframe.removeAttribute('sandbox')
      iframe.src = widgetUrl
      host.setCurrentIframeId(customIframeId)
    } else {
      host.setCurrentIframeId(iframeId)
      addPopup(widgetUrl)
    }

    host.addMessageListener()

    host.setTargetOrigin(window.location.origin)

    const iframe = host.iframeElement()

    if (iframe) {
      host.setBridgeParent(new BridgeParent(iframe))
      // Track this session's widget window so JIT requests are only honoured when
      // they come from it (event.source check in `handleJitRequest`).
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
      // Best-effort hard-failure signal: a cross-origin iframe rarely fires `error`
      // for a failed navigation (the ready-handshake timeout is the authoritative
      // Tier-1 signal), but when it does fire we cascade at once instead of waiting
      // the timeout out. Session-bound + removed on teardown so a late error from
      // an old (embedded) iframe can't cascade a later session.
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

  function isFromActiveWidget(event: MessageEvent): boolean {
    return (
      !!backupSession &&
      !!sessionNonce &&
      !!event.source &&
      event.source === backupIframeWindow &&
      (event.data as { [SESSION_NONCE_PARAM]?: unknown } | null)?.[
        SESSION_NONCE_PARAM
      ] === sessionNonce
    )
  }

  async function handleJitRequest(event: MessageEvent) {
    // Only ever sent by the backup widget, so it is gated on an active backup
    // session, the message coming from that widget's own window, AND this open's
    // session nonce — otherwise another same-origin frame, or a stale document in
    // a reused embedded iframe, could drive the client's backend calls.
    if (isFromActiveWidget(event)) {
      await runJitRequest(
        (event.data as { payload?: MeshBackupJitRequestPayload }).payload
      )
    }
  }

  function completeReadyHandshake(event: MessageEvent) {
    // Only the backup widget's OWN window may complete the ready handshake. The
    // host's message handler also admits host-origin messages (Tier 1), so without
    // this an unrelated same-origin frame posting `{ type: 'loaded' }` would call
    // `markReady()` and permanently cancel the Tier-1 → Tier-2 fallback. The nonce
    // check stops a stale `loaded` from a previous open in a reused embedded iframe
    // (same window, same origin) doing the same.
    if (isFromActiveWidget(event)) {
      // This `loaded` IS the ready handshake — cancel the pending tier timeout
      // (Tier-1 healthy, or Tier-2 mounted) before delivering the config.
      backupTierController?.markReady()
      host.sendMessageToIframe({
        type: BACKUP_CONFIG_MESSAGE_TYPE,
        payload: backupSession
      })
    }
  }

  return {
    reset,
    setPrimaryFlow: () => {
      activeFlow = 'primary'
    },
    getActiveFlow: () => activeFlow,
    isTier2: () => backupTier2,
    isFromActiveWidget,
    open,
    handleJitRequest,
    completeReadyHandshake
  }
}

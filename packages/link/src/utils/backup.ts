import { appendQueryParam } from './url'

/**
 * Default origin for the standalone backup deposit widget (OR-449): the production
 * Cloudflare Worker. It is under the `meshconnect.com` zone but served by
 * Cloudflare, not Azure, so it shares no failure domain with the primary Mesh API
 * (design doc §5C) — if the core API is down the widget still loads. Matches the
 * React Native SDK's default. Override per-call via `openLinkBackup`'s
 * `widgetOrigin` option for staging, demo, or self-host. Money path: this origin
 * serves the deposit-address UI during an outage.
 */
export const DEFAULT_BACKUP_WIDGET_ORIGIN = 'https://backup.meshconnect.com'

/**
 * The `type` the backup widget's message bridge requires on the config it
 * receives. The widget matches `event.data.type === 'meshBackupConfig'` and
 * drops any message without it, so the config must be delivered as
 * `{ type: BACKUP_CONFIG_MESSAGE_TYPE, payload: MeshBackupConfig }`.
 */
export const BACKUP_CONFIG_MESSAGE_TYPE = 'meshBackupConfig'

/**
 * JIT-over-bridge RPC message types (OR-452). An address-less destination is
 * resolved by the widget invoking the host's `onAddressInit`/`onStatusPoll`
 * callbacks over this same postMessage bridge, correlated by `callId` — the
 * widget never calls a client HTTP endpoint and holds no token.
 *
 * - Widget → host: `{ type: JIT_REQUEST_MESSAGE_TYPE, payload: MeshBackupJitRequestPayload }`
 * - Host → widget: `{ type: JIT_RESPONSE_MESSAGE_TYPE, payload: MeshBackupJitResponsePayload }`
 *
 * ⚠️ KEEP IN SYNC with `mesh-backup-widget`'s `src/bridge/contract.ts` — the
 * string values and payload shapes are the frozen cross-repo contract.
 */
export const JIT_REQUEST_MESSAGE_TYPE = 'meshBackupJitRequest'
export const JIT_RESPONSE_MESSAGE_TYPE = 'meshBackupJitResponse'

/**
 * How long to wait for the Tier-1 widget's ready handshake (its `loaded`
 * message) after the iframe starts loading the backup origin, before treating
 * the origin as unreachable and cascading to the bundled Tier-2 assets.
 *
 * On the web this is the **authoritative** Tier-1 failure signal: a cross-origin
 * iframe does not reliably fire a load `error` event for a network/DNS failure
 * (and `onload` fires even for an error page), so a served-but-broken, hung, or
 * captive-portal-intercepted origin is only caught by the absence of the ready
 * handshake. 5000 ms absorbs a slow mobile network with margin (the widget shell
 * is ~24 KB on a CDN) while keeping the degraded-path UX acceptable. Per-SDK
 * tunable constant (design §5H).
 */
export const TIER1_READY_TIMEOUT_MS = 5000

/**
 * Fail-closed safety net for Tier 2: the bundled assets load from a local `blob:`
 * URL, so they should complete the ready handshake near-instantly.
 * If they somehow do not within this window, the flow exits with an error rather
 * than sitting on a blank screen (design §5A/§5H — never a blank QR). Deliberately
 * generous because a Tier-2 timeout should be effectively unreachable.
 */
export const TIER2_READY_TIMEOUT_MS = 8000

export interface BackupWidgetUrlParams {
  /** SDK platform identifier (`'web'`). */
  platform: string
  /** SDK version, for widget-side diagnostics. */
  sdkVersion: string
  /**
   * Resolved colour theme. Appended as `?theme=dark|light` — the only theme
   * value the backup widget reads. Omit for `system`/unset so the widget falls
   * back to `prefers-color-scheme`.
   */
  theme?: 'dark' | 'light'
  /**
   * Per-open session nonce, appended as `?sid=`. The widget echoes it on every
   * message it posts to the host, so a reused embedded iframe's stale messages
   * from a previous open can be told apart (see `createSessionNonce`).
   */
  sessionNonce?: string
}

/** URL parameter carrying the per-open session nonce (query for Tier 1, fragment
 *  for the Tier-2 `blob:` URL). KEEP IN SYNC with `mesh-backup-widget`'s
 *  `src/bridge/sessionNonce.ts`. */
export const SESSION_NONCE_PARAM = 'sid'

/**
 * A fresh, unguessable nonce for one backup open (128 bits, hex). Navigating an
 * embedded iframe keeps its `WindowProxy` and Tier-1 sessions share an origin, so
 * `event.source` + origin alone can't tell the current open's messages from ones
 * the previous document queued before a reopen; the widget echoes this value as
 * `sid` on every message and the SDK drops any that don't match.
 */
export function createSessionNonce(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Builds the URL the backup-widget iframe loads. Unlike the primary path there
 * is no link token to decode — the widget is a static SPA at `origin` and is
 * hydrated with the `MeshBackupConfig` over the message bridge after load. Only
 * non-sensitive display hints are carried on the URL; the deposit config never
 * appears in it.
 *
 * A trailing slash on `origin` is normalised away so params attach cleanly.
 */
export function buildBackupWidgetUrl(
  origin: string,
  params: BackupWidgetUrlParams
): string {
  // Trim trailing slashes with an index walk, not `/\/+$/` — the anchored `+`
  // backtracks super-linearly (Sonar S8786) on a run of slashes before a non-slash.
  let sliceEnd = origin.length
  while (sliceEnd > 0 && origin[sliceEnd - 1] === '/') sliceEnd -= 1
  let url = origin.slice(0, sliceEnd)
  url = appendQueryParam(url, 'platform', params.platform)
  url = appendQueryParam(url, 'sdkVersion', params.sdkVersion)
  if (params.theme) {
    url = appendQueryParam(url, 'theme', params.theme)
  }
  if (params.sessionNonce) {
    url = appendQueryParam(url, SESSION_NONCE_PARAM, params.sessionNonce)
  }
  return url
}

import { appendQueryParam } from './url'

/**
 * Default origin for the standalone backup deposit widget (OR-449), served from
 * Mesh's independent backup infrastructure. It is deliberately **not** a
 * `meshconnect.com` origin: the backup flow must share no failure domain with
 * the primary Mesh API, so if `meshconnect.com` is down the widget still loads.
 * This is the single value swapped at origin-migration time; override per-call
 * via `openLinkBackup`'s `widgetOrigin` option for staging, demo, or self-host.
 *
 * ⚠️ PLACEHOLDER — must be replaced with the production, Mesh-owned backup origin
 * before this ships to clients. It deliberately uses the reserved `.invalid` TLD
 * (RFC 6761) so it can never resolve to a real — possibly attacker-controlled —
 * host if it reaches a release un-reconciled. Money path: this origin serves the
 * deposit-address UI during an outage. (As of 2026-09-29 the deployed widget is
 * a demo at `https://demo-widget.cascadecode.com` — pass it via `widgetOrigin`.)
 */
export const DEFAULT_BACKUP_WIDGET_ORIGIN = 'https://backup-widget.invalid'

/**
 * The `type` the backup widget's message bridge requires on the config it
 * receives. The widget matches `event.data.type === 'meshBackupConfig'` and
 * drops any message without it, so the config must be delivered as
 * `{ type: BACKUP_CONFIG_MESSAGE_TYPE, payload: MeshBackupConfig }`.
 */
export const BACKUP_CONFIG_MESSAGE_TYPE = 'meshBackupConfig'

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
  let url = origin.replace(/\/+$/, '')
  url = appendQueryParam(url, 'platform', params.platform)
  url = appendQueryParam(url, 'sdkVersion', params.sdkVersion)
  if (params.theme) {
    url = appendQueryParam(url, 'theme', params.theme)
  }
  return url
}

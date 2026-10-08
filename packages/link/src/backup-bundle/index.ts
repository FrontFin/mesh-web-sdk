import { OFFLINE_WIDGET_HTML } from './generated'

export { OFFLINE_WIDGET_HTML }
export { withWidgetTheme } from './theme'

/** The bundled Tier-2 asset: the self-contained offline widget HTML. */
export interface BundledOfflineWidget {
  /**
   * Self-contained widget HTML to load into a sandboxed opaque-origin `blob:`
   * iframe (not `srcdoc`). It carries its own runtime CSP meta. The catalog
   * snapshot + top-N logos are already inlined in it (design §5H), so the SDK
   * loads nothing else for Tier 2 and makes no Mesh-owned network call.
   */
  html: string
}

/**
 * Returns the Tier-2 bundle embedded in this SDK build. The web SDK imports this
 * module dynamically (see `Link.ts`), so the ~135 KB HTML string is code-split
 * into its own chunk and Tier-1-only consumers never load it up front. Used when
 * the Tier-1 backup origin is unreachable, so a deposit can render with zero
 * Mesh-owned network dependency (design §5H).
 */
export function getBundledOfflineWidget(): BundledOfflineWidget {
  return { html: OFFLINE_WIDGET_HTML }
}

/*
 * Pure validation helpers for the Tier-2 offline bundle, kept free of `import.meta`
 * (unlike embed-backup-bundle.js) so they can be unit-tested under jest/babel.
 */

/** Size of the shipped HTML in the UTF-8 bytes that actually go over the wire —
 *  NOT `String.length` (UTF-16 code units), which undercounts non-ASCII. */
export const htmlByteLength = html => Buffer.byteLength(html, 'utf8')

/**
 * Fail if the "offline" HTML references any absolute http(s) URL, so the bundled
 * Tier-2 asset truly makes no network calls. This is a WHOLE-FILE scan (not a set
 * of start-of-attribute regexes), so it catches every resource-loading mechanism:
 * `src`/`srcset` (any candidate, not just the first), `href`/`xlink:href`,
 * `<video poster>`, `<meta http-equiv=refresh content=...url=>`, CSS `url()` /
 * `@import`, and script-initiated fetches — anywhere in the document.
 *
 * Only the W3C XML/SVG namespace (`xmlns="http://www.w3.org/..."`) is allow-listed:
 * it is an identifier, not a network load. A self-contained build otherwise uses
 * only `data:` URIs and inline content. (Mirrors mesh-backup-widget's own
 * build-time `verify-selfcontained` guard.)
 *
 * DEFENSE IN DEPTH ONLY — this is a static text scan, so it catches literal URLs
 * but CANNOT catch a URL assembled at runtime (e.g. `fetch('https:' + '//x')`).
 * The authoritative no-network control is the bundled widget's own runtime
 * Content-Security-Policy (`default-src 'none'; connect-src 'none'; …`), emitted
 * by the mesh-backup-widget build, plus the opaque-origin `sandbox` the SDK mounts
 * it under. This scan exists to catch an accidentally non-self-contained re-vendor
 * early; it is not the security boundary. See the evasion case in the tests.
 */
export function assertSelfContained(html) {
  // Drop allow-listed W3C namespace URLs, then look for any remaining http(s) URL.
  const scanned = html.replace(/https?:\/\/www\.w3\.org\/[^\s"'<>)]*/gi, '')
  const match = scanned.match(/https?:\/\/[^\s"'<>)]+/i)
  if (match) {
    throw new Error(
      `widget.offline.html is not self-contained — found an external URL ` +
        `(${match[0].slice(0, 80)}…). A Tier-2 offline bundle must reference ` +
        'no network resources.'
    )
  }
}

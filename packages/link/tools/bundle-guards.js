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

/**
 * The AUTHORITATIVE no-network control (what `assertSelfContained` can't give —
 * see its note): require the vendored offline page to carry a CSP `<meta>` with
 * `default-src 'none'` AND `connect-src 'none'`. The mesh-backup-widget offline
 * build (`inlineSingleFile`, OR-452) bakes this in; this guard fails CI if a
 * re-vendor ever drops it, so the Tier-2 bundle the SDK loads into its sandboxed
 * blob iframe can never make a network call (fetch/XHR/WebSocket/beacon) at
 * runtime — even one whose URL is constructed dynamically.
 */
export function assertRuntimeCsp(html) {
  // The attribute delimiter is captured (\1 / \2) and the value runs to the
  // matching delimiter — the CSP value itself contains single quotes (`'none'`),
  // so a `[^"']` class would truncate it at the first directive.
  const meta = html.match(
    /<meta\s+http-equiv=(["'])Content-Security-Policy\1\s+content=(["'])([\s\S]*?)\2/i
  )
  if (!meta) {
    throw new Error(
      'widget.offline.html is missing its runtime CSP <meta>. The Tier-2 offline ' +
        "bundle must declare `default-src 'none'; connect-src 'none'` so it makes " +
        'no network calls. Re-vendor from a mesh-backup-widget build that injects ' +
        'it (OR-452).'
    )
  }
  // Parse the directives — a substring match is not enough: CSP ignores 'none'
  // when combined with another source (`connect-src 'none' https:` allows https),
  // and a browser uses the FIRST of a duplicated directive (`connect-src https:;
  // connect-src 'none'` allows https). Require EXACTLY ONE of each, whose only
  // source is 'none'.
  const directives = new Map()
  for (const part of meta[3].split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) continue
    const name = tokens[0].toLowerCase()
    if (!directives.has(name)) directives.set(name, [])
    directives.get(name).push(tokens.slice(1))
  }
  const problems = []
  for (const name of ['default-src', 'connect-src']) {
    const occurrences = directives.get(name)
    if (!occurrences) {
      problems.push(`missing ${name} 'none'`)
    } else if (occurrences.length > 1) {
      problems.push(`${name} appears more than once (only the first applies)`)
    } else if (occurrences[0].length !== 1 || occurrences[0][0] !== "'none'") {
      problems.push(
        `${name} must be exactly 'none' (found: ${name} ${
          occurrences[0].join(' ') || '<empty>'
        })`
      )
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `widget.offline.html CSP <meta> does not enforce no-network: ` +
        `${problems.join('; ')}. The Tier-2 bundle must make no network calls.`
    )
  }
}

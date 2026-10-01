/*
 * Pure validation helpers for the Tier-2 offline bundle, kept free of `import.meta`
 * (unlike embed-backup-bundle.js) so they can be unit-tested under jest/babel.
 */

/** Size of the shipped HTML in the UTF-8 bytes that actually go over the wire —
 *  NOT `String.length` (UTF-16 code units), which undercounts non-ASCII. */
export const htmlByteLength = html => Buffer.byteLength(html, 'utf8')

/**
 * Fail if the "offline" HTML references an external resource/navigation, so the
 * bundled Tier-2 asset truly makes no network calls. Catches absolute `http(s)://`
 * anywhere in the document AND protocol-relative `//host` in a resource/navigation
 * context — the latter matters because a `<meta http-equiv=refresh content=...>`
 * or a protocol-relative `src`/`href` can navigate the sandboxed iframe, and the
 * CSP's `default-src`/`connect-src` do NOT govern document navigation. The W3C
 * XML/SVG namespace (`xmlns="http://www.w3.org/..."`) is allow-listed (an
 * identifier, not a load).
 *
 * The protocol-relative scan runs on the markup with `<script>` blocks stripped,
 * because `//` is pervasive in minified JS; a runtime-constructed URL there is not
 * caught either way.
 *
 * DEFENSE IN DEPTH ONLY — a static text scan cannot catch a URL assembled at
 * runtime (e.g. `fetch('https:' + '//x')`). The authoritative no-network control
 * is the bundled widget's runtime CSP (`default-src 'none'; connect-src 'none';
 * …`, asserted by `assertRuntimeCsp`) plus the opaque-origin `sandbox` the SDK
 * mounts it under. This scan catches an accidentally non-self-contained re-vendor
 * early; it is not the security boundary. (Mirrors mesh-backup-widget's own
 * build-time `verify-selfcontained` guard.)
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
  // Protocol-relative `//host` navigation/resource. Scan markup only (scripts
  // stripped) so minified-JS `//` doesn't false-match. The value must START with
  // `//` (after the `=`/quote/`url(`) — this is base-64-safe, since a `data:` URI
  // whose payload happens to contain `//` starts with `data:`, not `//`. Plus a
  // `<meta http-equiv=refresh>` whose target is protocol-relative or external
  // (navigation isn't governed by `connect-src`/`default-src`).
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  const protoRel =
    markup.match(
      /(?:\b(?:src|href|srcset|poster|action|formaction)\s*=\s*["']?|url\(\s*["']?)\/\/[a-z0-9.-]/i
    ) ||
    markup.match(
      /http-equiv\s*=\s*["']refresh["'][^>]*\burl=\s*(?:\/\/|https?:)/i
    )
  if (protoRel) {
    throw new Error(
      `widget.offline.html is not self-contained — found a protocol-relative or ` +
        `refresh-navigation URL (…${protoRel[0].slice(
          -60
        )}). A Tier-2 offline ` +
        'bundle must reference no network resources.'
    )
  }
}

// The complete no-network policy the Tier-2 offline page must declare. Validating
// only default-src/connect-src is not enough: a MORE-SPECIFIC fetch directive
// overrides default-src (e.g. `img-src https:` permits remote images), and
// `base-uri`/`form-action` don't fall back to default-src at all. So every
// directive is pinned and any unlisted one is rejected.
const isNone = srcs => srcs.length === 1 && srcs[0] === "'none'"
const isHashesOnly = srcs =>
  srcs.length > 0 && srcs.every(s => /^'sha(256|384|512)-/i.test(s))
const CSP_DIRECTIVE_RULES = {
  'default-src': [isNone, "'none'"],
  'script-src': [isHashesOnly, 'sha256 hashes only'],
  'style-src': [isHashesOnly, 'sha256 hashes only'],
  'img-src': [srcs => srcs.length === 1 && srcs[0] === 'data:', 'data: only'],
  'connect-src': [isNone, "'none'"],
  'base-uri': [isNone, "'none'"],
  'form-action': [isNone, "'none'"]
}

/**
 * The AUTHORITATIVE no-network control (what `assertSelfContained` can't give):
 * require the vendored offline page to carry a CSP `<meta>` whose COMPLETE policy
 * matches `CSP_DIRECTIVE_RULES` — every required directive present with exactly its
 * expected source, no duplicates, no `'unsafe-inline'`, and no extra (possibly
 * network-capable) directive. The mesh-backup-widget offline build bakes this in
 * (`inlineSingleFile`, OR-452); this guard fails CI if a re-vendor weakens it, so
 * the Tier-2 bundle the SDK loads into its sandboxed blob iframe can never make a
 * network call at runtime — even one whose URL is constructed dynamically.
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
  const csp = meta[3]
  const directives = new Map()
  const problems = []
  for (const part of csp.split(';')) {
    const tokens = part.trim().split(/\s+/).filter(Boolean)
    if (tokens.length === 0) continue
    const name = tokens[0].toLowerCase()
    if (directives.has(name)) {
      problems.push(`${name} appears more than once (only the first applies)`)
      continue
    }
    directives.set(name, tokens.slice(1))
  }
  if (/'unsafe-inline'/i.test(csp)) {
    problems.push(
      "uses 'unsafe-inline' (inline code must be allowed by sha256 hash)"
    )
  }
  for (const [name, [ok, descr]] of Object.entries(CSP_DIRECTIVE_RULES)) {
    const srcs = directives.get(name)
    if (!srcs) problems.push(`missing ${name} (${descr})`)
    else if (!ok(srcs))
      problems.push(
        `${name} must be ${descr} (found: ${name} ${
          srcs.join(' ') || '<empty>'
        })`
      )
  }
  for (const name of directives.keys()) {
    if (!(name in CSP_DIRECTIVE_RULES))
      problems.push(
        `unexpected directive '${name}' — not in the no-network allowlist`
      )
  }
  if (problems.length > 0) {
    throw new Error(
      `widget.offline.html CSP <meta> does not enforce no-network: ` +
        `${problems.join('; ')}. The Tier-2 bundle must make no network calls.`
    )
  }
}

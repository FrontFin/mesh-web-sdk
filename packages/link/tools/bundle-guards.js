/*
 * Pure validation helpers for the Tier-2 offline bundle, kept free of `import.meta`
 * (unlike embed-backup-bundle.js) so they can be unit-tested under jest/babel.
 */

/** Size of the shipped HTML in the UTF-8 bytes that actually go over the wire —
 *  NOT `String.length` (UTF-16 code units), which undercounts non-ASCII. */
import { createHash } from 'node:crypto'

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
 * runtime (e.g. `fetch('https:' + '//x')`), and it is not the security boundary.
 * The runtime CSP (`default-src 'none'; connect-src 'none'; …`, asserted by
 * `assertRuntimeCsp`) blocks fetch/XHR/WebSocket/beacon, and the opaque-origin
 * `sandbox` isolates the frame — but neither stops script-driven document
 * NAVIGATION (`location.href = …`): CSP fetch directives don't govern navigation,
 * and `sandbox="allow-scripts"` lets a frame navigate ITSELF (only TOP navigation,
 * which we do not grant, is blocked). A navigated frame keeps the same WindowProxy
 * and `null` origin, so it would still pass the Tier-2 `event.source`/origin gate.
 * The actual boundary against that is that the bundle is BUILT FROM TRUSTED SOURCE
 * (this + `verify-selfcontained` prove it ships no external/obfuscated URL), so it
 * contains no such navigation; an attacker who could inject `location.href = evil`
 * into the vendored bundle has already compromised the widget build. A stronger
 * platform-level control (a MessagePort handshake that does not survive navigation,
 * or load-event re-navigation detection) is possible future hardening but needs
 * real-browser validation. (Mirrors mesh-backup-widget's `verify-selfcontained`.)
 */
// Decode the URL-structural HTML entities a browser would resolve in an attribute
// value (`:` and `/`, named + numeric), so an entity-obfuscated external URL
// (`https&colon;&sol;&sol;evil`) can't slip past the text scans. Only these two
// characters matter for spotting a scheme/authority; a full entity decoder is not
// needed. NOT applied inside <script> (JS string literals are not HTML-decoded).
function decodeUrlEntities(s) {
  return s
    .replace(/&colon;/gi, ':')
    .replace(/&sol;/gi, '/')
    .replace(/&#x0*3a;/gi, ':')
    .replace(/&#0*58;/g, ':')
    .replace(/&#x0*2f;/gi, '/')
    .replace(/&#0*47;/g, '/')
}

export function assertSelfContained(html) {
  // Drop allow-listed W3C namespace URLs, then look for any remaining http(s) URL.
  // The exemption is context-free on purpose: the Preact runtime carries the
  // `http://www.w3.org/2000/svg` / `.../1999/xhtml` namespace strings as
  // createElementNS constants in the minified JS (not loads), so they appear
  // outside attributes too. Only the w3.org host is exempted — any other host is
  // still caught — and w3.org is not an exfiltration target.
  const scanned = html.replace(/https?:\/\/www\.w3\.org\/[^\s"'<>)]*/gi, '')
  const match = scanned.match(/https?:\/\/[^\s"'<>)]+/i)
  if (match) {
    throw new Error(
      `widget.offline.html is not self-contained — found an external URL ` +
        `(${match[0].slice(0, 80)}…). A Tier-2 offline bundle must reference ` +
        'no network resources.'
    )
  }
  // Navigation/resource vectors live in MARKUP — the browser decodes HTML entities
  // in attribute values, and a `//host`/`refresh`/entity-obfuscated URL navigates
  // the sandboxed iframe, which `connect-src`/`default-src` do NOT govern. Strip
  // <script> (minified `//` and un-decoded JS entities aren't attributes) and
  // decode the URL-structural entities the browser would.
  const markup = decodeUrlEntities(
    html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  )
  // The CSP is the only legitimate http-equiv. Reject any other — e.g. a refresh
  // meta that could navigate the sandboxed iframe off-document. An attribute NAME is
  // never entity-decoded, so matching literal `http-equiv` is robust; its VALUE can
  // be obfuscated (`ref&#x72;esh`), so anything that isn't literally
  // content-security-policy is rejected. (CSP presence/validity is `assertRuntimeCsp`'s
  // job, so a doc with no http-equiv is fine here.) Scan the WHOLE `html` (not the
  // script-stripped markup): a hashed/allowed inline script could embed a refresh
  // meta as a string and inject it at runtime, so a refresh literal inside executable
  // code must be caught too. (The bundle's JS contains no `http-equiv` literal.)
  const badHttpEquiv = [
    ...html.matchAll(/http-equiv\s*=\s*["']?\s*([^"'\s>]+)/gi)
  ]
    .map(m => m[1].toLowerCase())
    .filter(v => v !== 'content-security-policy')
  if (badHttpEquiv.length > 0) {
    throw new Error(
      `widget.offline.html is not self-contained — unexpected <meta http-equiv> ` +
        `(${badHttpEquiv.join(', ')}); a refresh redirect could navigate the ` +
        'sandboxed iframe off-document.'
    )
  }
  // An absolute (incl. entity-decoded) or protocol-relative URL in a resource/nav
  // attribute or CSS url(). The value must START with the scheme/`//` (after the
  // `=`/quote/`url(`) — base-64-safe, since a `data:` URI whose payload contains
  // `//` starts with `data:`.
  const navUrl = markup.match(
    /(?:\b(?:src|href|srcset|poster|action|formaction)\s*=\s*["']?|url\(\s*["']?)(?:https?:)?\/\/[a-z0-9.-]/i
  )
  if (navUrl) {
    throw new Error(
      `widget.offline.html is not self-contained — found a protocol-relative or ` +
        `obfuscated external URL (…${navUrl[0].slice(
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
  // A meta-delivered CSP only governs content that FOLLOWS it in document order,
  // and only when it sits in <head>. If anything that can execute script or start
  // a load precedes it, that content runs UN-policed: a re-vendored bundle could
  // slip a pre-meta <script> (e.g. a runtime-constructed `fetch(...)`) in front of
  // the policy and still pass every directive check below. So require the meta to
  // be inside <head>, ahead of any script/style/resource element. (charset/viewport
  // <meta> and <title> are fine before it — they neither execute nor load.)
  const before = html.slice(0, meta.index)
  const headOpened = /<head[\s>]/i.test(before)
  const headClosedOrBodyStarted =
    /<\/head>/i.test(before) || /<body[\s>]/i.test(before)
  if (!headOpened || headClosedOrBodyStarted) {
    throw new Error(
      'widget.offline.html CSP <meta> is not inside <head>. A CSP delivered ' +
        'outside the document head (or after </head>/<body>) does not reliably ' +
        'govern the page. Re-vendor from a mesh-backup-widget build that injects ' +
        'it as the first head content (OR-452).'
    )
  }
  const preMetaLoader = before.match(
    /<(script|style|link|img|iframe|frame|object|embed|source|track|audio|video|base|applet)\b/i
  )
  if (preMetaLoader) {
    throw new Error(
      `widget.offline.html has <${preMetaLoader[1].toLowerCase()}> before its ` +
        'runtime CSP <meta>. A meta CSP governs only the content that follows it, ' +
        'so anything executable or resource-bearing ahead of it runs un-policed ' +
        'and could make a network call. The CSP <meta> must be the first head ' +
        'content, before any script/style/resource element.'
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
  // The hash sources must also MATCH the inline code: a re-vendor whose bytes
  // changed after its CSP was computed passes every check above, yet the browser
  // blocks the stale-hashed script/style and Tier 2 times out on every open.
  for (const [tag, directive, pattern] of [
    ['script', 'script-src', /<script\b([^>]*)>([\s\S]*?)<\/script>/gi],
    ['style', 'style-src', /<style\b([^>]*)>([\s\S]*?)<\/style>/gi]
  ]) {
    const declared = new Set(directives.get(directive) ?? [])
    for (const m of html.matchAll(pattern)) {
      if (/\bsrc\s*=/i.test(m[1])) continue // external — not hash-governed
      const hash = `'sha256-${createHash('sha256')
        .update(m[2], 'utf8')
        .digest('base64')}'`
      if (!declared.has(hash)) {
        problems.push(
          `inline <${tag}> hash ${hash} is not in ${directive} (stale CSP — the ` +
            'browser would block it)'
        )
      }
    }
  }
  if (problems.length > 0) {
    throw new Error(
      `widget.offline.html CSP <meta> does not enforce no-network: ` +
        `${problems.join('; ')}. The Tier-2 bundle must make no network calls.`
    )
  }
}

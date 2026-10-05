import {
  assertSelfContained,
  assertRuntimeCsp,
  htmlByteLength
} from './bundle-guards.js'

describe('assertSelfContained', () => {
  const ok =
    '<!doctype html><html><head>' +
    '<svg xmlns="http://www.w3.org/2000/svg"><use xlink:href="#a"/></svg>' +
    '<style>.a{background:url(data:image/png;base64,AAAA)}</style>' +
    '<img src="data:image/gif;base64,BBBB" srcset="data:image/gif;base64,CCCC 2x">' +
    '</head><body><script>const x="//not-a-url in a string"</script></body></html>'

  test('accepts a self-contained document (data: URIs, w3.org namespace)', () => {
    expect(() => assertSelfContained(ok)).not.toThrow()
  })

  test.each([
    [
      'external script src',
      '<script src="https://evil.example/x.js"></script>'
    ],
    [
      'external link href',
      '<link href="https://cdn.example/a.css" rel="stylesheet">'
    ],
    [
      'srcset second candidate',
      '<img srcset="data:image/gif;base64,A 1x, https://cdn.example/x.png 2x">'
    ],
    ['video poster', '<video poster="https://cdn.example/p.jpg"></video>'],
    [
      'meta refresh',
      '<meta http-equiv="refresh" content="0;url=https://evil.example/">'
    ],
    [
      'CSS url()',
      '<style>.a{background:url(https://cdn.example/bg.png)}</style>'
    ],
    ['CSS @import', '<style>@import "https://cdn.example/a.css";</style>']
  ])('rejects %s', (_name, snippet) => {
    expect(() => assertSelfContained(`<!doctype html>${snippet}`)).toThrow(
      /not self-contained/
    )
  })

  // Documents the KNOWN limitation (not a bug): a static text scan cannot catch a
  // URL constructed at runtime, so this evades `assertSelfContained`. The real
  // no-network control is the bundled widget's runtime CSP + opaque-origin sandbox,
  // NOT this scan. If this ever starts throwing, the scan has been upgraded and the
  // comment in bundle-guards.js should be revisited.
  test('does NOT catch a runtime-constructed URL (defense-in-depth only)', () => {
    const evasion =
      '<!doctype html><script>fetch("https:" + "//evil.example/x")</script>'
    expect(() => assertSelfContained(evasion)).not.toThrow()
  })

  test.each([
    ['protocol-relative src', '<img src="//cdn.example/x.png">'],
    [
      'protocol-relative css url()',
      '<style>.a{background:url(//cdn.example/b)}</style>'
    ],
    [
      'meta refresh to a protocol-relative URL',
      '<meta http-equiv="refresh" content="0;url=//evil.example/">'
    ],
    // Any meta refresh is rejected, even without a parseable target.
    ['bare meta refresh', '<meta http-equiv="refresh" content="5">'],
    // Entity-obfuscated refresh target (the browser decodes &colon; / &sol;).
    [
      'entity-encoded meta refresh',
      '<meta http-equiv="refresh" content="0;url=https&colon;&sol;&sol;evil.example/">'
    ],
    // Entity-obfuscated src (numeric entities for : and /).
    [
      'entity-encoded src',
      '<img src="https&#x3a;&#x2f;&#x2f;evil.example/x.png">'
    ]
  ])('catches %s', (_name, snippet) => {
    expect(() => assertSelfContained(`<!doctype html>${snippet}`)).toThrow(
      /not self-contained/
    )
  })

  test('does NOT false-match a data: URI whose base64 contains //', () => {
    // base64 alphabet includes '/', so a payload can contain '//' — but the value
    // starts with `data:`, not `//`, so it must not trip the protocol-relative scan.
    const html = '<!doctype html><img src="data:image/png;base64,AA//BBcc//dd">'
    expect(() => assertSelfContained(html)).not.toThrow()
  })
})

describe('assertRuntimeCsp', () => {
  const metaFor = csp =>
    `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}" /></head><body></body></html>`
  // A complete, valid no-network policy (what the widget build emits).
  const goodCsp =
    "default-src 'none'; script-src 'sha256-abc'; style-src 'sha256-def'; " +
    "img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'"

  test('accepts the complete hash-based no-network policy', () => {
    expect(() => assertRuntimeCsp(metaFor(goodCsp))).not.toThrow()
  })

  test('rejects a page with no CSP meta', () => {
    const html = '<!doctype html><html><head></head><body></body></html>'
    expect(() => assertRuntimeCsp(html)).toThrow(/missing its runtime CSP/)
  })

  test('rejects a <script> before the CSP meta (pre-meta code runs un-policed)', () => {
    // A runtime-constructed fetch here executes before the meta CSP applies, yet
    // the policy itself is valid — the position guard must catch it.
    const html =
      `<!doctype html><html><head><script>fetch('https:'+'//evil')</script>` +
      `<meta http-equiv="Content-Security-Policy" content="${goodCsp}" /></head><body></body></html>`
    expect(() => assertRuntimeCsp(html)).toThrow(
      /<script> before its runtime CSP/
    )
  })

  test('rejects a resource element before the CSP meta', () => {
    const html =
      `<!doctype html><html><head><link rel="stylesheet" href="x.css" />` +
      `<meta http-equiv="Content-Security-Policy" content="${goodCsp}" /></head><body></body></html>`
    expect(() => assertRuntimeCsp(html)).toThrow(
      /<link> before its runtime CSP/
    )
  })

  test('rejects a CSP meta placed outside <head>', () => {
    const html =
      `<!doctype html><html><head></head><body>` +
      `<meta http-equiv="Content-Security-Policy" content="${goodCsp}" /></body></html>`
    expect(() => assertRuntimeCsp(html)).toThrow(/not inside <head>/)
  })

  test('accepts charset/title before the CSP meta (neither executes nor loads)', () => {
    const html =
      `<!doctype html><html><head><meta charset="utf-8" /><title>x</title>` +
      `<meta http-equiv="Content-Security-Policy" content="${goodCsp}" /></head><body></body></html>`
    expect(() => assertRuntimeCsp(html)).not.toThrow()
  })

  const drop = name =>
    goodCsp
      .split('; ')
      .filter(d => !d.startsWith(name + ' '))
      .join('; ')
  const swap = (name, value) =>
    goodCsp
      .split('; ')
      .map(d => (d.startsWith(name + ' ') ? `${name} ${value}` : d))
      .join('; ')

  test.each([
    ['missing default-src', drop('default-src')],
    ['missing img-src', drop('img-src')],
    ["uses 'unsafe-inline'", swap('script-src', "'unsafe-inline'")],
    ["connect-src not 'none'", swap('connect-src', 'https://evil.example')],
    // CSP ignores 'none' when combined with another source.
    [
      "connect-src 'none' combined with a host",
      swap('connect-src', "'none' https:")
    ],
    // A more-specific fetch directive overrides default-src 'none'.
    ['img-src allows https', swap('img-src', 'https:')],
    ['script-src allows a host, not just hashes', swap('script-src', 'https:')],
    // base-uri/form-action do NOT fall back to default-src.
    ['form-action allows a host', swap('form-action', 'https:')],
    // An unlisted, network-capable directive.
    ['extra font-src host', `${goodCsp}; font-src https:`],
    // A browser uses the FIRST of a duplicated directive.
    ['duplicated connect-src', `${goodCsp}; connect-src https:`]
  ])('rejects a CSP: %s', (_name, csp) => {
    expect(() => assertRuntimeCsp(metaFor(csp))).toThrow(
      /does not enforce no-network/
    )
  })
})

describe('htmlByteLength', () => {
  test('counts UTF-8 bytes, not UTF-16 code units', () => {
    // '€' is 1 UTF-16 unit but 3 UTF-8 bytes.
    expect('€'.length).toBe(1)
    expect(htmlByteLength('€')).toBe(3)
  })
})

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
})

describe('assertRuntimeCsp', () => {
  const metaFor = csp =>
    `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${csp}" /></head><body></body></html>`
  const goodCsp =
    "default-src 'none'; script-src 'unsafe-inline'; connect-src 'none'; base-uri 'none'"

  test('accepts a page whose CSP has default-src and connect-src none', () => {
    expect(() => assertRuntimeCsp(metaFor(goodCsp))).not.toThrow()
  })

  test('rejects a page with no CSP meta', () => {
    const html = '<!doctype html><html><head></head><body></body></html>'
    expect(() => assertRuntimeCsp(html)).toThrow(/missing its runtime CSP/)
  })

  test.each([
    ['missing default-src', "script-src 'unsafe-inline'; connect-src 'none'"],
    ['missing connect-src', "default-src 'none'; script-src 'unsafe-inline'"],
    [
      "connect-src not 'none'",
      "default-src 'none'; connect-src https://evil.example"
    ],
    // CSP ignores 'none' when combined with another source.
    [
      "connect-src 'none' combined with a host",
      "default-src 'none'; connect-src 'none' https:"
    ],
    // A browser uses the FIRST of a duplicated directive, so the trailing 'none'
    // is dead — the effective policy allows https:.
    [
      'duplicated connect-src (first allows https)',
      "default-src 'none'; connect-src https:; connect-src 'none'"
    ]
  ])('rejects a CSP %s', (_name, csp) => {
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

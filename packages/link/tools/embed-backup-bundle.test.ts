import { assertSelfContained, htmlByteLength } from './bundle-guards.js'

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

describe('htmlByteLength', () => {
  test('counts UTF-8 bytes, not UTF-16 code units', () => {
    // '€' is 1 UTF-16 unit but 3 UTF-8 bytes.
    expect('€'.length).toBe(1)
    expect(htmlByteLength('€')).toBe(3)
  })
})

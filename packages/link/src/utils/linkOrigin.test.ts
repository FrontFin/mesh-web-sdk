import { getTrustedLinkOrigin } from './linkOrigin'

describe('getTrustedLinkOrigin', () => {
  test.each([
    ['https://web.meshconnect.com/b/abc', 'https://web.meshconnect.com'],
    [
      'https://sandbox-web.meshconnect.com/b/abc',
      'https://sandbox-web.meshconnect.com'
    ],
    [
      'https://preview3.dev-web.meshconnect.com/b',
      'https://preview3.dev-web.meshconnect.com'
    ],
    ['https://link.meshconnect.com', 'https://link.meshconnect.com'],
    ['https://meshconnect.com/b', 'https://meshconnect.com'],
    ['https://pay.meshpay.com/b', 'https://pay.meshpay.com'],
    ['https://meshpay.com/b', 'https://meshpay.com'],
    ['http://localhost/1', 'http://localhost'],
    ['http://localhost:3000/1', 'http://localhost:3000'],
    ['https://localhost:3000/1', 'https://localhost:3000'],
    ['http://127.0.0.1:8080/1', 'http://127.0.0.1:8080'],
    ['http://localhost:3000/b/1?x=1#y', 'http://localhost:3000'],
    ['http://[::1]:3000/b/1', 'http://[::1]:3000'],
    ['https://[::1]/b/1', 'https://[::1]']
  ])('accepts %s', (url, origin) => {
    expect(getTrustedLinkOrigin(url)).toBe(origin)
  })

  // Query params and hashes never change the trusted origin.
  test.each(
    [
      '/b/1?auth_code=abc',
      '/b/1?a=1&b=2',
      '/b/1#frag',
      '/b/1?auth_code=abc#frag',
      '?x=1',
      '#x',
      '/b/1?',
      '/b/1#'
    ].map(suffix => `https://web.meshconnect.com${suffix}`)
  )('accepts %s with the Mesh origin', url => {
    expect(getTrustedLinkOrigin(url)).toBe('https://web.meshconnect.com')
  })

  test.each([
    'http://web.meshconnect.com/b/abc',
    'http://meshpay.com/b',
    'https://evil.com/b',
    'https://evilmeshconnect.com/b',
    'https://web.meshconnect.com.evil.com/b',
    'https://web.meshconnect.com@evil.com/b',
    'https://meshconnect.co/b',
    'javascript:alert(document.domain)//',
    'data:text/html,hi',
    'ftp://web.meshconnect.com/b',
    'not a url',
    '',
    // A Mesh host only in the path, query or hash is not the origin.
    'https://evil.com/?next=https://web.meshconnect.com',
    'https://evil.com/#https://web.meshconnect.com',
    'https://evil.com?web.meshconnect.com',
    'https://evil.com#.meshconnect.com',
    'https://evil.com/web.meshconnect.com',
    'https://evil.com?@web.meshconnect.com',
    'http://web.meshconnect.com/b/1?secure=https',
    'https://evil.com/b?x=1#https://localhost',
    // Non-http(s) schemes on a loopback host: only the scheme gate rejects these
    // (`mesh-evil:` would otherwise yield the opaque origin 'null').
    'ftp://localhost/b',
    'ws://localhost:3000/b',
    'ftp://127.0.0.1/b',
    'mesh-evil://localhost/b'
  ])('rejects %s', url => {
    expect(getTrustedLinkOrigin(url)).toBeUndefined()
  })

  test('allowedLinkOrigins matches a pinned origin regardless of query/hash', () => {
    const allowed = ['https://link.example.com']
    expect(
      getTrustedLinkOrigin('https://link.example.com/b?x=1#y', allowed)
    ).toBe('https://link.example.com')
    expect(
      getTrustedLinkOrigin(
        'https://evil.com/?https://link.example.com',
        allowed
      )
    ).toBeUndefined()
  })

  test('accepts an origin pinned via allowedLinkOrigins', () => {
    expect(
      getTrustedLinkOrigin('https://link.example.com/b/abc', [
        'https://link.example.com/'
      ])
    ).toBe('https://link.example.com')
  })

  test('allowedLinkOrigins matches the exact origin only', () => {
    const allowed = ['https://link.example.com']
    expect(
      getTrustedLinkOrigin('https://other.link.example.com/b', allowed)
    ).toBeUndefined()
    expect(
      getTrustedLinkOrigin('https://link.example.com:8443/b', allowed)
    ).toBeUndefined()
    expect(
      getTrustedLinkOrigin('http://link.example.com/b', allowed)
    ).toBeUndefined()
  })

  test('ignores non-https allowedLinkOrigins entries', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(
      getTrustedLinkOrigin('https://link.example.com/b', [
        'http://link.example.com',
        'not a url'
      ])
    ).toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })
})

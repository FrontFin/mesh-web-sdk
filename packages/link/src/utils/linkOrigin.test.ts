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
    ['http://127.0.0.1:8080/1', 'http://127.0.0.1:8080']
  ])('accepts %s', (url, origin) => {
    expect(getTrustedLinkOrigin(url)).toBe(origin)
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
    ''
  ])('rejects %s', url => {
    expect(getTrustedLinkOrigin(url)).toBeUndefined()
  })

  test.each([
    [
      'https://web.meshconnect.com/b/1?auth_code=abc',
      'https://web.meshconnect.com'
    ],
    ['https://web.meshconnect.com/b/1?a=1&b=2', 'https://web.meshconnect.com'],
    ['https://web.meshconnect.com/b/1#frag', 'https://web.meshconnect.com'],
    [
      'https://web.meshconnect.com/b/1?auth_code=abc#frag',
      'https://web.meshconnect.com'
    ],
    ['https://web.meshconnect.com?x=1', 'https://web.meshconnect.com'],
    ['https://web.meshconnect.com#x', 'https://web.meshconnect.com'],
    ['https://web.meshconnect.com/b/1?', 'https://web.meshconnect.com'],
    ['https://web.meshconnect.com/b/1#', 'https://web.meshconnect.com'],
    ['http://localhost:3000/b/1?x=1#y', 'http://localhost:3000']
  ])('accepts %s with query/hash and returns its origin', (url, origin) => {
    expect(getTrustedLinkOrigin(url)).toBe(origin)
  })

  test.each([
    'https://evil.com/?next=https://web.meshconnect.com',
    'https://evil.com/#https://web.meshconnect.com',
    'https://evil.com?web.meshconnect.com',
    'https://evil.com#.meshconnect.com',
    'https://evil.com/web.meshconnect.com',
    'https://evil.com?@web.meshconnect.com',
    'http://web.meshconnect.com/b/1?secure=https',
    'https://evil.com/b?x=1#https://localhost'
  ])('rejects %s (Mesh host only in path/query/hash)', url => {
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

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
    expect(getTrustedLinkOrigin('http://link.example.com/b', allowed)).toBe(
      undefined
    )
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

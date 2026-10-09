import { MESH_LINK_ORIGINS, resolveLinkTokenUrl } from './linkOrigins'

const tokenFor = (url: string) => Buffer.from(url).toString('base64')

describe('MESH_LINK_ORIGINS', () => {
  test('contains only bare https origins', () => {
    for (const origin of MESH_LINK_ORIGINS) {
      expect(new URL(origin).origin).toBe(origin)
      expect(origin.startsWith('https://')).toBe(true)
    }
  })

  test('includes all 40 preview slots', () => {
    const previews = MESH_LINK_ORIGINS.filter(o => o.includes('://preview'))
    expect(previews).toHaveLength(40)
    expect(previews).toContain('https://preview1.web.meshconnect.com')
    expect(previews).toContain(
      'https://preview10.dev-sandbox-web.meshconnect.com'
    )
  })
})

describe('resolveLinkTokenUrl', () => {
  test('returns the decoded URL and its origin for an allowlisted origin', () => {
    const url =
      'https://web.meshconnect.com/b2b-iframe/abc/broker-connect?auth_code=x'
    expect(resolveLinkTokenUrl(tokenFor(url))).toEqual({
      href: url,
      origin: 'https://web.meshconnect.com'
    })
  })

  test.each([
    'http://web.meshconnect.com/',
    'https://web.meshconnect.com:8443/',
    'https://evil.example/',
    'https://web.meshconnect.com.evil.io/',
    'javascript:alert(1)//',
    'not a url'
  ])('rejects %s', url => {
    expect(resolveLinkTokenUrl(tokenFor(url))).toBeUndefined()
  })

  test('rejects a token that is not valid base64', () => {
    expect(resolveLinkTokenUrl('%%%')).toBeUndefined()
  })

  describe('trustedLinkOrigins', () => {
    test.each([
      ['http://localhost:3001', 'http://localhost:3001/b2b-iframe/x'],
      ['http://127.0.0.1:4000/', 'http://127.0.0.1:4000/'],
      ['https://link.example.com', 'https://link.example.com/?token=t']
    ])('accepts a token for the pinned origin %s', (pinned, url) => {
      expect(resolveLinkTokenUrl(tokenFor(url), [pinned])?.href).toBe(url)
    })

    test.each([
      ['plain http on a non-loopback host', 'http://link.example.com'],
      ['an entry with a path', 'https://link.example.com/b2b-iframe'],
      ['a wildcard', 'https://*.example.com'],
      ['a malformed entry', 'link.example.com']
    ])('ignores %s', (_, pinned) => {
      const url = `${pinned.replace('*.', 'a.').replace(/\/b2b-iframe$/, '')}/x`
      expect(resolveLinkTokenUrl(tokenFor(url), [pinned])).toBeUndefined()
    })

    test('does not trust a different port on a pinned host', () => {
      expect(
        resolveLinkTokenUrl(tokenFor('http://localhost:9999/'), [
          'http://localhost:3001'
        ])
      ).toBeUndefined()
    })
  })
})

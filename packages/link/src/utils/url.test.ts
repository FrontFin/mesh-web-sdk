import { appendQueryParam, setQueryParam } from './url'

const BASE_URL = 'https://meshconnect.com/broker-connect/'
const BASE_URL_WITH_AUTH = `${BASE_URL}?auth_code=abc123`

describe('appendQueryParam', () => {
  test('appends with ? when url has no existing query string', () => {
    expect(appendQueryParam(BASE_URL, 'lng', 'en')).toBe(`${BASE_URL}?lng=en`)
  })

  test('appends with & when url already has a query string', () => {
    expect(appendQueryParam(BASE_URL_WITH_AUTH, 'lng', 'en')).toBe(
      `${BASE_URL_WITH_AUTH}&lng=en`
    )
  })

  test('appends multiple params correctly in sequence', () => {
    let url = BASE_URL_WITH_AUTH
    url = appendQueryParam(url, 'lng', 'en')
    url = appendQueryParam(url, 'fiatCur', 'USD')
    url = appendQueryParam(url, 'th', 'dark')
    url = appendQueryParam(url, 'rt', 'embedded')
    expect(url).toBe(
      `${BASE_URL_WITH_AUTH}&lng=en&fiatCur=USD&th=dark&rt=embedded`
    )
  })
})

describe('setQueryParam', () => {
  test('adds the param with ? when url has no query string', () => {
    expect(setQueryParam(BASE_URL, 'th', 'light')).toBe(`${BASE_URL}?th=light`)
  })

  test('adds the param with & when the key is not present', () => {
    expect(setQueryParam(BASE_URL_WITH_AUTH, 'th', 'light')).toBe(
      `${BASE_URL_WITH_AUTH}&th=light`
    )
  })

  test.each([
    [`${BASE_URL}?th=dark&a=1`, `${BASE_URL}?a=1&th=light`],
    [`${BASE_URL}?a=1&th=dark&b=2`, `${BASE_URL}?a=1&b=2&th=light`],
    [`${BASE_URL}?a=1&th=dark`, `${BASE_URL}?a=1&th=light`],
    [`${BASE_URL}?th=dark`, `${BASE_URL}?th=light`]
  ])('replaces the existing key in %s', (url, expected) => {
    expect(setQueryParam(url, 'th', 'light')).toBe(expected)
  })

  test('removes every occurrence of the key, including valueless ones', () => {
    expect(
      setQueryParam(`${BASE_URL}?th=dark&a=1&th=system&th&th=`, 'th', 'light')
    ).toBe(`${BASE_URL}?a=1&th=light`)
  })

  test('does not touch keys that only share a prefix or suffix', () => {
    const url = `${BASE_URL}?theme=dark&thx=1&mth=2&a=th=3`
    expect(setQueryParam(url, 'th', 'light')).toBe(`${url}&th=light`)
  })

  test('keeps the exact encoding of the other params', () => {
    const url =
      `${BASE_URL}?token=ab%2Bc%2F%3D&flow=%7B%22flow%22%3A%22enter-amount%22%7D` +
      '&th=dark&integrationId=i%20d'
    expect(setQueryParam(url, 'th', 'light')).toBe(
      `${BASE_URL}?token=ab%2Bc%2F%3D&flow=%7B%22flow%22%3A%22enter-amount%22%7D` +
        '&integrationId=i%20d&th=light'
    )
  })

  test('puts the param before a #fragment and keeps the fragment', () => {
    expect(setQueryParam(`${BASE_URL}?th=dark&a=1#frag`, 'th', 'light')).toBe(
      `${BASE_URL}?a=1&th=light#frag`
    )
    expect(setQueryParam(`${BASE_URL}#frag?th=dark`, 'th', 'light')).toBe(
      `${BASE_URL}?th=light#frag?th=dark`
    )
  })

  test('handles an empty query string and stray separators', () => {
    expect(setQueryParam(`${BASE_URL}?`, 'th', 'light')).toBe(
      `${BASE_URL}?th=light`
    )
    expect(setQueryParam(`${BASE_URL}?&a=1&&th=dark&`, 'th', 'light')).toBe(
      `${BASE_URL}?a=1&th=light`
    )
  })
})

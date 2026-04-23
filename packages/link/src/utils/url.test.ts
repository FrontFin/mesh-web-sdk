import { appendQueryParam } from './url'

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
    expect(url).toBe(`${BASE_URL_WITH_AUTH}&lng=en&fiatCur=USD&th=dark&rt=embedded`)
  })
})

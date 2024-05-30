import { getLinkStyle, getNumber } from './style'

describe('Test style utils', () => {
  test('verify function returns a style object', () => {
    const link = 'https://some.domain?link_style=eyJpciI6IDI0LCAiaW8iOiAwLjF9'
    const received = getLinkStyle(link)
    expect(received).toEqual({ ir: 24, io: 0.1 })
  })

  test('verify function returns nothing on missing query param', () => {
    const link = 'https://some.domain?other=12'
    const received = getLinkStyle(link)
    expect(received).toBeNull()
  })

  test('verify function returns nothing on wrong encoded value', () => {
    const link = 'https://some.domain?link_style=eyJpciI6IDI0LCAiaW8iOiAwL'
    const received = getLinkStyle(link)
    expect(received).toBeUndefined()
  })

  test('verify function returns nothing on empty link', () => {
    const link = ''
    const received = getLinkStyle(link)
    expect(received).toBeUndefined()
  })

  test('verify function returns correct number', () => {
    expect(getNumber(10, 11)).toBe(11)
    expect(getNumber(10, undefined)).toBe(10)
    expect(getNumber(1, 0)).toBe(0)
  })
})

import { withWidgetTheme } from './theme'

describe('withWidgetTheme', () => {
  const HTML =
    '<!doctype html><html lang="en"><head></head><body></body></html>'

  test.each([['dark'], ['light']] as const)(
    'stamps data-theme="%s" on the root tag and changes nothing else',
    theme => {
      const out = withWidgetTheme(HTML, theme)
      expect(out).toContain(`<html data-theme="${theme}" lang="en">`)
      expect(out.replace(` data-theme="${theme}"`, '')).toBe(HTML)
    }
  )

  test('returns the HTML unchanged for system/unset', () => {
    expect(withWidgetTheme(HTML, undefined)).toBe(HTML)
  })

  test('leaves HTML without a root tag unchanged (not <head>/<htmlx>)', () => {
    expect(withWidgetTheme('<htmlx><head>', 'dark')).toBe('<htmlx><head>')
  })
})

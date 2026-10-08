/**
 * The Tier-2 widget HTML with an explicit host theme applied. Tier 2 loads from a
 * `blob:` URL, which can't carry Tier 1's `?theme=`, so without this an explicit
 * `theme: 'dark' | 'light'` was ignored and the widget followed the OS
 * (`prefers-color-scheme`). The widget's CSS honours `:root[data-theme]`, and an
 * attribute on `<html>` is outside every CSP hash. `undefined` (theme `system` or
 * unset) returns the HTML unchanged, as does HTML without a root tag.
 */
export function withWidgetTheme(
  html: string,
  theme: 'dark' | 'light' | undefined
): string {
  if (!theme) return html
  return html.replace(/<html(?=[\s>])/i, `<html data-theme="${theme}"`)
}

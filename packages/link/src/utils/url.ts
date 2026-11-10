export function appendQueryParam(url: string, key: string, value: string) {
  // Params go before any `#fragment`; appended after it they would end up in the
  // hash, where the page's query string never sees them.
  const hashIndex = url.indexOf('#')
  const base = hashIndex === -1 ? url : url.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex)
  return `${base}${base.includes('?') ? '&' : '?'}${key}=${value}${hash}`
}

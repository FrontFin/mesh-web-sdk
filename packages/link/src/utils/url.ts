export function appendQueryParam(url: string, key: string, value: string) {
  return `${url}${url.includes('?') ? '&' : '?'}${key}=${value}`
}

/**
 * Sets `key` to `value`, replacing every existing `key` in the query string.
 *
 * Link reads a param with `URLSearchParams.get`, which returns the first value, so
 * appending a key that the token already carries (e.g. the legacy shim's `th`)
 * has no effect. This edits the raw string rather than round-tripping through
 * `URL`/`URLSearchParams`, so every other param (the session token, the `flow`
 * JSON) keeps its exact encoding. A `#fragment` is preserved and the new param
 * goes before it.
 */
export function setQueryParam(url: string, key: string, value: string) {
  const hashIndex = url.indexOf('#')
  const beforeHash = hashIndex === -1 ? url : url.slice(0, hashIndex)
  const hash = hashIndex === -1 ? '' : url.slice(hashIndex)

  const queryIndex = beforeHash.indexOf('?')
  const base = queryIndex === -1 ? beforeHash : beforeHash.slice(0, queryIndex)
  const query = queryIndex === -1 ? '' : beforeHash.slice(queryIndex + 1)

  const params = query
    .split('&')
    .filter(
      param => param !== '' && param !== key && !param.startsWith(`${key}=`)
    )
  params.push(`${key}=${value}`)

  return `${base}?${params.join('&')}${hash}`
}

/**
 * Origins a link token may decode to (PRG-1086 / SR-8). The decoded token URL
 * becomes the SDK's cross-window trust anchor — the iframe `src`, the
 * `postMessage` target that receives `accessTokens`, the origin whose events are
 * honoured and the camera/microphone delegate — so it must be a Mesh-hosted Link
 * origin, never whatever a (possibly forged) token names. Exact origin match only:
 * no wildcards, so a lookalike such as `web.meshconnect.com.evil.io` or an
 * unclaimed subdomain can never pass.
 */

// front-web-platform preview slots: preview<N>.<host>, N = 1..10.
const PREVIEW_SLOT_COUNT = 10
const PREVIEW_HOSTS = [
  'web.meshconnect.com',
  'dev-web.meshconnect.com',
  'sandbox-web.meshconnect.com',
  'dev-sandbox-web.meshconnect.com'
]

const previewOrigins: string[] = []
for (const host of PREVIEW_HOSTS) {
  for (let slot = 1; slot <= PREVIEW_SLOT_COUNT; slot++) {
    previewOrigins.push(`https://preview${slot}.${host}`)
  }
}

export const MESH_LINK_ORIGINS: readonly string[] = [
  // Production
  'https://web.meshconnect.com',
  'https://link.meshconnect.com',
  'https://link.meshpay.com',
  'https://link2.meshconnect.com',
  // Sandbox
  'https://sandbox-web.meshconnect.com',
  'https://sandbox-link.meshconnect.com',
  'https://link.sbx.meshpay.com',
  // Dev / staging
  'https://dev-web.meshconnect.com',
  'https://dev-sandbox-web.meshconnect.com',
  'https://dev-link.meshconnect.com',
  'https://dev-link2.meshconnect.com',
  'https://link.dev.meshpay.com',
  'https://staging-web.meshconnect.com',
  'https://staging-link.meshconnect.com',
  // Preview
  ...previewOrigins
]

const LOOPBACK_HOSTNAMES = ['localhost', '127.0.0.1', '[::1]']

/**
 * Normalises an integrator-pinned `trustedLinkOrigins` entry to its origin, or
 * returns `undefined` if it isn't one: https only, except plain-http loopback for
 * local development. An entry carrying a path, query or fragment is rejected
 * rather than silently truncated, so a mistyped value fails loudly in testing.
 */
function toTrustedOrigin(value: string): string | undefined {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return undefined
  }
  const isHttps = url.protocol === 'https:'
  const isLoopbackHttp =
    url.protocol === 'http:' && LOOPBACK_HOSTNAMES.includes(url.hostname)
  if (!isHttps && !isLoopbackHttp) {
    return undefined
  }
  if (value.replace(/\/$/, '') !== url.origin) {
    return undefined
  }
  return url.origin
}

export type ResolvedLinkUrl = {
  href: string
  origin: string
}

/**
 * Decodes a link token and returns its URL and origin only if that origin is an
 * allowed Link origin — a built-in {@link MESH_LINK_ORIGINS} entry, or one the integrator
 * pinned via `trustedLinkOrigins`. Returns `undefined` for anything else: invalid
 * base64, an unparseable URL, a non-https scheme, or an origin off the list.
 */
export function resolveLinkTokenUrl(
  linkToken: string,
  trustedLinkOrigins: readonly string[] = []
): ResolvedLinkUrl | undefined {
  let decoded: string
  let url: URL
  try {
    decoded = window.atob(linkToken)
    url = new URL(decoded)
  } catch {
    return undefined
  }

  // `origin` carries the scheme, so an exact match also rules out http:// for
  // every built-in entry.
  const isAllowed =
    MESH_LINK_ORIGINS.includes(url.origin) ||
    trustedLinkOrigins.map(toTrustedOrigin).includes(url.origin)
  return isAllowed ? { href: decoded, origin: url.origin } : undefined
}

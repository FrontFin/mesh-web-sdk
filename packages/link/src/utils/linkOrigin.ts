/**
 * Domains that serve Mesh-hosted Link. A link token must decode to an `https:` URL
 * on one of these domains (or a subdomain of one) to be trusted.
 */
const TRUSTED_LINK_DOMAINS = ['meshconnect.com', 'meshpay.com']

/** Local development hosts, trusted over `http:` or `https:` on any port. */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1'])

const isTrustedDomain = (hostname: string) =>
  TRUSTED_LINK_DOMAINS.some(
    domain => hostname === domain || hostname.endsWith(`.${domain}`)
  )

const normalizeExtraOrigins = (allowedLinkOrigins?: string[]): string[] => {
  const origins: string[] = []
  for (const value of allowedLinkOrigins ?? []) {
    try {
      const parsed = new URL(value)
      if (parsed.protocol !== 'https:') {
        throw new Error('not https')
      }
      origins.push(parsed.origin)
    } catch {
      console.warn(
        `Mesh SDK: Ignored allowedLinkOrigins entry "${value}" - must be an https origin`
      )
    }
  }
  return origins
}

/**
 * Returns the origin of the URL decoded from a link token if it is trusted, or
 * `undefined` if it must be rejected. This origin becomes the SDK's cross-window
 * trust anchor (iframe src, postMessage target, camera/microphone delegation), so
 * only Mesh-hosted Link origins, local development hosts, and origins the
 * integrator pinned via `allowedLinkOrigins` are accepted.
 */
export function getTrustedLinkOrigin(
  url: string,
  allowedLinkOrigins?: string[]
): string | undefined {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return undefined
  }

  const { protocol, hostname, origin } = parsed

  if (protocol !== 'https:' && protocol !== 'http:') {
    return undefined
  }

  if (LOCAL_HOSTS.has(hostname)) {
    return origin
  }

  if (protocol !== 'https:') {
    return undefined
  }

  if (isTrustedDomain(hostname)) {
    return origin
  }

  if (normalizeExtraOrigins(allowedLinkOrigins).includes(origin)) {
    return origin
  }

  return undefined
}

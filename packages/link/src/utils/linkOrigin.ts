/**
 * Domains that serve Mesh-hosted Link. A link token must decode to an `https:` URL
 * on one of these domains (or a subdomain of one) to be trusted.
 */
const TRUSTED_LINK_DOMAINS = ['meshconnect.com', 'meshpay.com']

/**
 * Loopback hosts, trusted over `http:` or `https:` on any port so local Mesh
 * development works without extra config. Deliberate trade-off: this ships in the
 * production bundle, so any process listening on the user's loopback could be
 * handed `frontAccessTokens` by a token pointing at it — but serving there already
 * implies code running on that machine, and no remote origin is admitted.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

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
 * Internal, undocumented `createLink` option — deliberately not part of the
 * public `LinkOptions` type. Extra `https` origins (matched exactly) that
 * `openLink` trusts, for a self-hosted Link UI.
 */
export type InternalLinkOptions = {
  allowedLinkOrigins?: string[]
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

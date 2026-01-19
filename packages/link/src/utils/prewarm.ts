const prewarmContainerId = 'mesh-link-prewarm-container'
const prewarmIframeId = 'mesh-link-prewarm-iframe'

/**
 * Creates a hidden iframe for pre-warming the catalog.
 * The iframe loads in the background and will be reused when openLink is called.
 */
export function createPrewarmIframe(): void {
  // Check if prewarm container already exists
  if (document.getElementById(prewarmContainerId)) {
    return
  }

  const url = 'https://web.meshconnect.com/prewarm'

  // Create hidden container
  const container = document.createElement('div')
  container.id = prewarmContainerId
  container.style.cssText =
    'display: none; position: fixed; top: 0; left: 0; width: 0; height: 0; pointer-events: none; visibility: hidden;'

  // Create iframe and immediately load the catalog to pre-load assets
  const iframe = document.createElement('iframe')
  iframe.id = prewarmIframeId
  iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
  iframe.loading = 'eager'
  // Load the base catalog URL to pre-load JS, CSS, and other static assets
  iframe.src = url

  container.appendChild(iframe)
  document.body.appendChild(container)
}

export function removePrewarmIframe(): void {
  const container = document.getElementById(prewarmContainerId)
  if (container) {
    container.remove()
  }
}

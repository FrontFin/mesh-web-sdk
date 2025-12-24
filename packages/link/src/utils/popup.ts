import { LinkStyle } from './types'
import { getLinkStyle, getNumber } from './style'

const popupId = 'mesh-link-popup'
const backdropId = 'mesh-link-popup__backdrop'
const popupContentId = 'mesh-link-popup__popup-content'
const stylesId = 'mesh-link-popup__styles'
export const iframeId = 'mesh-link-popup__iframe'
const prewarmContainerId = 'mesh-link-prewarm-container'
const prewarmIframeId = 'mesh-link-prewarm-iframe'

const getStylesContent = (style?: LinkStyle) => `
  body {
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    overflow: hidden;
  }

  #${popupId} {
    all: unset;
    position: fixed;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  #${backdropId} {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    z-index: 10000;
    background: black;
    opacity: ${getNumber(0.6, style?.io)};
  }

  #${popupContentId} {
    position: absolute;
    height: 80%;
    max-height: 710px;
    min-height: 685px;
    margin: auto;
    z-index: 10001;
    width: 30%;
    max-width: 430px;
    min-width: 380px;
    display: flex;
    flex-direction: column;
    border-radius: ${getNumber(24, style?.ir)}px;
    flex-grow: 1;
  }

  #${popupContentId} iframe {
    border: none;
    width: 100%;
    flex-grow: 1;
    border-radius: ${getNumber(24, style?.ir)}px;
  }

  @media only screen and (max-width: 768px) {
    #${popupContentId} {
      height: 100vh;
      width: 100vw;
      max-width: 100%;
      min-width: 100%;
      max-height: 100%;
      min-height: 100%;
      border-radius: 0px;
    }

    #${popupContentId} iframe {
      border-radius: 0px;
    }
  }

  @media only screen and (max-height: 710px) {
    #${popupContentId} {
      max-height: 100%;
      min-height: 100%;
    }
  }
`

export function removePopup(): void {
  const existingPopup = window.document.getElementById(popupId)
  existingPopup?.parentElement?.removeChild(existingPopup)

  const existingStyles = window.document.getElementById(stylesId)
  existingStyles?.parentElement?.removeChild(existingStyles)
}

export function addPopup(iframeLink: string): void {
  removePopup()

  const styleElement = document.createElement('style')
  styleElement.id = stylesId
  const style = getLinkStyle(iframeLink)
  styleElement.textContent = getStylesContent(style)
  window.document.head.appendChild(styleElement)

  const popupRootElement = document.createElement('div')
  popupRootElement.id = popupId
  const popupBackdropElement = document.createElement('div')
  popupBackdropElement.id = backdropId
  popupRootElement.appendChild(popupBackdropElement)
  const popupContentElement = document.createElement('div')
  popupContentElement.id = popupContentId
  const iframeElement = document.createElement('iframe')
  iframeElement.id = iframeId
  iframeElement.src = iframeLink
  iframeElement.allow = 'clipboard-read *; clipboard-write *'
  popupContentElement.appendChild(iframeElement)
  popupRootElement.appendChild(popupContentElement)
  window.document.body.appendChild(popupRootElement)
}

/**
 * Creates a hidden iframe for pre-warming the catalog.
 * The iframe loads in the background and will be reused when openLink is called.
 * @param prewarmUrl - Optional custom URL for pre-warming (defaults to production catalog)
 */
export function createPrewarmIframe(prewarmUrl?: string): void {
  // Check if prewarm container already exists
  if (document.getElementById(prewarmContainerId)) {
    return
  }

  const url =
    prewarmUrl || 'https://link.meshconnect.com/broker-connect?prewarm=1'

  // Create hidden container
  const container = document.createElement('div')
  container.id = prewarmContainerId
  container.style.cssText =
    'display: none; position: fixed; top: 0; left: 0; width: 0; height: 0; pointer-events: none; visibility: hidden;'

  // Create iframe and immediately load the catalog to pre-load assets
  const iframe = document.createElement('iframe')
  iframe.id = prewarmIframeId
  iframe.allow = 'clipboard-read *; clipboard-write *'
  iframe.style.cssText = 'width: 100%; height: 100%; border: none;'
  // Load the base catalog URL to pre-load JS, CSS, and other static assets
  iframe.src = url

  container.appendChild(iframe)
  document.body.appendChild(container)
}

/**
 * Removes the pre-warmed iframe and its container from the DOM
 */
export function removePrewarmIframe(): void {
  const container = document.getElementById(prewarmContainerId)
  if (container) {
    container.remove()
  }
}

/**
 * Checks if a pre-warmed iframe exists and is ready to use
 * @returns The prewarm iframe ID if it exists, undefined otherwise
 */
export function getPrewarmIframeId(): string | undefined {
  const iframe = document.getElementById(prewarmIframeId)
  return iframe ? prewarmIframeId : undefined
}

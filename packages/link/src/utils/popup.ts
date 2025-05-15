import { LinkStyle } from './types'
import { getLinkStyle, getNumber } from './style'

const popupId = 'mesh-link-popup'
const backdropId = 'mesh-link-popup__backdrop'
const popupContentId = 'mesh-link-popup__popup-content'
const stylesId = 'mesh-link-popup__styles'
export const iframeId = 'mesh-link-popup__iframe'

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

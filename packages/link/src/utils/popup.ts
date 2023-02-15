import {
  AccessTokenPayload,
  DelayedAuthPayload,
  EventType,
  FrontOptions,
  FrontPayload
} from './types'

const popupId = 'front-link-popup'
const backdropId = 'front-link-popup__backdrop'
const popupContentId = 'front-link-popup__popup-content'
const stylesId = 'front-link-popup__styles'
const closeButtonId = 'front-link-popup__close'
const getPopupHtml = (link: string) => `
<div id="${popupId}">
  <div id="${backdropId}"></div>
  <div id="${popupContentId}">
    <h3>
      <span>Front connection</span>
      <button type="button" id="${closeButtonId}">&#10006;</button>
    </h3>
    <iframe src="${link}" />
  </div>
</div>
`

const styles = `
<style id="${stylesId}">
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
  }

  #${backdropId} {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    z-index: 10000;
    background: black;
    opacity: 0.3;
  }

  #${popupContentId} {
    position: absolute;
    top: 10%;
    bottom: 10%;
    left: 0;
    right: 0;
    margin-left: auto;
    margin-right: auto;
    z-index: 10001;
    max-width: 400px;
    display: flex;
    flex-direction: column;

    background: white;
    padding: 10px;
  }

  #${popupContentId} iframe {
    border: none;
    width: 100%;
    flex-grow: 1;
  }

  #${popupContentId} h3 {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    margin: 0 0 10px 0;
    height: 30px;
    box-sizing: border-box;
  }

  #${popupContentId} h3 span {
    flex-grow: 1;
  }

  #${popupContentId} h3 #${closeButtonId} {
    border: none;
    background: white;
    cursor: pointer;
  }
</style>
`

let currentOptions: FrontOptions | undefined

function onClose() {
  removePopup()
  currentOptions?.onExit?.()
}

function eventsListener(
  event: MessageEvent<{
    type: EventType
    payload?: AccessTokenPayload | DelayedAuthPayload
    message?: string
    link?: string
  }>
) {
  switch (event.data.type) {
    case 'brokerageAccountAccessToken': {
      const payload: FrontPayload = {
        accessToken: event.data.payload as AccessTokenPayload
      }
      currentOptions?.onBrokerConnected?.(payload)
      removePopup()
      break
    }
    case 'delayedAuthentication': {
      const payload: FrontPayload = {
        delayedAuth: event.data.payload as DelayedAuthPayload
      }
      currentOptions?.onBrokerConnected?.(payload)
      removePopup()
      break
    }
    case 'close':
    case 'done': {
      currentOptions?.onExit?.(event.data.message)
      removePopup()
      break
    }
    case 'oauthLinkOpen': {
      if (event.data.link) {
        window
          .open(
            event.data.link,
            '_blank',
            'popup,noopener,noreferrer,resizable,scrollbars'
          )
          ?.focus()
      }

      break
    }
  }
}

export function removePopup(): void {
  const existingPopup = window.document.getElementById(popupId)
  if (existingPopup) {
    ;(existingPopup.parentElement || window.document.body).removeChild(
      existingPopup
    )
  }

  const existingStyles = window.document.getElementById(stylesId)
  if (existingStyles) {
    ;(existingStyles.parentElement || window.document.head).removeChild(
      existingStyles
    )
  }

  window.removeEventListener('message', eventsListener)
}

export function addPopup(iframeLink: string, options: FrontOptions): void {
  removePopup()
  currentOptions = options
  const popup = getPopupHtml(iframeLink)
  window.document.head.appendChild(htmlToElement(styles))
  window.document.body.appendChild(htmlToElement(popup))

  const closeButton = window.document.getElementById(closeButtonId)
  if (closeButton) {
    closeButton.onclick = onClose
  }

  window.parent.addEventListener('message', eventsListener)
}

function htmlToElement(html: string): Node {
  const template = document.createElement('template')
  html = html.trim()
  template.innerHTML = html
  return template.content.firstChild || document.createTextNode('')
}

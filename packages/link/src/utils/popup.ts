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
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
  }

  #${backdropId} {
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    right: 0;
    z-index: 10000;
    background: black;
    opacity: 0.6;
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
    border-radius: 24px;
    background: white;
    flex-grow: 1;
  }

  #${popupContentId} iframe {
    border: none;
    width: 100%;
    flex-grow: 1;
    border-radius: 24px;
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
      break
    }
    case 'delayedAuthentication': {
      const payload: FrontPayload = {
        delayedAuth: event.data.payload as DelayedAuthPayload
      }
      currentOptions?.onBrokerConnected?.(payload)
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
        const w = 700
        const h = 800
        const left = screen.width / 2 - w / 2
        const top = screen.height / 2 - h / 2
        window
          .open(
            event.data.link,
            '_blank',
            `popup,noopener,noreferrer,resizable,scrollbars,width=${w},height=${h},top=${top},left=${left}`
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

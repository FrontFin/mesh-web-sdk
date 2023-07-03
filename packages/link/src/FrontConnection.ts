import {
  FrontOptions,
  FrontConnection,
  EventType,
  AccessTokenPayload,
  DelayedAuthPayload,
  TransferFinishedPayload,
  FrontPayload
} from './utils/types'
import { addPopup, iframeId, removePopup } from './utils/popup'

let currentOptions: FrontOptions | undefined
let iframeUrlObject: URL | undefined

function eventsListener(
  event: MessageEvent<{
    type: EventType
    payload?: AccessTokenPayload | DelayedAuthPayload | TransferFinishedPayload
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
    case 'transferFinished': {
      const payload = event.data.payload as TransferFinishedPayload

      currentOptions?.onTransferFinished?.(payload)
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
    case 'loaded': {
      if (currentOptions?.accessTokens) {
        const iframeElement = document.getElementById(
          iframeId
        ) as HTMLIFrameElement

        iframeElement.contentWindow?.postMessage(
          { type: 'frontAccessTokens', payload: currentOptions.accessTokens },
          iframeUrlObject?.origin || 'https://web.getfront.com'
        )
      }
    }
  }
}

export const createFrontConnection = (
  options: FrontOptions
): FrontConnection => {
  const openPopup = async (iframeUrl: string) => {
    if (!iframeUrl) {
      options?.onExit?.('Invalid link!')
      return
    }

    currentOptions = options
    iframeUrlObject = new URL(iframeUrl)

    window.removeEventListener('message', eventsListener)
    addPopup(iframeUrl)
    window.addEventListener('message', eventsListener)
  }

  return {
    openPopup: openPopup,
    closePopup: () => {
      removePopup()
      window.removeEventListener('message', eventsListener)
      options.onExit?.()
    }
  }
}

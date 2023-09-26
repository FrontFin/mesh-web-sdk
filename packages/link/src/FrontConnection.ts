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
import { FrontEventType, isFrontEventTypeKey } from './utils/event-types'

let currentOptions: FrontOptions | undefined
let iframeUrlObject: URL | undefined

const iframeElement = () => {
  return document.getElementById(iframeId) as HTMLIFrameElement
}

function eventsListener(
  event:
    | MessageEvent<{
        type: EventType
        payload?:
          | AccessTokenPayload
          | DelayedAuthPayload
          | TransferFinishedPayload
        message?: string
        link?: string
      }>
    | MessageEvent<FrontEventType>
) {
  switch (event.data.type) {
    case 'brokerageAccountAccessToken': {
      const payload: FrontPayload = {
        accessToken: event.data.payload as AccessTokenPayload
      }
      currentOptions?.onEvent?.({
        type: 'integrationConnected',
        payload: payload
      })
      currentOptions?.onBrokerConnected?.(payload)
      break
    }
    case 'delayedAuthentication': {
      const payload: FrontPayload = {
        delayedAuth: event.data.payload as DelayedAuthPayload
      }
      currentOptions?.onEvent?.({
        type: 'integrationConnected',
        payload: payload
      })
      currentOptions?.onBrokerConnected?.(payload)
      break
    }
    case 'transferFinished': {
      const payload = event.data.payload as TransferFinishedPayload

      currentOptions?.onEvent?.({
        type: 'transferCompleted',
        payload: payload
      })
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
        iframeElement().contentWindow?.postMessage(
          { type: 'frontAccessTokens', payload: currentOptions.accessTokens },
          iframeUrlObject?.origin || 'https://web.getfront.com'
        )
      }
      if (currentOptions?.transferDestinationTokens) {
        iframeElement().contentWindow?.postMessage(
          {
            type: 'frontTransferDestinationTokens',
            payload: currentOptions.transferDestinationTokens
          },
          iframeUrlObject?.origin || 'https://web.getfront.com'
        )
      }

      currentOptions?.onEvent?.({ type: 'pageLoaded' })
      break
    }
    default: {
      if (isFrontEventTypeKey(event.data.type)) {
        currentOptions?.onEvent?.(event.data)
      }
      break
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

  const openLink = async (linkToken: string) => {
    if (!linkToken) {
      options?.onExit?.('Invalid link token!')
      return
    }

    currentOptions = options
    const linkUrl = window.atob(linkToken)
    iframeUrlObject = new URL(linkUrl)

    window.removeEventListener('message', eventsListener)
    addPopup(linkUrl)
    window.addEventListener('message', eventsListener)
  }

  const closeLink = () => {
    removePopup()
    window.removeEventListener('message', eventsListener)
    options.onExit?.()
  }

  return {
    openPopup: openPopup,
    openLink: openLink,
    closePopup: closeLink,
    closeLink: closeLink
  }
}

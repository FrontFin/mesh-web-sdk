import {
  LinkOptions,
  Link,
  EventType,
  AccessTokenPayload,
  DelayedAuthPayload,
  TransferFinishedPayload,
  LinkPayload
} from './utils/types'
import { addPopup, iframeId, removePopup } from './utils/popup'
import { LinkEventType, isLinkEventTypeKey } from './utils/event-types'
import { sdkSpecs } from './utils/sdk-specs'
import { appendQueryParam } from './utils/url'
import { BridgeParent } from '@meshconnect/uwc-bridge-parent'
import { createPrewarmIframe, removePrewarmIframe } from './utils/prewarm'

let currentOptions: LinkOptions | undefined
let targetOrigin: string | undefined
let linkTokenOrigin: string | undefined
let currentIframeId = iframeId
let bridgeParent: BridgeParent | null = null

const iframeElement = () => {
  return document.getElementById(currentIframeId) as HTMLIFrameElement
}

function sendMessageToIframe<T extends { type: string }>(message: T) {
  const iframe = iframeElement()
  if (!iframe) {
    console.warn(
      `Mesh SDK: Failed to deliver ${message.type} message to the iframe - no iframe element found`
    )
    return
  }
  if (!linkTokenOrigin) {
    console.warn(
      `Mesh SDK: Failed to deliver ${message.type} message to the iframe - no link token origin found`
    )
    return
  }
  try {
    iframe.contentWindow?.postMessage(message, linkTokenOrigin)
  } catch (e) {
    console.error(
      `Mesh SDK: Failed to deliver ${message.type} message to the iframe`
    )
    console.error(e)
  }
}

type MessageLinkEvent = {
  type: EventType
  payload?: AccessTokenPayload | DelayedAuthPayload | TransferFinishedPayload
  link?: string
}

async function handleLinkEvent(
  event: MessageEvent<MessageLinkEvent> | MessageEvent<LinkEventType>
) {
  switch (event.data.type) {
    case 'brokerageAccountAccessToken': {
      const payload: LinkPayload = {
        accessToken: event.data.payload as AccessTokenPayload
      }
      currentOptions?.onEvent?.({
        type: 'integrationConnected',
        payload: payload
      })
      currentOptions?.onIntegrationConnected?.(payload)
      break
    }
    case 'delayedAuthentication': {
      const payload: LinkPayload = {
        delayedAuth: event.data.payload as DelayedAuthPayload
      }
      currentOptions?.onEvent?.({
        type: 'integrationConnected',
        payload: payload
      })
      currentOptions?.onIntegrationConnected?.(payload)
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
      const payload = event.data?.payload
      currentOptions?.onExit?.(payload?.errorMessage, payload)
      bridgeParent?.destroy()
      removePopup()
      break
    }
    case 'loaded': {
      sendMessageToIframe({
        type: 'meshSDKSpecs',
        payload: { ...sdkSpecs }
      })

      if (currentOptions?.accessTokens) {
        sendMessageToIframe({
          type: 'frontAccessTokens',
          payload: currentOptions.accessTokens
        })
      }

      currentOptions?.onEvent?.({ type: 'pageLoaded' })
      break
    }
    default: {
      if (isLinkEventTypeKey(event.data.type)) {
        currentOptions?.onEvent?.(event.data)
      }
      break
    }
  }
}

async function eventsListener(
  event: MessageEvent<LinkEventType | { type: EventType }>
) {
  if (event.origin !== targetOrigin && event.origin !== linkTokenOrigin) {
    console.warn('Received message from untrusted origin:', event.origin)
  } else {
    await handleLinkEvent(event as MessageEvent<{ type: EventType }>)
  }
}

export const createLink = (options: LinkOptions): Link => {
  const openLink = (linkToken: string, customIframeId?: string) => {
    removePrewarmIframe()

    if (!linkToken) {
      options?.onExit?.('Invalid link token!')
      return
    }

    if (options?.renderType === 'embedded' && !customIframeId) {
      const msg =
        'Mesh SDK: Failed to open link - renderType "embedded" requires a customIframeId'
      console.error(msg)
      options?.onExit?.(msg)
      return
    }

    currentOptions = options
    let linkUrl = window.atob(linkToken)
    const isProtocolValid =
      linkUrl.startsWith('http://') || linkUrl.startsWith('https://')
    if (!isProtocolValid) {
      options?.onExit?.('Invalid link token!')
      return
    }

    linkUrl = addLanguage(linkUrl, currentOptions?.language)
    linkUrl = addDisplayFiatCurrency(
      linkUrl,
      currentOptions?.displayFiatCurrency
    )
    linkUrl = addTheme(linkUrl, currentOptions?.theme)
    linkUrl = addRenderType(linkUrl, currentOptions?.renderType)
    linkTokenOrigin = new URL(linkUrl).origin
    window.removeEventListener('message', eventsListener)
    if (customIframeId) {
      const iframe = document.getElementById(
        customIframeId
      ) as HTMLIFrameElement
      if (iframe) {
        iframe.allow = `clipboard-read *; clipboard-write *; camera ${linkTokenOrigin}`
        iframe.src = linkUrl
        currentIframeId = customIframeId
      } else {
        console.warn(`Mesh SDK: No iframe found with id ${customIframeId}`)
      }
    } else {
      currentIframeId = iframeId
      addPopup(linkUrl)
    }

    window.addEventListener('message', eventsListener)

    targetOrigin = window.location.origin

    const iframe = iframeElement()

    if (iframe) {
      bridgeParent = new BridgeParent(iframe)
    }
  }

  const closeLink = () => {
    bridgeParent?.destroy()
    removePopup()
    window.removeEventListener('message', eventsListener)
    options.onExit?.()
  }

  const closeLinkRequested = () => {
    if (currentOptions?.renderType === 'embedded') {
      sendMessageToIframe({ type: 'closeRequested' })
    } else {
      closeLink()
    }
  }

  return {
    openLink,
    closeLink,
    closeLinkRequested
  }
}

function addLanguage(linkUrl: string, language: string | undefined) {
  if (language === 'system') {
    language =
      typeof navigator !== 'undefined' && navigator.language
        ? encodeURIComponent(navigator.language)
        : undefined
  }

  return appendQueryParam(linkUrl, 'lng', language || 'en')
}

function addDisplayFiatCurrency(
  linkUrl: string,
  displayFiatCurrency: string | undefined
) {
  if (displayFiatCurrency) {
    return appendQueryParam(linkUrl, 'fiatCur', displayFiatCurrency)
  }
  return linkUrl
}

function addTheme(linkUrl: string, theme: LinkOptions['theme']) {
  if (theme) {
    return appendQueryParam(linkUrl, 'th', theme)
  }
  return linkUrl
}

function addRenderType(linkUrl: string, renderType: LinkOptions['renderType']) {
  if (renderType === 'embedded') {
    return appendQueryParam(linkUrl, 'rt', 'embedded')
  }
  return linkUrl
}

if (!window.meshLinkShouldSkipPrewarm) {
  createPrewarmIframe()
}

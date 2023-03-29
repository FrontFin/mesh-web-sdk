import {
  EventType,
  AccessTokenPayload,
  DelayedAuthPayload,
  FrontPayload,
  FrontOptions,
  FrontConnection
} from './utils/types'
import { generateAndSaveNonce, validateNonce } from './utils/nonce'
import localforage from 'localforage'
import { addPopup, removePopup } from './utils/popup'

const authLinkHostKey = 'front-auth-link-host'
const hostRegex = /^https?:\/\/[^/]+/i
async function saveAuthLinkHost(authLink: string): Promise<void> {
  const result = hostRegex.exec(authLink)
  if (result && result.length > 0) {
    await localforage.setItem(authLinkHostKey, result[0])
  }
}

async function getAuthLinkHost(): Promise<string> {
  const host = await localforage.getItem<string>(authLinkHostKey)
  return host || 'https://web.getfront.com'
}

const iframeId = 'front-link'
function deleteIframe() {
  const iframe = document.getElementById(iframeId)
  if (iframe) {
    setTimeout(() => iframe.remove(), 1000)
  }
}

function createListenerIframe(options: FrontOptions, host: string) {
  const iframe = document.createElement('iframe')
  iframe.id = iframeId
  iframe.title = 'Front'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.src = `${host}/b2b-iframe/${options.clientId}`
  document.body.appendChild(iframe)

  const messageListener = (
    event: MessageEvent<{
      type: EventType
      payload?: AccessTokenPayload | DelayedAuthPayload
      message?: string
    }>
  ) => {
    switch (event.data.type) {
      case 'brokerageAccountAccessToken': {
        const payload: FrontPayload = {
          accessToken: event.data.payload as AccessTokenPayload
        }
        options.onBrokerConnected && options.onBrokerConnected(payload)
        break
      }
      case 'delayedAuthentication': {
        const payload: FrontPayload = {
          delayedAuth: event.data.payload as DelayedAuthPayload
        }
        options.onBrokerConnected && options.onBrokerConnected(payload)
        break
      }
      case 'close':
      case 'done': {
        options.onExit && options.onExit(event.data.message)
        deleteIframe()
        break
      }
    }
  }

  window.parent.addEventListener('message', messageListener)
}

async function checkNonceAndCreateIframe(options: FrontOptions): Promise<void> {
  const queryParams = new URLSearchParams(window.location.search)
  const isSuccessConnection = queryParams.get('front-connection-success')
  const nonce = queryParams.get('front-connection-nonce')
  if (isSuccessConnection !== 'true' || !nonce) {
    return
  }

  const isNonceValid = await validateNonce(nonce)
  if (isNonceValid) {
    const host = await getAuthLinkHost()
    createListenerIframe(options, host)
  }
}

async function addNonceToUrl(link: string): Promise<string> {
  await saveAuthLinkHost(link)
  const nonce = await generateAndSaveNonce()
  const delimiter = link.indexOf('?') > 0 ? '&' : '?'
  const url = `${link}${delimiter}b2bNonce=${nonce}`
  return url
}

export const createFrontConnection = (
  options: FrontOptions
): FrontConnection => {
  const openLink = async (link: string) => {
    if (!link) {
      options?.onExit && options.onExit('Invalid link!')
      return
    }

    const url = await addNonceToUrl(link)
    window.location.href = url
    addPopup(url, options)
  }

  const openPopup = async (iframeUrl: string) => {
    if (!iframeUrl) {
      options?.onExit && options.onExit('Invalid link!')
      return
    }

    const url = await addNonceToUrl(iframeUrl)
    addPopup(url, options)
  }

  checkNonceAndCreateIframe(options)

  return {
    openLink: openLink,
    openPopup: openPopup,
    closePopup: () => {
      removePopup()
      options.onExit?.()
    }
  }
}

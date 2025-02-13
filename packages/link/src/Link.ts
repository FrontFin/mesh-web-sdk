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
import {
  WalletBrowserEventType,
  isWalletBrowserEventTypeKey
} from './utils/wallet-browser-event-types'
import { sdkSpecs } from './utils/sdk-specs'
import {
  connectToSpecificWallet,
  signedMessage,
  sendTransactionFromSDK,
  switchChainFromSDK,
  getWagmiCoreInjectedData,
  sendNonNativeTransactionFromSDK,
  disconnectAllAccounts
} from './utils/wagmiCoreConnectorsUtils'

let currentOptions: LinkOptions | undefined
const possibleOrigins = new Set<string>([
  'https://web.meshconnect.com',
  'https://dev-web.meshconnect.com'
])

const iframeElement = () => {
  return document.getElementById(iframeId) as HTMLIFrameElement
}

function sendMessageToIframe<T extends { type: string }>(message: T) {
  possibleOrigins.forEach(origin => {
    const iframe = iframeElement()
    if (!iframe) {
      console.warn(
        `Mesh SDK: Failed to deliver ${message.type} message to the iframe - no iframe element found`
      )
      return
    }

    try {
      iframe.contentWindow?.postMessage(message, origin)
    } catch (e) {
      console.error(
        `Mesh SDK: Failed to deliver ${message.type} message to the iframe`
      )
      console.error(e)
    }
  })
}

async function handleLinkEvent(
  event:
    | MessageEvent<{
        type: EventType
        payload?:
          | AccessTokenPayload
          | DelayedAuthPayload
          | TransferFinishedPayload
        link?: string
      }>
    | MessageEvent<LinkEventType>
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
      if (currentOptions?.transferDestinationTokens) {
        sendMessageToIframe({
          type: 'frontTransferDestinationTokens',
          payload: currentOptions.transferDestinationTokens
        })
      }
      const injectedConnectors = await getWagmiCoreInjectedData()
      if (injectedConnectors) {
        sendMessageToIframe({
          type: 'SDKinjectedWagmiConnectorsData',
          payload: injectedConnectors
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

async function handleWalletBrowserEvent(
  event: MessageEvent<WalletBrowserEventType>
) {
  switch (event.data.type) {
    case 'walletBrowserInjectedWalletSelected': {
      const payload = event.data.payload
      try {
        const result = await connectToSpecificWallet(payload.integrationName)
        if (result instanceof Error) {
          throw result
        }
        sendMessageToIframe({
          type: 'SDKinjectedConnectionCompleted',
          payload: {
            accounts: result.accounts,
            chainId: result.chainId
          }
        })
      } catch (error) {
        handleErrorAndSendMessage(
          error as Error,
          'SDKinjectedConnectionCompleted'
        )
      }
      break
    }
    case 'walletBrowserSignRequest': {
      const payload = event.data.payload
      try {
        const result = await signedMessage(payload.address, payload.message)
        if (result instanceof Error) {
          throw result
        }
        sendMessageToIframe({
          type: 'SDKsignRequestCompleted',
          payload: result
        })
      } catch (error) {
        handleErrorAndSendMessage(error as Error, 'SDKsignRequestCompleted')
      }
      break
    }
    case 'walletBrowserChainSwitchRequest': {
      const payload = event.data.payload
      try {
        const result = await switchChainFromSDK(payload.chainId)
        if (result instanceof Error) {
          throw result
        }
        sendMessageToIframe({
          type: 'SDKswitchChainCompleted',
          payload: result
        })
      } catch (error) {
        handleErrorAndSendMessage(error as Error, 'SDKswitchChainCompleted')
      }
      break
    }
    case 'walletBrowserNativeTransferRequest': {
      const payload = event.data.payload
      try {
        const result = await sendTransactionFromSDK(
          payload.toAddress,
          payload.amount,
          payload.decimalPlaces,
          payload.chainId,
          payload.account
        )
        if (result instanceof Error) {
          throw result
        }
        sendMessageToIframe({
          type: 'SDKnativeTransferCompleted',
          payload: result
        })
      } catch (error) {
        handleErrorAndSendMessage(error as Error, 'SDKnativeTransferCompleted')
      }
      break
    }
    case 'walletBrowserNonNativeTransferRequest': {
      const payload = event.data.payload
      try {
        const result = await sendNonNativeTransactionFromSDK(
          payload.address,
          JSON.parse(payload.abi),
          payload.functionName,
          payload.args
        )
        if (result instanceof Error) {
          throw result
        }
        sendMessageToIframe({
          type: 'SDKnonNativeTransferCompleted',
          payload: result
        })
      } catch (error) {
        handleErrorAndSendMessage(
          error as Error,
          'SDKnonNativeTransferCompleted'
        )
      }
      break
    }
    case 'walletBrowserNativeSmartDeposit': {
      const payload = event.data.payload
      try {
        const result = await sendNonNativeTransactionFromSDK(
          payload.address,
          JSON.parse(payload.abi),
          payload.functionName,
          payload.args,
          payload.value
        )
        if (result instanceof Error) {
          throw result
        }
        sendMessageToIframe({
          type: 'SDKnativeSmartDepositCompleted',
          payload: {
            txHash: result
          }
        })
      } catch (error) {
        handleErrorAndSendMessage(
          error as Error,
          'SDKnativeSmartDepositCompleted'
        )
      }
      break
    }
    case 'walletBrowserNonNativeSmartDeposit': {
      const payload = event.data.payload
      try {
        const result = await sendNonNativeTransactionFromSDK(
          payload.address,
          JSON.parse(payload.abi),
          payload.functionName,
          payload.args
        )
        if (result) {
          sendMessageToIframe({
            type: 'SDKnonNativeSmartDepositCompleted',
            payload: {
              txHash: result
            }
          })
        } else {
          throw new Error('Transfer failed')
        }
      } catch (error) {
        handleErrorAndSendMessage(
          error as Error,
          'SDKnonNativeSmartDepositCompleted'
        )
      }
      break
    }
    case 'walletBrowserDisconnect': {
      disconnectAllAccounts()
      sendMessageToIframe({
        type: 'SDKdisconnectSuccess'
      })
      break
    }
  }
}

async function eventsListener(
  event: MessageEvent<
    LinkEventType | WalletBrowserEventType | { type: EventType }
  >
) {
  if (isWalletBrowserEventTypeKey(event.data.type)) {
    await handleWalletBrowserEvent(
      event as MessageEvent<WalletBrowserEventType>
    )
  } else if (possibleOrigins.has(event.origin)) {
    await handleLinkEvent(event as MessageEvent<{ type: EventType }>)
  }
}

function handleErrorAndSendMessage(error: Error, messageType: string) {
  sendMessageToIframe({
    type: messageType,
    payload: {
      error: error
    }
  })
}

export const createLink = (options: LinkOptions): Link => {
  const openLink = async (linkToken: string) => {
    if (!linkToken) {
      options?.onExit?.('Invalid link token!')
      return
    }

    currentOptions = options
    const linkUrl = window.atob(linkToken)
    const iframeUrlObject = new URL(linkUrl)
    if (iframeUrlObject.origin) {
      possibleOrigins.add(iframeUrlObject.origin)
    }

    window.removeEventListener('message', eventsListener)
    addPopup(linkUrl)
    window.addEventListener('message', eventsListener)
  }

  const closeLink = () => {
    removePopup()
    window.removeEventListener('message', eventsListener)
    options.onExit?.()
    disconnectAllAccounts()
  }

  return {
    openLink: openLink,
    closeLink: closeLink
  }
}

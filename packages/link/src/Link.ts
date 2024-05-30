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
import {
  LinkEventType,
  isLinkEventTypeKey,
  WalletBrowserEventType,
  isWalletBrowserEventTypeKey
} from './utils/event-types'
import { sdkSpecs } from './utils/sdk-specs'
import {
  connectToSpecificWallet,
  walletBalance,
  sendTransactionFromSDK,
  switchChainFromSDK,
  getWagmiCoreInjectedData,
  sendNonNativeTransactionFromSDK,
  disconnectAllAccounts
} from './utils/wagmiCoreConnectorsUtils'

let currentOptions: LinkOptions | undefined
const possibleOrigins = new Set<string>([
  'https://web.meshconnect.com',
  'https://web.getfront.com'
])

const iframeElement = () => {
  return document.getElementById(iframeId) as HTMLIFrameElement
}

function sendMessageToIframe(message: unknown) {
  possibleOrigins.forEach(origin => {
    try {
      iframeElement().contentWindow?.postMessage(message, origin)
    } catch (e) {
      console.error('Mesh SDK: Failed to deliver message to the iframe')
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
      sendMessageToIframe({
        type: 'meshSDKSpecs',
        payload: { ...sdkSpecs }
      })

      if (currentOptions?.accessTokens) {
        sendMessageToIframe({
          type: 'frontAccessTokens',
          payload: currentOptions.accessTokens
        })
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
      console.log('SDKinjectedWagmiConnectorsDataFROMSDK', injectedConnectors)
      if (injectedConnectors) {
        sendMessageToIframe({
          type: 'SDKinjectedWagmiConnectorsData',
          payload: injectedConnectors
        })
        sendMessageToIframe({
          type: 'frontTransferDestinationTokens',
          payload: currentOptions.transferDestinationTokens
        })
      }
      if (currentOptions?.injectedCoreConnectors) {
        console.log(
          'injectedCoreConnectors',
          currentOptions?.injectedCoreConnectors
        )
        // console.log(
        //   'allInjectedCoreConnectorData',
        //   currentOptions?.allInjectedCoreConnectorData
        // )
        iframeElement().contentWindow?.postMessage(
          {
            type: 'frontInjectedConnectors',
            payload: injectedConnectors
          },
          iframeUrlObject?.origin || 'https://web.meshconnect.com'
        )
      }
      if (currentOptions?.injectedCoreConnectors) {
        console.log(
          'injectedCoreConnectors',
          currentOptions?.injectedCoreConnectors
        )
        // console.log(
        //   'allInjectedCoreConnectorData',
        //   currentOptions?.allInjectedCoreConnectorData
        // )
        // iframeElement().contentWindow?.postMessage(
        //   {
        //     type: 'frontInjectedConnectors',
        //     payload: currentOptions?.injectedCoreConnectors
        //   },
        //   iframeUrlObject?.origin || 'https://web.meshconnect.com'
        // )
        const injectedConnectors = await getWagmiCoreInjectedData()
        console.log('injectedConnectors', injectedConnectors)
        if (injectedConnectors) {
          iframeElement().contentWindow?.postMessage(
            {
              type: 'frontInjectedConnectors',
              payload: injectedConnectors
            },
            iframeUrlObject?.origin || 'https://web.meshconnect.com'
          )
        }
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
        console.log('result connectToSpecificWallet', result)
        console.log('currentOptions', currentOptions)
        console.log('result accounts', result.accounts)
        console.log('result chainId', result.chainId)
        sendMessageToIframe({
          type: 'SDKinjectedConnected',
          payload: {
            accounts: result.accounts,
            chainId: result.chainId,
            signedTxHash: result.txSigned
          }
        })
        console.log('sent SDKinjectedConnected to iframe')
      } catch (error) {
        console.log('SHOULD HAVE SENT ERROR')
        sendMessageToIframe({
          type: 'SDKinjectedDisconnected',
          payload: {
            error: error.message
          }
        })
      }
      break
    }
    case 'walletBrowserChainSwitchRequest': {
      const payload = event.data.payload
      try {
        const result = await switchChainFromSDK(payload.chainId)
        console.log('result switchChainFromSDK', result)
        if (result instanceof Error) {
          throw result
        }
        sendMessageToIframe({
          type: 'SDKswitchChainSuccess',
          payload: result
        })
      } catch (error) {
        console.error('Error switching chain:', error)
        sendMessageToIframe({
          type: 'SDKswitchChainFailed',
          payload: {
            error: error.message
          }
        })
      }
      break
    }
    // not being used but may be used in the future
    case 'walletBrowserTransferBalanceRequest': {
      const payload = event.data.payload
      const balance = await walletBalance(
        payload.account,
        event.data.payload.chainId
      )
      break
    }
    case 'walletBrowserNativeTransferRequest': {
      const payload = event.data.payload
      console.log('walletBrowserNativeTransferRequest', payload)
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
        console.log('resultSendTransfer', result)
        sendMessageToIframe({
          type: 'SDKnativeTransferCompleted',
          payload: result
        })
      } catch (error) {
        console.error('Error sending native transaction:', error)
        sendMessageToIframe({
          type: 'SDKnativeTransferCompleted',
          payload: {
            error: error.message
          }
        })
      }
      break
    }
    case 'walletBrowserNonNativeTransferRequest': {
      const payload = event.data.payload
      console.log('walletBrowserNonNativeTransferRequest', payload)
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
        console.log('resultNonNativeSmartTransfer', result)
        sendMessageToIframe({
          type: 'SDKnonNativeTransferCompleted',
          payload: result
        })
      } catch (error) {
        console.error('Error sending non-native transaction:', error)
        sendMessageToIframe({
          type: 'SDKnonNativeTransferCompleted',
          payload: {
            error: error.message
          }
        })
      }
      break
    }
    case 'walletBrowserNativeSmartDeposit': {
      const payload = event.data.payload
      console.log('walletBrowserNativeSmartDeposit', payload)
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
        console.log('resultNativeSmartDeposit', result)
        sendMessageToIframe({
          type: 'SDKnativeSmartDepositCompleted',
          payload: {
            txHash: result
          }
        })
      } catch (error) {
        console.error('Error sending native sc transaction:', error)
        sendMessageToIframe({
          type: 'SDKnativeSmartDepositCompleted',
          payload: {
            error: error.message
          }
        })
      }
      break
    }
    case 'walletBrowserNonNativeSmartDeposit': {
      const payload = event.data.payload
      console.log('walletBrowserNonNativeSmartDeposit', payload)
      try {
        const result = await sendNonNativeTransactionFromSDK(
          payload.address,
          JSON.parse(payload.abi),
          payload.functionName,
          payload.args
        )
        console.log('resultNonNativeSmartTransferTransfer', result)
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
        console.error('Error sending non-native sc transaction:', error)
        sendMessageToIframe({
          type: 'SDKnonNativeSmartDepositCompleted',
          payload: {
            error: error.message
          }
        })
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
  if (isLinkEventTypeKey(event.data.type)) {
    await handleLinkEvent(event as MessageEvent<LinkEventType>)
  } else if (isWalletBrowserEventTypeKey(event.data.type)) {
    await handleWalletBrowserEvent(
      event as MessageEvent<WalletBrowserEventType>
    )
  } else {
    await handleLinkEvent(event as MessageEvent<{ type: EventType }>)
  }
}

export const createLink = (options: LinkOptions): Link => {
  const openLink = async (linkToken: string) => {
    if (!linkToken) {
      options?.onExit?.('Invalid link token!')
      return
    }

    currentOptions = options
    console.log('init current options', currentOptions)
    const linkUrl = window.atob(linkToken)
    const iframeUrlObject = new URL(linkUrl)
    if (iframeUrlObject.origin) {
      possibleOrigins.add(iframeUrlObject.origin)
    }

    window.removeEventListener('message', eventsListener)
    addPopup(linkUrl)
    window.addEventListener('message', eventsListener)
  }

  // can just disconnect wagmi here
  const closeLink = () => {
    removePopup()
    window.removeEventListener('message', eventsListener)
    options.onExit?.()
    disconnectAllAccounts()
  }
  try {
    const fromUtils = createConfigFromUtils()
    console.log('fromUtils', fromUtils)
  } catch (error) {
    console.error('Error creating config from utils:', error)
  }

  window.addEventListener('message', event => {
    if (event.data.type === 'wagmiConfigUpdate') {
      console.log(
        'event.data.payload wagmi config update111',
        event.data.payload
      )
      try {
        const parsedConfig = JSON.parse(event.data.payload)
        console.log('Parsed configuration:', parsedConfig)
        setConfig1(parsedConfig)
      } catch (error) {
        console.error('Error parsing configuration:', error)
      }
    }
  })

  return {
    openLink: openLink,
    closeLink: closeLink
  }
}

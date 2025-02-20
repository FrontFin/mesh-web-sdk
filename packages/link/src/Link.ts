import {
  LinkOptions,
  Link,
  EventType,
  AccessTokenPayload,
  DelayedAuthPayload,
  TransferFinishedPayload,
  LinkPayload,
  WalletBrowserPayload,
  SignRequestPayload,
  ChainSwitchPayload,
  TransferPayload,
  SmartContractPayload,
  DisconnectPayload
} from './utils/types'
import { addPopup, iframeId, removePopup } from './utils/popup'
import { LinkEventType, isLinkEventTypeKey } from './utils/event-types'
import {
  WalletBrowserEventType,
  isWalletBrowserEventTypeKey
} from './utils/wallet-browser-event-types'
import { sdkSpecs } from './utils/sdk-specs'
import {
  connectToEVMWallet,
  signEVMMessage,
  sendEVMTransaction,
  switchEVMChain,
  sendEVMTokenTransaction,
  disconnectFromEVMWallet,
  findAvailableProviders
} from './utils/connectors/evm'
import {
  connectToSolanaWallet,
  disconnectFromSolanaWallet,
  signSolanaMessage,
  sendSOLTransaction,
  findAvailableSolanaProviders
} from './utils/connectors/solana'
import { WalletStrategyFactory, NetworkType } from './utils/wallet'

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

      // Get all providers using the wallet factory
      const walletFactory = WalletStrategyFactory.getInstance()
      const allProviders = walletFactory.getAllProviders()

      sendMessageToIframe({
        type: 'SDKinjectedWalletProviders',
        payload: allProviders
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
  const walletFactory = WalletStrategyFactory.getInstance()

  switch (event.data.type) {
    case 'walletBrowserInjectedWalletSelected': {
      const payload = event.data.payload as WalletBrowserPayload
      try {
        const networkType = (
          payload.networkType?.includes('solana') ? 'solana' : 'evm'
        ) as NetworkType
        const strategy = walletFactory.getStrategy(networkType)

        const result = await strategy.connect(payload)

        sendMessageToIframe({
          type: 'SDKinjectedConnectionCompleted',
          payload: {
            accounts: result.accounts,
            chainId: result.chainId,
            networkType: networkType
          }
        })
      } catch (error) {
        console.error('Connection error:', error)
        handleErrorAndSendMessage(
          error as Error,
          'SDKinjectedConnectionCompleted'
        )
      }
      break
    }
    case 'walletBrowserSignRequest': {
      const payload = event.data.payload as SignRequestPayload
      try {
        const networkType = (
          !payload.address.startsWith('0x') ? 'solana' : 'evm'
        ) as NetworkType
        const strategy = walletFactory.getStrategy(networkType)

        const result = await strategy.signMessage(payload)

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
      const payload = event.data.payload as ChainSwitchPayload
      try {
        const networkType = (
          payload.networkType === 'solana' ? 'solana' : 'evm'
        ) as NetworkType
        const strategy = walletFactory.getStrategy(networkType)

        const result = await strategy.switchChain(payload)

        sendMessageToIframe({
          type: 'SDKswitchChainCompleted',
          payload: {
            chainId: result.chainId,
            accounts: result.accounts,
            networkType: networkType
          }
        })
      } catch (error) {
        console.error('Chain switch failed:', error)
        handleErrorAndSendMessage(error as Error, 'SDKswitchChainCompleted')
      }
      break
    }
    case 'walletBrowserNativeTransferRequest': {
      const payload = event.data.payload as TransferPayload
      try {
        const networkType = (
          payload.network === 'solana' ? 'solana' : 'evm'
        ) as NetworkType
        const strategy = walletFactory.getStrategy(networkType)

        const result = await strategy.sendNativeTransfer(payload)

        sendMessageToIframe({
          type: 'SDKnativeTransferCompleted',
          payload: result
        })
      } catch (error) {
        handleErrorAndSendMessage(error as Error, 'SDKnativeTransferCompleted')
      }
      break
    }
    case 'walletBrowserNonNativeTransferRequest':
    case 'walletBrowserNativeSmartDeposit':
    case 'walletBrowserNonNativeSmartDeposit': {
      const payload = event.data.payload as SmartContractPayload
      try {
        // These operations are currently only supported for EVM
        const strategy = walletFactory.getStrategy('evm')

        const result = await strategy.sendSmartContractInteraction(payload)

        const responseType =
          event.data.type === 'walletBrowserNonNativeTransferRequest'
            ? 'SDKnonNativeTransferCompleted'
            : event.data.type === 'walletBrowserNativeSmartDeposit'
            ? 'SDKnativeSmartDepositCompleted'
            : 'SDKnonNativeSmartDepositCompleted'

        sendMessageToIframe({
          type: responseType,
          payload: {
            txHash: result
          }
        })
      } catch (error) {
        const errorType =
          event.data.type === 'walletBrowserNonNativeTransferRequest'
            ? 'SDKnonNativeTransferCompleted'
            : event.data.type === 'walletBrowserNativeSmartDeposit'
            ? 'SDKnativeSmartDepositCompleted'
            : 'SDKnonNativeSmartDepositCompleted'

        handleErrorAndSendMessage(error as Error, errorType)
      }
      break
    }
    case 'walletBrowserDisconnect': {
      const payload = event.data.payload as DisconnectPayload

      try {
        if (payload?.networkType) {
          const networkType = (
            payload.networkType === 'solana' ? 'solana' : 'evm'
          ) as NetworkType
          const strategy = walletFactory.getStrategy(networkType)
          await strategy.disconnect(payload)
        } else {
          // Disconnect from all if no specific network type
          await Promise.all([
            walletFactory.getStrategy('solana').disconnect(payload),
            walletFactory.getStrategy('evm').disconnect(payload)
          ])
        }

        sendMessageToIframe({
          type: 'SDKdisconnectSuccess'
        })
      } catch (error) {
        console.error('Error during disconnect:', error)
        handleErrorAndSendMessage(error as Error, 'SDKdisconnectSuccess')
      }
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
  }

  return {
    openLink: openLink,
    closeLink: closeLink
  }
}

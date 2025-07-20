import type {
  LinkOptions,
  Link,
  EventType,
  AccessTokenPayload,
  DelayedAuthPayload,
  TransferFinishedPayload,
  LinkPayload,
  SignRequestPayload,
  ChainSwitchPayload,
  TransferPayload,
  SmartContractPayload,
  DisconnectPayload,
  TransactionBatchPayload,
  WalletCapabilitiesPayload,
  SolanaTransferWithInstructionsPayload
} from './utils/types'
import { addPopup, iframeId, removePopup } from './utils/popup'
import { type LinkEventType, isLinkEventTypeKey } from './utils/event-types'
import {
  type WalletBrowserEventType,
  isWalletBrowserEventTypeKey
} from './utils/wallet-browser-event-types'
import { sdkSpecs } from './utils/sdk-specs'
import { WalletStrategyFactory, type NetworkType } from './utils/wallet'

let currentOptions: LinkOptions | undefined
let targetOrigin: string | undefined
let linkTokenOrigin: string | undefined
let currentIframeId = iframeId

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
      const { integrationName, networkType, targetChainId } = event.data.payload
      try {
        const networkType_: NetworkType = networkType?.includes('solana')
          ? 'solana'
          : 'evm'
        const strategy = walletFactory.getStrategy(networkType_)

        const result = await strategy.connect({
          integrationName,
          networkType: networkType_,
          targetChainId: String(targetChainId)
        })

        sendMessageToIframe({
          type: 'SDKinjectedConnectionCompleted',
          payload: {
            accounts: result.accounts,
            chainId: result.chainId,
            networkType: networkType_
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
        const networkType: NetworkType = !payload.address.startsWith('0x')
          ? 'solana'
          : 'evm'
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
    case 'walletBrowserNonNativeSmartDeposit': {
      const payload = event.data.payload as SmartContractPayload
      const getResponseType = (type: WalletBrowserEventType['type']) => {
        switch (type) {
          case 'walletBrowserNonNativeTransferRequest':
            return 'SDKnonNativeTransferCompleted'
          case 'walletBrowserNativeSmartDeposit':
            return 'SDKnativeSmartDepositCompleted'
          case 'walletBrowserNonNativeSmartDeposit':
            return 'SDKnonNativeSmartDepositCompleted'
          default:
            return 'SDKnonNativeTransferCompleted'
        }
      }

      try {
        const networkType = (
          payload.address.startsWith('0x') ? 'evm' : 'solana'
        ) as NetworkType
        const strategy = walletFactory.getStrategy(networkType)
        const result = await strategy.sendSmartContractInteraction(payload)

        const responseType = getResponseType(event.data.type)

        sendMessageToIframe({
          type: responseType,
          payload: {
            txHash: result
          }
        })
      } catch (error) {
        const errorType = getResponseType(event.data.type)
        handleErrorAndSendMessage(error as Error, errorType)
      }
      break
    }
    case 'walletBrowserNativeSmartDeposit': {
      const payload = event.data.payload as SmartContractPayload
      const getResponseType = (type: WalletBrowserEventType['type']) => {
        switch (type) {
          case 'walletBrowserNonNativeTransferRequest':
            return 'SDKnonNativeTransferCompleted'
          case 'walletBrowserNativeSmartDeposit':
            return 'SDKnativeSmartDepositCompleted'
          case 'walletBrowserNonNativeSmartDeposit':
            return 'SDKnonNativeSmartDepositCompleted'
          default:
            return 'SDKnonNativeTransferCompleted'
        }
      }

      try {
        const networkType = (
          payload.address.startsWith('0x') ? 'evm' : 'solana'
        ) as NetworkType
        const strategy = walletFactory.getStrategy(networkType)
        const result = await strategy.sendNativeSmartContractInteraction(
          payload
        )

        const responseType = getResponseType(event.data.type)

        sendMessageToIframe({
          type: responseType,
          payload: {
            txHash: result
          }
        })
      } catch (error) {
        const errorType = getResponseType(event.data.type)
        handleErrorAndSendMessage(error as Error, errorType)
      }
      break
    }
    case 'walletBrowserTransactionBatchRequest': {
      const payload = event.data.payload as TransactionBatchPayload
      const responseType = 'SDKtransactionBatchCompleted'

      try {
        const networkType = (
          payload.from.startsWith('0x') ? 'evm' : 'solana'
        ) as NetworkType
        const strategy = walletFactory.getStrategy(networkType)
        const result = await strategy.sendTransactionBatch(payload)

        sendMessageToIframe({
          type: responseType,
          payload: {
            txHash: result
          }
        })
      } catch (error) {
        handleErrorAndSendMessage(error as Error, responseType)
      }
      break
    }
    case 'walletBrowserWalletCapabilities': {
      const payload = event.data.payload as WalletCapabilitiesPayload
      const responseType = 'SDKwalletCapabilitiesCompleted'
      try {
        const networkType = (
          payload.from.startsWith('0x') ? 'evm' : 'solana'
        ) as NetworkType
        const strategy = walletFactory.getStrategy(networkType)
        const result = await strategy.getWalletCapabilities(payload)

        sendMessageToIframe({
          type: responseType,
          payload: result
        })
      } catch (error) {
        handleErrorAndSendMessage(error as Error, responseType)
      }
      break
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
    case 'walletBrowserSolanaTransferWithInstructionsRequest': {
      const payload = event.data
        .payload as SolanaTransferWithInstructionsPayload

      try {
        const networkType = 'solana' as NetworkType
        const strategy = walletFactory.getStrategy(networkType)
        const result = await strategy.sendTransactionWithInstructions(payload)
        sendMessageToIframe({
          type: 'SDKnonNativeTransferCompleted',
          payload: {
            txHash: result
          }
        })
      } catch (error) {
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
  if (event.origin !== targetOrigin && event.origin !== linkTokenOrigin) {
    console.warn('Received message from untrusted origin:', event.origin)
  } else if (isWalletBrowserEventTypeKey(event.data.type)) {
    await handleWalletBrowserEvent(
      event as MessageEvent<WalletBrowserEventType>
    )
  } else {
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
  const openLink = (linkToken: string, customIframeId?: string) => {
    if (!linkToken) {
      options?.onExit?.('Invalid link token!')
      return
    }

    currentOptions = options
    let linkUrl = window.atob(linkToken)
    linkUrl = addLanguage(linkUrl, currentOptions?.language)
    linkTokenOrigin = new URL(linkUrl).origin
    window.removeEventListener('message', eventsListener)
    if (customIframeId) {
      const iframe = document.getElementById(
        customIframeId
      ) as HTMLIFrameElement
      if (iframe) {
        iframe.allow = 'clipboard-read *; clipboard-write *'
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

function addLanguage(linkUrl: string, language: string | undefined) {
  if (language === 'system') {
    language =
      typeof navigator !== 'undefined' && navigator.language
        ? encodeURIComponent(navigator.language)
        : undefined
  }

  return `${linkUrl}${linkUrl.includes('?') ? '&' : '?'}lng=${language || 'en'}`
}

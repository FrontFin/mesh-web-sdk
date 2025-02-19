import {
  LinkOptions,
  Link,
  EventType,
  AccessTokenPayload,
  DelayedAuthPayload,
  TransferFinishedPayload,
  LinkPayload
} from './utils/types'
import {
  WalletBrowserPayload,
  SignRequestPayload,
  ChainSwitchPayload,
  TransferPayload,
  SmartContractPayload,
  DisconnectPayload
} from './utils/connectors/evm/types'
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

      // Get both EVM and Solana providers
      const evmProviders = findAvailableProviders().map(provider => ({
        icon: provider.icon,
        id: provider.id,
        name: provider.name,
        type: 'evm'
      }))

      const solanaProviderMap = findAvailableSolanaProviders()
      const solanaProviders = Object.keys(solanaProviderMap).map(id => ({
        icon: '', // Solana wallets don't provide icons through the provider
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1), // Capitalize first letter
        type: 'solana'
      }))

      const allProviders = [...evmProviders, ...solanaProviders]
      console.log('About to send providers:', allProviders)

      // Send the combined provider list to the iframe
      sendMessageToIframe({
        type: 'SDKinjectedWalletProviders',
        payload: allProviders
      })

      console.log('Sent SDKinjectedWalletProviders message')

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
  switch (event.data.type) {
    case 'walletBrowserInjectedWalletSelected': {
      console.log('walletBrowserInjectedWalletSelected', event.data.payload)
      const payload = event.data.payload as WalletBrowserPayload
      try {
        let result

        // Handle connection based on networkType
        if (payload.networkType?.includes('solana')) {
          console.log('Connecting to Solana wallet:', payload.integrationName)
          result = await connectToSolanaWallet(payload.integrationName)
        } else {
          console.log('Connecting to EVM wallet:', {
            name: payload.integrationName,
            targetChainId: payload.targetChainId
          })

          // Pass the targetChainId for immediate connection to correct network
          result = await connectToEVMWallet(
            payload.integrationName,
            payload.targetChainId
              ? parseInt(payload.targetChainId, 10)
              : undefined
          )
        }

        console.log('Connection result:', result)
        if (result instanceof Error) {
          throw result
        }

        // Send connection completed message which will trigger authenticate
        sendMessageToIframe({
          type: 'SDKinjectedConnectionCompleted',
          payload: {
            accounts: result.accounts,
            chainId: result.chainId,
            networkType: payload.networkType?.includes('solana')
              ? 'solana'
              : 'evm'
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
      console.log('walletBrowserSignRequest!!!!!')
      const payload = event.data.payload as SignRequestPayload
      console.log('payload sign request', payload)
      try {
        // Check if this is a Solana address (doesn't start with 0x)
        if (!payload.address.startsWith('0x')) {
          console.log('Detected Solana address, using Solana signing...')
          if (!payload.walletName) {
            throw new Error('Wallet name is required for Solana signing')
          }
          const result = await signSolanaMessage(
            payload.walletName,
            payload.address,
            payload.message
          )
          if (result instanceof Error) {
            throw result
          }
          console.log('result sign request', result)
          sendMessageToIframe({
            type: 'SDKsignRequestCompleted',
            payload: result
          })
        } else {
          // Just pass the original message directly
          const result = await signEVMMessage(
            payload.walletName || 'Unknown Wallet',
            payload.address,
            payload.message
          )
          if (result instanceof Error) {
            throw result
          }
          sendMessageToIframe({
            type: 'SDKsignRequestCompleted',
            payload: result
          })
        }
      } catch (error) {
        handleErrorAndSendMessage(error as Error, 'SDKsignRequestCompleted')
      }
      break
    }
    case 'walletBrowserChainSwitchRequest': {
      const payload = event.data.payload as ChainSwitchPayload
      try {
        console.log('Processing chain switch request:', payload)

        // Handle Solana chain switching
        if (payload.networkType === 'solana') {
          console.log('Switching to Solana chain')
          const provider = window.solana
          if (!provider) {
            throw new Error('Solana provider not found')
          }
          if (!provider.isConnected || !provider.publicKey) {
            // If not connected, try to connect
            const connectResult = await provider.connect()
            if (!connectResult?.publicKey) {
              throw new Error('Failed to connect to Solana wallet')
            }
          }

          const solanaAddress = provider.publicKey?.toString()
          if (!solanaAddress) {
            throw new Error('No Solana address available')
          }

          console.log('Solana connection verified:', { solanaAddress })

          sendMessageToIframe({
            type: 'SDKswitchChainCompleted',
            payload: {
              chainId: 101,
              accounts: [solanaAddress],
              networkType: 'solana'
            }
          })
        } else {
          // Handle EVM chain switching
          console.log('Switching EVM chain to:', payload.chainId)
          const result = await switchEVMChain(payload.chainId)
          console.log('switch chain result', result)
          if (result instanceof Error) {
            throw result
          }

          // Send the switch completed message with the new chain ID and accounts
          console.log('Sending chain switch completed with:', {
            chainId: result.chainId,
            accounts: result.accounts,
            networkType: 'evm'
          })

          sendMessageToIframe({
            type: 'SDKswitchChainCompleted',
            payload: {
              chainId: result.chainId,
              accounts: result.accounts,
              networkType: 'evm'
            }
          })
        }
      } catch (error) {
        console.error('Chain switch failed:', error)
        handleErrorAndSendMessage(error as Error, 'SDKswitchChainCompleted')
      }
      break
    }
    case 'walletBrowserNativeTransferRequest': {
      const payload = event.data.payload as TransferPayload
      try {
        let result
        if (payload.network === 'solana') {
          result = await sendSOLTransaction({
            toAddress: payload.toAddress,
            amount: BigInt(
              payload.amount * Math.pow(10, payload.decimalPlaces)
            ),
            fromAddress: payload.account,
            blockhash: payload.blockhash || '',
            walletName: payload.walletName || ''
          })
        } else {
          result = await sendEVMTransaction(
            payload.toAddress,
            BigInt(payload.amount * Math.pow(10, payload.decimalPlaces)),
            payload.account
          )
        }

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
      const payload = event.data.payload as SmartContractPayload
      try {
        const result = await sendEVMTokenTransaction(
          payload.address,
          JSON.parse(payload.abi),
          payload.functionName,
          payload.args,
          payload.account
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
      const payload = event.data.payload as SmartContractPayload
      try {
        const result = await sendEVMTokenTransaction(
          payload.address,
          JSON.parse(payload.abi),
          payload.functionName,
          payload.args,
          payload.account,
          BigInt(payload.value || '0')
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
      const payload = event.data.payload as SmartContractPayload
      try {
        const result = await sendEVMTokenTransaction(
          payload.address,
          JSON.parse(payload.abi),
          payload.functionName,
          payload.args,
          payload.account
        )
        if (result instanceof Error) {
          throw result
        }
        sendMessageToIframe({
          type: 'SDKnonNativeSmartDepositCompleted',
          payload: {
            txHash: result
          }
        })
      } catch (error) {
        handleErrorAndSendMessage(
          error as Error,
          'SDKnonNativeSmartDepositCompleted'
        )
      }
      break
    }
    case 'walletBrowserDisconnect': {
      const payload = event.data.payload as DisconnectPayload
      console.log('Disconnecting wallet before network switch', {
        networkType: payload?.networkType,
        walletName: payload?.walletName
      })

      try {
        if (payload?.networkType === 'solana') {
          // Disconnect from Solana
          console.log('Disconnecting from Solana wallet')
          await disconnectFromSolanaWallet(
            payload?.walletName || 'Unknown Wallet'
          )
        } else if (payload?.networkType === 'evm') {
          // Disconnect from EVM
          console.log('Disconnecting from EVM wallet')
          await disconnectFromEVMWallet(payload?.walletName || 'Unknown Wallet')
        } else {
          // If networkType is undefined or unknown, disconnect from both to be safe
          console.log('No network type specified, disconnecting from all')
          await Promise.all([
            disconnectFromSolanaWallet('Unknown Wallet'),
            disconnectFromEVMWallet('Unknown Wallet')
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

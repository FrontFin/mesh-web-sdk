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
  connectToSpecificWallet,
  signedMessage,
  walletBalance,
  sendTransactionFromSDK,
  switchChainFromSDK,
  checkActiveAccounts,
  checkActiveConnections
} from './utils/wagmiCoreConnectorsUtils'
import { type Connection } from '@wagmi/core'

let currentOptions: LinkOptions | undefined
let iframeUrlObject: URL | undefined

const iframeElement = () => {
  return document.getElementById(iframeId) as HTMLIFrameElement
}

async function eventsListener(
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
      currentOptions?.onExit?.(payload.errorMessage, payload)
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

    case 'integrationInjectedWalletSelected': {
      const payload = event.data.payload
      console.log('Integration selected:', payload.integrationName)
      console.log('Integration type', payload.integrationType)
      const result: Connection = await connectToSpecificWallet(
        payload.integrationName
      )
      console.log('result', result)
      if (result) {
        console.log('Connected to wallet')
      }
      const txSigned = await signedMessage()
      // Check if the connection was successful and accounts are available
      if (
        result &&
        Array.isArray(result.accounts) &&
        result.accounts.length > 0
      ) {
        console.log('currentOptions', currentOptions)
        console.log('result accounts', result.accounts)
        console.log('result chainId', result.chainId)
        iframeElement().contentWindow?.postMessage(
          {
            type: 'SDKInjectedConnected',
            payload: {
              accounts: result.accounts,
              chainId: result.chainId,
              signedTxHash: txSigned
            }
          },
          iframeUrlObject?.origin || 'https://web.meshconnect.com'
        )

        console.log('sent SDKInjectedConnected to iframe')
      } else {
        console.error('Failed to connect to wallet or no accounts found.')
      }
      // console.log('signedMessage', signedMessage)
      // sign message only when connection is succesful and accounts available

      break
    }
    case 'transferBalanceRequest': {
      console.log('transferBalanceRequest', event.data)
      const balance = await walletBalance(
        event.data.payload.account,
        event.data.payload.chainId
      )
      console.log('balance', balance)
      break
    }
    case 'integrationChainSwitchRequest': {
      const payload = event.data.payload
      console.log('integrationChainSwitchRequestInSDK', payload)
      const result = await switchChainFromSDK(payload.chainId)
      console.log('switchChainFromSDK', result)
      const activeAccounts = await checkActiveAccounts()
      console.log('activeAccounts', activeAccounts)
      const activeConnections = await checkActiveConnections()
      console.log('activeConnections', activeConnections)
      // TODO: send success message and handle if we fail
      break
    }
    case 'transferInjectedRequest': {
      const payload = event.data.payload
      console.log('transferInjectedRequest', payload)
      console.log('decimalPlaces', payload.decimalPlaces)
      // TODO: make sure that we only handle this once we don't want to double send
      const result = await sendTransactionFromSDK(
        payload.toAddress,
        payload.amount,
        payload.decimalPlaces,
        payload.chainId,
        payload.account,
        payload.connectorName,
        currentOptions?.allInjectedCoreConnectorData || []
      )
      console.log('resultSendTransfer', result)
      // TODO: wrap this in if result
      iframeElement().contentWindow?.postMessage(
        {
          type: 'transferInjectedCompleted',
          payload: result
        },
        iframeUrlObject?.origin || 'https://web.meshconnect.com'
      )
      break
    }
    case 'loaded': {
      if (currentOptions?.accessTokens) {
        iframeElement().contentWindow?.postMessage(
          { type: 'frontAccessTokens', payload: currentOptions.accessTokens },
          iframeUrlObject?.origin || 'https://web.meshconnect.com'
        )
      }
      if (currentOptions?.transferDestinationTokens) {
        iframeElement().contentWindow?.postMessage(
          {
            type: 'frontTransferDestinationTokens',
            payload: currentOptions.transferDestinationTokens
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
        iframeElement().contentWindow?.postMessage(
          {
            type: 'frontInjectedConnectors',
            payload: currentOptions?.injectedCoreConnectors
          },
          iframeUrlObject?.origin || 'https://web.meshconnect.com'
        )
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

export const createLink = (options: LinkOptions): Link => {
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
    openLink: openLink,
    closeLink: closeLink
  }
}

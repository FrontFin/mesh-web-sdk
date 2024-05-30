import type { BrokerType } from '@meshconnect/node-api'
import { SessionSymmary, LinkEventType } from './event-types'
import { type Connector } from '@wagmi/core'

export type EventType =
  | 'brokerageAccountAccessToken'
  | 'delayedAuthentication'
  | 'loaded'
  | 'oauthLinkOpen'
  | 'transferFinished'
  | 'connectInjectedWallet'

export interface Link {
  /**
   * A function that takes linkToken parameter from `/api/v1/linktoken` endpoint as an input, and opens the Link UI popup
   */
  openLink: (linkToken: string) => Promise<void>
  /**
   * A function to close Link UI popup
   */
  closeLink: () => void
}

export interface AccountToken {
  account: Account
  accessToken: string
  refreshToken?: string
}

export interface Account {
  accountId: string
  accountName: string
  fund?: number
  cash?: number
  isReconnected?: boolean
}

export interface BrandInfo {
  brokerLogo: string
  brokerPrimaryColor?: string
}

export interface LinkPayload {
  accessToken?: AccessTokenPayload
  delayedAuth?: DelayedAuthPayload
}

export interface AccessTokenPayload {
  accountTokens: AccountToken[]
  brokerBrandInfo: BrandInfo
  expiresInSeconds?: number
  refreshTokenExpiresInSeconds?: number
  brokerType: BrokerType
  brokerName: string
}

export interface DelayedAuthPayload {
  refreshTokenExpiresInSeconds?: number
  brokerType: BrokerType
  refreshToken: string
  brokerName: string
  brokerBrandInfo: BrandInfo
}

export interface TransferFinishedPayload {
  status: 'success'
  txId: string
  fromAddress: string
  toAddress: string
  symbol: string
  amount: number
  networkId: string
}

export interface IntegrationAccessToken {
  accountId: string
  accountName: string
  accessToken: string
  brokerType: BrokerType
  brokerName: string
}

export interface WagmiInjectedConnectorData {
  id: string
  name: string
  type: string
  icon?: string
  uid: string
}

export interface LinkOptions {
  /**
   * Client ID that can be obtained at https://dashboard.meshconnect.com/company/keys
   */
  clientId: string

  /**
   * A callback function that is called when an integration is successfully connected.
   * It receives a payload of type `LinkPayload`.
   */
  onIntegrationConnected: (payload: LinkPayload) => void

  /**
   * (Optional) A callback function that is called when the Front iframe is closed.
   */
  onExit?: (error?: string, summary?: SessionSymmary) => void

  /**
   * (Optional) A callback function that is called when a transfer is finished.
   * It receives a payload of type `TransferFinishedPayload`.
   */
  onTransferFinished?: (payload: TransferFinishedPayload) => void

  /**
   * (Optional) A callback function that is called when various events occur within the Front iframe.
   * It receives an object with type `LinkEventTypeKeys` indicating the event, and an optional 'payload' containing additional data.
   */
  onEvent?: (event: LinkEventType) => void

  /**
   * (Optional) An array of integration access tokens.
   * These access tokens are used to initialize crypto transfers flow at 'Select asset step'
   */
  accessTokens?: IntegrationAccessToken[]

  /**
   * (Optional) An array of integration access tokens.
   * Can be used to initialize the crypto transfers flow as an alternative to the target addresses.
   */
  transferDestinationTokens?: IntegrationAccessToken[]

  // /**
  //  * (Optional) An array of Wagmi injected connector data. React hook
  //  * It should send this list directly to our iframe.
  //  */
  // injectedConnectors?: WagmiInjectedConnectorData[]

  // /**
  //  * (Optional) An array of Wagmi injected connector data. VanillaJS
  //  * It should send this list directly to our iframe.
  //  */
  // injectedCoreConnectors?: WagmiInjectedConnectorData[]

  // /**
  //  * (Optional) An array of full Wagmi injected connector data. VanillaJS
  //  * Use this connector data to reconnect during the transfer flow.
  //  */
  // allInjectedCoreConnectorData?: Connector[]
}

export interface LinkStyle {
  ir: number
  io: number
}

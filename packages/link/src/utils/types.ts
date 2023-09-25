import type { BrokerType } from '@front-finance/api'
import { FrontEventType } from './event-types'

export type EventType =
  | 'brokerageAccountAccessToken'
  | 'delayedAuthentication'
  | 'close'
  | 'done'
  | 'loaded'
  | 'oauthLinkOpen'
  | 'transferFinished'

export interface FrontConnection {
  /**
   * @deprecated (Obsolete) A function that takes iFrameUrl parameter from `/api/v1/cataloglink` endpoint as an input, and opens the Link UI popup
   */
  openPopup: (iframeLink: string) => Promise<void>
  /**
   * A function that takes linkToken parameter from `/api/v1/linktoken` endpoint as an input, and opens the Link UI popup
   */
  openLink: (linkToken: string) => Promise<void>
  /**
   * @deprecated (Obsolete) A function to close Link UI popup
   */
  closePopup: () => void
  /**
   * A function to close Link UI popup
   */
  closeLink: () => void
}

export interface BrokerAccountToken {
  account: BrokerAccount
  accessToken: string
  refreshToken?: string
}

export interface BrokerAccount {
  accountId: string
  accountName: string
  fund?: number
  cash?: number
  isReconnected?: boolean
}

export interface BrokerBrandInfo {
  brokerLogo: string
  brokerPrimaryColor?: string
}

export interface FrontPayload {
  accessToken?: AccessTokenPayload
  delayedAuth?: DelayedAuthPayload
}

export interface AccessTokenPayload {
  accountTokens: BrokerAccountToken[]
  brokerBrandInfo: BrokerBrandInfo
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
  brokerBrandInfo: BrokerBrandInfo
}

export interface TransferFinishedSuccessPayload {
  status: 'success'
  txId: string
  fromAddress: string
  toAddress: string
  symbol: string
  amount: number
  networkId: string
}

export interface TransferFinishedErrorPayload {
  status: 'error'
  errorMessage: string
}

export type TransferFinishedPayload =
  | TransferFinishedSuccessPayload
  | TransferFinishedErrorPayload

export interface IntegrationAccessToken {
  accountId: string
  accountName: string
  accessToken: string
  brokerType: BrokerType
  brokerName: string
}

export interface FrontOptions {
  /**
   * Client ID that can be obtained at https://dashboard.getfront.com/company/keys
   */
  clientId: string

  /**
   * A callback function that is called when an integration is succesfully connected.
   * It receives a payload of type `FrontPayload`.
   */
  onBrokerConnected: (payload: FrontPayload) => void

  /**
   * (Optional) A callback function that is called when the Front iframe is closed.
   */
  onExit?: (error?: string) => void

  /**
   * (Optional) A callback function that is called when a transfer is finished.
   * It receives a payload of type `TransferFinishedPayload`.
   */
  onTransferFinished?: (payload: TransferFinishedPayload) => void

  /**
   * (Optional) A callback function that is called when various events occur within the Front iframe.
   * It receives an object with type `FrontEventTypeKeys` indicating the event, and an optional 'payload' containing additional data.
   */
  onEvent?: (event: FrontEventType) => void

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
}

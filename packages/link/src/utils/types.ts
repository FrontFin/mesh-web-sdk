import type { BrokerType } from '@front-finance/api'

export type EventType =
  | 'brokerageAccountAccessToken'
  | 'delayedAuthentication'
  | 'close'
  | 'done'
  | 'loaded'
  | 'oauthLinkOpen'
  | 'transferFinished'

export interface FrontConnection {
  openPopup: (iframeLink: string) => Promise<void>
  closePopup: () => void
}

export interface SetTitleEvent {
  type: 'setTitle'
  title: string
  hideTitle?: boolean
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
  clientId: string
  onBrokerConnected: (payload: FrontPayload) => void
  onExit?: (error?: string) => void

  /**
   * (Optional) A callback function that is called when a transfer is finished.
   * It receives a payload of type `TransferFinishedPayload`.
   */
  onTransferFinished?: (payload: TransferFinishedPayload) => void

  /**
   * (Optional) An array of integration access tokens.
   * These access tokens are used to initialize crypto transfers flow at 'Select asset step'
   */
  accessTokens?: IntegrationAccessToken[]
}

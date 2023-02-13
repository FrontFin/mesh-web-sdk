import type { BrokerType } from '@front/api'

export type EventType =
  | 'brokerageAccountAccessToken'
  | 'delayedAuthentication'
  | 'close'
  | 'done'
  | 'loaded'
  | 'oauthLinkOpen'

export interface FrontConnection {
  openLink: (authLink: string) => Promise<void>
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

export interface FrontOptions {
  clientId: string
  onBrokerConnected: (payload: FrontPayload) => void
  onExit?: (error?: string) => void
}

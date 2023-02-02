export type EventType =
  | 'brokerageAccountAccessToken'
  | 'delayedAuthentication'
  | 'close'
  | 'done'
  | 'loaded'

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

export enum BrokerType {
  Robinhood = 'robinhood',
  Coinbase = 'coinbase',
  ETrade = 'eTrade',
  TdAmeritrade = 'tdAmeritrade',
  Alpaca = 'alpaca',
  WeBull = 'weBull',
  Stash = 'stash',
  InteractiveBrokers = 'interactiveBrokers',
  Public = 'public',
  Kraken = 'kraken',
  CoinbasePro = 'coinbasePro',
  CryptoCom = 'cryptoCom',
  BinanceUs = 'binanceUs',
  EToro = 'etoro',
  FtxUs = 'ftxUs',
  Gemini = 'gemini',
  Uphold = 'uphold',
  OkCoin = 'okCoin',
  Bittrex = 'bittrex',
  KuCoin = 'kuCoin',
  OpenSea = 'openSea',
  CexIo = 'cexIo',
  BinanceInternational = 'binanceInternational',
  Bitstamp = 'bitstamp',
  GateIo = 'gateIo',
  Celsius = 'celsius',
  Acorns = 'acorns',
  Okx = 'okx',
  Coinlist = 'coinlist',
  BitFlyer = 'bitFlyer',

  Plaid = 'plaid'
}

export type AllBrokerTypes =
  | BrokerType
  | 'cryptocurrencyAddress'
  | 'cryptocurrencyWallet'
  | 'custom'

export interface FrontPayload {
  accessToken?: AccessTokenPayload
  delayedAuth?: DelayedAuthPayload
}

export interface AccessTokenPayload {
  accountTokens: BrokerAccountToken[]
  brokerBrandInfo: BrokerBrandInfo
  expiresInSeconds?: number
  refreshTokenExpiresInSeconds?: number
  brokerType: AllBrokerTypes
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

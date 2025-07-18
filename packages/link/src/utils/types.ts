import type { BrokerType } from '@meshconnect/node-api'
import { SessionSummary, LinkEventType } from './event-types'

export type EventType =
  | 'brokerageAccountAccessToken'
  | 'delayedAuthentication'
  | 'loaded'
  | 'transferFinished'

export interface Link {
  /**
   * A function that takes linkToken parameter from `/api/v1/linktoken` endpoint as an input, and opens the Link UI popup
   * @param linkToken - Base64 encoded link token from the `/api/v1/linktoken` endpoint
   * @param customIframeId - Optional custom ID for the existing iframe element. If not provided, a new iframe element will be created
   */
  openLink: (linkToken: string, customIframeId?: string) => void
  /**
   * A function to close Link UI popup
   */
  closeLink: () => void
}

export interface AccountToken {
  account: Account
  accessToken: string
  refreshToken?: string
  tokenId?: string
}

export interface Account {
  accountId: string
  accountName: string
  fund?: number
  cash?: number
  isReconnected?: boolean
}

/**
 * Integration brand information
 */
export interface BrandInfo {
  /**
   * Integration logo in base 64 format
   */
  brokerLogo: string
  /**
   * Integration logo URL (obsolete, use `logoLightUrl` instead)
   */
  brokerLogoUrl?: string
  /**
   * Integration logo URL for light theme
   */
  logoLightUrl?: string
  /**
   * Integration logo URL for dark theme
   */
  logoDarkUrl?: string
  /**
   * Integration icon URL for light theme
   */
  iconLightUrl?: string
  /**
   * Integration icon URL for dark theme
   */
  iconDarkUrl?: string
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
  amountInFiat?: number
  totalAmountInFiat?: number
  networkName?: string
  txHash?: string
  transferId?: string
  refundAddress?: string
}

export interface IntegrationAccessToken {
  accountId: string
  accountName: string
  accessToken: string
  brokerType: BrokerType
  brokerName: string
}

// payloads from Link
export interface WalletBrowserPayload {
  networkType?: string
  integrationName: string
  targetChainId?: string
  walletName?: string
}

export interface SignRequestPayload {
  address: string
  message: string
  walletName?: string
}

export interface ChainSwitchPayload {
  chainId: number
  networkType?: string
  walletName?: string
}

export interface TransferPayload {
  toAddress: string
  amount: number
  decimalPlaces: number
  chainId: number
  account: string
  network: string
  blockhash?: string
  walletName?: string
  gasLimit?: number | null
  maxFeePerGas?: number | null
  maxPriorityFeePerGas?: number | null
}

export interface SmartContractPayload {
  address: string
  abi: string
  functionName: string
  args: unknown[]
  account: string
  value?: string
  walletName?: string
  tokenProgram?: string
  blockhash?: string
  createATA?: boolean
  gasLimit?: number | null
  maxFeePerGas?: number | null
  maxPriorityFeePerGas?: number | null
}

export interface TransactionBatchPayload {
  version: string
  from: string
  chainId: string
  atomicRequired: boolean
  calls: {
    to: string
    value: string
    data?: string
  }[]
}

export interface WalletCapabilitiesPayload {
  from: string
  chainId: string
}

export interface DisconnectPayload {
  networkType?: string
  walletName?: string
}

export interface AddressLookupTableStateDto {
  deactivationSlot: bigint
  lastExtendedSlot: number
  lastExtendedStartIndex: number
  key: string
  authority?: string
  addresses: string[]
}

export interface SolanaTransferWithInstructionsPayload {
  transactionInstructions: {
    states: AddressLookupTableStateDto[]
    instructions: TransactionInstructionDto[]
    account: string
    blockhash: string
    walletName?: string
    network?: string
  }
  transferConfig: SmartContractPayload
}

export interface SolanaAccountMeta {
  shouldFillPubkey: boolean
  pubKey: string | null
  isWritable: boolean
  isSigner: boolean
}

export interface TransactionInstructionDto {
  programId: string
  accounts: SolanaAccountMeta[]
  data: string
}

export interface LinkOptions {
  /**
   * Client ID that can be obtained at https://dashboard.meshconnect.com/company/keys
   */
  clientId?: string

  /**
   * A callback function that is called when an integration is successfully connected.
   * It receives a payload of type `LinkPayload`.
   */
  onIntegrationConnected: (payload: LinkPayload) => void

  /**
   * (Optional) A callback function that is called when the Front iframe is closed.
   */
  onExit?: (error?: string, summary?: SessionSummary) => void

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

  /**
   * Link UI language. Supported: 'en', 'ru'. Can be set as 'en-US', 'ru-RU', etc.
   */
  language?: string
}

export interface LinkStyle {
  ir: number
  io: number
}

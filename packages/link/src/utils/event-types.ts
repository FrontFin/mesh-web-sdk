import { LinkPayload, TransferFinishedPayload } from './types'

export type LinkEventType =
  | IntegrationConnected
  | IntegrationConnectionError
  | TransferCompleted
  | IntegrationSelected
  | IntegrationInjectedWalletSelected
  | IntegrationChainSwitchRequest
  | CredentialsEntered
  | TransferStarted
  | TransferPreviewed
  | TransferPreviewError
  | TransferExecutionError
  | PageLoaded
  | IntegrationMfaRequired
  | IntegrationMfaEntered
  | IntegrationOAuthStarted
  | IntegrationAccountSelectionRequired
  | TransferAssetSelected
  | TransferNetworkSelected
  | TransferAmountEntered
  | TransferBalanceRequest
  | TransferInjectedRequest
  | TransferMfaRequired
  | TransferMfaEntered
  | TransferKycRequired
  | DoneEvent
  | CloseEvent

const LINK_EVENT_TYPE_KEYS = [
  'integrationConnected',
  'integrationConnectionError',
  'integrationMfaRequired',
  'integrationMfaEntered',
  'integrationOAuthStarted',
  'integrationAccountSelectionRequired',
  'transferCompleted',
  'integrationSelected',
  'integrationInjectedWalletSelected',
  'integrationChainSwitchRequest',
  'credentialsEntered',
  'transferStarted',
  'transferPreviewed',
  'transferPreviewError',
  'transferExecutionError',
  'pageLoaded',
  'transferAssetSelected',
  'transferBalanceRequest',
  'transferInjectedRequest',
  'transferNetworkSelected',
  'transferAmountEntered',
  'transferMfaRequired',
  'transferMfaEntered',
  'transferKycRequired',
  'done',
  'close'
] as const

export type LinkEventTypeKeys = (typeof LINK_EVENT_TYPE_KEYS)[number]

export function isLinkEventTypeKey(key: string): key is LinkEventTypeKeys {
  return LINK_EVENT_TYPE_KEYS.includes(key as LinkEventTypeKeys)
}

interface LinkEventBase {
  type: LinkEventTypeKeys
}

export interface PageLoaded {
  type: 'pageLoaded'
}

export interface IntegrationConnected extends LinkEventBase {
  type: 'integrationConnected'
  payload: LinkPayload
}

export interface IntegrationConnectionError extends LinkEventBase {
  type: 'integrationConnectionError'
  payload: {
    errorMessage: string
  }
}

export interface TransferCompleted extends LinkEventBase {
  type: 'transferCompleted'
  payload: TransferFinishedPayload
}
export interface IntegrationChainSwitchRequest extends LinkEventBase {
  type: 'integrationChainSwitchRequest'
  payload: {
    chainId: number
  }
}

export interface TransferInjectedRequest extends LinkEventBase {
  type: 'transferInjectedRequest'
  payload: {
    amount: number
    toAddress: string
    decimalPlaces: number
    chainId: number
    account: string
  }
}

export interface IntegrationInjectedWalletSelected extends LinkEventBase {
  type: 'integrationInjectedWalletSelected'
  payload: {
    integrationType: string
    integrationName: string
  }
}

export interface TransferBalanceRequest extends LinkEventBase {
  type: 'transferBalanceRequest'
  payload: {
    account: string
    chainId: number
  }
}

export interface IntegrationSelected extends LinkEventBase {
  type: 'integrationSelected'
  payload: {
    integrationType: string
    integrationName: string
  }
}

export interface CredentialsEntered extends LinkEventBase {
  type: 'credentialsEntered'
}

export interface TransferStarted extends LinkEventBase {
  type: 'transferStarted'
}

export interface TransferPreviewed extends LinkEventBase {
  type: 'transferPreviewed'
  payload: {
    amount: number
    symbol: string
    toAddress: string
    networkId: string
    previewId: string
    networkName?: string
    amountInFiat?: number
    estimatedNetworkGasFee?: {
      fee?: number
      feeCurrency?: string
      feeInFiat?: number
    }
  }
}

export interface TransferPreviewError extends LinkEventBase {
  type: 'transferPreviewError'
  payload: {
    errorMessage: string
  }
}

export interface TransferExecutionError extends LinkEventBase {
  type: 'transferExecutionError'
  payload: {
    errorMessage: string
  }
}

export interface IntegrationMfaRequired extends LinkEventBase {
  type: 'integrationMfaRequired'
}

export interface IntegrationMfaEntered extends LinkEventBase {
  type: 'integrationMfaEntered'
}

export interface IntegrationOAuthStarted extends LinkEventBase {
  type: 'integrationOAuthStarted'
}

export interface IntegrationAccountSelectionRequired extends LinkEventBase {
  type: 'integrationAccountSelectionRequired'
}

export interface TransferAssetSelected extends LinkEventBase {
  type: 'transferAssetSelected'
  payload: {
    symbol: string
  }
}

export interface TransferNetworkSelected extends LinkEventBase {
  type: 'transferNetworkSelected'
  payload: {
    id: string
    name: string
  }
}

export interface TransferAmountEntered extends LinkEventBase {
  type: 'transferAmountEntered'
}

export interface TransferMfaRequired extends LinkEventBase {
  type: 'transferMfaRequired'
}

export interface TransferMfaEntered extends LinkEventBase {
  type: 'transferMfaEntered'
}

export interface TransferKycRequired extends LinkEventBase {
  type: 'transferKycRequired'
}

export interface DoneEvent extends LinkEventBase {
  type: 'done'
  payload: SessionSymmary
}

export interface CloseEvent extends LinkEventBase {
  type: 'close'
  payload: SessionSymmary
}

export interface SessionSymmary {
  /**
   *   Current page of application. Possible values:
   * `startPage`
   * `integrationsCatalogPage`
   * `integrationLoginPage`
   * `integrationMfaPage`
   * `integrationAccountSelectPage`
   * `integrationConnectedPage`
   * `errorPage`
   * `transferKycPage`
   * `transferHoldingSelectionPage`
   * `transferNetworkSelectionPage`
   * `transferAmountSelectionPage`
   * `transferPreviewPage`
   * `transferMfaPage`
   * `transferFundingPage`
   * `transferExecutedPage`
   * `termsAndConditionPage`
   *
   * This list may change in future.
   */
  page: string
  /** Selected integration */
  selectedIntegration?: {
    id?: string
    name?: string
  }
  /** Transfer information */
  transfer?: {
    previewId?: string
    symbol?: string
    amount?: number
    amountInFiat?: number
    transactionId?: string
    networkId?: string
  }
  errorMessage?: string
}

export type WalletBrowserEventType =
  | WalletBrowserInjectedWalletSelected
  | WalletBrowserChainSwitchRequest
  | WalletBrowserTransferBalanceRequest
  | WalletBrowserNativeTransferRequest
  | WalletBrowserNonNativeTransferRequest
  | WalletBrowserNativeSmartDeposit
  | WalletBrowserNonNativeSmartDeposit
  | WalletBrowserDisconnect

const WALLET_BROWSER_EVENT_TYPE_KEYS = [
  'walletBrowserInjectedWalletSelected',
  'walletBrowserChainSwitchRequest',
  'walletBrowserTransferBalanceRequest',
  'walletBrowserNativeTransferRequest',
  'walletBrowserNonNativeTransferRequest',
  'walletBrowserNativeSmartDeposit',
  'walletBrowserNonNativeSmartDeposit',
  'walletBrowserDisconnect'
] as const

export type WalletBrowserEventTypeKeys =
  (typeof WALLET_BROWSER_EVENT_TYPE_KEYS)[number]

export function isWalletBrowserEventTypeKey(
  key: string
): key is WalletBrowserEventTypeKeys {
  return WALLET_BROWSER_EVENT_TYPE_KEYS.includes(
    key as WalletBrowserEventTypeKeys
  )
}

interface WalletBrowserEventBase {
  type: WalletBrowserEventTypeKeys
}

export interface WalletBrowserInjectedWalletSelected
  extends WalletBrowserEventBase {
  type: 'walletBrowserInjectedWalletSelected'
  payload: {
    integrationName: string
  }
}

export interface WalletBrowserChainSwitchRequest
  extends WalletBrowserEventBase {
  type: 'walletBrowserChainSwitchRequest'
  payload: {
    chainId: number
  }
}

export interface WalletBrowserTransferBalanceRequest
  extends WalletBrowserEventBase {
  type: 'walletBrowserTransferBalanceRequest'
  payload: {
    account: string
    chainId: number
  }
}

export interface WalletBrowserNativeTransferRequest
  extends WalletBrowserEventBase {
  type: 'walletBrowserNativeTransferRequest'
  payload: {
    toAddress: string
    amount: number
    decimalPlaces: number
    chainId: number
    account: string
  }
}

interface SmartContractPayload {
  address: string
  abi: string
  functionName: string
  args: any[]
  value?: bigint
}

export interface WalletBrowserNonNativeTransferRequest
  extends WalletBrowserEventBase {
  type: 'walletBrowserNonNativeTransferRequest'
  payload: SmartContractPayload
}

export interface WalletBrowserNativeSmartDeposit
  extends WalletBrowserEventBase {
  type: 'walletBrowserNativeSmartDeposit'
  payload: SmartContractPayload
}

export interface WalletBrowserNonNativeSmartDeposit
  extends WalletBrowserEventBase {
  type: 'walletBrowserNonNativeSmartDeposit'
  payload: SmartContractPayload
}

export interface WalletBrowserDisconnect extends WalletBrowserEventBase {
  type: 'walletBrowserDisconnect'
}

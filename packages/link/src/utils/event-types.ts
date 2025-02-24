import { LinkPayload, TransferFinishedPayload } from './types'

export type LinkEventType =
  | IntegrationConnected
  | IntegrationConnectionError
  | TransferCompleted
  | IntegrationSelected
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
  | TransferMfaRequired
  | TransferMfaEntered
  | TransferKycRequired
  | TransferInitiated
  | TransferExecuted
  | TransferNoEligibleAssets
  | WalletMessageSigned
  | DoneEvent
  | CloseEvent
  | VerifyWalletRejected
  | VerifyDonePage
  | SDKinjectedWalletProviders

const LINK_EVENT_TYPE_KEYS = [
  'integrationConnected',
  'integrationConnectionError',
  'integrationMfaRequired',
  'integrationMfaEntered',
  'integrationOAuthStarted',
  'integrationAccountSelectionRequired',
  'transferCompleted',
  'integrationSelected',
  'credentialsEntered',
  'transferStarted',
  'transferPreviewed',
  'transferPreviewError',
  'transferExecutionError',
  'pageLoaded',
  'transferAssetSelected',
  'transferNetworkSelected',
  'transferAmountEntered',
  'transferMfaRequired',
  'transferMfaEntered',
  'transferKycRequired',
  'transferExecuted',
  'transferInitiated',
  'transferNoEligibleAssets',
  'walletMessageSigned',
  'verifyDonePage',
  'verifyWalletRejected',
  'connectionDeclined',
  'transferConfigureError',
  'connectionUnavailable',
  'transferDeclined',
  'done',
  'close',
  'SDKinjectedWalletProviders'
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

export interface TransferInitiated extends LinkEventBase {
  type: 'transferInitiated'
  payload: {
    integrationType?: string
    integrationName: string
    status: 'pending'
  }
}

export interface TransferExecuted extends LinkEventBase {
  type: 'transferExecuted'
  payload: {
    status: 'success' | 'pending'
    txId: string
    fromAddress: string
    toAddress: string
    symbol: string
    amount: number
    networkId: string
  }
}

export interface TransferNoEligibleAssets extends LinkEventBase {
  type: 'transferNoEligibleAssets'
  payload: {
    integrationType?: string
    integrationName: string
    noAssetsType?: string
    arrayOfTokensHeld: {
      symbol: string
      amount: number
      amountInFiat?: number
      ineligibilityReason?: string
    }[]
  }
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

export interface WalletMessageSigned extends LinkEventBase {
  type: 'walletMessageSigned'
  payload: {
    signedMessageHash: string | undefined
    message: string | undefined
    address: string
    timeStamp: number
    isVerified: boolean
  }
}

export interface VerifyDonePage extends LinkEventBase {
  type: 'verifyDonePage'
}

export interface VerifyWalletRejected extends LinkEventBase {
  type: 'verifyWalletRejected'
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

export interface SDKinjectedWalletProviders extends LinkEventBase {
  type: 'SDKinjectedWalletProviders'
  payload: Array<{
    icon?: string
    id: string
    name: string
  }>
}

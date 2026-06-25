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
  | TransferConfigureError
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
  | LegalTermsViewed
  | SeeWhatHappenedClicked
  | FundingOptionsUpdated
  | FundingOptionsViewed
  | GasIncreaseWarning
  | ExecuteFundingStep
  | LinkTransferQrGenerated
  | HomePageMethodSelected
  | ConnectionUnavailable
  | ConnectionDeclined
  | TransferDeclined
  | DefiWalletError
  | PaypalComplianceDeclined
  | HomePageLoaded

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
  'transferConfigureError',
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
  'connectionUnavailable',
  'transferDeclined',
  'done',
  'close',
  'SDKinjectedWalletProviders',
  'legalTermsViewed',
  'seeWhatHappenedClicked',
  'executeFundingStep',
  'fundingOptionsUpdated',
  'fundingOptionsViewed',
  'gasIncreaseWarning',
  'linkTransferQRGenerated',
  'methodSelected',
  'defiWalletError',
  'paypalComplianceDeclined',
  'homePageLoaded'
] as const

export type LinkEventTypeKeys = (typeof LINK_EVENT_TYPE_KEYS)[number]

export function isLinkEventTypeKey(key: string): key is LinkEventTypeKeys {
  return LINK_EVENT_TYPE_KEYS.includes(key as LinkEventTypeKeys)
}

interface LinkEventBase {
  type: LinkEventTypeKeys
}

export type Pages =
  | 'startPage'
  | 'integrationsCatalogPage'
  | 'integrationLoginPage'
  | 'integrationMfaPage'
  | 'integrationAccountSelectPage'
  | 'integrationConnectedPage'
  | 'errorPage'
  | 'accessDeniedPage'
  | 'transferKycPage'
  | 'setupMfaPage'
  | 'transferInsufficientBalancePage'
  | 'transferHoldingSelectionPage'
  | 'transferNetworkSelectionPage'
  | 'transferAmountSelectionPage'
  | 'transferPreviewPage'
  | 'transferAddressWhitelistPage'
  | 'transferMfaPage'
  | 'transferFundingPage'
  | 'transferExecutedPage'
  | 'termsAndConditionPage'
  | 'transferKycRobinhooPage'
  | 'generateKeyPage'
  | 'fundingHoldingSelectionPage'
  | 'verifyAddressPage'
  | 'verifyDonePage'
  | 'sessionExpiredPage'
  | 'externalTransferSelectAddressPage'
  | 'homePage'

export type AssetIneligibilityReason =
  | 'noEligibleNetworks'
  | 'symbolDoesNotMatch'
  | 'notSupportedForTransferByTarget'
  | 'notSupportedForTransferBySource'
  | 'eligibleWithFunding'
  | 'amountNotSufficient'

export type NetworkIneligibilityReason =
  | 'gasFeeAssetBalanceNotEnough'
  | 'gasFeeAssetAndBalanceNotEnough'
  | 'noTargetNetworkFound'
  | 'refusedByInstitution'
  | 'eligibleWithFunding'
  | 'balanceBelowRequestedAmount'
  | 'requestedAmountBelowMinimum'
  | 'balanceBelowMinimum'
  | 'nyCoinbaseUserRestrictions'

export type NoAssetsType =
  | 'noAssets'
  | 'noEligibleAssets'
  | 'notEnoughAsset'
  | 'cannotFund'

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
    requestId?: string
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
    nativeLink?: string
    userSearched?: boolean
  }
}

export interface CredentialsEntered extends LinkEventBase {
  type: 'credentialsEntered'
}

export interface TransferStarted extends LinkEventBase {
  type: 'transferStarted'
  payload: {
    integrationType?: string
    integrationName: string
  }
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
    userId?: string
    clientTransactionId?: string
  }
}

export interface TransferNoEligibleAssets extends LinkEventBase {
  type: 'transferNoEligibleAssets'
  payload: {
    integrationType?: string
    integrationName: string
    noAssetsType?: NoAssetsType
    arrayOfTokensHeld: {
      symbol: string
      amount: number
      amountInFiat?: number
      ineligibilityReason?: AssetIneligibilityReason | NetworkIneligibilityReason
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
    fiatCurrency?: string
    integrationType?: string
    integrationName?: string
    estimatedNetworkGasFee?: {
      fee?: number
      feeCurrency?: string
      feeInFiat?: number
    }
  }
}

export type TransferPreviewedPayload = TransferPreviewed['payload']

export interface TransferPreviewError extends LinkEventBase {
  type: 'transferPreviewError'
  payload: {
    errorMessage: string
    requestId?: string
  }
}

export interface TransferExecutionError extends LinkEventBase {
  type: 'transferExecutionError'
  payload: {
    errorMessage: string
    requestId?: string
  }
}

export interface TransferConfigureError extends LinkEventBase {
  type: 'transferConfigureError'
  payload: {
    errorMessage: string
    requestId?: string
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

export interface ConnectionUnavailable extends LinkEventBase {
  type: 'connectionUnavailable'
  payload: {
    integrationType?: string
    integrationName: string
    reason: string
  }
}

export interface ConnectionDeclined extends LinkEventBase {
  type: 'connectionDeclined'
  payload: {
    integrationType?: string
    integrationName: string
    reason: string
    networkId?: string
    toAddress?: string
    errorMessage?: string
  }
}

export interface TransferDeclined extends LinkEventBase {
  type: 'transferDeclined'
  payload: {
    integrationType?: string
    integrationName: string
    toAddress?: string
    token?: string
    network?: string
    amount?: number
    status: string
  }
}

export interface DoneEvent extends LinkEventBase {
  type: 'done'
  payload: SessionSummary
}

export interface CloseEvent extends LinkEventBase {
  type: 'close'
  payload: SessionSummary
}

export interface WalletMessageSigned extends LinkEventBase {
  type: 'walletMessageSigned'
  payload: {
    signedMessageHash: string | undefined
    message: string | undefined
    address: string
    timeStamp: number
    isVerified: boolean
    verifiedAddresses?: string[]
  }
}

export interface DefiWalletError extends LinkEventBase {
  type: 'defiWalletError'
  payload: {
    integrationName: string
    errorType: 'timeout' | 'verifyMismatch'
    details: {
      requestedAddress?: string
      connectedAddress?: string
      requestedNetwork?: string
      connectedNetwork?: string
      connectUri?: string
    }
    timeStamp: number
  }
}

export interface PaypalComplianceDeclined extends LinkEventBase {
  type: 'paypalComplianceDeclined'
  payload: TransferPreviewedPayload
}

export interface VerifyDonePage extends LinkEventBase {
  type: 'verifyDonePage'
}

export interface VerifyWalletRejected extends LinkEventBase {
  type: 'verifyWalletRejected'
}

export interface SessionSummary {
  page: Pages
  selectedIntegration?: {
    id?: string
    name?: string
    integrationType?: string
    integrationName?: string
  }
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

export interface LegalTermsViewed {
  type: 'legalTermsViewed'
}

export interface SeeWhatHappenedClicked {
  type: 'seeWhatHappenedClicked'
}

export interface FundingOptionsUpdated {
  type: 'fundingOptionsUpdated'
}

export interface FundingOptionsViewed {
  type: 'fundingOptionsViewed'
}

export interface GasIncreaseWarning {
  type: 'gasIncreaseWarning'
}

export interface ExecuteFundingStep {
  type: 'executeFundingStep'
  payload: {
    cryptocurrencyFundingOptionType: string
    status: string
    errorMessage?: string
  }
}

export interface LinkTransferQrGenerated {
  type: 'linkTransferQRGenerated'
  payload: {
    token?: string
    network?: string
    toAddress?: string
    qrUrl?: string
  }
}

export interface HomePageMethodSelected {
  type: 'methodSelected'
  payload: {
    method: 'embedded' | 'manual' | 'buy'
  }
}

export interface HomePageLoaded extends LinkEventBase {
  type: 'homePageLoaded'
}

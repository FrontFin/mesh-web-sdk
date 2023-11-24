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

const LINK_EVENT_TYPE_KEYS = [
  'integrationConnected',
  'integrationConnectionError',
  'transferCompleted',
  'integrationSelected',
  'credentialsEntered',
  'transferStarted',
  'transferPreviewed',
  'transferPreviewError',
  'transferExecutionError',
  'pageLoaded'
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

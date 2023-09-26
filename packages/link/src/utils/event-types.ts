import { FrontPayload, TransferFinishedPayload } from './types'

export type FrontEventType =
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

const FRONT_EVENT_TYPE_KEYS = [
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

export type FrontEventTypeKeys = (typeof FRONT_EVENT_TYPE_KEYS)[number]

export function isFrontEventTypeKey(key: string): key is FrontEventTypeKeys {
  return FRONT_EVENT_TYPE_KEYS.includes(key as FrontEventTypeKeys)
}

interface FrontEventBase {
  type: FrontEventTypeKeys
}

export interface PageLoaded {
  type: 'pageLoaded'
}

export interface IntegrationConnected extends FrontEventBase {
  type: 'integrationConnected'
  payload: FrontPayload
}

export interface IntegrationConnectionError extends FrontEventBase {
  type: 'integrationConnectionError'
  payload: {
    errorMessage: string
  }
}

export interface TransferCompleted extends FrontEventBase {
  type: 'transferCompleted'
  payload: TransferFinishedPayload
}

export interface IntegrationSelected extends FrontEventBase {
  type: 'integrationSelected'
  payload: {
    integrationType: string
    integrationName: string
  }
}

export interface CredentialsEntered extends FrontEventBase {
  type: 'credentialsEntered'
}

export interface TransferStarted extends FrontEventBase {
  type: 'transferStarted'
}

export interface TransferPreviewed extends FrontEventBase {
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

export interface TransferPreviewError extends FrontEventBase {
  type: 'transferPreviewError'
  payload: {
    errorMessage: string
  }
}

export interface TransferExecutionError extends FrontEventBase {
  type: 'transferExecutionError'
  payload: {
    errorMessage: string
  }
}

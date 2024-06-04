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
  args: any[] // eslint-disable-line @typescript-eslint/no-explicit-any
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

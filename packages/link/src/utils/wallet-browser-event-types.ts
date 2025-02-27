export type WalletBrowserEventType =
  | WalletBrowserInjectedWalletSelected
  | WalletBrowserSignRequest
  | WalletBrowserChainSwitchRequest
  | WalletBrowserTransferBalanceRequest
  | WalletBrowserNativeTransferRequest
  | WalletBrowserNonNativeTransferRequest
  | WalletBrowserNativeSmartDeposit
  | WalletBrowserNonNativeSmartDeposit
  | WalletBrowserDisconnect

const WALLET_BROWSER_EVENT_TYPE_KEYS = [
  'walletBrowserInjectedWalletSelected',
  'walletBrowserSignRequest',
  'walletBrowserChainSwitchRequest',
  'walletBrowserTransferBalanceRequest',
  'walletBrowserNativeTransferRequest',
  'walletBrowserNonNativeTransferRequest',
  'walletBrowserNativeSmartDeposit',
  'walletBrowserNonNativeSmartDeposit',
  'walletBrowserDisconnect'
] as const

export type NetworkType =
  | 'unknown'
  | 'evm'
  | 'solana'
  | 'bitcoin'
  | 'cardano'
  | 'tron'
  | 'avalancheX'
  | 'tezos'
  | 'dogecoin'
  | 'ripple'
  | 'stellar'
  | 'litecoin'
  | 'sui'
  | 'aptos'
  | 'tvm'

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
    networkType?: string
    targetChainId?: number
  }
}

export interface WalletBrowserSignRequest extends WalletBrowserEventBase {
  type: 'walletBrowserSignRequest'
  payload: {
    address: `0x${string}`
    message: string
    walletName?: string
    networkType?: NetworkType
  }
}

export interface WalletBrowserChainSwitchRequest
  extends WalletBrowserEventBase {
  type: 'walletBrowserChainSwitchRequest'
  payload: {
    chainId: number
    networkType: NetworkType
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
    network: string
    blockhash?: string
    walletName?: string
  }
}

interface SmartContractPayload {
  address: string
  abi: string
  functionName: string
  args: unknown[]
  account: string
  value?: string
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
  payload?: {
    networkType?: NetworkType
    walletName?: string
  }
}

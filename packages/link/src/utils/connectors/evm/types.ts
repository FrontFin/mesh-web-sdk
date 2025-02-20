import { ethers } from 'ethers'
import { Eip1193Provider } from 'ethers'

export interface EVMConnectResult {
  accounts: string[]
  chainId: number
  isConnected: boolean
}

export interface EVMProvider extends ethers.Eip1193Provider {
  on(event: string, listener: (...args: any[]) => void): void
  removeListener(event: string, listener: (...args: any[]) => void): void
  removeAllListeners(): void
  [key: string]: any
}

export interface InjectedProviderInfo {
  name: string
  id: string
  icon?: string
  injectedData: {
    provider: EVMProvider
    [key: string]: any
  }
}

export interface ChainConfig {
  name: string
  nativeCurrency: {
    decimals: number
    name: string
    symbol: string
  }
  rpcUrls: {
    default: { http: string[] }
  }
  blockExplorers: {
    default: {
      name: string
      url: string
    }
  }
}

export interface EIP6963ProviderInfo {
  uuid: string
  name: string
  icon?: string
  rdns?: string
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo
  provider: Eip1193Provider
}

export interface EIP6963AnnounceProviderEvent extends CustomEvent {
  type: 'eip6963:announceProvider'
  detail: EIP6963ProviderDetail
}

export interface EIP6963RequestProviderEvent extends Event {
  type: 'eip6963:requestProvider'
}

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
}

export interface SmartContractPayload {
  address: string
  abi: string
  functionName: string
  args: unknown[]
  account: string
  value?: string
}

export interface DisconnectPayload {
  networkType?: string
  walletName?: string
}

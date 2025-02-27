import { ethers, Eip1193Provider } from 'ethers'

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

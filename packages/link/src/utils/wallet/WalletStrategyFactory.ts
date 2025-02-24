import { WalletStrategy } from './WalletStrategy'
import { EVMWalletStrategy } from './EVMWalletStrategy'
import { SolanaWalletStrategy } from './SolanaWalletStrategy'

export type NetworkType = 'evm' | 'solana'

export class WalletStrategyFactory {
  private static instance: WalletStrategyFactory
  private strategies: Map<NetworkType, WalletStrategy>

  private constructor() {
    this.strategies = new Map()
    this.strategies.set('evm', new EVMWalletStrategy())
    this.strategies.set('solana', new SolanaWalletStrategy())
  }

  public static getInstance(): WalletStrategyFactory {
    if (!WalletStrategyFactory.instance) {
      WalletStrategyFactory.instance = new WalletStrategyFactory()
    }
    return WalletStrategyFactory.instance
  }

  public getStrategy(networkType: NetworkType): WalletStrategy {
    const strategy = this.strategies.get(networkType)
    if (!strategy) {
      throw new Error(`No strategy found for network type: ${networkType}`)
    }
    return strategy
  }

  public getAllProviders() {
    const allProviders: {
      id: string
      type: string
      name?: string
      icon?: string
    }[] = []

    this.strategies.forEach(strategy => {
      allProviders.push(...strategy.getProviders())
    })

    return allProviders
  }
}

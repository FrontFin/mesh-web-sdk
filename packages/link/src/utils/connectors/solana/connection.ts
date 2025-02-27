import { SolanaConnectResult } from './types'
import { getSolanaProvider } from './providerDiscovery'
import { Buffer } from 'buffer'

if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer
}

export const connectToSolanaWallet = async (
  walletName: string
): Promise<SolanaConnectResult | Error> => {
  try {
    const provider = getSolanaProvider(walletName)

    if (provider.publicKey && provider.isConnected) {
      return {
        accounts: [provider.publicKey.toString()],
        chainId: '101',
        isConnected: true
      }
    }

    await provider
      .connect({ onlyIfTrusted: true })
      .catch(() => provider.connect())

    if (!provider.publicKey) {
      throw new Error(
        `${walletName} connection failed - no public key available`
      )
    }

    return {
      accounts: [provider.publicKey.toString()],
      chainId: '101',
      isConnected: true
    }
  } catch (error) {
    console.error('Solana wallet connection error:', error)
    return error instanceof Error
      ? error
      : new Error(`Failed to connect to ${walletName} wallet: ${error}`)
  }
}

export const disconnectFromSolanaWallet = async (
  walletName: string
): Promise<void | Error> => {
  try {
    const provider = getSolanaProvider(walletName)
    await provider.disconnect()
  } catch (error) {
    return error instanceof Error
      ? error
      : new Error(`Failed to disconnect from ${walletName} wallet`)
  }
}

import { Buffer } from 'buffer'
import { SolanaConnectResult } from './types'
import { getSolanaProvider } from './providerDiscovery'

// Ensure Buffer is available globally
if (typeof window !== 'undefined') {
  window.Buffer = window.Buffer || Buffer
}

export const connectToSolanaWallet = async (
  walletName: string,
  eagerConnect = true
): Promise<SolanaConnectResult | Error> => {
  try {
    const provider = getSolanaProvider(walletName)

    // For Trust Wallet, wait a bit to ensure provider is ready
    if (walletName.toLowerCase().includes('trust')) {
      await new Promise(resolve => setTimeout(resolve, 500))
    }

    // Check for existing connection first
    if (provider.publicKey && provider.isConnected) {
      return {
        accounts: [provider.publicKey.toString()],
        chainId: '101', // Solana mainnet
        isConnected: true
      }
    }

    // Try eager connect if requested and no existing connection
    if (eagerConnect) {
      try {
        const response = await provider.connect({ onlyIfTrusted: true })
        if (!response?.publicKey) {
          throw new Error('No publicKey in eager connect response')
        }
        return {
          accounts: [response.publicKey.toString()],
          chainId: '101', // Solana mainnet
          isConnected: true
        }
      } catch (error) {
        // Eager connect failed, continue to regular connect
      }
    }

    // Regular connect with user approval
    const response = await provider.connect()

    // Try getting publicKey from either the response or the provider
    const publicKey = response?.publicKey || provider.publicKey
    if (!publicKey) {
      throw new Error(
        `${walletName} connection succeeded but no publicKey was returned`
      )
    }

    return {
      accounts: [publicKey.toString()],
      chainId: '101',
      isConnected: true
    }
  } catch (error) {
    return error instanceof Error
      ? error
      : new Error(`Failed to connect to ${walletName} wallet`)
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

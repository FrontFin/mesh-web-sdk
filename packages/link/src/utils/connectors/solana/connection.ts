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

    // Try eager connect first, fall back to regular connect
    const response = await provider
      .connect({ onlyIfTrusted: true })
      .catch(() => provider.connect())

    // Handle Phantom wallet which returns response.publicKey
    if (response?.publicKey) {
      return {
        accounts: [response.publicKey.toString()],
        chainId: '101',
        isConnected: true
      }
    }

    // Handle other wallets that update provider.publicKey directly
    if (provider.publicKey) {
      return {
        accounts: [provider.publicKey.toString()],
        chainId: '101',
        isConnected: true
      }
    }

    throw new Error(`${walletName} connection failed - no public key returned`)
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

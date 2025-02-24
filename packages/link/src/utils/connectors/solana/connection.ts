import { SolanaConnectResult } from './types'
import { getSolanaProvider } from './providerDiscovery'

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

    const response = await provider.connect({ onlyIfTrusted: true }).catch(() =>
      // If eager connect fails, try regular connect
      provider.connect()
    )

    if (!response?.publicKey) {
      throw new Error(
        `${walletName} connection failed - no public key returned`
      )
    }

    return {
      accounts: [response.publicKey.toString()],
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

import bs58 from 'bs58'
import { getSolanaProvider } from './providerDiscovery'

export const signSolanaMessage = async (
  walletName: string,
  message: string
): Promise<string | Error> => {
  try {
    const provider = getSolanaProvider(walletName)
    const messageBytes = new TextEncoder().encode(message)
    const signedMessage = await provider.signMessage(messageBytes)
    return bs58.encode(signedMessage.signature)
  } catch (error) {
    return error instanceof Error
      ? error
      : new Error(`Failed to sign message with ${walletName} wallet`)
  }
}

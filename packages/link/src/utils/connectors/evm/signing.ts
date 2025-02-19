import { ethers } from 'ethers'
import { getActiveEVMProvider, getActiveRawProvider } from './provider'

export const signEVMMessage = async (
  walletName: string,
  address: string,
  message: string
): Promise<string | Error> => {
  try {
    const activeProvider = getActiveEVMProvider()
    const activeRawProvider = getActiveRawProvider()

    if (!activeProvider || !activeRawProvider) {
      throw new Error('No active EVM provider')
    }

    // Special handling for Rainbow wallet using personal_sign
    if (walletName.toLowerCase() === 'rainbow') {
      const messageHex = ethers.hexlify(ethers.toUtf8Bytes(message))
      const signature = await activeRawProvider.request({
        method: 'personal_sign',
        // EIP-191 standard order: address first, then message
        params: [address.toLowerCase(), messageHex]
      })
      return signature
    }

    // For other wallets, use ethers.js signing
    const provider = new ethers.BrowserProvider(activeRawProvider)
    const signer = await provider.getSigner(address)
    const signature = await signer.signMessage(message)
    return signature
  } catch (error) {
    console.error('EVM message signing error:', error)
    return error instanceof Error
      ? error
      : new Error(`Failed to sign message with ${walletName} wallet`)
  }
}

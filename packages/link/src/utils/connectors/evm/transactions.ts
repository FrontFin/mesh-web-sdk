import { ethers } from 'ethers'
import { getActiveRawProvider } from './provider'

const isUserRejection = (error: any): boolean => {
  if (!error) return false

  // Check for various wallet rejection patterns
  const message = error.message?.toLowerCase() || ''
  return (
    error.code === 4001 || // Standard EIP-1193 user rejection code
    message.includes('user rejected') ||
    message.includes('user denied') ||
    message.includes('user cancelled') ||
    message.includes('declined')
  )
}

/**
 * Sends a native EVM transaction
 */
export const sendEVMTransaction = async (
  toAddress: string,
  amount: bigint,
  fromAddress: string
): Promise<string | Error> => {
  try {
    const activeRawProvider = getActiveRawProvider()
    if (!activeRawProvider) {
      throw new Error('No active EVM provider')
    }

    // Get current chain ID before transaction
    const chainIdHex = await activeRawProvider.request({
      method: 'eth_chainId'
    })
    const chainId = parseInt(chainIdHex, 16)

    // Create a new provider instance for this transaction
    const provider = new ethers.BrowserProvider(activeRawProvider)
    const signer = await provider.getSigner(fromAddress)

    // Verify we're still on the same network before proceeding
    const network = await provider.getNetwork()
    if (Number(network.chainId) !== chainId) {
      throw new Error('Network changed during transaction setup')
    }

    try {
      const tx = await signer.sendTransaction({
        to: toAddress,
        value: amount
      })

      const receipt = await tx.wait()
      return receipt ? receipt.hash : ''
    } catch (txError: any) {
      if (isUserRejection(txError)) {
        return new Error('Transaction was rejected by user')
      }
      throw txError
    }
  } catch (error: any) {
    console.error('Transaction error:', error)

    if (isUserRejection(error)) {
      return new Error('Transaction was rejected by user')
    }

    if (error.code === 'NETWORK_ERROR') {
      return new Error('Network changed during transaction. Please try again.')
    }

    return error instanceof Error
      ? error
      : new Error('Failed to send transaction')
  }
}

/**
 * Sends an EVM token transaction
 */
export const sendEVMTokenTransaction = async (
  contractAddress: string,
  abi: ethers.InterfaceAbi,
  functionName: string,
  args: unknown[],
  fromAddress: string,
  value?: bigint
): Promise<string | Error> => {
  try {
    const activeRawProvider = getActiveRawProvider()
    if (!activeRawProvider) {
      throw new Error('No active EVM provider')
    }

    const chainIdHex = await activeRawProvider.request({
      method: 'eth_chainId'
    })
    const chainId = parseInt(chainIdHex, 16)

    const provider = new ethers.BrowserProvider(activeRawProvider)
    const signer = await provider.getSigner(fromAddress)

    // Verify we're still on the same network before proceeding
    const network = await provider.getNetwork()
    if (Number(network.chainId) !== chainId) {
      throw new Error('Network changed during transaction setup')
    }

    const contract = new ethers.Contract(contractAddress, abi, signer)
    const txOptions: ethers.Overrides = {}

    const feeData = await provider.getFeeData()

    txOptions.gasPrice = feeData.gasPrice
      ? (feeData.gasPrice * BigInt(120)) / BigInt(100)
      : undefined

    if (value) {
      txOptions.value = value
    }

    try {
      // Send the transaction
      const tx = await contract[functionName](...args, txOptions)

      // Wait for transaction confirmation
      const receipt = await tx.wait()
      return receipt ? receipt.hash : ''
    } catch (txError: any) {
      if (isUserRejection(txError)) {
        return new Error('Transaction was rejected by user')
      }
      throw txError
    }
  } catch (error: any) {
    console.error('Token transaction error:', error)

    if (isUserRejection(error)) {
      return new Error('Transaction was rejected by user')
    }

    if (error.code === 'NETWORK_ERROR') {
      return new Error('Network changed during transaction. Please try again.')
    }

    return error instanceof Error
      ? error
      : new Error('Failed to send token transaction')
  }
}

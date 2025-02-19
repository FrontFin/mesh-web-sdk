import { ethers } from 'ethers'
import { getActiveRawProvider } from './provider'

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
    console.log('Signer:', signer)
    console.log('Provider:', provider)

    // Verify we're still on the same network before proceeding
    const network = await provider.getNetwork()
    if (Number(network.chainId) !== chainId) {
      throw new Error('Network changed during transaction setup')
    }

    console.log('Sending native transaction:', {
      toAddress,
      amount: amount.toString(),
      chainId,
      fromAddress
    })

    const tx = await signer.sendTransaction({
      to: toAddress,
      value: amount
    })

    console.log('Transaction sent:', tx.hash)

    const receipt = await tx.wait()
    console.log('Transaction confirmed:', receipt?.hash)

    return receipt ? receipt.hash : ''
  } catch (error: any) {
    console.error('Transaction error:', error)

    // Check for specific error types
    if (error.code === 'NETWORK_ERROR') {
      return new Error('Network changed during transaction. Please try again.')
    } else if (error.code === 4001) {
      return new Error('Transaction rejected by user')
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

    console.log('Sending token transaction:', {
      contractAddress,
      functionName,
      chainId,
      fromAddress
    })

    const contract = new ethers.Contract(contractAddress, abi, signer)
    const txOptions: ethers.Overrides = {}

    const feeData = await provider.getFeeData()

    txOptions.gasPrice = feeData.gasPrice
      ? (feeData.gasPrice * BigInt(120)) / BigInt(100)
      : undefined

    if (value) {
      txOptions.value = value
    }

    // Send the transaction
    const tx = await contract[functionName](...args, txOptions)
    console.log('Transaction sent:', tx.hash)

    // Wait for transaction confirmation
    const receipt = await tx.wait()
    console.log('Transaction confirmed:', receipt.hash)

    return receipt ? receipt.hash : ''
  } catch (error: any) {
    console.error('Token transaction error:', error)

    // Check for specific error types
    if (error.code === 'NETWORK_ERROR') {
      return new Error('Network changed during transaction. Please try again.')
    } else if (error.code === 4001) {
      return new Error('Transaction rejected by user')
    }

    return error instanceof Error
      ? error
      : new Error('Failed to send token transaction')
  }
}

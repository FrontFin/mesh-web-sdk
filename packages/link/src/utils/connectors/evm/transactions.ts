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
  fromAddress: string,
  gasLimit?: number | null,
  maxFeePerGas?: number | null,
  maxPriorityFeePerGas?: number | null
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
        value: amount,
        gasLimit: gasLimit ? BigInt(Math.floor(gasLimit)) : undefined,
        maxFeePerGas: maxFeePerGas
          ? BigInt(Math.floor(maxFeePerGas))
          : undefined,
        maxPriorityFeePerGas: maxPriorityFeePerGas
          ? BigInt(Math.floor(maxPriorityFeePerGas))
          : undefined
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
  fromAddress: string
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

    const gasLimit =
      args?.[2] !== undefined ? toSafeNumber(args[2], 'gasLimit') : undefined
    const maxFeePerGas =
      args?.[3] !== undefined
        ? toSafeNumber(args[3], 'maxFeePerGas')
        : undefined
    const maxPriorityFeePerGas =
      args?.[4] !== undefined
        ? toSafeNumber(args[4], 'maxPriorityFeePerGas')
        : undefined

    txOptions.gasLimit = gasLimit ? BigInt(Math.floor(gasLimit)) : undefined
    txOptions.maxFeePerGas = maxFeePerGas
      ? BigInt(Math.floor(maxFeePerGas))
      : undefined
    txOptions.maxPriorityFeePerGas = maxPriorityFeePerGas
      ? BigInt(Math.floor(maxPriorityFeePerGas))
      : undefined

    try {
      // Send the transaction
      const tx = await contract[functionName](args[0], args[1], txOptions)

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

function toSafeNumber(value: unknown, name: string): number {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    throw new TypeError(
      `Invalid ${name}: expected a number, got ${typeof value} (${value})`
    )
  }
  return value
}

/**
 * Sends a batch of EVM transactions
 */
export const sendEVMTransactionBatch = async (params: {
  version: string
  from: string
  chainId: string
  atomicRequired: boolean
  calls: {
    to: string
    value: string
    data?: string
  }[]
}): Promise<string | Error> => {
  try {
    const activeRawProvider = getActiveRawProvider()
    if (!activeRawProvider) {
      throw new Error('No active EVM provider')
    }

    const provider = new ethers.BrowserProvider(activeRawProvider)

    try {
      // Send the transaction batch
      const response: { id: `0x${string}` } = await provider.send(
        'wallet_sendCalls',
        [params]
      )

      // Wait for transaction confirmation
      let result: {
        chainId: `0x${string}`
        id: `0x${string}`
        status: number
        atomic: boolean
        receipts: [
          {
            transactionHash: `0x${string}`
          }
        ]
      }
      do {
        result = await provider.send('wallet_getCallsStatus', [response.id])

        // wait 1 second if receipt is not yet available
        if (result.status == 100) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      } while (result.status == 100)

      return result?.status != 200
        ? new Error('Failed to send batched transactions')
        : result.receipts.find(x => x)?.transactionHash ??
            new Error('Failed to get batched transactions receipt')
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

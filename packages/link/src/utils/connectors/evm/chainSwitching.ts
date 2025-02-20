import { EVMProvider } from './types'
import { getChainConfiguration } from './chainConfigs'
import { getActiveRawProvider } from './provider'

// Chain switch status tracking
const isChainSwitching = false
const chainSwitchError: Error | null = null

const MAX_RETRY_ATTEMPTS = 3
const RETRY_DELAY = 1000

/**
 * Waits for a pending chain switch to complete
 */
const waitForPendingSwitch = async (
  provider: EVMProvider,
  chainIdHex: string,
  attempt: number = 0
): Promise<void> => {
  try {
    // Get current chain
    const currentChainHex = await provider.request({ method: 'eth_chainId' })
    if (currentChainHex === chainIdHex) {
      return // Switch completed
    }

    if (attempt >= MAX_RETRY_ATTEMPTS) {
      throw new Error('Chain switch timeout')
    }

    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
    return waitForPendingSwitch(provider, chainIdHex, attempt + 1)
  } catch (error: any) {
    if (error.code === -32002) {
      // Still pending, wait and retry
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY))
      return waitForPendingSwitch(provider, chainIdHex, attempt + 1)
    }
    throw error
  }
}

/**
 * Switches the current EVM chain
 */
export const switchEVMChain = async (
  chainId: number,
  provider?: EVMProvider
): Promise<{ chainId: number; accounts: string[] } | Error> => {
  try {
    const targetProvider = provider || getActiveRawProvider()
    if (!targetProvider) {
      throw new Error('No active EVM provider')
    }

    const chainIdHex = `0x${chainId.toString(16)}`

    try {
      await switchChain(targetProvider, chainIdHex)
    } catch (switchError: any) {
      await handleSwitchError(switchError, targetProvider, chainId, chainIdHex)
    }

    const accounts = await targetProvider.request({ method: 'eth_accounts' })
    return { chainId, accounts }
  } catch (error) {
    if (isUserRejection(error)) {
      return new Error('User rejected chain switch')
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
    console.error('Chain switch error:', error)
    return error instanceof Error ? error : new Error('Failed to switch chain')
  }
}

/**
 * Attempts to switch to a specific chain
 */
const switchChain = async (
  provider: EVMProvider,
  chainIdHex: string
): Promise<void> => {
  await provider.request({
    method: 'wallet_switchEthereumChain',
    params: [{ chainId: chainIdHex }]
  })
}

/**
 * Handles chain switch errors
 */
const handleSwitchError = async (
  error: any,
  provider: EVMProvider,
  chainId: number,
  chainIdHex: string
): Promise<void> => {
  if (error.code === 4001) {
    throw new Error('User rejected chain switch')
  }

  if (error.code === -32002) {
    // Request already pending, wait for it
    await waitForPendingSwitch(provider, chainIdHex)
    return
  }

  if (error.code === 4902 || error.code === -32603) {
    await addChain(provider, chainId, chainIdHex)
    await switchChain(provider, chainIdHex)
  } else {
    throw error
  }
}

/**
 * Adds a new chain to the wallet
 */
const addChain = async (
  provider: EVMProvider,
  chainId: number,
  chainIdHex: string
): Promise<void> => {
  const chainConfig = getChainConfiguration(chainId)

  if (!chainConfig) {
    throw new Error(`No configuration found for chain ${chainId}`)
  }

  try {
    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [
        {
          chainId: chainIdHex,
          chainName: chainConfig.name,
          nativeCurrency: chainConfig.nativeCurrency,
          rpcUrls: chainConfig.rpcUrls.default.http,
          blockExplorerUrls: [chainConfig.blockExplorers.default.url]
        }
      ]
    })
  } catch (addError: any) {
    if (addError.code === 4001) {
      throw new Error('User rejected chain add')
    }
    throw addError
  }
}

/**
 * Checks if an error is a user rejection
 */
const isUserRejection = (error: any): boolean => {
  return error instanceof Error && error.message.includes('rejected')
}

/**
 * Gets the current chain switch status
 */
export const getChainSwitchStatus = () => ({
  isChainSwitching,
  chainSwitchError
})

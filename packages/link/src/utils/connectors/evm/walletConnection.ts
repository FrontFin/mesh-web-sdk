import { ethers } from 'ethers'
import { EVMProvider, EVMConnectResult, EIP6963ProviderDetail } from './types'
import {
  setActiveEVMProvider,
  getActiveRawProvider,
  clearActiveProviders
} from './provider'
import { switchEVMChain } from './chainSwitching'
import {
  initializeWalletDiscovery,
  findAvailableProviders
} from './walletDiscovery'

// Extend Window interface
declare global {
  interface Window {
    ethereum?: EVMProvider & {
      providers?: EVMProvider[]
    }
  }
}

// Initialize wallet discovery on module load
initializeWalletDiscovery()

/**
 * Gets an EVM provider for a specific wallet
 */
export const getEVMProvider = (
  walletName?: string,
  walletDetail?: EIP6963ProviderDetail
): EVMProvider => {
  console.log('Getting EVM provider for wallet:', { walletName, walletDetail })

  if (walletDetail?.provider) {
    return walletDetail.provider as EVMProvider
  }

  if (!walletName) {
    throw new Error('Wallet name is required')
  }

  // Get all available providers
  const providers = findAvailableProviders()
  console.log('Available providers:', providers)

  // Try to find a matching provider by name
  const matchingProvider = providers.find(
    p => p.name.toLowerCase() === walletName.toLowerCase()
  )

  if (matchingProvider) {
    return matchingProvider.injectedData.provider
  }

  // If no match found, try window.ethereum as last resort
  if (window.ethereum) {
    return window.ethereum
  }

  throw new Error(
    `No provider found for wallet ${walletName}. Please make sure the wallet is installed and enabled.`
  )
}

/**
 * Connects to an EVM wallet
 */
export const connectToEVMWallet = async (
  walletName: string,
  targetChainId?: number,
  walletDetail?: EIP6963ProviderDetail
): Promise<EVMConnectResult | Error> => {
  try {
    let provider: EVMProvider
    try {
      provider = getEVMProvider(walletName, walletDetail)
      console.log('Got provider for', walletName, ':', provider)
    } catch (error) {
      // If we can't get a provider, it might be a non-EVM wallet
      // Let the caller handle routing to the appropriate connector
      throw new Error(`No provider found for wallet ${walletName}`)
    }

    const browserProvider = new ethers.BrowserProvider(provider)
    setActiveEVMProvider(browserProvider, provider, walletName)

    setupEventListeners(provider)

    // Check for existing connection first
    const existingAccounts = await provider.request({ method: 'eth_accounts' })
    if (!existingAccounts || existingAccounts.length === 0) {
      // No existing connection, request accounts
      await browserProvider.send('eth_requestAccounts', [])
    }

    // Get signer and address
    const signer = await browserProvider.getSigner()
    const address = await signer.getAddress()
    let chainId = await browserProvider
      .getNetwork()
      .then(network => Number(network.chainId))

    // If a target chain is specified and it's different from the current chain,
    // try to switch to it
    if (targetChainId && chainId !== targetChainId) {
      console.log('Switching to target chain:', targetChainId)
      const switchResult = await switchEVMChain(targetChainId, provider)
      if (switchResult instanceof Error) {
        throw switchResult
      }
      chainId = switchResult.chainId
    }

    return {
      accounts: [address],
      chainId,
      isConnected: true
    }
  } catch (error) {
    console.error('EVM wallet connection error:', error)
    return error instanceof Error
      ? error
      : new Error(`Failed to connect to ${walletName} wallet`)
  }
}

/**
 * Sets up event listeners for the provider
 */
const setupEventListeners = (provider: EVMProvider) => {
  const handleAccountsChanged = (accounts: string[]) => {
    console.log('Accounts changed:', accounts)
  }
  const handleChainChanged = (chainId: string) => {
    console.log('Chain changed:', parseInt(chainId, 16))
  }
  provider.on('accountsChanged', handleAccountsChanged)
  provider.on('chainChanged', handleChainChanged)
}

/**
 * Disconnects from an EVM wallet
 */
export const disconnectFromEVMWallet = async (
  walletName: string
): Promise<void | Error> => {
  try {
    const provider = getActiveRawProvider()
    if (!provider) {
      return
    }

    // Remove all event listeners
    if (provider.removeAllListeners) {
      provider.removeAllListeners()
    }

    // Clear the active provider
    clearActiveProviders()
  } catch (error) {
    console.error('EVM wallet disconnection error:', error)
    return error instanceof Error
      ? error
      : new Error(`Failed to disconnect from ${walletName} wallet`)
  }
}

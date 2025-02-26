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

initializeWalletDiscovery()

/**
 * Gets an EVM provider for a specific wallet
 */
export const getEVMProvider = (
  walletName?: string,
  walletDetail?: EIP6963ProviderDetail
): EVMProvider => {
  if (walletDetail?.provider) {
    return walletDetail.provider as EVMProvider
  }

  if (!walletName) {
    throw new Error('Wallet name is required')
  }

  const providers = findAvailableProviders()

  const matchingProvider = providers.find(
    p => p.name.toLowerCase() === walletName.toLowerCase()
  )

  if (matchingProvider) {
    return matchingProvider.injectedData.provider
  }

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
    } catch (error) {
      throw new Error(`No provider found for wallet ${walletName}`)
    }

    const browserProvider = new ethers.BrowserProvider(provider)
    setActiveEVMProvider(browserProvider, provider)

    const existingAccounts = await provider.request({ method: 'eth_accounts' })
    if (!existingAccounts || existingAccounts.length === 0) {
      await browserProvider.send('eth_requestAccounts', [])
    }

    const signer = await browserProvider.getSigner()
    const address = await signer.getAddress()
    let chainId = await browserProvider
      .getNetwork()
      .then(network => Number(network.chainId))

    if (targetChainId && chainId !== targetChainId) {
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

    if (provider.removeAllListeners) {
      provider.removeAllListeners()
    }

    clearActiveProviders()
  } catch (error) {
    console.error('EVM wallet disconnection error:', error)
    return error instanceof Error
      ? error
      : new Error(`Failed to disconnect from ${walletName} wallet`)
  }
}

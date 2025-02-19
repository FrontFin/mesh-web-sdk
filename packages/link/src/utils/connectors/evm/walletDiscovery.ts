import {
  EVMProvider,
  InjectedProviderInfo,
  EIP6963ProviderDetail
} from './types'

let discoveredWallets: EIP6963ProviderDetail[] = []

/**
 * Initializes EIP-6963 wallet discovery protocol
 * @returns Cleanup function for event listeners
 */
export const initializeWalletDiscovery = (): (() => void) => {
  const handleAnnouncement = (event: CustomEvent) => {
    const providerDetail = event.detail as EIP6963ProviderDetail
    discoveredWallets = [...discoveredWallets, providerDetail]
  }

  window.addEventListener(
    'eip6963:announceProvider',
    handleAnnouncement as EventListener
  )
  window.dispatchEvent(new Event('eip6963:requestProvider'))

  return () => {
    window.removeEventListener(
      'eip6963:announceProvider',
      handleAnnouncement as EventListener
    )
  }
}

/**
 * Finds all available EVM providers using EIP-6963
 */
export const findAvailableProviders = (): InjectedProviderInfo[] => {
  const providers: InjectedProviderInfo[] = []

  // Initialize wallet discovery if not already done
  if (discoveredWallets.length === 0) {
    initializeWalletDiscovery()
  }

  // Add EIP-6963 discovered wallets
  discoveredWallets.forEach(wallet => {
    const injectedData: any = {
      provider: wallet.provider as EVMProvider
    }

    // Copy all boolean properties that start with 'is'
    for (const key in wallet.provider) {
      const provider = wallet.provider as unknown as { [key: string]: unknown }
      if (key.startsWith('is') && typeof provider[key] === 'boolean') {
        injectedData[key] = provider[key]
      }
    }

    providers.push({
      name: wallet.info.name,
      id: wallet.info.uuid,
      icon: wallet.info.icon,
      injectedData
    })
  })

  return providers
}

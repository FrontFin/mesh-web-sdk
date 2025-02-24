import {
  SolanaProvider,
  WindowWithSolanaProviders,
  SolanaWalletType
} from './types'

declare const window: WindowWithSolanaProviders

const identifyWalletType = (
  provider: SolanaProvider & { [key: string]: any }
): SolanaWalletType => {
  if (provider.isPhantom) return SolanaWalletType.PHANTOM
  if (provider.isSolflare) return SolanaWalletType.SOLFLARE
  if (provider.isTrust || provider.isTrustWallet) return SolanaWalletType.TRUST
  if (provider.isExodus) return SolanaWalletType.EXODUS
  return SolanaWalletType.UNKNOWN
}

const getProviderByType = (
  type: SolanaWalletType
): SolanaProvider | undefined => {
  // First try to get the provider directly using the wallet name
  const dynamicProvider = (window as any)[type]?.solana
  if (dynamicProvider) {
    return dynamicProvider
  }

  // Then check known provider locations
  switch (type) {
    case SolanaWalletType.PHANTOM:
      return window.phantom?.solana
    case SolanaWalletType.SOLFLARE:
      return window.solflare
    case SolanaWalletType.TRUST:
      return window.trustwallet?.solana
    case SolanaWalletType.EXODUS:
      return window.exodus?.solana
    case SolanaWalletType.UNKNOWN:
      return window.solana
  }
}

export const findAvailableSolanaProviders = (): {
  [key in SolanaWalletType]?: boolean
} => {
  const providers: { [key in SolanaWalletType]?: boolean } = {}

  // Check all known wallet types
  Object.values(SolanaWalletType).forEach(type => {
    if (getProviderByType(type)) {
      providers[type] = true
    }
  })

  // Also check window.solana if not already found
  if (window.solana && !Object.keys(providers).length) {
    const walletType = identifyWalletType(window.solana)
    providers[walletType] = true
  }

  return providers
}

export const getSolanaProvider = (walletName: string): SolanaProvider => {
  const normalizedName = walletName
    .toLowerCase()
    .replace(/\s+/g, '') as SolanaWalletType
  const availableProviders = findAvailableSolanaProviders()

  // First check if the requested wallet is available
  if (availableProviders[normalizedName]) {
    const provider = getProviderByType(normalizedName)
    if (provider) return provider
  }

  // If not found and it's a dynamic provider, try direct access
  const dynamicProvider = (window as any)[normalizedName]?.solana
  if (dynamicProvider) {
    return dynamicProvider
  }

  // If still not found, check window.solana as last resort
  if (window.solana) {
    const detectedType = identifyWalletType(window.solana)
    if (
      detectedType === normalizedName ||
      normalizedName === SolanaWalletType.UNKNOWN
    ) {
      return window.solana
    }
  }

  throw new Error(`Provider not found for wallet: ${walletName}`)
}

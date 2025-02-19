import { SolanaProvider, WindowWithSolanaProviders } from './types'

declare const window: WindowWithSolanaProviders

export const findAvailableSolanaProviders = (): { [key: string]: boolean } => {
  const providers: { [key: string]: boolean } = {}

  // Check window.solana first as it's the standard injection point
  if (window.solana) {
    // Identify the provider by its properties
    if (window.solana.isPhantom) {
      providers.phantom = true
    } else if (window.solana.isSolflare) {
      providers.solflare = true
    } else if (window.solana.isTrust || window.solana.isTrustWallet) {
      providers.trustwallet = true
    } else if (window.solana.isExodus) {
      providers.exodus = true
    } else {
      // For unknown wallets, identify them by any available name property
      const providerName =
        window.solana.constructor?.name?.toLowerCase() || 'unknown'
      providers[providerName] = true
    }
  }

  // Check for dedicated provider objects
  if (window.phantom?.solana) {
    providers.phantom = true
  }
  if (window.solflare) {
    providers.solflare = true
  }
  if (window.trustwallet?.solana) {
    providers.trustwallet = true
  }
  if (window.exodus?.solana) {
    providers.exodus = true
  }

  return providers
}

export const getSolanaProvider = (walletName: string): SolanaProvider => {
  const normalizedName = walletName.toLowerCase().replace(/\s+/g, '')

  // First try to get the provider from its dedicated object
  if (normalizedName === 'phantom' && window.phantom?.solana) {
    return window.phantom.solana
  }
  if (normalizedName === 'solflare' && window.solflare) {
    return window.solflare
  }
  if (
    (normalizedName === 'trust' || normalizedName === 'trustwallet') &&
    window.trustwallet?.solana
  ) {
    return window.trustwallet.solana
  }
  if (normalizedName === 'exodus' && window.exodus?.solana) {
    return window.exodus.solana
  }

  // Try to find the provider dynamically using the wallet name
  const windowAny = window as any
  if (windowAny[normalizedName]?.solana) {
    return windowAny[normalizedName].solana
  }
  if (windowAny[normalizedName]) {
    return windowAny[normalizedName]
  }

  // Then check window.solana
  if (window.solana) {
    // For known wallets, verify their identity
    if (normalizedName === 'phantom' && window.solana.isPhantom) {
      return window.solana
    }
    if (normalizedName === 'solflare' && window.solana.isSolflare) {
      return window.solana
    }
    if (
      (normalizedName === 'trust' || normalizedName === 'trustwallet') &&
      (window.solana.isTrust || window.solana.isTrustWallet)
    ) {
      return window.solana
    }
    if (normalizedName === 'exodus' && window.solana.isExodus) {
      return window.solana
    }

    // For unknown wallets or when the name matches the provider's name
    const providerName = window.solana.constructor?.name?.toLowerCase() || ''
    if (normalizedName === providerName || normalizedName === 'unknown') {
      return window.solana
    }
  }

  throw new Error(`Provider not found for wallet: ${walletName}`)
}

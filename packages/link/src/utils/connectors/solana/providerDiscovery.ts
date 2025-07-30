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

// Type-safe validation functions
type WalletValidationFn = (provider: SolanaProvider) => boolean

const walletValidations: Record<SolanaWalletType, WalletValidationFn> = {
  [SolanaWalletType.PHANTOM]: (provider: SolanaProvider): boolean =>
    provider.isPhantom === true &&
    provider.isSolflare !== true &&
    provider.isTrust !== true &&
    provider.isTrustWallet !== true &&
    provider.isExodus !== true,

  [SolanaWalletType.SOLFLARE]: (provider: SolanaProvider): boolean =>
    provider.isSolflare === true &&
    provider.isPhantom !== true &&
    provider.isTrust !== true &&
    provider.isTrustWallet !== true &&
    provider.isExodus !== true,

  [SolanaWalletType.TRUST]: (provider: SolanaProvider): boolean =>
    (provider.isTrust === true || provider.isTrustWallet === true) &&
    provider.isPhantom !== true &&
    provider.isSolflare !== true &&
    provider.isExodus !== true,

  [SolanaWalletType.EXODUS]: (provider: SolanaProvider): boolean =>
    provider.isExodus === true &&
    provider.isSolflare !== true &&
    provider.isTrust !== true &&
    provider.isTrustWallet !== true,
  // Note: Exodus may also inject isPhantom, so we don't exclude it

  [SolanaWalletType.UNKNOWN]: (provider: SolanaProvider): boolean =>
    provider.isPhantom !== true &&
    provider.isSolflare !== true &&
    provider.isTrust !== true &&
    provider.isTrustWallet !== true &&
    provider.isExodus !== true
}

const getProviderByType = (
  type: SolanaWalletType
): SolanaProvider | undefined => {
  // Then check known provider locations
  switch (type) {
    case SolanaWalletType.PHANTOM:
      if (
        window.phantom?.solana &&
        walletValidations[type](window.phantom.solana)
      ) {
        return window.phantom.solana
      }
      return undefined
    case SolanaWalletType.SOLFLARE:
      if (window.solflare && walletValidations[type](window.solflare)) {
        return window.solflare
      }
      return undefined
    case SolanaWalletType.TRUST:
      if (
        window.trustwallet?.solana &&
        walletValidations[type](window.trustwallet.solana)
      ) {
        return window.trustwallet.solana
      }
      return undefined
    case SolanaWalletType.EXODUS:
      if (
        window.exodus?.solana &&
        walletValidations[type](window.exodus.solana)
      ) {
        return window.exodus.solana
      }
      return undefined
    case SolanaWalletType.UNKNOWN:
      if (window.solana && walletValidations[type](window.solana)) {
        return window.solana
      }
      return undefined
    default:
      return undefined
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

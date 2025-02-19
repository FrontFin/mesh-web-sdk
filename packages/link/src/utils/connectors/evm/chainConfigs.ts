import { ChainConfig } from './types'

// Chain configurations
const chainConfigs: Record<number, ChainConfig> = {
  43114: {
    // Avalanche
    name: 'Avalanche',
    nativeCurrency: {
      decimals: 18,
      name: 'Avalanche',
      symbol: 'AVAX'
    },
    rpcUrls: {
      default: { http: ['https://avalanche-mainnet.infura.io'] }
    },
    blockExplorers: {
      default: {
        name: 'SnowTrace',
        url: 'https://snowtrace.io'
      }
    }
  },
  42161: {
    // Arbitrum
    name: 'Arbitrum One',
    nativeCurrency: {
      decimals: 18,
      name: 'Ether',
      symbol: 'ETH'
    },
    rpcUrls: {
      default: { http: ['https://arb1.arbitrum.io/rpc'] }
    },
    blockExplorers: {
      default: {
        name: 'Arbiscan',
        url: 'https://arbiscan.io'
      }
    }
  },
  10: {
    // Optimism
    name: 'OP Mainnet',
    nativeCurrency: {
      decimals: 18,
      name: 'Ether',
      symbol: 'ETH'
    },
    rpcUrls: {
      default: { http: ['https://mainnet.optimism.io'] }
    },
    blockExplorers: {
      default: {
        name: 'Optimism Explorer',
        url: 'https://optimistic.etherscan.io'
      }
    }
  },
  8453: {
    // Base
    name: 'Base',
    nativeCurrency: {
      decimals: 18,
      name: 'Ether',
      symbol: 'ETH'
    },
    rpcUrls: {
      default: { http: ['https://mainnet.base.org'] }
    },
    blockExplorers: {
      default: {
        name: 'Basescan',
        url: 'https://basescan.org'
      }
    }
  },
  137: {
    // Polygon
    name: 'Polygon',
    nativeCurrency: {
      decimals: 18,
      name: 'MATIC',
      symbol: 'MATIC'
    },
    rpcUrls: {
      default: { http: ['https://polygon-rpc.com'] }
    },
    blockExplorers: {
      default: {
        name: 'PolygonScan',
        url: 'https://polygonscan.com'
      }
    }
  },
  56: {
    // BSC
    name: 'BNB Smart Chain',
    nativeCurrency: {
      decimals: 18,
      name: 'BNB',
      symbol: 'BNB'
    },
    rpcUrls: {
      default: { http: ['https://rpc.ankr.com/bsc'] }
    },
    blockExplorers: {
      default: {
        name: 'BscScan',
        url: 'https://bscscan.com'
      }
    }
  }
}

// Helper function to get chain configuration
export const getChainConfiguration = (
  chainId: number
): ChainConfig | undefined => {
  return chainConfigs[chainId]
}

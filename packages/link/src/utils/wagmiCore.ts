import { createConfig, http } from '@wagmi/core'
import {
  bsc,
  mainnet,
  polygon,
  avalanche,
  arbitrum,
  optimism
} from '@wagmi/core/chains'
import { walletConnect, coinbaseWallet, injected } from 'wagmi/connectors'

export const config = createConfig({
  chains: [mainnet, bsc, polygon, avalanche, arbitrum, optimism],
  connectors: [
    injected(),
    walletConnect({
      projectId: 'importWalletConnectId', //import correct walletConnectId
      showQrModal: false,
      metadata: {
        name: 'Mesh',
        description: 'Mesh Connect',
        url: 'https://meshconnect.com',
        icons: ['https://web.meshconnect.com/logo192.png']
      }
    }),
    coinbaseWallet({
      appName: 'Mesh',
      appLogoUrl: 'https://web.meshconnect.com/logo192.png',
      headlessMode: true,
      enableMobileWalletLink: true
    })
  ],
  multiInjectedProviderDiscovery: true,
  transports: {
    [mainnet.id]: http(
      'https://cosmological-holy-valley.discover.quiknode.pro/825c12784b8cdc9139675008ca4923481fde601b/'
    ),
    [bsc.id]: http(
      'https://chaotic-wild-spring.bsc.quiknode.pro/1799d67d42cee27bd50a415bb802696f818fab19/'
    ),
    [polygon.id]: http(
      'https://rough-wandering-leaf.matic.quiknode.pro/e462e4224e713f5d168a95e9cb5f45875ddeeaf5/'
    ),
    [avalanche.id]: http(
      'https://alien-wider-darkness.avalanche-mainnet.quiknode.pro/5be8ad6e8683a028bd27b4411b426275ff6f9d43/ext/bc/C/rpc/'
    ),
    [arbitrum.id]: http(
      'https://dark-wider-forest.arbitrum-mainnet.quiknode.pro/bdc628adc379eb06266bfa80f68c04b01536516e/'
    ),
    [optimism.id]: http(
      'https://weathered-blue-spring.optimism.quiknode.pro/e950ad9bfe5cd4e80cef52961a2a983154f74dad/'
    )
  }
})

import { FC, PropsWithChildren } from 'react'
import { config } from '../utils/wagmiCore'
import { WagmiProvider as WagmiProviderInternal } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export const WagmiCoreProvider: FC<PropsWithChildren> = ({ children }) => {
  const queryClient = new QueryClient()

  try {
    return (
      <WagmiProviderInternal config={config} reconnectOnMount={false}>
        <QueryClientProvider client={queryClient}>
          {children}
        </QueryClientProvider>
      </WagmiProviderInternal>
    )
  } catch (e) {
    console.error(e)
    return <>{children}</>
  }
}

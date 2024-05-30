import { FC, PropsWithChildren } from 'react'
import { getConfig, configPreLoaded } from '../utils/wagmiCore'
// import { WagmiProvider as WagmiProviderInternal } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// const config = configPreLoaded
// //const config = getConfig()
// //console.log('config', config)
// export const WagmiCoreProvider: FC<PropsWithChildren> = ({ children }) => {
//   const queryClient = new QueryClient()

//   try {
//     return (
//       <WagmiProviderInternal config={config} reconnectOnMount={false}>
//         <QueryClientProvider client={queryClient}>
//           {children}
//         </QueryClientProvider>
//       </WagmiProviderInternal>
//     )
//   } catch (e) {
//     console.error(e)
//     return <>{children}</>
//   }
// }

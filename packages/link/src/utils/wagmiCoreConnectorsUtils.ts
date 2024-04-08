import { getConnectors } from '@wagmi/core'
import { config } from './wagmiCore'
import { WagmiInjectedConnectorData } from './types'

export const getWagmiCoreInjectedData = (): WagmiInjectedConnectorData[] => {
  const connectors = getConnectors(config)
  const mappedConnectors: WagmiInjectedConnectorData[] = connectors.map(
    ({ id, name, type, uid, icon }) => ({
      id,
      name,
      type,
      uid,
      icon: icon || undefined
    })
  )

  return mappedConnectors
}

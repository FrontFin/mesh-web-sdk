import {
  getConnectors,
  connect,
  disconnect,
  getAccount,
  signMessage,
  getBalance,
  sendTransaction,
  switchChain,
  simulateContract,
  writeContract,
  createConfig,
  http,
  fallback,
  type Connector,
  type GetAccountReturnType,
  type Config,
  type GetBalanceReturnType,
  type Transport,
  BaseError,
  ChainNotConfiguredError,
  ConnectorAccountNotFoundError,
  ConnectorAlreadyConnectedError,
  ConnectorNotConnectedError,
  ConnectorNotFoundError,
  ProviderNotFoundError,
  SwitchChainNotSupportedError
} from '@wagmi/core'

import { injected } from '@wagmi/connectors'
import {
  WagmiInjectedConnectorData,
  ConnectReturnTypeAndTxHash,
  IncomingConfig,
  Abi
} from './types'
import { parseUnits, Hash, Chain } from 'viem'

let resolveConfigReady: (value: Config | PromiseLike<Config>) => void

const configReady = new Promise<Config>(resolve => {
  resolveConfigReady = resolve
})

const setConfig = (config: IncomingConfig) => {
  try {
    const transports: Record<number, Transport> = {}

    for (const chainId in config.transports) {
      const urls = config.transports[chainId]
      if (Array.isArray(urls)) {
        // If the URL is an array, create a fallback transport with multiple transports
        transports[chainId] = fallback(urls.map(url => http(url)))
      } else {
        // If the URL is a string, create a single HTTP transport
        transports[chainId] = http(urls)
      }
    }
    const chainsTuple = [...config.chains] as [Chain, ...Chain[]]

    const dynamicConfig = createConfig({
      chains: chainsTuple,
      multiInjectedProviderDiscovery: true,
      transports: transports,
      connectors: [injected()]
    })

    resolveConfigReady(dynamicConfig)
  } catch (error) {
    console.error('Error setting configuration:', error)
  }
}

window.addEventListener('message', event => {
  if (event.data.type === 'walletBrowserConfigInitialize') {
    try {
      const parsedConfig = JSON.parse(event.data.payload) as IncomingConfig
      setConfig(parsedConfig)
    } catch (error) {
      console.error('Error parsing configuration:', error)
    }
  }
})

const configPromise = configReady

export const getWagmiCoreInjectedData = async (): Promise<
  WagmiInjectedConnectorData[] | Error
> => {
  return withWagmiErrorHandling(async () => {
    const config = await configPromise
    const connectors = await getConnectors(config)

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
  })
}

export const connectToSpecificWallet = async (
  walletName: string
): Promise<ConnectReturnTypeAndTxHash | Error> => {
  return withWagmiErrorHandling(async () => {
    const config = await configPromise
    const connectors = getConnectors(config)

    const selectedConnector = connectors.find(
      (connector: Connector) =>
        connector.name.toLowerCase() === walletName.toLowerCase()
    )

    if (!selectedConnector) {
      throw new Error(`No connector found for wallet: ${walletName}`)
    }

    await disconnectCurrentAccount(config, selectedConnector)

    const result = await connect(config, { connector: selectedConnector })

    const accountInfo = await getAccount(config)
    const txSigned = await signedMessage(config, accountInfo)

    return {
      accounts: [...result.accounts],
      chainId: result.chainId,
      txSigned: txSigned as `0x${string}`
    }
  })
}

export const signedMessage = async (
  config: Config,
  accountInfo: GetAccountReturnType
): Promise<Hash | Error> => {
  if (!accountInfo.address) {
    return new Error('Address not found')
  }

  return withWagmiErrorHandling(async () => {
    const signedMessage = await signMessage(config, {
      account: accountInfo.address,
      message: 'Sign to verify ownership of wallet'
    })

    return signedMessage
  })
}

export const walletBalance = async (
  account: string,
  chainId: number
): Promise<GetBalanceReturnType | Error> => {
  return withWagmiErrorHandling(async () => {
    const config = await configPromise
    const balance = await getBalance(config, {
      address: account as `0x${string}`,
      chainId: chainId
    })
    return balance
  })
}

export const switchChainFromSDK = async (
  chainId: number
): Promise<Chain | Error> => {
  return await withWagmiErrorHandling(async () => {
    const config = await configPromise
    const result = await switchChain(config, { chainId })
    return result
  })
}

export const sendTransactionFromSDK = async (
  toAddress: string,
  amount: number,
  decimalPlaces: number,
  chainId: number,
  account: string
): Promise<Hash | Error> => {
  return await withWagmiErrorHandling(async () => {
    const config = await configPromise
    const result = await sendTransaction(config, {
      to: formatAddress(toAddress) as `0x${string}`,
      value: parseUnits(amount.toFixed(decimalPlaces) || '0', decimalPlaces),
      chainId: chainId,
      account: formatAddress(account) as `0x${string}`
    })
    return result
  })
}

const formatAddress = (address: string) =>
  address.startsWith('0x') ? address : `0x${address}`

export const sendNonNativeTransactionFromSDK = async (
  address: string,
  abi: Abi,
  functionName: string,
  args: any[], // eslint-disable-line @typescript-eslint/no-explicit-any
  value?: bigint
): Promise<Hash | Error> => {
  return await withWagmiErrorHandling(async () => {
    const config = await configPromise
    const { connector } = await getAccount(config)
    const { request } = await simulateContract(config, {
      address: formatAddress(address) as `0x${string}`,
      abi: abi,
      functionName: functionName,
      args: args,
      value: value,
      connector
    })
    const result = await writeContract(config, request)
    return result
  })
}

const disconnectCurrentAccount = async (
  config: Config,
  currentConnector: Connector
): Promise<void | Error> => {
  return await withWagmiErrorHandling(async () => {
    await disconnect(config, { connector: currentConnector })
  })
}

export const disconnectAllAccounts = async (): Promise<void | Error> => {
  const config = await configPromise
  return withWagmiErrorHandling(async () => {
    await disconnect(config)
  })
}

/**
 * Wrapper function for Wagmi Core functions that handles errors
 * @param fn - The function to wrap
 * @returns - The result of the function or an error
 */
async function withWagmiErrorHandling<T>(
  fn: () => Promise<T>
): Promise<T | Error> {
  try {
    return await fn()
  } catch (error) {
    if (error instanceof BaseError) {
      return handleWagmiError(error)
    } else {
      if (error instanceof Error) {
        throw new Error(error.message)
      } else {
        throw new Error('An unexpected error has occurred')
      }
    }
  }
}

const handleWagmiError = (error: unknown): Error => {
  if (error instanceof ChainNotConfiguredError) {
    return handleChainNotConfiguredError(error)
  } else if (error instanceof ConnectorAccountNotFoundError) {
    return handleConnectorAccountNotFoundError(error)
  } else if (error instanceof ConnectorAlreadyConnectedError) {
    return handleConnectorAlreadyConnectedError(error)
  } else if (error instanceof ConnectorNotConnectedError) {
    return handleConnectorNotConnectedError(error)
  } else if (error instanceof ConnectorNotFoundError) {
    return handleConnectorNotFoundError(error)
  } else if (error instanceof ProviderNotFoundError) {
    return handleProviderNotFoundError(error)
  } else if (error instanceof SwitchChainNotSupportedError) {
    return handleSwitchChainNotSupportedError(error)
  } else if (error instanceof BaseError) {
    return handleBaseError(error)
  } else {
    // Handle unknown error types
    if (error instanceof Error) {
      throw new Error(error.message)
    } else {
      throw new Error('An unexpected error has occurred')
    }
  }
}

// All errors extend base error
const handleBaseError = (error: BaseError): Error => {
  throw new Error(error.message)
}

const handleChainNotConfiguredError = (
  error: ChainNotConfiguredError
): Error => {
  throw new Error(`Chain not configured: ${error.message}`)
}

const handleConnectorAccountNotFoundError = (
  error: ConnectorAccountNotFoundError
): Error => {
  throw new Error(`Connector account not found: ${error.message}`)
}

const handleConnectorAlreadyConnectedError = (
  error: ConnectorAlreadyConnectedError
): Error => {
  throw new Error(`Connector already connected: ${error.message}`)
}

const handleConnectorNotConnectedError = (
  error: ConnectorNotConnectedError
): Error => {
  throw new Error(`Connector not connected: ${error.message}`)
}

const handleConnectorNotFoundError = (error: ConnectorNotFoundError): Error => {
  throw new Error(`Connector not found: ${error.message}`)
}

const handleProviderNotFoundError = (error: ProviderNotFoundError): Error => {
  throw new Error(`Provider not found: ${error.message}`)
}

const handleSwitchChainNotSupportedError = (
  error: SwitchChainNotSupportedError
): Error => {
  throw new Error(`Switch chain not supported: ${error.message}`)
}

import { getConnectors } from '@wagmi/core'
import { WagmiInjectedConnectorData } from './types'
import { parseUnits, Hex } from 'viem'
import {
  connect,
  disconnect,
  getConnections,
  getAccount,
  signMessage,
  getBalance,
  sendTransaction,
  switchChain,
  simulateContract,
  writeContract,
  createConfig,
  http
} from '@wagmi/core'
import {
  type Connection,
  type Connector,
  type Chain,
  type GetAccountReturnType,
  type Config,
  type Hash
} from '@wagmi/core'
import {
  BaseError,
  ChainNotConfiguredError,
  ConnectorAccountNotFoundError,
  ConnectorAlreadyConnectedError,
  ConnectorNotConnectedError,
  ConnectorNotFoundError,
  ProviderNotFoundError,
  SwitchChainNotSupportedError
} from '@wagmi/core'
import { GetBalanceReturnType } from '@wagmi/core'
import { injected } from '@wagmi/connectors'

// setting up config is necessary for the injected connector to work
// handle this outside of the walletBrowserListener
let dynamicConfig: Config | null = null
let resolveConfigReady: (value: Config | PromiseLike<Config>) => void

const configReady = new Promise<Config>(resolve => {
  resolveConfigReady = resolve
})

const setConfig = (config: Config) => {
  try {
    const transports = Object.fromEntries(
      Object.entries(config.transports).map(([chainId, url]) => {
        return [chainId, http(url)]
      })
    )

    const reconstructedConfig: Config = {
      chains: config.chains,
      multiInjectedProviderDiscovery: true,
      transports: transports,
      connectors: [injected()]
    }

    dynamicConfig = createConfig(reconstructedConfig)
    resolveConfigReady(dynamicConfig)
  } catch (error) {
    console.error('Error setting configuration:', error)
  }
}

window.addEventListener('message', event => {
  if (event.data.type === 'walletBrowserConfigInitialize') {
    try {
      const parsedConfig = JSON.parse(event.data.payload)
      setConfig(parsedConfig)
    } catch (error) {
      console.error('Error parsing configuration:', error)
    }
  }
})

const configPromise = configReady

export const getWagmiCoreInjectedData = async (): Promise<
  WagmiInjectedConnectorData[]
> => {
  try {
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
  } catch (error) {
    console.error('Error getting Wagmi core injected data:', error)
    throw error
  }
}
type ConnectReturnTypeAndTxHash = {
  accounts: string[]
  chainId: number
  txSigned: Hash
}
export const connectToSpecificWallet = async (
  walletName: string
): Promise<ConnectReturnTypeAndTxHash> => {
  try {
    const config = await configPromise
    const connectors = getConnectors(config)

    const selectedConnector = connectors.find(
      (connector: Connector) =>
        connector.name.toLowerCase() === walletName.toLowerCase()
    )

    if (!selectedConnector) {
      throw new Error(`No connector found for wallet: ${walletName}`)
    }

    await disconnectCurrentAccount(config)

    const result = await connect(config, { connector: selectedConnector })
    console.log('Connection Result:', result)

    const accountInfo = await getAccount(config)

    const txSigned = await signedMessage(config, accountInfo)
    return {
      accounts: [...result.accounts],
      chainId: result.chainId,
      txSigned: txSigned
    }
  } catch (error) {
    console.error('Error connecting to specific wallet:', error)
    throw error
  }
}

export const signedMessage = async (
  config: Config,
  accountInfo: GetAccountReturnType
): Promise<Hash> => {
  try {
    // use address to sign message
    if (!accountInfo.address) {
      throw new Error('Address not found')
    }
    const signedMessage = await signMessage(config, {
      account: accountInfo.address,
      message: 'Sign to verify ownership of wallet'
    })

    console.log('signedMessage', signedMessage)
    return signedMessage
  } catch (error) {
    console.error('Error signing message:', error)
    throw error
  }
}

export const walletBalance = async (
  account: string,
  chainId: number
): Promise<GetBalanceReturnType> => {
  try {
    const config = await configPromise
    const balance = await getBalance(config, {
      address: account as `0x${string}`,
      chainId: chainId
    })
    return balance
  } catch (error) {
    console.error('Error fetching wallet balance:', error)
    throw error
  }
}

export const switchChainFromSDK = async (chainId: number): Promise<Chain> => {
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
): Promise<Hash> => {
  return await withWagmiErrorHandling(async () => {
    const config = await configPromise
    const currentConnections1 = await getConnections(config)
    console.log('currentConnections1', currentConnections1)

    const account1 = await getAccount(config)
    console.log('accountBefore', account1)
    console.log('toAddress', formatAddress(toAddress))
    console.log(
      'amount',
      parseUnits(amount.toFixed(decimalPlaces) || '0', decimalPlaces)
    )
    console.log('chainId', chainId)
    console.log('account', formatAddress(account))

    const result = await sendTransaction(config, {
      to: formatAddress(toAddress),
      value: parseUnits(amount.toFixed(decimalPlaces) || '0', decimalPlaces),
      chainId: chainId,
      account: formatAddress(account)
    })
    console.log('sendTransaction', result)
    return result
  })
}

const formatAddress = (address: string) =>
  address.startsWith('0x') ? address : `0x${address}`

export const sendNonNativeTransactionFromSDK = async (
  address: string,
  abi: any,
  functionName: string,
  args: any[],
  value?: bigint
): Promise<Hash> => {
  return await withWagmiErrorHandling(async () => {
    const config = await configPromise
    const { connector } = await getAccount(config)
    console.log('connectors in non native', connector)
    console.log('ABI:', JSON.stringify(abi))

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

const disconnectCurrentAccount = async (config: Config): Promise<void> => {
  const account = await getAccount(config)

  if (account && account.connector) {
    try {
      await disconnect(config, { connector: account.connector })
      console.log('Disconnected from wallet')
    } catch (error) {
      console.error('Error disconnecting from wallet:', error)
    }
  } else {
    console.log('No wallet connected')
  }
}

export const disconnectAllAccounts = async (): Promise<void> => {
  const config = await configPromise
  await disconnect(config)
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
    return handleWagmiError(error)
  }
}

const handleWagmiError = (error: unknown): Error => {
  if (error instanceof Error) {
    // Check for specific error types
    if (error instanceof BaseError) {
      return handleBaseError(error)
    } else if (error instanceof ChainNotConfiguredError) {
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
    } else {
      // Handle unknown error types
      console.error('Unhandled Wagmi Error:', error)
      throw new Error('An unexpected error occurred')
    }
  } else {
    // Handle non-Error types
    console.error('Non-Error Wagmi Error:', error)
    throw new Error('An unexpected non-Error error occurred')
  }
}

// All errors extend base error
const handleBaseError = (error: BaseError): Error => {
  console.error('Base Error:', error.message)
  throw new Error(error.message)
}

const handleChainNotConfiguredError = (
  error: ChainNotConfiguredError
): Error => {
  console.error('Chain Not Configured Error:', error.message)
  throw new Error(`Chain not configured: ${error.message}`)
}

const handleConnectorAccountNotFoundError = (
  error: ConnectorAccountNotFoundError
): Error => {
  console.error('Connector Account Not Found Error:', error.message)
  throw new Error(`Connector account not found: ${error.message}`)
}

const handleConnectorAlreadyConnectedError = (
  error: ConnectorAlreadyConnectedError
): Error => {
  console.error('Connector Already Connected Error:', error.message)
  throw new Error(`Connector already connected: ${error.message}`)
}

const handleConnectorNotConnectedError = (
  error: ConnectorNotConnectedError
): Error => {
  console.error('Connector Not Connected Error:', error.message)
  throw new Error(`Connector not connected: ${error.message}`)
}

const handleConnectorNotFoundError = (error: ConnectorNotFoundError): Error => {
  console.error('Connector Not Found Error:', error.message)
  throw new Error(`Connector not found: ${error.message}`)
}

const handleProviderNotFoundError = (error: ProviderNotFoundError): Error => {
  console.error('Provider Not Found Error:', error.message)
  throw new Error(`Provider not found: ${error.message}`)
}

const handleSwitchChainNotSupportedError = (
  error: SwitchChainNotSupportedError
): Error => {
  console.error('Switch Chain Not Supported Error:', error.message)
  throw new Error(`Switch chain not supported: ${error.message}`)
}

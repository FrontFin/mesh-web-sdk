import { getConnectors } from '@wagmi/core'
import { config } from './wagmiCore'
import { WagmiInjectedConnectorData } from './types'
import { parseUnits } from 'viem'
import {
  connect,
  disconnect,
  getConnections,
  getAccount,
  signMessage,
  getBalance,
  sendTransaction,
  switchChain
} from '@wagmi/core'
import {
  type Connection,
  type Connector,
  type Chain,
  type GetAccountReturnType
} from '@wagmi/core'

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

export const getAllWagmiCoreInjectedData = (): Connector[] => {
  const connectors = getConnectors(config)
  return connectors
}

export const connectToSpecificWallet = async (
  walletName: string
): Promise<Connection> => {
  try {
    const connectors = getConnectors(config)

    const selectedConnector = connectors.find(
      (connector: Connection) =>
        connector.name.toLowerCase() === walletName.toLowerCase()
    )

    console.log('connector', selectedConnector)

    if (!selectedConnector) {
      throw new Error(`No connector found for wallet: ${walletName}`)
    }

    const account = getAccount(config)
    console.log('account', account)
    console.log('accountStatus', account.status)
    if (account.status === 'connected') {
      await disconnect(config)
      console.log('disconnected')
    }
    const result = await connect(config, { connector: selectedConnector })
    console.log('Connection Result:', result)
    return result
  } catch (error) {
    console.error('Connection Error:', error)
    throw error
  }
}

export const signedMessage = async (): Promise<string> => {
  const account = getAccount(config)
  const signedMessage = await signMessage(config, {
    account,
    message: 'Sign to verify ownership of wallet'
  })
  console.log('signedMessage', signedMessage)
  return signedMessage
}

export const walletBalance = async (
  account: string,
  chainId: number
): Promise<string> => {
  const balance = await getBalance(config, {
    address: account,
    chainId: chainId
  })
  console.log('balance', balance)
  return balance
}

export const switchChainFromSDK = async (chainId: number): Promise<Chain> => {
  const result = await switchChain(config, { chainId })
  // console.log('switchChain', result)
  return result
}

export const sendTransactionFromSDK = async (
  toAddress: string,
  amount: number,
  decimalPlaces: number,
  chainId: number,
  account: string,
  connectorName: string,
  allInjectedCoreConnectorData: Connector[]
): Promise<string> => {
  const currentConnections1 = await getConnections(config)
  console.log('currentConnections1', currentConnections1)
  const account1 = await getAccount(config)
  console.log('accountBefore', account1)
  if (account1.status === 'connected') {
    await disconnect(config)
    console.log('disconnected')
  }
  console.log('injectedCoreConnectors', allInjectedCoreConnectorData)
  const selectedConnector = allInjectedCoreConnectorData.find(
    (connector: Connector) =>
      connector.name.toLowerCase() === connectorName.toLowerCase()
  )
  console.log('selectedConnector', selectedConnector)
  config.connectorClient = selectedConnector
  const connection = await connect(config, { connector: selectedConnector })
  console.log('connection', connection)
  const currentConnections2 = await getConnections(config)
  console.log('currentConnectionsAfter', currentConnections2)
  const account2 = await getAccount(config)
  console.log('accountAfter', account2)
  const result = await sendTransaction(config, {
    to: toAddress as `0x${string}`,
    value: parseUnits(amount.toFixed(decimalPlaces) || '0', decimalPlaces || 0),
    chainId: chainId,
    account: account
  })
  console.log('sendTransaction', result)
  return result
}

export const checkActiveAccounts = async (): Promise<GetAccountReturnType> => {
  const currentAccounts = await getAccount(config)
  console.log('currentAccounts', currentAccounts)
  return currentAccounts
}

export const checkActiveConnections = async (): Promise<Connection[]> => {
  const currentConnections = await getConnections(config)
  console.log('currentConnections', currentConnections)
  return currentConnections
}

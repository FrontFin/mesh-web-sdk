import { BaseWalletStrategy } from './WalletStrategy'
import {
  WalletBrowserPayload,
  SignRequestPayload,
  ChainSwitchPayload,
  TransferPayload,
  SmartContractPayload,
  DisconnectPayload,
  TransactionBatchPayload,
  WalletCapabilitiesPayload
} from '../types'
import {
  connectToEVMWallet,
  disconnectFromEVMWallet,
  signEVMMessage,
  sendEVMTransaction,
  sendEVMTokenTransaction,
  sendNativeSmartContractTransaction,
  switchEVMChain,
  findAvailableProviders,
  sendEVMTransactionBatch,
  getWalletCapabilities
} from '../connectors/evm'

export class EVMWalletStrategy extends BaseWalletStrategy {
  sendTransactionWithInstructions(): Promise<string> {
    throw new Error('Method not implemented.')
  }
  async connect(payload: WalletBrowserPayload) {
    try {
      const result = await connectToEVMWallet(
        payload.integrationName,
        payload.targetChainId ? parseInt(payload.targetChainId, 10) : undefined
      )

      if (result instanceof Error) {
        throw result
      }

      return {
        accounts: result.accounts,
        chainId: result.chainId,
        isConnected: result.isConnected
      }
    } catch (error) {
      throw this.handleError(error, 'connect to EVM wallet')
    }
  }

  async disconnect(payload: DisconnectPayload) {
    try {
      const result = await disconnectFromEVMWallet(
        payload.walletName || 'Unknown Wallet'
      )
      if (result instanceof Error) {
        throw result
      }
    } catch (error) {
      throw this.handleError(error, 'disconnect from EVM wallet')
    }
  }

  async signMessage(payload: SignRequestPayload) {
    try {
      const result = await signEVMMessage(
        payload.walletName || 'Unknown Wallet',
        payload.address,
        payload.message
      )
      if (result instanceof Error) {
        throw result
      }
      return result
    } catch (error) {
      throw this.handleError(error, 'sign EVM message')
    }
  }

  async switchChain(payload: ChainSwitchPayload) {
    try {
      const result = await switchEVMChain(payload.chainId)
      if (result instanceof Error) {
        throw result
      }
      return result
    } catch (error) {
      throw this.handleError(error, 'switch EVM chain')
    }
  }

  async sendNativeTransfer(payload: TransferPayload) {
    try {
      const result = await sendEVMTransaction(
        payload.toAddress,
        BigInt(payload.amount * Math.pow(10, payload.decimalPlaces)),
        payload.account,
        payload.gasLimit,
        payload.maxFeePerGas,
        payload.maxPriorityFeePerGas
      )
      if (result instanceof Error) {
        throw result
      }
      return result
    } catch (error) {
      throw this.handleError(error, 'send EVM native transfer')
    }
  }

  async sendSmartContractInteraction(payload: SmartContractPayload) {
    try {
      const result = await sendEVMTokenTransaction(
        payload.address,
        JSON.parse(payload.abi),
        payload.functionName,
        payload.args,
        payload.account
      )
      if (result instanceof Error) {
        throw result
      }
      return result
    } catch (error) {
      throw this.handleError(error, 'send EVM smart contract interaction')
    }
  }

  async sendNativeSmartContractInteraction(
    payload: SmartContractPayload
  ): Promise<string> {
    try {
      const result = await sendNativeSmartContractTransaction(
        payload.address,
        JSON.parse(payload.abi),
        payload.functionName,
        payload.args,
        payload.account,
        payload.value
      )
      if (result instanceof Error) {
        throw result
      }
      return result
    } catch (error) {
      throw this.handleError(error, 'send EVM smart contract interaction')
    }
  }

  async sendTransactionBatch(payload: TransactionBatchPayload) {
    try {
      const result = await sendEVMTransactionBatch(payload)
      if (result instanceof Error) {
        throw result
      }
      return result
    } catch (error) {
      throw this.handleError(error, 'send EVM smart contract interaction')
    }
  }

  async getWalletCapabilities(
    payload: WalletCapabilitiesPayload
  ): Promise<{ atomic: { status: string } }> {
    const result = await getWalletCapabilities(payload.from, payload.chainId)
    return result
  }

  getProviders() {
    return findAvailableProviders().map(provider => ({
      icon: provider.icon,
      id: provider.id,
      name: provider.name,
      type: 'evm'
    }))
  }
}

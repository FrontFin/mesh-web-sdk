import { BaseWalletStrategy } from './WalletStrategy'
import {
  WalletBrowserPayload,
  SignRequestPayload,
  ChainSwitchPayload,
  TransferPayload,
  SmartContractPayload,
  DisconnectPayload
} from '../types'
import {
  connectToSolanaWallet,
  disconnectFromSolanaWallet,
  signSolanaMessage,
  sendSOLTransaction,
  findAvailableSolanaProviders
} from '../connectors/solana'

export class SolanaWalletStrategy extends BaseWalletStrategy {
  async connect(payload: WalletBrowserPayload) {
    try {
      const result = await connectToSolanaWallet(payload.integrationName)
      if (result instanceof Error) {
        throw result
      }
      return {
        accounts: result.accounts,
        chainId: result.chainId,
        isConnected: result.isConnected
      }
    } catch (error) {
      throw this.handleError(error, 'connect to Solana wallet')
    }
  }

  async disconnect(payload: DisconnectPayload) {
    try {
      const result = await disconnectFromSolanaWallet(
        payload.walletName || 'Unknown Wallet'
      )
      if (result instanceof Error) {
        throw result
      }
    } catch (error) {
      throw this.handleError(error, 'disconnect from Solana wallet')
    }
  }

  async signMessage(payload: SignRequestPayload) {
    try {
      const result = await signSolanaMessage(
        payload.walletName || 'Unknown Wallet',
        payload.message
      )
      if (result instanceof Error) {
        throw result
      }
      return result
    } catch (error) {
      throw this.handleError(error, 'sign Solana message')
    }
  }

  /**
   * @note Solana doesn't support chain switching as it's a single-chain network
   * This method is implemented to satisfy the interface but will always return mainnet (101)
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async switchChain(_payload: ChainSwitchPayload): Promise<{
    chainId: string
    accounts: string[]
  }> {
    return {
      chainId: '101',
      accounts: []
    }
  }

  async sendNativeTransfer(payload: TransferPayload) {
    try {
      const result = await sendSOLTransaction({
        toAddress: payload.toAddress,
        amount: BigInt(payload.amount * Math.pow(10, payload.decimalPlaces)),
        fromAddress: payload.account,
        blockhash: payload.blockhash || '',
        walletName: payload.walletName || ''
      })

      if (typeof result === 'string') {
        return result
      }
      throw result
    } catch (error) {
      throw this.handleError(error, 'send Solana native transfer')
    }
  }

  /**
   * @note This feature is not yet implemented for Solana
   * @throws {Error} Always throws with a "not implemented" message
   */
  async sendSmartContractInteraction(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _payload: SmartContractPayload
  ): Promise<string> {
    throw new Error(
      'NOT_IMPLEMENTED: Solana smart contract interactions are not yet supported'
    )
  }

  getProviders() {
    const solanaProviderMap = findAvailableSolanaProviders()
    return Object.keys(solanaProviderMap).map(id => ({
      id,
      type: 'solana'
    }))
  }
}

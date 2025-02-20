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
        payload.address,
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

  async switchChain(payload: ChainSwitchPayload) {
    // Solana doesn't need chain switching as it's a single chain
    // Get the current connected account from the provider
    const provider = (window as any).solana
    const account = provider?.publicKey?.toString() || ''

    return {
      chainId: '101',
      accounts: [account]
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

  async sendSmartContractInteraction(
    payload: SmartContractPayload
  ): Promise<string> {
    // For now, we don't support Solana smart contract interactions directly
    throw new Error('Solana smart contract interactions not supported')
  }

  getProviders() {
    const solanaProviderMap = findAvailableSolanaProviders()
    return Object.keys(solanaProviderMap).map(id => ({
      id,
      type: 'solana'
    }))
  }
}

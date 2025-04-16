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
  findAvailableSolanaProviders,
  getSolanaProvider
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

  async sendSmartContractInteraction(
    payload: SmartContractPayload
  ): Promise<string> {
    // Get the sender's address from the connected wallet if not provided
    const provider = getSolanaProvider(payload.walletName || '')
    const senderAddress =
      payload.account || (await provider.publicKey?.toString())

    if (!senderAddress) {
      throw new Error('Sender account address is required')
    }

    // Convert the amount to the correct scale based on token decimals
    const decimals = (payload.args[2] as number) || 6 // USDC has 6 decimals
    const rawAmount = payload.args[1] as bigint
    const scaledAmount = rawAmount

    if (!payload.blockhash) {
      throw new Error('Blockhash is required for Solana transactions')
    }

    return await sendSOLTransaction({
      toAddress: payload.args[0] as string,
      amount: scaledAmount,
      fromAddress: senderAddress,
      blockhash: payload.blockhash,
      walletName: payload.walletName || '',
      tokenMint: payload.address,
      tokenDecimals: decimals
    })
  }

  getProviders() {
    const solanaProviderMap = findAvailableSolanaProviders()
    return Object.keys(solanaProviderMap).map(id => ({
      id,
      type: 'solana'
    }))
  }
}

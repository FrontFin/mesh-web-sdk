import { BaseWalletStrategy } from './WalletStrategy'
import {
  WalletBrowserPayload,
  SignRequestPayload,
  ChainSwitchPayload,
  TransferPayload,
  SmartContractPayload,
  DisconnectPayload,
  SolanaTransferWithInstructionsPayload
} from '../types'
import {
  connectToSolanaWallet,
  disconnectFromSolanaWallet,
  signSolanaMessage,
  sendSOLTransaction,
  findAvailableSolanaProviders,
  getSolanaProvider,
  sendSOLTransactionWithInstructions
} from '../connectors/solana'

export class SolanaWalletStrategy extends BaseWalletStrategy {
  async connect(payload: WalletBrowserPayload) {
    try {
      const result = await connectToSolanaWallet(payload)
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
   * Handles chain switching for Solana networks
   * Supports both mainnet (101) and devnet (103)
   */
  async switchChain(payload: ChainSwitchPayload): Promise<{
    chainId: string
    accounts: string[]
  }> {
    // Check if the requested chainId is for Solana Devnet (103)
    if (payload.chainId === 103) {
      return {
        chainId: '103',
        accounts: []
      }
    }

    // Default to mainnet (101) for all other cases
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
    const decimals = (payload.args[2] as number) || 9
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
      createATA: payload.createATA || false,
      tokenProgram: payload.tokenProgram,
      tokenDecimals: decimals
    })
  }

  async sendTransactionWithInstructions(
    payload: SolanaTransferWithInstructionsPayload
  ): Promise<string> {
    const provider = getSolanaProvider(
      payload.transactionInstructions.walletName || ''
    )
    const senderAddress =
      payload.transferConfig.account || (await provider.publicKey?.toString())

    if (!senderAddress) {
      throw new Error('Sender account address is required')
    }

    // Convert the amount to the correct scale based on token decimals
    const decimals = (payload.transferConfig.args[2] as number) || 6 // USDC has 6 decimals
    const rawAmount = payload.transferConfig.args[1] as bigint
    const scaledAmount = rawAmount

    if (!payload.transactionInstructions.blockhash) {
      throw new Error('Blockhash is required for Solana transactions')
    }

    try {
      const result = await sendSOLTransactionWithInstructions(payload, {
        toAddress: payload.transferConfig.args[0] as string,
        amount: scaledAmount,
        fromAddress: senderAddress,
        blockhash: payload.transactionInstructions.blockhash,
        walletName: payload.transactionInstructions.walletName || '',
        tokenMint: payload.transferConfig.address,
        createATA: payload.transferConfig.createATA || false,
        tokenProgram: payload.transferConfig.tokenProgram,
        tokenDecimals: decimals
      })
      if (typeof result === 'string') {
        return result
      }
      throw result
    } catch (error) {
      throw this.handleError(error, 'send Solana native transfer')
    }
  }
  sendNativeSmartContractInteraction(): Promise<string> {
    throw new Error('Method not implemented.')
  }

  sendTransactionBatch(): Promise<string> {
    throw new Error('Method not implemented.')
  }

  async getWalletCapabilities(): Promise<{ atomic: { status: string } }> {
    return {
      atomic: {
        status: 'ready'
      }
    }
  }

  getProviders() {
    const solanaProviderMap = findAvailableSolanaProviders()
    return Object.keys(solanaProviderMap).map(id => ({
      id,
      type: 'solana'
    }))
  }
}

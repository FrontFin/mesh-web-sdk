import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction
} from '@solana/web3.js'
import bs58 from 'bs58'
import { getSolanaProvider } from './providerDiscovery'
import { TransactionConfig } from './types'

const QUICKNODE_RPC =
  'https://alien-newest-vineyard.solana-mainnet.quiknode.pro/ebe5e35661d7edb7a5e48ab84bd9d477e472a40b/'

const isUserRejection = (error: any): boolean => {
  if (!error) return false

  const message = (error?.message || '').toLowerCase()
  return (
    message.includes('user rejected') ||
    message.includes('declined') ||
    message.includes('cancelled') ||
    message.includes('denied') ||
    error?.code === 4001
  )
}

const standardizeSignature = (rawSignature: string | Uint8Array): string => {
  // First ensure we have a string
  let signature =
    typeof rawSignature === 'string' ? rawSignature : bs58.encode(rawSignature)

  // If signature is longer than standard 88 chars, decode and re-encode
  if (signature.length > 88) {
    try {
      const bytes = bs58.decode(signature)
      const truncatedBytes = bytes.slice(0, 64)
      signature = bs58.encode(truncatedBytes)
    } catch (e) {
      console.error('Failed to normalize signature:', e)
    }
  }

  return signature
}

const createTransferTransaction = (config: TransactionConfig): Transaction => {
  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: new PublicKey(config.fromAddress),
      toPubkey: new PublicKey(config.toAddress),
      lamports: config.amount
    })
  )

  transaction.recentBlockhash = config.blockhash
  transaction.feePayer = new PublicKey(config.fromAddress)

  return transaction
}

const handleManualSignAndSend = async (
  transaction: Transaction,
  provider: any
): Promise<string> => {
  try {
    const signedTx = await provider.signTransaction(transaction)
    const connection = new Connection(QUICKNODE_RPC)
    const rawSignature = await connection.sendRawTransaction(
      signedTx.serialize(),
      {
        skipPreflight: false,
        maxRetries: 3,
        preflightCommitment: 'confirmed'
      }
    )
    return standardizeSignature(rawSignature)
  } catch (error: any) {
    if (isUserRejection(error)) {
      throw new Error('Transaction was rejected by user')
    }
    throw error
  }
}

export const sendSOLTransaction = async (
  config: TransactionConfig
): Promise<string> => {
  try {
    const provider = getSolanaProvider(config.walletName)
    const transaction = createTransferTransaction(config)

    const isManualWallet =
      (provider as any).isTrust ||
      (provider as any).isTrustWallet ||
      config.walletName.toLowerCase().includes('trust')

    // For Trust Wallet, always use manual sign and send
    if (isManualWallet) {
      try {
        return await handleManualSignAndSend(transaction, provider)
      } catch (error: any) {
        if (isUserRejection(error)) {
          throw new Error('Transaction was rejected by user')
        }
        throw error
      }
    }

    // For other wallets, try native signAndSendTransaction first
    if (provider.signAndSendTransaction) {
      try {
        const { signature } = await provider.signAndSendTransaction(transaction)
        return signature
      } catch (error: any) {
        if (isUserRejection(error)) {
          throw new Error('Transaction was rejected by user')
        }
        // For other errors, fall back to manual sign and send
        return handleManualSignAndSend(transaction, provider)
      }
    }

    // If no signAndSendTransaction available, use manual method
    return handleManualSignAndSend(transaction, provider)
  } catch (error: any) {
    if (isUserRejection(error)) {
      throw new Error('Transaction was rejected by user')
    }
    throw error instanceof Error
      ? error
      : new Error(
          `Failed to send SOL transaction with ${config.walletName} wallet`
        )
  }
}

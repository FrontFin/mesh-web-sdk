import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction
} from '@meshconnect/solana-web3.js'
import { getSolanaProvider } from './providerDiscovery'
import { TransactionConfig, SolanaProvider } from './types'

const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
)
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
)

const isUserRejection = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false
  const err = error as Record<string, any>
  const message = (err.message || '').toLowerCase()
  return (
    message.includes('user rejected') ||
    message.includes('declined') ||
    message.includes('cancelled') ||
    message.includes('denied') ||
    err.code === 4001
  )
}

export async function getAssociatedTokenAddress(
  mint: PublicKey,
  owner: PublicKey
): Promise<PublicKey> {
  const [address] = await PublicKey.findProgramAddress(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  return address
}

export function createSPLTransferInstruction({
  fromTokenAccount,
  toTokenAccount,
  owner,
  amount
}: {
  fromTokenAccount: PublicKey
  toTokenAccount: PublicKey
  owner: PublicKey
  amount: bigint
}): TransactionInstruction {
  const data = Buffer.alloc(9)
  data[0] = 3 // Transfer instruction
  data.writeBigUInt64LE(amount, 1)

  return new TransactionInstruction({
    keys: [
      { pubkey: fromTokenAccount, isSigner: false, isWritable: true },
      { pubkey: toTokenAccount, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false }
    ],
    programId: TOKEN_PROGRAM_ID,
    data
  })
}

export async function createTransferTransaction(config: {
  fromAddress: string
  toAddress: string
  amount: bigint
  tokenMint?: string
  blockhash: string
}): Promise<VersionedTransaction> {
  const fromPubkey = new PublicKey(config.fromAddress)
  const toPubkey = new PublicKey(config.toAddress)

  let instruction: TransactionInstruction

  if (!config.tokenMint) {
    // Native SOL transfer
    instruction = SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports: Number(config.amount)
    })
  } else {
    // Token transfer
    const tokenMintPubkey = new PublicKey(config.tokenMint)
    const fromTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      fromPubkey
    )
    const toTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      toPubkey
    )

    instruction = createSPLTransferInstruction({
      fromTokenAccount,
      toTokenAccount,
      owner: fromPubkey,
      amount: BigInt(config.amount)
    })
  }

  const messageV0 = new TransactionMessage({
    payerKey: fromPubkey,
    recentBlockhash: config.blockhash,
    instructions: [instruction]
  }).compileToV0Message()

  return new VersionedTransaction(messageV0)
}

export async function handleManualSignAndSend(
  transaction: VersionedTransaction,
  provider: SolanaProvider
): Promise<string> {
  try {
    if (provider.signAndSendTransaction) {
      const { signature } = await provider.signAndSendTransaction(transaction)
      return signature
    } else {
      const signedTransaction = await provider.signTransaction(transaction)
      if (!provider.sendTransaction) {
        throw new Error('Provider does not support sendTransaction')
      }
      const signature = await provider.sendTransaction(signedTransaction)
      return signature
    }
  } catch (error: unknown) {
    console.error('Error in handleManualSignAndSend:', error)
    if (error instanceof Error && error.message?.includes('User rejected')) {
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
    const transaction = await createTransferTransaction(config)

    const isManualWallet =
      (provider as any).isTrust ||
      (provider as any).isTrustWallet ||
      config.walletName.toLowerCase().includes('trust')

    if (isManualWallet) {
      return await handleManualSignAndSend(transaction, provider)
    }

    if (provider.signAndSendTransaction) {
      try {
        const { signature }: { signature: string } =
          await provider.signAndSendTransaction(transaction)
        return signature
      } catch (error) {
        if (isUserRejection(error)) {
          throw new Error('Transaction was rejected by user')
        }
        return handleManualSignAndSend(transaction, provider)
      }
    }

    return handleManualSignAndSend(transaction, provider)
  } catch (error) {
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

import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
  Connection
} from '@meshconnect/solana-web3.js'
import { getSolanaProvider } from './providerDiscovery'
import { TransactionConfig, SolanaProvider } from './types'

const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
)
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
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
  owner: PublicKey,
  programId = TOKEN_PROGRAM_ID.toBase58()
): Promise<PublicKey> {
  const [address] = await PublicKey.findProgramAddress(
    [owner.toBuffer(), new PublicKey(programId).toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  )
  return address
}

export function createTransferCheckedInstruction(
  fromTokenAccount: PublicKey,
  toTokenAccount: PublicKey,
  owner: PublicKey,
  amount: bigint,
  decimals = 9,
  tokenMint: PublicKey
): TransactionInstruction {
  const data = Buffer.alloc(10)
  data[0] = 12 // TransferChecked instruction enum
  data.writeBigUInt64LE(amount, 1) // 8-byte amount
  data[9] = decimals // single-byte decimal

  const programId = TOKEN_2022_PROGRAM_ID

  return new TransactionInstruction({
    keys: [
      { pubkey: fromTokenAccount, isSigner: false, isWritable: true },
      { pubkey: tokenMint, isSigner: false, isWritable: false },
      { pubkey: toTokenAccount, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false }
    ],
    programId,
    data
  })
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

export async function createTransferTransaction(
  config: TransactionConfig
): Promise<VersionedTransaction> {
  const fromPubkey = new PublicKey(config.fromAddress)
  const toPubkey = new PublicKey(config.toAddress)

  let instruction: TransactionInstruction

  if (!config.tokenMint) {
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
      fromPubkey,
      config.tokenProgram
    )

    const toTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      toPubkey,
      config.tokenProgram
    )

    instruction =
      config.tokenProgram === TOKEN_2022_PROGRAM_ID.toBase58()
        ? createTransferCheckedInstruction(
            fromTokenAccount,
            toTokenAccount,
            fromPubkey,
            BigInt(config.amount),
            config.tokenDecimals,
            tokenMintPubkey
          )
        : createSPLTransferInstruction({
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

    const walletPublicKey = new PublicKey(config.fromAddress)

    if (config.tokenMint) {
      let connection
      // special use case for PYUSD on solana devnet. TODO: make it generic
      if (config.tokenMint === 'CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM') {
        connection = new Connection(
          'https://api.devnet.solana.com',
          'confirmed'
        )
      } else {
        connection = new Connection(
          'https://api.mainnet-beta.solana.com',
          'confirmed'
        )
      }
      const token2022Accounts = await connection.getTokenAccountsByOwner(
        walletPublicKey,
        { programId: TOKEN_2022_PROGRAM_ID }
      )
      config.tokenProgram = token2022Accounts?.value.length
        ? TOKEN_2022_PROGRAM_ID.toBase58()
        : TOKEN_PROGRAM_ID.toBase58()
    }

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

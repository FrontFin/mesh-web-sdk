import {
  PublicKey,
  SystemProgram,
  TransactionMessage,
  VersionedTransaction,
  TransactionInstruction,
  Connection,
  AddressLookupTableAccount
} from '@meshconnect/solana-web3.js'
import { getSolanaProvider } from './providerDiscovery'
import { TransactionConfig, SolanaProvider } from './types'
import {
  SolanaTransferWithInstructionsPayload,
  TransactionInstructionDto
} from '@/utils/types'

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

function createTokenAccountInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  programId = TOKEN_PROGRAM_ID
): TransactionInstruction {
  const keys = [
    { pubkey: payer, isSigner: true, isWritable: true },
    { pubkey: associatedToken, isSigner: false, isWritable: true },
    { pubkey: owner, isSigner: false, isWritable: false },
    { pubkey: mint, isSigner: false, isWritable: false },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: programId, isSigner: false, isWritable: false }
  ]

  return new TransactionInstruction({
    keys,
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.alloc(0)
  })
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
  const instructions = await createTransferInstructions(config)

  const fromPubkey = new PublicKey(config.fromAddress)

  const messageV0 = new TransactionMessage({
    payerKey: fromPubkey,
    recentBlockhash: config.blockhash,
    instructions
  }).compileToV0Message()

  return new VersionedTransaction(messageV0)
}

async function createTransferInstructions(config: TransactionConfig) {
  const fromPubkey = new PublicKey(config.fromAddress)
  const toPubkey = new PublicKey(config.toAddress)
  const instructions: TransactionInstruction[] = []

  if (!config.tokenMint) {
    instructions.push(
      SystemProgram.transfer({
        fromPubkey,
        toPubkey,
        lamports: Number(config.amount)
      })
    )
  } else {
    let connection
    // special use case for PYUSD on solana devnet. TODO: make it generic
    if (config.tokenMint === 'CXk2AMBfi3TwaEL2468s6zP8xq9NxTXjp9gjMgzeUynM') {
      connection = new Connection('https://api.devnet.solana.com', 'confirmed')
    } else {
      connection = new Connection(
        'https://api.mainnet-beta.solana.com',
        'confirmed'
      )
    }
    const token2022Accounts = await connection.getTokenAccountsByOwner(
      fromPubkey,
      { programId: TOKEN_2022_PROGRAM_ID }
    )
    const tokenMintPubkey = new PublicKey(config.tokenMint)

    const fromTokenAccount2022 = await getAssociatedTokenAddress(
      tokenMintPubkey,
      fromPubkey,
      TOKEN_2022_PROGRAM_ID.toBase58()
    )

    const tokenProgram = token2022Accounts?.value.filter(
      x => x.pubkey.toBase58() === fromTokenAccount2022.toBase58()
    ).length
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID

    const fromTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      fromPubkey,
      tokenProgram.toBase58()
    )
    config.tokenProgram = tokenProgram.toBase58()

    const toTokenAccount = await getAssociatedTokenAddress(
      tokenMintPubkey,
      toPubkey,
      config.tokenProgram
    )

    if (
      !(
        await connection.getTokenAccountsByOwner(toPubkey, {
          programId: tokenProgram
        })
      )?.value.filter(x => x.pubkey.toBase58() === toTokenAccount.toBase58())
        .length
    ) {
      instructions.push(
        createTokenAccountInstruction(
          fromPubkey,
          toTokenAccount,
          toPubkey,
          tokenMintPubkey,
          tokenProgram
        )
      )
    }

    if (config.tokenProgram === TOKEN_2022_PROGRAM_ID.toBase58()) {
      instructions.push(
        createTransferCheckedInstruction(
          fromTokenAccount,
          toTokenAccount,
          fromPubkey,
          BigInt(config.amount),
          config.tokenDecimals,
          tokenMintPubkey
        )
      )
    } else {
      instructions.push(
        createSPLTransferInstruction({
          fromTokenAccount,
          toTokenAccount,
          owner: fromPubkey,
          amount: BigInt(config.amount)
        })
      )
    }
  }
  return instructions
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

export async function getTransferInstructions(
  instructions: TransactionInstructionDto[]
): Promise<TransactionInstruction[]> {
  const result: TransactionInstruction[] = []

  for (let instrIndex = 0; instrIndex < instructions.length; instrIndex++) {
    const ix = instructions[instrIndex]
    const programId = new PublicKey(ix.programId)

    const keys = await Promise.all(
      ix.accounts.map(async (meta, accountIndex) => {
        if (!meta.pubKey) {
          throw new Error(
            `Account at instruction ${instrIndex}, index ${accountIndex} has no pubKey and is not fillable`
          )
        }

        const resolvedPubkey: PublicKey = new PublicKey(meta.pubKey)
        return {
          pubkey: resolvedPubkey,
          isSigner: meta.isSigner,
          isWritable: meta.isWritable
        }
      })
    )

    result.push(
      new TransactionInstruction({
        keys,
        programId,
        data: Buffer.from(ix.data, 'base64')
      })
    )
  }

  return result
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

        // @TODO: validate that signature was a successful tx
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

export const sendSOLTransactionWithInstructions = async (
  payload: SolanaTransferWithInstructionsPayload,
  transferConfig: TransactionConfig
): Promise<string> => {
  const walletName = payload.transactionInstructions.walletName || 'Phantom'
  try {
    const provider = getSolanaProvider(walletName)
    const instructions = await getTransferInstructions(
      payload.transactionInstructions.instructions
    )

    const fromPubkey = new PublicKey(transferConfig.fromAddress)

    const transferInstructions = await createTransferInstructions(
      transferConfig
    )

    instructions.push(...transferInstructions)

    const transaction = new VersionedTransaction(
      new TransactionMessage({
        payerKey: fromPubkey,
        recentBlockhash: payload.transactionInstructions.blockhash,
        instructions: instructions
      }).compileToV0Message()
    )

    const isManualWallet =
      (provider as any).isTrust ||
      (provider as any).isTrustWallet ||
      walletName.includes('trust')

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
      : new Error(`Failed to send SOL transaction with ${walletName} wallet`)
  }
}

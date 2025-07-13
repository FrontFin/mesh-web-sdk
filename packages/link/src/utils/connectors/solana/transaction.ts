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
import {
  SolanaAccountMeta,
  SolanaTransferWithInstructionsPayload,
  TransactionInstructionDto
} from '../../../utils/types'

const TOKEN_PROGRAM_ID = new PublicKey(
  'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
)
const TOKEN_2022_PROGRAM_ID = new PublicKey(
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'
)
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL'
)

// QuickNode RPC endpoint for Solana mainnet
const SOLANA_MAINNET_RPC_ENDPOINT = 'https://alien-newest-vineyard.solana-mainnet.quiknode.pro/ebe5e35661d7edb7a5e48ab84bd9d477e472a40b'

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

/**
 * Detects if we're in a mobile environment or using mobile wallet
 */
const isMobileEnvironment = (): boolean => {
  if (typeof window === 'undefined') return false

  // Check for mobile user agent
  const userAgent = window.navigator?.userAgent?.toLowerCase() || ''
  const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent)

  // Check if we're in a mobile app context (no window.phantom but has window.solana)
  const typedWindow = window as any
  const isMobileWallet = !typedWindow.phantom && typedWindow.solana

  return isMobile || isMobileWallet
}

/**
 * Gets a Solana connection for broadcasting transactions
 */
const getSolanaConnection = (): Connection => {
  // Use the same connection logic as in createTransferInstructions
  return new Connection(
    SOLANA_MAINNET_RPC_ENDPOINT,
    'confirmed'
  )
}

/**
 * Handles transaction signing and sending with environment-aware approach.
 *
 * For desktop browser extensions (like Phantom): Uses the proven signAndSendTransaction pattern
 * For mobile environments: Uses the recommended signTransaction + sendRawTransaction pattern per Phantom docs
 *
 * @see https://docs.phantom.com/phantom-deeplinks/provider-methods/signtransaction
 * @see https://docs.phantom.com/phantom-deeplinks/provider-methods/signandsendtransaction
 * @param transaction - The transaction to sign and send
 * @param provider - The Solana provider (e.g., Phantom wallet)
 * @returns Transaction signature
 */
export async function handleManualSignAndSend(
  transaction: VersionedTransaction,
  provider: SolanaProvider
): Promise<string> {
  try {
    // For desktop browser extensions: Preserve the working pattern
    if (!isMobileEnvironment() && provider.signAndSendTransaction) {
      const { signature } = await provider.signAndSendTransaction(transaction)
      return signature
    }

    // For mobile environments: Use recommended signTransaction + sendRawTransaction pattern
    // Per Phantom docs: "After receiving the signature, your app can broadcast the transaction
    // itself with sendRawTransaction in web3.js"
    if (provider.signTransaction) {
      const signedTransaction = await provider.signTransaction(transaction)
      const connection = getSolanaConnection()

      // Serialize and broadcast the signed transaction ourselves
      const rawTransaction = signedTransaction.serialize()
      const signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      })

      return signature
    }

    // Final fallback: Use deprecated method if it's the only option
    if (provider.signAndSendTransaction) {
      const { signature } = await provider.signAndSendTransaction(transaction)
      return signature
    }

    // If no signing method is available, throw error
    throw new Error('Provider does not support transaction signing')
  } catch (error: unknown) {
    console.error('Error in handleManualSignAndSend:', error)
    if (error instanceof Error && error.message?.includes('User rejected')) {
      throw new Error('Transaction was rejected by user')
    }
    throw error
  }
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
        SOLANA_MAINNET_RPC_ENDPOINT,
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

export async function getTransferInstructions(
  instructions: TransactionInstructionDto[]
): Promise<TransactionInstruction[]> {
  const result: TransactionInstruction[] = []

  for (let instrIndex = 0; instrIndex < instructions.length; instrIndex++) {
    const ix = instructions[instrIndex]
    const programId = new PublicKey(ix.programId)

    const keys = ix.accounts.map(
      (meta: SolanaAccountMeta, accountIndex: number) => {
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
      }
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

/**
 * Sends a SOL transaction with environment-aware approach.
 *
 * For desktop browser extensions: Uses proven signAndSendTransaction pattern (preserves working behavior)
 * For mobile environments: Uses Phantom-recommended signTransaction + web3.js sendRawTransaction pattern
 *
 * @see https://docs.phantom.com/phantom-deeplinks/provider-methods/signtransaction
 * @see https://docs.phantom.com/phantom-deeplinks/provider-methods/signandsendtransaction
 * @param config - Transaction configuration
 * @returns Transaction signature
 */
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

    // Environment-aware approach: Desktop keeps working pattern, mobile uses Phantom-recommended pattern
    if (!isMobileEnvironment() && provider.signAndSendTransaction) {
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

    // For mobile or when signAndSendTransaction is not available: Use Phantom-recommended pattern
    // signTransaction + sendRawTransaction (app controls broadcasting)
    if (provider.signTransaction) {
      try {
        const signedTransaction = await provider.signTransaction(transaction)
        const connection = getSolanaConnection()

        // Serialize and broadcast the signed transaction ourselves per Phantom docs
        const rawTransaction = signedTransaction.serialize()
        const signature = await connection.sendRawTransaction(rawTransaction, {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        })

        // @TODO: validate that signature was a successful tx
        return signature
      } catch (error) {
        if (isUserRejection(error)) {
          throw new Error('Transaction was rejected by user')
        }
        return handleManualSignAndSend(transaction, provider)
      }
    }

    // Final fallback: Use deprecated method if it's the only option
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

    return await sendSolanaTransfer(walletName, transaction)
  } catch (error) {
    if (isUserRejection(error)) {
      throw new Error('Transaction was rejected by user')
    }
    throw error instanceof Error
      ? error
      : new Error(`Failed to send SOL transaction with ${walletName} wallet`)
  }
}

/**
 * Sends a Solana transaction with environment-aware approach.
 *
 * For desktop browser extensions: Uses proven signAndSendTransaction pattern (preserves working behavior)
 * For mobile environments: Uses Phantom-recommended signTransaction + web3.js sendRawTransaction pattern
 *
 * @see https://docs.phantom.com/phantom-deeplinks/provider-methods/signtransaction
 * @see https://docs.phantom.com/phantom-deeplinks/provider-methods/signandsendtransaction
 * @param walletName - Name of the wallet to use
 * @param transaction - The transaction to send
 * @returns Transaction signature
 */
export const sendSolanaTransfer = async (
  walletName: string,
  transaction: VersionedTransaction
): Promise<string> => {
  const provider = getSolanaProvider(walletName)
  const isManualWallet =
    (provider as any).isTrust ||
    (provider as any).isTrustWallet ||
    walletName.includes('trust')

  if (isManualWallet) {
    return await handleManualSignAndSend(transaction, provider)
  }

  // Environment-aware approach: Desktop keeps working pattern, mobile uses Phantom-recommended pattern
  if (!isMobileEnvironment() && provider.signAndSendTransaction) {
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

  // For mobile or when signAndSendTransaction is not available: Use Phantom-recommended pattern
  // signTransaction + sendRawTransaction (app controls broadcasting)
  if (provider.signTransaction) {
    try {
      const signedTransaction = await provider.signTransaction(transaction)
      const connection = getSolanaConnection()

      // Serialize and broadcast the signed transaction ourselves per Phantom docs
      const rawTransaction = signedTransaction.serialize()
      const signature = await connection.sendRawTransaction(rawTransaction, {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      })

      return signature
    } catch (error) {
      if (isUserRejection(error)) {
        throw new Error('Transaction was rejected by user')
      }
      return handleManualSignAndSend(transaction, provider)
    }
  }

  // Final fallback: Use deprecated method if it's the only option
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
}

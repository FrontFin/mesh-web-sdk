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
  const fromPubkey = new PublicKey(config.fromAddress)
  const toPubkey = new PublicKey(config.toAddress)
  console.log('Sender address:', config.fromAddress)
  console.log('blockhash:', config.blockhash)

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
    const tokenProgram = token2022Accounts?.value.length
      ? TOKEN_2022_PROGRAM_ID
      : TOKEN_PROGRAM_ID
    config.tokenProgram = tokenProgram.toBase58()

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

    if (
      !(
        await connection.getTokenAccountsByOwner(toPubkey, {
          programId: tokenProgram
        })
      )?.value.length
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

  console.log('Transfer instruction:', instruction)

  const messageV0 = new TransactionMessage({
    payerKey: fromPubkey,
    recentBlockhash: config.blockhash,
    instructions
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

export async function getTransferInstructions(
  payer: string,
  instructions: TransactionInstructionDto[]
): Promise<TransactionInstruction[]> {
  const payerKey = new PublicKey(payer)

  const result: TransactionInstruction[] = []

  for (let instrIndex = 0; instrIndex < instructions.length; instrIndex++) {
    const ix = instructions[instrIndex]
    const programId = new PublicKey(ix.programId)

    const keys = await Promise.all(
      ix.accounts.map(async (meta, accountIndex) => {
        let resolvedPubkey: PublicKey

        if (meta.shouldFillPubkey) {
          if (meta.pubKey === undefined) {
            // Use payer for native SOL transfer
            resolvedPubkey = payerKey
          } else {
            try {
              const mint = new PublicKey(meta.pubKey!)
              // Derive payer's ATA for given mint
              resolvedPubkey = await getAssociatedTokenAddress(mint, payerKey)
            } catch (e) {
              throw new Error(
                `Invalid mint pubKey at instruction ${instrIndex}, account ${accountIndex}: ${meta.pubKey}`
              )
            }
          }
        } else {
          if (!meta.pubKey) {
            throw new Error(
              `Account at instruction ${instrIndex}, index ${accountIndex} has no pubKey and is not fillable`
            )
          }
          resolvedPubkey = new PublicKey(meta.pubKey)
        }

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

function getByteLength(obj: unknown): number {
  const json = JSON.stringify(obj)
  return Buffer.byteLength(json, 'utf8')
}

export const sendSOLTransactionWithInstructions = async (
  payload: SolanaTransferWithInstructionsPayload
): Promise<string> => {
  const walletName = payload.walletName || 'Phantom'
  console.log(payload)
  try {
    const provider = getSolanaProvider(walletName)
    console.log('blockhash:', payload.blockhash)
    const instructions = await getTransferInstructions(
      payload.account,
      payload.instructions
    )
    console.log('Instructions:', instructions)

    const addressLookupTableAccounts: AddressLookupTableAccount[] =
      payload.states.map(state => {
        return new AddressLookupTableAccount({
          key: new PublicKey(state.key),
          state: {
            deactivationSlot: state.deactivationSlot,
            lastExtendedSlot: state.lastExtendedSlot,
            lastExtendedSlotStartIndex: state.lastExtendedStartIndex,
            addresses: state.addresses.map(addr => new PublicKey(addr))
          }
        })
      })
    const allTxKeys = new Set(
      instructions.flatMap(ix => ix.keys.map(k => k.pubkey.toBase58()))
    )

    const allLookupAddresses = new Set(
      addressLookupTableAccounts.flatMap(alt =>
        alt.state.addresses.map(a => a.toBase58())
      )
    )

    const intersection = Array.from(allTxKeys).filter(k =>
      allLookupAddresses.has(k)
    )

    console.log(
      'Transaction keys that are actually in lookup tables:',
      intersection
    )
    console.log('Address lookup table accounts:', addressLookupTableAccounts)
    const fromPubkey = new PublicKey(payload.account!)
    const messageV0 = new TransactionMessage({
      payerKey: fromPubkey,
      recentBlockhash: payload.blockhash,
      instructions: instructions
    }).compileToV0Message(addressLookupTableAccounts)

    console.log('Compiled message V0:', getByteLength(messageV0))
    console.log(
      'Compiled message V0:long',
      getByteLength(
        new TransactionMessage({
          payerKey: fromPubkey,
          recentBlockhash: payload.blockhash,
          instructions: instructions
        }).compileToV0Message()
      )
    )

    const transaction = VersionedTransaction.deserialize(
      Buffer.from(
        'AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAQAHDR9Z+6RX/m8eOojbnlAUb1ZEB2rygUBSEFbacc8DQdihzOuNFaILYVKmgKp015YO6aejZj001UB6xPS6GTWXaMXQmZr1rJDtclN66upO9QSMHI4vf7LTTsWl50j1u/O3i+3xtvoh97eYFhrar79pEgHrrxMT9uil3jOnhFKf+a8+77AcehLFu/pgfxKbakVgfUkZL0tuwjW9JbNnnJMToK3y1Ilelux96OXIk46KxIX+0sMPjqt/kWT4kvRH4gcLvwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwZGb+UhFzL/7K26csOb57yM5bvF9xJrLEObOkAAAAAEedVb8jHAbu50xW7OaBUH/bGy3qP0jlECsc2iVrwTjwbd9uHXZaGT2cvhRs7reawctIXtX1s3kTqM9YV+/wCpFAwJw4hsHGqETzKTG88EqsMXhRmxwP5T1P8qcQ603jyMlyWPTiSJ8bs9ECkUjg2DC1oTmdr/EIQEjnvY2+n4WbQ/+if11/ZKdMCbHylYed5LCas238ndUUsyGqezjOXoXI20bKrM6tgEmsFdn19mEv1PU8bAhADW0sk7dUdNiA8IBwAFAsBcFQAHAAkD1HoLAAAAAAALBgAFABYGCQEBBgIABQwCAAAAgIQeAAAAAAAJAQUBEQsGAAEAGwYXAQEIKQkKAAUDAQEWGwgXDAgfCQoUAxUCERITBCAZCh4bAgEOEA8NHRgcGgkXKcEgmzNB1pyBAQIAAAARAWQAAU9kAQKAhB4AAAAAAPOgBAAAAAAAMgAACQMFAAABCQJ9wMcXAhzLZucTPtF6MmZ80NPWq9GD13dumGAXjalsagT0dHN3CQkZeXXz+PFv9yFlIouyhsBRKy498/fE68bpS/fs6s0Xz0yLE2MypDBQBZ6cp26kAgal',
        'base64'
      )
    ) //new VersionedTransaction(messageV0)

    console.log('Transaction', transaction)
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

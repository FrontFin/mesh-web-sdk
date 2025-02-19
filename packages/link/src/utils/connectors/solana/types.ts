import { Transaction } from '@solana/web3.js'
import { PublicKey } from '@solana/web3.js'

export interface SolanaConnectResult {
  accounts: string[]
  chainId: string
  isConnected: boolean
}

export interface SolanaProvider {
  connect(options?: {
    onlyIfTrusted?: boolean
  }): Promise<{ publicKey: { toString(): string; toBase58(): string } }>
  disconnect(): Promise<void>
  isPhantom?: boolean
  isSolflare?: boolean
  isTrust?: boolean
  isTrustWallet?: boolean
  isExodus?: boolean
  isConnected?: boolean
  publicKey?: { toString(): string; toBase58(): string }
  on(
    event: 'connect' | 'disconnect' | 'accountChanged',
    callback: (publicKey?: any) => void
  ): void
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>
  signTransaction(transaction: Transaction): Promise<Transaction>
  signAndSendTransaction?(
    transaction: Transaction
  ): Promise<{ signature: string }>
  sendTransaction?(transaction: Transaction): Promise<string>
}

export interface WindowWithSolanaProviders extends Window {
  solana?: SolanaProvider
  phantom?: {
    solana?: SolanaProvider
  }
  exodus?: {
    solana?: SolanaProvider
  }
  trustwallet?: {
    solana?: SolanaProvider
  }
  solflare?: SolanaProvider
  Buffer?: typeof Buffer
}

export interface TransactionConfig {
  toAddress: string
  amount: bigint
  fromAddress: string
  blockhash: string
  walletName: string
}

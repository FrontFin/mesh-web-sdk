import { Transaction, VersionedTransaction } from '@meshconnect/solana-web3.js'

export enum SolanaWalletType {
  PHANTOM = 'phantom',
  SOLFLARE = 'solflare',
  TRUST = 'trustwallet',
  EXODUS = 'exodus',
  UNKNOWN = 'unknown'
}

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
  walletType?: SolanaWalletType
  isConnected?: boolean
  publicKey?: { toString(): string; toBase58(): string }
  on(
    event: 'connect' | 'disconnect' | 'accountChanged',
    callback: (publicKey?: any) => void
  ): void
  signMessage(message: Uint8Array): Promise<{ signature: Uint8Array }>
  signTransaction(
    transaction: Transaction | VersionedTransaction
  ): Promise<Transaction | VersionedTransaction>
  signAndSendTransaction?(
    transaction: Transaction | VersionedTransaction
  ): Promise<{ signature: string }>
  sendTransaction?(
    transaction: Transaction | VersionedTransaction
  ): Promise<string>
}

export interface WindowWithSolanaProviders extends Window {
  solana?: SolanaProvider & {
    isPhantom?: boolean
    isSolflare?: boolean
    isTrust?: boolean
    isTrustWallet?: boolean
    isExodus?: boolean
  }
  phantom?: { solana?: SolanaProvider }
  exodus?: { solana?: SolanaProvider }
  trustwallet?: { solana?: SolanaProvider }
  solflare?: SolanaProvider
  [key: string]: { solana?: SolanaProvider } | SolanaProvider | undefined | any
}

export interface TransactionConfig {
  toAddress: string
  amount: bigint
  fromAddress: string
  blockhash: string
  walletName: string
  tokenMint?: string
  tokenProgram?: string
  tokenDecimals?: number
}

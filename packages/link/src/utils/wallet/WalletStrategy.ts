import {
  WalletBrowserPayload,
  SignRequestPayload,
  ChainSwitchPayload,
  TransferPayload,
  SmartContractPayload,
  DisconnectPayload
} from '../types'

export interface WalletStrategy {
  connect(payload: WalletBrowserPayload): Promise<{
    accounts: string[]
    chainId: string | number
    isConnected: boolean
  }>
  disconnect(payload: DisconnectPayload): Promise<void>
  signMessage(payload: SignRequestPayload): Promise<string>
  switchChain(payload: ChainSwitchPayload): Promise<{
    chainId: number | string
    accounts: string[]
  }>
  sendNativeTransfer(payload: TransferPayload): Promise<string>
  sendSmartContractInteraction(payload: SmartContractPayload): Promise<string>
  getProviders(): { id: string; type: string; name?: string; icon?: string }[]
}

export abstract class BaseWalletStrategy implements WalletStrategy {
  abstract connect(payload: WalletBrowserPayload): Promise<{
    accounts: string[]
    chainId: string | number
    isConnected: boolean
  }>
  abstract disconnect(payload: DisconnectPayload): Promise<void>
  abstract signMessage(payload: SignRequestPayload): Promise<string>
  abstract switchChain(payload: ChainSwitchPayload): Promise<{
    chainId: number | string
    accounts: string[]
  }>
  abstract sendNativeTransfer(payload: TransferPayload): Promise<string>
  abstract sendSmartContractInteraction(
    payload: SmartContractPayload
  ): Promise<string>
  abstract getProviders(): {
    id: string
    type: string
    name?: string
    icon?: string
  }[]

  protected handleError(error: unknown, operation: string): Error {
    console.error(`${operation} error:`, error)
    if (error instanceof Error) {
      return error
    }
    return new Error(`Failed to ${operation}`)
  }

  protected isUserRejection(error: any): boolean {
    if (!error) return false

    const message = error.message?.toLowerCase() || ''
    //4001 - user reject, -32603 internal error
    const errorCodes = [4001, -32603]

    return (
      message.includes('user rejected') ||
      message.includes('declined') ||
      message.includes('cancelled') ||
      errorCodes.includes(error.code)
    )
  }
}

import { SolanaWalletStrategy } from '../SolanaWalletStrategy'
import * as solanaConnectors from '../../connectors/solana'

jest.mock('../../connectors/solana', () => ({
  connectToSolanaWallet: jest.fn(),
  disconnectFromSolanaWallet: jest.fn(),
  signSolanaMessage: jest.fn(),
  sendSOLTransaction: jest.fn(),
  findAvailableSolanaProviders: jest.fn()
}))

describe('SolanaWalletStrategy', () => {
  let strategy: SolanaWalletStrategy

  beforeEach(() => {
    strategy = new SolanaWalletStrategy()
    jest.clearAllMocks()
  })

  describe('connect', () => {
    const mockPayload = {
      integrationName: 'Phantom'
    }

    it('should successfully connect to wallet', async () => {
      const mockResult = {
        accounts: ['solana_address'],
        chainId: '101',
        isConnected: true
      }
      ;(solanaConnectors.connectToSolanaWallet as jest.Mock).mockResolvedValue(
        mockResult
      )

      const result = await strategy.connect(mockPayload)
      expect(result).toEqual(mockResult)
      expect(solanaConnectors.connectToSolanaWallet).toHaveBeenCalledWith(
        mockPayload.integrationName
      )
    })

    it('should handle connection error', async () => {
      const mockError = new Error('Connection failed')
      ;(solanaConnectors.connectToSolanaWallet as jest.Mock).mockResolvedValue(
        mockError
      )

      await expect(strategy.connect(mockPayload)).rejects.toThrow(
        'Connection failed'
      )
    })
  })

  describe('disconnect', () => {
    it('should successfully disconnect', async () => {
      await strategy.disconnect({ walletName: 'Phantom' })
      expect(solanaConnectors.disconnectFromSolanaWallet).toHaveBeenCalledWith(
        'Phantom'
      )
    })

    it('should handle disconnect error', async () => {
      const mockError = new Error('Disconnect failed')
      ;(
        solanaConnectors.disconnectFromSolanaWallet as jest.Mock
      ).mockResolvedValue(mockError)

      await expect(
        strategy.disconnect({ walletName: 'Phantom' })
      ).rejects.toThrow('Disconnect failed')
    })
  })

  describe('signMessage', () => {
    const mockPayload = {
      walletName: 'Phantom',
      message: 'Test message',
      address: 'solana_address'
    }

    it('should successfully sign message', async () => {
      const mockSignature = 'solana_signature'
      ;(solanaConnectors.signSolanaMessage as jest.Mock).mockResolvedValue(
        mockSignature
      )

      const result = await strategy.signMessage(mockPayload)
      expect(result).toBe(mockSignature)
      expect(solanaConnectors.signSolanaMessage).toHaveBeenCalledWith(
        mockPayload.walletName,
        mockPayload.message
      )
    })

    it('should handle signing error', async () => {
      const mockError = new Error('Signing failed')
      ;(solanaConnectors.signSolanaMessage as jest.Mock).mockResolvedValue(
        mockError
      )

      await expect(strategy.signMessage(mockPayload)).rejects.toThrow(
        'Signing failed'
      )
    })
  })

  describe('switchChain', () => {
    it('should return fixed Solana chain ID', async () => {
      const result = await strategy.switchChain({ chainId: 1 })
      expect(result).toEqual({
        chainId: '101',
        accounts: []
      })
    })
  })

  describe('sendNativeTransfer', () => {
    const mockPayload = {
      toAddress: 'recipient_address',
      amount: 1,
      account: 'sender_address',
      decimalPlaces: 9,
      walletName: 'Phantom',
      blockhash: 'test_blockhash',
      chainId: 101,
      network: 'solana'
    }

    it('should successfully send native transfer', async () => {
      const mockTxHash = 'tx_hash'
      ;(solanaConnectors.sendSOLTransaction as jest.Mock).mockResolvedValue(
        mockTxHash
      )

      const result = await strategy.sendNativeTransfer(mockPayload)
      expect(result).toBe(mockTxHash)
      expect(solanaConnectors.sendSOLTransaction).toHaveBeenCalledWith({
        toAddress: mockPayload.toAddress,
        amount: BigInt(
          mockPayload.amount * Math.pow(10, mockPayload.decimalPlaces)
        ),
        fromAddress: mockPayload.account,
        blockhash: mockPayload.blockhash,
        walletName: mockPayload.walletName
      })
    })

    it('should handle transfer error', async () => {
      const mockError = new Error('Transfer failed')
      ;(solanaConnectors.sendSOLTransaction as jest.Mock).mockResolvedValue(
        mockError
      )

      await expect(strategy.sendNativeTransfer(mockPayload)).rejects.toThrow(
        'Transfer failed'
      )
    })
  })

  describe('sendSmartContractInteraction', () => {
    const mockPayload = {
      address: 'contract_address',
      abi: '[]',
      functionName: 'test',
      args: [],
      account: 'sender_address'
    }

    it('should throw not implemented error', async () => {
      await expect(
        strategy.sendSmartContractInteraction(mockPayload)
      ).rejects.toThrow(
        'NOT_IMPLEMENTED: Solana smart contract interactions are not yet supported'
      )
    })
  })

  describe('getProviders', () => {
    it('should return available providers with correct type', () => {
      const mockProviders = {
        phantom: true,
        solflare: true
      }
      ;(
        solanaConnectors.findAvailableSolanaProviders as jest.Mock
      ).mockReturnValue(mockProviders)

      const result = strategy.getProviders()
      expect(result).toEqual([
        { id: 'phantom', type: 'solana' },
        { id: 'solflare', type: 'solana' }
      ])
    })

    it('should handle empty providers', () => {
      ;(
        solanaConnectors.findAvailableSolanaProviders as jest.Mock
      ).mockReturnValue({})

      const result = strategy.getProviders()
      expect(result).toEqual([])
    })
  })
})

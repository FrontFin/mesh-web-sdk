import { SolanaWalletStrategy } from '../SolanaWalletStrategy'
import * as solanaConnectors from '../../connectors/solana'

jest.mock('../../connectors/solana', () => ({
  connectToSolanaWallet: jest.fn(),
  disconnectFromSolanaWallet: jest.fn(),
  signSolanaMessage: jest.fn(),
  sendSOLTransaction: jest.fn(),
  findAvailableSolanaProviders: jest.fn(),
  getSolanaProvider: jest.fn()
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
        mockPayload
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
    it('should switch to mainnet (101)', async () => {
      const result = await strategy.switchChain({ chainId: 101 })
      expect(result).toEqual({
        chainId: '101',
        accounts: []
      })
      expect(strategy.getCurrentChainId()).toBe('101')
      expect(strategy.isMainnet()).toBe(true)
      expect(strategy.isDevnet()).toBe(false)
    })

    it('should switch to devnet (103)', async () => {
      const result = await strategy.switchChain({ chainId: 103 })
      expect(result).toEqual({
        chainId: '103',
        accounts: []
      })
      expect(strategy.getCurrentChainId()).toBe('103')
      expect(strategy.isDevnet()).toBe(true)
      expect(strategy.isMainnet()).toBe(false)
    })

    it('should return accounts when wallet is connected', async () => {
      const mockPublicKey = { toString: () => 'test_address' }
      ;(solanaConnectors.getSolanaProvider as jest.Mock).mockReturnValue({
        publicKey: mockPublicKey
      })

      const result = await strategy.switchChain({
        chainId: 103,
        walletName: 'Phantom'
      })
      expect(result).toEqual({
        chainId: '103',
        accounts: ['test_address']
      })
    })

    it('should throw error for unsupported chain ID', async () => {
      await expect(strategy.switchChain({ chainId: 999 })).rejects.toThrow(
        'Unsupported Solana chain ID: 999. Supported chains: 101 (mainnet), 103 (devnet)'
      )
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
        walletName: mockPayload.walletName,
        network: '101' // mainnet by default
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
      address: 'token_mint_address',
      abi: '[]',
      functionName: 'transfer',
      args: ['recipient_address', 1000000n, 6],
      account: 'sender_address',
      walletName: 'Phantom',
      blockhash: 'test_blockhash'
    }

    it('should successfully send token transfer', async () => {
      const mockTxHash = 'tx_hash'
      const mockPublicKey = { toString: () => mockPayload.account }
      ;(solanaConnectors.getSolanaProvider as jest.Mock).mockReturnValue({
        publicKey: mockPublicKey
      })
      ;(solanaConnectors.sendSOLTransaction as jest.Mock).mockResolvedValue(
        mockTxHash
      )

      const result = await strategy.sendSmartContractInteraction(mockPayload)
      expect(result).toBe(mockTxHash)
      expect(solanaConnectors.sendSOLTransaction).toHaveBeenCalledWith({
        toAddress: mockPayload.args[0],
        amount: mockPayload.args[1],
        fromAddress: mockPayload.account,
        blockhash: mockPayload.blockhash,
        walletName: mockPayload.walletName,
        tokenMint: mockPayload.address,
        tokenDecimals: mockPayload.args[2],
        network: '101' // mainnet by default
      })
    })

    it('should handle missing sender address', async () => {
      ;(solanaConnectors.getSolanaProvider as jest.Mock).mockReturnValue({
        publicKey: null
      })

      await expect(
        strategy.sendSmartContractInteraction({
          ...mockPayload,
          account: ''
        })
      ).rejects.toThrow('Sender account address is required')
    })

    it('should handle missing blockhash', async () => {
      const mockPublicKey = { toString: () => mockPayload.account }
      ;(solanaConnectors.getSolanaProvider as jest.Mock).mockReturnValue({
        publicKey: mockPublicKey
      })

      await expect(
        strategy.sendSmartContractInteraction({
          ...mockPayload,
          blockhash: ''
        })
      ).rejects.toThrow('Blockhash is required for Solana transactions')
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

  describe('utility methods', () => {
    it('should return current chain ID', () => {
      expect(strategy.getCurrentChainId()).toBe('101') // default mainnet
    })

    it('should correctly identify mainnet', () => {
      expect(strategy.isMainnet()).toBe(true)
      expect(strategy.isDevnet()).toBe(false)
    })

    it('should correctly identify devnet after switch', async () => {
      await strategy.switchChain({ chainId: 103 })
      expect(strategy.isDevnet()).toBe(true)
      expect(strategy.isMainnet()).toBe(false)
    })

    it('should update chain ID when connecting with target chain', async () => {
      const mockResult = {
        accounts: ['solana_address'],
        chainId: '103', // devnet
        isConnected: true
      }
      ;(solanaConnectors.connectToSolanaWallet as jest.Mock).mockResolvedValue(
        mockResult
      )

      await strategy.connect({ integrationName: 'Phantom' })
      expect(strategy.getCurrentChainId()).toBe('103')
      expect(strategy.isDevnet()).toBe(true)
    })
  })
})

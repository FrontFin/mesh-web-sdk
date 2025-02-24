import { EVMWalletStrategy } from '../EVMWalletStrategy'
import * as evmConnectors from '../../connectors/evm'

jest.mock('../../connectors/evm', () => ({
  connectToEVMWallet: jest.fn(),
  disconnectFromEVMWallet: jest.fn(),
  signEVMMessage: jest.fn(),
  sendEVMTransaction: jest.fn(),
  sendEVMTokenTransaction: jest.fn(),
  switchEVMChain: jest.fn(),
  findAvailableProviders: jest.fn()
}))

describe('EVMWalletStrategy', () => {
  let strategy: EVMWalletStrategy

  beforeEach(() => {
    strategy = new EVMWalletStrategy()
    jest.clearAllMocks()
  })

  describe('connect', () => {
    const mockPayload = {
      integrationName: 'MetaMask',
      targetChainId: '1'
    }

    it('should successfully connect to wallet', async () => {
      const mockResult = {
        accounts: ['0x123'],
        chainId: 1,
        isConnected: true
      }
      ;(evmConnectors.connectToEVMWallet as jest.Mock).mockResolvedValue(
        mockResult
      )

      const result = await strategy.connect(mockPayload)
      expect(result).toEqual(mockResult)
      expect(evmConnectors.connectToEVMWallet).toHaveBeenCalledWith(
        mockPayload.integrationName,
        parseInt(mockPayload.targetChainId)
      )
    })

    it('should handle connection error', async () => {
      const mockError = new Error('Connection failed')
      ;(evmConnectors.connectToEVMWallet as jest.Mock).mockResolvedValue(
        mockError
      )

      await expect(strategy.connect(mockPayload)).rejects.toThrow(
        'Connection failed'
      )
    })
  })

  describe('disconnect', () => {
    it('should successfully disconnect', async () => {
      await strategy.disconnect({ walletName: 'MetaMask' })
      expect(evmConnectors.disconnectFromEVMWallet).toHaveBeenCalledWith(
        'MetaMask'
      )
    })

    it('should handle disconnect error', async () => {
      const mockError = new Error('Disconnect failed')
      ;(evmConnectors.disconnectFromEVMWallet as jest.Mock).mockResolvedValue(
        mockError
      )

      await expect(
        strategy.disconnect({ walletName: 'MetaMask' })
      ).rejects.toThrow('Disconnect failed')
    })
  })

  describe('signMessage', () => {
    const mockPayload = {
      walletName: 'MetaMask',
      address: '0x123',
      message: 'Test message'
    }

    it('should successfully sign message', async () => {
      const mockSignature = '0xsignature'
      ;(evmConnectors.signEVMMessage as jest.Mock).mockResolvedValue(
        mockSignature
      )

      const result = await strategy.signMessage(mockPayload)
      expect(result).toBe(mockSignature)
      expect(evmConnectors.signEVMMessage).toHaveBeenCalledWith(
        mockPayload.walletName,
        mockPayload.address,
        mockPayload.message
      )
    })

    it('should handle signing error', async () => {
      const mockError = new Error('Signing failed')
      ;(evmConnectors.signEVMMessage as jest.Mock).mockResolvedValue(mockError)

      await expect(strategy.signMessage(mockPayload)).rejects.toThrow(
        'Signing failed'
      )
    })
  })

  describe('switchChain', () => {
    const mockPayload = {
      chainId: 137 // Polygon network
    }

    it('should successfully switch chain', async () => {
      const mockResult = {
        chainId: 137,
        accounts: ['0x123']
      }
      ;(evmConnectors.switchEVMChain as jest.Mock).mockResolvedValue(mockResult)

      const result = await strategy.switchChain(mockPayload)
      expect(result).toEqual(mockResult)
      expect(evmConnectors.switchEVMChain).toHaveBeenCalledWith(
        mockPayload.chainId
      )
    })

    it('should handle chain switch error', async () => {
      const mockError = new Error('Chain switch failed')
      ;(evmConnectors.switchEVMChain as jest.Mock).mockResolvedValue(mockError)

      await expect(strategy.switchChain(mockPayload)).rejects.toThrow(
        'Chain switch failed'
      )
    })
  })

  describe('sendNativeTransfer', () => {
    const mockPayload = {
      toAddress: '0x456',
      amount: 1,
      account: '0x123',
      decimalPlaces: 18,
      chainId: 1,
      network: 'ethereum'
    }

    it('should successfully send native transfer', async () => {
      const mockTxHash = '0xtxhash'
      ;(evmConnectors.sendEVMTransaction as jest.Mock).mockResolvedValue(
        mockTxHash
      )

      const result = await strategy.sendNativeTransfer(mockPayload)
      expect(result).toBe(mockTxHash)
      expect(evmConnectors.sendEVMTransaction).toHaveBeenCalledWith(
        mockPayload.toAddress,
        BigInt(mockPayload.amount * Math.pow(10, mockPayload.decimalPlaces)),
        mockPayload.account
      )
    })

    it('should handle transfer error', async () => {
      const mockError = new Error('Transfer failed')
      ;(evmConnectors.sendEVMTransaction as jest.Mock).mockResolvedValue(
        mockError
      )

      await expect(strategy.sendNativeTransfer(mockPayload)).rejects.toThrow(
        'Transfer failed'
      )
    })
  })

  describe('sendSmartContractInteraction', () => {
    const mockPayload = {
      address: '0xcontract',
      abi: '["function transfer(address to, uint256 amount)"]',
      functionName: 'transfer',
      args: ['0x456', '1000000000000000000'],
      account: '0x123',
      value: '0'
    }

    it('should successfully send contract interaction', async () => {
      const mockTxHash = '0xtxhash'
      ;(evmConnectors.sendEVMTokenTransaction as jest.Mock).mockResolvedValue(
        mockTxHash
      )

      const result = await strategy.sendSmartContractInteraction(mockPayload)
      expect(result).toBe(mockTxHash)
      expect(evmConnectors.sendEVMTokenTransaction).toHaveBeenCalledWith(
        mockPayload.address,
        JSON.parse(mockPayload.abi),
        mockPayload.functionName,
        mockPayload.args,
        mockPayload.account,
        mockPayload.value ? BigInt(mockPayload.value) : undefined
      )
    })

    it('should handle contract interaction error', async () => {
      const mockError = new Error('Contract interaction failed')
      ;(evmConnectors.sendEVMTokenTransaction as jest.Mock).mockResolvedValue(
        mockError
      )

      await expect(
        strategy.sendSmartContractInteraction(mockPayload)
      ).rejects.toThrow('Contract interaction failed')
    })
  })

  describe('getProviders', () => {
    it('should return available providers with correct type', () => {
      const mockProviders = [
        { id: 'metamask', name: 'MetaMask', icon: 'icon-url' }
      ]
      ;(evmConnectors.findAvailableProviders as jest.Mock).mockReturnValue(
        mockProviders
      )

      const result = strategy.getProviders()
      expect(result).toEqual([{ ...mockProviders[0], type: 'evm' }])
    })
  })
})

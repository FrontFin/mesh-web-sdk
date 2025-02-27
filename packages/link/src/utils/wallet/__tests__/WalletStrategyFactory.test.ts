import { WalletStrategyFactory } from '../WalletStrategyFactory'
import { EVMWalletStrategy } from '../EVMWalletStrategy'
import { SolanaWalletStrategy } from '../SolanaWalletStrategy'

describe('WalletStrategyFactory', () => {
  let factory: WalletStrategyFactory

  beforeEach(() => {
    // Reset the singleton instance before each test
    // @ts-expect-error - accessing private property for testing
    WalletStrategyFactory.instance = undefined
    factory = WalletStrategyFactory.getInstance()
  })

  describe('getInstance', () => {
    it('should create a singleton instance', () => {
      const instance1 = WalletStrategyFactory.getInstance()
      const instance2 = WalletStrategyFactory.getInstance()
      expect(instance1).toBe(instance2)
    })
  })

  describe('getStrategy', () => {
    it('should return EVMWalletStrategy for evm network type', () => {
      const strategy = factory.getStrategy('evm')
      expect(strategy).toBeInstanceOf(EVMWalletStrategy)
    })

    it('should return SolanaWalletStrategy for solana network type', () => {
      const strategy = factory.getStrategy('solana')
      expect(strategy).toBeInstanceOf(SolanaWalletStrategy)
    })

    it('should throw error for invalid network type', () => {
      // @ts-expect-error - testing invalid input
      expect(() => factory.getStrategy('invalid')).toThrow(
        'No strategy found for network type: invalid'
      )
    })
  })

  describe('getAllProviders', () => {
    it('should return combined providers from all strategies', () => {
      // Mock the provider methods
      jest
        .spyOn(EVMWalletStrategy.prototype, 'getProviders')
        .mockReturnValue([
          { id: 'metamask', type: 'evm', name: 'MetaMask', icon: undefined }
        ])
      jest
        .spyOn(SolanaWalletStrategy.prototype, 'getProviders')
        .mockReturnValue([{ id: 'phantom', type: 'solana' }])

      const providers = factory.getAllProviders()

      expect(providers).toHaveLength(2)
      expect(providers).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'metamask', type: 'evm' }),
          expect.objectContaining({ id: 'phantom', type: 'solana' })
        ])
      )
    })
  })
})

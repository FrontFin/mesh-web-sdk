import { BaseWalletStrategy } from '../WalletStrategy'

// Create a concrete implementation for testing
class TestWalletStrategy extends BaseWalletStrategy {
  connect = jest.fn()
  disconnect = jest.fn()
  signMessage = jest.fn()
  switchChain = jest.fn()
  sendNativeTransfer = jest.fn()
  sendSmartContractInteraction = jest.fn()
  getProviders = jest.fn()
}

describe('BaseWalletStrategy', () => {
  let strategy: TestWalletStrategy

  beforeEach(() => {
    strategy = new TestWalletStrategy()
  })

  describe('handleError', () => {
    it('should return the error if it is an Error instance', () => {
      const error = new Error('Test error')
      // @ts-expect-error - accessing protected method for testing
      const result = strategy.handleError(error, 'test operation')
      expect(result).toBe(error)
    })

    it('should create a new Error if input is not an Error instance', () => {
      const errorString = 'string error'
      // @ts-expect-error - accessing protected method for testing
      const result = strategy.handleError(errorString, 'test operation')
      expect(result).toBeInstanceOf(Error)
      expect(result.message).toBe('Failed to test operation')
    })
  })

  describe('isUserRejection', () => {
    it('should return true for user rejection error code 4001', () => {
      // @ts-expect-error - accessing protected method for testing
      expect(strategy.isUserRejection({ code: 4001 })).toBe(true)
    })

    it('should return true for user rejection error code -32603', () => {
      // @ts-expect-error - accessing protected method for testing
      expect(strategy.isUserRejection({ code: -32603 })).toBe(true)
    })

    it('should return true for rejection message patterns', () => {
      const rejectionMessages = [
        { message: 'User rejected' },
        { message: 'Transaction declined' },
        { message: 'Operation cancelled' }
      ]

      rejectionMessages.forEach(error => {
        // @ts-expect-error - accessing protected method for testing
        expect(strategy.isUserRejection(error)).toBe(true)
      })
    })

    it('should return false for other errors', () => {
      const nonRejectionErrors = [
        { code: 5000 },
        { message: 'Network error' },
        null,
        undefined
      ]

      nonRejectionErrors.forEach(error => {
        // @ts-expect-error - accessing protected method for testing
        expect(strategy.isUserRejection(error)).toBe(false)
      })
    })
  })
})

import { isFrontEventTypeKey } from './event-types'

describe('Event types tests', () => {
  test.each([
    'integrationConnected',
    'integrationConnectionError',
    'transferCompleted',
    'integrationSelected',
    'credentialsEntered',
    'transferStarted',
    'transferPreviewed',
    'transferPreviewError',
    'transferExecutionError'
  ])(
    'isFrontEventTypeKey should return true if parameter is "%s"',
    eventType => {
      expect(isFrontEventTypeKey(eventType)).toBe(true)
    }
  )

  test('isFrontEventTypeKey should return false if parameter is not event', () => {
    expect(isFrontEventTypeKey('test')).toBe(false)
  })
})

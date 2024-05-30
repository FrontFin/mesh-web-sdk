import { isLinkEventTypeKey } from './event-types'

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
    'isLinkEventTypeKey should return true if parameter is "%s"',
    eventType => {
      expect(isLinkEventTypeKey(eventType)).toBe(true)
    }
  )

  test('isLinkEventTypeKey should return false if parameter is not event', () => {
    expect(isLinkEventTypeKey('test')).toBe(false)
  })
})

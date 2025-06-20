import { isLinkEventTypeKey } from './event-types'

describe('Event types tests', () => {
  test.each([
    'integrationConnected',
    'integrationConnectionError',
    'integrationMfaRequired',
    'integrationMfaEntered',
    'integrationOAuthStarted',
    'integrationAccountSelectionRequired',
    'transferCompleted',
    'integrationSelected',
    'credentialsEntered',
    'transferStarted',
    'transferPreviewed',
    'transferPreviewError',
    'transferExecutionError',
    'pageLoaded',
    'transferAssetSelected',
    'transferNetworkSelected',
    'transferAmountEntered',
    'transferMfaRequired',
    'transferMfaEntered',
    'transferKycRequired',
    'transferExecuted',
    'transferInitiated',
    'transferNoEligibleAssets',
    'walletMessageSigned',
    'verifyDonePage',
    'verifyWalletRejected',
    'connectionDeclined',
    'transferConfigureError',
    'connectionUnavailable',
    'transferDeclined',
    'done',
    'close',
    'SDKinjectedWalletProviders',
    'legalTermsViewed',
    'seeWhatHappenedClicked',
    'executeFundingStep',
    'fundingOptionsUpdated',
    'fundingOptionsViewed',
    'gasIncreaseWarning'
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

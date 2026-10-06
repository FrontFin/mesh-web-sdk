import { createLink } from './Link'
import { DoneEvent, LinkEventType, TransferExecuted } from './utils/event-types'
import { createPrewarmIframe, removePrewarmIframe } from './utils/prewarm'
import {
  AccessTokenPayload,
  DelayedAuthPayload,
  EventType,
  LinkPayload,
  IntegrationAccessToken,
  TransferFinishedPayload,
  MeshBackupConfig
} from './utils/types'
import {
  BACKUP_CONFIG_MESSAGE_TYPE,
  DEFAULT_BACKUP_WIDGET_ORIGIN,
  JIT_REQUEST_MESSAGE_TYPE,
  JIT_RESPONSE_MESSAGE_TYPE,
  TIER1_READY_TIMEOUT_MS,
  TIER2_READY_TIMEOUT_MS
} from './utils/backup'

jest.mock('@meshconnect/uwc-bridge-parent', () => ({
  BridgeParent: jest.fn().mockImplementation(() => ({
    destroy: jest.fn()
  }))
}))

jest.mock('./utils/prewarm', () => ({
  createPrewarmIframe: jest.fn(),
  removePrewarmIframe: jest.fn()
}))

// Stub the bundled Tier-2 asset so cascade tests don't load the ~135 KB HTML and
// don't depend on the dynamic-import transform for the real file.
jest.mock('./backup-bundle', () => ({
  getBundledOfflineWidget: () => ({
    html: '<!doctype html><title>tier2-bundle</title>'
  })
}))

/** Flush pending microtasks (awaited promises), for async message handlers. */
const flushPromises = () => Promise.resolve().then().then().then()

/** The session nonce the SDK put on a backup widget iframe's URL (`?sid=` for Tier
 *  1, `#sid=` for the Tier-2 blob: URL) — what the real widget echoes on every
 *  message as a top-level `sid`. */
const widgetSid = (
  iframeOrWindow: HTMLIFrameElement | Window | null | undefined
): string | undefined => {
  const iframe =
    iframeOrWindow instanceof HTMLIFrameElement
      ? iframeOrWindow
      : Array.from(document.getElementsByTagName('iframe')).find(
          f => f.contentWindow === iframeOrWindow
        )
  return /[?&#]sid=([0-9a-f]+)/.exec(iframe?.getAttribute('src') ?? '')?.[1]
}

type EventPayload = {
  type: EventType
  payload?: AccessTokenPayload | DelayedAuthPayload | TransferFinishedPayload
  message?: string
  link?: string
}

const BASE64_ENCODED_URL = Buffer.from('http://localhost/1').toString('base64')

describe('createLink tests', () => {
  globalThis.open = jest.fn()

  beforeEach(() => {
    document.getElementsByTagName('html')[0].innerHTML = ''
    const removePrewarmIframeMock = removePrewarmIframe as jest.Mock
    removePrewarmIframeMock.mockReset()
  })

  test('createLink when invalid link provided should not open popup', () => {
    const exitFunction = jest.fn<void, [string | undefined]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onExit: exitFunction
    })

    frontConnection.openLink('')

    expect(exitFunction).toHaveBeenCalledWith('Invalid link token!')
    const iframeElement = document.getElementById('mesh-link-popup__iframe')
    expect(iframeElement).toBeFalsy()
    expect(createPrewarmIframe).toHaveBeenCalled()
  })

  test('createLink when invalid link url provided should not open popup', () => {
    const exitFunction = jest.fn<void, [string | undefined]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onExit: exitFunction
    })

    frontConnection.openLink('amF2YXNjcmlwdDphbGVydChkb2N1bWVudC5kb21haW4pLy8=')

    expect(exitFunction).toHaveBeenCalledWith('Invalid link token!')
    const iframeElement = document.getElementById('mesh-link-popup__iframe')
    expect(iframeElement).toBeFalsy()
  })

  test('createLink when valid link provided should open popup', () => {
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      language: 'en',
      theme: 'light'
    })

    frontConnection.openLink(BASE64_ENCODED_URL)
    const iframeElement = document.getElementById('mesh-link-popup__iframe')
    expect(iframeElement).toBeTruthy()
    expect(iframeElement?.attributes.getNamedItem('src')?.nodeValue).toBe(
      'http://localhost/1?lng=en&th=light'
    )
  })

  test('createLink system language is requested then should open popup with correct language', () => {
    jest.spyOn(navigator, 'language', 'get').mockReturnValue('es-US')

    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      language: 'system'
    })

    frontConnection.openLink(BASE64_ENCODED_URL)
    const iframeElement = document.getElementById('mesh-link-popup__iframe')
    expect(iframeElement).toBeTruthy()
    expect(iframeElement?.attributes.getNamedItem('src')?.nodeValue).toBe(
      'http://localhost/1?lng=es-US'
    )
  })

  test('createLink when valid link provided should open popup with custom iframe id', () => {
    const customIframeId = 'custom-iframe-id'
    const customIframeElement = document.createElement('iframe')
    customIframeElement.id = customIframeId
    document.body.appendChild(customIframeElement)

    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      language: 'en'
    })

    frontConnection.openLink(BASE64_ENCODED_URL, customIframeId)
    const iframeElement = document.getElementById('mesh-link-popup__iframe')
    expect(iframeElement).toBeFalsy()

    expect(customIframeElement.attributes.getNamedItem('src')?.nodeValue).toBe(
      'http://localhost/1?lng=en'
    )
    expect(customIframeElement.allow).toContain('camera http://localhost')
    expect(customIframeElement.allow).toContain('microphone http://localhost')
  })

  test('createLink closePopup should close popup', () => {
    const exitFunction = jest.fn<void, [string | undefined]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onExit: exitFunction
    })

    frontConnection.openLink(BASE64_ENCODED_URL)
    frontConnection.closeLink()

    const iframeElement = document.getElementById('mesh-link-popup__iframe')
    expect(iframeElement).toBeFalsy()

    expect(exitFunction).toHaveBeenCalled()
    expect(removePrewarmIframe).toHaveBeenCalled()
  })

  test.each(['close', 'done'] as const)(
    'createLink "%s" event should close popup',
    eventName => {
      const exitFunction = jest.fn<void, [string | undefined]>()
      const frontConnection = createLink({
        clientId: 'test',
        onIntegrationConnected: jest.fn(),
        onExit: exitFunction
      })

      const payload: DoneEvent['payload'] = {
        page: 'some page',
        errorMessage: 'some msg'
      }
      frontConnection.openLink(BASE64_ENCODED_URL)
      globalThis.dispatchEvent(
        new MessageEvent<LinkEventType>('message', {
          data: {
            type: eventName,
            payload: payload
          },
          origin: 'http://localhost'
        })
      )

      const iframeElement = document.getElementById('mesh-link-popup__iframe')
      expect(iframeElement).toBeFalsy()

      expect(exitFunction).toHaveBeenCalledWith('some msg', payload)
    }
  )

  test('createLink "brokerageAccountAccessToken" event should send tokens', () => {
    const onEventHandler = jest.fn<void, [LinkEventType]>()
    const onBrokerConnectedHandler = jest.fn<void, [LinkPayload]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: onBrokerConnectedHandler,
      onEvent: onEventHandler
    })

    frontConnection.openLink(BASE64_ENCODED_URL)

    const payload: AccessTokenPayload = {
      accountTokens: [],
      brokerBrandInfo: { brokerLogo: '' },
      brokerType: 'robinhood',
      brokerName: 'R'
    }
    globalThis.dispatchEvent(
      new MessageEvent<EventPayload>('message', {
        data: {
          type: 'brokerageAccountAccessToken',
          payload: payload
        },
        origin: 'http://localhost'
      })
    )

    expect(onEventHandler).toHaveBeenCalledWith({
      type: 'integrationConnected',
      payload: { accessToken: payload }
    })
    expect(onBrokerConnectedHandler).toHaveBeenCalledWith({
      accessToken: payload
    })
  })

  test('createLink "delayedAuthentication" event should send dalayed tokens', () => {
    const onEventHandler = jest.fn<void, [LinkEventType]>()
    const onBrokerConnectedHandler = jest.fn<void, [LinkPayload]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: onBrokerConnectedHandler,
      onEvent: onEventHandler
    })

    frontConnection.openLink(BASE64_ENCODED_URL)

    const payload: DelayedAuthPayload = {
      brokerBrandInfo: { brokerLogo: '' },
      brokerType: 'robinhood',
      brokerName: 'R',
      refreshToken: 'rt'
    }
    globalThis.dispatchEvent(
      new MessageEvent<EventPayload>('message', {
        data: {
          type: 'delayedAuthentication',
          payload: payload
        },
        origin: 'http://localhost'
      })
    )

    expect(onEventHandler).toHaveBeenCalledWith({
      type: 'integrationConnected',
      payload: { delayedAuth: payload }
    })
    expect(onBrokerConnectedHandler).toHaveBeenCalledWith({
      delayedAuth: payload
    })
  })

  test.each<{ name: string; payload: TransferFinishedPayload }>([
    {
      name: 'with all fields',
      payload: {
        status: 'success',
        txId: 'tid',
        fromAddress: 'fa',
        toAddress: 'ta',
        symbol: 'BTC',
        amount: 0.001,
        networkId: 'nid',
        userId: 'uid',
        clientTransactionId: 'ctid',
        amountInFiat: 9.77,
        totalAmountInFiat: 10.02,
        networkName: 'Bitcoin',
        txHash: 'txHash',
        transferId: 'trid'
      }
    },
    {
      name: 'without userId or clientTransactionId',
      payload: {
        status: 'success',
        txId: 'tid',
        fromAddress: 'fa',
        toAddress: 'ta',
        symbol: 'BTC',
        amount: 0.001,
        networkId: 'nid'
      }
    }
  ])(
    'createLink "transferFinished" event $name should send transfer payload',
    ({ payload }) => {
      const onEventHandler = jest.fn<void, [LinkEventType]>()
      const onTransferFinishedHandler = jest.fn<
        void,
        [TransferFinishedPayload]
      >()
      const frontConnection = createLink({
        clientId: 'test',
        onIntegrationConnected: jest.fn(),
        onEvent: onEventHandler,
        onTransferFinished: onTransferFinishedHandler
      })

      frontConnection.openLink(BASE64_ENCODED_URL)

      globalThis.dispatchEvent(
        new MessageEvent<EventPayload>('message', {
          data: { type: 'transferFinished', payload: payload },
          origin: 'http://localhost'
        })
      )

      expect(onEventHandler).toHaveBeenCalledWith({
        type: 'transferCompleted',
        payload: payload
      })
      expect(onTransferFinishedHandler).toHaveBeenCalledWith(payload)
    }
  )

  test.each([
    {
      name: 'with userId and clientTransactionId',
      extra: { userId: 'uid', clientTransactionId: 'ctid' }
    },
    { name: 'without userId or clientTransactionId', extra: {} }
  ])(
    'createLink "transferExecuted" event $name forwards via onEvent',
    ({ extra }) => {
      const onEventHandler = jest.fn<void, [LinkEventType]>()
      const frontConnection = createLink({
        clientId: 'test',
        onIntegrationConnected: jest.fn(),
        onEvent: onEventHandler
      })

      frontConnection.openLink(BASE64_ENCODED_URL)

      const event: TransferExecuted = {
        type: 'transferExecuted',
        payload: {
          status: 'success',
          txId: 'tid',
          fromAddress: 'fa',
          toAddress: 'ta',
          symbol: 'BTC',
          amount: 0.001,
          networkId: 'nid',
          ...extra
        }
      }
      globalThis.dispatchEvent(
        new MessageEvent<LinkEventType>('message', {
          data: event,
          origin: 'http://localhost'
        })
      )

      expect(onEventHandler).toHaveBeenCalledWith(event)
    }
  )

  test('createLink "loaded" event should trigger the passing for tokens', () => {
    const tokens: IntegrationAccessToken[] = [
      {
        accessToken: 'at',
        accountId: 'aid',
        accountName: 'an',
        brokerType: 'acorns',
        brokerName: 'A'
      }
    ]
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      accessTokens: tokens
    })

    frontConnection.openLink(BASE64_ENCODED_URL)

    const iframeElement = document.getElementById(
      'mesh-link-popup__iframe'
    ) as HTMLIFrameElement | null
    expect(iframeElement?.contentWindow).toBeTruthy()

    const postMessageSpy = jest.spyOn(
      iframeElement?.contentWindow as Window,
      'postMessage'
    )

    globalThis.dispatchEvent(
      new MessageEvent<EventPayload>('message', {
        data: {
          type: 'loaded'
        },
        origin: 'http://localhost'
      })
    )

    const packageJSONContent = JSON.parse(
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      require('fs').readFileSync('package.json', 'utf8')
    )
    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        type: 'meshSDKSpecs',
        payload: {
          platform: 'web',
          version: packageJSONContent.version,
          origin: 'http://localhost'
        }
      },
      'http://localhost'
    )

    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'frontAccessTokens', payload: tokens },
      'http://localhost'
    )
  })

  test('createLink "integrationConnected" event should send event', () => {
    const onEventHandler = jest.fn<void, [LinkEventType]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onEvent: onEventHandler
    })

    frontConnection.openLink(BASE64_ENCODED_URL)

    globalThis.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'integrationConnected'
        },
        origin: 'http://localhost'
      })
    )

    expect(onEventHandler).toHaveBeenCalled()
  })

  test('createLink unknown event should not send any events', () => {
    const onEventHandler = jest.fn<void, [LinkEventType]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onEvent: onEventHandler
    })

    frontConnection.openLink(BASE64_ENCODED_URL)

    globalThis.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'unknown'
        },
        origin: 'http://localhost'
      })
    )

    expect(onEventHandler).not.toHaveBeenCalled()
  })

  test('createLink closeLink should close popup', () => {
    const exitFunction = jest.fn<void, [string | undefined]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onExit: exitFunction
    })

    frontConnection.openLink(
      Buffer.from('http://localhost/1').toString('base64')
    )
    frontConnection.closeLink()

    const iframeElement = document.getElementById('mesh-link-popup__iframe')
    expect(iframeElement).toBeFalsy()

    expect(exitFunction).toHaveBeenCalled()
  })

  test('createLink with renderType "embedded" and no customIframeId should log error, call onExit, and not open popup', () => {
    const exitFunction = jest.fn<void, [string | undefined]>()
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onExit: exitFunction,
      renderType: 'embedded'
    })

    frontConnection.openLink(BASE64_ENCODED_URL)

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Mesh SDK: Failed to open link - renderType "embedded" requires a customIframeId'
    )
    expect(exitFunction).toHaveBeenCalledWith(
      'Mesh SDK: Failed to open link - renderType "embedded" requires a customIframeId'
    )
    const iframeElement = document.getElementById('mesh-link-popup__iframe')
    expect(iframeElement).toBeFalsy()

    consoleErrorSpy.mockRestore()
  })

  test('createLink with renderType "embedded" and customIframeId should not call onExit and should append rt=embedded to src', () => {
    const exitFunction = jest.fn<void, [string | undefined]>()
    const customIframeId = 'embedded-iframe'
    const customIframeElement = document.createElement('iframe')
    customIframeElement.id = customIframeId
    document.body.appendChild(customIframeElement)

    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onExit: exitFunction,
      renderType: 'embedded',
      language: 'en'
    })

    frontConnection.openLink(BASE64_ENCODED_URL, customIframeId)

    expect(exitFunction).not.toHaveBeenCalled()
    expect(customIframeElement.attributes.getNamedItem('src')?.nodeValue).toBe(
      'http://localhost/1?lng=en&rt=embedded'
    )
  })

  test('createLink with renderType "overlay" should not append rt param to src', () => {
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      renderType: 'overlay',
      language: 'en'
    })

    frontConnection.openLink(BASE64_ENCODED_URL)

    const iframeElement = document.getElementById('mesh-link-popup__iframe')
    expect(iframeElement?.attributes.getNamedItem('src')?.nodeValue).toBe(
      'http://localhost/1?lng=en'
    )
  })

  test('createLink without renderType should not append rt param to src', () => {
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      language: 'en'
    })

    frontConnection.openLink(BASE64_ENCODED_URL)

    const iframeElement = document.getElementById('mesh-link-popup__iframe')
    expect(iframeElement?.attributes.getNamedItem('src')?.nodeValue).toBe(
      'http://localhost/1?lng=en'
    )
  })

  test('closeLinkRequested in embedded mode sends closeRequested postMessage to iframe', () => {
    const customIframeId = 'embedded-iframe-close-requested'
    const customIframeElement = document.createElement('iframe')
    customIframeElement.id = customIframeId
    document.body.appendChild(customIframeElement)

    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      renderType: 'embedded'
    })

    frontConnection.openLink(BASE64_ENCODED_URL, customIframeId)

    const postMessageSpy = jest.spyOn(
      customIframeElement.contentWindow as Window,
      'postMessage'
    )

    frontConnection.closeLinkRequested()

    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'closeRequested' },
      'http://localhost'
    )
  })

  test('closeLinkRequested in overlay mode closes the popup immediately', () => {
    const exitFunction = jest.fn<void, [string | undefined]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onExit: exitFunction
    })

    frontConnection.openLink(BASE64_ENCODED_URL)
    frontConnection.closeLinkRequested()

    const iframeElement = document.getElementById('mesh-link-popup__iframe')
    expect(iframeElement).toBeFalsy()
    expect(exitFunction).toHaveBeenCalled()
  })
})

describe('openLinkBackup tests', () => {
  globalThis.open = jest.fn()

  const BACKUP_SESSION: MeshBackupConfig = {
    clientId: 'client-1',
    userId: 'user-1',
    destinations: [{ networkId: 'net-1', symbol: 'USDC', address: '0xabc' }]
  }

  beforeEach(() => {
    document.getElementsByTagName('html')[0].innerHTML = ''
    const removePrewarmIframeMock = removePrewarmIframe as jest.Mock
    removePrewarmIframeMock.mockReset()
  })

  test('openLinkBackup with no session calls onExit and does not open popup', () => {
    const exitFunction = jest.fn<void, [string | undefined]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onExit: exitFunction
    })

    frontConnection.openLinkBackup(undefined as unknown as MeshBackupConfig)

    expect(exitFunction).toHaveBeenCalledWith('Invalid backup session!')
    expect(document.getElementById('mesh-link-popup__iframe')).toBeFalsy()
    expect(removePrewarmIframe).toHaveBeenCalled()
  })

  test('openLinkBackup opens popup at DEFAULT_BACKUP_WIDGET_ORIGIN with display hints', () => {
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn()
    })

    frontConnection.openLinkBackup(BACKUP_SESSION)

    // Pinned: the production widget origin, matching the React Native SDK.
    expect(DEFAULT_BACKUP_WIDGET_ORIGIN).toBe('https://backup.meshconnect.com')
    const iframeElement = document.getElementById('mesh-link-popup__iframe')
    expect(iframeElement).toBeTruthy()
    const src = iframeElement?.attributes.getNamedItem('src')?.nodeValue
    expect(
      src?.startsWith(
        `${DEFAULT_BACKUP_WIDGET_ORIGIN}?platform=web&sdkVersion=`
      )
    ).toBe(true)
    // No link token is ever decoded in backup mode, and no theme param unless set.
    expect(src).not.toContain('theme=')
  })

  test('openLinkBackup honours widgetOrigin override, normalises trailing slash, and appends theme', () => {
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      theme: 'dark'
    })

    frontConnection.openLinkBackup(BACKUP_SESSION, {
      widgetOrigin: 'https://widget.example.com/'
    })

    const iframeElement = document.getElementById('mesh-link-popup__iframe')
    const src = iframeElement?.attributes.getNamedItem('src')?.nodeValue
    expect(
      src?.startsWith('https://widget.example.com?platform=web&sdkVersion=')
    ).toBe(true)
    expect(src).toContain('&theme=dark')
  })

  test('openLinkBackup does not append theme for theme "system"', () => {
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      theme: 'system'
    })

    frontConnection.openLinkBackup(BACKUP_SESSION)

    const iframeElement = document.getElementById('mesh-link-popup__iframe')
    const src = iframeElement?.attributes.getNamedItem('src')?.nodeValue
    expect(src).not.toContain('theme=')
  })

  test('openLinkBackup with renderType "embedded" and no customIframeId logs error, calls onExit, and does not open popup', () => {
    const exitFunction = jest.fn<void, [string | undefined]>()
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation()

    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onExit: exitFunction,
      renderType: 'embedded'
    })

    frontConnection.openLinkBackup(BACKUP_SESSION)

    const msg =
      'Mesh SDK: Failed to open backup link - renderType "embedded" requires a customIframeId'
    expect(consoleErrorSpy).toHaveBeenCalledWith(msg)
    expect(exitFunction).toHaveBeenCalledWith(msg)
    expect(document.getElementById('mesh-link-popup__iframe')).toBeFalsy()

    consoleErrorSpy.mockRestore()
  })

  test('openLinkBackup with renderType "embedded" and customIframeId sets src and allow on the custom iframe', () => {
    const customIframeId = 'backup-embedded-iframe'
    const customIframeElement = document.createElement('iframe')
    customIframeElement.id = customIframeId
    document.body.appendChild(customIframeElement)

    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      renderType: 'embedded'
    })

    frontConnection.openLinkBackup(BACKUP_SESSION, { customIframeId })

    expect(document.getElementById('mesh-link-popup__iframe')).toBeFalsy()
    const src = customIframeElement.attributes.getNamedItem('src')?.nodeValue
    expect(
      src?.startsWith(`${DEFAULT_BACKUP_WIDGET_ORIGIN}?platform=web`)
    ).toBe(true)
    expect(customIframeElement.allow).toContain(
      `camera ${DEFAULT_BACKUP_WIDGET_ORIGIN}`
    )
    expect(customIframeElement.allow).toContain(
      `microphone ${DEFAULT_BACKUP_WIDGET_ORIGIN}`
    )
  })

  test('a stale embedded backup iframe cannot close/report on a reopened session', () => {
    // Regression (Copilot): embedded reopen into iframe B leaves iframe A alive on
    // the SAME backup origin. A late event from A must not drive B's session — the
    // SDK gates every backup message on event.source, not just the origin.
    const onTransferFinished = jest.fn<void, [TransferFinishedPayload]>()
    const onExit = jest.fn<void, [string | undefined]>()
    const iframeA = document.createElement('iframe')
    iframeA.id = 'backup-iframe-a'
    const iframeB = document.createElement('iframe')
    iframeB.id = 'backup-iframe-b'
    document.body.append(iframeA, iframeB)

    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      renderType: 'embedded',
      onTransferFinished,
      onExit
    })

    // Open into A, then reopen into B — A stays in the DOM, same backup origin.
    frontConnection.openLinkBackup(BACKUP_SESSION, {
      customIframeId: 'backup-iframe-a'
    })
    frontConnection.openLinkBackup(BACKUP_SESSION, {
      customIframeId: 'backup-iframe-b'
    })

    // A late `transferFinished` + `close` from the STALE iframe A.
    globalThis.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'transferFinished',
          payload: { status: 'success', txId: 'x' },
          sid: widgetSid(iframeA)
        },
        origin: DEFAULT_BACKUP_WIDGET_ORIGIN,
        source: iframeA.contentWindow
      })
    )
    globalThis.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'close',
          payload: { errorMessage: 'stale' },
          sid: widgetSid(iframeA)
        },
        origin: DEFAULT_BACKUP_WIDGET_ORIGIN,
        source: iframeA.contentWindow
      })
    )

    // Neither fired — A is not the active widget window (B is).
    expect(onTransferFinished).not.toHaveBeenCalled()
    expect(onExit).not.toHaveBeenCalled()

    // The active widget B can still drive its own session.
    globalThis.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'close',
          payload: { errorMessage: 'bye' },
          sid: widgetSid(iframeB)
        },
        origin: DEFAULT_BACKUP_WIDGET_ORIGIN,
        source: iframeB.contentWindow
      })
    )
    expect(onExit).toHaveBeenCalledWith('bye', { errorMessage: 'bye' })
  })

  test('a stale message from the previous open in the SAME reused embedded iframe is ignored', () => {
    // Regression (Copilot / PR review): reopening into the SAME customIframeId
    // navigates one iframe, which keeps its WindowProxy — and both opens share the
    // backup origin — so event.source + origin can't tell the previous document's
    // queued messages from the current open's. The per-open session nonce does.
    jest.useFakeTimers()
    try {
      const onExit = jest.fn<void, [string | undefined]>()
      const onEvent = jest.fn<void, [LinkEventType]>()
      const iframe = document.createElement('iframe')
      iframe.id = 'backup-iframe-reused'
      document.body.append(iframe)
      const frontConnection = createLink({
        clientId: 'test',
        onIntegrationConnected: jest.fn(),
        renderType: 'embedded',
        onExit,
        onEvent
      })

      frontConnection.openLinkBackup(BACKUP_SESSION, {
        customIframeId: 'backup-iframe-reused'
      })
      const staleSid = widgetSid(iframe)
      frontConnection.openLinkBackup(BACKUP_SESSION, {
        customIframeId: 'backup-iframe-reused'
      })
      const currentSid = widgetSid(iframe)
      expect(staleSid).toMatch(/^[0-9a-f]{32}$/)
      expect(currentSid).toMatch(/^[0-9a-f]{32}$/)
      expect(currentSid).not.toBe(staleSid)

      const postMessageSpy = jest.spyOn(
        iframe.contentWindow as Window,
        'postMessage'
      )
      // Same window, same origin — only the nonce differs.
      for (const data of [
        { type: 'close', payload: { errorMessage: 'stale' }, sid: staleSid },
        { type: 'loaded', sid: staleSid },
        // A message with no nonce at all is not the current open's either.
        { type: 'close', payload: { errorMessage: 'no-sid' } }
      ]) {
        globalThis.dispatchEvent(
          new MessageEvent('message', {
            data,
            origin: DEFAULT_BACKUP_WIDGET_ORIGIN,
            source: iframe.contentWindow
          })
        )
      }

      expect(onExit).not.toHaveBeenCalled()
      // The stale `loaded` neither delivered the config nor cancelled the
      // Tier-1 → Tier-2 fallback for the current open.
      expect(postMessageSpy).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: BACKUP_CONFIG_MESSAGE_TYPE }),
        expect.anything()
      )
      jest.advanceTimersByTime(TIER1_READY_TIMEOUT_MS)
      expect(onEvent).toHaveBeenCalledWith({
        type: 'backupTierChanged',
        payload: { from: 'tier1', to: 'tier2', reason: 'readyTimeout' }
      })
    } finally {
      jest.clearAllTimers()
      jest.useRealTimers()
    }
  })

  test('openLinkBackup delivers the config to the widget on the "loaded" handshake', () => {
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn()
    })

    frontConnection.openLinkBackup(BACKUP_SESSION)

    const iframeElement = document.getElementById(
      'mesh-link-popup__iframe'
    ) as HTMLIFrameElement | null
    expect(iframeElement?.contentWindow).toBeTruthy()

    const postMessageSpy = jest.spyOn(
      iframeElement?.contentWindow as Window,
      'postMessage'
    )

    globalThis.dispatchEvent(
      new MessageEvent<{ type: EventType }>('message', {
        data: { type: 'loaded', sid: widgetSid(iframeElement) },
        origin: 'http://localhost',
        source: iframeElement?.contentWindow
      })
    )

    // Config is posted to the widget's own origin, not the host page origin.
    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: BACKUP_CONFIG_MESSAGE_TYPE, payload: BACKUP_SESSION },
      DEFAULT_BACKUP_WIDGET_ORIGIN
    )
  })

  test('backup callbacks reuse the host event contract (transferFinished / onExit)', () => {
    const onTransferFinished = jest.fn<void, [TransferFinishedPayload]>()
    const onExit = jest.fn<void, [string | undefined]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onTransferFinished,
      onExit
    })

    frontConnection.openLinkBackup(BACKUP_SESSION)

    // Backup-session events must come from the widget's own window (the SDK gates
    // every backup message on event.source, not just the origin).
    const widget = (
      document.getElementById(
        'mesh-link-popup__iframe'
      ) as HTMLIFrameElement | null
    )?.contentWindow

    const payload: TransferFinishedPayload = {
      status: 'success',
      txId: 'tid',
      fromAddress: 'fa',
      toAddress: 'ta',
      symbol: 'USDC',
      amount: 1,
      networkId: 'net-1'
    }
    globalThis.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'transferFinished', payload, sid: widgetSid(widget) },
        origin: 'http://localhost',
        source: widget
      })
    )
    expect(onTransferFinished).toHaveBeenCalledWith(payload)

    globalThis.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'close',
          payload: { errorMessage: 'bye' },
          sid: widgetSid(widget)
        },
        origin: 'http://localhost',
        source: widget
      })
    )
    expect(onExit).toHaveBeenCalledWith('bye', { errorMessage: 'bye' })
    expect(document.getElementById('mesh-link-popup__iframe')).toBeFalsy()
  })

  test('openLink after openLinkBackup does not leak the backup config on "loaded"', () => {
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn()
    })

    // A backup session, then a switch back to the primary (token) path.
    frontConnection.openLinkBackup(BACKUP_SESSION)
    frontConnection.openLink(BASE64_ENCODED_URL)

    const iframeElement = document.getElementById(
      'mesh-link-popup__iframe'
    ) as HTMLIFrameElement | null
    const postMessageSpy = jest.spyOn(
      iframeElement?.contentWindow as Window,
      'postMessage'
    )

    globalThis.dispatchEvent(
      new MessageEvent<{ type: EventType }>('message', {
        data: { type: 'loaded', sid: widgetSid(iframeElement) },
        origin: 'http://localhost'
      })
    )

    const leaked = postMessageSpy.mock.calls.find(
      ([message]) =>
        (message as { type?: string })?.type === BACKUP_CONFIG_MESSAGE_TYPE
    )
    expect(leaked).toBeUndefined()
  })

  test('openLinkBackup does not forward integration access tokens to the backup widget on "loaded"', () => {
    const tokens: IntegrationAccessToken[] = [
      {
        accessToken: 'at',
        accountId: 'aid',
        accountName: 'an',
        brokerType: 'acorns',
        brokerName: 'A'
      }
    ]
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      accessTokens: tokens
    })

    frontConnection.openLinkBackup(BACKUP_SESSION)

    const iframeElement = document.getElementById(
      'mesh-link-popup__iframe'
    ) as HTMLIFrameElement | null
    const postMessageSpy = jest.spyOn(
      iframeElement?.contentWindow as Window,
      'postMessage'
    )

    globalThis.dispatchEvent(
      new MessageEvent<{ type: EventType }>('message', {
        data: { type: 'loaded', sid: widgetSid(iframeElement) },
        origin: 'http://localhost',
        source: iframeElement?.contentWindow
      })
    )

    // The deposit-only backup widget must never receive integration credentials.
    const forwardedTokens = postMessageSpy.mock.calls.find(
      ([message]) =>
        (message as { type?: string })?.type === 'frontAccessTokens'
    )
    expect(forwardedTokens).toBeUndefined()
    // The backup config is still delivered.
    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: BACKUP_CONFIG_MESSAGE_TYPE, payload: BACKUP_SESSION },
      DEFAULT_BACKUP_WIDGET_ORIGIN
    )
  })

  test('a stale backup iframe does not receive access tokens after an aborted re-open', () => {
    // Regression (Copilot #4147285500): after a backup session, an aborted re-open
    // clears `backupSession` but leaves the old backup iframe + listener live. A
    // late `loaded` from that stale iframe must NOT pass the token-forwarding gate
    // (which is why the gate is `activeFlow === 'primary'`, not `!backupSession`).
    const tokens: IntegrationAccessToken[] = [
      {
        accessToken: 'at',
        accountId: 'aid',
        accountName: 'an',
        brokerType: 'acorns',
        brokerName: 'A'
      }
    ]
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      accessTokens: tokens
    })

    // 1. Open a backup session (creates the popup iframe at the backup origin).
    frontConnection.openLinkBackup(BACKUP_SESSION)
    const staleIframe = document.getElementById(
      'mesh-link-popup__iframe'
    ) as HTMLIFrameElement | null
    const postMessageSpy = jest.spyOn(
      staleIframe?.contentWindow as Window,
      'postMessage'
    )

    // 2. Abort a re-open with a malformed origin — clears backupSession, but the
    //    stale backup iframe above is not torn down.
    frontConnection.openLinkBackup(BACKUP_SESSION, {
      widgetOrigin: 'not-a-url'
    })

    // 3. The stale backup iframe fires a late `loaded`.
    globalThis.dispatchEvent(
      new MessageEvent<{ type: EventType }>('message', {
        data: { type: 'loaded', sid: widgetSid(staleIframe) },
        origin: DEFAULT_BACKUP_WIDGET_ORIGIN,
        source: staleIframe?.contentWindow
      })
    )

    const forwardedTokens = postMessageSpy.mock.calls.find(
      ([message]) =>
        (message as { type?: string })?.type === 'frontAccessTokens'
    )
    expect(forwardedTokens).toBeUndefined()
  })

  let frontConnection: ReturnType<typeof createLink>
  test.each([
    [
      'malformed widgetOrigin',
      () => {
        frontConnection.openLinkBackup(BACKUP_SESSION, {
          widgetOrigin: 'not-a-url'
        })
      }
    ],
    [
      'missing session',
      () => {
        frontConnection.openLinkBackup(undefined as unknown as MeshBackupConfig)
      }
    ],
    [
      'embedded without customIframeId',
      () => {
        createLink({
          clientId: 'test',
          onIntegrationConnected: jest.fn(),
          renderType: 'embedded'
        }).openLinkBackup(BACKUP_SESSION)
      }
    ]
  ])(
    'a stale backup iframe cannot close or report a transfer after an aborted re-open (%s)',
    (_, abortReopen) => {
      // Regression (Copilot #4152220541 / #4152244613, and the early-return aborts):
      // after an aborted re-open the old iframe + listener stay live while
      // `activeFlow` is null. A late `close`/`transferFinished` from it must be
      // dropped (the gate is the positive `activeFlow`, not `backupSession`, which is
      // also null in this dead window). Every abort path must tear down the prior
      // session, not just the ones that fail after validation starts.
      const onExit = jest.fn<void, [string | undefined]>()
      const onTransferFinished = jest.fn<void, [TransferFinishedPayload]>()
      frontConnection = createLink({
        clientId: 'test',
        onIntegrationConnected: jest.fn(),
        onExit,
        onTransferFinished
      })

      frontConnection.openLinkBackup(BACKUP_SESSION)
      const staleWindow = (
        document.getElementById(
          'mesh-link-popup__iframe'
        ) as HTMLIFrameElement | null
      )?.contentWindow

      // Abort a re-open — clears activeFlow/backupSession; the stale iframe +
      // listener remain.
      abortReopen()

      for (const data of [
        { type: 'transferFinished', payload: { status: 'success', txId: 'x' } },
        { type: 'close', payload: { errorMessage: 'stale' } }
      ]) {
        globalThis.dispatchEvent(
          new MessageEvent('message', {
            data: { ...data, sid: widgetSid(staleWindow) },
            origin: DEFAULT_BACKUP_WIDGET_ORIGIN,
            source: staleWindow
          })
        )
      }

      expect(onTransferFinished).not.toHaveBeenCalled()
      expect(onExit).not.toHaveBeenCalledWith('stale', expect.anything())
    }
  )

  test('openLinkBackup with a malformed widgetOrigin calls onExit and opens no popup', () => {
    const exitFunction = jest.fn<void, [string | undefined]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onExit: exitFunction
    })

    frontConnection.openLinkBackup(BACKUP_SESSION, {
      widgetOrigin: 'not-a-url'
    })

    expect(exitFunction).toHaveBeenCalledWith('Invalid backup widget origin!')
    expect(document.getElementById('mesh-link-popup__iframe')).toBeFalsy()
  })

  test('openLinkBackup embedded with a missing customIframeId warns and opens no popup', () => {
    const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      renderType: 'embedded'
    })

    frontConnection.openLinkBackup(BACKUP_SESSION, {
      customIframeId: 'does-not-exist'
    })

    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'Mesh SDK: No iframe found with id does-not-exist'
    )
    expect(document.getElementById('mesh-link-popup__iframe')).toBeFalsy()

    consoleWarnSpy.mockRestore()
  })
})

describe('openLinkBackup JIT callbacks + Tier-2 cascade', () => {
  globalThis.open = jest.fn()

  const BACKUP_SESSION: MeshBackupConfig = {
    clientId: 'client-1',
    userId: 'user-1',
    // Address-less ⇒ resolved via the JIT callbacks over the bridge.
    destinations: [
      { networkId: 'net-1', symbol: 'USDC' },
      // Static address ⇒ never resolved via JIT (not on the RPC allowlist).
      { networkId: 'net-2', symbol: 'USDT', address: '0xstatic' }
    ]
  }

  beforeEach(() => {
    document.getElementsByTagName('html')[0].innerHTML = ''
    ;(removePrewarmIframe as jest.Mock).mockReset()
  })

  const openBackupAndSpy = (options: Parameters<typeof createLink>[0]) => {
    const frontConnection = createLink(options)
    frontConnection.openLinkBackup(BACKUP_SESSION)
    const iframe = document.getElementById(
      'mesh-link-popup__iframe'
    ) as HTMLIFrameElement
    // Complete the Tier-1 ready handshake (also cancels the cascade timer). The
    // `loaded` handshake is only honoured from the widget's own window.
    globalThis.dispatchEvent(
      new MessageEvent('message', {
        data: { type: 'loaded', sid: widgetSid(iframe) },
        origin: 'http://localhost',
        source: iframe.contentWindow
      })
    )
    const postMessageSpy = jest.spyOn(
      iframe.contentWindow as Window,
      'postMessage'
    )
    return { frontConnection, iframe, postMessageSpy }
  }

  const dispatchJitRequest = (
    payload: {
      callId: string
      method: 'addressInit' | 'statusPoll'
      symbol: string
      networkId: string
    },
    // Defaults to the widget iframe's window (the real sender); override to
    // simulate a request from another frame.
    source?: MessageEventSource | null
  ) => {
    const iframe = document.getElementById(
      'mesh-link-popup__iframe'
    ) as HTMLIFrameElement | null
    globalThis.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: JIT_REQUEST_MESSAGE_TYPE,
          payload,
          sid: widgetSid(iframe)
        },
        origin: DEFAULT_BACKUP_WIDGET_ORIGIN,
        source: source === undefined ? iframe?.contentWindow : source
      })
    )
  }

  test("ignores a JIT request without the current open's session nonce", async () => {
    const onStatusPoll = jest.fn()
    const { iframe, postMessageSpy } = openBackupAndSpy({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onAddressInit: jest.fn(),
      onStatusPoll
    })

    for (const sid of [undefined, 'f'.repeat(32)]) {
      globalThis.dispatchEvent(
        new MessageEvent('message', {
          data: {
            type: JIT_REQUEST_MESSAGE_TYPE,
            payload: {
              callId: 'n1',
              method: 'statusPoll',
              symbol: 'USDC',
              networkId: 'net-1'
            },
            sid
          },
          origin: DEFAULT_BACKUP_WIDGET_ORIGIN,
          source: iframe.contentWindow
        })
      )
    }
    await flushPromises()

    expect(onStatusPoll).not.toHaveBeenCalled()
    expect(postMessageSpy).not.toHaveBeenCalled()
  })

  test('relays addressInit to onAddressInit and replies ok', async () => {
    const onAddressInit = jest.fn().mockResolvedValue(undefined)
    const { postMessageSpy } = openBackupAndSpy({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onAddressInit,
      onStatusPoll: jest.fn()
    })

    dispatchJitRequest({
      callId: 'a1',
      method: 'addressInit',
      symbol: 'USDC',
      networkId: 'net-1'
    })
    await flushPromises()

    expect(onAddressInit).toHaveBeenCalledWith('USDC', 'net-1')
    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: JIT_RESPONSE_MESSAGE_TYPE, payload: { callId: 'a1', ok: true } },
      DEFAULT_BACKUP_WIDGET_ORIGIN
    )
  })

  test('relays statusPoll to onStatusPoll and returns its result', async () => {
    const result = { status: 'ready' as const, address: '0xabc' }
    const onStatusPoll = jest.fn().mockResolvedValue(result)
    const { postMessageSpy } = openBackupAndSpy({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onAddressInit: jest.fn(),
      onStatusPoll
    })

    dispatchJitRequest({
      callId: 'p1',
      method: 'statusPoll',
      symbol: 'USDC',
      networkId: 'net-1'
    })
    await flushPromises()

    expect(onStatusPoll).toHaveBeenCalledWith('USDC', 'net-1')
    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        type: JIT_RESPONSE_MESSAGE_TYPE,
        payload: { callId: 'p1', ok: true, result }
      },
      DEFAULT_BACKUP_WIDGET_ORIGIN
    )
  })

  test('strips extra fields from the statusPoll result before posting to the widget', async () => {
    // A real backend response may carry extra fields (e.g. credentials); only the
    // contract fields may cross to the widget's independent origin.
    const onStatusPoll = jest.fn().mockResolvedValue({
      status: 'ready',
      address: '0xabc',
      addressTag: 'memo1',
      secretToken: 'do-not-leak',
      internalUrl: 'https://internal/x'
    })
    const { postMessageSpy } = openBackupAndSpy({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onAddressInit: jest.fn(),
      onStatusPoll
    })

    dispatchJitRequest({
      callId: 'p9',
      method: 'statusPoll',
      symbol: 'USDC',
      networkId: 'net-1'
    })
    await flushPromises()

    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        type: JIT_RESPONSE_MESSAGE_TYPE,
        payload: {
          callId: 'p9',
          ok: true,
          result: { status: 'ready', address: '0xabc', addressTag: 'memo1' }
        }
      },
      DEFAULT_BACKUP_WIDGET_ORIGIN
    )
  })

  test('replies ok:false with a fixed error when a JIT callback throws (no host detail leaked)', async () => {
    const onStatusPoll = jest
      .fn()
      .mockRejectedValue(new Error('secret backend url https://internal/x'))
    const { postMessageSpy } = openBackupAndSpy({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onAddressInit: jest.fn(),
      onStatusPoll
    })

    dispatchJitRequest({
      callId: 'p2',
      method: 'statusPoll',
      symbol: 'USDC',
      networkId: 'net-1'
    })
    await flushPromises()

    // The host exception text must NOT cross to the widget origin — fixed message.
    expect(postMessageSpy).toHaveBeenCalledWith(
      {
        type: JIT_RESPONSE_MESSAGE_TYPE,
        payload: { callId: 'p2', ok: false, error: 'JIT callback failed' }
      },
      DEFAULT_BACKUP_WIDGET_ORIGIN
    )
  })

  test.each([
    ['an unknown status', { status: 'done' }],
    ['a missing status', { address: '0xabc' }],
    ["status 'ready' without an address", { status: 'ready' }],
    [
      "status 'ready' with a non-string address",
      { status: 'ready', address: 123 }
    ],
    [
      "status 'ready' with a non-string addressTag",
      { status: 'ready', address: 'rXYZ', addressTag: 12345 }
    ],
    [
      "status 'ready' with an object addressTag",
      { status: 'ready', address: 'rXYZ', addressTag: { memo: '1' } }
    ]
  ])(
    'fails the poll closed (ok:false) when onStatusPoll returns %s',
    async (_name, badResult) => {
      const onStatusPoll = jest.fn().mockResolvedValue(badResult)
      const { postMessageSpy } = openBackupAndSpy({
        clientId: 'test',
        onIntegrationConnected: jest.fn(),
        onAddressInit: jest.fn(),
        onStatusPoll
      })

      dispatchJitRequest({
        callId: 'pm',
        method: 'statusPoll',
        symbol: 'USDC',
        networkId: 'net-1'
      })
      await flushPromises()

      // Malformed result must NOT be coerced to 'pending' (poll-forever) or
      // forwarded as an address-less 'ready' (invalid success) — fail closed.
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          type: JIT_RESPONSE_MESSAGE_TYPE,
          payload: { callId: 'pm', ok: false, error: 'JIT callback failed' }
        },
        DEFAULT_BACKUP_WIDGET_ORIGIN
      )
    }
  )

  test.each([
    ['addressInit', 'a pair not in the session', 'BTC', 'net-1'],
    ['statusPoll', 'a pair not in the session', 'USDC', 'net-9'],
    ['addressInit', 'a destination with a static address', 'USDT', 'net-2'],
    ['statusPoll', 'a destination with a static address', 'USDT', 'net-2']
  ] as const)(
    'rejects a %s request for %s without calling the host callbacks',
    async (method, _name, symbol, networkId) => {
      const onAddressInit = jest.fn().mockResolvedValue(undefined)
      const onStatusPoll = jest
        .fn()
        .mockResolvedValue({ status: 'ready', address: '0xabc' })
      const { postMessageSpy } = openBackupAndSpy({
        clientId: 'test',
        onIntegrationConnected: jest.fn(),
        onAddressInit,
        onStatusPoll
      })

      dispatchJitRequest({ callId: 'x1', method, symbol, networkId })
      await flushPromises()

      // The session's address-less destinations are the allowlist — even the
      // authenticated widget window cannot drive the client's backend for any
      // other pair.
      expect(onAddressInit).not.toHaveBeenCalled()
      expect(onStatusPoll).not.toHaveBeenCalled()
      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          type: JIT_RESPONSE_MESSAGE_TYPE,
          payload: { callId: 'x1', ok: false, error: 'JIT callback failed' }
        },
        DEFAULT_BACKUP_WIDGET_ORIGIN
      )
    }
  )

  test.each([
    ['pending', { status: 'pending' as const }],
    ['failed', { status: 'failed' as const }]
  ])(
    'forwards a valid %s status unchanged (ok:true)',
    async (_name, result) => {
      const onStatusPoll = jest.fn().mockResolvedValue(result)
      const { postMessageSpy } = openBackupAndSpy({
        clientId: 'test',
        onIntegrationConnected: jest.fn(),
        onAddressInit: jest.fn(),
        onStatusPoll
      })

      dispatchJitRequest({
        callId: 'pv',
        method: 'statusPoll',
        symbol: 'USDC',
        networkId: 'net-1'
      })
      await flushPromises()

      expect(postMessageSpy).toHaveBeenCalledWith(
        {
          type: JIT_RESPONSE_MESSAGE_TYPE,
          payload: { callId: 'pv', ok: true, result }
        },
        DEFAULT_BACKUP_WIDGET_ORIGIN
      )
    }
  )

  test('fails closed (ok:false) when the required JIT callback is not provided', async () => {
    const { postMessageSpy } = openBackupAndSpy({
      clientId: 'test',
      onIntegrationConnected: jest.fn()
      // no onStatusPoll
    })

    dispatchJitRequest({
      callId: 'p3',
      method: 'statusPoll',
      symbol: 'USDC',
      networkId: 'net-1'
    })
    await flushPromises()

    const call = postMessageSpy.mock.calls.find(
      ([m]) => (m as { type?: string })?.type === JIT_RESPONSE_MESSAGE_TYPE
    )
    expect(call?.[0]).toMatchObject({
      type: JIT_RESPONSE_MESSAGE_TYPE,
      payload: { callId: 'p3', ok: false }
    })
  })

  test('ignores a JIT request that does not come from the widget iframe (event.source)', async () => {
    const onStatusPoll = jest.fn().mockResolvedValue({
      status: 'ready',
      address: '0xabc'
    })
    openBackupAndSpy({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onAddressInit: jest.fn(),
      onStatusPoll
    })

    // A same-origin request from a different/unknown source must not drive the
    // client's backend callbacks.
    dispatchJitRequest(
      {
        callId: 'x1',
        method: 'statusPoll',
        symbol: 'USDC',
        networkId: 'net-1'
      },
      null
    )
    await flushPromises()

    expect(onStatusPoll).not.toHaveBeenCalled()
  })

  test('openLinkBackup rejects a non-http(s) widgetOrigin (javascript:)', () => {
    const onExit = jest.fn<void, [string | undefined]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onExit
    })

    frontConnection.openLinkBackup(BACKUP_SESSION, {
      // eslint-disable-next-line no-script-url
      widgetOrigin: 'javascript:alert(1)'
    })

    expect(onExit).toHaveBeenCalledWith('Invalid backup widget origin!')
    expect(document.getElementById('mesh-link-popup__iframe')).toBeFalsy()
  })

  test('cascades to the bundled Tier-2 widget and emits backupTierChanged on the ready timeout', async () => {
    jest.useFakeTimers()
    try {
      const onEvent = jest.fn<void, [LinkEventType]>()
      const frontConnection = createLink({
        clientId: 'test',
        onIntegrationConnected: jest.fn(),
        onEvent
      })
      frontConnection.openLinkBackup(BACKUP_SESSION)
      const tier1Sid = widgetSid(
        document.getElementById('mesh-link-popup__iframe') as HTMLIFrameElement
      )

      // No Tier-1 `loaded` arrives → the ready-handshake timeout fires.
      jest.advanceTimersByTime(TIER1_READY_TIMEOUT_MS)

      expect(onEvent).toHaveBeenCalledWith({
        type: 'backupTierChanged',
        payload: { from: 'tier1', to: 'tier2', reason: 'readyTimeout' }
      })

      // Flush the dynamic import + blob/sandbox swap.
      await flushPromises()

      const iframe = document.getElementById(
        'mesh-link-popup__iframe'
      ) as HTMLIFrameElement
      // Tier-2 loads a blob: URL in a sandboxed (opaque-origin) iframe — not srcdoc.
      expect(iframe.getAttribute('src')?.startsWith('blob:')).toBe(true)
      // A blob: URL can't take a query — the SAME open's nonce rides in the fragment.
      expect(tier1Sid).toMatch(/^[0-9a-f]{32}$/)
      expect(iframe.getAttribute('src')).toMatch(
        new RegExp(`#sid=${tier1Sid}$`)
      )
      expect(iframe.getAttribute('sandbox')).toBe('allow-scripts')
      expect(iframe.getAttribute('srcdoc')).toBeNull()
    } finally {
      jest.clearAllTimers()
      jest.useRealTimers()
    }
  })

  test('a Tier-1 ready handshake prevents the cascade', () => {
    jest.useFakeTimers()
    try {
      const onEvent = jest.fn<void, [LinkEventType]>()
      const frontConnection = createLink({
        clientId: 'test',
        onIntegrationConnected: jest.fn(),
        onEvent
      })
      frontConnection.openLinkBackup(BACKUP_SESSION)

      const iframe = document.getElementById(
        'mesh-link-popup__iframe'
      ) as HTMLIFrameElement
      globalThis.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'loaded', sid: widgetSid(iframe) },
          origin: 'http://localhost',
          source: iframe.contentWindow
        })
      )
      jest.advanceTimersByTime(TIER1_READY_TIMEOUT_MS * 2)

      const cascaded = onEvent.mock.calls.some(
        ([e]) => e.type === 'backupTierChanged'
      )
      expect(cascaded).toBe(false)
    } finally {
      jest.clearAllTimers()
      jest.useRealTimers()
    }
  })

  test('fails closed via onExit if Tier-2 itself never becomes ready', async () => {
    jest.useFakeTimers()
    try {
      const onExit = jest.fn<void, [string | undefined]>()
      const frontConnection = createLink({
        clientId: 'test',
        onIntegrationConnected: jest.fn(),
        onExit
      })
      frontConnection.openLinkBackup(BACKUP_SESSION)

      jest.advanceTimersByTime(TIER1_READY_TIMEOUT_MS) // cascade to tier2
      await flushPromises() // blob/sandbox swap

      // Tier-2 never handshakes → the fail-closed safety net fires.
      jest.advanceTimersByTime(TIER2_READY_TIMEOUT_MS)
      expect(onExit).toHaveBeenCalledWith('Backup deposit flow is unavailable')
    } finally {
      jest.clearAllTimers()
      jest.useRealTimers()
    }
  })

  test('a late Tier-1 message after cascade cannot cancel the Tier-2 fail-closed timer', async () => {
    jest.useFakeTimers()
    try {
      const onExit = jest.fn<void, [string | undefined]>()
      const frontConnection = createLink({
        clientId: 'test',
        onIntegrationConnected: jest.fn(),
        onExit
      })
      frontConnection.openLinkBackup(BACKUP_SESSION)

      const iframe = document.getElementById(
        'mesh-link-popup__iframe'
      ) as HTMLIFrameElement

      jest.advanceTimersByTime(TIER1_READY_TIMEOUT_MS) // cascade to tier2
      await flushPromises() // blob/sandbox swap

      // A navigation does NOT replace the iframe's window, so a late Tier-1
      // `loaded` (queued before the swap) still has source === the Tier-2 window —
      // but it carries the Tier-1 origin, not the opaque 'null'. The origin gate
      // must reject it so it can't markReady and cancel the fail-closed timer.
      globalThis.dispatchEvent(
        new MessageEvent('message', {
          data: { type: 'loaded', sid: widgetSid(iframe) },
          origin: DEFAULT_BACKUP_WIDGET_ORIGIN,
          source: iframe.contentWindow
        })
      )

      jest.advanceTimersByTime(TIER2_READY_TIMEOUT_MS)
      expect(onExit).toHaveBeenCalledWith('Backup deposit flow is unavailable')
    } finally {
      jest.clearAllTimers()
      jest.useRealTimers()
    }
  })

  test.each([
    ['with the matching session nonce', true],
    ['without the session nonce', false]
  ])(
    'Tier-2 handshake %s from the opaque-origin widget',
    async (_name, withSid) => {
      jest.useFakeTimers()
      try {
        const onExit = jest.fn<void, [string | undefined]>()
        const onEvent = jest.fn<void, [LinkEventType]>()
        const frontConnection = createLink({
          clientId: 'test',
          onIntegrationConnected: jest.fn(),
          onExit,
          onEvent
        })
        frontConnection.openLinkBackup(BACKUP_SESSION)
        const iframe = document.getElementById(
          'mesh-link-popup__iframe'
        ) as HTMLIFrameElement

        jest.advanceTimersByTime(TIER1_READY_TIMEOUT_MS) // cascade to tier2
        await flushPromises() // blob/sandbox swap
        const sid = withSid ? widgetSid(iframe) : undefined
        const postMessageSpy = jest.spyOn(
          iframe.contentWindow as Window,
          'postMessage'
        )

        // The real Tier-2 widget reads the nonce from its blob: URL fragment and
        // echoes it; its messages carry the opaque 'null' origin.
        const fromTier2 = (data: object) =>
          globalThis.dispatchEvent(
            new MessageEvent('message', {
              data: { ...data, sid },
              origin: 'null',
              source: iframe.contentWindow
            })
          )
        fromTier2({ type: 'loaded' })
        const qr = {
          type: 'linkTransferQRGenerated',
          payload: { symbol: 'USDC', networkId: 'net-1', network: 'Ethereum' }
        }
        fromTier2(qr)
        jest.advanceTimersByTime(TIER2_READY_TIMEOUT_MS)

        if (withSid) {
          // Handshake accepted: config delivered (opaque origin ⇒ '*' target), the
          // fail-closed timer cancelled, and the event forwarded WITHOUT the
          // transport-only `sid`.
          expect(postMessageSpy).toHaveBeenCalledWith(
            { type: BACKUP_CONFIG_MESSAGE_TYPE, payload: BACKUP_SESSION },
            '*'
          )
          expect(onExit).not.toHaveBeenCalled()
          expect(onEvent).toHaveBeenCalledWith(qr)
        } else {
          expect(postMessageSpy).not.toHaveBeenCalled()
          expect(onEvent).not.toHaveBeenCalledWith(qr)
          expect(onExit).toHaveBeenCalledWith(
            'Backup deposit flow is unavailable'
          )
        }
      } finally {
        jest.clearAllTimers()
        jest.useRealTimers()
      }
    }
  )

  test('a JIT request is ignored when there is no active backup session', async () => {
    const onStatusPoll = jest.fn()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onStatusPoll
    })

    // Primary (token) flow — no backup session active.
    frontConnection.openLink(BASE64_ENCODED_URL)
    globalThis.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: JIT_REQUEST_MESSAGE_TYPE,
          payload: {
            callId: 'x',
            method: 'statusPoll',
            symbol: 'USDC',
            networkId: 'net-1'
          }
        },
        origin: 'http://localhost'
      })
    )
    await flushPromises()

    expect(onStatusPoll).not.toHaveBeenCalled()
  })
})

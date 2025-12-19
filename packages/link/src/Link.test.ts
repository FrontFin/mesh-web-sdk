import { createLink } from './Link'
import { DoneEvent, LinkEventType } from './utils/event-types'
import {
  AccessTokenPayload,
  DelayedAuthPayload,
  EventType,
  LinkPayload,
  IntegrationAccessToken,
  TransferFinishedPayload
} from './utils/types'

jest.mock('@meshconnect/uwc-bridge-parent', () => ({
  BridgeParent: jest.fn().mockImplementation(() => ({
    destroy: jest.fn()
  }))
}))

type EventPayload = {
  type: EventType
  payload?: AccessTokenPayload | DelayedAuthPayload | TransferFinishedPayload
  message?: string
  link?: string
}

const BASE64_ENCODED_URL = Buffer.from('http://localhost/1').toString('base64')

describe('createLink tests', () => {
  window.open = jest.fn()

  beforeEach(() => {
    document.getElementsByTagName('html')[0].innerHTML = ''
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
      window.dispatchEvent(
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
    window.dispatchEvent(
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
    window.dispatchEvent(
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

  test('createLink "transferFinished" event should send transfer payload', () => {
    const onEventHandler = jest.fn<void, [LinkEventType]>()
    const onTransferFinishedHandler = jest.fn<void, [TransferFinishedPayload]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onEvent: onEventHandler,
      onTransferFinished: onTransferFinishedHandler
    })

    frontConnection.openLink(BASE64_ENCODED_URL)

    const payload: TransferFinishedPayload = {
      status: 'success',
      txId: 'tid',
      fromAddress: 'fa',
      toAddress: 'ta',
      symbol: 'BTC',
      amount: 0.001,
      networkId: 'nid',
      amountInFiat: 9.77,
      totalAmountInFiat: 10.02,
      networkName: 'Bitcoin',
      txHash: 'txHash',
      transferId: 'trid'
    }
    window.dispatchEvent(
      new MessageEvent<EventPayload>('message', {
        data: {
          type: 'transferFinished',
          payload: payload
        },
        origin: 'http://localhost'
      })
    )

    expect(onEventHandler).toHaveBeenCalledWith({
      type: 'transferCompleted',
      payload: payload
    })
    expect(onTransferFinishedHandler).toHaveBeenCalledWith(payload)
  })

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
    const destinationTokens: IntegrationAccessToken[] = [
      {
        accessToken: 'ttoken',
        accountId: 'tid',
        accountName: 'tname',
        brokerType: 'acorns',
        brokerName: 'tbrokername'
      }
    ]
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      accessTokens: tokens,
      transferDestinationTokens: destinationTokens
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

    window.dispatchEvent(
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

    expect(postMessageSpy).toHaveBeenCalledWith(
      { type: 'frontTransferDestinationTokens', payload: destinationTokens },
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

    window.dispatchEvent(
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

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'unknown'
        },
        origin: 'http://localhost'
      })
    )

    expect(onEventHandler).not.toHaveBeenCalled()
  })

  test('createLink "brokerageAccountAccessToken" event should send tokens - used with openLink function', () => {
    const onEventHandler = jest.fn<void, [LinkEventType]>()
    const onBrokerConnectedHandler = jest.fn<void, [LinkPayload]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: onBrokerConnectedHandler,
      onEvent: onEventHandler
    })

    frontConnection.openLink(
      Buffer.from('http://localhost/1').toString('base64')
    )

    const payload: AccessTokenPayload = {
      accountTokens: [],
      brokerBrandInfo: { brokerLogo: '' },
      brokerType: 'robinhood',
      brokerName: 'R'
    }
    window.dispatchEvent(
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
})

import { createLink } from './Link'
import { LinkEventType } from './utils/event-types'
import {
  AccessTokenPayload,
  DelayedAuthPayload,
  EventType,
  LinkPayload,
  IntegrationAccessToken,
  TransferFinishedPayload
} from './utils/types'

type EventPayload = {
  type: EventType
  payload?: AccessTokenPayload | DelayedAuthPayload | TransferFinishedPayload
  message?: string
  link?: string
}

describe('createLink tests', () => {
  window.open = jest.fn()

  test('createLink when invalid link provided should not open popup', () => {
    const exitFunction = jest.fn<void, [string | undefined]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onExit: exitFunction
    })

    frontConnection.openPopup('')

    expect(exitFunction).toBeCalledWith('Invalid link!')
    const iframeElement = document.getElementById('front-link-popup__iframe')
    expect(iframeElement).toBeFalsy()
  })

  test('createLink when valid link provided should open popup', () => {
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn()
    })

    frontConnection.openPopup('http://localhost/1')
    const iframeElement = document.getElementById('front-link-popup__iframe')
    expect(iframeElement).toBeTruthy()
    expect(iframeElement?.attributes.getNamedItem('src')?.nodeValue).toBe(
      'http://localhost/1'
    )
  })

  test('createLink closePopup should close popup', () => {
    const exitFunction = jest.fn<void, [string | undefined]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onExit: exitFunction
    })

    frontConnection.openPopup('http://localhost/1')
    frontConnection.closePopup()

    const iframeElement = document.getElementById('front-link-popup__iframe')
    expect(iframeElement).toBeFalsy()

    expect(exitFunction).toBeCalled()
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

      frontConnection.openPopup('http://localhost/1')
      window.dispatchEvent(
        new MessageEvent<EventPayload>('message', {
          data: {
            type: eventName,
            message: 'some msg'
          }
        })
      )

      const iframeElement = document.getElementById('front-link-popup__iframe')
      expect(iframeElement).toBeFalsy()

      expect(exitFunction).toBeCalledWith('some msg')
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

    frontConnection.openPopup('http://localhost/1')

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
        }
      })
    )

    expect(onEventHandler).toBeCalledWith({
      type: 'integrationConnected',
      payload: { accessToken: payload }
    })
    expect(onBrokerConnectedHandler).toBeCalledWith({ accessToken: payload })
  })

  test('createLink "delayedAuthentication" event should send dalayed tokens', () => {
    const onEventHandler = jest.fn<void, [LinkEventType]>()
    const onBrokerConnectedHandler = jest.fn<void, [LinkPayload]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: onBrokerConnectedHandler,
      onEvent: onEventHandler
    })

    frontConnection.openPopup('http://localhost/1')

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
        }
      })
    )

    expect(onEventHandler).toBeCalledWith({
      type: 'integrationConnected',
      payload: { delayedAuth: payload }
    })
    expect(onBrokerConnectedHandler).toBeCalledWith({ delayedAuth: payload })
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

    frontConnection.openPopup('http://localhost/1')

    const payload: TransferFinishedPayload = {
      status: 'success',
      txId: 'tid',
      fromAddress: 'fa',
      toAddress: 'ta',
      symbol: 'BTC',
      amount: 0.001,
      networkId: 'nid'
    }
    window.dispatchEvent(
      new MessageEvent<EventPayload>('message', {
        data: {
          type: 'transferFinished',
          payload: payload
        }
      })
    )

    expect(onEventHandler).toBeCalledWith({
      type: 'transferCompleted',
      payload: payload
    })
    expect(onTransferFinishedHandler).toBeCalledWith(payload)
  })

  test('createLink "oauthLinkOpen" event should open new window', () => {
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn()
    })

    frontConnection.openPopup('http://localhost/1')

    window.dispatchEvent(
      new MessageEvent<EventPayload>('message', {
        data: {
          type: 'oauthLinkOpen',
          link: 'https://localhost/2'
        }
      })
    )

    expect(window.open).toBeCalledWith(
      'https://localhost/2',
      '_blank',
      'popup,noopener,noreferrer,resizable,scrollbars,width=700,height=800,top=-400,left=-350'
    )
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

    frontConnection.openPopup('http://localhost/1')

    const iframeElement = document.getElementById(
      'front-link-popup__iframe'
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
        }
      })
    )

    expect(postMessageSpy).toBeCalledWith(
      { type: 'frontAccessTokens', payload: tokens },
      'http://localhost'
    )

    expect(postMessageSpy).toBeCalledWith(
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

    frontConnection.openPopup('http://localhost/1')

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'integrationConnected'
        }
      })
    )

    expect(onEventHandler).toBeCalled()
  })

  test('createLink unknown event should not send any events', () => {
    const onEventHandler = jest.fn<void, [LinkEventType]>()
    const frontConnection = createLink({
      clientId: 'test',
      onIntegrationConnected: jest.fn(),
      onEvent: onEventHandler
    })

    frontConnection.openPopup('http://localhost/1')

    window.dispatchEvent(
      new MessageEvent('message', {
        data: {
          type: 'unknown'
        }
      })
    )

    expect(onEventHandler).not.toBeCalled()
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
        }
      })
    )

    expect(onEventHandler).toBeCalledWith({
      type: 'integrationConnected',
      payload: { accessToken: payload }
    })
    expect(onBrokerConnectedHandler).toBeCalledWith({ accessToken: payload })
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

    const iframeElement = document.getElementById('front-link-popup__iframe')
    expect(iframeElement).toBeFalsy()

    expect(exitFunction).toBeCalled()
  })
})

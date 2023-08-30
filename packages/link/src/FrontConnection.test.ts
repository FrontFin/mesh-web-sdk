import { createFrontConnection } from './FrontConnection'
import { FrontEventType } from './utils/event-types'
import {
  AccessTokenPayload,
  DelayedAuthPayload,
  EventType,
  FrontPayload,
  IntegrationAccessToken,
  TransferFinishedPayload
} from './utils/types'

type EventPayload = {
  type: EventType
  payload?: AccessTokenPayload | DelayedAuthPayload | TransferFinishedPayload
  message?: string
  link?: string
}

describe('createFrontConnection tests', () => {
  window.open = jest.fn()

  test('createFrontConnection when invalid link provided should not open popup', () => {
    const exitFunction = jest.fn<void, [string | undefined]>()
    const frontConnection = createFrontConnection({
      clientId: 'test',
      onBrokerConnected: jest.fn(),
      onExit: exitFunction
    })

    frontConnection.openPopup('')

    expect(exitFunction).toBeCalledWith('Invalid link!')
    const iframeElement = document.getElementById('front-link-popup__iframe')
    expect(iframeElement).toBeFalsy()
  })

  test('createFrontConnection when valid link provided should open popup', () => {
    const frontConnection = createFrontConnection({
      clientId: 'test',
      onBrokerConnected: jest.fn()
    })

    frontConnection.openPopup('http://localhost/1')
    const iframeElement = document.getElementById('front-link-popup__iframe')
    expect(iframeElement).toBeTruthy()
    expect(iframeElement?.attributes.getNamedItem('src')?.nodeValue).toBe(
      'http://localhost/1'
    )
  })

  test('createFrontConnection when valid link provided should open popup', () => {
    const frontConnection = createFrontConnection({
      clientId: 'test',
      onBrokerConnected: jest.fn()
    })

    frontConnection.openPopup('http://localhost/1')
    const iframeElement = document.getElementById('front-link-popup__iframe')
    expect(iframeElement).toBeTruthy()
    expect(iframeElement?.attributes.getNamedItem('src')?.nodeValue).toBe(
      'http://localhost/1'
    )
  })

  test('createFrontConnection closePopup should close popup', () => {
    const exitFunction = jest.fn<void, [string | undefined]>()
    const frontConnection = createFrontConnection({
      clientId: 'test',
      onBrokerConnected: jest.fn(),
      onExit: exitFunction
    })

    frontConnection.openPopup('http://localhost/1')
    frontConnection.closePopup()

    const iframeElement = document.getElementById('front-link-popup__iframe')
    expect(iframeElement).toBeFalsy()

    expect(exitFunction).toBeCalled()
  })

  test.each(['close', 'done'] as const)(
    'createFrontConnection "%s" event should close popup',
    eventName => {
      const exitFunction = jest.fn<void, [string | undefined]>()
      const frontConnection = createFrontConnection({
        clientId: 'test',
        onBrokerConnected: jest.fn(),
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

  test('createFrontConnection "brokerageAccountAccessToken" event should send tokens', () => {
    const onEventHandler = jest.fn<void, [FrontEventType]>()
    const onBrokerConnectedHandler = jest.fn<void, [FrontPayload]>()
    const frontConnection = createFrontConnection({
      clientId: 'test',
      onBrokerConnected: onBrokerConnectedHandler,
      onEvent: onEventHandler
    })

    frontConnection.openPopup('http://localhost/1')

    const payload: AccessTokenPayload = {
      accountTokens: [],
      brokerBrandInfo: { brokerLogo: '' },
      brokerType: 'Robinhood',
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

  test('createFrontConnection "delayedAuthentication" event should send dalayed tokens', () => {
    const onEventHandler = jest.fn<void, [FrontEventType]>()
    const onBrokerConnectedHandler = jest.fn<void, [FrontPayload]>()
    const frontConnection = createFrontConnection({
      clientId: 'test',
      onBrokerConnected: onBrokerConnectedHandler,
      onEvent: onEventHandler
    })

    frontConnection.openPopup('http://localhost/1')

    const payload: DelayedAuthPayload = {
      brokerBrandInfo: { brokerLogo: '' },
      brokerType: 'Robinhood',
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

  test('createFrontConnection "transferFinished" event should send transfer payload', () => {
    const onEventHandler = jest.fn<void, [FrontEventType]>()
    const onTransferFinishedHandler = jest.fn<void, [TransferFinishedPayload]>()
    const frontConnection = createFrontConnection({
      clientId: 'test',
      onBrokerConnected: jest.fn(),
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

  test('createFrontConnection "oauthLinkOpen" event should open new window', () => {
    const frontConnection = createFrontConnection({
      clientId: 'test',
      onBrokerConnected: jest.fn()
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

  test('createFrontConnection "loaded" event should trigger the passing for tokens', () => {
    const tokens: IntegrationAccessToken[] = [
      {
        accessToken: 'at',
        accountId: 'aid',
        accountName: 'an',
        brokerType: 'Acorns',
        brokerName: 'A'
      }
    ]
    const frontConnection = createFrontConnection({
      clientId: 'test',
      onBrokerConnected: jest.fn(),
      accessTokens: tokens
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
  })

  test('createFrontConnection "integrationConnected" event should send event', () => {
    const onEventHandler = jest.fn<void, [FrontEventType]>()
    const frontConnection = createFrontConnection({
      clientId: 'test',
      onBrokerConnected: jest.fn(),
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

  test('createFrontConnection unknown event should not send any events', () => {
    const onEventHandler = jest.fn<void, [FrontEventType]>()
    const frontConnection = createFrontConnection({
      clientId: 'test',
      onBrokerConnected: jest.fn(),
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
})

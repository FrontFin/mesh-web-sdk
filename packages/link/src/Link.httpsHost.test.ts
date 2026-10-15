/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://merchant.example/checkout"}
 */
import { createLink } from './Link'

jest.mock('@meshconnect/uwc-bridge-parent', () => ({
  BridgeParent: jest.fn().mockImplementation(() => ({
    destroy: jest.fn()
  }))
}))

jest.mock('./utils/prewarm', () => ({
  createPrewarmIframe: jest.fn(),
  removePrewarmIframe: jest.fn()
}))

// Slashless forms parse to the Mesh origin on their own, but as a raw iframe `src`
// on an https host page they resolve relative to that page.
describe('openLink on an https host page', () => {
  beforeEach(() => {
    document.getElementsByTagName('html')[0].innerHTML = ''
  })

  test.each([
    'https:web.meshconnect.com/b/1',
    'https:/web.meshconnect.com/b/1'
  ])('loads %s from the Mesh origin, not the host page', decodedUrl => {
    const exitFunction = jest.fn()
    const customIframeElement = document.createElement('iframe')
    customIframeElement.id = 'custom-iframe-id'
    document.body.appendChild(customIframeElement)

    const frontConnection = createLink({
      onIntegrationConnected: jest.fn(),
      onExit: exitFunction
    })

    const token = Buffer.from(decodedUrl).toString('base64')
    frontConnection.openLink(token)
    frontConnection.openLink(token, 'custom-iframe-id')

    expect(exitFunction).not.toHaveBeenCalled()
    const expectedSrc = 'https://web.meshconnect.com/b/1?lng=en'
    expect(
      document.getElementById('mesh-link-popup__iframe')?.getAttribute('src')
    ).toBe(expectedSrc)
    expect(customIframeElement.getAttribute('src')).toBe(expectedSrc)
    expect(customIframeElement.src).toBe(expectedSrc)
  })
})

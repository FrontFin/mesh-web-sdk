import { createPrewarmIframe, removePrewarmIframe } from './prewarm'

describe('Prewarm tests', () => {
  beforeEach(() => {
    // Clean up any existing prewarm containers
    const existingContainer = document.getElementById(
      'mesh-link-prewarm-container'
    )
    if (existingContainer) {
      existingContainer.remove()
    }
  })

  describe('createPrewarmIframe', () => {
    test('should create a hidden container and iframe', () => {
      createPrewarmIframe()

      const container = document.getElementById('mesh-link-prewarm-container')
      expect(container).toBeTruthy()
      expect(container?.style.display).toBe('none')
      expect(container?.style.position).toBe('fixed')
      expect(container?.style.top).toBe('0px')
      expect(container?.style.left).toBe('0px')
      expect(container?.style.width).toBe('0px')
      expect(container?.style.height).toBe('0px')
      expect(container?.style.pointerEvents).toBe('none')
      expect(container?.style.visibility).toBe('hidden')
      expect(container?.parentElement).toBe(document.body)

      const iframe = document.getElementById(
        'mesh-link-prewarm-iframe'
      ) as HTMLIFrameElement | null
      expect(iframe).toBeTruthy()
      expect(iframe?.id).toBe('mesh-link-prewarm-iframe')
      expect(iframe?.style.width).toBe('100%')
      expect(iframe?.style.height).toBe('100%')
      expect(iframe?.src).toBe('https://web.meshconnect.com/prewarm')
    })

    test('should not create duplicate containers if called multiple times', () => {
      createPrewarmIframe()
      const firstContainer = document.getElementById(
        'mesh-link-prewarm-container'
      )
      const firstIframe = document.getElementById('mesh-link-prewarm-iframe')

      createPrewarmIframe()

      const containers = document.querySelectorAll(
        '#mesh-link-prewarm-container'
      )
      const iframes = document.querySelectorAll('#mesh-link-prewarm-iframe')

      expect(containers.length).toBe(1)
      expect(iframes.length).toBe(1)
      expect(document.getElementById('mesh-link-prewarm-container')).toBe(
        firstContainer
      )
      expect(document.getElementById('mesh-link-prewarm-iframe')).toBe(
        firstIframe
      )
    })
  })

  describe('removePrewarmIframe', () => {
    test('should remove the container if it exists', () => {
      createPrewarmIframe()
      expect(
        document.getElementById('mesh-link-prewarm-container')
      ).toBeTruthy()
      expect(document.getElementById('mesh-link-prewarm-iframe')).toBeTruthy()

      removePrewarmIframe()

      expect(document.getElementById('mesh-link-prewarm-container')).toBeFalsy()
      expect(document.getElementById('mesh-link-prewarm-iframe')).toBeFalsy()
    })

    test('should not throw error if container does not exist', () => {
      expect(() => {
        removePrewarmIframe()
      }).not.toThrow()

      expect(document.getElementById('mesh-link-prewarm-container')).toBeFalsy()
    })
  })
})

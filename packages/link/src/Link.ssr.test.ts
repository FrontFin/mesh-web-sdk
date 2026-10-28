/** @jest-environment node */

jest.mock('./utils/prewarm', () => ({
  createPrewarmIframe: jest.fn(),
  removePrewarmIframe: jest.fn()
}))

describe('Link SSR safety', () => {
  test('imports Link module without window and does not prewarm', () => {
    expect(() => {
      jest.isolateModules(() => {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        require('./Link')
      })
    }).not.toThrow()

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const prewarm = require('./utils/prewarm')
    expect(prewarm.createPrewarmIframe).not.toHaveBeenCalled()
  })
})


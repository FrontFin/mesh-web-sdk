import { createBackupTierController } from './backupTier'
import { TIER1_READY_TIMEOUT_MS, TIER2_READY_TIMEOUT_MS } from './backup'

describe('createBackupTierController', () => {
  beforeEach(() => jest.useFakeTimers())
  afterEach(() => {
    jest.clearAllTimers()
    jest.useRealTimers()
  })

  const setup = () => {
    const onFallback = jest.fn()
    const onTier2Unavailable = jest.fn()
    const controller = createBackupTierController({
      onFallback,
      onTier2Unavailable
    })
    return { controller, onFallback, onTier2Unavailable }
  }

  test('starts in tier1', () => {
    const { controller } = setup()
    expect(controller.getTier()).toBe('tier1')
  })

  test('cascades to tier2 on the ready-handshake timeout', () => {
    const { controller, onFallback } = setup()
    controller.start()

    jest.advanceTimersByTime(TIER1_READY_TIMEOUT_MS - 1)
    expect(onFallback).not.toHaveBeenCalled()

    jest.advanceTimersByTime(1)
    expect(onFallback).toHaveBeenCalledWith('readyTimeout')
    expect(controller.getTier()).toBe('tier2')
  })

  test('markReady before the timeout cancels the cascade', () => {
    const { controller, onFallback, onTier2Unavailable } = setup()
    controller.start()
    controller.markReady()

    jest.advanceTimersByTime(TIER1_READY_TIMEOUT_MS * 2)
    expect(onFallback).not.toHaveBeenCalled()
    expect(onTier2Unavailable).not.toHaveBeenCalled()
    expect(controller.getTier()).toBe('tier1')
  })

  test('reportLoadError in tier1 cascades immediately, before the timeout', () => {
    const { controller, onFallback } = setup()
    controller.start()

    controller.reportLoadError()
    expect(onFallback).toHaveBeenCalledWith('loadError')
    expect(controller.getTier()).toBe('tier2')
  })

  test('is single-shot: a second trigger after cascade is a no-op', () => {
    const { controller, onFallback } = setup()
    controller.start()

    controller.reportLoadError()
    controller.reportLoadError()
    jest.advanceTimersByTime(TIER1_READY_TIMEOUT_MS)
    expect(onFallback).toHaveBeenCalledTimes(1)
  })

  test('after markReady, a later load error does not cascade (mid-session blip ignored)', () => {
    const { controller, onFallback } = setup()
    controller.start()
    controller.markReady()

    controller.reportLoadError()
    expect(onFallback).not.toHaveBeenCalled()
    expect(controller.getTier()).toBe('tier1')
  })

  test('fails closed if tier2 never becomes ready', () => {
    const { controller, onFallback, onTier2Unavailable } = setup()
    controller.start()

    controller.reportLoadError() // → tier2, arms the tier2 safety timer
    expect(onFallback).toHaveBeenCalledWith('loadError')

    jest.advanceTimersByTime(TIER2_READY_TIMEOUT_MS - 1)
    expect(onTier2Unavailable).not.toHaveBeenCalled()
    jest.advanceTimersByTime(1)
    expect(onTier2Unavailable).toHaveBeenCalledTimes(1)
  })

  test('tier2 markReady cancels the fail-closed safety net', () => {
    const { controller, onTier2Unavailable } = setup()
    controller.start()
    controller.reportLoadError() // → tier2
    controller.markReady() // tier2 handshook

    jest.advanceTimersByTime(TIER2_READY_TIMEOUT_MS * 2)
    expect(onTier2Unavailable).not.toHaveBeenCalled()
  })

  test('a load error in tier2 (before ready) fails closed', () => {
    const { controller, onTier2Unavailable } = setup()
    controller.start()
    controller.reportLoadError() // → tier2
    controller.reportLoadError() // tier2 load error → fail closed
    expect(onTier2Unavailable).toHaveBeenCalledTimes(1)
  })

  test('fail-closed is only reported once', () => {
    const { controller, onTier2Unavailable } = setup()
    controller.start()
    controller.reportLoadError() // → tier2
    controller.reportLoadError() // fail closed (1)
    jest.advanceTimersByTime(TIER2_READY_TIMEOUT_MS) // safety timer would also fire
    expect(onTier2Unavailable).toHaveBeenCalledTimes(1)
  })

  test('destroy clears the pending timer', () => {
    const { controller, onFallback } = setup()
    controller.start()
    controller.destroy()

    jest.advanceTimersByTime(TIER1_READY_TIMEOUT_MS * 2)
    expect(onFallback).not.toHaveBeenCalled()
  })
})

import { TIER1_READY_TIMEOUT_MS, TIER2_READY_TIMEOUT_MS } from './backup'

/** Which redundancy tier the backup flow is currently serving (design §5H). */
export type BackupTier = 'tier1' | 'tier2'

/**
 * Why Tier 1 was abandoned. `loadError` = a hard iframe load failure on the
 * backup-origin document; `readyTimeout` = the widget did not complete its ready
 * handshake within {@link TIER1_READY_TIMEOUT_MS} (the authoritative signal on
 * web, where a cross-origin iframe rarely fires a load `error`).
 */
export type BackupTierFallbackReason = 'loadError' | 'readyTimeout'

export interface BackupTierControllerCallbacks {
  /**
   * Called exactly once, on the Tier-1 → Tier-2 transition, so the caller can
   * swap the iframe to the bundled assets and emit the `backupTierChanged` event.
   */
  onFallback: (reason: BackupTierFallbackReason) => void
  /**
   * Called if Tier 2 itself never becomes ready — the bundled assets are local so
   * this should be unreachable, but it is the fail-closed safety net that surfaces
   * an error instead of a blank screen (design §5A/§5H).
   */
  onTier2Unavailable: () => void
}

export interface BackupTierController {
  /** The tier to render right now. */
  getTier: () => BackupTier
  /**
   * Arm the Tier-1 ready-handshake timeout. Call once, right after the Tier-1
   * iframe starts loading. No-op once ready or already cascaded.
   */
  start: () => void
  /** Call when the current surface completes its ready handshake (its `loaded`). */
  markReady: () => void
  /**
   * Call on a hard load error on the current surface. In Tier 1 (before ready)
   * this cascades to Tier 2; in Tier 2 it fails closed. After Tier 1 is ready it
   * is ignored (a mid-session blip must not discard the funnel).
   */
  reportLoadError: () => void
  /** Clear any pending timer (call on teardown). */
  destroy: () => void
}

/**
 * Tier-1 → Tier-2 cascade state machine for the backup deposit flow (design §5H),
 * as a framework-agnostic controller (the web SDK is imperative — no React). A
 * direct port of the RN `useBackupTier` hook's semantics.
 *
 * The flow initializes in Tier 1 (widget loaded from the independent backup
 * origin). If the origin is unreachable — a hard load error, or the widget never
 * completes its ready handshake within {@link TIER1_READY_TIMEOUT_MS} — the SDK
 * falls back to the bundled Tier-2 assets and re-delivers the same config. The
 * cascade is **monotonic and single-shot**: Tier 1 is attempted once per session
 * and, once in Tier 2, the flow stays there (no flap back). If Tier 2 itself
 * never becomes ready, the caller fails closed rather than showing a blank QR.
 */
export function createBackupTierController(
  callbacks: BackupTierControllerCallbacks
): BackupTierController {
  let tier: BackupTier = 'tier1'
  let ready = false
  // Single-shot latch: once we leave Tier 1 it can never be re-entered, and a
  // second trigger of any kind is a no-op.
  let cascaded = false
  // Fail-closed latch: Tier 2 can be reported unavailable by both a load error
  // and the safety timeout, but the host must only be exited once.
  let failedClosed = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const clearTimer = () => {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const failClosed = () => {
    if (failedClosed) return
    failedClosed = true
    clearTimer()
    callbacks.onTier2Unavailable()
  }

  const cascadeToTier2 = (reason: BackupTierFallbackReason) => {
    // Monotonic + single-shot: only ever from a not-yet-ready Tier 1.
    if (cascaded || tier !== 'tier1' || ready) return
    cascaded = true
    clearTimer()
    tier = 'tier2'
    ready = false
    callbacks.onFallback(reason)

    // Fail-closed safety net: the bundled assets are local, so Tier 2 should
    // become ready almost instantly; if it does not, surface an error.
    timer = setTimeout(() => {
      timer = null
      if (!ready) failClosed()
    }, TIER2_READY_TIMEOUT_MS)
  }

  return {
    getTier: () => tier,
    start: () => {
      if (ready || cascaded) return
      clearTimer()
      timer = setTimeout(() => {
        timer = null
        cascadeToTier2('readyTimeout')
      }, TIER1_READY_TIMEOUT_MS)
    },
    markReady: () => {
      ready = true
      // Whichever tier just handshook is healthy — cancel its pending timer.
      clearTimer()
    },
    reportLoadError: () => {
      if (tier === 'tier1') {
        // Immediate cascade — do not wait out the ready timeout (design §5H).
        cascadeToTier2('loadError')
      } else if (!ready) {
        // Tier 2 (local assets) failing to load is effectively impossible; if it
        // happens, fail closed rather than reload into the same failure.
        failClosed()
      }
    },
    destroy: clearTimer
  }
}

/**
 * The boot → page handoff.
 *
 * The boot plate is the sheet being ruled before it is drawn. When it lifts, the
 * page underneath is already in place: the hero mounted, its WebGL plot has
 * written its first frame, and its intro timeline has been running behind the
 * plate — it is never replayed, and it is never waited for twice.
 *
 * The event below is the public seam. Nothing consumes it today, because the
 * hero's intro is already timed to be settling as the plate lifts; any later
 * lane that needs to know *when* the sheet becomes readable (a second canvas, an
 * analytics mark, a sound cue) listens here instead of guessing at timings.
 */
export const SHEET_READY = 'sheet:ready'

export type SheetReadyDetail = {
  /** `boot` when the plate actually drew; `skipped` for reduced motion, a
   *  same-session return, or a deep link straight into a section. */
  path: 'boot' | 'skipped'
  /** Milliseconds from the plate's first frame to the release. */
  elapsed: number
}

export function announceSheetReady(detail: SheetReadyDetail): void {
  window.dispatchEvent(new CustomEvent<SheetReadyDetail>(SHEET_READY, { detail }))
}

/** Subscribe to the handoff. Returns the unsubscribe function. */
export function onSheetReady(handler: (detail: SheetReadyDetail) => void): () => void {
  const listener = (event: Event) => {
    handler((event as CustomEvent<SheetReadyDetail>).detail)
  }
  window.addEventListener(SHEET_READY, listener)
  return () => window.removeEventListener(SHEET_READY, listener)
}

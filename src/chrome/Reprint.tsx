import { useEffect, useRef } from 'react'
import { bayerRanks } from './bayer'
import { prefersReducedMotion } from '../lib/reveal'
import { setReprintHandler } from '../lib/reprint'
import type { ReprintRun } from '../lib/reprint'
import './reprint.css'

/* ============================================================================
   Reprint — the plate change, pulled off the press
   ----------------------------------------------------------------------------
   A route change is a new impression of the same sheet. The outgoing page is
   not faded out and the incoming one is not faded in: an opaque ground plate is
   laid over the page, an 8 × 8 Bayer screen is pulled across it, and the plate's
   trailing edge lifts to reveal the new page already composed behind it.

   The geometry, all in device pixels on one fixed canvas:

   - 0–80 ms   the opaque ground plate enters from the left; its leading edge
               runs 0 → W while the screen's edge waits at 0. The router commits
               the new page at 80 ms, when the plate is exactly full — the swap
               happens entirely behind it.
   - 80–300 ms the screen is pulled across the plate, hard edge left → right.
               The 2 px `--mark` registration rule rides that edge.
   - 300–380 ms the plate's trailing edge runs 0 → W and the new page is
               revealed. The same rule rides this edge.
   - 380 ms    the canvas is cleared and the single rAF stops.

   The canvas is created on the first internal navigation, never on a deep link,
   and never at all under reduced motion. It is one element for the life of the
   app: later runs reuse the context, the palette and the pattern.

   The screen is a `createPattern` tile, not per-pixel rectangles: 8 × 8 cells
   of 3 device px (a 24 × 24 tile), half of them printed, so a frame is a few
   full-region fills instead of hundreds of thousands of `fillRect` calls.
   ========================================================================== */

/** The whole gesture. */
const DURATION = 380

/** The plate is full: the route commits here, behind it. */
const ENTER_END = 80

/** The screen has crossed; the trailing edge starts to lift. */
const CROSS_END = 300

/** One screen cell, in device pixels. */
const CELL = 3

/** Matrix edge: the 8 × 8 ranks shared with the atmosphere and the veil. */
const MATRIX = 8

/** The repeating tile, in device pixels. */
const TILE = MATRIX * CELL

/** Share of the matrix that prints. Half reads as a screen, not as a tint. */
const COVERAGE = 0.5

/** The registration rule. */
const RULE = 2

/** Cap the backing store, as the rest of the sheet. The cell stays 3 device px. */
const DPR_CAP = 2

/**
 * The same 8 × 8 Bayer screen as the atmosphere, as a canvas pattern.
 * The tile is alpha-only: the ink is the `--contour` token read by the caller,
 * so the screen and the page cannot drift apart.
 */
function buildPattern(ctx: CanvasRenderingContext2D, colour: string): CanvasPattern | null {
  const tile = document.createElement('canvas')
  tile.width = TILE
  tile.height = TILE
  const tileCtx = tile.getContext('2d')
  if (!tileCtx) return null

  const ranks = bayerRanks()
  const threshold = MATRIX * MATRIX * COVERAGE

  // Low alpha: the screen darkens the ground by a step, it never draws ink.
  tileCtx.globalAlpha = 0.34
  tileCtx.fillStyle = colour
  for (let y = 0; y < MATRIX; y++) {
    for (let x = 0; x < MATRIX; x++) {
      if (ranks[y * MATRIX + x] >= threshold) continue
      tileCtx.fillRect(x * CELL, y * CELL, CELL, CELL)
    }
  }

  return ctx.createPattern(tile, 'repeat')
}

export default function Reprint() {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    // Reduced motion gets the instant cut: no handler, no canvas, ever.
    if (prefersReducedMotion()) return

    let canvas: HTMLCanvasElement | null = null
    let ctx: CanvasRenderingContext2D | null = null
    let pattern: CanvasPattern | null = null
    let ground = ''
    let mark = ''
    let frame = 0
    let start = 0
    let committed = false

    /** The one creation path: canvas, context, palette and pattern, once. */
    const ensure = (): boolean => {
      if (canvas && ctx) return true

      const surface = document.createElement('canvas')
      surface.className = 'reprint__canvas'
      surface.setAttribute('aria-hidden', 'true')
      const context = surface.getContext('2d')
      if (!context) return false

      host.appendChild(surface)
      canvas = surface
      ctx = context

      const styles = getComputedStyle(document.documentElement)
      ground = styles.getPropertyValue('--ground').trim()
      mark = styles.getPropertyValue('--mark').trim()
      pattern = buildPattern(context, styles.getPropertyValue('--contour').trim())

      return true
    }

    /** Cheap and only at the start of a run: a resize is a new viewport. */
    const resize = (): void => {
      if (!canvas) return
      const dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP)
      const width = Math.max(1, Math.round(host.clientWidth * dpr))
      const height = Math.max(1, Math.round(host.clientHeight * dpr))
      if (canvas.width !== width) canvas.width = width
      if (canvas.height !== height) canvas.height = height
    }

    /** One frame, from elapsed time only — no timeline, no tween state. */
    const paint = (elapsed: number): void => {
      if (!canvas || !ctx) return
      const w = canvas.width
      const h = canvas.height
      ctx.clearRect(0, 0, w, h)

      let reveal = 0
      let cover: number
      let screenRight: number
      let edge: number

      if (elapsed < ENTER_END) {
        cover = (elapsed / ENTER_END) * w
        // The screen has not been pulled yet: no dither is drawn ahead of it,
        // otherwise its edge would jump back to 0 when the crossing starts.
        screenRight = 0
        edge = cover
      } else if (elapsed < CROSS_END) {
        cover = w
        screenRight = ((elapsed - ENTER_END) / (CROSS_END - ENTER_END)) * w
        edge = screenRight
      } else {
        cover = w
        screenRight = w
        reveal = ((elapsed - CROSS_END) / (DURATION - CROSS_END)) * w
        edge = reveal
      }

      // Quantised to whole device pixels: the rule is exactly 2 px wide at any
      // DPR, and the screen's edge is hard rather than half-covered.
      const right = Math.round(cover)
      const left = Math.round(reveal)
      const screen = Math.round(screenRight)
      const x = Math.round(edge)

      // The opaque plate: this is what actually hides the outgoing page.
      ctx.fillStyle = ground
      ctx.fillRect(left, 0, right - left, h)

      // The screen, pulled across the plate behind its own hard edge.
      if (pattern) {
        ctx.fillStyle = pattern
        ctx.fillRect(left, 0, screen - left, h)
      }

      // The registration rule, on whichever edge is moving.
      ctx.fillStyle = mark
      ctx.fillRect(x - RULE / 2, 0, RULE, h)
    }

    const run: ReprintRun = (commit) => {
      if (!ensure()) {
        // No 2D context: the route must still change.
        commit()
        return
      }

      // The nav sits above the plate, so a second click can land mid-gesture.
      // One plate serves both: if it has not committed yet, its commit renders
      // the latest location; if it has, the new page is committed at once rather
      // than restarting a sweep that would flash the page uncovered.
      if (frame !== 0) {
        if (committed) commit()
        return
      }

      resize()
      start = performance.now()
      committed = false

      const step = (now: number) => {
        const elapsed = Math.max(0, now - start)
        paint(elapsed)

        if (!committed && elapsed >= ENTER_END) {
          committed = true
          commit()
        }

        if (elapsed >= DURATION) {
          if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
          frame = 0
          return
        }

        frame = requestAnimationFrame(step)
      }

      frame = requestAnimationFrame(step)
    }

    setReprintHandler(run)

    return () => {
      setReprintHandler(null)
      if (frame !== 0) cancelAnimationFrame(frame)
      frame = 0
      canvas?.remove()
      canvas = null
      ctx = null
      pattern = null
    }
  }, [])

  return <div className="reprint" aria-hidden="true" ref={hostRef} />
}

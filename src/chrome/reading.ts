import { gsap } from 'gsap'
import { effectiveReduced } from '../lib/motion'

/* ============================================================================
   reading.ts — how an instrument prints a new value
   ----------------------------------------------------------------------------
   Two readings on the sheet change while the reader is on the page: the plate
   reference and the sheet's own progress. A number that simply swaps is a
   screen; a number that resolves is an instrument. So a change is printed over
   ~0.25s in 7 frames of random digits, settling on the true value.

   The rules that keep this from becoming a toy:

   - Only the instrument readings use it. Never prose, never a heading, never a
     price. The utility is imported by the chrome and by nothing else.
   - The format is preserved: `/` and `%` never move, only digits churn, so a
     scrambled value is the same width as the final one and the block never
     reflows.
   - **A moving reading does not scramble.** The sheet's progress changes on
     every frame of a scroll; scrambling each step would be permanent static.
     A value is scrambled only if the previous one had been stable for 260ms —
     a jump, a plate change, a settled reading — and is written straight
     otherwise.
   - Reduced motion — the system's query or the sheet's own override — gets
     the final value, immediately. It is read per change, not at mount, so the
     override takes effect on the next reading.
   ========================================================================== */

/** The resolve, in seconds, and the number of churn frames inside it (6–8). */
const SPAN = 0.25
const FRAMES = 7

/** A reading has to have been stable this long before it is allowed to churn. */
const QUIET_MS = 260

type Reading = {
  value: string
  changedAt: number
  tween: gsap.core.Tween | null
}

const readings = new WeakMap<HTMLElement, Reading>()

/**
 * Random digits in every digit position of the target, everything else intact.
 * The trade of hex for digits is deliberate: a 5-character readout cannot grow,
 * and `03/07` resolving out of `74/91` is quieter than out of `C4/9F`.
 */
function churn(target: string): string {
  let out = ''
  for (let i = 0; i < target.length; i += 1) {
    const code = target.charCodeAt(i)
    out += code >= 48 && code <= 57 ? String(Math.floor(Math.random() * 10)) : target.charAt(i)
  }
  return out
}

/**
 * Print `next` in `el`, churning into it when the reading had settled.
 *
 * Safe to call on every scroll frame: an unchanged string returns before any
 * work, and the caller's own quantisation (whole percent) keeps the allocation
 * count at one string per visible change.
 */
export function setReading(el: HTMLElement, next: string, scramble = true): void {
  const now = performance.now()
  const reading = readings.get(el)

  if (!reading) {
    readings.set(el, { value: next, changedAt: now, tween: null })
    el.textContent = next
    return
  }

  if (reading.value === next) return

  const settled = now - reading.changedAt > QUIET_MS
  reading.value = next
  reading.changedAt = now

  reading.tween?.kill()
  reading.tween = null

  if (!scramble || !settled || effectiveReduced()) {
    el.textContent = next
    return
  }

  const clock = { t: 0 }
  let frame = -1

  reading.tween = gsap.to(clock, {
    t: 1,
    duration: SPAN,
    ease: 'none',
    onUpdate: () => {
      const step = Math.round(clock.t * FRAMES)
      if (step === frame) return
      frame = step
      el.textContent = step >= FRAMES ? next : churn(next)
    },
    onComplete: () => {
      el.textContent = next
      reading.tween = null
    },
  })
}

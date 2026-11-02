/* ============================================================================
   curve.ts — the passage's one function
   ----------------------------------------------------------------------------
   The camera, the ink, the plate and the readout are four expressions of a
   single number: how far into the passage the reader is. They are written here
   once, so the DOM cannot say "ink 12" while the shader is still at 40.

   The hand-off is the only curve with a shape of its own. It starts at 0.86 and
   is complete at 0.955 — late enough that the passage is read on paper, short
   enough that the paper-to-ink crossfade never sits in a grey wash for long, and
   inside the sticky plate's last reach, so the following chapter arrives on a
   plate that is already ink, never on a white gap.
   ========================================================================== */

export function clamp01(value: number): number {
  return value < 0 ? 0 : value > 1 ? 1 : value
}

/** The sheet's smoothstep, the same one GSAP's `power2.inOut` reads as. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = clamp01((value - edge0) / (edge1 - edge0))
  return t * t * (3 - 2 * t)
}

/** Where the sheet stops being paper. */
export const HANDOFF_START = 0.86
export const HANDOFF_END = 0.955

/** 0 at the sheet, 1 on the plate. Fed to the shader and to the plate's opacity. */
export function handoff(progress: number): number {
  return smoothstep(HANDOFF_START, HANDOFF_END, progress)
}

/** The readout's unit: progress × 1200, in metres of nothing. */
export const DEPTH_MAX = 1200

export function depthAt(progress: number): number {
  return Math.round(clamp01(progress) * DEPTH_MAX)
}

/** How much of the field's ink survives: 100% at the sheet, none on the plate. */
export function inkAt(handoffValue: number): number {
  return Math.round((1 - handoffValue) * 100)
}

/**
 * Where the type reverses out.
 *
 * At this hand-off the plate is ~54% deep, which is the luminance at which
 * `--ink` and `--deep-ink` have the same contrast against the ground — 3.7:1,
 * and that is the *best* either can do there (it is the geometric maximum for
 * any pair at that background). A colour blend between the two would pass
 * through the ground's own tone and drop to about 1.1:1, so the reversal is a
 * step taken at the crossover, not a fade: the type is always at the strongest
 * contrast the plate allows. It is keyed to the same hand-off that drives the
 * plate's opacity, and it is deliberately instantaneous: a 140ms transition
 * would spend its middle frames crossing the ground's own tone, and a reader
 * who stopped there would be left with roughly 1.1:1 — measured on the page at
 * a 62.5%-deep plate. Two equal contrasts, swapped in one frame, is the only
 * honest way to reverse type out of a rising ground.
 */
export const INK_FLIP = 0.54

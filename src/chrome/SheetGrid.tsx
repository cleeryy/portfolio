import { useEffect, useRef } from 'react'
import './grid.css'

/* ============================================================================
   SheetGrid — the sheet's coordinate system, printed under the drawing
   ----------------------------------------------------------------------------
   Twelve columns across the same 72rem field every section lays its content
   into, ruled at the column boundaries with a single 1px line — never two lines
   per gutter. This is not decoration: it is the sheet's own geometry, the thing
   that makes a spread read as surveyed rather than as a stack of blocks.

   Four rules hold it in place:

   1. **It is the page's field, not a viewport grid.** The container's left edge
      and width are the same two expressions the sections use (`--gutter` and
      the 72rem field, declared once in base.css §12), so a rule is on the
      content edge at every width. It is fixed, so it does not scroll with the
      drawing; it is the plate the drawing sits on.
   2. **It never touches the reading.** On the light sheet the layer sits at z 0,
      under every section — and because the sections are transparent, the rules
      still print through the paper while type and plot marks pass over them. The
      ink chapter is the one opaque surface, so there the layer is lifted above
      it and `mix-blend-mode: lighten` is turned on with the band's own `--deep-2`
      as ink: the rule can then only lift the empty band, never touch its type.
      Both states cancel themselves — the wrong ink on the wrong surface renders
      nothing, never a wrong colour.
   3. **One state, decided once.** When the ink chapter owns the viewport the
      rules become the band's raised surface; when the chart band does, they take
      the heavier mix that keeps the printed step on that tint. One observer, one
      entry per band, and each entry writes only its own attribute: no scroll
      listener, no rect read per frame. A route with no chart band never attaches
      its observer, and the attribute stays absent — the light sheet's state, not
      a wrong one.
   4. **Nothing to animate.** No transition, no scroll coupling, no reduced-motion
      variant: a printed rule is a state of the plate. Reduced motion gets the
      identical grid.

   It is chrome: `aria-hidden`, `pointer-events: none`, no text, no focus.
   ========================================================================== */

/** Twelve columns have thirteen boundaries. Every boundary gets one rule. */
const RULES = 13
const STEP = 100 / (RULES - 1)

export default function SheetGrid() {
  const rootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = rootRef.current
    const band = document.querySelector<HTMLElement>('main > section.on-deep')
    /* The chart band is optional: only the home has one, and only once the
       chapter is mounted. No band, no observer — the rules keep the light
       sheet's mix, which is the correct state there, not a fallback. */
    const chart = document.querySelector<HTMLElement>('main > section[data-ground="chart"]')
    if (!root || (!band && !chart)) return

    /* The 5% margins shrink the viewport to its middle 90%: the observer fires
       when the band covers that strip, i.e. when at most a sliver of paper is
       still on screen. The chrome's `data-deep` answers a different question —
       "is the reading in my own 14% strip on ink?" — so this reuses the
       technique, not the signal, and stays correct if the chrome is ever
       unmounted (the grid would then be invisible over the band, never wrong).

       One observer, one entry per band, and each entry writes only its own
       attribute: a band leaving the strip turns its own state off, so the two
       can never be true on the same surface. */
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const on = entry.isIntersecting ? 'true' : 'false'
          if (entry.target === chart) root.dataset.chart = on
          else root.dataset.deep = on
        }
      },
      { rootMargin: '-5% 0px -5% 0px' },
    )
    if (band) observer.observe(band)
    if (chart) observer.observe(chart)

    return () => observer.disconnect()
  }, [])

  return (
    <div
      className="sheet-grid"
      ref={rootRef}
      aria-hidden="true"
      data-deep="false"
      data-chart="false"
    >
      {Array.from({ length: RULES }, (_, index) => (
        <span
          key={index}
          className="sheet-grid__rule"
          style={
            index === RULES - 1
              ? { insetInlineStart: 'auto', insetInlineEnd: 0 }
              : { insetInlineStart: `${index * STEP}%` }
          }
        />
      ))}
    </div>
  )
}

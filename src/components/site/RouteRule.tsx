import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { prefersReducedMotion } from '../../lib/reveal'
import { useRoute } from '../../lib/router'
import './route-rule.css'

/* ============================================================================
   RouteRule — the plate change, one hairline
   ----------------------------------------------------------------------------
   A route change is a new plate of the same sheet, not a journey: the page is
   already composed when the line runs. The rule draws across under the nav from
   the left (110ms), then erases to the right (110ms) — 220ms for the whole
   gesture, transform only, no layout and no second curtain.

   It is one span, fixed, pointer-transparent and `aria-hidden`: it cannot cover
   a control, take a click or enter the reading. On the first paint there is no
   wipe — a deep link lands on a printed plate. Under reduced motion the line is
   never run at all.

   `lastPath` is compared rather than a `mounted` flag: StrictMode remounts the
   effects once in development, and a flag would replay the wipe on the cover.
   ========================================================================== */

/** One sweep each way, so the pair lands inside the brief's 220ms window. */
const SWEEP = 0.11

export default function RouteRule() {
  const route = useRoute()
  const ruleRef = useRef<HTMLSpanElement | null>(null)
  const lastPath = useRef(route.path)

  useEffect(() => {
    if (lastPath.current === route.path) return
    lastPath.current = route.path

    const rule = ruleRef.current
    if (!rule || prefersReducedMotion()) return

    const tween = gsap
      .timeline()
      .set(rule, { transformOrigin: 'left center' })
      .fromTo(rule, { scaleX: 0 }, { scaleX: 1, duration: SWEEP, ease: 'none' })
      .set(rule, { transformOrigin: 'right center' })
      .to(rule, { scaleX: 0, duration: SWEEP, ease: 'none' })

    return () => {
      tween.kill()
      gsap.set(rule, { scaleX: 0 })
    }
  }, [route.path])

  return <span className="route-rule" aria-hidden="true" ref={ruleRef} />
}

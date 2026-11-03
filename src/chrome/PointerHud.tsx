import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { effectiveReduced } from '../lib/motion'
import './chrome.css'

/* ============================================================================
   PointerHud — the pill that names the place under the pointer
   ----------------------------------------------------------------------------
   On a fine pointer, hovering anything that carries `data-hud` prints that
   value in a small blurred plate that follows the cursor from above-left.

   The DOM contract is one attribute, on the element that is already the target:

       <a href="#territory" data-hud="#territory">…</a>

   Nothing else is required — no wrapper, no class, no registration. `RolloverLink`
   and `MagneticButton` fill it in from the destination (an in-page link prints
   its own `#id`, an address prints `mailto`), so the HUD can never drift from
   the `href` it describes. Any other element may carry it by hand.

   Rules:
   - The pill is `pointer-events: none` and `aria-hidden`: it cannot receive a
     click and it is not part of the reading order.
   - Movement is a transform written from a `gsap.quickSetter` on `pointermove`.
     The pill's own box is measured once per hover entry — never per move — only
     to decide which side of the pointer it can occupy without leaving the
     sheet.
   - It is hidden while scrolling (a link can slide out from under a still
     pointer) and on leaving the document.
   - Not mounted as a behaviour on a coarse pointer, and not under reduced
     motion.
   ========================================================================== */

/** Clearance from the pointer, in px, and the sheet's edge. */
const GAP_X = 12
const GAP_Y = 14
const EDGE = 8

export default function PointerHud() {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const pillRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const root = rootRef.current
    const pill = pillRef.current
    if (!root || !pill) return

    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    if (!fine.matches || effectiveReduced()) return

    const setX = gsap.quickSetter(root, 'x', 'px')
    const setY = gsap.quickSetter(root, 'y', 'px')

    let current: Element | null = null
    let x = EDGE
    let y = EDGE
    /**
     * A scroll hides the pill (a link can slide out from under a still
     * pointer), but the pointer has not moved and `pointerover` will not fire
     * again for the same element. So the first movement after a scroll does one
     * hit test — once, not per move — and re-arms the pill.
     */
    let armed = true

    const hide = () => {
      if (current === null) return
      current = null
      root.dataset.on = 'false'
    }

    const show = (target: Element) => {
      const label = target.getAttribute('data-hud') ?? ''
      if (!label) {
        hide()
        return
      }

      current = target
      pill.textContent = label

      // One layout read per hover entry. A label is short by contract, but the
      // side is chosen from the real box so a long one flips instead of
      // running off the sheet.
      const width = pill.offsetWidth
      const height = pill.offsetHeight
      const left = x - width - GAP_X >= EDGE
      const above = y - height - GAP_Y >= EDGE
      root.dataset.side = `${left ? 'l' : 'r'}${above ? 'a' : 'b'}`
      root.dataset.on = 'true'
      armed = true

      setX(x)
      setY(y)
    }

    const onPointerOver = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const host = target?.closest('[data-hud]') ?? null
      if (host === current) return
      if (!host) {
        hide()
        return
      }
      x = event.clientX
      y = event.clientY
      show(host)
    }

    const onPointerMove = (event: PointerEvent) => {
      x = event.clientX
      y = event.clientY

      if (current !== null) {
        setX(x)
        setY(y)
        return
      }

      if (armed) return
      armed = true
      const under = document.elementFromPoint(x, y)
      const host = under?.closest('[data-hud]') ?? null
      if (host) show(host)
    }

    const onLeave = () => hide()
    const onScroll = () => {
      armed = false
      hide()
    }
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') hide()
    }

    window.addEventListener('pointerover', onPointerOver, { passive: true })
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.removeEventListener('pointerover', onPointerOver)
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      root.dataset.on = 'false'
    }
  }, [])

  return (
    <div className="hud" aria-hidden="true" ref={rootRef} data-on="false" data-side="la">
      <span className="hud__pill" ref={pillRef} />
    </div>
  )
}

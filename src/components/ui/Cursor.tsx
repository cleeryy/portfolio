import { useEffect, useRef } from 'react'
import './ui.css'

/**
 * The pointer, redrawn as a survey reticle.
 *
 * - 1px crosshair with a 3px centre, blended with `difference` so it reads on the
 *   pale sheet and on the ink chapter break without a second colour.
 * - Desktop only: never mounted as a behaviour on touch, and never under reduced
 *   motion (the native pointer stays, which is the accessible choice).
 * - The reticle lags the pointer; the centre dot does not. That fixed centre is
 *   what keeps the pointer usable while the crosshair settles.
 */
export default function Cursor() {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const frameRef = useRef<HTMLDivElement | null>(null)
  const dotRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const root = rootRef.current
    const frame = frameRef.current
    const dot = dotRef.current
    if (!root || !frame || !dot) return

    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!fine.matches || reduced.matches) return

    const doc = document.documentElement
    let x = 0
    let y = 0
    let cx = 0
    let cy = 0
    let scale = 1
    let scaleTarget = 1
    let raf = 0
    let running = false

    const render = () => {
      cx += (x - cx) * 0.26
      cy += (y - cy) * 0.26
      scale += (scaleTarget - scale) * 0.22
      // One transform, both components. The individual `scale` property composes
      // *after* `transform`, which would scale the translation too and send the
      // reticle to (x * s, y * s).
      frame.style.transform = `translate3d(${cx.toFixed(2)}px, ${cy.toFixed(2)}px, 0) scale(${scale.toFixed(3)})`
      dot.style.transform = `translate3d(${x}px, ${y}px, 0)`
      raf = requestAnimationFrame(render)
    }

    const start = () => {
      if (running) return
      running = true
      raf = requestAnimationFrame(render)
    }

    const stop = () => {
      running = false
      cancelAnimationFrame(raf)
    }

    const onMove = (event: PointerEvent) => {
      x = event.clientX
      y = event.clientY
      if (!root.dataset.on) {
        // Only hide the native pointer once the custom one has a real position,
        // so there is never a frame with no cursor at all.
        root.dataset.on = 'true'
        doc.classList.add('has-reticle')
        start()
      }
    }

    const onOver = (event: PointerEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const hot = target?.closest('a, button, [data-cursor]') ? true : false
      root.dataset.hot = hot ? 'true' : 'false'
      scaleTarget = hot ? 1.45 : 1
    }

    const onLeaveWindow = () => {
      root.dataset.on = ''
      root.dataset.hot = 'false'
      scaleTarget = 1
      doc.classList.remove('has-reticle')
      stop()
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop()
      else if (root.dataset.on) start()
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerover', onOver, { passive: true })
    document.addEventListener('pointerleave', onLeaveWindow)
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      stop()
      doc.classList.remove('has-reticle')
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerleave', onLeaveWindow)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  return (
    <div className="reticle" ref={rootRef} aria-hidden="true">
      <div className="reticle__frame" ref={frameRef} />
      <div className="reticle__dot" ref={dotRef} />
    </div>
  )
}

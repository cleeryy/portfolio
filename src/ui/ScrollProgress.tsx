import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './ui.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * The sheet's scroll scale.
 *
 * A measuring device, not navigation: a hairline at the right edge of the
 * sheet, ticks every eighth, and one crimson index riding it. It deliberately
 * carries no section names and no percentage — the nav already says where you
 * are, and a second reading of the same thing would be a duplicate, not an
 * instrument. It sits in the page gutter, in the margin where a printed sheet
 * keeps its scale.
 *
 * The index is written straight from the scroll position (no tween, no
 * smoothing): it is a gauge, so it stays exact under `prefers-reduced-motion`
 * as well.
 */
export default function ScrollProgress() {
  const markRef = useRef<HTMLSpanElement | null>(null)

  useLayoutEffect(() => {
    const mark = markRef.current
    const track = mark?.parentElement
    if (!mark || !track) return

    const setY = gsap.quickSetter(mark, 'y', 'px')
    let span = 0

    const measure = () => {
      span = Math.max(0, track.clientHeight - mark.offsetHeight)
    }
    const paint = (progress: number) => setY(progress * span)

    const trigger = ScrollTrigger.create({
      start: 0,
      end: 'max',
      invalidateOnRefresh: true,
      onRefresh: (self) => {
        measure()
        paint(self.progress)
      },
      onUpdate: (self) => paint(self.progress),
    })

    measure()
    paint(trigger.progress)

    return () => trigger.kill()
  }, [])

  return (
    <div className="gauge" aria-hidden="true">
      <span className="gauge__track" />
      <span className="gauge__mark" ref={markRef} />
    </div>
  )
}

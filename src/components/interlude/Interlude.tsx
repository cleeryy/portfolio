import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLang } from '../../lib/i18n'
import { MOTION, initSectionRig, prefersReducedMotion, revealWords } from '../../lib/reveal'
import { contact } from '../../content/contact'
import SplitText from '../ui/SplitText'
import './interlude.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * The request, printed as a plate between `#about` and `#contact`.
 *
 * A chapter plate, not a call to action: the sheet's real ask set once, at
 * plate scale, between the operator and the closing page — with the plate's own
 * references in the margin (`VIII`, `#request`, its coordinate), one hairline
 * measure at the foot, and nothing to click. There is no button (the address is
 * one screen below, and it is a letter, not a control), no centred card, no
 * gradient: type on ink, hung under the fixed bar, with the pale sheet still
 * visible below it. It reads as a plate tipped into the book.
 *
 * Motion, and why each piece is where it is:
 *
 * - **The entry is the sheet's shared move**, not a special one: the rig draws
 *   the rule, the reference fades 60 ms later, the words rise from their masks
 *   120 ms after that, and the width axis settles once the last word lands
 *   (`revealWords`). It starts at `MOTION.plate.enter` rather than the section
 *   default because a plate's heading sits deep inside it — at `top 85%` the
 *   sentence would still be under the fold and the gesture would play unseen.
 * - **The pin is sticky, not a GSAP pin.** No pin spacer means the page's
 *   offsets (and `#contact`'s 64px anchor landing) are exactly what the layout
 *   says, and the plate's hold is the track's own height. Reduced motion simply
 *   takes the stickiness away and the plate becomes a static band.
 * - **The measure draws with the scroll**, from the pin's own progress, and the
 *   **hand-over is one clip step**: the plate is clipped away from its bottom
 *   edge over the last of the hold, so the pale sheet (and the closing section's
 *   rule, already drawn at the foot of the frame) is what is underneath. No
 *   fade to black, no second curtain, and scrolling back up un-clips it.
 * - **The fixed instrument** in the sheet's margin flips to the plate's inks
 *   while the plate holds the middle of the viewport; it only knows about
 *   `.on-deep` and the passage, and this plate is neither, so it is told here.
 *
 * Copy: the sentence is `contact.title`, read from the content module. This
 * file adds no prose — the margin annotations are references and a coordinate.
 */
export default function Interlude() {
  const { pick } = useLang()
  const copy = pick(contact)
  const rootRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const rig = initSectionRig(root, { enter: MOTION.plate.enter })

    // The heading's mask is the plate's entry move, on the *section's* start
    // line: revealWords watches the section so the 120 ms offset is measured
    // from the same scroll position the rule starts on.
    const heading = root.querySelector<HTMLElement>('.itl__title')
    const words = heading
      ? Array.from(heading.querySelectorAll<HTMLElement>('[data-split-unit]'))
      : []
    const reveal = heading
      ? revealWords(heading, words, { trigger: root, start: MOTION.plate.enter })
      : () => {}

    const plate = root.querySelector<HTMLElement>('[data-itl-plate]')
    const track = root.querySelector<HTMLElement>('[data-itl-track]')
    const stage = root.querySelector<HTMLElement>('[data-itl-stage]')
    const fill = root.querySelector<HTMLElement>('[data-itl-fill]')
    const chrome = document.querySelector<HTMLElement>('.chrome')

    const cleanups: (() => void)[] = [reveal, rig.dispose]

    // The instrument reads on ink while the plate holds the middle of the
    // frame. A thin band (the middle 2%) rather than the chrome's own 16%: the
    // readings are one line at 50%, and a plate that merely enters the lower
    // half must not invert them.
    if (plate && chrome) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) chrome.dataset.plate = 'true'
            else delete chrome.dataset.plate
          }
        },
        { rootMargin: '-49% 0px -49% 0px' },
      )
      observer.observe(plate)
      cleanups.push(() => {
        observer.disconnect()
        delete chrome.dataset.plate
      })
    }

    if (prefersReducedMotion()) {
      return () => {
        for (const cleanup of cleanups) cleanup()
      }
    }

    // The hold: one ScrollTrigger over exactly the pinned travel — from the
    // track reaching the bar to the track's foot meeting the plate's foot.
    if (plate && track && stage && fill) {
      const [m0, m1] = MOTION.plate.measure
      const [h0, h1] = MOTION.plate.handover
      const drawn = { measure: -1, hand: -1 }

      const write = (progress: number) => {
        const measure = Math.min(1, Math.max(0, (progress - m0) / (m1 - m0)))
        const m = Math.round(measure * 400) / 400
        if (m !== drawn.measure) {
          drawn.measure = m
          fill.style.transform = `scaleX(${m})`
        }

        const hand = Math.min(1, Math.max(0, (progress - h0) / (h1 - h0)))
        const h = Math.round(hand * 500) / 500
        if (h !== drawn.hand) {
          drawn.hand = h
          plate.style.clipPath = `inset(0% 0% ${(h * 100).toFixed(2)}% 0%)`
        }
      }

      const hold = ScrollTrigger.create({
        trigger: track,
        start: 'top top',
        // The pin releases when the track's foot reaches the plate's foot — the
        // sticky offset included, or the last few percent of the scrub would run
        // after the plate had already begun to scroll away.
        end: () => `bottom ${Math.round(stage.offsetHeight + (Number.parseFloat(getComputedStyle(stage).top) || 0))}px`,
        onRefresh: (self) => write(self.progress),
        onUpdate: (self) => write(self.progress),
      })

      // A reload inside the plate, or a deep link past it, prints the state the
      // geometry asks for instead of waiting for a scroll that already happened.
      write(hold.progress)
      cleanups.push(() => hold.kill())
    }

    return () => {
      for (const cleanup of cleanups) cleanup()
    }
  }, [])

  return (
    <section className="itl" id="request" aria-labelledby="request-title" ref={rootRef}>
      <div className="itl__track" data-itl-track="">
        <div className="itl__stage" data-itl-stage="">
          <div className="itl__plate" data-itl-plate="">
            <span className="rig-tick" data-rig-tick="" aria-hidden="true" />

            <div className="itl__inner">
              {/* The plate's running head: what this plate is, at the left edge,
                  and what it is in the sheet's own language (`#ref` + the
                  coordinate), at the right. Decoration for assistive tech — the
                  heading below is the section's whole content. */}
              <div className="itl__refs">
                <p className="itl__plate-ref mono" aria-hidden="true">
                  VIII
                </p>
                <p className="itl__ref mono" aria-hidden="true">
                  <span>#request</span>
                  <span className="rig-coord" data-rig-coord="" />
                </p>
              </div>

              {/* Split for the mask, revealed by this file (not by SplitText's
                  own rig): the plate's start line is its own. */}
              <SplitText
                as="h2"
                className="itl__title"
                id="request-title"
                text={copy.title}
              />

              {/* The measure: four ticks and the destination. It is drawn by
                  the scroll, and it is printed in full if the script never runs
                  (the drawn line's stylesheet position is its finished one). */}
              <div className="itl__measure" aria-hidden="true">
                <span className="itl__bar">
                  <span className="itl__fill" data-itl-fill="" />
                </span>
                <span className="itl__dest mono">#contact</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

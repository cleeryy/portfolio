import { useEffect, useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLang } from '../../lib/i18n'
import { initSectionRig } from '../../lib/reveal'
import { sound } from '../../lib/sound'
import { evidence, platforms, rangesCopy } from '../../content/ranges'
import SplitText from '../ui/SplitText'
import './ranges.css'

gsap.registerPlugin(ScrollTrigger)

/** The record first, then the practice. Order is the register's reading order. */
const grounds = [...evidence, ...platforms]

/**
 * Which register the reader gets.
 *
 * The traverse is a wide-screen, mouse-driven gesture only: a pin on a phone
 * fights the sheet, and a horizontal drag on a touch screen is somebody else's
 * scroll. Under 901px, or with a coarse pointer, the register stays the vertical
 * ledger it has always been.
 */
const MOTION_CONDITIONS = {
  traverse: '(min-width: 901px) and (hover: hover) and (pointer: fine)',
  reduced: '(prefers-reduced-motion: reduce)',
  /* Always true, so the callback runs on every combination and can branch. */
  any: 'all',
}

/**
 * The pinned traverse.
 *
 * The content plate is pinned for exactly the distance the strip has to travel,
 * so the page cannot scroll past panels that have not been shown, and cannot sit
 * still after the last one has. The head stays put — it is the chapter title —
 * while the six rows cross the sheet from right to left on one continuous rule.
 *
 * Bounds: at progress 0 the first panel is flush with the content column; at
 * progress 1 the last panel's right edge is flush with it. `scrub` is short
 * (0.6s) so the traverse still tracks the wheel, and every measured value is a
 * function, re-read on refresh — a resize cannot leave the strip short.
 */
function buildTraverse(root: HTMLElement, pin: HTMLElement): () => void {
  const strip = root.querySelector<HTMLElement>('.rng__strip')
  const list = root.querySelector<HTMLElement>('.rng__list')
  const scale = root.querySelector<HTMLElement>('.rng__scale')
  const index = root.querySelector<HTMLElement>('.rng__index')

  // The layout mode is owned by CSS; this attribute is the only switch.
  root.dataset.mode = 'h'

  const travel = () => {
    if (!strip || !list) return 0
    return Math.max(0, Math.round(list.scrollWidth - strip.clientWidth))
  }
  const indexTravel = () => {
    if (!scale || !index) return 0
    return Math.max(0, Math.round(scale.clientWidth - index.offsetWidth))
  }

  // Panels arrive once, as one wave, before the traverse starts. Only panels
  // the reader has not reached are given an initial state.
  const rows = gsap.utils.toArray<HTMLElement>('.rng__row', root)
  if (root.getBoundingClientRect().top > window.innerHeight * 0.75) {
    gsap.set(rows, { opacity: 0, y: 18 })
    gsap.to(rows, {
      opacity: 1,
      y: 0,
      duration: 0.7,
      ease: 'power2.out',
      stagger: 0.07,
      scrollTrigger: { trigger: root, start: 'top 75%', once: true },
    })
  }

  if (travel() < 80) {
    // Every panel already fits: the register is complete without a pin.
    return () => {
      delete root.dataset.mode
    }
  }

  const timeline = gsap.timeline({
    defaults: { ease: 'none' },
    scrollTrigger: {
      // The *inner* plate is pinned, never `#ranges` itself: ScrollTrigger
      // translates a pinned element to the end of its spacer once the pin is
      // released, which moves that element's `getBoundingClientRect()` — and
      // would send an anchor to `#ranges` from below to the end of the pin
      // instead of to the head of the chapter. Pinning the plate keeps the
      // section, which is what the nav scrolls to, exactly where it is.
      trigger: pin,
      start: 'top top',
      end: () => `+=${travel() + 180}`,
      pin: true,
      scrub: 0.6,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    },
  })

  timeline.fromTo(list, { x: 0 }, { x: () => -travel(), duration: 1 }, 0)
  if (index) timeline.fromTo(index, { x: 0 }, { x: () => indexTravel(), duration: 1 }, 0)

  return () => {
    delete root.dataset.mode
  }
}

/** The vertical register: one rule per row, drawn as the row arrives. */
function buildRegister(root: HTMLElement): void {
  for (const row of gsap.utils.toArray<HTMLElement>('.rng__row', root)) {
    if (row.getBoundingClientRect().top <= window.innerHeight * 0.88) continue

    const rule = row.querySelector<HTMLElement>('.rng__rule')
    const cells = row.querySelectorAll<HTMLElement>('.rng__cell')

    if (rule) gsap.set(rule, { scaleX: 0 })
    gsap.set(cells, { opacity: 0, y: 10 })

    const timeline = gsap.timeline({
      scrollTrigger: { trigger: row, start: 'top 88%', once: true },
    })

    if (rule) timeline.to(rule, { scaleX: 1, duration: 0.62, ease: 'power2.inOut' })
    timeline.to(
      cells,
      { opacity: 1, y: 0, duration: 0.44, stagger: 0.06, ease: 'power2.out' },
      0.13,
    )
  }
}

/**
 * The ranges — the only dark band on the site.
 *
 * A register, not cards: one rule per row, the ground on the left, what it was
 * or what he does there on the right. No score, no rank. A row carries a link
 * only where a public page documents it, and the platform rows carry neither a
 * handle nor a number because neither is documented.
 *
 * On a wide screen with a mouse the register becomes a transect: the chapter
 * pins and the six rows travel across the sheet, because a register of places
 * read along one horizontal line is the one moment on the page where the map is
 * not read top to bottom.
 */
export default function Ranges() {
  const { pick } = useLang()
  const copy = pick(rangesCopy)
  const rootRef = useRef<HTMLElement | null>(null)
  const pinRef = useRef<HTMLDivElement | null>(null)
  const pingedRef = useRef(false)

  useLayoutEffect(() => {
    const root = rootRef.current
    const pin = pinRef.current
    if (!root || !pin) return

    const rig = initSectionRig(root)
    const matchMedia = gsap.matchMedia(root)

    matchMedia.add(MOTION_CONDITIONS, (context) => {
      const conditions = context.conditions
      if (!conditions || conditions.reduced) return
      return conditions.traverse ? buildTraverse(root, pin) : buildRegister(root)
    })

    // The pin has just been created: re-read every trigger once it exists. The
    // webfonts land after this and `initMotionSystem` refreshes again, so the
    // traverse is measured against the type the reader actually sees.
    ScrollTrigger.refresh()

    return () => {
      matchMedia.revert()
      rig.dispose()
    }
  }, [])

  // One sonar reading on the first arrival. `sound` is a no-op while the toggle
  // is off, so this can never surprise a muted reader.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting || pingedRef.current) continue
          pingedRef.current = true
          sound.ping()
          observer.disconnect()
        }
      },
      { threshold: 0.25 },
    )

    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  return (
    <section className="rng on-deep" id="ranges" aria-labelledby="ranges-title" ref={rootRef}>
      <span className="rng__mark" data-rig-tick aria-hidden="true" />

      {/* The pinned plate. In the vertical register it is `display: contents`
          and costs nothing; in the traverse it is the full-height surface the
          strip travels across. It is deliberately *not* the element `#ranges`
          names, so the anchor never points at a translated box. */}
      <div className="rng__pin" ref={pinRef}>
        <div className="rng__inner">
          <header className="rng__head">
            <p className="rng__ref mono" aria-hidden="true">
              <span>#ranges</span>
              <span className="rig-coord" data-rig-coord="" />
            </p>

            <SplitText
              as="h2"
              className="rng__title"
              id="ranges-title"
              text={copy.title}
              reveal
            />

            <div className="rng__intro">
              {copy.intro.map((paragraph) => (
                <p key={paragraph} data-reveal-block="">
                  {paragraph}
                </p>
              ))}
            </div>
          </header>

          <div className="rng__register">
            <div className="rng__cols" aria-hidden="true">
              <span>{copy.columnKeys.ground}</span>
              <span>{copy.columnKeys.practice}</span>
            </div>

            <div className="rng__strip">
              <ol className="rng__list" role="list">
                {grounds.map((ground) => (
                  <li className="rng__row" key={ground.id}>
                    <span className="rng__rule" aria-hidden="true" />

                    <div className="rng__cell rng__cell--ground">
                      <h3 className="rng__name">
                        {ground.href ? (
                          <a
                            className="rng__link"
                            href={ground.href}
                            rel="noopener noreferrer"
                          >
                            {pick(ground.name)}
                          </a>
                        ) : (
                          pick(ground.name)
                        )}
                      </h3>
                      {/* One measured line under the name: a date, a format.
                          Never a result — the register has no scoreboard. */}
                      {ground.meta ? <p className="rng__meta mono">{pick(ground.meta)}</p> : null}
                    </div>

                    <div className="rng__cell rng__cell--practice">
                      <p>{pick(ground.focus)}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* The traverse's own scale: one tick per register row, one index.
                It exists only while the register is horizontal. */}
            <div className="rng__scale" aria-hidden="true">
              {grounds.map((ground) => (
                <span className="rng__tick" key={ground.id} />
              ))}
              <span className="rng__index" />
            </div>

            <p className="rng__note mono">{copy.registerNote}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

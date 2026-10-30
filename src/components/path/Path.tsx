import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLang } from '../../lib/i18n'
import { initSectionRig } from '../../lib/reveal'
import { getLenis } from '../../lib/scroll'
import { sound } from '../../lib/sound'
import { pathCopy, pathEntries } from '../../content/path'
import SplitText from '../ui/SplitText'
import './path.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * Which register the reader gets.
 *
 * The traverse is a wide-screen, mouse-driven gesture only: a pin on a phone
 * fights the sheet, a horizontal drag on a touch screen belongs to somebody
 * else's scroll. Under 901px, on a coarse pointer, or under reduced motion, the
 * parcours stays the vertical register it is printed as in the markup.
 */
const MOTION_CONDITIONS = {
  traverse: '(min-width: 901px) and (hover: hover) and (pointer: fine)',
  phone: '(max-width: 900px)',
  reduced: '(prefers-reduced-motion: reduce)',
  /* Always true, so the callback runs on every combination and can branch. */
  any: 'all',
}

/**
 * The pinned traverse.
 *
 * Same mechanics as `#ranges`, deliberately not reinvented: the *inner* plate is
 * pinned — never `#path` itself, because ScrollTrigger translates a pinned
 * element to the end of its spacer once the pin is released, which moves that
 * element's `getBoundingClientRect()` and would send an anchor to `#path` from
 * below to the end of the pin instead of to the head of the chapter.
 *
 * The strip is clipped, never overflowed: no horizontal scrollbar can appear,
 * and the mask at both ends dissolves a panel crossing the edge instead of
 * slicing through a glyph.
 *
 * Two movements, both directly scrubbed, nothing decorative:
 * - the strip travels exactly the width it overflows, so no panel can be
 *   scrolled past unseen and the last one is flush when the pin releases;
 * - the spine's inked layer draws with the same progress, from the left edge, so
 *   the line is inked as the panels pass it. The light rule underneath is always
 *   printed — the line never disappears under an un-inked stretch.
 */
function buildTraverse(root: HTMLElement, pin: HTMLElement): () => void {
  const strip = root.querySelector<HTMLElement>('.pth__strip')
  const list = root.querySelector<HTMLElement>('.pth__list')
  const ink = root.querySelector<HTMLElement>('.pth__ink')

  // The layout mode is owned by CSS; this attribute is the only switch.
  root.dataset.mode = 'h'

  const travel = () => {
    if (!strip || !list) return 0
    return Math.max(0, Math.round(list.scrollWidth - strip.clientWidth))
  }

  // Entries arrive once, as one wave, as the chapter is reached — ink is
  // printed, it does not fade in panel by panel under the reader's eye. Only
  // content the reader has not reached is given an initial state.
  const entries = gsap.utils.toArray<HTMLElement>('.pth__entry', root)
  if (entries.length > 0 && root.getBoundingClientRect().top > window.innerHeight * 0.75) {
    gsap.set(entries, { opacity: 0, y: 18 })
    gsap.to(entries, {
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
  if (ink) timeline.fromTo(ink, { scaleX: 0 }, { scaleX: 1, duration: 1 }, 0)

  /* Keyboard focus inside the window.
     The strip is a clipped window on a translated list: a link in a panel the
     reader has not reached yet is in the document but outside the window, and a
     browser cannot scroll a clipped box. Focus would land on nothing anybody can
     see. So focus moves the traverse by exactly the distance needed to bring the
     panel onto the line — never on hover, never on its own, and never when the
     panel is already inside the window. */
  const onFocusIn = (event: FocusEvent) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || !strip) return

    const entry = target.closest<HTMLElement>('.pth__entry')
    const trigger = timeline.scrollTrigger
    if (!entry || !trigger) return

    const width = entry.offsetWidth
    const left = entry.offsetLeft - trigger.progress * travel()
    if (!width || (left >= 0 && left + width <= strip.clientWidth)) return

    const next = Math.min(1, Math.max(0, entry.offsetLeft / Math.max(1, travel())))
    const y = trigger.start + (trigger.end - trigger.start) * next
    const lenis = getLenis()
    if (lenis) lenis.scrollTo(y, { duration: 0.6 })
    else window.scrollTo({ top: y })
  }

  root.addEventListener('focusin', onFocusIn)

  return () => {
    root.removeEventListener('focusin', onFocusIn)
    delete root.dataset.mode
  }
}

/**
 * The vertical register: one station per entry, drawn as the entry arrives.
 *
 * On the phone it also gets the section's one authored moment: the spine is
 * inked from the top as the register is scrolled (`scaleY` on a scrub, over the
 * printed rule that is always there), and each year tick lights as its entry
 * crosses 60% of the viewport. No pin, no horizontal motion — the drawing
 * follows the reader's thumb.
 */
function buildRegister(root: HTMLElement, phone: boolean): void {
  const list = root.querySelector<HTMLElement>('.pth__list')
  const ink = phone ? root.querySelector<HTMLElement>('.pth__ink') : null

  if (ink && list) {
    gsap.fromTo(
      ink,
      { scaleY: 0 },
      {
        scaleY: 1,
        ease: 'none',
        scrollTrigger: {
          trigger: list,
          start: 'top 78%',
          end: 'bottom 62%',
          scrub: 0.4,
        },
      },
    )
  }

  for (const entry of gsap.utils.toArray<HTMLElement>('.pth__entry', root)) {
    const station = entry.querySelector<HTMLElement>('.pth__station')
    const cells = entry.querySelectorAll<HTMLElement>('.pth__cell')

    if (entry.getBoundingClientRect().top <= window.innerHeight * 0.88) continue

    // The station is the lit tick on the phone, so the entry's arrival is
    // carried by the cells alone there; on the wide register it fades in with
    // them as it always has.
    if (station && !phone) gsap.set(station, { opacity: 0 })
    gsap.set(cells, { opacity: 0, y: 10 })

    const timeline = gsap.timeline({
      scrollTrigger: { trigger: entry, start: 'top 88%', once: true },
    })

    if (station && !phone) timeline.to(station, { opacity: 1, duration: 0.4, ease: 'power2.out' })
    timeline.to(
      cells,
      { opacity: 1, y: 0, duration: 0.44, stagger: 0.06, ease: 'power2.out' },
      0.08,
    )
  }

  if (!phone) return

  /* One trigger per entry, two directions: the tick lights as its year reaches
     the reading line and dims again if the reader goes back above it, so the
     register can be re-drawn as often as it is read. A station already on the
     sheet at mount is never dimmed — the page does not hide what it has
     printed. */
  for (const entry of gsap.utils.toArray<HTMLElement>('.pth__entry', root)) {
    const station = entry.querySelector<HTMLElement>('.pth__station')
    if (!station || station.classList.contains('pth__station--now')) continue

    if (entry.getBoundingClientRect().top > window.innerHeight * 0.6) {
      gsap.set(station, { opacity: 0.4 })
    }

    ScrollTrigger.create({
      trigger: entry,
      start: 'top 60%',
      onEnter: () => {
        gsap.to(station, { opacity: 1, duration: 0.28, ease: 'power2.out', overwrite: true })
      },
      onLeaveBack: () => {
        gsap.set(station, { opacity: 0.4 })
      },
    })
  }
}

/**
 * The parcours, as a traverse.
 *
 * A register, not cards: one ruled spine, a station per step, the date printed
 * above the line in mono, the step below it. Seven entries, oldest first, and
 * the seventh is where the reader is standing — the only crimson in the section.
 *
 * On a wide screen with a mouse the register is read along the line: the chapter
 * pins and the panels cross the sheet. Below that it is the vertical register,
 * year in the margin, which is how a CV is read on a telephone.
 */
export default function Path() {
  const { pick } = useLang()
  const copy = pick(pathCopy)
  const rootRef = useRef<HTMLElement | null>(null)
  const pinRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    const pin = pinRef.current
    if (!root || !pin) return

    const rig = initSectionRig(root)
    const matchMedia = gsap.matchMedia(root)

    matchMedia.add(MOTION_CONDITIONS, (context) => {
      const conditions = context.conditions
      if (!conditions || conditions.reduced) return
      if (conditions.traverse) return buildTraverse(root, pin)
      return buildRegister(root, Boolean(conditions.phone))
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

  return (
    <section className="pth" id="path" aria-labelledby="path-title" ref={rootRef}>
      <span className="rig-tick" data-rig-tick aria-hidden="true" />

      {/* The pinned plate. In the vertical register it is `display: contents`
          and costs nothing; in the traverse it is the full-height surface the
          strip travels across. It is deliberately *not* the element `#path`
          names, so the anchor never points at a translated box. */}
      <div className="pth__pin" ref={pinRef}>
        <div className="pth__inner">
          <header className="pth__head">
            <p className="pth__ref mono" aria-hidden="true">
              <span>#path</span>
              <span className="rig-coord" data-rig-coord="" />
            </p>

            <SplitText
              as="h2"
              className="pth__title"
              id="path-title"
              text={copy.title}
              reveal
            />

            <div className="pth__intro">
              <p data-reveal-block="">{copy.intro}</p>
              <p className="pth__ask" data-reveal-block="">
                {copy.ask}
              </p>
            </div>
          </header>

          <div className="pth__register">
            <div className="pth__strip">
              {/* The axis. In the vertical register the same line is drawn by
                  the list's own rule; these two are the traverse's. */}
              <span className="pth__spine" aria-hidden="true" />
              <span className="pth__ink" aria-hidden="true" />

              <ol className="pth__list" role="list">
                {pathEntries.map((entry) => (
                  <li
                    className={entry.current ? 'pth__entry pth__entry--now' : 'pth__entry'}
                    key={entry.id}
                  >
                    <span
                      className={
                        entry.current ? 'pth__station pth__station--now' : 'pth__station'
                      }
                      aria-hidden="true"
                    />

                    <div className="pth__when pth__cell">
                      <time className="pth__date mono" dateTime={entry.datetime}>
                        {entry.period}
                      </time>
                      {entry.current ? (
                        <span className="pth__now mono">{copy.nowLabel}</span>
                      ) : null}
                    </div>

                    <div className="pth__body pth__cell">
                      {/* One wrapper for the two identifying lines: in the wide
                          vertical register the body splits into two columns, and
                          the title block has to stay a block. */}
                      <div className="pth__ident">
                        <h3 className="pth__name">{pick(entry.title)}</h3>
                        <p className="pth__org">{pick(entry.organisation)}</p>
                      </div>
                      <p className="pth__what">{pick(entry.what)}</p>

                      {entry.link ? (
                        <a
                          className="pth__link"
                          href={entry.link.href}
                          rel="noopener noreferrer"
                          onClick={() => sound.click()}
                        >
                          {entry.link.display}
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            <p className="pth__note mono">{copy.note}</p>
          </div>
        </div>
      </div>
    </section>
  )
}

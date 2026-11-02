import { useLayoutEffect, useRef, useSyncExternalStore } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { fileCopy, featured, projects, workCopy } from '../../content/work'
import { useLang } from '../../lib/i18n'
import { initSectionRig } from '../../lib/reveal'
import { Link } from '../../lib/router'
import { RolloverLabel } from '../ui/Rollover'
import SplitText from '../ui/SplitText'
import Plate from './Plate'
import './work-traverse.css'

gsap.registerPlugin(ScrollTrigger)

/* ============================================================================
   WorkTraverse — selected work, one line or one column
   ----------------------------------------------------------------------------
   Six plates: the five `featured` projects in register order, then a closing
   plate that says how many there are and hands over to `/work`. The section is
   the same at every width; only the composition changes.

   **The pin is on `.wt__pin`, never on `#work`.** ScrollTrigger translates a
   pinned element to the end of the spacer it inserts when the pin is released,
   which moves that element's own bounding box. `#work` is what the cover's
   primary CTA and every `/#work` link scroll to, so it has to keep the position
   the document gives it; the plate inside it is free to be pinned. The header
   also stays outside the pin, so the chapter is titled before the traverse
   starts and the title scrolls away naturally rather than hanging over a
   pinned strip for a screen and a half.

   **The window is 86vw and a plate is 62vw**, which leaves exactly a 24vw peek
   of the next plate — enough to say the line continues, not enough to read the
   next claim out of the corner of the eye. The 24px mask fade at each edge
   matches the plate's own padding, so at rest no glyph is ever inside the fade.

   **One timeline, one trigger, no second RAF.** The strip's translate and the
   progress rule are two tweens on the same timeline at position 0, both with
   `ease: 'none'`, so the bar cannot disagree with the strip at any progress.
   The counter is written from the trigger's `onUpdate` and only when its value
   changes: no tween, no ticker, no interval. Lenis remains the only scroll
   owner and the pin only translates — no wheel or touch event is ever
   intercepted.

   **The counter is instrument vocabulary.** `plate` is the word the fixed
   chrome already prints (`InstrumentChrome`'s `plate` key). It stays lowercase
   and untranslated here so the traverse's reading and the chrome's reading are
   the same instrument speaking, not a second label invented for this chapter.

   **Reduced motion is a layout switch, not a faster animation.** The media
   query that decides `data-mode` includes `prefers-reduced-motion:
   no-preference`, so under reduce the traverse is never built: no pin, no
   spacer, no translate, no counter. The plates are a vertical list at every
   width — the same six records, read top to bottom — and the stylesheet keeps a
   belt for a preference that flips while the page is live.
   ========================================================================== */

/** The closing plate is not a project, so the traverse is one longer than `featured`. */
const PLATES = featured.length + 1

/** Two digits: a plate reference is a coordinate, not a count. */
const pad2 = (value: number) => String(value).padStart(2, '0')

const plateLabel = (index: number) => `plate ${pad2(index)}/${pad2(PLATES)}`

/**
 * The traverse is a wide-sheet, fine-pointer gesture that also requires the
 * reader to have accepted motion. All four conditions in one query: the pin,
 * the counter and the horizontal layout can then never disagree about whether
 * the traverse exists.
 */
const WIDE_QUERY =
  '(min-width: 901px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'

let wideQuery: MediaQueryList | null = null

function subscribeWide(onChange: () => void): () => void {
  wideQuery ??= window.matchMedia(WIDE_QUERY)
  wideQuery.addEventListener('change', onChange)
  return () => wideQuery?.removeEventListener('change', onChange)
}

function getWide(): boolean {
  wideQuery ??= window.matchMedia(WIDE_QUERY)
  return wideQuery.matches
}

/**
 * `useSyncExternalStore` rather than an effect: the first render has to know
 * the mode, or the section would paint the column and then flip it to a
 * traverse. The server snapshot is the narrow, safe answer.
 */
function useWide(): boolean {
  return useSyncExternalStore(subscribeWide, getWide, () => false)
}

type Mode = 'h' | 'v'

export default function WorkTraverse() {
  const { pick } = useLang()
  const copy = pick(workCopy)
  const backLabel = pick(fileCopy).backLabel
  const wide = useWide()

  /* The attribute follows the query directly, so a media flip paints the new
     composition in the same commit the effect measures it in. The one exception
     — a strip that already fits — is written to the element by the effect. */
  const mode: Mode = wide ? 'h' : 'v'

  const rootRef = useRef<HTMLElement | null>(null)
  const pinRef = useRef<HTMLDivElement | null>(null)
  const stripRef = useRef<HTMLDivElement | null>(null)
  const listRef = useRef<HTMLOListElement | null>(null)
  const countRef = useRef<HTMLSpanElement | null>(null)
  const barRef = useRef<HTMLSpanElement | null>(null)

  /* The rig is wired at every width: the top rule, the registration tick and
     the coordinate are the section's entry device, not the traverse's. */
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const rig = initSectionRig(root)
    const pin = pinRef.current
    const strip = stripRef.current
    const list = listRef.current
    const bar = barRef.current
    const count = countRef.current

    /* How far the strip has to travel for its last plate to reach the window's
       right edge. Measured on every refresh — a webfont swap, a resize or a
       language switch changes it, and the pin's end must follow. */
    const travel = () =>
      list && strip ? Math.max(0, list.scrollWidth - strip.clientWidth) : 0

    if (!wide || !pin || !strip || !list || !bar) return () => rig.dispose()

    /* No "already fits" branch: six plates of 62vw in an 86vw window cannot
       fit, and the window is fixed by the stylesheet, so the travel is always
       positive. A conditional fallback here could only disagree with the CSS. */

    let printed = 0
    const print = (index: number) => {
      if (!count || index === printed) return
      printed = index
      count.textContent = plateLabel(index)
    }

    const ctx = gsap.context(() => {
      const timeline = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
          trigger: pin,
          start: 'top top',
          /* The pinned distance is the strip's travel plus a fifth of the
             viewport: the last plate gets a beat at rest before the pin lets
             go, so the closing plate is read rather than passed. */
          end: () => `+=${travel() + Math.round(window.innerHeight * 0.2)}`,
          pin: true,
          scrub: 0.6,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            /* Six plates, one window: the reading rounds to the plate the
               reader is nearest, and it is clamped so the last plate cannot
               print `07`. */
            print(Math.min(PLATES, 1 + Math.round(self.progress * (PLATES - 1))))
          },
        },
      })

      timeline.fromTo(list, { x: 0 }, { x: () => -travel(), duration: 1, ease: 'none' }, 0)
      timeline.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: 1, ease: 'none' }, 0)
    }, root)

    return () => {
      /* Reverting the context kills the trigger, removes the spacer and takes
         every inline transform off the strip and the bar — which is what makes
         a StrictMode double-mount leave no residue. */
      ctx.revert()
      rig.dispose()
      print(1)
    }
  }, [wide])

  return (
    <section
      className="wt"
      id="work"
      data-mode={mode}
      aria-labelledby="work-title"
      ref={rootRef}
    >
      {/* The rig's registration tick, ink: the section's only crimson is the
          progress rule at the foot of the traverse. */}
      <span className="rig-tick wt__mark" data-rig-tick aria-hidden="true" />

      <header className="wt__head">
        {/* The reference and its measurement. Written by the rig, so the
            coordinate element is empty until there is a real number. */}
        <p className="wt__ref mono" aria-hidden="true">
          <span>#work</span>
          <span className="rig-coord" data-rig-coord="" />
        </p>

        <SplitText as="h2" id="work-title" className="wt__title" text={copy.trailTitle} reveal />

        <p className="wt__lead">{copy.trailLead}</p>
      </header>

      <div className="wt__pin" ref={pinRef}>
        <div className="wt__inner">
          <div className="wt__strip" ref={stripRef}>
            <ol className="wt__list" ref={listRef}>
              {featured.map((project, index) => (
                <li className="wt__item" key={project.slug}>
                  <Plate project={project} index={index + 1} />
                </li>
              ))}

              {/* The closing plate: a record of the register itself, not a
                  sixth project. It carries no seal, which is how the absence
                  reads as the end of the selection. */}
              <li className="wt__item wt__item--close">
                <article className="plate plate--close">
                  <div className="plate__top">
                    <span className="plate__ref mono">W.{pad2(PLATES)}</span>
                    <span className="plate__domain mono">
                      {projects.length} {copy.countLabel}
                    </span>
                  </div>

                  <div className="plate__body">
                    <p className="plate__claim plate__claim--close">{copy.trailNote}</p>
                  </div>

                  <div className="plate__foot">
                    <Link to="/work" className="plate__open mono" data-hud="/work">
                      <RolloverLabel text={backLabel} />
                    </Link>
                  </div>
                </article>
              </li>
            </ol>
          </div>

          {/* An instrument reading, not a control: the counter and the rule are
              decoration for assistive tech, and the plates already carry the
              names. */}
          <div className="wt__foot" aria-hidden="true">
            <span className="wt__count mono" ref={countRef}>
              {plateLabel(1)}
            </span>
            <span className="wt__bar">
              <span className="wt__bar-fill" ref={barRef} />
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}

import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { useLang } from '../../lib/i18n'
import { Link, navigate } from '../../lib/router'
import { MOTION, prefersReducedMotion } from '../../lib/reveal'
import { handle, hero } from '../../content/hero'
import MagneticButton from '../ui/MagneticButton'
import SplitText from '../ui/SplitText'
import './cover.css'

/* ============================================================================
   Cover — the title sheet
   ----------------------------------------------------------------------------
   Type, then one drawing. The order of the plate is fixed: a location line,
   the handle at plate scale, the claim, the note, two actions, and the collar —
   four readings in the right margin, set to the handle's cap-height. At the foot
   the section is printed: four bands, one hairline each, the value at the right
   edge, a caption in the margin.

   The cover is not a hero: no canvas, no scene, no image, no scroll trigger. The
   atmosphere is the ground and the only motion is the first printing of the
   words and the four rules — one timeline, run once, over before the reader has
   read the claim. Reduced motion renders the final state and creates nothing.

   The bands are measurements, not controls: no tabIndex, no role, no handler.
   The crimson tick under the pointer is a registration mark on the rule (CSS
   `:hover` only). `#work` arrives in phase B; the href stays honest until then.
   ========================================================================== */

export default function Cover() {
  const { pick } = useLang()
  const copy = pick(hero)
  const rootRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root || prefersReducedMotion()) return

    const ctx = gsap.context(() => {
      const handleUnits = gsap.utils.toArray<HTMLElement>('.cover__handle [data-split-unit]', root)
      const claimUnits = gsap.utils.toArray<HTMLElement>('.cover__claim [data-split-unit]', root)
      const note = root.querySelector<HTMLElement>('.cover__note')
      const rules = gsap.utils.toArray<HTMLElement>('.cover__band-rule', root)

      const tl = gsap.timeline({ defaults: { ease: MOTION.ease } })

      // The handle rises out of its own line box first: the sheet is titled
      // before anything is said on it.
      tl.fromTo(
        handleUnits,
        { yPercent: MOTION.travel },
        { yPercent: 0, duration: MOTION.duration, stagger: MOTION.stagger },
        0,
      )

      // The claim prints word by word, on the same curve and the same stagger.
      tl.fromTo(
        claimUnits,
        { yPercent: MOTION.travel },
        { yPercent: 0, duration: MOTION.duration, stagger: MOTION.stagger },
        MOTION.entry.titleAt,
      )

      // The note is prose: it rises whole, never split per line.
      if (note) {
        tl.fromTo(
          note,
          { y: MOTION.blockRise, opacity: 0 },
          { y: 0, opacity: 1, duration: MOTION.duration },
          MOTION.entry.ref,
        )
      }

      // The drawing is ruled last, one band after another: four hairlines,
      // 60 ms apart, drawn left to right on real spans (a border cannot draw).
      // It starts once the note is under way, never while the claim is landing
      // across it.
      tl.fromTo(
        rules,
        { scaleX: 0 },
        { scaleX: 1, duration: MOTION.entry.rule, stagger: 0.06 },
        MOTION.entry.ref + MOTION.entry.refAt,
      )
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section className="cover" id="cover" aria-labelledby="cover-title" ref={rootRef}>
      <div className="cover__inner">
        <div className="cover__head">
          <p className="cover__kicker">
            <span className="cover__kicker-mark" aria-hidden="true" />
            {copy.kicker}
          </p>

          <SplitText as="h1" id="cover-title" className="cover__handle" text={handle} />

          <SplitText as="p" className="cover__claim" text={copy.claim} />

          <p className="cover__note">{copy.note}</p>

          <div className="cover__actions">
            <MagneticButton
              href="#work"
              onClick={(event) => {
                event.preventDefault()
                navigate('#work')
              }}
            >
              {copy.primaryCta}
            </MagneticButton>

            <Link className="cover__secondary" to="#territory" data-hud="#territory">
              {copy.secondaryCta}
            </Link>
          </div>

          {/* The collar: an instrument reading, not a scoreboard. Placed last in
              the reading order so the cover is read as copy first, then as
              measurements — the grid puts it back beside the handle on a wide
              sheet. */}
          <dl className="cover__collar">
            {copy.readouts.map((readout) => (
              <div className="cover__reading" key={readout.key}>
                <dt>{readout.label}</dt>
                <dd>{readout.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <figure className="cover__figure">
          <ol className="cover__bands">
            {copy.bands.map((band) => (
              <li className="cover__band" key={band.ref}>
                <span className="cover__band-rule" aria-hidden="true" />
                <span className="cover__band-ref">{band.ref}</span>{' '}
                <span className="cover__band-name">{band.name}</span>{' '}
                <span className="cover__band-detail">{band.detail}</span>{' '}
                <span className="cover__band-value">{band.value}</span>
              </li>
            ))}
          </ol>

          <figcaption className="cover__caption">
            <span className="cover__caption-label">{copy.figureLabel}</span>{' '}
            <span className="cover__caption-note">{copy.figureNote}</span>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}

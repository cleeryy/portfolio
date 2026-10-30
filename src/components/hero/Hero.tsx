import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useLang } from '../../lib/i18n'
import { scrollToId } from '../../lib/scroll'
import { gridReference, handle, hero } from '../../content/hero'
import HeroScene from './HeroScene'
import MagneticButton from '../ui/MagneticButton'
import SplitText from '../ui/SplitText'
import './hero.css'

type SceneState = 'pending' | 'live' | 'poster'

/**
 * The first viewport.
 *
 * Order of authorship: the sheet (CSS), the survey (WebGL), the figure (type).
 * The intro is choreographed as one timeline but never gates reading: every
 * word is in the DOM at full opacity before GSAP touches it, the whole sequence
 * runs in 1.45s, and nothing changes the layout as it plays.
 */
export default function Hero() {
  const { pick } = useLang()
  const copy = pick(hero)
  const rootRef = useRef<HTMLElement | null>(null)
  const [scene, setScene] = useState<SceneState>('pending')

  // Stable identities: HeroScene owns its effect and must not re-initialise when
  // the hero re-renders on a language change.
  const markLive = useCallback(() => setScene('live'), [])
  const markPoster = useCallback(() => setScene('poster'), [])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const intro = gsap.context(() => {
      const handleWord = root.querySelectorAll('.hero__handle [data-split-unit]')
      const claimWords = root.querySelectorAll('.hero__claim [data-split-unit]')
      const note = root.querySelectorAll('.hero__note')
      const actions = root.querySelectorAll('.hero__actions > *')
      const collar = root.querySelectorAll('.hero__collar')
      const graticule = root.querySelectorAll('.hero__graticule')
      const gridRef = root.querySelectorAll('.hero__grid-ref')

      // Final states are set before anything animates, in the same layout pass,
      // so the sequence can never leave the page half-composed.
      gsap.set(handleWord, { yPercent: 108 })
      gsap.set(claimWords, { yPercent: 106 })
      gsap.set(note, { y: 14, opacity: 0 })
      gsap.set(actions, { y: 12, opacity: 0 })
      gsap.set(collar, { y: 16, opacity: 0 })
      gsap.set(graticule, { clipPath: 'inset(0% 100% 0% 0%)' })
      gsap.set(gridRef, { opacity: 0 })

      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } })

      tl
        // The sheet is ruled first, left to right.
        .to(graticule, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.25, ease: 'power2.inOut' }, 0)
        .to(gridRef, { opacity: 1, duration: 1, ease: 'power2.out' }, 0.12)
        // Then the figure.
        .to(handleWord, { yPercent: 0, duration: 1.05 }, 0.08)
        .to(claimWords, { yPercent: 0, duration: 0.8, stagger: 0.016 }, 0.28)
        .to(note, { y: 0, opacity: 1, duration: 0.75 }, 0.5)
        .to(actions, { y: 0, opacity: 1, duration: 0.5, stagger: 0.06 }, 0.6)
        // The collar is printed last.
        .to(collar, { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out' }, 0.74)

      return () => {
        tl.kill()
      }
    }, root)

    return () => intro.revert()
  }, [])

  return (
    <section className="hero" ref={rootRef} data-scene={scene}>
      <div className="hero__sheet" aria-hidden="true">
        <div className="hero__graticule" />
        <p className="hero__grid-ref">{gridReference}</p>
      </div>

      <div className="hero__plot">
        <HeroScene onReady={markLive} onUnavailable={markPoster} />
      </div>

      <div className="hero__body">
        <SplitText as="h1" className="hero__handle" text={handle} />

        <div className="hero__lines">
          <SplitText as="p" className="hero__claim" text={copy.claim} />
          <p className="hero__note">{copy.note}</p>
        </div>

        <div className="hero__actions">
          {/* The claim has already made the request; the primary action is the
              evidence for it. `#contact` stays one click away in the nav and
              closes the sheet, so nothing is hidden behind this order. */}
          <MagneticButton href="#path" onClick={() => scrollToId('path')}>
            {copy.primaryCta}
          </MagneticButton>
          <MagneticButton href="#territory" variant="quiet" onClick={() => scrollToId('territory')}>
            {copy.secondaryCta}
          </MagneticButton>
        </div>
      </div>

      <div className="hero__collar">
        <dl className="hero__legend">
          {copy.readouts.map((readout) => (
            <div className="hero__read" key={readout.key}>
              <dt>{readout.label}</dt>
              <dd>{readout.value}</dd>
            </div>
          ))}
        </dl>

        <div className="hero__scale">
          <p className="hero__scale-note">{copy.scaleNote}</p>
          <span className="hero__scale-bar" aria-hidden="true" />
        </div>
      </div>
    </section>
  )
}

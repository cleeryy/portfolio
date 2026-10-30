import { useEffect, useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLang } from '../../lib/i18n'
import { sound } from '../../lib/sound'
import { fieldwork, platforms, rangesCopy } from '../../content/ranges'
import './ranges.css'

gsap.registerPlugin(ScrollTrigger)

/** The platforms, then the field. Order is the register's reading order. */
const grounds = [...platforms, fieldwork]

/**
 * The ranges — the only dark band on the site.
 *
 * A register, not cards: one rule per row, the platform on the left, what he
 * does there on the right. No score, no rank, no event name. Rows carry a link
 * only once a confirmed profile exists; today every row is plain text.
 */
export default function Ranges() {
  const { pick } = useLang()
  const copy = pick(rangesCopy)
  const rootRef = useRef<HTMLElement | null>(null)
  const pingedRef = useRef(false)

  // One restrained reveal per row: the rule builds left to right, the row's text
  // arrives behind it. Nothing is hidden when the script does not run, because
  // the initial states below are only ever written by GSAP.
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = gsap.context(() => {
      const rules = gsap.utils.toArray<HTMLElement>('.rng__rule')
      const cells = gsap.utils.toArray<HTMLElement>('.rng__cell')

      gsap.set(rules, { scaleX: 0 })
      gsap.set(cells, { opacity: 0, y: 10 })

      gsap.utils.toArray<HTMLElement>('.rng__row').forEach((row) => {
        const tl = gsap.timeline({
          scrollTrigger: { trigger: row, start: 'top 88%', once: true },
        })

        tl.to(row.querySelector('.rng__rule'), {
          scaleX: 1,
          duration: 0.62,
          ease: 'power2.inOut',
        }).to(
          row.querySelectorAll('.rng__cell'),
          { opacity: 1, y: 0, duration: 0.44, stagger: 0.06, ease: 'power2.out' },
          0.13,
        )
      })
    }, root)

    return () => ctx.revert()
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
      <span className="rng__mark" aria-hidden="true" />

      <div className="rng__inner">
        <header className="rng__head">
          <p className="rng__ref mono" aria-hidden="true">
            #ranges
          </p>

          <h2 className="rng__title" id="ranges-title">
            {copy.title}
          </h2>

          <div className="rng__intro">
            {copy.intro.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </header>

        <div className="rng__register">
          <div className="rng__cols" aria-hidden="true">
            <span>{copy.columnKeys.ground}</span>
            <span>{copy.columnKeys.practice}</span>
          </div>

          <ol className="rng__list" role="list">
            {grounds.map((ground) => (
              <li className="rng__row" key={ground.id}>
                <span className="rng__rule" aria-hidden="true" />

                <div className="rng__cell rng__cell--ground">
                  <h3 className="rng__name">
                    {ground.profileUrl ? (
                      <a className="rng__link" href={ground.profileUrl} rel="noopener noreferrer">
                        {pick(ground.name)}
                      </a>
                    ) : (
                      pick(ground.name)
                    )}
                  </h3>
                </div>

                <div className="rng__cell rng__cell--practice">
                  <p>{pick(ground.focus)}</p>
                </div>
              </li>
            ))}
          </ol>

          <p className="rng__note mono">{copy.registerNote}</p>
        </div>
      </div>
    </section>
  )
}

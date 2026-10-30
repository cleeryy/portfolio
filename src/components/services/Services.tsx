import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLang } from '../../lib/i18n'
import { sound } from '../../lib/sound'
import {
  installations,
  servicesCopy,
  type InstallationKind,
} from '../../content/services'
import './services.css'

gsap.registerPlugin(ScrollTrigger)

/** Reading order of the symbol key. Matches the order of the register. */
const kindOrder: InstallationKind[] = ['hosted', 'desk', 'sheet']

/**
 * One survey symbol per entry, drawn in CSS, never an image.
 *
 * The three shapes are the sheet's own vocabulary: a filled square is a hosted
 * service, a cross is a build that lives on a desk, and the ring is the control
 * point — the sheet itself, where the reader is standing.
 */
function Glyph({ kind }: { kind: InstallationKind }) {
  return <span className={`svc__glyph svc__glyph--${kind}`} aria-hidden="true" />
}

/**
 * The installations, as a gazetteer.
 *
 * A register, not cards: one hairline per entry, the symbol pinned to that
 * hairline, the name in display type, one line of what it is, the stack in mono
 * and exactly one address on the right — the live site, or the source. Nothing
 * is a screenshot and nothing pretends to be one.
 *
 * Motion is the quietest on the page: one rule-wipe per entry, once, staggered.
 * The text never moves. If the script never runs the rules are simply drawn,
 * because the only hidden state is written by GSAP, never by CSS.
 */
export default function Services() {
  const { pick } = useLang()
  const copy = pick(servicesCopy)
  const rootRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('.svc__rule').forEach((rule, index) => {
        gsap.set(rule, { scaleX: 0 })
        gsap.to(rule, {
          scaleX: 1,
          duration: 0.72,
          ease: 'power2.inOut',
          // A short wave down the register, capped so the last entry is never
          // left waiting on a long chain of delays.
          delay: Math.min(index, 3) * 0.045,
          scrollTrigger: { trigger: rule, start: 'top 92%', once: true },
        })
      })
    }, root)

    return () => ctx.revert()
  }, [])

  return (
    <section className="svc" id="services" aria-labelledby="services-title" ref={rootRef}>
      <div className="svc__inner">
        <header className="svc__head">
          <p className="svc__ref mono" aria-hidden="true">
            #services
          </p>

          <h2 className="svc__title" id="services-title">
            {copy.title}
          </h2>

          <p className="svc__lead">{copy.lead}</p>

          <div className="svc__key">
            <p className="svc__key-label mono">{copy.keyLabel}</p>
            <ul className="svc__key-list">
              {kindOrder.map((kind) => (
                <li className="svc__key-item" key={kind}>
                  <Glyph kind={kind} />
                  <span>{copy.kindLabel[kind]}</span>
                </li>
              ))}
            </ul>
          </div>
        </header>

        <div className="svc__register">
          <div className="svc__cols mono" aria-hidden="true">
            <span>{copy.columnKeys.installation}</span>
            <span>{copy.columnKeys.address}</span>
          </div>

          <ol className="svc__list">
            {installations.map((item) => (
              <li className="svc__entry" key={item.id}>
                <span className="svc__rule" aria-hidden="true" />
                <Glyph kind={item.kind} />

                <h3 className="svc__name">{pick(item.name)}</h3>
                <p className="svc__what">{pick(item.what)}</p>
                <p className="svc__stack mono">{item.stack.join(' + ')}</p>

                <a
                  className="svc__link"
                  href={item.link.href}
                  onClick={() => sound.click()}
                >
                  <span className="svc__link-key mono">{pick(item.link.label)}</span>
                  {/* A real space, not a gap: the link's accessible name must
                      read "site en ligne mealboard.cleeryy.cloud", not two
                      words run together. Grid ignores the whitespace node. */}
                  {' '}
                  <span className="svc__link-url">{item.link.display}</span>
                </a>
              </li>
            ))}
          </ol>

          <p className="svc__note mono">{copy.note}</p>
        </div>
      </div>
    </section>
  )
}

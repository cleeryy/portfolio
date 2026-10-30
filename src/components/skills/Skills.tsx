import { useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useLang } from '../../lib/i18n'
import { initSectionRig } from '../../lib/reveal'
import { sound } from '../../lib/sound'
import { depthOrder, domains, skillsCopy } from '../../content/skills'
import SplitText from '../ui/SplitText'
import './skills.css'

gsap.registerPlugin(ScrollTrigger)

/**
 * The ledger — the CV page.
 *
 * Two columns above 1024px: a margin rail carrying the seven domain names as
 * real anchors, and a detail column carrying one entry per domain. The rail is
 * `position: sticky`, the section is not pinned: the page keeps its normal
 * scroll, so the ledger composes with the pinned chapter above it instead of
 * fighting it for the viewport.
 *
 * The active state is the one piece of motion the section needs. It is not an
 * animation of text: each domain owns a ScrollTrigger whose range is the block
 * crossing a reading line 240px below the top of the viewport. Because the
 * blocks are contiguous, exactly one range is live at a time, so the rail can
 * never show two marks or none. `onToggle` only reacts on entry, and the tick's
 * travel is a 280ms width/colour change in CSS — which the reduced-motion floor
 * in base.css removes, leaving the mark computed and printed but immobile.
 *
 * Nothing is hidden by CSS. The rail, the seven entries, the tools and the
 * proofs are all in the markup; without JS the anchors still work and the first
 * domain is simply the one marked.
 */
export default function Skills() {
  const { pick } = useLang()
  const copy = pick(skillsCopy)
  const rootRef = useRef<HTMLElement | null>(null)
  const [active, setActive] = useState(domains[0]?.id ?? '')

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return

    const rig = initSectionRig(root)

    /* One trigger per domain: its block crossing the reading line, 240px from
       the top of the viewport. A fixed offset, not a percentage, because two
       measured things have to agree: the entry the eye has actually reached,
       and a rail anchor, which lands a heading at 80px. At 240px the landed
       domain is always still on the line — a 45% line marked the entry two
       steps further down. */
    const triggers = domains.map((domain) => {
      const node = root.querySelector<HTMLElement>(`[data-domain="${domain.id}"]`)
      if (!node) return null

      return ScrollTrigger.create({
        trigger: node,
        start: 'top 240px',
        end: 'bottom 240px',
        onToggle: (self) => {
          if (!self.isActive) return
          setActive((previous) => (previous === domain.id ? previous : domain.id))
        },
      })
    })

    return () => {
      for (const trigger of triggers) trigger?.kill()
      rig.dispose()
    }
  }, [])

  return (
    <section className="skl" id="skills" aria-labelledby="skills-title" ref={rootRef}>
      <span className="rig-tick" data-rig-tick aria-hidden="true" />

      <div className="skl__inner">
        <header className="skl__head">
          <p className="skl__ref mono" aria-hidden="true">
            <span>#skills</span>
            <span className="rig-coord" data-rig-coord="" />
          </p>

          <SplitText
            as="h2"
            className="skl__title"
            id="skills-title"
            text={copy.title}
            reveal
          />

          <p className="skl__lead" data-reveal-block="">
            {copy.lead}
          </p>

          {/* The legend sits at the foot of the head, ruled like the services
              key: three qualifiers, each with the sentence that defines it. A
              reader who only reads this line already knows how to read the
              ledger. */}
          <div className="skl__key">
            <p className="skl__key-label mono">{copy.keyLabel}</p>
            <dl className="skl__key-list">
              {depthOrder.map((depth) => (
                <div className="skl__key-item" key={depth}>
                  <dt className="mono">{copy.depth[depth]}</dt>
                  <dd>{copy.depthNote[depth]}</dd>
                </div>
              ))}
            </dl>
          </div>
        </header>

        <div className="skl__ledger">
          <nav className="skl__index" aria-label={copy.indexLabel}>
            <p className="skl__index-head mono" aria-hidden="true">
              <span>{copy.indexKey}</span>
              <span>{domains.length}</span>
            </p>

            <ol className="skl__index-list">
              {domains.map((domain) => {
                const isActive = active === domain.id
                return (
                  <li key={domain.id}>
                    <a
                      className="skl__index-link"
                      href={`#skills-${domain.id}`}
                      aria-current={isActive ? 'location' : undefined}
                      data-active={isActive ? 'true' : undefined}
                      onClick={() => sound.click()}
                    >
                      <span className="skl__index-name">{pick(domain.name)}</span>
                    </a>
                  </li>
                )
              })}
            </ol>
          </nav>

          <div className="skl__detail">
            {domains.map((domain) => {
              const isActive = active === domain.id
              return (
                <section
                  className="skl__domain"
                  id={`skills-${domain.id}`}
                  key={domain.id}
                  aria-labelledby={`skills-${domain.id}-title`}
                  data-domain={domain.id}
                  data-active={isActive ? 'true' : undefined}
                >
                  <span className="skl__rule" aria-hidden="true" />
                  <span className="skl__station" aria-hidden="true" />

                  <div className="skl__top">
                    <h3 className="skl__name" id={`skills-${domain.id}-title`}>
                      {pick(domain.name)}
                    </h3>
                    <p className="skl__depth mono">{copy.depth[domain.depth]}</p>
                  </div>

                  <p className="skl__line">{pick(domain.line)}</p>

                  {/* One block, one fade: the instruments are read as a line,
                      never as a stack of items arriving one by one. */}
                  <ul className="skl__tools" data-reveal-block="">
                    {pick(domain.tools).map((tool) => (
                      <li className="skl__tool" key={tool}>
                        {tool}
                      </li>
                    ))}
                  </ul>

                  <p className="skl__proof">
                    <span className="skl__proof-key mono">{copy.proofLabel}</span>
                    {domain.proofHref ? (
                      <a
                        className="skl__proof-link"
                        href={domain.proofHref}
                        onClick={() => sound.click()}
                      >
                        {pick(domain.proof)}
                      </a>
                    ) : (
                      <span className="skl__proof-text">{pick(domain.proof)}</span>
                    )}
                  </p>
                </section>
              )
            })}
          </div>
        </div>

        <p className="skl__note mono">{copy.note}</p>
      </div>
    </section>
  )
}

import { useLayoutEffect, useRef } from 'react'
import { useLang } from '../../lib/i18n'
import { initSectionRig } from '../../lib/reveal'
import { about, timeline } from '../../content/about'
import SplitText from '../ui/SplitText'
import './about.css'

/**
 * The operator, in one reading column.
 *
 * Layout contract: a narrow margin column carries the section reference at the
 * top and the field card at the foot of the prose; a single wide column carries
 * the statement and three paragraphs, capped at 62ch. Nothing is centred and
 * nothing is decorated — this is the one section on the sheet with no survey
 * mark in it, which is the quietest way to say "the person, not the instrument".
 *
 * Its motion is therefore the plainest on the page: the shared entry tick, the
 * shared coordinate, and the three paragraphs rising as whole blocks as they are
 * reached. No staggered words in the prose — a sentence read for what it says,
 * not for how it arrives.
 *
 * The career ledger is wired but empty: `timeline` is `[]`, so this component
 * renders no list at all — no placeholder, no "coming soon", no empty rule. When
 * the array is filled the rows appear below the prose with styles that already
 * exist, so it is a content edit rather than a redesign.
 */
export default function About() {
  const { pick } = useLang()
  const copy = pick(about)
  const hasTimeline = timeline.length > 0
  const rootRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const rig = initSectionRig(root)
    return () => rig.dispose()
  }, [])

  return (
    <section className="abt" id="about" aria-labelledby="about-title" ref={rootRef}>
      <span className="rig-tick" data-rig-tick aria-hidden="true" />

      <div className="abt__inner">
        {/* A margin rule, the way a printed sheet separates its annotations from
            its text. Decorative, so it is never the only thing carrying meaning. */}
        <span className="abt__rule" aria-hidden="true" />

        <p className="abt__ref mono" aria-hidden="true">
          <span>#about</span>
          <span className="rig-coord" data-rig-coord="" />
        </p>

        <div className="abt__body">
          <SplitText
            as="h2"
            className="abt__title"
            id="about-title"
            text={copy.title}
            reveal
          />

          <div className="abt__prose">
            {copy.paragraphs.map((paragraph) => (
              <p key={paragraph} data-reveal-block="">
                {paragraph}
              </p>
            ))}
          </div>

          {hasTimeline ? (
            <div className="abt__timeline">
              <p className="abt__timeline-label mono">{copy.timelineLabel}</p>
              <ol className="abt__timeline-list">
                {timeline.map((entry) => (
                  <li className="abt__timeline-row" key={`${entry.year}-${pick(entry.label)}`}>
                    <span className="abt__timeline-year mono">{entry.year}</span>
                    <span className="abt__timeline-name">{pick(entry.label)}</span>
                    {entry.note ? (
                      <span className="abt__timeline-note">{pick(entry.note)}</span>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>

        <dl className="abt__data">
          {copy.annotations.map((annotation) => (
            <div className="abt__datum" key={annotation.key}>
              <dt className="mono">{annotation.key}</dt>
              <dd>{annotation.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

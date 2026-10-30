import { useLang } from '../../lib/i18n'
import { about, timeline } from '../../content/about'
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
 * The career ledger is wired but empty: `timeline` is `[]`, so this component
 * renders no list at all — no placeholder, no "coming soon", no empty rule. When
 * the array is filled the rows appear below the prose with styles that already
 * exist, so it is a content edit rather than a redesign.
 */
export default function About() {
  const { pick } = useLang()
  const copy = pick(about)
  const hasTimeline = timeline.length > 0

  return (
    <section className="abt" id="about" aria-labelledby="about-title">
      <div className="abt__inner">
        {/* A margin rule, the way a printed sheet separates its annotations from
            its text. Decorative, so it is never the only thing carrying meaning. */}
        <span className="abt__rule" aria-hidden="true" />

        <p className="abt__ref mono" aria-hidden="true">
          #about
        </p>

        <div className="abt__body">
          <h2 className="abt__title" id="about-title">
            {copy.title}
          </h2>

          <div className="abt__prose">
            {copy.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
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

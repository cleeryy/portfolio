import { aboutPage, practice, record } from '../../content/about'
import { useLang } from '../../lib/i18n'
import { Link } from '../../lib/router'
import Ghost from '../type/Ghost'
import './about-page.css'

/* ============================================================================
   AboutPage — the record, without the costume
   ----------------------------------------------------------------------------
   The long version of the operator chapter, printed as a document: one field
   opened by the sheet's ink rule and its 76 × 2 registration tick, a title
   block, then three ruled chapters.

   1. `record` is a chronology, so it is an ordered list, not a table of divs.
      The year keeps the mono margin and a single hairline spine runs down the
      whole list at the edge of that margin — a survey log, where the dates are
      not decoration but the reading. The spine is the list's `::before`, so it
      spans exactly the entries and stops at the first and the last.
   2. `practice` prints five domains. Each has a label, a qualifier in a
      hairline plate, the instruments on one mono line, and one proof. The
      qualifier is the only tag-like device on the page, and it is allowed
      because it is a measurement (`in production`, `in a lab`), not a badge.
   3. `honesty` is the page's single dark break: `on-deep` bleeds to the
      viewport edges and the content is constrained back to the field. The band
      uses only the tokens `.on-deep` re-points — no second dark surface.

   The page ends on light ground: the contact CTA is a text link in the sheet's
   register below the band, so `/about` closes as a document rather than on ink.

   Every visible string is `pick()`ed from `content/about.ts`; the component
   holds no copy. The page is static — no observer, no trigger, no RAF — so an
   unmount has nothing to release and a deep link prints the same sheet.
   ========================================================================== */

export default function AboutPage() {
  const { pick } = useLang()
  const copy = pick(aboutPage)

  return (
    <main id="top" className="ab" data-page="about" aria-labelledby="ab-title">
      <div className="ab__inner">
        {/* The sheet's registration tick at the head of the ink rule: the one
            mark on the page. The plates, the spine and the CTA underline are
            contour; the qualifiers are the only other crimson, and they are a
            reading. */}
        <span className="ab__mark" aria-hidden="true" />

        <header className="ab__head">
          <Ghost as="h1" className="ab__title" id="ab-title" text={copy.title} />
          <p className="ab__lead">{copy.lead}</p>
        </header>

        <section className="ab__block" aria-labelledby="ab-record">
          <header className="ab__block-head">
            <h2 className="ab__block-label mono" id="ab-record">
              {copy.recordLabel}
            </h2>
            <p className="ab__block-lead">{copy.recordLead}</p>
          </header>

          {/* An ordered list because the entries are a chronology: assistive
              tech must be able to read the order, not just the years. */}
          <ol className="ab__record" role="list">
            {record.map((entry) => (
              <li className="ab__entry" key={entry.year + entry.label.en}>
                <span className="ab__year mono">{entry.year}</span>
                <div className="ab__entry-body">
                  <h3 className="ab__entry-label">{pick(entry.label)}</h3>
                  <p className="ab__entry-note">{pick(entry.note)}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section className="ab__block" aria-labelledby="ab-practice">
          <header className="ab__block-head">
            <h2 className="ab__block-label mono" id="ab-practice">
              {copy.domainsLabel}
            </h2>
            <p className="ab__block-lead">{copy.domainsLead}</p>
          </header>

          <div className="ab__practice">
            {practice.map((entry) => (
              <article className="ab__discipline" key={entry.id}>
                <div className="ab__discipline-head">
                  <h3 className="ab__discipline-label">{pick(entry.label)}</h3>
                  <span className="ab__qualifier mono">{pick(entry.qualifier)}</span>
                </div>

                {/* One paragraph, joined with the sheet's separator: the
                    instruments are a reading, not a set of chips. */}
                <p className="ab__instruments mono">{entry.instruments.join(' + ')}</p>

                <p className="ab__proof">{pick(entry.proof)}</p>
              </article>
            ))}
          </div>

          {/* The proof the chapter points at: the offensive record is a page of
              its own, and this is the one way there from the honesty block. */}
          <p className="ab__practice-foot">
            <Link to="/practice" className="ab__cta">
              {copy.practiceCta}
            </Link>
          </p>
        </section>
      </div>

      {/* The page's one dark break. The negative gutter bleeds the band to the
          viewport edges; the inner column is the field again. */}
      <section className="ab__honesty on-deep" aria-labelledby="ab-honesty">
        <div className="ab__honesty-inner">
          <header className="ab__block-head ab__block-head--honesty">
            <h2 className="ab__honesty-title" id="ab-honesty">
              {copy.honestyTitle}
            </h2>
          </header>
          <p className="ab__honesty-text">{copy.honesty}</p>
        </div>
      </section>

      {/* Back on the sheet: the one destination the page asks for. */}
      <footer className="ab__foot">
        <div className="ab__foot-row">
          <Link to="/#contact" className="ab__cta" data-hud="/#contact">
            {copy.contactCta}
          </Link>
          <p className="ab__contact-note mono">{copy.contactNote}</p>
        </div>
      </footer>
    </main>
  )
}

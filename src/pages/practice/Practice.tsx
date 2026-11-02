import { notesKindLabel } from '../../content/notes'
import { platforms, practiceCopy, ranges, tools } from '../../content/practice'
import { useLang } from '../../lib/i18n'
import { Link } from '../../lib/router'
import Ghost from '../../ui/Ghost'
import './practice.css'

/* ============================================================================
   Practice — the offensive record
   ----------------------------------------------------------------------------
   A document page, in the same grammar as `/work` and `/notes`: one field opened
   by the sheet's ink rule and its 76 × 2 registration tick, a title block, then
   three ruled chapters.

   1. **The ranges** are a register. One row is one challenge and one link off
      the sheet — year, kind, name and the technique the exercise required, then
      the printed "continues off-sheet" tick. The whole ruled line is the target,
      exactly as in the register: a row is its hairline, not a card.
   2. **The accounts** are three rows of the same table. The note is printed
      whole and unedited — it is the reading the public profile prints, not a
      claim this page makes up. No rank is derived, no score is computed.
   3. **The instruments** are four margin/label pairs, the list on one mono
      paragraph joined with ` + `. Never chips.

   The ask is the page's one dark break, like `/about`'s honesty band: the field
   bleeds to the viewport edges and the same tokens are re-pointed by `.on-deep`.
   One crimson mark, two ways out (the register and the writing), no button.

   Nothing here paints a surface, invents a number or filters the content: every
   string is `pick()`ed from `content/practice.ts`, and the count in the margin
   is `ranges.length` — the measurement cannot disagree with the list under it.
   The page is static: no trigger, no observer, no RAF to release.
   ========================================================================== */

export default function Practice() {
  const { pick } = useLang()
  const copy = pick(practiceCopy)

  return (
    <main id="top" className="pr" data-page="practice" aria-labelledby="pr-title">
      <div className="pr__inner">
        {/* The sheet's registration tick, on the opening rule: the one mark on
            the page. The ask band carries the other, and nothing else here is
            crimson at rest. */}
        <span className="pr__mark" aria-hidden="true" />

        <header className="pr__head">
          <p className="pr__count mono">{`${ranges.length} ${copy.countLabel}`}</p>
          <Ghost as="h1" className="pr__title" id="pr-title" text={copy.title} />
          <p className="pr__lead">{copy.lead}</p>
        </header>

        <section className="pr__block" aria-labelledby="pr-ranges">
          <header className="pr__block-head">
            <h2 className="pr__block-label mono" id="pr-ranges">
              {copy.rangesLabel}
            </h2>
            <p className="pr__block-lead">{copy.rangesLead}</p>
          </header>

          <ul className="pr__list" role="list">
            {ranges.map((entry) => (
              <li className="pr__item" key={entry.id}>
                <a
                  className="pr__row"
                  href={entry.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="pr__year mono">{entry.year}</span>
                  <span className="pr__kind mono">{pick(notesKindLabel[entry.kind])}</span>
                  <span className="pr__name">{entry.name}</span>
                  <span className="pr__technique">{pick(entry.technique)}</span>
                  {/* Decorative: the row's accessible name already carries the
                      entry. The mark repeats "elsewhere", nothing more. */}
                  <span className="pr__ext" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="pr__block" aria-labelledby="pr-platforms">
          <header className="pr__block-head">
            <h2 className="pr__block-label mono" id="pr-platforms">
              {copy.platformsLabel}
            </h2>
            <p className="pr__block-lead">{copy.platformsLead}</p>
          </header>

          <ul className="pr__list" role="list">
            {platforms.map((account) => (
              <li className="pr__item" key={`${account.handle}-${account.platform}`}>
                <a
                  className="pr__row pr__row--account"
                  href={account.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className="pr__plat mono">{account.platform}</span>
                  <span className="pr__handle">{account.handle}</span>
                  {/* The figures are the owner's own, read off the public
                      profile. Printed as they come; nothing is added. */}
                  <span className="pr__note">{pick(account.note)}</span>
                  <span className="pr__ext" aria-hidden="true" />
                </a>
              </li>
            ))}
          </ul>
        </section>

        <section className="pr__block" aria-labelledby="pr-tools">
          <header className="pr__block-head">
            <h2 className="pr__block-label mono" id="pr-tools">
              {copy.toolsLabel}
            </h2>
            <p className="pr__block-lead">{copy.toolsLead}</p>
          </header>

          <div className="pr__tools">
            {tools.map((block) => (
              <div className="pr__tool" key={pick(block.label)}>
                <h3 className="pr__tool-label mono">{pick(block.label)}</h3>
                <p className="pr__tool-items mono">{block.items.join(' + ')}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* The page's one dark break. The negative gutter bleeds the band to the
          viewport edges; the inner column is the field again. */}
      <section className="pr__ask on-deep" aria-labelledby="pr-ask">
        <div className="pr__ask-inner">
          <span className="pr__ask-mark" aria-hidden="true" />

          <h2 className="pr__ask-title" id="pr-ask">
            {copy.askTitle}
          </h2>

          <p className="pr__ask-text">{copy.ask}</p>

          <div className="pr__ask-links">
            <Link to="/work" className="pr__ask-link">
              {copy.workCta}
            </Link>
            <Link to="/notes" className="pr__ask-link">
              {copy.notesCta}
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

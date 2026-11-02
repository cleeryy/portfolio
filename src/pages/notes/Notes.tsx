import { blogUrl } from '../../content/contact'
import { notes, notesCopy, notesKindLabel } from '../../content/notes'
import type { Note } from '../../content/notes'
import { useLang } from '../../lib/i18n'
import { Link } from '../../lib/router'
import Ghost from '../../ui/Ghost'
import './notes.css'

/* ============================================================================
   Notes — the writing, read as a ruled register
   ----------------------------------------------------------------------------
   A document page, not a chapter: one field on the sheet, opened by the ink
   rule and its 76 × 2 registration tick, then a header and a stack of years.
   The background belongs to the app (Atmosphere, SheetGrid, Grain); nothing
   here paints a surface of its own.

   **The years are derived, never listed.** A Map is built from `notes[].date`
   alone — four characters per entry, taken from the ISO string — so a year can
   only exist if a note carries it and an empty `<h2>` cannot print. The keys are
   then sorted descending as numbers, which fixes the reading order (2026 before
   2025) without trusting the order the array happens to be in; inside a year the
   source order is kept, because the blog published them that way. A Map preserves
   insertion order, so the sort is the only reordering on the page.

   **One row is one link, and the link leaves the sheet.** Date, kind, title and
   line are four readings of the same entry, so the whole ruled row is the target
   and nothing inside it competes for the click. Every entry lives on
   blog.cleeryy.cloud, so the row is a plain `<a target="_blank"
   rel="noreferrer">` — never the router's Link, which would take an external
   address for a route. The marker in the last column is a 14 × 1 hairline, not
   an arrow: a printed "continues off-sheet" tick.

   **The response is colour plus a width lift.** Hover darkens the row's rule,
   widens the title to 106 and inks the marker. Only the width lift is a
   movement, so only it sits inside `prefers-reduced-motion: no-preference`; the
   colour change and the focus ring survive either way. Hover is declared under
   `@media (hover: hover)`, so a tap leaves nothing sticky behind.

   **Nothing to clean up.** The page is static: no GSAP, no ScrollTrigger, no
   observer, no RAF, no state. Unmounting it leaves no trigger and no listener.
   ========================================================================== */

type NoteYear = {
  year: string
  entries: Note[]
}

/** Group entries by the four-character year of their ISO date, newest first. */
function groupByYear(entries: readonly Note[]): NoteYear[] {
  const buckets = new Map<string, Note[]>()

  for (const note of entries) {
    const year = note.date.slice(0, 4)
    const bucket = buckets.get(year)

    if (bucket) bucket.push(note)
    else buckets.set(year, [note])
  }

  return [...buckets.entries()]
    .sort(([a], [b]) => Number(b) - Number(a))
    .map(([year, list]) => ({ year, entries: list }))
}

/* The array is a module constant and holds no language, so the grouping is
   computed once at load instead of on every language switch. */
const noteYears = groupByYear(notes)

export default function Notes() {
  const { pick } = useLang()
  const copy = pick(notesCopy)

  return (
    <main id="top" className="nt" data-page="notes" aria-labelledby="nt-title">
      <div className="nt__inner">
        {/* The sheet's registration tick at the head of the ink rule: the one
            mark on the page. Everything else that reads crimson is a response
            to the pointer and costs no colour at rest. */}
        <span className="nt__mark" aria-hidden="true" />

        <header className="nt__head">
          {/* The measurement of the page, computed from the array: a printed
              count that could not disagree with the list below it. */}
          <p className="nt__count mono">{`${notes.length} ${copy.countLabel}`}</p>
          <Ghost as="h1" className="nt__title" id="nt-title" text={copy.title} />
          <p className="nt__lead">{copy.lead}</p>
        </header>

        <div className="nt__groups">
          {noteYears.map(({ year, entries }) => {
            const headingId = `nt-year-${year}`

            return (
              <section className="nt__group" key={year} aria-labelledby={headingId}>
                <header className="nt__group-head">
                  <h2 className="nt__group-year" id={headingId}>
                    {year}
                  </h2>
                  {/* The numeral is the reading; the label after it is the same
                      word the page header uses, printed for a screen reader
                      instead of widening the count column. */}
                  <p className="nt__group-count mono">
                    {entries.length}
                    <span className="sr-only"> {copy.countLabel}</span>
                  </p>
                </header>

                <ul className="nt__list">
                  {entries.map((note) => (
                    <li className="nt__item" key={note.href}>
                      <a
                        className="nt__row"
                        href={note.href}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="nt__date mono">{note.date}</span>
                        <span className="nt__kind mono">{pick(notesKindLabel[note.kind])}</span>
                        <span className="nt__title">{note.title}</span>
                        <span className="nt__line">{pick(note.line)}</span>
                        {/* Decorative: the link's own accessible name is the
                            entry, and the mark only repeats "elsewhere". */}
                        <span className="nt__ext" aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}
        </div>

        <footer className="nt__foot">
          {/* The label is the sentence; the address beside it is the printed
              reading, in mono, the way a legend key is set. */}
          <p className="nt__all">
            <a
              className="nt__all-link"
              href={blogUrl}
              target="_blank"
              rel="noreferrer"
            >
              {copy.allLabel}
            </a>
            <span className="nt__all-note mono">{copy.allNote}</span>
          </p>

          {/* The writing has a second half: the record of what was actually
              solved. One line, in the same register, not a sixth route in the
              bar. */}
          <p className="nt__all">
            <Link to="/practice" className="nt__all-link">
              {copy.practiceCta}
            </Link>
          </p>
        </footer>
      </div>
    </main>
  )
}

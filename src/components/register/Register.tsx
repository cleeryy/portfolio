import { domains, projects, projectsByDomain, workCopy } from '../../content/work'
import { useLang } from '../../lib/i18n'
import { Link } from '../../lib/router'
import Ghost from '../../ui/Ghost'
import './register.css'

/* ============================================================================
   Register — the register: every project, read as a ruled table
   ----------------------------------------------------------------------------
   A document page, not a chapter. One field on the sheet, opened by the ink rule
   and its 76 × 2 registration tick, then four domains and one row per project.
   The background belongs to the app (Atmosphere, SheetGrid, Grain); nothing here
   paints a surface of its own.

   **Groups are derived, never listed.** `domains` gives the order and each group
   is `projectsByDomain(domain.id)`, so a domain holding no project cannot print
   an empty header — the page can only show groups it actually has.

   **One row is one link.** Name, claim, instruments, state and year are five
   readings of the same record, so the whole ruled line is the target
   (`/work/<slug>`) and nothing inside it competes for the click. The row's
   accessible name is therefore the record read in order, which is what a
   register is for.

   **The header and the rows share one track.** `--reg-cols` and `--reg-gap` are
   declared once on the page and used by both the group header and the row, so
   the domain label, its note and the group count sit over the name, the claim
   and the year instead of drifting onto a second grid.

   **The response is transform-only.** Hover darkens the row's hairline (a
   colour, not a movement), lifts the name 6% on the width axis, and slides a 6px
   survey square in from the gutter. The square is absolutely positioned and
   scaled from zero: nothing is reserved and nothing reflows. Both movements are
   declared inside `prefers-reduced-motion: no-preference`, so a reader who asked
   for less motion keeps the darkened rule and the focus ring — the state, not
   the transition.

   **Nothing to clean up.** The page is static: no GSAP, no ScrollTrigger, no
   observer, no RAF. Unmounting it leaves no trigger and no listener behind.
   ========================================================================== */

/** First three instruments, and an ellipsis when the list runs on. */
function stackLine(stack: readonly string[]): string {
  const head = stack.slice(0, 3).join(' + ')
  return stack.length > 3 ? `${head} …` : head
}

export default function Register() {
  const { pick } = useLang()
  const copy = pick(workCopy)

  const groups = domains
    .map((domain) => ({ domain, entries: projectsByDomain(domain.id) }))
    .filter((group) => group.entries.length > 0)

  return (
    <main id="top" className="reg" data-page="register" aria-labelledby="reg-title">
      <div className="reg__field">
        {/* The sheet's registration tick at the head of the ink rule: the one
            mark on the page. Everything else that reads crimson is a response
            to the pointer and costs no colour at rest. */}
        <span className="reg__mark" aria-hidden="true" />

        <header className="reg__head">
          {/* The measurement of the register, computed from the array: a printed
              count that could not disagree with the list below it. */}
          <p className="reg__count mono">{`${projects.length} ${copy.countLabel}`}</p>
          <Ghost as="h1" className="reg__title" id="reg-title" text={copy.title} />
          <p className="reg__lead">{copy.lead}</p>
        </header>

        <div className="reg__groups">
          {groups.map(({ domain, entries }) => {
            const headingId = `reg-domain-${domain.id}`

            return (
              <section className="reg__group" key={domain.id} aria-labelledby={headingId}>
                <header className="reg__group-head">
                  <h2 className="reg__group-label" id={headingId}>
                    {pick(domain.label)}
                  </h2>
                  <p className="reg__group-note">{pick(domain.note)}</p>
                  {/* The numeral is the reading; the label after it is the same
                      word the page header uses, printed for a screen reader
                      instead of widening the count column. */}
                  <p className="reg__group-count mono">
                    {entries.length}
                    <span className="sr-only"> {copy.countLabel}</span>
                  </p>
                </header>

                <ul className="reg__list">
                  {entries.map((project) => {
                    const href = '/work/' + project.slug

                    return (
                      <li className="reg__item" key={project.slug}>
                        <Link to={href} className="reg__row">
                          <span className="reg__name">{project.name}</span>
                          <span className="reg__claim">{pick(project.claim)}</span>
                          <span className="reg__stack mono">{stackLine(project.stack)}</span>
                          <span className="reg__status mono">{pick(project.status)}</span>
                          <span className="reg__year mono">{project.year}</span>
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>

        <footer className="reg__foot">
          <p className="reg__note mono">{copy.note}</p>
        </footer>
      </div>
    </main>
  )
}

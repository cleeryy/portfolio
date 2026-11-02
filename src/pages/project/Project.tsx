import { domains, fileCopy, projectBySlug, projects } from '../../content/work'
import { useLang } from '../../lib/i18n'
import { Link } from '../../lib/router'
import ProjectSeal from '../../ui/ProjectSeal'
import Ghost from '../../ui/Ghost'
import './project.css'

/* ============================================================================
   Project — one entry of the register, opened
   ----------------------------------------------------------------------------
   The register's leaf. A project is read in three moves: a title block (the
   reference, the name, the claim, and the project's seal as a cartouche), a
   reading whose labels live in the margin, and a ruled foot that walks to the
   neighbouring files.

   Where the numbers come from. `projectBySlug` finds the record; the reference
   is the record's position in `projects`, not its `featured` rank — the file
   prints the register's coordinate (`W.03`), so the traverse and the file can
   never disagree about where a project stands. The seal is the same component
   at 240px: same slug, same mark, same sheet.

   The reading's labels are sub-grid columns, not eyebrows above the prose. That
   is the operator/record device: the annotation sits in the margin and the text
   keeps the measure. The did list's three marks are 4 × 1 rules, not bullets and
   not numbers — a rank would be a fact the register does not have.

   Addresses appear once, in the meta ledger, and never in the reading column:
   the file has one address per project, so printing it twice would suggest two
   destinations. Access is a sentence and wraps in the rail; a missing address
   prints `—` only when there is a public link to justify the dash, otherwise the
   `noLink` line says why there is none.

   The page is static on purpose: no rig, no ScrollTrigger, no observer, no
   requestAnimationFrame. A deep link, a back/forward and a language switch all
   print the same sheet, and an unmount has nothing to release.
   ========================================================================== */

type ProjectFileProps = { slug: string }

/** Two digits: a file reference is a coordinate, not a count. */
const pad2 = (value: number) => String(value).padStart(2, '0')

export default function Project({ slug }: ProjectFileProps) {
  const { pick } = useLang()
  const copy = pick(fileCopy)
  const project = projectBySlug(slug)

  /* An address the register does not hold is a missing plate, not a blank page:
     the same shell, its rule and its one crimson tick, the missing copy, and the
     way back. No seal, no neighbours — there is no record to measure. */
  if (!project) {
    return (
      <main id="top" className="file file--missing" data-page="file" aria-labelledby="file-title">
        <div className="file__inner">
          <span className="file__mark" aria-hidden="true" />

          <div className="file__missing">
            <h1 className="file__missing-title" id="file-title">
              {copy.missingTitle}
            </h1>
            <p className="file__missing-lead">{copy.missingLead}</p>
            <p className="file__missing-links">
              <Link to="/work" className="file__missing-cta" data-hud="/work">
                {copy.missingCta}
              </Link>
            </p>
          </div>
        </div>
      </main>
    )
  }

  const index = projects.findIndex((entry) => entry.slug === project.slug)
  const total = projects.length
  const reference = 'W.' + pad2(index + 1)
  const domain = domains.find((entry) => entry.id === project.domain)

  /* Register order, wrapping at both ends: the foot is a loop, because the
     register has no first and no last file. */
  const previous = projects[(index - 1 + total) % total]
  const next = projects[(index + 1) % total]

  /* `access` is printed when the record has it. A public link with no access
     note gets a dash; a record with neither gets the sentence that explains it. */
  const access = project.access
    ? pick(project.access)
    : project.links.length > 0
      ? '—'
      : copy.noLink

  return (
    <main id="top" className="file" data-page="file" aria-labelledby="file-title">
      <div className="file__inner">
        {/* The sheet's registration tick on the field's opening rule. */}
        <span className="file__mark" aria-hidden="true" />

        <header className="file__head">
          <p className="file__ref mono">
            <span className="file__ref-label">{copy.fileLabel}</span>{' '}
            <span className="file__ref-code">{reference}</span>
            {domain ? (
              <>
                <span className="file__ref-sep" aria-hidden="true">
                  /
                </span>
                <span className="file__ref-domain">{pick(domain.label)}</span>
              </>
            ) : null}
          </p>

          <Ghost as="h1" className="file__name" id="file-title" text={project.name} />

          <p className="file__claim">{pick(project.claim)}</p>

          {/* The same mark as the traverse: a station plot, not a badge. */}
          <ProjectSeal slug={project.slug} size={240} className="file__seal" />
        </header>

        <div className="file__body">
          <div className="file__reading">
            <section className="file__section" aria-labelledby="file-summary">
              <h2 className="file__label mono" id="file-summary">
                {copy.summaryLabel}
              </h2>
              <p className="file__summary">{pick(project.summary)}</p>
            </section>

            <section className="file__section" aria-labelledby="file-did">
              <h2 className="file__label mono" id="file-did">
                {copy.didLabel}
              </h2>
              <ul className="file__did" role="list">
                {pick(project.did).map((item) => (
                  <li className="file__did-item" key={item}>
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* The measurements, in the register's ledger grammar: key left, value
              right, one hairline per row. The links are the rail's last block —
              the only place an address is printed. */}
          <aside className="file__meta">
            <dl className="file__facts">
              <div className="file__fact">
                <dt className="file__fact-key mono">{copy.statusLabel}</dt>
                <dd className="file__fact-value mono">{pick(project.status)}</dd>
              </div>
              <div className="file__fact">
                <dt className="file__fact-key mono">{copy.yearLabel}</dt>
                <dd className="file__fact-value mono">{project.year}</dd>
              </div>
              <div className="file__fact">
                <dt className="file__fact-key mono">{copy.accessLabel}</dt>
                <dd className="file__fact-value mono">{access}</dd>
              </div>
              <div className="file__fact">
                <dt className="file__fact-key mono">{copy.stackLabel}</dt>
                <dd className="file__fact-value mono">{project.stack.join(' + ')}</dd>
              </div>
            </dl>

            {project.links.length > 0 ? (
              <div className="file__links">
                <h2 className="file__links-title mono">{copy.linksLabel}</h2>
                <ul className="file__link-list" role="list">
                  {project.links.map((link) => (
                    <li className="file__link" key={link.href}>
                      <span className="file__link-label mono">{pick(link.label)}</span>
                      {link.href.startsWith('/') ? (
                        <Link to={link.href} className="file__link-address mono">
                          {pick(link.note)}
                        </Link>
                      ) : (
                        <a
                          className="file__link-address mono"
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {pick(link.note)}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </aside>
        </div>

        <div className="file__foot">
          <Link
            to={'/work/' + previous.slug}
            className="file__step"
            data-hud={'/work/' + previous.slug}
          >
            <span className="file__step-label mono">{copy.prevLabel}</span>
            <span className="file__step-name">{previous.name}</span>
          </Link>

          <Link
            to={'/work/' + next.slug}
            className="file__step"
            data-hud={'/work/' + next.slug}
          >
            <span className="file__step-label mono">{copy.nextLabel}</span>
            <span className="file__step-name">{next.name}</span>
          </Link>

          <div className="file__back-row">
            <Link to="/work" className="file__back mono" data-hud="/work">
              {copy.backLabel}
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}

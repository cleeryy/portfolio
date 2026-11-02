import { useLang } from '../../lib/i18n'
import { Link } from '../../lib/router'
import { notFound } from '../../content/site'
import { RolloverLabel } from '../ui/Rollover'
import './not-found.css'

/* ============================================================================
   The 404 — a sheet with a missing plate
   ----------------------------------------------------------------------------
   An address the sheet does not have is a survey fact, not a joke and not an
   illustration: a rule, a margin label, the title, one line saying what
   happened, and the two places that do exist.

   This page stands in for the home sheet, so it owns `<main id="top">` and the
   h1. About 60vh: the whole answer fits without scrolling, and the empty field
   below it is the point — the plate is missing.

   The two destinations are route links: a plain left-click is intercepted by
   the router, and the href stays real for a middle-click or a copied address.
   ========================================================================== */

export default function NotFound() {
  const { pick } = useLang()
  const copy = pick(notFound)

  return (
    <main id="top" className="nf" aria-labelledby="nf-title">
      <div className="nf__inner">
        {/* The sheet's registration tick, at the head of the rule: the one
            mark on the page, the same 76 × 2 as every chapter. */}
        <span className="nf__mark" aria-hidden="true" />

        <div className="nf__head">
          <p className="nf__margin mono">{copy.margin}</p>
          <h1 className="nf__title" id="nf-title">
            {copy.title}
          </h1>
          <p className="nf__lead">{copy.lead}</p>

          <p className="nf__links">
            <Link to="/" className="roll-link nf__link" data-hud="/">
              <RolloverLabel text={copy.coverCta} />
            </Link>
            <Link to="/work" className="roll-link nf__link" data-hud="/work">
              <RolloverLabel text={copy.workCta} />
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}

import { domains, workCopy, type Project } from '../../content/work'
import { useLang } from '../../lib/i18n'
import { Link } from '../../lib/router'
import ProjectSeal from '../seal/ProjectSeal'
import { RolloverLabel } from '../ui/Rollover'
import './plate.css'

/* ============================================================================
   Plate — one project, as a plate on the traverse
   ----------------------------------------------------------------------------
   Three bands, ruled top and bottom: a reference row (`W.01` · domain), the
   body (name, claim, seal), and the foot (instruments, status, the way into the
   file). The band structure is the sheet's own — the cover prints its section
   the same way — so a project reads as a measured entry, not as a card.

   The plate is deliberately **not** a link. A whole-plate link would swallow the
   claim and the stack: neither could be selected, copied, or read by a screen
   reader as prose, and a drag would start a navigation. Exactly two links carry
   the destination — the name and `open file` — and they print the same address
   twice because they are two gestures, not two targets.

   The seal is the deterministic plot from `ProjectSeal`: the same slug draws the
   same mark on the traverse and on the file, so the plate and the page it opens
   are recognisably the same record.

   Nothing here is a mark except the name's response: the hairline under the
   name is crimson only while it is drawn, which makes it a reply to the pointer
   rather than a second accent. No fill, no radius, no shadow, tokens only.
   ========================================================================== */

type PlateProps = {
  project: Project
  /** 1–5, the position on the traverse. Printed as `W.01`. */
  index: number
}

/** Two digits, because a plate reference is a coordinate, not a count. */
const pad2 = (value: number) => String(value).padStart(2, '0')

export default function Plate({ project, index }: PlateProps) {
  const { pick } = useLang()
  const copy = pick(workCopy)
  const domain = domains.find((entry) => entry.id === project.domain)
  const href = '/work/' + project.slug

  return (
    <article className="plate">
      <div className="plate__top">
        <span className="plate__ref mono">W.{pad2(index)}</span>
        <span className="plate__domain mono">
          {domain ? pick(domain.label) : ''}
        </span>
      </div>

      <div className="plate__body">
        <Link to={href} className="plate__name" data-hud={href}>
          {project.name}
        </Link>

        <p className="plate__claim">{pick(project.claim)}</p>

        <ProjectSeal slug={project.slug} size={96} className="plate__seal" />
      </div>

      <div className="plate__foot">
        <span className="plate__stack mono">{project.stack.join(' + ')}</span>
        <span className="plate__status mono">{pick(project.status)}</span>

        <Link to={href} className="plate__open mono" data-hud={href}>
          <RolloverLabel text={copy.openLabel} />
        </Link>
      </div>
    </article>
  )
}

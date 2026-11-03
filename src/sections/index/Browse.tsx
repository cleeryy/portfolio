import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FocusEvent } from 'react'
import { browse } from '../../content/browse'
import { domains, projects } from '../../content/work'
import type { Project } from '../../content/work'
import { useLang } from '../../lib/i18n'
import { initSectionRig } from '../../lib/reveal'
import { Link } from '../../lib/router'
import ProjectSeal from '../../ui/ProjectSeal'
import SplitText from '../../ui/SplitText'
import PlatePop, { type PlateSubject } from '../shared/PlatePop'
import './browse.css'

/* ============================================================================
   The index — the wall of plates
   ----------------------------------------------------------------------------
   The register, printed as a wall instead of read as a table: twenty names in
   two columns, each one a link, and one plate that comes to whichever name the
   reader names. It is the chapter that lets a visitor *play* with the register
   without leaving the home sheet.

   **Nothing is derived that the register does not already say.** The list is
   `projects` in array order, the domain label is the one attached to the
   project's own domain, and the reference is the row's position in that array.
   There is no count here that is not `projects.length`, and no claim, year or
   state paraphrased: the row prints the name and its classification, the plate
   prints the record, and the file prints the whole thing.

   **One row is one link.** The reference, the name and the domain are three
   readings of the same record, so the whole ruled line is the target and the
   row's accessible name is those three readings in order. The seal on a coarse
   pointer is `aria-hidden` (`ProjectSeal` always is), so it changes the look of
   the row, never its name.

   **The band is the sheet's, the content is not.** The chapter sits on the
   recessed step (`data-ground="sunk"`, painted by the chrome layer at z −1), so
   it is positioned but creates no stacking context of its own: an opaque fill
   in flow would paint over the atmosphere, and a `z-index` here would trap the
   band's own pseudo element under it.

   **The plate is one element, mounted once.** `PlatePop` is fixed and additive;
   it never enters the flow, never takes the pointer, and is `aria-hidden`. The
   section only says which record is being named and how it is being named —
   pointer, or anchor for the keyboard. Every row still reads, and navigates,
   with no script at all.

   **Esc is the reader's veto.** One window listener, alive only while the plate
   is up: it clears the subject, and because `pointerenter` fires on entering a
   row (not on moving inside one), the plate stays down until the reader names
   another row — by pointer or by tab.
   ========================================================================== */

/** Two digits: a register reference is a coordinate, not a count. */
const pad2 = (value: number) => String(value).padStart(2, '0')

/** The plate is a fine-pointer gesture: it needs a cursor to come to. */
const HOVER_QUERY = '(hover: hover) and (pointer: fine)'

/** The mark that replaces the plate under a thumb. */
const SEAL = 40

let hoverQuery: MediaQueryList | null = null

function canHover(): boolean {
  hoverQuery ??= window.matchMedia(HOVER_QUERY)
  return hoverQuery.matches
}

export default function Browse() {
  const { pick } = useLang()
  const copy = pick(browse)

  const [subject, setSubject] = useState<PlateSubject | null>(null)
  const [mode, setMode] = useState<'pointer' | 'anchor'>('pointer')

  const rootRef = useRef<HTMLElement | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const anchorRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const rig = initSectionRig(root)
    return () => rig.dispose()
  }, [])

  /* Alive only while there is something to dismiss: an Escape pressed on a
     sheet with no plate is none of this chapter's business. */
  useEffect(() => {
    if (!subject) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setSubject(null)
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [subject])

  /* The pointer names a row. Entering another row swaps the plate in place; the
     list's own `pointerleave` clears it, so crossing the gap between two rows
     never takes the plate down and back up. */
  const hover = (project: Project, index: number) => () => {
    if (!canHover()) return
    setMode('pointer')
    setSubject({ project, index })
  }

  /* The keyboard names a row too, and gets the anchored plate: no cursor to
     follow, so it hangs off the focused row's own rectangle. */
  const focus = (project: Project, index: number) => (event: FocusEvent<HTMLAnchorElement>) => {
    if (!canHover()) return
    anchorRef.current = event.currentTarget
    setMode('anchor')
    setSubject({ project, index })
  }

  /* A blur that lands on another row is that row's focus arriving: its handler
     owns the plate, so this one stays out of the way and nothing flickers. */
  const blur = (event: FocusEvent<HTMLAnchorElement>) => {
    const next = event.relatedTarget
    if (next instanceof Element && next.closest('.bx__row')) return
    setSubject(null)
  }

  const leave = () => {
    // A focused row keeps its plate: the reader is on it, not off it.
    if (listRef.current?.contains(document.activeElement)) return
    setSubject(null)
  }

  return (
    <section className="bx" id="index" data-ground="sunk" aria-labelledby="bx-title" ref={rootRef}>
      {/* The rig's registration tick, in the mark ink: the chapter's one accent
          at rest. Every other crimson on this band is a reply to the reader. */}
      <span className="rig-tick bx__mark" data-rig-tick aria-hidden="true" />

      <div className="bx__inner">
        <div className="bx__rail">
          <p className="bx__margin mono">index</p>

          {/* The reference and its measurement, written by the rig: the element
              is empty until there is a real number to print. */}
          <p className="bx__ref mono" aria-hidden="true">
            <span>#index</span>
            <span className="rig-coord" data-rig-coord="" />
          </p>
        </div>

        <SplitText as="h2" className="bx__title" id="bx-title" text={copy.title} reveal />

        <p className="bx__lead">{copy.lead}</p>

        <div className="bx__wall">
          {/* An instruction that is only true where there is a pointer to point
              with: the stylesheet prints it inside the hover query and nothing
              else has to ask. */}
          <p className="bx__hint mono">{copy.hint}</p>

          <ul className="bx__list" ref={listRef} onPointerLeave={leave}>
            {projects.map((project, position) => {
              const index = position + 1
              const domain = domains.find((entry) => entry.id === project.domain)

              return (
                <li className="bx__item" key={project.slug}>
                  <Link
                    to={'/work/' + project.slug}
                    className="bx__row"
                    onPointerEnter={hover(project, index)}
                    onFocus={focus(project, index)}
                    onBlur={blur}
                  >
                    <span className="bx__num mono">{`W.${pad2(index)}`}</span>
                    <span className="bx__name">{project.name}</span>
                    <span className="bx__domain mono">{domain ? pick(domain.label) : ''}</span>
                    {/* No plate under a thumb: the row carries the seal instead,
                        and the tap goes straight to the file. */}
                    <ProjectSeal slug={project.slug} size={SEAL} className="bx__seal" />
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>

        <footer className="bx__foot">
          <p className="bx__note">{copy.foot}</p>
          <Link to="/work" className="bx__all" data-hud="/work">
            {copy.openAll}
          </Link>
        </footer>
      </div>

      <PlatePop subject={subject} note={copy.plateNote} mode={mode} anchorRef={anchorRef} />
    </section>
  )
}

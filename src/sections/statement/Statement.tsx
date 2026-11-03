import { useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { gsap } from 'gsap'
import { useLang } from '../../lib/i18n'
import { MOTION, prefersReducedMotion, startsBelowFold } from '../../lib/reveal'
import { Link } from '../../lib/router'
import { statement } from '../../content/statement'
import type { StatementPart } from '../../content/statement'
import { projects } from '../../content/work'
import type { Project } from '../../content/work'
import ProjectSeal from '../../ui/ProjectSeal'
import PlatePop from '../shared/PlatePop'
import type { PlateSubject } from '../shared/PlatePop'
import './statement.css'

/* ============================================================================
   Statement — the chapter that is only a sentence
   ----------------------------------------------------------------------------
   Three lines at `--step-5` on the sheet's shallow-water band, with a margin
   label, a lead and a foot note. No title: the copy has none, so inventing an
   `<h2>` to hang `aria-labelledby` on would be copywriting by markup. The
   section is a `region` named by its own margin label (`aria-label`), which is
   the honest device; the alternative — a visually hidden heading repeating the
   first line — would lie about the document's structure.

   THE SENTENCE IS THREE BLOCKS. `copy.lines` is an array of arrays: each inner
   array is one authored printed line, and its parts concatenate with no added
   space (the copy already carries them, including the space that is missing
   between `l’` and `exploite` in French). So the line is walked part by part,
   each part split on its own whitespace runs, and adjacent ink is merged into
   one word — `l’` and `exploite` end up in the same mask, because a line may
   break between two adjacent inline-blocks and a French line must not end on
   `l’`. Nothing is retyped, normalised or joined with a space: the text content
   of the paragraph is exactly the copy.

   THE MASK DOES NOT HIDE THE TEXT. The words are real text nodes inside their
   clip boxes; nothing is duplicated into `.sr-only` and nothing is
   `aria-hidden`, so a screen reader reads one clean sentence and a selection
   drag takes the printed words. The stylesheet sets no `opacity` and no initial
   transform at all: the starting displacement (`yPercent: 100`) is written by
   GSAP in a layout effect, and only when the chapter is still below the fold
   and the reader allows motion. A reload inside the chapter, a reduced-motion
   reader and a script that never ran all leave the sentence printed — the
   failure mode is "no reveal", never "no text".
   `startsBelowFold` is the one helper this file borrows from `reveal.ts`; it is
   exported for this chapter and used unchanged.

   THE REVEAL. Words rise from behind their masks in reading order, one tempo:
   `MOTION.duration` and `MOTION.ease` from the sheet's table, 0.04s between
   words (a sentence prints with the pen travelling, not with forty equal
   pulses), triggered once at `top 78%`. `once: true` because a sentence is
   printed once: scrolling back up must not mask it again. The ScrollTrigger is
   the page's existing engine — no second rAF and no scroll listener here — and
   the whole tween lives in a `gsap.context` scoped to the section, reverted on
   unmount, because a language switch re-renders every word and a stale trigger
   would animate nodes that no longer exist.

   THE TWO DEVICES INSIDE THE TEXT, both from the copy:
   - `strong`: heavier (`--w-strong`) and one axis step under the plate width.
     On a wide, fine-pointer, motion-allowed sheet it relaxes to `--width-plate`
     under the pointer (140ms, the sheet's ease). `Rollover`'s character roll
     needs an `a`/`button` host and a strong word is not a link — the axis is the
     sheet's own word-level device, so it answers instead.
   - `plate`: the word is replaced visually by a 0.9em project plate — a real
     `<Link>` to `/work/<slug>` named by the word kept as `.sr-only` inside it.
     A slug missing from the register prints the word as plain text: a sentence
     must never contain a broken link.

   THE FLOATING PLATE. `PlatePop` is rendered once, at the section level, and
   driven by this component's state — not by the word. Two reasons: the pop must
   not live inside an `overflow: clip` mask (it would be cut), and it must not
   live inside a `<p>` (a block-level popover would close the paragraph in the
   parser). The word reports `pointer` on hover and `anchor` on focus, hands its
   own box to `anchorRef`, and clears on leave, blur and Escape.
   ========================================================================== */

/** The rhythm inside the sentence: one word every 40ms. */
const STAGGER = 0.04

/** The sentence counts as entered a little before its top reaches the middle. */
const START = 'top 78%'

/** How the floating plate is placed: under the pointer, or under the word. */
type PlateMode = 'pointer' | 'anchor'

/* --------------------------------------------------------------------------
   The sentence, split into what is printed and what only separates
   ------------------------------------------------------------------------ */

/** One styled stretch of ink: a whole word, or the half of one the copy bolds. */
type PrintRun = { text: string; strong: boolean }

type PrintWord = {
  /** The runs that make one *unbreakable* word, in order. */
  runs: PrintRun[]
  /** The project slug when the copy turns the whole word into a plate. */
  plate: string | null
}

/** A printed word, or the gap between two of them (real whitespace). */
type PrintPiece = { space: string } | { word: PrintWord }

/**
 * One authored line → its printed words and gaps, in order.
 *
 * The copy splits a word across two parts when only half of it is strong — the
 * French `l’` + `exploite` is one word in two runs. Concatenating first and
 * splitting on whitespace afterwards is what keeps them in the same mask: a
 * break between two adjacent inline-blocks is a legal line break, and a French
 * line must not end on `l’`.
 *
 * A plate is a word of its own: the seal cannot share a line box with ink, so
 * the current word is closed before it and the plate is emitted alone.
 */
function printPieces(parts: StatementPart[]): PrintPiece[] {
  const pieces: PrintPiece[] = []
  let word: PrintWord | null = null

  const flush = () => {
    if (!word) return
    pieces.push({ word })
    word = null
  }

  for (const part of parts) {
    const runs = part.text.match(/\s+|\S+/g) ?? []
    for (const run of runs) {
      if (/^\s/.test(run)) {
        flush()
        pieces.push({ space: run })
        continue
      }

      if (part.plate) {
        flush()
        pieces.push({ word: { runs: [{ text: run, strong: false }], plate: part.plate } })
        continue
      }

      if (!word) word = { runs: [], plate: null }
      word.runs.push({ text: run, strong: part.strong === true })
    }
  }

  flush()
  return pieces
}

/** The register's own numbering: a project's 1-based position in `projects`. */
function registerIndex(project: Project): number {
  return projects.indexOf(project) + 1
}

/* --------------------------------------------------------------------------
   The plate word
   ------------------------------------------------------------------------ */

type PlateWordProps = {
  /** The word itself, kept as the link's accessible name. */
  word: string
  project: Project
  index: number
  /** The word's own box, for the floating plate's anchor mode. */
  anchorRef: RefObject<HTMLSpanElement | null>
  onShow: (project: Project, index: number, mode: PlateMode) => void
  onHide: () => void
}

function PlateWord({ word, project, index, anchorRef, onShow, onHide }: PlateWordProps) {
  const href = '/work/' + project.slug

  return (
    <span className="st__mask st__mask--plate">
      <span
        className="st__plate-rise"
        data-st-word=""
        ref={anchorRef}
        onPointerEnter={(event) => {
          // A tap is a navigation, not a hover: only real pointers float the plate.
          if (event.pointerType !== 'touch') onShow(project, index, 'pointer')
        }}
        onPointerLeave={(event) => {
          // A focused word keeps its plate: the pointer leaving is not the reader
          // leaving the link.
          if (event.currentTarget.contains(document.activeElement)) return
          onHide()
        }}
        onFocus={() => onShow(project, index, 'anchor')}
        onBlur={onHide}
        onKeyDown={(event) => {
          if (event.key === 'Escape') onHide()
        }}
      >
        <Link to={href} className="st__plate" data-hud={href}>
          {/* The word is the sentence; the seal is its printed replacement. */}
          <span className="sr-only">{word}</span>
          <ProjectSeal slug={project.slug} size={96} className="st__seal" />
        </Link>
      </span>
    </span>
  )
}

/* --------------------------------------------------------------------------
   The chapter
   ------------------------------------------------------------------------ */

export default function Statement() {
  const { pick, lang } = useLang()
  const copy = pick(statement)
  const rootRef = useRef<HTMLElement | null>(null)

  const [plate, setPlate] = useState<PlateSubject | null>(null)
  const [plateMode, setPlateMode] = useState<PlateMode>('pointer')
  /* One float, one anchor: the sentence carries a single plate word today, and
     a second would hand the same pop its own box on focus. */
  const plateAnchor = useRef<HTMLSpanElement | null>(null)

  /* Keyed on the language: a switch replaces every word in the sentence, so the
     old spans (and their trigger) must be given back before the new ones are
     measured. */
  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (prefersReducedMotion() || !startsBelowFold(root)) return

    const words = gsap.utils.toArray<HTMLElement>('[data-st-word]', root)
    if (words.length === 0) return

    const ctx = gsap.context(() => {
      gsap.fromTo(
        words,
        { yPercent: 100 },
        {
          yPercent: 0,
          duration: MOTION.duration,
          ease: MOTION.ease,
          stagger: STAGGER,
          scrollTrigger: { trigger: root, start: START, once: true },
        },
      )
    }, root)

    return () => ctx.revert()
  }, [lang])

  const showPlate = (project: Project, index: number, mode: PlateMode) => {
    setPlateMode(mode)
    setPlate({ project, index })
  }

  const hidePlate = () => setPlate(null)

  return (
    <section
      className="st"
      id="statement"
      data-ground="chart"
      aria-label={copy.margin}
      ref={rootRef}
    >
      <div className="st__inner">
        <div className="st__rail">
          <p className="st__margin mono">{copy.margin}</p>
        </div>

        <div className="st__body">
          <p className="st__lead mono">{copy.lead}</p>

          {copy.lines.map((parts, lineIndex) => (
            <p className="st__line" key={lineIndex}>
              {printPieces(parts).map((piece, pieceIndex) => {
                if ('space' in piece) return piece.space

                const { runs, plate } = piece.word
                const project = plate
                  ? projects.find((entry) => entry.slug === plate)
                  : undefined

                // A plate whose slug is not in the register prints as the word:
                // the sentence is copy first and an interface second.
                if (project) {
                  return (
                    <PlateWord
                      key={pieceIndex}
                      word={runs.map((run) => run.text).join('')}
                      project={project}
                      index={registerIndex(project)}
                      anchorRef={plateAnchor}
                      onShow={showPlate}
                      onHide={hidePlate}
                    />
                  )
                }

                return (
                  <span className="st__mask" key={pieceIndex}>
                    <span className="st__word" data-st-word="">
                      {runs.map((run, runIndex) =>
                        run.strong ? (
                          <span className="st__strong" key={runIndex}>
                            {run.text}
                          </span>
                        ) : (
                          run.text
                        ),
                      )}
                    </span>
                  </span>
                )
              })}
            </p>
          ))}

          <p className="st__note mono">{copy.note}</p>
        </div>
      </div>

      {/* Outside the paragraphs on purpose: the plate floats over the sheet, not
          inside a clipped mask and not inside a `<p>`. */}
      <PlatePop subject={plate} note={copy.hint} mode={plateMode} anchorRef={plateAnchor} />
    </section>
  )
}

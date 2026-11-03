import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import { gsap } from 'gsap'
import { useLang } from '../lib/i18n'
import { Link } from '../lib/router'
import { getLenis } from '../lib/scroll'
import { effectiveReduced, setMotionReduced, systemReduced, useReducedMotion } from '../lib/motion'
import { MOTION } from '../lib/reveal'
import { chapters, navItems } from '../content/site'
import { projects } from '../content/work'
import { useSoundControl } from '../ui/useSoundControl'
import LangSwitch from '../ui/LangSwitch'

/* ============================================================================
   NavPanel — the index, and the only navigation on the sheet
   ----------------------------------------------------------------------------
   `#nav-index` is the whole map in four movements: the documents, the eight
   chapters of the cover, the twenty files of the register, and the plate (the
   three switches the bar prints in miniature). It is the same `.nav__panel`
   shell the small-screen index used — a plate that pushes down from the bar —
   promoted to every width now that the bar keeps no destinations of its own.

   **A dialog with a job.** `role="dialog"`, `aria-modal`, focus moved to the
   first document, a Tab cycle that closes at both ends, Escape and the scrim as
   the two ways out, and focus returned to the Index button on both. The page
   behind is locked by stopping the one scroll owner (`getLenis`) rather than by
   freezing the document: a stopped Lenis keeps the reader exactly where they
   were, and the panel's own scroll box is untouched. Where no engine exists
   (reduced motion), the document's overflow is the lock instead.

   **One timeline per move.** Opening wipes the plate down out of the bar
   (`clip-path`, 520ms, `power4.inOut`) while the rows rise out of their masks
   (60% → 0, 35ms apart). Closing drops them back and clips the plate up in
   320ms. A second open while the close is running kills the close first; there
   is never a queue. `effectiveReduced()` is asked at each move: no wipe, no
   stagger, instant final state — never a zero-duration animation.

   **The rows.** Every row is a hairline, and pointing at it draws the rule left
   to right, lifts the name six points on the width axis, and slides a 4px
   crimson tick out of the gutter. The tick lives inside the row's own inline
   padding so the mask that hides the entrance can never clip it.

   **The plate block** prints the three switches rather than inventing new ones:
   the sound row reads `useSoundControl` (the bar's store), the motion row reads
   and writes `lib/motion` (disabled while the system already asks for reduce),
   and the language pair is the same `LangSwitch` the bar prints, so a change in
   either place is already true in the other.
   ========================================================================== */

/** The wipe. One move, down from the bar. */
const WIPE = 0.52

/** A row's rise out of its mask. */
const ROW = 0.42

/** The closing move: the same picture backwards. */
const CLOSE = 0.32

/** Two digits: a plate reference is a coordinate, not a count. */
const pad2 = (value: number) => String(value).padStart(2, '0')

type NavPanelProps = {
  /** The plate is up. It stays mounted while false: the close needs a body. */
  open: boolean
  /** Every way out funnels here. `restore` puts the caret back on the button. */
  onClose: (restore?: boolean) => void
  /** The chapter under the reading line, on the cover; `null` elsewhere. */
  activeChapter: string | null
  /** The bar's own rule for `aria-current`, kept in one place. */
  isCurrent: (id: string, href: string, kind: 'route' | 'anchor') => 'page' | 'true' | undefined
}

export default function NavPanel({
  open,
  onClose,
  activeChapter,
  isCurrent,
}: NavPanelProps) {
  const { pick } = useLang()
  const reduced = useReducedMotion()
  const sound = useSoundControl()
  const panelRef = useRef<HTMLDivElement | null>(null)
  const move = useRef<gsap.core.Timeline | null>(null)
  const wasOpen = useRef(false)

  // A timeline outliving its panel would keep a ticker callback on a dead node.
  useEffect(
    () => () => {
      move.current?.kill()
      move.current = null
    },
    [],
  )

  /* The move. A transition of `open`, never a render: a language switch or a
     motion preference that re-renders the panel must not replay it. */
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    const masks = Array.from(panel.querySelectorAll<HTMLElement>('[data-nav-mask]'))
    const rows = Array.from(panel.querySelectorAll<HTMLElement>('[data-nav-row]'))
    const inBlock = (selector: string) =>
      Array.from(panel.querySelectorAll<HTMLElement>(`${selector} [data-nav-row]`))
    const blocks = [
      inBlock('.nav__panel-docs'),
      inBlock('.nav__panel-chapters'),
      inBlock('.nav__panel-projects'),
      inBlock('.nav__panel-plate'),
    ]
    const entering = open && !wasOpen.current
    const leaving = !open && wasOpen.current
    wasOpen.current = open

    move.current?.kill()
    move.current = null

    if (!entering && !leaving) return

    panel.scrollTop = 0

    if (effectiveReduced()) {
      gsap.set(panel, {
        visibility: open ? 'visible' : 'hidden',
        clipPath: open ? 'inset(0% 0% 0% 0%)' : 'inset(0% 0% 100% 0%)',
      })
      gsap.set(rows, { clearProps: 'transform' })
      masks.forEach((mask) => {
        mask.style.overflow = ''
      })

      return
    }

    if (entering) {
      // The rows are already in their start position before the plate is shown:
      // otherwise the first 160ms of the wipe would reveal them at rest.
      masks.forEach((mask) => {
        mask.style.overflow = 'hidden'
      })
      gsap.set(panel, { clipPath: 'inset(0% 0% 100% 0%)', visibility: 'visible' })
      gsap.set(rows, { yPercent: 60 })

      const tl = gsap.timeline({
        onComplete: () => {
          // Hand the masks back: once the entrance has landed the rows must be
          // able to paint their focus rings and gutter ticks outside the box.
          masks.forEach((mask) => {
            mask.style.overflow = ''
          })
          gsap.set(rows, { clearProps: 'transform' })
          move.current = null
        },
      })

      tl.to(panel, { clipPath: 'inset(0% 0% 0% 0%)', duration: WIPE, ease: 'power4.inOut' }, 0)

      // Four blocks read in order, each row 35ms behind the one above it. One
      // tween per block, not one for all 37 rows: the last project would
      // otherwise arrive nearly two seconds after the plate had opened.
      blocks.forEach((block, index) => {
        if (block.length === 0) return
        tl.to(
          block,
          { yPercent: 0, duration: ROW, ease: MOTION.ease, stagger: 0.035 },
          0.16 + index * 0.06,
        )
      })

      move.current = tl
      return
    }

    // Leaving: the picture backwards, rows first, plate second.
    const tl = gsap.timeline({
      onComplete: () => {
        gsap.set(panel, {
          visibility: 'hidden',
          clipPath: 'inset(0% 0% 100% 0%)',
        })
        gsap.set(rows, { clearProps: 'transform' })
        masks.forEach((mask) => {
          mask.style.overflow = ''
        })
        move.current = null
      },
    })

    tl.to(
      rows,
      { yPercent: 60, duration: 0.18, ease: 'power2.in', stagger: { each: 0.004, from: 'end' } },
      0,
    )
    tl.to(panel, { clipPath: 'inset(0% 0% 100% 0%)', duration: CLOSE, ease: 'power4.inOut' }, 0)

    move.current = tl
    return () => {
      move.current?.kill()
      move.current = null
    }
  }, [open])

  /* The dialog's contract: lock the page, move focus in, trap Tab at the two
     ends, and undo both on the way out. Focus is *not* restored here — a
     navigation must not steal it from the page that has just mounted. Escape and
     the scrim ask the bar to put it back. */
  useEffect(() => {
    if (!open) return

    const panel = panelRef.current
    if (!panel) return

    const lenis = getLenis()
    if (lenis) lenis.stop()
    else document.documentElement.style.overflow = 'hidden'

    const focusables = () =>
      Array.from(
        panel.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'),
      ).filter((node) => node.getClientRects().length > 0)

    // The plate's visibility is written by the motion effect in this same
    // commit. Reading the computed style in the same task can still see the
    // closed state, and a focus placed on a hidden node is dropped by the
    // browser a frame later — so the caret is moved once the frame that carries
    // the new visibility has been styled.
    const frame = requestAnimationFrame(() => {
      panel.scrollTop = 0
      focusables()[0]?.focus({ preventScroll: true })
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose(true)
        return
      }

      if (event.key !== 'Tab') return

      // Read the list at the moment Tab is pressed: the motion row leaves the
      // tab order when it is disabled, and a list captured at open would still
      // route through it.
      const items = focusables()
      if (items.length === 0) return

      const head = items[0]
      const tail = items[items.length - 1]
      const active = document.activeElement
      const inside = active instanceof Node && panel.contains(active)

      if (event.shiftKey) {
        if (!inside || active === head) {
          event.preventDefault()
          tail.focus()
        }
        return
      }

      if (!inside || active === tail) {
        event.preventDefault()
        head.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      cancelAnimationFrame(frame)
      document.removeEventListener('keydown', onKeyDown)
      if (lenis) lenis.start()
      else document.documentElement.style.overflow = ''
    }
  }, [open, onClose])

  /* A link is a way out *through the page*, so the lock is released before the
     router moves: `navigate()` positions the new plate synchronously (or after
     its reprint), and a document still frozen at `overflow: hidden` would
     swallow that jump. Capture runs before the link's own handler. */
  const releaseOnLink = (event: MouseEvent<HTMLDivElement>) => {
    // The router leaves every gesture but a plain left click to the browser; a
    // new tab keeps this plate open, so it must keep the page locked too.
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const target = event.target
    if (!(target instanceof Element)) return
    if (!target.closest('a[href]')) return
    const lenis = getLenis()
    if (lenis) lenis.start()
    else document.documentElement.style.overflow = ''
  }

  const id = 'nav-index'

  return (
    <>
      <div
        className="nav__scrim"
        data-nav-scrim=""
        aria-hidden="true"
        onPointerDown={(event) => {
          event.preventDefault()
          onClose(true)
        }}
      />

      <div
        className="nav__panel"
        id={id}
        ref={panelRef}
        role="dialog"
        aria-modal={open ? true : undefined}
        aria-label={pick({ en: 'Index', fr: 'Index' })}
        aria-hidden={open ? undefined : true}
        inert={!open || undefined}
        onClickCapture={releaseOnLink}
      >
        <div className="nav__panel-grid">
          <div className="nav__panel-block nav__panel-docs">
            <h2 className="nav__panel-label" id="nav-index-docs">
              {pick({ en: 'documents', fr: 'documents' })}
            </h2>
            <nav aria-labelledby="nav-index-docs">
              <ul>
                {navItems.map((item) => (
                  <li className="nav__mask" data-nav-mask="" key={item.id}>
                    <Link
                      className="nav__row nav__row--doc"
                      to={item.href}
                      aria-current={isCurrent(item.id, item.href, item.kind)}
                      data-nav-row=""
                    >
                      <span className="nav__row-tick" aria-hidden="true" />
                      <span className="nav__row-name">{pick(item.label)}</span>
                      <span className="nav__row-ref" aria-hidden="true">
                        {item.href}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="nav__panel-block nav__panel-chapters">
            <h2 className="nav__panel-label" id="nav-index-chapters">
              {pick({ en: 'chapters', fr: 'chapitres' })}
            </h2>
            <nav aria-labelledby="nav-index-chapters">
              <ul className="nav__chapters">
                {chapters.map((chapter, index) => (
                  <li className="nav__mask" data-nav-mask="" key={chapter.id}>
                    <Link
                      className="nav__row nav__row--chapter"
                      to={`/#${chapter.id}`}
                      aria-current={activeChapter === chapter.id ? 'true' : undefined}
                      data-nav-row=""
                    >
                      <span className="nav__row-tick" aria-hidden="true" />
                      <span className="nav__row-ref">{pad2(index + 1)}</span>{' '}
                      <span className="nav__row-name">{pick(chapter.label)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="nav__panel-block nav__panel-projects">
            <h2 className="nav__panel-label" id="nav-index-projects">
              {pick({ en: 'projects', fr: 'projets' })}
            </h2>
            <nav aria-labelledby="nav-index-projects">
              <ul className="nav__projects">
                {projects.map((project, index) => (
                  <li className="nav__mask" data-nav-mask="" key={project.slug}>
                    <Link
                      className="nav__row nav__row--project"
                      to={`/work/${project.slug}`}
                      aria-current={isCurrent(project.slug, `/work/${project.slug}`, 'route')}
                      data-nav-row=""
                    >
                      <span className="nav__row-tick" aria-hidden="true" />
                      <span className="nav__row-name">{project.name}</span>
                      <span className="nav__row-ref" aria-hidden="true">
                        W.{pad2(index + 1)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div className="nav__panel-block nav__panel-plate">
            <h2 className="nav__panel-label" id="nav-index-plate">
              {pick({ en: 'the plate', fr: 'la planche' })}
            </h2>
            <ul>
              <li className="nav__mask" data-nav-mask="">
                <button
                  type="button"
                  className="nav__row nav__row--plate"
                  aria-pressed={sound.enabled}
                  title={sound.hint}
                  onClick={sound.toggle}
                  data-nav-row=""
                >
                  <span className="nav__row-tick" aria-hidden="true" />
                  <span className="nav__row-name">{sound.label}</span>
                  <span className="nav__row-ref">{sound.value}</span>
                </button>
              </li>

              <li className="nav__mask" data-nav-mask="">
                <button
                  type="button"
                  className="nav__row nav__row--plate"
                  aria-pressed={reduced}
                  disabled={systemReduced()}
                  onClick={() => setMotionReduced(!reduced)}
                  title={
                    systemReduced()
                      ? pick({
                          en: 'Your system asks for less motion — this sheet follows it.',
                          fr: 'Votre système demande moins de mouvement — cette feuille le suit.',
                        })
                      : undefined
                  }
                  data-nav-row=""
                >
                  <span className="nav__row-tick" aria-hidden="true" />
                  <span className="nav__row-name">{pick({ en: 'Motion', fr: 'Mouvement' })}</span>
                  <span className="nav__row-ref">
                    {reduced
                      ? pick({ en: 'reduced', fr: 'réduit' })
                      : pick({ en: 'full', fr: 'complet' })}
                  </span>
                </button>
              </li>

              <li className="nav__mask" data-nav-mask="">
                <div className="nav__row nav__row--lang" data-nav-row="">
                  <span className="nav__row-name">{pick({ en: 'Language', fr: 'Langue' })}</span>
                  <LangSwitch variant="row" />
                </div>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </>
  )
}

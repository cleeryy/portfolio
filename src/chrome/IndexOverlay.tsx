import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { gsap } from 'gsap'
import { useLang } from '../lib/i18n'
import { Link } from '../lib/router'
import { lockScroll } from '../lib/scroll'
import { setMotionReduced, systemReduced, useReducedMotion } from '../lib/motion'
import { MOTION } from '../lib/reveal'
import { chapters, documents } from '../content/site'
import { projects } from '../content/work'
import { useSoundControl } from '../ui/SoundToggle'
import LangSwitch from '../ui/LangSwitch'
import './overlay.css'

/* ============================================================================
   IndexOverlay — the sheet, turned over
   ----------------------------------------------------------------------------
   Every destination the site has, on one plate: five documents at title size,
   the eight chapters of the cover with their plate numbers, the twenty files of
   the register in two columns, and the three switches the bar can no longer
   carry on a phone.

   **Where it sits, and why the bar keeps working.** The plate is a child of the
   `<header class="nav">`, fixed to the viewport, one layer *below* the bar's own
   row. So the header never has to be re-mounted or re-positioned: the mark, the
   reading and `Index` stay exactly where they are, the button that opened the
   plate is the button that closes it, and the surface is continuous because the
   header drops its own ground and border while the plate is up. The content
   starts below the bar's height, in its own scroll box, so a long index never
   slides under the bar's type.

   **A dialog, not a drawer.** `role="dialog"`, `aria-modal`, a real visible
   heading as its name, focus moved to the first document, `lockScroll` on the
   page behind, a focus trap that reads the panel's own focusables at the moment
   `Tab` is pressed (so a control that becomes unavailable is simply not in the
   cycle), Escape and an outside press as the two ways out, and the Index button
   as the place focus returns to — on every exit, including a navigation, since
   the bar persists across routes.

   **One timeline per move, killed on the next.** Opening wipes the plate in from
   the top-right corner and then raises the rows out of their masks; closing
   drops them and clips back to the corner in 320ms. Re-opening during a close
   kills the close rather than stacking a second timeline. Under reduced motion
   there is no wipe and no stagger: `gsap.set` prints the final state, never a
   zero-duration chain.

   **The rows are the micro-interaction.** A pointed-at or focused row draws a
   hairline left to right, lifts its name on the width axis (the sheet's own
   `--width-*` device), and slides a 4px crimson tick out of its gutter. All
   three are state changes — paint, not rhythm — and the reduced-motion block in
   `base.css` makes them instant rather than removing them.
   ========================================================================== */

/** The plate's wipe, in seconds. One move, from one corner. */
const WIPE = 0.52

/** A row's rise out of its mask. */
const ROW = 0.46

/** The twenty file rows are shorter and tighter: the entrance ends at ~1.1s. */
const FILE_ROW = 0.4

/** Closing, start to hidden. */
const CLOSE = 0.32

/** Two digits: a plate number is a coordinate, not a count. */
const pad2 = (value: number) => String(value).padStart(2, '0')

type IndexOverlayProps = {
  /** The plate is up. It stays mounted while false: the close needs a body. */
  open: boolean
  /** Every way out funnels here; the bar owns the state. */
  onClose: () => void
  /** The control that opened the plate — where focus goes back to. */
  triggerRef: RefObject<HTMLElement | null>
}

/** One masked line: the unit every entrance and every row shares. */
function RowLine({ label, num }: { label: string; num?: string }) {
  return (
    <span className="idx__mask">
      <span className="idx__line" data-idx-line="">
        {num ? (
          <>
            <span className="idx__num">{num}</span>
            {/* A space, so the accessible name is "02 selected work" and not
                "02selected work". The flex row drops the text node; the
                accessible-name computation keeps it. */}
            {' '}
          </>
        ) : null}
        <span className="idx__label">{label}</span>
      </span>
    </span>
  )
}

export default function IndexOverlay({ open, onClose, triggerRef }: IndexOverlayProps) {
  const { pick } = useLang()
  const reduced = useReducedMotion()
  const sound = useSoundControl()
  const rootRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const move = useRef<gsap.core.Timeline | null>(null)
  const wasOpen = useRef(false)

  /* The one move. `entering`/`leaving` are transitions of the `open` prop, not
     states: a re-run caused only by the motion preference must not replay the
     entrance (or the exit) that is already on screen. */
  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    const rows = (selector: string) => gsap.utils.toArray<HTMLElement>(selector, root)
    const docs = rows('.idx__docs [data-idx-line]')
    const plates = rows('.idx__chapters [data-idx-line]')
    const files = rows('.idx__files [data-idx-line]')
    const lines = [...docs, ...plates, ...files]
    const settings = root.querySelector<HTMLElement>('[data-idx-settings]')

    const entering = open && !wasOpen.current
    const leaving = !open && wasOpen.current
    wasOpen.current = open

    move.current?.kill()
    move.current = null

    if (!entering && !leaving) {
      if (!open) return

      // Still open: the only reason to be here again is a preference change, so
      // the plate is snapped to its resting state instead of replayed.
      gsap.set(root, { visibility: 'visible', clipPath: 'inset(0% 0% 0% 0%)' })
      gsap.set(lines, { clearProps: 'transform,opacity' })
      if (settings) gsap.set(settings, { clearProps: 'transform,opacity' })
      return
    }

    if (entering) {
      gsap.set(root, { visibility: 'visible' })

      if (reduced) {
        gsap.set(root, { clipPath: 'inset(0% 0% 0% 0%)' })
        gsap.set(lines, { clearProps: 'transform,opacity' })
        if (settings) gsap.set(settings, { clearProps: 'transform,opacity' })
        return
      }

      const tl = gsap.timeline({
        onComplete: () => {
          move.current = null
        },
      })

      tl.fromTo(
        root,
        { clipPath: 'inset(0% 0% 100% 100%)' },
        { clipPath: 'inset(0% 0% 0% 0%)', duration: WIPE, ease: 'power4.inOut' },
        0,
      )
      tl.fromTo(
        docs,
        { yPercent: 60, opacity: 1 },
        { yPercent: 0, duration: ROW, ease: MOTION.ease, stagger: 0.035 },
        0.16,
      )
      tl.fromTo(
        plates,
        { yPercent: 60, opacity: 1 },
        { yPercent: 0, duration: ROW, ease: MOTION.ease, stagger: 0.035 },
        0.24,
      )
      tl.fromTo(
        files,
        { yPercent: 60, opacity: 1 },
        { yPercent: 0, duration: FILE_ROW, ease: MOTION.ease, stagger: 0.016 },
        0.32,
      )
      if (settings) {
        tl.fromTo(
          settings,
          { y: 14, opacity: 0 },
          { y: 0, opacity: 1, duration: 0.4, ease: MOTION.ease },
          0.6,
        )
      }

      move.current = tl
      return
    }

    // Leaving.
    if (reduced) {
      gsap.set(root, { visibility: 'hidden', clipPath: 'inset(0% 0% 0% 0%)' })
      gsap.set(lines, { clearProps: 'transform,opacity' })
      if (settings) gsap.set(settings, { clearProps: 'transform,opacity' })
      return
    }

    const tl = gsap.timeline({
      onComplete: () => {
        // Hidden, and handed back to the stylesheet: no inline clip survives to
        // the next opening.
        gsap.set(root, { visibility: 'hidden' })
        gsap.set(root, { clipPath: 'inset(0% 0% 0% 0%)' })
        gsap.set(lines, { clearProps: 'transform,opacity' })
        if (settings) gsap.set(settings, { clearProps: 'transform,opacity' })
        move.current = null
      },
    })

    tl.to(
      lines,
      {
        yPercent: 42,
        opacity: 0,
        duration: 0.18,
        ease: MOTION.ease,
        stagger: { each: 0.004, from: 'end' },
      },
      0,
    )
    if (settings) tl.to(settings, { y: 10, opacity: 0, duration: 0.16, ease: MOTION.ease }, 0)
    tl.to(
      root,
      { clipPath: 'inset(0% 0% 100% 100%)', duration: CLOSE, ease: 'power3.in' },
      0,
    )

    move.current = tl
  }, [open, reduced])

  // A move that outlives the plate is a tween writing to a detached node.
  useEffect(
    () => () => {
      move.current?.kill()
      move.current = null
    },
    [],
  )

  /* The dialog's contract: lock the page, move focus in, trap Tab at the two
     ends, and undo all three on the way out.

     The focusables are read *at the moment Tab is pressed*, and only the two
     boundaries are intercepted — inside the panel, Tab is native. That matters
     because the motion row disables itself while the system asks for stillness:
     a list captured at open would send the cycle through a control that is no
     longer in the tab order. */
  useEffect(() => {
    if (!open) return

    const root = rootRef.current
    if (!root) return

    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null
    // Read once, at open: the button persists across routes, so this is the
    // element the caret goes back to whatever closed the plate.
    const trigger = triggerRef.current

    lockScroll(true)

    const focusables = () =>
      Array.from(
        root.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((node) => node.getClientRects().length > 0)

    // The plate always opens at its head. A reader who tabbed to the last file
    // last time left the scroll box at the bottom, and the heading — the dialog's
    // own name — would be the first thing off screen. The focus move below is
    // told not to scroll, or it would undo this immediately: the first link sits
    // under the head, and bringing it "into view" means pushing the head out.
    const scroller = root.querySelector<HTMLElement>('.idx__scroll')
    if (scroller) scroller.scrollTop = 0
    focusables()[0]?.focus({ preventScroll: true })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return

      const items = focusables()
      if (items.length === 0) return

      const head = items[0]
      const tail = items[items.length - 1]
      const current = document.activeElement
      const inside = current instanceof Node && root.contains(current)

      if (event.shiftKey) {
        if (!inside || current === head) {
          event.preventDefault()
          tail.focus()
        }
        return
      }

      if (!inside || current === tail) {
        event.preventDefault()
        head.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      lockScroll(false)
      // The bar persists across routes, so the control that opened the plate is
      // always the honest place to put the caret back.
      const target = trigger ?? before
      target?.focus()
    }
  }, [open, triggerRef])

  /* A press on the deep ground closes; a press inside the content column is the
     content's business. `event.target` containment, never a coordinate test: the
     plate scrolls, so a rectangle measured at open would be a lie by the time
     the reader presses. A press on the bar itself is not a dismissal — the
     sound plate and the language pair live up there. */
  useEffect(() => {
    if (!open) return

    const root = rootRef.current
    if (!root) return

    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (!root.contains(event.target)) return
      if (contentRef.current?.contains(event.target)) return

      // The press is a dismissal, not a selection: keep the browser from moving
      // focus to the ground we are about to hide.
      event.preventDefault()
      onClose()
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, onClose])

  const locked = systemReduced()

  return (
    <div
      className="idx on-deep"
      id="sheet-index"
      role="dialog"
      aria-modal="true"
      aria-labelledby="idx-title"
      ref={rootRef}
      inert={!open || undefined}
    >
      <div className="idx__scroll">
        <div className="idx__sheet" ref={contentRef}>
          <div className="idx__head">
            <p className="idx__kicker">{pick({ en: 'sheet index', fr: 'index de la feuille' })}</p>
            <h2 className="idx__title" id="idx-title">
              Index
            </h2>
          </div>

          <div className="idx__body">
            <nav className="idx__docs" aria-label={pick({ en: 'Documents', fr: 'Documents' })}>
              {documents.map((doc) => (
                <Link key={doc.id} className="idx__row idx__row--doc" to={doc.href}>
                  <span className="idx__tick" aria-hidden="true" />
                  <RowLine label={pick(doc.label)} />
                </Link>
              ))}
            </nav>

            <nav
              className="idx__chapters"
              aria-label={pick({ en: 'Chapters', fr: 'Chapitres' })}
            >
              {chapters.map((chapter, index) => (
                <Link
                  key={chapter.id}
                  className="idx__row idx__row--chapter"
                  to={`/#${chapter.id}`}
                >
                  <span className="idx__tick" aria-hidden="true" />
                  <RowLine label={pick(chapter.label)} num={pad2(index + 1)} />
                </Link>
              ))}
            </nav>
          </div>

          <nav
            className="idx__files"
            aria-label={pick({ en: 'Project files', fr: 'Fiches projets' })}
          >
            <p className="idx__kicker idx__files-head">
              <span>{pick({ en: 'the register', fr: 'le registre' })}</span>
              <span className="idx__files-count">{pad2(projects.length)}</span>
            </p>
            {projects.map((project) => (
              <Link
                key={project.slug}
                className="idx__row idx__row--file"
                to={`/work/${project.slug}`}
              >
                <span className="idx__tick" aria-hidden="true" />
                <RowLine label={project.name} />
              </Link>
            ))}
          </nav>

          <div
            className="idx__settings"
            data-idx-settings=""
            role="group"
            aria-label={pick({ en: 'Settings', fr: 'Réglages' })}
          >
            <button
              type="button"
              className="idx__setting"
              data-no-cue=""
              aria-pressed={sound.enabled}
              onClick={sound.toggle}
              title={sound.hint}
            >
              <span className="idx__setting-key">{sound.label}</span>
              <span className="idx__setting-val">{sound.value}</span>
            </button>

            <button
              type="button"
              className="idx__setting"
              aria-pressed={reduced}
              disabled={locked}
              onClick={() => setMotionReduced(!reduced)}
              title={
                locked
                  ? pick({
                      en: 'Your system asks for less motion — this sheet follows it.',
                      fr: 'Votre système demande moins de mouvement — cette feuille le suit.',
                    })
                  : undefined
              }
            >
              <span className="idx__setting-key">{pick({ en: 'Motion', fr: 'Mouvement' })}</span>
              <span className="idx__setting-val">
                {reduced
                  ? pick({ en: 'reduced', fr: 'réduit' })
                  : pick({ en: 'full', fr: 'complet' })}
              </span>
            </button>

            <div className="idx__setting idx__setting--lang">
              <span className="idx__setting-key">{pick({ en: 'Language', fr: 'Langue' })}</span>
              <LangSwitch variant="row" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

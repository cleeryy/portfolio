import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { useLang } from '../lib/i18n'
import { Link, useRoute } from '../lib/router'
import { handle } from '../content/cover'
import { chapters, homeSections, missingReading, routeReading } from '../content/site'
import { projectBySlug } from '../content/work'
import { observeCurrentSection } from '../lib/currentSection'
import { useReducedMotion } from '../lib/motion'
import { MOTION } from '../lib/reveal'
import { RolloverLabel } from '../ui/Rollover'
import SoundToggle from '../ui/SoundToggle'
import LangSwitch from '../ui/LangSwitch'
import IndexOverlay from './IndexOverlay'
import './nav.css'

/* ============================================================================
   NavBar — the collar of the sheet
   ----------------------------------------------------------------------------
   Three controls and one reading. The mark walks home; the reading says where
   the reader is; `Index` opens the plate that holds every destination. The six
   text links and the push-down panel are gone: a fixed edge that lists six
   places is a menu bar, and this sheet is not an application.

   **The reading is the point.** It is not a link and not a menu label: it is a
   measurement of the plate under the reading line, printed in the mono face
   with tabular figures, the same way the margin chrome prints a plate number.
   On the cover it reads `<chapter> · 02/08`; on a document it reads the
   document's own name and no number, because a route is not a plate of the
   cover and counting it in eighths would be a measurement of nothing.

   How it is written, and why two of the three parts are imperative:

   - **The number is GSAP's.** It changes on scroll, and a React re-render can
     land in the middle of the flip — the same hazard `Rollover` solved by
     owning its own timeline. Two stacked layers move inside a mask exactly one
     line tall (180ms), and when the move lands the box is reduced to a single
     text node, so the resting DOM is plain text and a later render has nothing
     to reconcile.
   - **The name is React's.** It is a text node the sheet owns, and the departing
     copy is a ghost created for 160ms: the old line lifts out of the mask while
     the new one rises in. Language and route changes therefore print the right
     word even if they arrive mid-move.
   - **Reduced motion is the same answer, printed at once.** No flip, no
     cross-fade, no ghost: the state changes and nothing travels.

   Two notions of "where", and only two: the chapter crossing the reading line
   (measured by the same `observeCurrentSection` the margin chrome uses — never
   a second observer), and the route the router has already resolved. A hash
   anchor on another page is still a route: the bar reads the document it is on,
   not the destination in its address.

   On a phone the bar keeps the mark, the reading and `Index`. The language pair
   and the sound plate are not dropped from the site — they move into the index
   plate (`IndexOverlay`), where a thumb can reach them and they have room to
   say what they are.
   ========================================================================== */

/** Two digits: a plate number is a coordinate, not a count. */
const pad2 = (value: number) => String(value).padStart(2, '0')

/** The flip, in seconds. One plate number is a short move, not an entrance. */
const FLIP = 0.18

/** The cross-fade of the name: shorter than the number, because it is text. */
const FADE = 0.16

type ReadingProps = {
  /** The chapter or document under the reading line. */
  name: string
  /** `02/08` on the cover; `null` on a document. */
  number: string | null
}

function Reading({ name, number }: ReadingProps) {
  const reduced = useReducedMotion()
  const nameBox = useRef<HTMLSpanElement | null>(null)
  const nameLine = useRef<HTMLSpanElement | null>(null)
  const numBox = useRef<HTMLSpanElement | null>(null)
  const shownName = useRef<string | null>(null)
  const shownNumber = useRef<string | null>(null)
  const nameMove = useRef<gsap.core.Timeline | null>(null)
  const numberMove = useRef<gsap.core.Timeline | null>(null)

  /* The name: one React text node in flow, one ghost for the 160ms it takes to
     leave. The ghost is a decoration (aria-hidden), so dropping it is the whole
     cleanup — there is no state to reconcile and no second source of truth. */
  useLayoutEffect(() => {
    const box = nameBox.current
    const line = nameLine.current
    if (!box || !line) return

    const previous = shownName.current
    shownName.current = name

    // Every new value ends the previous move — including a preference that
    // flipped mid-flight. The ghost is the only thing a tween owns, so dropping
    // it is the whole cleanup: there is no state to reconcile.
    nameMove.current?.kill()
    nameMove.current = null
    box.querySelector('.nav__read-out')?.remove()
    gsap.set(line, { clearProps: 'transform,opacity' })

    // Reduced motion, a first value, or the same word: print it and stop.
    if (reduced || previous === null || previous === name) return

    const ghost = document.createElement('span')
    ghost.className = 'nav__read-out'
    ghost.setAttribute('aria-hidden', 'true')
    ghost.textContent = previous
    box.appendChild(ghost)

    const tl = gsap.timeline({
      onComplete: () => {
        ghost.remove()
        gsap.set(line, { clearProps: 'transform,opacity' })
        nameMove.current = null
      },
    })

    tl.fromTo(
      ghost,
      { yPercent: 0, opacity: 1 },
      { yPercent: -60, opacity: 0, duration: FADE, ease: MOTION.ease },
      0,
    )
    tl.fromTo(
      line,
      { yPercent: 55, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: FADE, ease: MOTION.ease },
      0,
    )

    nameMove.current = tl
  }, [name, reduced])

  /* The number: two layers inside a 1em mask, then one clean text node. */
  useLayoutEffect(() => {
    const box = numBox.current

    if (!box) {
      // A document prints no number; the next cover starts from a clean box.
      numberMove.current?.kill()
      numberMove.current = null
      shownNumber.current = null
      return
    }

    if (number === null) return

    const previous = shownNumber.current
    shownNumber.current = number

    if (reduced || previous === null || previous === number) {
      numberMove.current?.kill()
      numberMove.current = null
      box.textContent = number
      return
    }

    numberMove.current?.kill()
    numberMove.current = null

    const out = document.createElement('span')
    out.className = 'nav__read-flip'
    // The departing number is a picture of the last reading: AT keeps the one
    // value the box is actually showing.
    out.setAttribute('aria-hidden', 'true')
    out.textContent = previous
    const incoming = document.createElement('span')
    incoming.className = 'nav__read-flip'
    incoming.textContent = number
    box.replaceChildren(out, incoming)

    const tl = gsap.timeline({
      onComplete: () => {
        box.textContent = number
        numberMove.current = null
      },
    })

    tl.fromTo(
      out,
      { yPercent: 0, opacity: 1 },
      { yPercent: -100, opacity: 0, duration: FLIP, ease: MOTION.ease },
      0,
    )
    tl.fromTo(
      incoming,
      { yPercent: 100, opacity: 0 },
      { yPercent: 0, opacity: 1, duration: FLIP, ease: MOTION.ease },
      0,
    )

    numberMove.current = tl
  }, [number, reduced])

  // An unmount mid-move must not leave a ticker callback targeting a dead node.
  useEffect(
    () => () => {
      nameMove.current?.kill()
      numberMove.current?.kill()
    },
    [],
  )

  return (
    <p className="nav__read">
      <span className="nav__read-name" ref={nameBox}>
        <span className="nav__read-in" ref={nameLine}>
          {name}
        </span>
      </span>
      {number === null ? null : (
        <>
          <span className="nav__read-sep">{'\u00a0·\u00a0'}</span>
          <span className="nav__read-num" ref={numBox} />
        </>
      )}
    </p>
  )
}

export default function NavBar() {
  const { pick } = useLang()
  const route = useRoute()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<{ path: string; id: string | null } | null>(null)
  const toggleRef = useRef<HTMLButtonElement | null>(null)

  const home = route.path === '/'

  /* Compact the bar once the sheet has moved under it. */
  useEffect(() => {
    let frame = 0
    const apply = () => {
      frame = 0
      setScrolled(window.scrollY > 8)
    }
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(apply)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    apply()
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [])

  /* The chapter crossing the middle of the viewport — the same measurement the
     margin chrome prints, from the same helper: `homeSections` is the sheet's
     table, and no second observer exists for the bar alone. Re-run on a route
     change, because the targets are remounted with the page. */
  useEffect(() => {
    if (route.path !== '/') return
    return observeCurrentSection(homeSections, (id) => setActive({ path: route.path, id }))
  }, [route.path])

  /* The reading belongs to the path it was measured on: a stale id from a
     previous visit to the cover never names a chapter on the next one. */
  const measured = active?.path === route.path ? active.id : null
  const chapterIndex = Math.max(0, measured ? homeSections.indexOf(measured) : -1)

  const project = route.params.slug ? projectBySlug(route.params.slug) : undefined

  const documentName = project
    ? project.name
    : route.path === '/work'
      ? pick(routeReading.work)
      : route.path === '/notes'
        ? pick(routeReading.notes)
        : route.path === '/practice'
          ? pick(routeReading.practice)
          : route.path === '/about'
            ? pick(routeReading.about)
            : pick(missingReading)

  const readingName = home ? pick(chapters[chapterIndex].label) : documentName
  const readingNumber = home
    ? `${pad2(chapterIndex + 1)}/${pad2(homeSections.length)}`
    : null

  /* One close path for every way out, so the plate never has to know which one
     happened. */
  const close = useCallback(() => setOpen(false), [])

  /* Escape closes the plate. The bar owns the key because it owns the state;
     the dialog owns the trap, the lock and the focus it moved. */
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  /* An internal navigation is a way out. The router announces its own moves
     (`portfolio:navigate` on `document`, a non-bubbling CustomEvent) and a
     browser back/forward is the other one. */
  useEffect(() => {
    const shut = () => setOpen(false)
    document.addEventListener('portfolio:navigate', shut)
    window.addEventListener('popstate', shut)
    return () => {
      document.removeEventListener('portfolio:navigate', shut)
      window.removeEventListener('popstate', shut)
    }
  }, [])

  return (
    <header
      className="nav"
      data-scrolled={scrolled ? 'true' : 'false'}
      data-open={open ? 'true' : 'false'}
    >
      <div className="nav__inner">
        <Link to="/" className="nav__brand" data-hud="/">
          <RolloverLabel text={handle} />
        </Link>

        <Reading name={readingName} number={readingNumber} />

        <div className="nav__tools">
          <button
            type="button"
            className="nav__index"
            ref={toggleRef}
            aria-expanded={open}
            aria-controls="sheet-index"
            onClick={() => setOpen((value) => !value)}
          >
            <RolloverLabel text={open ? pick({ en: 'Close', fr: 'Fermer' }) : pick({ en: 'Index', fr: 'Index' })} />
            <span className="nav__index-sign" aria-hidden="true" />
          </button>

          <LangSwitch className="nav__lang" />
          <SoundToggle className="nav__sound" />
        </div>
      </div>

      <IndexOverlay open={open} onClose={close} triggerRef={toggleRef} />
    </header>
  )
}

import { useCallback, useEffect, useRef, useState } from 'react'
import { useLang } from '../lib/i18n'
import { Link, useRoute } from '../lib/router'
import { handle } from '../content/cover'
import { chapters, homeSections, missingReading, routeReading } from '../content/site'
import { projectBySlug } from '../content/work'
import { observeCurrentSection } from '../lib/currentSection'
import { RolloverLabel } from '../ui/Rollover'
import SoundToggle from '../ui/SoundToggle'
import LangSwitch from '../ui/LangSwitch'
import NavReading from './NavReading'
import NavPanel from './NavPanel'
import './nav.css'

/* ============================================================================
   NavBar — the collar of the sheet
   ----------------------------------------------------------------------------
   Three controls and one reading. The mark walks home; the reading says where
   the reader is; `Index` opens the plate that holds every destination. The six
   text links are gone: a fixed edge that lists six places is a menu bar, and
   this sheet is not an application.

   **The reading is the point.** It is the chapter under the reading line and its
   plate number (`territory · 05/08`), or the document's own name on a route
   (`the register`) with no number, because a route is not a plate of the cover.
   It is a link to the register, so the reading is an address, not a decoration.

   Two notions of "where", and only two: the chapter crossing the reading line,
   measured by the same `observeCurrentSection` the margin chrome uses (never a
   second observer), and the route the router has already resolved. A hash
   anchor on another page is still a route: the bar reads the document it is
   on, not the destination in its address. `aria-current` remains the nav's own
   answer, and it is printed only where it is known: a route is `page` on its
   own path (and, for `/work`, under it), a chapter is `true` only on the cover,
   only while it crosses the reading line.

   The panel owns the dialog: the trap, the scroll lock, the focus it moves in.
   The bar owns the state and the two exits that are not a navigation — Escape
   and the scrim — and puts the caret back on the button for both.
   ========================================================================== */

/** Two digits: a plate number is a coordinate, not a count. */
const pad2 = (value: number) => String(value).padStart(2, '0')

/** `/work` is current on `/work` and on every `/work/:slug` file under it. */
const onRoute = (path: string, href: string) => path === href || path.startsWith(`${href}/`)

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

  /* Mark the home section crossing the middle of the viewport. The observer
     reads all eight chapters from the site table and reports the id; the panel
     marks the same chapter, and the reading names it. Re-run when the route
     changes, since the targets are remounted with the page. */
  useEffect(() => {
    if (route.path !== '/') return
    return observeCurrentSection(homeSections, (id) => setActive({ path: route.path, id }))
  }, [route.path])

  /* The reading belongs to the path it was measured on: a stale id from a
     previous visit to the cover never names a chapter on the next one. */
  const measured = active?.path === route.path ? active.id : null
  const chapterIndex = Math.max(0, measured ? homeSections.indexOf(measured) : -1)
  const chapter = chapters[chapterIndex]

  const project = route.params.slug ? projectBySlug(route.params.slug) : undefined

  let documentName: string
  if (route.path === '/work') documentName = pick(routeReading.work)
  else if (route.path === '/notes') documentName = pick(routeReading.notes)
  else if (route.path === '/practice') documentName = pick(routeReading.practice)
  else if (route.path === '/about') documentName = pick(routeReading.about)
  else if (project) documentName = project.name
  else documentName = pick(missingReading)

  const readingName = home ? pick(chapter.label) : documentName
  const readingNumber = home
    ? `${pad2(chapterIndex + 1)}/${pad2(homeSections.length)}`
    : null
  const readingLive = readingNumber ? `${readingName} · ${readingNumber}` : readingName

  /* The nav's one `aria-current` rule, shared with the panel. */
  const isCurrent = (id: string, href: string, kind: 'route' | 'anchor') => {
    if (kind === 'route') return onRoute(route.path, href) ? ('page' as const) : undefined
    return home && measured === id ? ('true' as const) : undefined
  }

  /* One close path for every way out. `restore` is the two exits that are not a
     navigation: the caret belongs back on the button that opened the plate. */
  const close = useCallback((restore = false) => {
    setOpen(false)
    if (restore) requestAnimationFrame(() => toggleRef.current?.focus())
  }, [])

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
    <header className="nav" data-scrolled={scrolled ? 'true' : 'false'} data-open={open ? 'true' : 'false'}>
      <div className="nav__inner">
        <Link to="/" className="nav__brand" data-hud="/">
          <RolloverLabel text={handle} />
        </Link>

        <NavReading
          name={readingName}
          number={readingNumber}
          to={home ? '#index' : route.path}
          live={readingLive}
        />

        <div className="nav__tools">
          <button
            type="button"
            className="nav__index"
            ref={toggleRef}
            aria-expanded={open}
            aria-controls="nav-index"
            aria-label={
              open
                ? pick({ en: 'Close the index', fr: "Fermer l'index" })
                : pick({ en: 'Open the index', fr: "Ouvrir l'index" })
            }
            onClick={() => setOpen((value) => !value)}
          >
            <span className="nav__index-label">{pick({ en: 'Index', fr: 'Index' })}</span>
            <span className="nav__index-sign" aria-hidden="true" />
          </button>

          <LangSwitch className="nav__lang" />
          <SoundToggle className="nav__sound" />
        </div>
      </div>

      <NavPanel
        open={open}
        onClose={close}
        activeChapter={home ? measured : null}
        isCurrent={isCurrent}
      />
    </header>
  )
}

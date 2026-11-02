import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../lib/i18n'
import { Link, useRoute } from '../../lib/router'
import { handle } from '../../content/hero'
import { navItems } from '../../content/site'
import { RolloverLabel } from '../ui/Rollover'
import SoundToggle from '../ui/SoundToggle'
import './nav.css'

/* ============================================================================
   NavBar — the collar of the sheet
   ----------------------------------------------------------------------------
   Five destinations, in reading order: three routes (`/work`, `/notes`,
   `/about`) and the two home anchors that must work from any page
   (`/#territory`, `/#contact`).

   Two notions of "current", and only two:

   - a route marks itself `aria-current="page"` whenever the path is its own
     (and, for `/work`, any file under it);
   - an anchor is `aria-current="true"` only on the cover, while the section it
     names crosses the middle line of the viewport. On every other route no
     anchor is current, and the observer is not even installed.

   The item list is `navItems` in `src/content/site.ts` — never a second copy
   here, and never a hardcoded path.
   ========================================================================== */

/** The home anchors, derived from the one nav table. */
const ANCHORS = navItems.filter((item) => item.kind === 'anchor')

/** `/work` is current on `/work` and on every `/work/:slug` file under it. */
const onRoute = (path: string, href: string) => path === href || path.startsWith(`${href}/`)

export default function NavBar() {
  const { lang, setLang, pick } = useLang()
  const route = useRoute()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<string | null>(null)
  const rootRef = useRef<HTMLElement | null>(null)
  const toggleRef = useRef<HTMLButtonElement | null>(null)

  const home = route.path === '/'

  const current = (id: string, href: string, kind: 'route' | 'anchor'): 'page' | 'true' | undefined => {
    if (kind === 'route') return onRoute(route.path, href) ? 'page' : undefined
    return home && active === id ? 'true' : undefined
  }

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

  /* Mark the anchor section crossing the middle of the viewport.
     A rect test, not an IntersectionObserver: the observer latch kept the last
     section marked after scrolling back to the cover, where no section ever
     re-enters the band. This reads the geometry, so it can also return null.
     The reader has to be on the cover: an anchor names a place on that page and
     nowhere else. Re-run when the route changes, since the targets are remounted
     with the page. */
  useEffect(() => {
    const clear = () => setActive(null)
    if (route.path !== '/') {
      clear()
      return
    }

    const targets = ANCHORS.map((item) => document.getElementById(item.id)).filter(
      (node): node is HTMLElement => node !== null,
    )
    if (targets.length === 0) {
      clear()
      return
    }

    let frame = 0
    const apply = () => {
      frame = 0
      const line = window.innerHeight * 0.5
      let id: string | null = null
      for (const node of targets) {
        const rect = node.getBoundingClientRect()
        if (rect.top <= line && rect.bottom > line) {
          id = node.id
          break
        }
      }
      if (!id) {
        for (const node of targets) {
          if (node.getBoundingClientRect().top <= line) id = node.id
        }
      }
      setActive(id)
    }
    const onScroll = () => {
      if (frame === 0) frame = requestAnimationFrame(apply)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    apply()
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (frame !== 0) cancelAnimationFrame(frame)
    }
  }, [route.path])

  /* Panel behaviour: close on Escape (returning focus to the control), on a
     pointer press outside, or on navigation. No scroll lock: it is an index,
     not a takeover. */
  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      toggleRef.current?.focus()
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Node)) return
      if (!rootRef.current?.contains(event.target)) setOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  /* A route change closes the index: the router announces its own navigations
     (`portfolio:navigate` on `document`, not window — it is a non-bubbling
     CustomEvent), and a browser back/forward (`popstate`) is the other way off
     the page. */
  useEffect(() => {
    const close = () => setOpen(false)
    document.addEventListener('portfolio:navigate', close)
    window.addEventListener('popstate', close)
    return () => {
      document.removeEventListener('portfolio:navigate', close)
      window.removeEventListener('popstate', close)
    }
  }, [])

  return (
    <header className="nav" data-scrolled={scrolled ? 'true' : 'false'} data-open={open ? 'true' : 'false'} ref={rootRef}>
      <div className="nav__inner">
        <Link to="/" className="nav__brand" data-hud="/">
          <RolloverLabel text={handle} />
        </Link>

        <nav className="nav__links" aria-label={pick({ en: 'Navigation', fr: 'Navigation' })}>
          {navItems.map((item) => (
            <Link
              className="nav__link"
              key={item.id}
              to={item.href}
              aria-current={current(item.id, item.href, item.kind)}
            >
              <RolloverLabel text={pick(item.label)} />
            </Link>
          ))}
        </nav>

        <div className="nav__tools">
          <div className="nav__lang" role="group" aria-label={pick({ en: 'Language', fr: 'Langue' })}>
            <button
              type="button"
              className="nav__lang-btn"
              lang="en"
              aria-pressed={lang === 'en'}
              onClick={() => setLang('en')}
            >
              EN
            </button>
            <button
              type="button"
              className="nav__lang-btn"
              lang="fr"
              aria-pressed={lang === 'fr'}
              onClick={() => setLang('fr')}
            >
              FR
            </button>
          </div>

          <SoundToggle className="nav__sound" />

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
        </div>
      </div>

      <div className="nav__panel" id="nav-index" inert={!open || undefined}>
        <nav aria-label={pick({ en: 'Index', fr: 'Index' })}>
          <ul className="nav__panel-list">
            {navItems.map((item) => (
              <li key={item.id}>
                <Link
                  className="nav__panel-link"
                  to={item.href}
                  aria-current={current(item.id, item.href, item.kind)}
                  onClick={() => setOpen(false)}
                >
                  <span>{pick(item.label)}</span>
                  <span className="nav__panel-ref" aria-hidden="true">
                    {item.href}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}

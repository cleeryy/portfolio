import { useEffect, useRef, useState } from 'react'
import { useLang } from '../../lib/i18n'
import { Link, useRoute } from '../../lib/router'
import { handle } from '../../content/hero'
import { homeSections, navItems } from '../../content/site'
import { observeCurrentSection } from '../../lib/currentSection'
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

   The section observer reads every home section, not only the anchors: when
   the reader is in `#flight` or `#operator` — chapters no destination names —
   no item is marked. The old test kept the last anchor it had passed, so a red
   rule claimed the reader was in Territory while the operator chapter was on
   screen. `aria-current` is an answer, never a guess.

   The item list is `navItems` in `src/content/site.ts` — never a second copy
   here, and never a hardcoded path.
   ========================================================================== */

/** `/work` is current on `/work` and on every `/work/:slug` file under it. */
const onRoute = (path: string, href: string) => path === href || path.startsWith(`${href}/`)

export default function NavBar() {
  const { lang, setLang, pick } = useLang()
  const route = useRoute()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<{ path: string; id: string | null } | null>(null)
  const rootRef = useRef<HTMLElement | null>(null)
  const toggleRef = useRef<HTMLButtonElement | null>(null)

  const home = route.path === '/'

  const current = (id: string, href: string, kind: 'route' | 'anchor'): 'page' | 'true' | undefined => {
    if (kind === 'route') return onRoute(route.path, href) ? 'page' : undefined
    // The reading belongs to the path it was measured on: a stale id from a
    // previous visit to the cover never marks an anchor on the next one.
    const measured = active?.path === route.path ? active.id : null
    return home && measured === id ? 'true' : undefined
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

  /* Mark the home section crossing the middle of the viewport.
     The observer reads all six sections from the site table, and the answer is
     the section's own id; `current()` then marks an anchor only when that id is
     the destination it names. A chapter with no destination (`#flight`,
     `#operator`) therefore clears every mark instead of leaving the last anchor
     lit. Re-run when the route changes, since the targets are remounted with
     the page. */
  useEffect(() => {
    if (route.path !== '/') return
    return observeCurrentSection(homeSections, (id) => setActive({ path: route.path, id }))
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

import { useCallback, useEffect, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import type { Bi } from '../../lib/i18n'
import { useLang } from '../../lib/i18n'
import { getLenis, scrollToId } from '../../lib/scroll'
import SoundToggle from '../ui/SoundToggle'
import './nav.css'

/**
 * Section contract for every other lane: these ids are what the nav observes and
 * scrolls to. `contact` closes the page; the first four are the map itself.
 */
const SECTIONS: { id: string; label: Bi }[] = [
  { id: 'territory', label: { en: 'Territory', fr: 'Territoire' } },
  { id: 'ranges', label: { en: 'Ranges', fr: 'Terrains' } },
  { id: 'services', label: { en: 'Services', fr: 'Services' } },
  { id: 'about', label: { en: 'About', fr: 'À propos' } },
  { id: 'contact', label: { en: 'Contact', fr: 'Contact' } },
]

export default function NavBar() {
  const { lang, setLang, pick } = useLang()
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState<string | null>(null)
  const rootRef = useRef<HTMLElement | null>(null)
  const toggleRef = useRef<HTMLButtonElement | null>(null)

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

  /* Mark the section currently crossing the middle of the viewport. Sections
     that have not landed yet simply are not observed. */
  useEffect(() => {
    const targets = SECTIONS.map((section) => document.getElementById(section.id)).filter(
      (node): node is HTMLElement => node !== null,
    )
    if (targets.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id)
        }
      },
      { rootMargin: '-45% 0px -45% 0px' },
    )

    for (const node of targets) observer.observe(node)
    return () => observer.disconnect()
  }, [])

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

  const goTop = useCallback((event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    setOpen(false)
    const lenis = getLenis()
    if (lenis) lenis.scrollTo(0, { duration: 1.2 })
    else window.scrollTo({ top: 0 })
  }, [])

  const goSection = useCallback(
    (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
      event.preventDefault()
      setOpen(false)
      scrollToId(id)
    },
    [],
  )

  return (
    <header className="nav" data-scrolled={scrolled ? 'true' : 'false'} data-open={open ? 'true' : 'false'} ref={rootRef}>
      <div className="nav__inner">
        <a className="nav__brand" href="#top" onClick={goTop}>
          cleeryy
        </a>

        <nav className="nav__links" aria-label={pick({ en: 'Sections', fr: 'Sections' })}>
          {SECTIONS.map((section) => (
            <a
              className="nav__link"
              key={section.id}
              href={`#${section.id}`}
              onClick={goSection(section.id)}
              aria-current={active === section.id ? 'true' : undefined}
            >
              {pick(section.label)}
            </a>
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
                ? pick({ en: 'Close section index', fr: "Fermer l'index des sections" })
                : pick({ en: 'Open section index', fr: "Ouvrir l'index des sections" })
            }
            onClick={() => setOpen((value) => !value)}
          >
            <span className="nav__index-label">{pick({ en: 'Index', fr: 'Index' })}</span>
            <span className="nav__index-sign" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="nav__panel" id="nav-index" inert={!open || undefined}>
        <nav aria-label={pick({ en: 'Section index', fr: 'Index des sections' })}>
          <ul className="nav__panel-list">
            {SECTIONS.map((section) => (
              <li key={section.id}>
                <a className="nav__panel-link" href={`#${section.id}`} onClick={goSection(section.id)}>
                  <span>{pick(section.label)}</span>
                  <span className="nav__panel-ref" aria-hidden="true">
                    {`#${section.id}`}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  )
}

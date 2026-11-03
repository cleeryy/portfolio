import { useEffect } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Atmosphere from './chrome/Atmosphere'
import SheetGrid from './chrome/SheetGrid'
import BootGate from './chrome/BootGate'
import NavBar from './chrome/NavBar'
import Cursor from './ui/Cursor'
import Grain from './ui/Grain'
import ScrollProgress from './ui/ScrollProgress'
import InstrumentChrome from './chrome/InstrumentChrome'
import PointerHud from './chrome/PointerHud'
import About from './pages/about/About'
import Notes from './pages/notes/Notes'
import Practice from './pages/practice/Practice'
import NotFound from './pages/not-found/NotFound'
import Reprint from './chrome/Reprint'
import Project from './pages/project/Project'
import Work from './pages/work/Work'
import Home from './pages/home/Home'
import { projectBySlug } from './content/work'
import { descriptions, titles } from './content/site'
import type { RouteKey } from './content/site'
import { useLang } from './lib/i18n'
import { initMotionSystem } from './lib/reveal'
import { alignHash, useRoute } from './lib/router'
import { setMeta } from './lib/seo'
import { sound } from './lib/sound'

/** The chrome controls that answer with a relay tick. The index plate is named
    as well as the bar: its rows and its switches are chrome too, and a row that
    opens a document should be heard the same way a link in the bar is. */
const CUE_SELECTOR =
  '.nav a, .nav button, .idx a, .idx button, .cover a, .cover button, .wt a, .wt button, .op a, .op button, .ct a, .ct button, .clp a, .nf a, .reg a, .file a, .nt a, .pr a, .ab a'
const NO_CUE = '.sound-toggle, [data-no-cue]'

/**
 * The shell around every plate.
 *
 * `Atmosphere`, `SheetGrid`, `BootGate`, `ScrollProgress`, `Cursor`, `Grain` and
 * `PointerHud` are chrome: fixed layers that never take part in the document
 * flow. `InstrumentChrome` is the sheet's margin reading and is only printed on
 * the cover page — the other routes are documents, not the map.
 *
 * Routing is delegated to `lib/router`: this file only chooses the page, writes
 * the document metadata, and refreshes the scroll measurements after the new
 * page has painted. Each page owns its triggers: they are created on mount and
 * killed on unmount, so a route change needs a refresh, never a re-init.
 */
export default function App() {
  const route = useRoute()
  const { pick } = useLang()
  const home = route.path === '/'

  // One plate, one record. `/work` is the register, `/work/:slug` is a file, and
  // a slug the register does not hold falls through to the missing plate — the
  // page prints the copy, it never renders an empty shell.
  const project = route.params.slug ? projectBySlug(route.params.slug) : undefined
  const pageKey: RouteKey = home
    ? 'cover'
    : route.path === '/work'
      ? 'work'
      : route.path === '/notes'
        ? 'notes'
        : route.path === '/practice'
          ? 'practice'
          : route.path === '/about'
            ? 'about'
            : 'notFound'

  // One refresh point for the whole page: webfonts land after first layout, and
  // every pinned or measured trigger has to be re-read once they do.
  useEffect(() => initMotionSystem(), [])

  // A pinned section inserts its spacer while ScrollTrigger refreshes, which
  // moves every target below it. The router aligns the hash on arrival and
  // again on the next frame; this settles the anchors that moved on a later
  // refresh (fonts, pin distance), for a short window after the navigation.
  useEffect(() => {
    let timer = 0
    const onRefresh = () => {
      window.clearTimeout(timer)
      // After the refresh, not inside it: ScrollTrigger restores the scroll
      // position as it finishes, which would swallow a jump made in the
      // refresh callback itself.
      timer = window.setTimeout(() => alignHash(), 200)
    }

    ScrollTrigger.addEventListener('refresh', onRefresh)
    return () => {
      window.clearTimeout(timer)
      ScrollTrigger.removeEventListener('refresh', onRefresh)
    }
  }, [])

  // Metadata follows the plate. `pick` changes identity with the language, so a
  // language switch rewrites the title as well as the page.
  useEffect(() => {
    if (project) setMeta(`cleeryy — ${project.name}`, pick(project.claim), { index: true })
    else if (pageKey === 'notFound') {
      setMeta(pick(titles.notFound), pick(descriptions.notFound), { index: false })
    } else setMeta(pick(titles[pageKey]), pick(descriptions[pageKey]), { index: true })

    // After paint, not during commit: the mounted page's own triggers were
    // created in its effects, and a pinned section adds its spacer late.
    const frame = requestAnimationFrame(() => ScrollTrigger.refresh())
    return () => cancelAnimationFrame(frame)
  }, [pageKey, pick, project, route.path])

  // Sound has to answer a copy, not just the toggle. Chrome (nav, cover,
  // operator, contact, closing plate) gets a relay tick on activation and a
  // hover tick when the pointer arrives; every call is a no-op while off.
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest(NO_CUE)) return
      if (target.closest(CUE_SELECTOR)) sound.click()
    }

    // `pointerover` bubbles, `pointerenter` does not; the relatedTarget guard
    // makes crossing a link's own spans one tick rather than three.
    const onPointerOver = (event: PointerEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest(NO_CUE)) return
      const hit = target.closest(CUE_SELECTOR)
      if (!hit) return
      if (event.relatedTarget instanceof Node && hit.contains(event.relatedTarget)) return
      sound.hover()
    }

    document.addEventListener('click', onClick, true)
    document.addEventListener('pointerover', onPointerOver, true)

    return () => {
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('pointerover', onPointerOver, true)
    }
  }, [])

  // Reaching a plate is a change of room. Re-queried on every route: the home
  // sections unmount when the cover leaves, and the next page brings its own.
  useEffect(() => {
    const sections = document.querySelectorAll('main > section[id]')
    if (sections.length === 0) return

    let current = ''
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const id = entry.target.id
          if (id && id !== current) {
            current = id
            sound.arrive(id)
          }
        }
      },
      { rootMargin: '-40% 0px -40% 0px' },
    )
    sections.forEach((node) => observer.observe(node))

    return () => observer.disconnect()
  }, [route.path])

  return (
    <>
      {/* The sheet itself, and the plate change. Both fixed, both behind the
          reading: mounted first so the canvas is painted under every page. */}
      <Atmosphere />
      {/* The printed column grid: also z 0, also before every section. Keyed on
          the route, because it finds the bands it tints when it mounts: a sheet
          opened directly on `/work` has no home chapter to query, and the grid
          would then keep the light mix on the chapters it reaches later. */}
      <SheetGrid key={route.path} />
      <BootGate />
      <NavBar />
      {/* The plate change: one fixed canvas, created on the first internal
          navigation and never on a deep link. */}
      <Reprint />
      {home ? (
        <Home />
      ) : route.path === '/work' ? (
        <Work />
      ) : route.path === '/notes' ? (
        <Notes />
      ) : route.path === '/practice' ? (
        <Practice />
      ) : route.path === '/about' ? (
        <About />
      ) : route.params.slug ? (
        <Project slug={route.params.slug} />
      ) : (
        <NotFound />
      )}
      <ScrollProgress />
      <Cursor />
      <Grain />
      <PointerHud />
      {home ? <InstrumentChrome /> : null}
    </>
  )
}

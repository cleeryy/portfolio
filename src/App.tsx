import { useEffect } from 'react'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Atmosphere from './components/atmosphere/Atmosphere'
import SheetGrid from './components/grid/SheetGrid'
import BootGate from './components/boot/BootGate'
import NavBar from './components/nav/NavBar'
import Cursor from './components/ui/Cursor'
import Grain from './components/ui/Grain'
import ScrollProgress from './components/ui/ScrollProgress'
import InstrumentChrome from './components/chrome/InstrumentChrome'
import PointerHud from './components/chrome/PointerHud'
import NotFound from './components/site/NotFound'
import ProjectFile from './components/project/ProjectFile'
import Register from './components/register/Register'
import Home from './pages/Home'
import { projectBySlug } from './content/work'
import { descriptions, titles } from './content/site'
import type { RouteKey } from './content/site'
import { useLang } from './lib/i18n'
import { initMotionSystem } from './lib/reveal'
import { useRoute } from './lib/router'
import { setMeta } from './lib/seo'
import { sound } from './lib/sound'

/** The chrome controls that answer with a relay tick. */
const CUE_SELECTOR =
  '.nav a, .nav button, .cover a, .cover button, .wt a, .wt button, .op a, .op button, .ct a, .ct button, .clp a, .nf a'
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
        : route.path === '/about'
          ? 'about'
          : 'notFound'

  // One refresh point for the whole page: webfonts land after first layout, and
  // every pinned or measured trigger has to be re-read once they do.
  useEffect(() => initMotionSystem(), [])

  // Metadata follows the plate. `pick` changes identity with the language, so a
  // language switch rewrites the title as well as the page.
  useEffect(() => {
    if (project) setMeta(`cleeryy — ${project.name}`, pick(project.claim))
    else setMeta(pick(titles[pageKey]), pick(descriptions[pageKey]))

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
      {/* The printed column grid: also z 0, also before every section. */}
      <SheetGrid />
      <BootGate />
      <NavBar />
      {home ? (
        <Home />
      ) : route.path === '/work' ? (
        <Register />
      ) : route.params.slug ? (
        <ProjectFile slug={route.params.slug} />
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

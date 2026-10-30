import { useEffect } from 'react'
import { sound } from './lib/sound'
import About from './components/about/About'
import Atmosphere from './components/atmosphere/Atmosphere'
import BootGate from './components/boot/BootGate'
import Contact from './components/contact/Contact'
import Hero from './components/hero/Hero'
import NavBar from './components/nav/NavBar'
import Path from './components/path/Path'
import Ranges from './components/ranges/Ranges'
import Services from './components/services/Services'
import Skills from './components/skills/Skills'
import Territory from './components/territory/Territory'
import Cursor from './components/ui/Cursor'
import Grain from './components/ui/Grain'
import ScrollProgress from './components/ui/ScrollProgress'
import { initMotionSystem } from './lib/reveal'

/**
 * The sheet: one plotted page. Read as a CV first, a map second:
 * path (where I come from) → skills (what I can be trusted with) → territory
 * (the network I actually run) → ranges (the terrain I practise on) → work →
 * about → contact. `Contact` returns the `#contact` section *and* the page
 * footer, so it closes <main>.
 *
 * `BootGate` is the plate ruled over the page for the first second of a visit;
 * `ScrollProgress` is the scale at the sheet's right edge. Both are chrome: they
 * never take part in the document flow.
 */
export default function App() {
  // One refresh point for the whole page: webfonts land after first layout, and
  // every pinned or measured trigger has to be re-read once they do.
  useEffect(() => initMotionSystem(), [])

  // Sound has to answer a copy, not just the toggle. Chrome (nav, hero) gets a
  // relay tick on any activation, and the page ticks once as a new plate is
  // reached — sparse by design, and every call is a no-op while sound is off.
  useEffect(() => {
    const NO_CUE = '.sound-toggle, [data-no-cue]'

    const onClick = (event: MouseEvent) => {
      const target = event.target
      if (!(target instanceof Element)) return
      if (target.closest(NO_CUE)) return
      const hit = target.closest('.nav a, .nav button, .hero a, .hero button')
      if (hit) sound.click()
    }

    let current = ''
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const id = entry.target.id
          if (id && id !== current) {
            current = id
            sound.open()
          }
        }
      },
      { rootMargin: '-40% 0px -40% 0px' },
    )

    document.addEventListener('click', onClick, true)
    const sections = document.querySelectorAll('main > section[id]')
    sections.forEach((node) => observer.observe(node))

    return () => {
      document.removeEventListener('click', onClick, true)
      observer.disconnect()
    }
  }, [])

  return (
    <main id="top">
      {/* The sheet itself, and the plate change. Both fixed, both behind the
          reading: mounted first so the canvas is painted under every section. */}
      <Atmosphere />
      <BootGate />
      <NavBar />
      <Hero />
      <Path />
      <Skills />
      <Territory />
      <Ranges />
      <Services />
      <About />
      <Contact />
      <ScrollProgress />
      <Cursor />
      <Grain />
    </main>
  )
}

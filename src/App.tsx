import { useEffect } from 'react'
import About from './components/about/About'
import BootGate from './components/boot/BootGate'
import Contact from './components/contact/Contact'
import Hero from './components/hero/Hero'
import NavBar from './components/nav/NavBar'
import Ranges from './components/ranges/Ranges'
import Services from './components/services/Services'
import Territory from './components/territory/Territory'
import Cursor from './components/ui/Cursor'
import Grain from './components/ui/Grain'
import ScrollProgress from './components/ui/ScrollProgress'
import { initMotionSystem } from './lib/reveal'

/**
 * The sheet: one plotted page, read top to bottom as a descent through a network.
 * Order is part of the design — territory before ranges, ranges before services.
 * `Contact` returns the `#contact` section *and* the page footer, so it closes <main>.
 *
 * `BootGate` is the plate ruled over the page for the first second of a visit;
 * `ScrollProgress` is the scale at the sheet's right edge. Both are chrome: they
 * never take part in the document flow.
 */
export default function App() {
  // One refresh point for the whole page: webfonts land after first layout, and
  // every pinned or measured trigger has to be re-read once they do.
  useEffect(() => initMotionSystem(), [])

  return (
    <main id="top">
      <BootGate />
      <NavBar />
      <Hero />
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

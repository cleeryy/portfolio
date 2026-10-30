import About from './components/about/About'
import Contact from './components/contact/Contact'
import Hero from './components/hero/Hero'
import NavBar from './components/nav/NavBar'
import Ranges from './components/ranges/Ranges'
import Services from './components/services/Services'
import Territory from './components/territory/Territory'
import Cursor from './components/ui/Cursor'
import Grain from './components/ui/Grain'

/**
 * The sheet: one plotted page, read top to bottom as a descent through a network.
 * Order is part of the design — territory before ranges, ranges before services.
 * `Contact` returns the `#contact` section *and* the page footer, so it closes <main>.
 */
export default function App() {
  return (
    <main id="top">
      <NavBar />
      <Hero />
      <Territory />
      <Ranges />
      <Services />
      <About />
      <Contact />
      <Cursor />
      <Grain />
    </main>
  )
}

import Contact from '../components/contact/Contact'
import Cover from '../components/cover/Cover'
import Flight from '../components/flight/Flight'
import Operator from '../components/operator/Operator'
import Territory from '../components/territory/Territory'

/**
 * The home sheet: cover → territory → passage → operator → contact.
 *
 * `<main id="top">` lives here, not in App: each page owns its own main, and a
 * section id belongs to the section component that renders it (`cover`,
 * `territory`, `flight`, `operator`, `contact`). `#work` is the pinned
 * horizontal traverse and arrives in Phase B, between the cover and the map.
 */
export default function Home() {
  return (
    <main id="top">
      <Cover />
      {/* #work — the horizontal traverse arrives in Phase B */}
      <Territory />
      <Flight />
      <Operator />
      <Contact />
    </main>
  )
}

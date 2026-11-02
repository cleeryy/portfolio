import Contact from '../components/contact/Contact'
import Cover from '../components/cover/Cover'
import Flight from '../components/flight/Flight'
import Operator from '../components/operator/Operator'
import Territory from '../components/territory/Territory'
import WorkTraverse from '../components/work/WorkTraverse'

/**
 * The home sheet: cover → selected work → territory → passage → operator →
 * contact.
 *
 * `<main id="top">` lives here, not in App: each page owns its own main, and a
 * section id belongs to the section component that renders it (`cover`, `work`,
 * `territory`, `flight`, `operator`, `contact`). The work traverse sits between
 * the cover and the map: it is the first thing the cover's primary CTA reaches,
 * and it hands the reader to the territory still on the sheet.
 */
export default function Home() {
  return (
    <main id="top">
      <Cover />
      <WorkTraverse />
      <Territory />
      <Flight />
      <Operator />
      <Contact />
    </main>
  )
}

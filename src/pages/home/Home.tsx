import Contact from '../../sections/contact/Contact'
import Cover from '../../sections/cover/Cover'
import Flight from '../../sections/flight/Flight'
import Operator from '../../sections/operator/Operator'
import Territory from '../../sections/territory/Territory'
import SelectedWork from '../../sections/work/SelectedWork'

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
      <SelectedWork />
      <Territory />
      <Flight />
      <Operator />
      <Contact />
    </main>
  )
}

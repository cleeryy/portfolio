import Contact from '../../sections/contact/Contact'
import Cover from '../../sections/cover/Cover'
import Flight from '../../sections/flight/Flight'
import Browse from '../../sections/index/Browse'
import Operator from '../../sections/operator/Operator'
import Statement from '../../sections/statement/Statement'
import Territory from '../../sections/territory/Territory'
import SelectedWork from '../../sections/work/SelectedWork'

/**
 * The home sheet: cover → selected work → index → statement → territory →
 * passage → operator → contact.
 *
 * `<main id="top">` lives here, not in App: each page owns its own main, and a
 * section id belongs to the section component that renders it (`cover`, `work`,
 * `index`, `statement`, `territory`, `flight`, `operator`, `contact`).
 *
 * The order is a reading, not a stack. The cover names the practice, the
 * traverse proves it with five plates, and then the sheet stops asking to be
 * read: `#index` is the wall of twenty names the reader plays with, and
 * `#statement` is the one sentence those twenty files add up to. Only then does
 * the map open — the traverse and the index are the same register at two
 * distances, so the argument is complete before the territory makes it literal.
 */
export default function Home() {
  return (
    <main id="top">
      <Cover />
      <SelectedWork />
      <Browse />
      <Statement />
      <Territory />
      <Flight />
      <Operator />
      <Contact />
    </main>
  )
}

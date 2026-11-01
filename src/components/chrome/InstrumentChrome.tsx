import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { setReading } from './reading'
import './chrome.css'

gsap.registerPlugin(ScrollTrigger)

/* ============================================================================
   InstrumentChrome — three labelled readings in the sheet's margin
   ----------------------------------------------------------------------------
   A plotted sheet is instrumented at its trim: a time, a plate reference, a
   position. This layer is exactly that and nothing more — no panel, no blur, no
   box, no icons. It is `aria-hidden` and `pointer-events: none`: it can never
   be read out of order and can never intercept a click.

   Each reading is a labelled fact column, not a bare number: a `key` line above
   its value, the same device the hero collar and the section rails already use
   (`studying` over `ESGI B3`, `ctf` over `THCon 2025`). Three keys, five
   characters each — the widest string a 43px margin can hold at 11px:

   | key     | value          | job                                        |
   | ------- | -------------- | ------------------------------------------ |
   | paris   | `20:51`        | the local time, Europe/Paris               |
   | plate   | `03/08`        | the plate you are on, out of every plate   |
   | sheet   | `042%`         | how far through the sheet you are          |

   What each one costs:

   1. **paris** — Europe/Paris, `HH:MM`, rewritten by one interval every 10s (and
      on `visibilitychange`, so a tab that slept is corrected on return). Cost:
      one `Intl.format` and one text node per 10s.
   2. **plate** — the hero counts as plate 01 and the seven sections follow, so
      the number a visitor reads runs 01 → 08 with no gap and no zero. Derived
      from the nav's own `aria-current` (the single source of truth on this
      sheet), never from a second copy of the section list. Cost: a
      MutationObserver that fires only when the marked section changes.
   3. **sheet** — the sheet's own progress, straight from one ScrollTrigger bound
      to `0 → max`. Cost: one arithmetic op per scroll frame, and one string only
      when the whole percent changes.

   Where it lives: the left margin at mid-height, right-aligned to `--gutter` and
   vertically centred on the viewport. Mid-height is the only band that is free
   at every width: the foot of the viewport is the hero collar on the first
   screen and the colophon on the last, and the section refs sit just inside the
   gutter at every section top. At 1024px the margin is 43px and the block is
   34px of type, so it clears the text column at every width the layer is
   rendered at; below 900px there is no margin to spare and it is not rendered.

   The ink follows the surface behind it: over the one dark chapter the readings
   take the deep band's inks, decided by an IntersectionObserver on the band and
   the strip of viewport the chrome occupies — no per-frame hit testing.
   ========================================================================== */

/** The strip of viewport the chrome occupies, as a root margin (the middle 16%). */
const CHROME_BAND = '-42% 0px -42% 0px'

const pad2 = (value: number) => String(value).padStart(2, '0')

export default function InstrumentChrome() {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const clockRef = useRef<HTMLSpanElement | null>(null)
  const plateRef = useRef<HTMLSpanElement | null>(null)
  const sheetRef = useRef<HTMLSpanElement | null>(null)

  /* ---- 1. the clock ----------------------------------------------------- */

  useEffect(() => {
    const el = clockRef.current
    if (!el) return

    // One formatter for the life of the page. Paris keeps its own hours,
    // including the two Sundays a year when it does not.
    const format = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Paris',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })

    const print = () => {
      el.textContent = format.format(new Date())
    }

    print()
    const timer = window.setInterval(print, 10_000)

    // A backgrounded tab has its timers throttled; the reading is corrected on
    // return rather than up to ten seconds later.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') print()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [])

  /* ---- 2. the plate reference ------------------------------------------- */

  useEffect(() => {
    const el = plateRef.current
    const list = document.querySelector<HTMLElement>('.nav__links')
    if (!el || !list) return

    const links = Array.from(list.querySelectorAll<HTMLAnchorElement>('.nav__link'))
    if (links.length === 0) return

    // The hero is the sheet's first plate and carries no section id, so it is
    // counted here rather than left as a zero: the reading runs 01/08 on the
    // cover, 02/08 at #path, … 08/08 at #contact. A visitor counts plates, and
    // eight of them are on the sheet.
    const total = pad2(links.length + 1)

    const write = () => {
      const index = links.findIndex((link) => link.getAttribute('aria-current') === 'true')
      // No marked section means the cover: plate 01, not plate nothing.
      setReading(el, `${pad2(index + 2)}/${total}`)
    }

    const observer = new MutationObserver(write)
    observer.observe(list, {
      subtree: true,
      attributes: true,
      attributeFilter: ['aria-current'],
    })
    write()

    return () => observer.disconnect()
  }, [])

  /* ---- 3. the sheet's progress ------------------------------------------ */

  useEffect(() => {
    const el = sheetRef.current
    if (!el) return

    let percent = -1

    const print = (progress: number, scramble = true) => {
      const next = Math.round(progress * 100)
      if (next === percent) return
      percent = next
      setReading(el, `${String(next).padStart(3, '0')}%`, scramble)
    }

    const trigger = ScrollTrigger.create({
      start: 0,
      end: 'max',
      onRefresh: (self) => {
        percent = -1
        print(self.progress, false)
      },
      onUpdate: (self) => print(self.progress),
    })

    print(trigger.progress, false)

    return () => trigger.kill()
  }, [])

  /* ---- the cover --------------------------------------------------------- */

  useEffect(() => {
    const root = rootRef.current
    const cover = document.querySelector<HTMLElement>('.hero')
    if (!root || !cover) return

    // The strip the readings occupy: the bottom 8% of the viewport. While the
    // cover reaches into it, the cover's collar is the instrument on screen and
    // this one is not printed — the same rule that retires it over the ink band.
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) root.dataset.cover = entry.isIntersecting ? 'true' : 'false'
      },
      { rootMargin: '-92% 0px 0px 0px' },
    )
    observer.observe(cover)

    return () => observer.disconnect()
  }, [])

  /* ---- the ink follows the surface -------------------------------------- */

  useEffect(() => {
    const root = rootRef.current
    if (!root) return

    // Two surfaces own the ink: the chapter band (`.on-deep`, always dark) and
    // the passage, which turns dark part-way through its own track and says so
    // on `data-ground`. Watching the attribute as well means the readings stop
    // printing dark-on-dark during the hand-off.
    const band = document.querySelector<HTMLElement>('main > section.on-deep')
    const passage = document.querySelector<HTMLElement>('.flt[data-ground]')

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.target === passage) {
            root.dataset.passage = entry.isIntersecting && passage?.dataset.ground === 'deep' ? 'true' : 'false'
            continue
          }
          root.dataset.deep = entry.isIntersecting ? 'true' : 'false'
        }
      },
      { rootMargin: CHROME_BAND },
    )
    if (band) observer.observe(band)
    if (passage) observer.observe(passage)

    const onGround = () => {
      if (!passage) return
      root.dataset.passage = passage.dataset.ground === 'deep' ? 'true' : 'false'
    }
    const mutation = passage ? new MutationObserver(onGround) : null
    if (passage && mutation) mutation.observe(passage, { attributes: true, attributeFilter: ['data-ground'] })

    return () => {
      observer.disconnect()
      mutation?.disconnect()
    }
  }, [])

  return (
    <div className="chrome" aria-hidden="true" ref={rootRef}>
      {/* The rule the readings hang from, and the layer's one crimson mark:
          a 7px survey tick, the same length as the sheet's registration marks. */}
      <span className="chrome__rule" />

      {/* Three fact columns, key over value — the collar's own device. The keys
          are the sheet's vocabulary (a place, a plate, the sheet itself), five
          characters each so the widest one still clears a 43px margin. */}
      <p className="chrome__read">
        <span className="chrome__key">paris</span>
        <span className="chrome__value" ref={clockRef}>
          --:--
        </span>
      </p>

      <p className="chrome__read">
        <span className="chrome__key">plate</span>
        <span className="chrome__value" ref={plateRef}>
          --/--
        </span>
      </p>

      <p className="chrome__read">
        <span className="chrome__key">sheet</span>
        <span className="chrome__value" ref={sheetRef}>
          ---%
        </span>
      </p>
    </div>
  )
}

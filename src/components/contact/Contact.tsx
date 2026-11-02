import { useLayoutEffect, useRef } from 'react'
import { useLang } from '../../lib/i18n'
import { initSectionRig } from '../../lib/reveal'
import { sound } from '../../lib/sound'
import {
  blogLabel,
  blogUrl,
  contact,
  contactEmail,
  sourceLabel,
  sourceUrl,
} from '../../content/contact'
import SplitText from '../../ui/SplitText'
import RolloverLink from '../../ui/Rollover'
import './contact.css'

/**
 * The colophon's year, read once at module load rather than during render: a
 * render-time `new Date()` is an impure call, and the page has no reason to
 * recompute a copyright year on every language switch.
 */
const year = new Date().getFullYear()

/**
 * The address is one string for assistive tech and for copy/paste, but it gets
 * a break opportunity after the `@` — the way an address is allowed to wrap.
 * Without it a 320px screen breaks the address mid-word, which reads as a bug.
 */
function MailAddress() {
  const at = contactEmail.lastIndexOf('@')
  if (at < 1) return <>{contactEmail}</>
  return (
    <>
      {contactEmail.slice(0, at)}
      <wbr />@{contactEmail.slice(at + 1)}
    </>
  )
}

/**
 * The closing page: the request, one line of invitation, three addresses.
 *
 * The margin column carries the section's own label (`the request`) and its
 * coordinate, the way every other chapter is annotated. The ask is display
 * type on a short measure; the invitation is one paragraph. Then the ledger:
 * the mail first, because writing is the only thing this page asks for, then
 * the two places that prove the rest — the code and the writing.
 *
 * No form, no availability badge, no newsletter — a `mailto:` that works with
 * the script switched off. The address is set in the sheet's link language
 * (hairline underline, crimson on hover and focus), never in a plate: a plate
 * would make a link look like a control, and this is a letter.
 *
 * This component renders two things: the `#contact` section and the page's
 * colophon (`<footer>`), so `<Contact />` belongs last inside `<main>`. The
 * footer's `#top` link is a plain anchor — going back up never depends on JS.
 */
export default function Contact() {
  const { pick } = useLang()
  const copy = pick(contact)
  const rootRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const rig = initSectionRig(root)
    return () => rig.dispose()
  }, [])

  return (
    <>
      <section className="ct" id="contact" aria-labelledby="contact-title" ref={rootRef}>
        <span className="rig-tick" data-rig-tick aria-hidden="true" />

        <div className="ct__inner">
          <header className="ct__head">
            {/* The margin label replaces the `#contact` reference the other
                chapters print: this section is named by what it asks for, and
                the coordinate counts under it. */}
            <p className="ct__margin mono">
              <span>{copy.margin}</span>
              <span className="rig-coord" data-rig-coord="" aria-hidden="true" />
            </p>

            <SplitText
              as="h2"
              className="ct__title"
              id="contact-title"
              text={copy.title}
              reveal
            />

            <p className="ct__invite" data-reveal-block="">
              {copy.invite}
            </p>
          </header>

          {/* The ledger: the key in the margin, the address on the reading
              column, one rule over the block. The registration square on that
              rule is the section's single survey mark. */}
          <div className="ct__address">
            <span className="ct__registration" aria-hidden="true" />

            <dl className="ct__ledger">
              <div className="ct__row">
                <dt className="mono">{copy.mailKey}</dt>
                <dd>
                  {/* The address is written, not rolled: it has to be able to
                      wrap at 320px, and an email is a letter, not a place. It
                      still carries a HUD reading of its destination. */}
                  <a
                    className="ct__mail"
                    href={`mailto:${contactEmail}`}
                    onClick={() => sound.click()}
                    data-hud="mailto"
                  >
                    <MailAddress />
                  </a>
                </dd>
              </div>

              <div className="ct__row">
                <dt className="mono">{copy.codeKey}</dt>
                <dd>
                  <RolloverLink
                    className="ct__link"
                    href={sourceUrl}
                    text={sourceLabel}
                    rel="noreferrer"
                    onClick={() => sound.click()}
                  />
                </dd>
              </div>

              {/* The third address is the writing: the notes live off the
                  sheet, and this is where they are read. A link, never a
                  badge. */}
              <div className="ct__row">
                <dt className="mono">{copy.blogKey}</dt>
                <dd>
                  <RolloverLink
                    className="ct__link"
                    href={blogUrl}
                    text={blogLabel}
                    rel="noreferrer"
                    onClick={() => sound.click()}
                  />
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <footer className="clp">
        <div className="clp__inner">
          <p className="clp__credit">
            <span className="clp__year">© {year}</span>
            {/* Same reason as the service links: one space so the credit is not
                announced as "2026drawn". */}
            {' '}
            <span>{copy.credit}</span>
          </p>

          <RolloverLink className="clp__top" href="#top" text={copy.backToTop} />

          {/* The colophon's legend line: the same four-tick scale bar as the
              hero collar, at the same ratio, so the sheet ends on its own
              instrument rather than on a logo. */}
          <p className="clp__scale">
            <span className="clp__bar" aria-hidden="true" />
            <span className="clp__scale-note mono">{copy.scaleNote}</span>
          </p>

          <p className="clp__ref mono" aria-hidden="true">
            #contact
          </p>
        </div>
      </footer>
    </>
  )
}

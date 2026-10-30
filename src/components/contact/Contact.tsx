import { useLang } from '../../lib/i18n'
import { sound } from '../../lib/sound'
import { contact, contactEmail, sourceLabel, sourceUrl } from '../../content/contact'
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
 * The closing page: one question, one line, one address.
 *
 * No form, no availability badge, no newsletter — a `mailto:` that works with
 * the script switched off, and the one profile he actually uses. The address is
 * the primary action and it is set in display type, not in a plate: a plate
 * would make a link look like a control, and this is a letter.
 *
 * This component renders two things: the `#contact` section and the page's
 * colophon (`<footer>`), so `<Contact />` belongs last inside `<main>`. The
 * footer's `#top` link is a plain anchor — going back up never depends on JS.
 */
export default function Contact() {
  const { pick } = useLang()
  const copy = pick(contact)

  return (
    <>
      <section className="ct" id="contact" aria-labelledby="contact-title">
        <div className="ct__inner">
          <header className="ct__head">
            <p className="ct__ref mono" aria-hidden="true">
              #contact
            </p>

            <h2 className="ct__title" id="contact-title">
              {copy.title}
            </h2>

            <p className="ct__invite">{copy.invite}</p>
          </header>

          {/* An address ledger: the key in the margin, the address on the reading
              column, one rule over the block. The registration square on that
              rule is the section's single survey mark. */}
          <div className="ct__address">
            <span className="ct__registration" aria-hidden="true" />

            <dl className="ct__ledger">
              <div className="ct__row">
                <dt className="mono">{copy.mailKey}</dt>
                <dd>
                  <a
                    className="ct__mail"
                    href={`mailto:${contactEmail}`}
                    onClick={() => sound.click()}
                  >
                    <MailAddress />
                  </a>
                </dd>
              </div>

              <div className="ct__row">
                <dt className="mono">{copy.codeKey}</dt>
                <dd>
                  <a
                    className="ct__link"
                    href={sourceUrl}
                    onClick={() => sound.click()}
                  >
                    {sourceLabel}
                  </a>
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

          <a className="clp__top" href="#top">
            {copy.backToTop}
          </a>

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

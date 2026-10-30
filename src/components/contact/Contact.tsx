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
import SplitText from '../ui/SplitText'
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
 * No form, no availability badge, no newsletter — a `mailto:` that works with
 * the script switched off, then the two pages that prove the rest: the code and
 * the writeups. The address is the primary action and it is set in display type,
 * not in a plate: a plate would make a link look like a control, and this is a
 * letter.
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
            <p className="ct__ref mono" aria-hidden="true">
              <span>#contact</span>
              <span className="rig-coord" data-rig-coord="" />
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

              {/* The third address is the record: the writeups the training
                  chapter points at. It is a link, never a badge. */}
              <div className="ct__row">
                <dt className="mono">{copy.blogKey}</dt>
                <dd>
                  <a className="ct__link" href={blogUrl} onClick={() => sound.click()}>
                    {blogLabel}
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

import { useLayoutEffect, useRef } from 'react'
import { useLang } from '../../lib/i18n'
import { initSectionRig } from '../../lib/reveal'
import { Link } from '../../lib/router'
import { operator } from '../../content/about'
import SplitText from '../ui/SplitText'
import { RolloverLabel } from '../ui/Rollover'
import './operator.css'

/* ============================================================================
   The operator
   ----------------------------------------------------------------------------
   The second half of the dark passage: `#flight` hands over on ink and this
   chapter keeps it — the person behind the network, in two paragraphs, with
   four readings and one way out to the long version.

   Layout contract: a vertical margin label on the left, a reading column in the
   middle, and the four facts as a ledger in the right margin, aligned to the
   title's cap-height like a plate's cartouche. The ledger is `copy.facts`, in
   order, one row each — no reading is inferred here.

   The surface is `.on-deep` (base.css). This component adds one crimson mark,
   the registration tick on the top rule, and nothing else: no panel, no second
   dark surface, no colour of its own.

   Motion is the shared section rig — the drawn top rule, the tick, the printed
   coordinate in the rail, and the paragraphs rising as whole blocks. Nothing is
   hidden by CSS, so a script that never runs leaves the chapter printed.
   ========================================================================== */

export default function Operator() {
  const { pick } = useLang()
  const copy = pick(operator)
  const rootRef = useRef<HTMLElement | null>(null)

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    const rig = initSectionRig(root)
    return () => rig.dispose()
  }, [])

  return (
    <section className="op on-deep" id="operator" aria-labelledby="operator-title" ref={rootRef}>
      {/* The chapter's one crimson mark, and the rig's drawn registration tick:
          one element, so the accent cannot be drawn twice. */}
      <span className="rig-tick op__mark" data-rig-tick aria-hidden="true" />

      <div className="op__inner">
        <div className="op__rail">
          <p className="op__margin mono">{copy.margin}</p>

          {/* The sheet's reference and its measurement. Written by the rig, so
              the element is empty until there is a real number to print. */}
          <p className="op__ref mono" aria-hidden="true">
            <span>#operator</span>
            <span className="rig-coord" data-rig-coord="" />
          </p>
        </div>

        <SplitText as="h2" className="op__title" id="operator-title" text={copy.title} reveal />

        <div className="op__text">
          {copy.paragraphs.map((paragraph) => (
            <p className="op__para" key={paragraph} data-reveal-block="">
              {paragraph}
            </p>
          ))}
        </div>

        {/* A ledger, not a list of chips: key in the margin column, value on the
            right, one hairline per row. */}
        <dl className="op__facts">
          {copy.facts.map((fact) => (
            <div className="op__fact" key={fact.key}>
              <dt className="op__fact-key mono">{fact.key}</dt>
              <dd className="op__fact-value mono">{fact.value}</dd>
            </div>
          ))}
        </dl>

        {/* A route link, intercepted by the router on a plain left-click; the
            href stays real, so a middle-click or a copy still works. */}
        <Link to="/about" className="roll-link op__more" data-hud="/about">
          <RolloverLabel text={copy.moreLabel} />
        </Link>
      </div>
    </section>
  )
}

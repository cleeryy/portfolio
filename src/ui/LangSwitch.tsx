import { useLang } from '../lib/i18n'
import './lang.css'

/* ============================================================================
   LangSwitch — the language pair, once
   ----------------------------------------------------------------------------
   Two words, EN and FR, and the active one marked with the sheet's one accent
   rule. It is type, not an icon: a map legend names its languages, it does not
   draw a globe.

   There are two places it is printed — the bar, and the index overlay's
   settings plate — so it is one component with two *sizes*, never two copies of
   the behaviour. `variant` is the size and the target height; the state, the
   `lang` attributes and the two handlers are the same everywhere. The buttons
   say `aria-pressed`, and the styling keys off that, so a screen reader hears
   the same answer the ink shows.

   The ink is inherited on purpose: the bar is on the sheet and the overlay is on
   ink, and this control must read on both without knowing which surface it is
   on. The quiet state is a mix of the inherited colour, not an opacity, so the
   focus ring (which is `currentColor`-free, from base.css) stays at full
   strength while the word is quiet.
   ========================================================================== */

const LANGS = ['en', 'fr'] as const

type LangSwitchProps = {
  className?: string
  /** `bar` is the compact pair in the collar; `row` is a settings-plate value. */
  variant?: 'bar' | 'row'
}

export default function LangSwitch({ className, variant = 'bar' }: LangSwitchProps) {
  const { lang, setLang, pick } = useLang()
  const label = pick({ en: 'Language', fr: 'Langue' })

  return (
    <div
      className={className ? `lang ${className}` : 'lang'}
      role="group"
      aria-label={label}
      data-variant={variant}
    >
      {LANGS.map((code) => (
        <button
          key={code}
          type="button"
          className="lang__btn"
          lang={code}
          aria-pressed={lang === code}
          onClick={() => setLang(code)}
        >
          {code.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

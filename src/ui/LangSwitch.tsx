import { useLang } from '../lib/i18n'
import './lang.css'

/* ============================================================================
   LangSwitch — the language pair, in one place
   ----------------------------------------------------------------------------
   The same control appears twice: in the bar, and as one row of the index
   panel's plate block. Two copies of two buttons would be two chances to drift;
   this is one component reading one store (`setLang` in `lib/i18n`), so a switch
   made in the panel is already printed in the bar when the panel closes.

   The pair is type, not a control with a box: two mono words, the active one
   carrying the sheet's crimson rule. Ink is inherited, never declared — the bar
   prints it on the ground, the panel prints it on the same ground, and neither
   needs a skin of its own.
   ========================================================================== */

type LangSwitchProps = {
  /** `bar` is the collar's 32px pair; `row` is read at arm's length in the panel. */
  variant?: 'bar' | 'row'
  className?: string
}

export default function LangSwitch({ variant = 'bar', className }: LangSwitchProps) {
  const { lang, setLang, pick } = useLang()

  return (
    <div
      className={className ? `lang ${className}` : 'lang'}
      data-variant={variant}
      role="group"
      aria-label={pick({ en: 'Language', fr: 'Langue' })}
    >
      <button
        type="button"
        className="lang__btn"
        lang="en"
        aria-pressed={lang === 'en'}
        onClick={() => setLang('en')}
      >
        EN
      </button>
      <button
        type="button"
        className="lang__btn"
        lang="fr"
        aria-pressed={lang === 'fr'}
        onClick={() => setLang('fr')}
      >
        FR
      </button>
    </div>
  )
}

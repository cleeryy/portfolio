import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { sound } from '../lib/sound'
import { useLang } from '../lib/i18n'
import './sound.css'

/* ============================================================================
   SoundToggle — the sound layer's one control, in two registers
   ----------------------------------------------------------------------------
   The engine is a store (`lib/sound`), so the state lives in ARIA and in the
   subscription, never in this component. What the file owns is the *shape* of
   the control, and there are two of them now:

   - the bar's plate (`SoundToggle`): three CSS bars and the word, unchanged;
   - the index overlay's labelled row: `Sound`, then `on` / `off`.

   They are one implementation, not two. `useSoundControl` holds the state, the
   handler (including the 70 ms engage delay — a switch engages after the press,
   not with it) and the bilingual labels; both registers read it. The row is a
   caller's markup, so it can print the state instead of drawing a meter.

   Toggling changes no box dimension, and nothing here re-renders per frame:
   the meter is CSS, and the state is a single external-store snapshot.
   ========================================================================== */

const getServerEnabled = () => false

/** Delay before the relay confirmation — a switch engages after the press, not with it. */
const ENGAGE_DELAY_MS = 70

export type SoundControl = {
  /** The store's snapshot: the switch is on. */
  enabled: boolean
  /** Flip it. Cues its own confirmation, which is why a caller marks the row `data-no-cue`. */
  toggle: () => void
  /** `Sound` / `Son`. */
  label: string
  /** `on` / `off` — the value a labelled row prints. */
  value: string
  /** The button's accessible name. */
  action: string
  /** The sentence a `title` carries. */
  hint: string
}

/**
 * The sound control, as state.
 *
 * Exported separately from the plate so the index overlay can print the same
 * switch as a labelled row: one handler, one set of words, one place where the
 * engine is read.
 */
export function useSoundControl(): SoundControl {
  const { pick } = useLang()
  const enabled = useSyncExternalStore(sound.subscribe, sound.isEnabled, getServerEnabled)
  const engageTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (engageTimer.current !== null) window.clearTimeout(engageTimer.current)
    },
    [],
  )

  const toggle = useCallback(() => {
    if (sound.isEnabled()) {
      // Cue first: the switch is heard releasing before the master fades.
      sound.click()
      sound.disable()
      return
    }

    sound.enable()
    if (engageTimer.current !== null) window.clearTimeout(engageTimer.current)
    engageTimer.current = window.setTimeout(() => {
      engageTimer.current = null
      sound.click()
    }, ENGAGE_DELAY_MS)
  }, [])

  return {
    enabled,
    toggle,
    label: pick({ en: 'Sound', fr: 'Son' }),
    value: enabled ? pick({ en: 'on', fr: 'activé' }) : pick({ en: 'off', fr: 'coupé' }),
    action: pick({
      en: 'Toggle interface sound',
      fr: 'Activer ou couper le son de l’interface',
    }),
    hint: enabled
      ? pick({ en: 'Sound on — click to mute', fr: 'Son activé — cliquer pour couper' })
      : pick({ en: 'Sound off — click to enable', fr: 'Son coupé — cliquer pour activer' }),
  }
}

type SoundToggleProps = {
  /** Optional hook for the nav's layout. The control itself owns no positioning. */
  className?: string
}

/**
 * Quiet on/off plate for the sound layer.
 *
 * Contract:
 * - `<button type="button" aria-pressed>` — state lives in ARIA, styling keys off it.
 * - Three CSS-only bars act as an idle meter; nothing re-renders per frame.
 * - Toggling changes no box dimensions, so the nav never shifts.
 * - Keyboard: native button, visible `:focus-visible` ring, 32px min target.
 */
export default function SoundToggle({ className }: SoundToggleProps) {
  const control = useSoundControl()

  return (
    <button
      type="button"
      className={className ? `sound-toggle ${className}` : 'sound-toggle'}
      aria-pressed={control.enabled}
      aria-label={control.action}
      title={control.hint}
      onClick={control.toggle}
    >
      <span className="sound-toggle__meter" aria-hidden="true">
        <span className="sound-toggle__bar" />
        <span className="sound-toggle__bar" />
        <span className="sound-toggle__bar" />
      </span>
      <span className="sound-toggle__label">{control.label}</span>
    </button>
  )
}

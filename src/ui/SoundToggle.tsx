import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { sound } from '../lib/sound'
import { useLang } from '../lib/i18n'
import './sound.css'

const getServerEnabled = () => false

/** Delay before the relay confirmation — a switch engages after the press, not with it. */
const ENGAGE_DELAY_MS = 70

type SoundToggleProps = {
  /** Optional hook for the nav's layout. The control itself owns no positioning. */
  className?: string
}

/**
 * Quiet on/off control for the sound layer.
 *
 * Contract:
 * - `<button type="button" aria-pressed>` — state lives in ARIA, styling keys off it.
 * - Three CSS-only bars act as an idle meter; nothing re-renders per frame.
 * - Toggling changes no box dimensions, so the nav never shifts.
 * - Keyboard: native button, visible `:focus-visible` ring, 32px min target.
 */
export default function SoundToggle({ className }: SoundToggleProps) {
  const { pick } = useLang()
  const enabled = useSyncExternalStore(sound.subscribe, sound.isEnabled, getServerEnabled)
  const engageTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (engageTimer.current !== null) window.clearTimeout(engageTimer.current)
    },
    [],
  )

  const handleClick = useCallback(() => {
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

  const label = pick({ en: 'Sound', fr: 'Son' })
  const action = pick({
    en: 'Toggle interface sound',
    fr: 'Activer ou couper le son de l’interface',
  })
  const hint = enabled
    ? pick({ en: 'Sound on — click to mute', fr: 'Son activé — cliquer pour couper' })
    : pick({ en: 'Sound off — click to enable', fr: 'Son coupé — cliquer pour activer' })

  return (
    <button
      type="button"
      className={className ? `sound-toggle ${className}` : 'sound-toggle'}
      aria-pressed={enabled}
      aria-label={action}
      title={hint}
      onClick={handleClick}
    >
      <span className="sound-toggle__meter" aria-hidden="true">
        <span className="sound-toggle__bar" />
        <span className="sound-toggle__bar" />
        <span className="sound-toggle__bar" />
      </span>
      <span className="sound-toggle__label">{label}</span>
    </button>
  )
}

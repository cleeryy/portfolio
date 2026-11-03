import { useSoundControl } from './useSoundControl'
import './sound.css'

/* ============================================================================
   SoundToggle — the bar's plate
   ----------------------------------------------------------------------------
   Quiet on/off control for the sound layer. The store and the gesture live in
   `useSoundControl`, because the index panel prints the same switch as a row;
   this file is only the shape the bar wears.

   Contract:
   - `<button type="button" aria-pressed>` — state lives in ARIA, styling keys off it.
   - Three CSS-only bars act as an idle meter; nothing re-renders per frame.
   - Toggling changes no box dimensions, so the nav never shifts.
   - Keyboard: native button, visible `:focus-visible` ring, 32px min target.
   ========================================================================== */

type SoundToggleProps = {
  /** Optional hook for the nav's layout. The control itself owns no positioning. */
  className?: string
}

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

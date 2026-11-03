import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react'
import { sound } from '../lib/sound'
import { useLang } from '../lib/i18n'

/* ============================================================================
   useSoundControl — the sound store, as the two surfaces that print it need it
   ----------------------------------------------------------------------------
   The bar's plate and the index panel's row are the same switch in two shapes.
   If each owned a copy of the gesture they would drift: a change made in the
   panel has to be in the bar before the panel closes, and the relay cue has to
   fire in the same order on both. So the state comes from `sound.subscribe` —
   the engine's own store — and the press is this one callback; the components
   only choose markup.
   ========================================================================== */

const getServerEnabled = () => false

/** Delay before the relay confirmation — a switch engages after the press, not with it. */
const ENGAGE_DELAY_MS = 70

export function useSoundControl() {
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

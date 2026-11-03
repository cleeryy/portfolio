import { useSyncExternalStore } from 'react'

/* ============================================================================
   motion.ts — the reader's motion preference, and the one opt-in over it
   ----------------------------------------------------------------------------
   Two sources, one predicate, and a rule about which one wins:

   - **the system** — `prefers-reduced-motion: reduce`. Always honoured; it can
     never be turned back off from inside the page.
   - **the sheet's own override** — a choice made in the index overlay, stored
     as `localStorage['portfolio:motion']` and printed on `<html data-motion>`.
     It can only *add* restraint. That is the whole shape of the control: a
     reader who has asked the system for motion can still ask this sheet for
     less; a reader who has asked the system for stillness is never offered the
     switch back, because a site does not get to overrule that.

   So `data-motion="reduced"` is present exactly when the override is on, and
   absent otherwise — it states the override, never the system. Anything that
   needs the effective answer calls `effectiveReduced()`, and anything that must
   react to a change subscribes to `subscribeMotion`; the system query and the
   override both emit through the same channel.

   `initMotion()` runs before the first React commit (`main.tsx`), so the flag is
   on the document before any chrome reads it — no instrument ever renders one
   frame in the wrong mode and corrects itself.

   Who honours the override, and who only honours the system:

   - **honoured live** — the atmosphere (spin and loupe), the reprint, the veil,
     the character rollover, and every hook that reads `useReducedMotion`.
   - **honoured at creation** — the reveal system (`lib/reveal`), the chrome's
     readings, the smooth-scroll engine, the boot plate, the magnetic buttons and
     the pointer HUD: they ask once, when the page or the rig they own is built.
   - **system only** — the section-local canvases that read the media query
     themselves (the passage, the territory plot). They are built once at mount
     and belong to their own lanes; this module does not reach into them.
   ========================================================================== */

const SYSTEM_QUERY = '(prefers-reduced-motion: reduce)'

/** The stored choice. `'full'` is a real value: it means "no override". */
const STORAGE_KEY = 'portfolio:motion'

/** The flag on `<html>`. Present = the override is on. */
const ATTR = 'data-motion'

export type MotionState = 'full' | 'reduced'

/** `null` follows the system; the two names are the reader's explicit choice. */
let choice: MotionState | null = null

/** The storage has been read once. */
let opened = false

let system: MediaQueryList | null = null

const listeners = new Set<() => void>()

function emit(): void {
  for (const listener of listeners) listener()
}

function stored(): MotionState | null {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY)
    return value === 'reduced' || value === 'full' ? value : null
  } catch {
    // Blocked storage is not a broken preference: the session still honours the
    // choice, it simply does not survive the tab.
    return null
  }
}

function persist(next: MotionState): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, next)
  } catch {
    /* see `stored` */
  }
}

/** The system query, with its one permanent listener: a system flip is a change
    every subscriber must hear about, even though it never touches the flag. */
function media(): MediaQueryList {
  if (!system) {
    system = window.matchMedia(SYSTEM_QUERY)
    system.addEventListener('change', emit)
  }
  return system
}

/** Read the stored choice and print it. Idempotent, and called by every entry
    point so an import order can never leave the flag off. */
function open(): void {
  if (opened) return
  opened = true
  choice = stored()
  print()
}

function print(): void {
  const root = document.documentElement
  if (choice === 'reduced') root.setAttribute(ATTR, 'reduced')
  else root.removeAttribute(ATTR)
}

/**
 * Read the preference once and attach the system listener. Called before the
 * first render, so no chrome is ever built against a stale flag.
 */
export function initMotion(): void {
  open()
  media()
}

/** True when the machine itself asks for stillness. */
export function systemReduced(): boolean {
  return media().matches
}

/** The stored choice, or `null` when the sheet follows the system alone. */
export function motionChoice(): MotionState | null {
  open()
  return choice
}

/** The one predicate: system *or* override. */
export function effectiveReduced(): boolean {
  open()
  return choice === 'reduced' || media().matches
}

/**
 * Set — or lift — the override. Lifting it is a no-op while the system asks for
 * stillness: the control is disabled there, and a stale tab cannot overrule it.
 */
export function setMotionReduced(reduced: boolean): void {
  open()
  if (!reduced && media().matches) return

  const next: MotionState = reduced ? 'reduced' : 'full'
  if (choice === next) return

  choice = next
  persist(next)
  print()
  emit()
}

/** Subscribe to both sources. Returns the disposer. */
export function subscribeMotion(listener: () => void): () => void {
  open()
  media()
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The store's snapshot — a primitive, so React compares by value. */
export function motionSnapshot(): MotionState {
  return effectiveReduced() ? 'reduced' : 'full'
}

/**
 * The effective preference, as React state. Reads the same store the
 * instruments read, so the control in the panel and the canvas cannot disagree.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribeMotion, effectiveReduced, () => false)
}

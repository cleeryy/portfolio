import { useEffect, useLayoutEffect, useRef } from 'react'

/* ============================================================================
   pointer.ts — one pointer signal for the whole sheet
   ----------------------------------------------------------------------------
   Three consumers read the pointer: the atmosphere's loupe, the type's ghost
   plate, and (unchanged) the magnetic buttons. This module is the single owner
   of the first two.

   The contract:

   - One passive `pointermove` on `window`, one passive `scroll`, and one
     `pointerleave` on the document. Nothing is attached on a coarse pointer.
   - One rAF, and only while a pointer frame is actually needed: the pointer has
     moved in the last 400 ms, the damped deltas are still settling, or the
     scroll signal is still decaying. Then it stops — no idle loop.
   - `getPointer()` is synchronous, so a scene already on its own frame loop
     (the atmosphere) never needs to subscribe to a second one.
   - `usePointerFrame()` is for DOM consumers: the callback runs on the shared
     frames only, and the subscription is released on unmount.

   The scroll signal is here rather than in the ghost because it is the same
   question — "is the sheet being moved?" — and because it must not create a
   second rAF of its own. It is the damped scroll delta in CSS px per frame:
   at 60 Hz the 0.18 damping is a lag of about 90 ms, which is exactly the lag
   the ghost plate wants on its scroll offset.
   ========================================================================== */

export type PointerState = {
  /** Viewport CSS pixels, the raw event position. */
  x: number
  y: number
  /** Damped per-frame delta, in CSS px. */
  vx: number
  vy: number
  /** False until the first move, and again after the pointer leaves. */
  inside: boolean
}

/** Half-life of the damped deltas: 0.18 per 60 Hz frame ≈ 90 ms. */
const DAMP = 0.18

/** How long a frame burst stays alive after the last real input. */
const IDLE_MS = 400

/** Below this a damped value is at rest and is snapped to exactly zero. */
const REST = 0.05

const state: PointerState = { x: 0, y: 0, vx: 0, vy: 0, inside: false }

const subscribers = new Set<(pointer: PointerState) => void>()

let armed = false
let running = false
let frameId = 0
let lastActivity = Number.NEGATIVE_INFINITY
let lastX = 0
let lastY = 0
let primed = false
let lastScrollY = 0
let scrollVelocity = 0
let pendingScroll = false

const capable = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches

function onMove(event: PointerEvent): void {
  if (!primed) {
    // The first sample establishes the origin; otherwise the whole first move
    // would read as one enormous velocity.
    lastX = event.clientX
    lastY = event.clientY
    primed = true
  }
  state.x = event.clientX
  state.y = event.clientY
  state.inside = true
  lastActivity = performance.now()
  ensure()
}

function onScroll(): void {
  lastActivity = performance.now()
  // A scroll wake must measure the delta since the last frame, so the origin
  // is kept; any other wake re-bases it (a route change moves the page without
  // a scroll event, and that is not a throw).
  if (subscribers.size > 0) pendingScroll = true
  ensure()
}

function onLeave(): void {
  state.inside = false
  lastActivity = performance.now()
  ensure()
}

function arm(): void {
  if (armed || typeof window === 'undefined') return
  armed = true
  if (!capable()) return

  lastScrollY = window.scrollY
  window.addEventListener('pointermove', onMove, { passive: true })
  window.addEventListener('scroll', onScroll, { passive: true })
  document.addEventListener('pointerleave', onLeave)
}

function ensure(): void {
  if (running || subscribers.size === 0 || !capable()) return
  running = true
  // The pointer may have moved while the loop was stopped; do not replay that
  // distance as one frame of velocity.
  lastX = state.x
  lastY = state.y
  if (!pendingScroll) lastScrollY = window.scrollY
  pendingScroll = false
  frameId = requestAnimationFrame(frame)
}

function stop(): void {
  if (frameId) cancelAnimationFrame(frameId)
  frameId = 0
  running = false
  state.vx = 0
  state.vy = 0
  scrollVelocity = 0
}

function frame(now: number): void {
  frameId = 0

  const dx = state.x - lastX
  const dy = state.y - lastY
  lastX = state.x
  lastY = state.y

  state.vx += (dx - state.vx) * DAMP
  state.vy += (dy - state.vy) * DAMP

  const scroll = window.scrollY
  scrollVelocity += (scroll - lastScrollY - scrollVelocity) * DAMP
  lastScrollY = scroll
  pendingScroll = false

  for (const callback of subscribers) callback(state)

  const idle = now - lastActivity >= IDLE_MS
  const settled =
    Math.abs(state.vx) < REST &&
    Math.abs(state.vy) < REST &&
    Math.abs(scrollVelocity) < REST

  if (idle && settled) {
    state.vx = 0
    state.vy = 0
    scrollVelocity = 0
    running = false
    return
  }

  frameId = requestAnimationFrame(frame)
}

function subscribe(callback: (pointer: PointerState) => void): () => void {
  arm()

  // Reduced motion means the registered state: no pointer frame is created at
  // all, so no consumer can be tempted to catch up in a rAF of its own.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {}

  subscribers.add(callback)

  // A new consumer starts from the page's current scroll, never from the last
  // page's: the ghost is mounted per route, and a stale origin would read as a
  // throw on the first pointer frame.
  lastScrollY = window.scrollY
  pendingScroll = false

  if (state.inside) {
    lastActivity = performance.now()
    ensure()
  }

  return () => {
    subscribers.delete(callback)
    if (subscribers.size === 0) stop()
  }
}

/** The current pointer, synchronously. The object is reused: read it, do not keep it. */
export function getPointer(): PointerState {
  arm()
  return state
}

/**
 * The damped scroll delta, in CSS px per frame. Only meaningful while pointer
 * frames are running; it decays to exactly 0 with the same ~90 ms lag.
 */
export function getScrollVelocity(): number {
  return scrollVelocity
}

/**
 * Run `callback` on the shared pointer frames.
 *
 * The callback is held in a ref, so a component can close over fresh props
 * without resubscribing — and therefore without restarting the rAF — on every
 * render. The subscription exists only while the component is mounted.
 */
export function usePointerFrame(callback: (pointer: PointerState) => void): void {
  const ref = useRef(callback)
  useLayoutEffect(() => {
    ref.current = callback
  })
  useEffect(() => subscribe((pointer) => ref.current(pointer)), [])
}

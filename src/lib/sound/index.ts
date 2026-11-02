import { Foundry, MASTER_LEVEL, clamp, clamp01, holdAt } from './graph'
import { RoomBank, roomOf, type RoomId } from './rooms'
import { CueBank, type CueStamp, type NodeTier } from './cues'

/**
 * Sound layer — entirely synthesized with the Web Audio API.
 *
 * Design thesis: the sound of an operated territory, not a soundtrack. Relay
 * ticks, a sonar reading, the low room tone of a machine hall. No melody, no
 * rhythm, no chase music. Everything is quiet enough that the site still reads
 * as a document.
 *
 * The site is four rooms, not one page with clicks:
 *
 * | room      | what is heard                                        | where            |
 * |-----------|------------------------------------------------------|------------------|
 * | `paper`   | air, a slow breath, a fifth of hum                   | the sheet        |
 * | `machine` | fan, a 50 Hz transformer, an occasional relay        | `#territory`     |
 * | `air`     | moving air, its band opened by the flight's depth    | `#flight`        |
 * | `ink`     | sub-bass pressure, almost no highs                   | `#operator`      |
 *
 * Rooms crossfade over 0.6–0.9 s (see `sound/rooms.ts`) and are built lazily,
 * released when left. `arrive(sectionId)` is the whole integration: the
 * section→room table lives next to those rooms (`roomOf` in `sound/rooms.ts`),
 * and this module only plays the arrival cue for ids that have a room.
 *
 * Rules this module enforces, and why:
 * - No AudioContext before a real user gesture, ever. Nothing autoplays. A
 *   stored "on" still waits for the next gesture before any node is created.
 * - Default off. The preference is stored, and a stored "on" never starts a cue
 *   or a bed on a page the reader has not touched.
 * - Nothing is scheduled on a frame loop. Every modulation (filter sweep, air
 *   breathing, the fan's wander) lives in the audio graph as an oscillator
 *   driving an AudioParam. The two signals that do come from the page — scroll
 *   velocity and the flight's depth — are pushed in by the loops that already
 *   run, and settle on their own when those loops stop.
 * - Every cue is safe to call while disabled, during teardown, or without
 *   WebAudio. Every room is released; `inspect()` reports the live node count.
 */

const STORAGE_KEY = 'portfolio:sound'

/** Minimum gap between hover ticks. Bursty pointer moves must not turn into a rattle. */
const HOVER_GAP_MS = 125
/** Section transitions can fire in quick succession on fast scrolls; keep it sparse. */
const OPEN_GAP_MS = 320
/** The veil already gates itself at 1.1 s; this is the second lock on the same door. */
const BRUSH_GAP_MS = 420
/** Six marks a second is already faster than a hand can read them. */
const NODE_GAP_MS = 160
/** Air accents while the passage moves. */
const DEPTH_GAP_MS = 180
/** A creak is an event, not a texture. */
const CREAK_GAP_MS = 520

/** Below this the passage is at its mouth: no accent, nothing to hear yet. */
const DEPTH_FLOOR = 0.06
/** And it has to have moved at least this much since the last accent. */
const DEPTH_STEP = 0.02

/** A throw, not a reading scroll. */
const CREAK_FLOOR = 0.34

/**
 * The page reports 0 as soon as the scroll stops, so the bed settles on its own
 * through the filter's release. This timer covers the other case — the loop
 * stops being called at all (a hidden tab, the atmosphere off-screen) while a
 * throw is still open. 120 ms without a call and the bed is put back at rest,
 * which the release finishes in about 300 ms: inside the 400 ms it is allowed.
 */
const VELOCITY_HOLD_MS = 120

/** Cues that can be bound to an element: no arguments, nothing to decide. */
export type CueName = 'click' | 'ping' | 'hover' | 'open' | 'brush'

/** Every cue the engine can fire, including the ones the page never binds. */
type FiredCue = CueName | 'boot' | 'node' | 'depth' | 'creak'

const GAP: Record<FiredCue, number> = {
  click: 0,
  ping: 0,
  hover: HOVER_GAP_MS,
  open: OPEN_GAP_MS,
  brush: BRUSH_GAP_MS,
  boot: 0,
  node: NODE_GAP_MS,
  depth: DEPTH_GAP_MS,
  creak: CREAK_GAP_MS,
}

/**
 * Reduced motion removes everything the page does on its own: beds do not
 * exist, and the cues tied to movement do not fire. What is left is the sound
 * of the reader's own hand — a click, a hover, a mark.
 */
const KIND: Record<FiredCue, 'user' | 'motion'> = {
  click: 'user',
  hover: 'user',
  node: 'user',
  ping: 'motion',
  open: 'motion',
  brush: 'motion',
  boot: 'motion',
  depth: 'motion',
  creak: 'motion',
}

const REDUCED_CUE_SCALE = 0.62

export type SoundListener = (enabled: boolean) => void

/** What `inspect()` reports. Also the contract the validation reads. */
export type SoundState = {
  enabled: boolean
  ctx: AudioContextState | 'none'
  room: RoomId | null
  beds: number
  nodes: number
  timers: number
  /** Cues fired since the page loaded. */
  fired: number
  /** The master gain's current value, so a fade can be watched. */
  master: number
  /** The current room's noise-path cutoff, in Hz. */
  tone: number | null
  last: CueStamp | null
  levels: Partial<Record<RoomId, number>>
}

/* -------------------------------------------------------------------------- */
/* helpers                                                                    */
/* -------------------------------------------------------------------------- */

function nowMs(): number {
  return typeof performance === 'undefined' ? Date.now() : performance.now()
}

function readStoredPreference(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

/* -------------------------------------------------------------------------- */
/* engine                                                                     */
/* -------------------------------------------------------------------------- */

class SoundEngine {
  #enabled = false
  #disposed = false
  #graph: Foundry | null = null
  #rooms: RoomBank | null = null
  #cues: CueBank | null = null
  #listeners = new Set<SoundListener>()
  #lastFired: Partial<Record<FiredCue, number>> = {}
  #lastStamp: CueStamp | null = null
  #fired = 0
  #motion: MediaQueryList | null = null
  #motionHandler: (() => void) | null = null
  #gestureHandler: (() => void) | null = null
  #armed = false
  #booted = false

  /** The room the reader is in, whether or not sound is on. */
  #wanted: RoomId = 'paper'
  #velocityTimer = 0
  #lastDepth = -1

  constructor() {
    this.#enabled = readStoredPreference()
    this.#watchMotion()
    // A stored "on" is honoured only once the visitor touches the page again.
    if (this.#enabled) this.#armForGesture()
  }

  /* ------------------------------- public API ------------------------------ */

  enable = (): void => {
    if (this.#disposed) return
    const alreadyOn = this.#enabled
    this.#enabled = true
    if (!alreadyOn) {
      this.#persist(true)
      this.#emit()
    }
    const graph = this.#ensureGraph()
    if (!graph) return
    this.#wake(graph)
  }

  disable = (): void => {
    if (this.#disposed) return
    this.#disarm()
    const wasOn = this.#enabled
    this.#enabled = false
    if (wasOn) {
      this.#persist(false)
      this.#emit()
    }

    const graph = this.#graph
    if (!graph) return
    const { ctx } = graph
    const now = ctx.currentTime

    holdAt(graph.master.gain, now)
    graph.master.gain.setTargetAtTime(0.0001, now, 0.06)

    if (this.#velocityTimer !== 0) {
      graph.cancel(this.#velocityTimer)
      this.#velocityTimer = 0
    }
    this.#rooms?.dispose(0.12)
    this.#rooms = null

    // Let the tail die, then park the context so a muted page costs nothing.
    graph.later(() => {
      if (!this.#graph || this.#enabled) return
      if (this.#graph.ctx.state === 'running') {
        void this.#graph.ctx.suspend().catch(() => undefined)
      }
    }, 700)
  }

  toggle = (): boolean => {
    if (this.#enabled) this.disable()
    else this.enable()
    return this.#enabled
  }

  isEnabled = (): boolean => this.#enabled

  subscribe = (listener: SoundListener): (() => void) => {
    this.#listeners.add(listener)
    return () => {
      this.#listeners.delete(listener)
    }
  }

  /* --------------------------------- cues --------------------------------- */

  /** Soft relay tick — the default interface acknowledgement. */
  click = (): void => {
    this.#play('click')
  }

  /** Sonar reading — for section arrivals, never for buttons. */
  ping = (): void => {
    this.#play('ping')
  }

  /** Barely-there tick for pointer travel. Rate-limited. */
  hover = (): void => {
    this.#play('hover')
  }

  /** Filtered swell for a section transition. Rate-limited. */
  open = (): void => {
    this.#play('open')
  }

  /** The plate change: one sheet of paper turned over. */
  brush = (): void => {
    this.#play('brush')
  }

  /** The boot plate engaging. One per page, and only with sound already on. */
  boot = (): void => {
    if (this.#booted) return
    this.#booted = true
    this.#play('boot')
  }

  /**
   * A mark under the pointer: pitch is its plan, pan is its x.
   * `x` is the mark's position, normalised to −1…1.
   */
  node = (x: number, tier: NodeTier = 'edge'): void => {
    this.#play('node', clamp(x, -1, 1), tier)
  }

  /**
   * The passage's depth, 0…1, pushed from the flight's own frame. Muted below
   * the mouth, rate-limited above it, and never a bed: `#play` refuses it under
   * reduced motion.
   */
  depth = (p: number): void => {
    if (this.#disposed) return
    const value = clamp01(p)
    this.#rooms?.setDepth(value)

    if (value < DEPTH_FLOOR) return
    if (this.#lastDepth >= 0 && Math.abs(value - this.#lastDepth) < DEPTH_STEP) return
    this.#lastDepth = value

    // Called from a scroll loop: it may not create a context on its own.
    const graph = this.#graph
    if (!graph || graph.ctx.state !== 'running') return
    this.#play('depth', 0, 'edge', value)
  }

  /**
   * The page's scroll speed, 0…1, pushed from the atmosphere's frame. It opens
   * the current room's low pass and, at speed, creaks. When the page settles the
   * calls stop; the bed is back at rest ~400 ms later.
   */
  velocity = (v: number): void => {
    if (this.#disposed) return
    const value = clamp01(Math.abs(v))
    this.#rooms?.setVelocity(value)

    const graph = this.#graph
    if (!graph) return
    if (value > 0) {
      if (this.#velocityTimer !== 0) graph.cancel(this.#velocityTimer)
      this.#velocityTimer = graph.later(() => {
        this.#velocityTimer = 0
        this.#rooms?.setVelocity(0)
      }, VELOCITY_HOLD_MS)
    } else if (this.#velocityTimer !== 0) {
      // The page has already told us it is at rest; nothing left to settle.
      graph.cancel(this.#velocityTimer)
      this.#velocityTimer = 0
    }

    if (value <= CREAK_FLOOR) return
    if (!this.#enabled || graph.ctx.state !== 'running') return
    this.#play('creak', 0, 'edge', (value - CREAK_FLOOR) / (1 - CREAK_FLOOR))
  }

  /* -------------------------------- rooms --------------------------------- */

  /** Cross to a room. Safe to call while disabled: it is remembered for later. */
  room = (id: RoomId): void => {
    if (this.#disposed) return
    this.#wanted = id
    const graph = this.#graph
    if (!this.#enabled || !graph) return
    this.#ensureRooms(graph)?.enter(id)
  }

  /**
   * A section was reached: cross to its room and mark the arrival.
   *
   * ```ts
   * if (id !== current) sound.arrive(id)
   * ```
   *
   * An id with no room is not a place on this sheet: nothing crosses and no cue
   * is played, so a page the sound layer was never taught about stays silent
   * rather than being pulled into the paper room.
   */
  arrive = (sectionId: string): void => {
    const room = roomOf(sectionId)
    if (!room) return
    this.room(room)
    this.#play('open')
  }

  /** What the engine is doing, for a debug overlay or a validation run. */
  inspect = (): SoundState => ({
    enabled: this.#enabled,
    ctx: this.#graph ? this.#graph.ctx.state : 'none',
    room: this.#rooms?.current ?? null,
    beds: this.#rooms?.count ?? 0,
    nodes: this.#graph?.count() ?? 0,
    timers: this.#graph?.timers() ?? 0,
    fired: this.#fired,
    master: this.#graph ? Math.round(this.#graph.master.gain.value * 1000) / 1000 : 0,
    tone: this.#rooms?.tone() ?? null,
    last: this.#lastStamp,
    levels: this.#rooms?.levels() ?? {},
  })

  /**
   * Dev-only: the master bus, so a validation run can tap an analyser onto it.
   * Nothing in the app calls this; it exists so the rooms can be measured
   * rather than described.
   */
  tap = (): AudioNode | null => this.#graph?.master ?? null

  dispose = (): void => {
    if (this.#disposed) return
    this.#disposed = true
    this.#disarm()
    this.#unwatchMotion()
    this.#listeners.clear()

    const graph = this.#graph
    this.#graph = null
    this.#cues = null
    this.#rooms?.dispose(0.05)
    this.#rooms = null
    this.#enabled = false
    this.#velocityTimer = 0
    this.#lastDepth = -1

    graph?.dispose()
  }

  /* -------------------------------- plumbing ------------------------------- */

  #play(name: FiredCue, x = 0, tier: NodeTier = 'edge', p = 0): CueStamp | null {
    if (!this.#enabled || this.#disposed) return null
    if (KIND[name] === 'motion' && this.#prefersReducedMotion()) return null
    if (!this.#gate(name)) return null
    // A stored "on" waits for a gesture: no context, and no cue, before one.
    if (!this.#graph && this.#armed) return null

    const graph = this.#ensureGraph()
    if (!graph) return null

    // Cues are usually fired from a gesture, but if the context was parked
    // (muted then re-enabled, or a backgrounded tab) nudge it back.
    if (graph.ctx.state !== 'running') {
      void graph.ctx.resume().catch(() => undefined)
      if (graph.ctx.state === 'suspended') this.#armForGesture()
    }

    const cues = this.#cues
    if (!cues) return null
    const scale = this.#cueScale()

    let stamp: CueStamp
    switch (name) {
      case 'click':
        stamp = cues.click(scale)
        break
      case 'ping':
        stamp = cues.ping(scale)
        break
      case 'hover':
        stamp = cues.hover(scale)
        break
      case 'open':
        stamp = cues.open(scale)
        break
      case 'brush':
        stamp = cues.brush(scale)
        break
      case 'boot':
        stamp = cues.boot(scale)
        break
      case 'node':
        stamp = cues.node(x, tier, scale)
        break
      case 'depth':
        stamp = cues.depth(p, scale)
        break
      default:
        stamp = cues.creak(p, scale)
        break
    }

    this.#lastStamp = stamp
    this.#fired += 1
    return stamp
  }

  #gate(name: FiredCue): boolean {
    const gapMs = GAP[name]
    if (gapMs <= 0) return true
    const stamp = nowMs()
    const last = this.#lastFired[name]
    if (last !== undefined && stamp - last < gapMs) return false
    this.#lastFired[name] = stamp
    return true
  }

  #ensureGraph(): Foundry | null {
    if (this.#disposed) return null
    if (this.#graph) return this.#graph
    const graph = Foundry.create()
    if (!graph) return null
    this.#graph = graph
    this.#cues = new CueBank(graph)
    return graph
  }

  /**
   * The room bank exists only if the reader has not asked for reduced motion.
   * This is the single gate that guarantees a reduced-motion session holds zero
   * beds — not a faded bed, not a suspended one.
   */
  #ensureRooms(graph: Foundry): RoomBank | null {
    if (this.#prefersReducedMotion()) return null
    if (!this.#rooms) this.#rooms = new RoomBank(graph)
    return this.#rooms
  }

  #wake(graph: Foundry): void {
    const { ctx } = graph
    if (ctx.state !== 'running') {
      void ctx.resume().catch(() => undefined)
      if (ctx.state === 'suspended') this.#armForGesture()
    }

    const now = ctx.currentTime
    const held = holdAt(graph.master.gain, now)
    graph.master.gain.setValueAtTime(held, now)
    graph.master.gain.exponentialRampToValueAtTime(MASTER_LEVEL, now + 0.06)

    // Enabling at #territory starts the machine room, not paper: the reader is
    // already somewhere.
    this.#ensureRooms(graph)?.enter(this.#wanted)
  }

  #persist(on: boolean): void {
    if (typeof window === 'undefined') return
    try {
      window.localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
    } catch {
      /* private mode / quota — the in-memory state still applies for this visit */
    }
  }

  #emit(): void {
    for (const listener of [...this.#listeners]) {
      try {
        listener(this.#enabled)
      } catch {
        /* a broken subscriber must not break sound for everyone else */
      }
    }
  }

  #cueScale(): number {
    return this.#prefersReducedMotion() ? REDUCED_CUE_SCALE : 1
  }

  /* ------------------------------ motion pref ------------------------------ */

  #watchMotion(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    if (this.#motion) return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => {
      const graph = this.#graph
      if (!graph) return
      if (query.matches) {
        // Zero beds, immediately: not a faster fade, not a muted bed.
        this.#rooms?.dispose(0.4)
        this.#rooms = null
      } else if (this.#enabled) {
        this.#ensureRooms(graph)?.enter(this.#wanted)
      }
    }

    if (typeof query.addEventListener === 'function') query.addEventListener('change', handler)
    else query.addListener(handler)

    this.#motion = query
    this.#motionHandler = handler
  }

  #unwatchMotion(): void {
    const query = this.#motion
    const handler = this.#motionHandler
    if (!query || !handler) return
    if (typeof query.removeEventListener === 'function') query.removeEventListener('change', handler)
    else query.removeListener(handler)
    this.#motion = null
    this.#motionHandler = null
  }

  #prefersReducedMotion(): boolean {
    return this.#motion?.matches ?? false
  }

  /* --------------------------- autoplay unlocking -------------------------- */

  #armForGesture(): void {
    if (this.#armed || this.#disposed || typeof window === 'undefined') return
    this.#armed = true
    const handler = () => {
      this.#disarm()
      if (!this.#enabled) return
      const graph = this.#ensureGraph()
      if (graph) this.#wake(graph)
    }
    this.#gestureHandler = handler
    window.addEventListener('pointerdown', handler, { capture: true, passive: true })
    window.addEventListener('keydown', handler, { capture: true, passive: true })
  }

  #disarm(): void {
    const handler = this.#gestureHandler
    if (!handler || typeof window === 'undefined') return
    window.removeEventListener('pointerdown', handler, { capture: true })
    window.removeEventListener('keydown', handler, { capture: true })
    this.#gestureHandler = null
    this.#armed = false
  }
}

/* -------------------------------------------------------------------------- */
/* singleton + integration helpers                                            */
/* -------------------------------------------------------------------------- */

export const sound = new SoundEngine()

export type SoundApi = typeof sound
export type { CueStamp, NodeTier, RoomId }

/**
 * Bind a cue to an element without repeating event plumbing:
 *
 * ```tsx
 * useEffect(() => bindCue(buttonRef.current, 'click'), [])
 * ```
 *
 * `hover` listens to `pointerenter`; every other cue listens to `click` (which
 * already covers keyboard activation on native buttons). Returns its own cleanup.
 */
export function bindCue(element: HTMLElement | null, cue: CueName = 'click'): () => void {
  if (!element) return () => undefined
  const eventName = cue === 'hover' ? 'pointerenter' : 'click'
  const handler = () => {
    sound[cue]()
  }
  element.addEventListener(eventName, handler)
  return () => element.removeEventListener(eventName, handler)
}

/**
 * The dev handle. `window.__sound` exists only in `vite dev`, where it is what
 * the browser validation drives; a production bundle carries nothing.
 */
if (import.meta.env.DEV && typeof window !== 'undefined') {
  ;(window as unknown as { __sound?: SoundEngine }).__sound = sound
}

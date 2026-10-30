/**
 * Sound layer — entirely synthesized with the Web Audio API.
 *
 * Design thesis: the sound of an operated territory, not a soundtrack. Relay ticks,
 * a sonar reading, the low room tone of a machine hall. No melody, no rhythm, no
 * chase music. Everything is quiet enough that the site still reads as a document.
 *
 * Rules this module enforces:
 * - No AudioContext before a real user gesture, ever. Nothing autoplays.
 * - Default off. The preference is stored, but a stored "on" still waits for the
 *   next gesture before any node is created (browser autoplay policy + etiquette).
 * - Nothing is scheduled on a frame loop. Every modulation (filter sweep, air
 *   breathing) lives in the audio graph as an oscillator driving an AudioParam.
 * - Every cue is safe to call while disabled, during teardown, or without WebAudio.
 */

const STORAGE_KEY = 'portfolio:sound'

/** Master ceiling: ≈ −18.4 dBFS. All mixes below are relative to this. */
const MASTER_LEVEL = 0.12
/** Ambient bed bus. Deliberately below the threshold of attention. */
const AMBIENT_LEVEL = 0.13
/** Minimum gap between hover ticks. Bursty pointer moves must not turn into a rattle. */
const HOVER_GAP_MS = 125
/** Section transitions can fire in quick succession on fast scrolls; keep it sparse. */
const OPEN_GAP_MS = 320

const CUE_PEAK = {
  click: 0.55,
  ping: 0.3,
  hover: 0.08,
  open: 0.3,
} as const

const REDUCED_CUE_SCALE = 0.58

export type CueName = keyof typeof CUE_PEAK
export type SoundListener = (enabled: boolean) => void

type Graph = {
  ctx: AudioContext
  master: GainNode
  cueBus: GainNode
  ambientBus: GainNode
  roomIn: GainNode
  white: AudioBuffer
  pink: AudioBuffer
}

type AmbientRig = {
  bus: GainNode
  nodes: AudioNode[]
  sources: AudioScheduledSourceNode[]
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

/**
 * Cancel pending automation without jumping: `cancelAndHoldAtTime` keeps the value
 * the parameter currently has, so ramps never snap back to a stale target (which
 * is exactly how clicks and pops are born).
 */
function holdAt(param: AudioParam, at: number): number {
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(at)
  else param.cancelScheduledValues(at)
  return Math.max(param.value, 0.0001)
}

function disconnectAll(nodes: AudioNode[]): void {
  for (const node of nodes) {
    try {
      node.disconnect()
    } catch {
      /* already detached — nothing to do */
    }
  }
}

function makeNoiseBuffer(ctx: AudioContext, seconds: number, kind: 'white' | 'pink'): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
  const data = buffer.getChannelData(0)

  if (kind === 'white') {
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1
    return buffer
  }

  // Pink-ish noise (Kellet approximation): less hiss than white, closer to real air.
  let b0 = 0
  let b1 = 0
  let b2 = 0
  let b3 = 0
  let b4 = 0
  let b5 = 0
  let b6 = 0
  for (let i = 0; i < length; i += 1) {
    const white = Math.random() * 2 - 1
    b0 = 0.99886 * b0 + white * 0.0555179
    b1 = 0.99332 * b1 + white * 0.0750759
    b2 = 0.969 * b2 + white * 0.153852
    b3 = 0.8665 * b3 + white * 0.3104856
    b4 = 0.55 * b4 + white * 0.5329522
    b5 = -0.7616 * b5 - white * 0.016898
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11
    b6 = white * 0.115926
  }
  return buffer
}

/**
 * A small dark room rather than a reverb: 1.5 s of decaying filtered noise with a
 * 14 ms pre-delay. Gives the cues a place to happen without smearing the transient.
 */
function makeRoomImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const preDelay = Math.floor(ctx.sampleRate * 0.014)
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)

  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    let lowpassed = 0
    for (let i = preDelay; i < length; i += 1) {
      const t = (i - preDelay) / ctx.sampleRate
      const noise = Math.random() * 2 - 1
      lowpassed += 0.24 * (noise - lowpassed)
      data[i] = lowpassed * Math.exp(-t * decay)
    }
  }
  return buffer
}

/* -------------------------------------------------------------------------- */
/* engine                                                                     */
/* -------------------------------------------------------------------------- */

class SoundEngine {
  #enabled = false
  #disposed = false
  #graph: Graph | null = null
  #ambient: AmbientRig | null = null
  #listeners = new Set<SoundListener>()
  #timers = new Set<number>()
  #lastFired: Partial<Record<CueName, number>> = {}
  #motion: MediaQueryList | null = null
  #motionHandler: (() => void) | null = null
  #gestureHandler: (() => void) | null = null
  #armed = false

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
    this.#stopAmbient(graph, 0.1)

    // Let the tail die, then park the context so a muted page costs nothing.
    this.#later(() => {
      const current = this.#graph
      if (!current || this.#enabled) return
      if (current.ctx.state === 'running') void current.ctx.suspend().catch(() => undefined)
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

  /** Soft relay tick — the default interface acknowledgement. */
  click = (): void => this.#fire('click')
  /** Sonar reading — for section arrivals, never for buttons. */
  ping = (): void => this.#fire('ping')
  /** Barely-there tick for pointer travel. Rate-limited. */
  hover = (): void => this.#fire('hover')
  /** Filtered swell for a section transition. Rate-limited. */
  open = (): void => this.#fire('open')

  dispose = (): void => {
    if (this.#disposed) return
    this.#disposed = true
    this.#disarm()
    this.#unwatchMotion()

    if (typeof window !== 'undefined') {
      for (const id of this.#timers) window.clearTimeout(id)
    }
    this.#timers.clear()
    this.#listeners.clear()

    const graph = this.#graph
    const ambient = this.#ambient
    this.#graph = null
    this.#ambient = null
    this.#enabled = false

    if (!graph) return
    if (ambient) disconnectAll(ambient.nodes)
    disconnectAll([graph.master, graph.cueBus, graph.ambientBus, graph.roomIn])
    void graph.ctx.close().catch(() => undefined)
  }

  /* -------------------------------- plumbing ------------------------------- */

  #fire(name: CueName): void {
    if (!this.#enabled || this.#disposed) return
    if (name === 'hover' && !this.#gate('hover', HOVER_GAP_MS)) return
    if (name === 'open' && !this.#gate('open', OPEN_GAP_MS)) return

    const graph = this.#ensureGraph()
    if (!graph) return

    // Cues are usually fired from a gesture, but if the context was parked (muted
    // then re-enabled, or a backgrounded tab) nudge it back without awaiting.
    if (graph.ctx.state !== 'running') {
      void graph.ctx.resume().catch(() => undefined)
      if (graph.ctx.state === 'suspended') this.#armForGesture()
    }

    if (name === 'click') this.#playClick(graph)
    else if (name === 'ping') this.#playPing(graph)
    else if (name === 'hover') this.#playHover(graph)
    else this.#playOpen(graph)
  }

  #gate(name: CueName, gapMs: number): boolean {
    const stamp = nowMs()
    const last = this.#lastFired[name]
    if (last !== undefined && stamp - last < gapMs) return false
    this.#lastFired[name] = stamp
    return true
  }

  #ensureGraph(): Graph | null {
    if (this.#disposed || typeof window === 'undefined') return null
    if (this.#graph) return this.#graph

    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return null

    let ctx: AudioContext
    try {
      ctx = new Ctor({ latencyHint: 'interactive' })
    } catch {
      return null
    }

    const master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)

    const cueBus = ctx.createGain()
    cueBus.gain.value = 1
    cueBus.connect(master)

    const ambientBus = ctx.createGain()
    ambientBus.gain.value = 0
    ambientBus.connect(master)

    // One shared room for every cue. Initialised here (inside a gesture) only.
    const roomIn = ctx.createGain()
    roomIn.gain.value = 1
    const convolver = ctx.createConvolver()
    convolver.buffer = makeRoomImpulse(ctx, 1.5, 4.4)
    const roomReturn = ctx.createGain()
    roomReturn.gain.value = 0.32
    roomIn.connect(convolver)
    convolver.connect(roomReturn)
    roomReturn.connect(master)

    const graph: Graph = {
      ctx,
      master,
      cueBus,
      ambientBus,
      roomIn,
      white: makeNoiseBuffer(ctx, 2, 'white'),
      pink: makeNoiseBuffer(ctx, 2, 'pink'),
    }
    this.#graph = graph
    return graph
  }

  #wake(graph: Graph): void {
    const { ctx } = graph
    if (ctx.state !== 'running') {
      void ctx.resume().catch(() => undefined)
      if (ctx.state === 'suspended') this.#armForGesture()
    }

    const now = ctx.currentTime
    const held = holdAt(graph.master.gain, now)
    graph.master.gain.setValueAtTime(held, now)
    graph.master.gain.exponentialRampToValueAtTime(MASTER_LEVEL, now + 0.06)

    if (!this.#prefersReducedMotion()) this.#startAmbient(graph)
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

  #later(fn: () => void, ms: number): void {
    if (typeof window === 'undefined') return
    const id = window.setTimeout(() => {
      this.#timers.delete(id)
      fn()
    }, ms)
    this.#timers.add(id)
  }

  /** Release a cue's private nodes once its tail has finished. */
  #release(nodes: AudioNode[], afterMs: number): void {
    this.#later(() => disconnectAll(nodes), afterMs)
  }

  #cueScale(): number {
    return this.#prefersReducedMotion() ? REDUCED_CUE_SCALE : 1
  }

  #idlePanner(ctx: AudioContext, spread: number): StereoPannerNode {
    const panner = ctx.createStereoPanner()
    panner.pan.value = (Math.random() - 0.5) * spread
    return panner
  }

  /* --------------------------------- cues ---------------------------------- */

  #playClick(graph: Graph): void {
    const { ctx } = graph
    const t = ctx.currentTime + 0.004
    const vary = 0.93 + Math.random() * 0.14
    const peak = CUE_PEAK.click * vary * this.#cueScale()

    const panner = this.#idlePanner(ctx, 0.14)
    panner.connect(graph.cueBus)
    const send = ctx.createGain()
    send.gain.value = 0.14
    panner.connect(send)
    send.connect(graph.roomIn)

    // Contact: a short highpassed noise scrape.
    const tick = ctx.createBufferSource()
    tick.buffer = graph.white
    const highpass = ctx.createBiquadFilter()
    highpass.type = 'highpass'
    highpass.frequency.value = 1700 + Math.random() * 500
    highpass.Q.value = 0.6
    const tickEnv = ctx.createGain()
    tickEnv.gain.setValueAtTime(0.0001, t)
    tickEnv.gain.exponentialRampToValueAtTime(peak, t + 0.0015)
    tickEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.018)
    tick.connect(highpass)
    highpass.connect(tickEnv)
    tickEnv.connect(panner)

    // Mass: a low body that makes it a switch and not a beep.
    const body = ctx.createOscillator()
    body.type = 'triangle'
    body.frequency.setValueAtTime(188 * vary, t)
    body.frequency.exponentialRampToValueAtTime(142 * vary, t + 0.04)
    const bodyLp = ctx.createBiquadFilter()
    bodyLp.type = 'lowpass'
    bodyLp.frequency.value = 760
    bodyLp.Q.value = 0.5
    const bodyEnv = ctx.createGain()
    bodyEnv.gain.setValueAtTime(0.0001, t)
    bodyEnv.gain.exponentialRampToValueAtTime(peak * 0.5, t + 0.0025)
    bodyEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    body.connect(bodyLp)
    bodyLp.connect(bodyEnv)
    bodyEnv.connect(panner)

    tick.start(t, Math.random() * 1.5)
    tick.stop(t + 0.03)
    body.start(t)
    body.stop(t + 0.08)

    this.#release([tick, highpass, tickEnv, body, bodyLp, bodyEnv, panner, send], 180)
  }

  #playPing(graph: Graph): void {
    const { ctx } = graph
    const t = ctx.currentTime + 0.003
    const base = 806 * (0.98 + Math.random() * 0.04)
    const peak = CUE_PEAK.ping * this.#cueScale()

    const panner = this.#idlePanner(ctx, 0.36)
    panner.connect(graph.cueBus)
    const send = ctx.createGain()
    send.gain.value = 0.4
    panner.connect(send)
    send.connect(graph.roomIn)

    const body = ctx.createOscillator()
    body.type = 'sine'
    body.frequency.setValueAtTime(base, t)
    body.frequency.exponentialRampToValueAtTime(base * 0.76, t + 1.2)

    // The tail darkens as it travels: a reading, not a chime.
    const tone = ctx.createBiquadFilter()
    tone.type = 'lowpass'
    tone.Q.value = 0.4
    tone.frequency.setValueAtTime(3800, t)
    tone.frequency.exponentialRampToValueAtTime(820, t + 1.1)

    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(peak, t + 0.005)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)

    body.connect(tone)
    tone.connect(env)
    env.connect(panner)

    // Faint octave partial — the steel of the transducer.
    const edge = ctx.createOscillator()
    edge.type = 'sine'
    edge.frequency.setValueAtTime(base * 2.01, t)
    edge.frequency.exponentialRampToValueAtTime(base * 1.62, t + 0.3)
    const edgeEnv = ctx.createGain()
    edgeEnv.gain.setValueAtTime(0.0001, t)
    edgeEnv.gain.exponentialRampToValueAtTime(peak * 0.12, t + 0.004)
    edgeEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.34)
    edge.connect(edgeEnv)
    edgeEnv.connect(panner)

    body.start(t)
    body.stop(t + 1.45)
    edge.start(t)
    edge.stop(t + 0.4)

    this.#release([body, tone, env, edge, edgeEnv, panner, send], 1550)
  }

  #playHover(graph: Graph): void {
    const { ctx } = graph
    const t = ctx.currentTime + 0.002
    const peak = CUE_PEAK.hover * this.#cueScale()

    const source = ctx.createBufferSource()
    source.buffer = graph.white
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.frequency.value = 4200 + Math.random() * 1400
    band.Q.value = 1.4
    const env = ctx.createGain()
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(peak, t + 0.0008)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.012)

    source.connect(band)
    band.connect(env)
    env.connect(graph.cueBus)

    source.start(t, Math.random() * 1.5)
    source.stop(t + 0.02)

    this.#release([source, band, env], 90)
  }

  #playOpen(graph: Graph): void {
    const { ctx } = graph
    const t = ctx.currentTime + 0.005
    const peak = CUE_PEAK.open * this.#cueScale()

    const panner = this.#idlePanner(ctx, 0.2)
    panner.connect(graph.cueBus)
    const send = ctx.createGain()
    send.gain.value = 0.45
    panner.connect(send)
    send.connect(graph.roomIn)

    // Air opening: band rises as the pressure changes.
    const air = ctx.createBufferSource()
    air.buffer = graph.white
    const band = ctx.createBiquadFilter()
    band.type = 'bandpass'
    band.Q.value = 0.8
    band.frequency.setValueAtTime(240, t)
    band.frequency.exponentialRampToValueAtTime(1500, t + 0.5)
    const airEnv = ctx.createGain()
    airEnv.gain.setValueAtTime(0.0001, t)
    airEnv.gain.exponentialRampToValueAtTime(peak, t + 0.17)
    airEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.66)
    air.connect(band)
    band.connect(airEnv)
    airEnv.connect(panner)

    // Pressure underneath it.
    const sub = ctx.createOscillator()
    sub.type = 'sine'
    sub.frequency.setValueAtTime(78, t)
    sub.frequency.exponentialRampToValueAtTime(44, t + 0.55)
    const subEnv = ctx.createGain()
    subEnv.gain.setValueAtTime(0.0001, t)
    subEnv.gain.exponentialRampToValueAtTime(peak * 0.7, t + 0.08)
    subEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
    sub.connect(subEnv)
    subEnv.connect(panner)

    air.start(t, Math.random() * 1.2)
    air.stop(t + 0.7)
    sub.start(t)
    sub.stop(t + 0.65)

    this.#release([air, band, airEnv, sub, subEnv, panner, send], 800)
  }

  /* -------------------------------- ambient -------------------------------- */

  #startAmbient(graph: Graph): void {
    if (this.#ambient || this.#prefersReducedMotion()) return
    const { ctx } = graph
    const t = ctx.currentTime

    const bus = ctx.createGain()
    bus.gain.value = 0.0001
    bus.connect(graph.ambientBus)

    // Room air: a looped pink noise through a low pass that never quite settles.
    const air = ctx.createBufferSource()
    air.buffer = graph.pink
    air.loop = true
    const lowpass = ctx.createBiquadFilter()
    lowpass.type = 'lowpass'
    lowpass.frequency.value = 520
    lowpass.Q.value = 0.55
    const airGain = ctx.createGain()
    airGain.gain.value = 0.82

    // 18 s sweep on the cutoff — slow enough to read as space, not movement.
    const sweep = ctx.createOscillator()
    sweep.type = 'sine'
    sweep.frequency.value = 0.055
    const sweepDepth = ctx.createGain()
    sweepDepth.gain.value = 168

    // 32 s breath on the air level.
    const breathe = ctx.createOscillator()
    breathe.type = 'sine'
    breathe.frequency.value = 0.031
    const breatheDepth = ctx.createGain()
    breatheDepth.gain.value = 0.2

    // Transformer drone: two sines ~0.3 Hz apart, felt more than heard.
    const droneA = ctx.createOscillator()
    droneA.type = 'sine'
    droneA.frequency.value = 57.3
    const droneAGain = ctx.createGain()
    droneAGain.gain.value = 0.62

    const droneB = ctx.createOscillator()
    droneB.type = 'sine'
    droneB.frequency.value = 57.62
    const droneBGain = ctx.createGain()
    droneBGain.gain.value = 0.2

    const droneSum = ctx.createGain()
    droneSum.gain.value = 0.55

    air.connect(lowpass)
    lowpass.connect(airGain)
    airGain.connect(bus)
    sweep.connect(sweepDepth)
    sweepDepth.connect(lowpass.frequency)
    breathe.connect(breatheDepth)
    breatheDepth.connect(airGain.gain)
    droneA.connect(droneAGain)
    droneB.connect(droneBGain)
    droneAGain.connect(droneSum)
    droneBGain.connect(droneSum)
    droneSum.connect(bus)

    // Settles in over ~4 s so it is discovered rather than announced.
    bus.gain.setTargetAtTime(AMBIENT_LEVEL, t + 0.2, 1.15)

    air.start(t)
    sweep.start(t)
    breathe.start(t)
    droneA.start(t)
    droneB.start(t)

    this.#ambient = {
      bus,
      sources: [air, sweep, breathe, droneA, droneB],
      nodes: [bus, lowpass, airGain, sweepDepth, breatheDepth, droneAGain, droneBGain, droneSum],
    }
  }

  #stopAmbient(graph: Graph, fade: number): void {
    const rig = this.#ambient
    if (!rig) return
    this.#ambient = null
    const now = graph.ctx.currentTime
    const seconds = Math.max(0.03, fade)

    holdAt(rig.bus.gain, now)
    rig.bus.gain.setTargetAtTime(0.0001, now, seconds)

    const stopAt = now + seconds * 6
    for (const source of rig.sources) {
      try {
        source.stop(stopAt)
      } catch {
        /* already stopped */
      }
    }

    this.#release(rig.nodes, Math.max(160, (stopAt - now) * 1000 + 120))
  }

  /* ------------------------------ motion pref ------------------------------ */

  #watchMotion(): void {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    if (this.#motion) return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => {
      const graph = this.#graph
      if (!graph) return
      if (query.matches) this.#stopAmbient(graph, 0.4)
      else if (this.#enabled) this.#startAmbient(graph)
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
    if (typeof query.removeEventListener === 'function')
      query.removeEventListener('change', handler)
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
export function bindCue(
  element: HTMLElement | null,
  cue: CueName = 'click',
): () => void {
  if (!element) return () => undefined
  const eventName = cue === 'hover' ? 'pointerenter' : 'click'
  const handler = () => {
    sound[cue]()
  }
  element.addEventListener(eventName, handler)
  return () => element.removeEventListener(eventName, handler)
}

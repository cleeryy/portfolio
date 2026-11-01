/**
 * sound/graph.ts — the foundry
 *
 * One AudioContext, four buses, one room, and a ledger of every node the engine
 * has ever made. Everything else in `sound/` builds on this and nothing else
 * touches the context directly, so three properties can be stated once instead
 * of being re-argued in every cue:
 *
 * - **One gesture, one context.** `create()` is only ever reached from code that
 *   a real pointer or key event has already unlocked.
 * - **One room.** Every cue and every bed sends into the same convolver. Four
 *   beds in four rooms, all placed in the same acoustic; only their dry signal
 *   differs. A second reverb would be a second building.
 * - **One ledger.** Every node is booked when it is made and struck off when it
 *   is disconnected, so a leak is a number that climbs rather than a story about
 *   one. `count()` is what `inspect()` reports, and what the validation reads.
 *
 * Nothing here schedules on a frame loop. A bed is oscillators driving
 * `AudioParam`s; a cue is a handful of nodes that are built, fired and released.
 */

/** Master ceiling: ≈ −7.5 dBFS. All mixes below are relative to this. */
export const MASTER_LEVEL = 0.42

/** Cue reverb return. The one shared room. */
const REVERB_RETURN = 0.3
const REVERB_SECONDS = 1.5
const REVERB_DECAY = 4.4

/** Bed noise is longer than cue noise: a 2 s loop under a low pass is audible as a period. */
const BED_SECONDS = 6

export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  return value < 0 ? 0 : value > 1 ? 1 : value
}

export function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return value < min ? min : value > max ? max : value
}

/**
 * Cancel pending automation without jumping: `cancelAndHoldAtTime` keeps the
 * value the parameter currently has, so ramps never snap back to a stale target
 * (which is exactly how clicks and pops are born).
 */
export function holdAt(param: AudioParam, at: number): number {
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(at)
  else param.cancelScheduledValues(at)
  return Math.max(param.value, 0.0001)
}

function disconnectAll(nodes: Iterable<AudioNode>): void {
  for (const node of nodes) {
    try {
      node.disconnect()
    } catch {
      /* already detached — nothing to do */
    }
  }
}

function makeNoiseBuffer(
  ctx: AudioContext,
  seconds: number,
  kind: 'white' | 'pink',
): AudioBuffer {
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

export class Foundry {
  readonly ctx: AudioContext
  readonly master: GainNode
  readonly cueBus: GainNode
  readonly bedBus: GainNode
  readonly roomIn: GainNode
  readonly white: AudioBuffer
  readonly pink: AudioBuffer

  #bedBuffer: AudioBuffer | null = null
  #ledger = new Set<AudioNode>()
  #timers = new Set<number>()
  #closed = false

  static create(): Foundry | null {
    if (typeof window === 'undefined') return null
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
    return new Foundry(ctx)
  }

  constructor(ctx: AudioContext) {
    this.ctx = ctx

    const master = ctx.createGain()
    master.gain.value = 0
    master.connect(ctx.destination)

    const cueBus = ctx.createGain()
    cueBus.gain.value = 1
    cueBus.connect(master)

    const bedBus = ctx.createGain()
    bedBus.gain.value = 1
    // Subsonic guard: pink noise is 1/f, so most of its energy sits below
    // anything the rooms actually play. Under 22 Hz is headroom and speaker
    // travel, not sound; the ink room's 38 Hz passes with room to spare.
    const bedGuard = ctx.createBiquadFilter()
    bedGuard.type = 'highpass'
    bedGuard.frequency.value = 22
    bedGuard.Q.value = 0.5
    bedBus.connect(bedGuard)
    bedGuard.connect(master)

    // One shared room for every cue and every bed. Initialised here (inside a
    // gesture) only, so no impulse is ever generated on a muted page.
    const roomIn = ctx.createGain()
    roomIn.gain.value = 1
    const convolver = ctx.createConvolver()
    convolver.buffer = makeRoomImpulse(ctx, REVERB_SECONDS, REVERB_DECAY)
    const roomReturn = ctx.createGain()
    roomReturn.gain.value = REVERB_RETURN
    roomIn.connect(convolver)
    convolver.connect(roomReturn)
    roomReturn.connect(master)

    this.master = master
    this.cueBus = cueBus
    this.bedBus = bedBus
    this.roomIn = roomIn
    this.#ledger.add(master)
    this.#ledger.add(cueBus)
    this.#ledger.add(bedBus)
    this.#ledger.add(bedGuard)
    this.#ledger.add(roomIn)
    this.#ledger.add(convolver)
    this.#ledger.add(roomReturn)

    this.white = makeNoiseBuffer(ctx, 2, 'white')
    this.pink = makeNoiseBuffer(ctx, 2, 'pink')
  }

  /* ------------------------------ factories ------------------------------- */

  gain(value = 1): GainNode {
    const node = this.ctx.createGain()
    node.gain.value = value
    return this.#book(node)
  }

  biquad(type: BiquadFilterType, frequency: number, q = 0.707): BiquadFilterNode {
    const node = this.ctx.createBiquadFilter()
    node.type = type
    node.frequency.value = frequency
    node.Q.value = q
    return this.#book(node)
  }

  osc(type: OscillatorType, frequency: number): OscillatorNode {
    const node = this.ctx.createOscillator()
    node.type = type
    node.frequency.value = frequency
    return this.#book(node)
  }

  noise(buffer: AudioBuffer, loop = false): AudioBufferSourceNode {
    const node = this.ctx.createBufferSource()
    node.buffer = buffer
    node.loop = loop
    return this.#book(node)
  }

  panner(pan: number): StereoPannerNode {
    const node = this.ctx.createStereoPanner()
    node.pan.value = clamp(pan, -1, 1)
    return this.#book(node)
  }

  /** The long bed noise. Built on first use so a reduced-motion session never pays for it. */
  bedBuffer(): AudioBuffer {
    if (!this.#bedBuffer) this.#bedBuffer = makeNoiseBuffer(this.ctx, BED_SECONDS, 'pink')
    return this.#bedBuffer
  }

  /* ------------------------------- ledger --------------------------------- */

  #book<T extends AudioNode>(node: T): T {
    this.#ledger.add(node)
    return node
  }

  /**
   * Disconnect a cue's or a bed's private nodes once its tail has finished, and
   * strike them off the ledger. This is the only release path: a node that is
   * forgotten here shows up as a climbing `count()`.
   */
  release(nodes: AudioNode[], afterMs: number): void {
    if (this.#closed) {
      disconnectAll(nodes)
      for (const node of nodes) this.#ledger.delete(node)
      return
    }
    this.later(() => {
      disconnectAll(nodes)
      for (const node of nodes) this.#ledger.delete(node)
    }, Math.max(20, afterMs))
  }

  /** Stop a source at a future time without going through the ledger. */
  stopAt(sources: Iterable<AudioScheduledSourceNode>, at: number): void {
    for (const source of sources) {
      try {
        source.stop(at)
      } catch {
        /* already stopped */
      }
    }
  }

  later(fn: () => void, ms: number): number {
    if (this.#closed || typeof window === 'undefined') return 0
    const id = window.setTimeout(() => {
      this.#timers.delete(id)
      fn()
    }, ms)
    this.#timers.add(id)
    return id
  }

  cancel(id: number): void {
    if (id === 0 || typeof window === 'undefined') return
    window.clearTimeout(id)
    this.#timers.delete(id)
  }

  now(): number {
    return this.ctx.currentTime
  }

  count(): number {
    return this.#ledger.size
  }

  timers(): number {
    return this.#timers.size
  }

  get closed(): boolean {
    return this.#closed
  }

  dispose(): void {
    if (this.#closed) return
    this.#closed = true

    for (const id of this.#timers) window.clearTimeout(id)
    this.#timers.clear()

    disconnectAll(this.#ledger)
    this.#ledger.clear()
    this.#bedBuffer = null
    void this.ctx.close().catch(() => undefined)
  }
}

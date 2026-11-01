import { clamp01, holdAt, type Foundry } from './graph'

/**
 * sound/rooms.ts — four places, one building
 *
 * The old layer had one ambient bed. One bed is a texture: it says "the page is
 * alive", it does not say where you are. This module gives the sheet rooms.
 *
 * - **paper** — the sheet itself. Air through a low pass that never quite
 *   settles, a slow breath, and a hum two notes above nothing. The old bed,
 *   quieter, because it is now one room among four.
 * - **machine** — the rack. Fan noise in two bands, a transformer at 50 Hz with
 *   its beat and its harmonics, and a relay that closes every so often. The
 *   only room with events in it.
 * - **ink** — the dark chapter. Sub-bass pressure, a low rumble, almost no
 *   highs: the page has gone under and the room with it.
 * - **air** — the passage. Moving air in a band that the flight's depth opens
 *   and closes; a gust that wanders; a hiss at the top.
 *
 * Rules this module enforces, and why:
 *
 * - **A room is a rig, not a loop.** Each is built from oscillators and noise
 *   through filters. Nothing is loaded, nothing repeats on a bar.
 * - **Never a cut.** A change of room ramps the old bus down and the new one up
 *   with `setTargetAtTime` (τ = 0.16 out, 0.2 in), so each is within 2% of its
 *   target after 0.64 s / 0.8 s. The brief's window is 0.6–0.9 s.
 * - **Lazy, then let go.** A room is built the first time it is entered and
 *   destroyed 2.6 s after it has been left. A reader who walks the page once
 *   never holds more than two rigs; a reader who idles holds one.
 * - **Velocity opens the room, it does not drive it.** The scroll speed moves
 *   the noise path's low pass through a quarter of an octave or so. The bed
 *   never changes level with the scroll: a page that gets louder as you throw it
 *   is a game, not a document.
 */

export type RoomId = 'paper' | 'machine' | 'ink' | 'air'

export const ROOM_IDS: readonly RoomId[] = ['paper', 'machine', 'ink', 'air']

/**
 * Bus trim per room. `ink` sits highest because 38 Hz at the same amplitude is
 * heard far quieter than noise at 500 Hz; the number is a loudness correction,
 * not a taste.
 */
const LEVEL: Record<RoomId, number> = { paper: 0.14, machine: 0.125, ink: 0.17, air: 0.145 }

/** Reverb send per room: paper is close, the passage is the widest space on the site. */
const SEND: Record<RoomId, number> = { paper: 0.2, machine: 0.14, ink: 0.1, air: 0.24 }

/**
 * The noise path's low pass at rest, and how far the scroll velocity opens it.
 * `ink` deliberately barely moves: its whole character is that the top is gone.
 */
const TONE: Record<RoomId, { base: number; span: number }> = {
  paper: { base: 1400, span: 5200 },
  machine: { base: 1000, span: 4600 },
  ink: { base: 230, span: 300 },
  air: { base: 2400, span: 4400 },
}

/** Crossfade time constants. 4τ ≈ 98% of the way there. */
const FADE_IN = 0.2
const FADE_OUT = 0.16

/** How long a room that is no longer current is kept before its nodes are released. */
const RETIRE_MS = 2600

/** A relay closes every 13–30 s. Rare enough to be a place, not a metronome. */
const RELAY_MIN_MS = 13_000
const RELAY_MAX_MS = 30_000

/** The air bed's band at depth 0 and at depth 1. */
const AIR_BAND_MIN = 420
const AIR_BAND_MAX = 2720

type Rig = {
  id: RoomId
  bus: GainNode
  /** The noise path's low pass. Velocity opens this. */
  tone: BiquadFilterNode
  band: BiquadFilterNode | null
  depth: GainNode | null
  nodes: AudioNode[]
  sources: AudioScheduledSourceNode[]
  retires: number
  relay: number
  live: boolean
}

export class RoomBank {
  #g: Foundry
  #rigs = new Map<RoomId, Rig>()
  #current: RoomId | null = null
  #velocity = 0
  #depth = 0

  constructor(g: Foundry) {
    this.#g = g
  }

  get current(): RoomId | null {
    return this.#current
  }

  get count(): number {
    return this.#rigs.size
  }

  /** The bus gain of every live rig, for `inspect()`. */
  levels(): Partial<Record<RoomId, number>> {
    const out: Partial<Record<RoomId, number>> = {}
    for (const [id, rig] of this.#rigs) out[id] = Math.round(rig.bus.gain.value * 10_000) / 10_000
    return out
  }

  /** The current room's noise-path cutoff, in Hz. Velocity is what moves it. */
  tone(): number | null {
    const rig = this.#current ? this.#rigs.get(this.#current) : undefined
    return rig ? Math.round(rig.tone.frequency.value) : null
  }

  /* ------------------------------- switching ------------------------------ */

  enter(id: RoomId): void {
    if (this.#current === id) return

    const previous = this.#current ? this.#rigs.get(this.#current) : undefined
    if (previous) this.#fadeOut(previous)

    const rig = this.#rigs.get(id) ?? this.#build(id)
    if (!rig) return

    this.#current = id
    this.#resurrect(rig)

    this.#openTone(rig, this.#velocity)
    if (rig.id === 'air') this.#applyDepth(rig)
    if (rig.id === 'machine') this.#scheduleRelay(rig)
  }

  #fadeOut(rig: Rig): void {
    const now = this.#g.now()
    rig.live = false
    this.#cancelRelay(rig)

    holdAt(rig.bus.gain, now)
    rig.bus.gain.setTargetAtTime(0.0001, now, FADE_OUT)

    if (rig.retires !== 0) this.#g.cancel(rig.retires)
    rig.retires = this.#g.later(() => {
      rig.retires = 0
      this.#destroy(rig)
    }, RETIRE_MS)
  }

  /** A room re-entered while it was still fading out: cancel its retirement. */
  #resurrect(rig: Rig): void {
    rig.live = true
    if (rig.retires !== 0) {
      this.#g.cancel(rig.retires)
      rig.retires = 0
    }
    const now = this.#g.now()
    holdAt(rig.bus.gain, now)
    rig.bus.gain.setTargetAtTime(LEVEL[rig.id], now, FADE_IN)
  }

  #destroy(rig: Rig): void {
    if (this.#current === rig.id) return
    this.#cancelRelay(rig)
    if (rig.retires !== 0) {
      this.#g.cancel(rig.retires)
      rig.retires = 0
    }
    rig.live = false
    this.#g.stopAt(rig.sources, this.#g.now())
    this.#rigs.delete(rig.id)
    this.#g.release(rig.nodes, 160)
  }

  /* ------------------------- velocity and depth --------------------------- */

  /**
   * Scroll speed, 0..1. Squared, so a reading scroll barely lifts the filter and
   * a throw opens it without ever sounding like a sweep effect.
   */
  setVelocity(velocity: number): void {
    this.#velocity = clamp01(velocity)
    const rig = this.#current ? this.#rigs.get(this.#current) : undefined
    if (rig) this.#openTone(rig, this.#velocity)
  }

  setDepth(depth: number): void {
    this.#depth = clamp01(depth)
    const rig = this.#current === 'air' ? this.#rigs.get('air') : undefined
    if (rig) this.#applyDepth(rig)
  }

  #openTone(rig: Rig, velocity: number): void {
    const spec = TONE[rig.id]
    const hz = spec.base + velocity * velocity * spec.span
    const now = this.#g.now()
    holdAt(rig.tone.frequency, now)
    // Opening is quick (the sheet takes the pressure); the settle is the
    // caller's job — the page reports 0 as soon as the scroll stops, and the
    // sound layer's fallback timer covers a frame loop that stops mid-throw.
    rig.tone.frequency.setTargetAtTime(hz, now, velocity > 0 ? 0.06 : 0.075)
  }

  #applyDepth(rig: Rig): void {
    const band = rig.band
    const gain = rig.depth
    if (!band || !gain) return
    const now = this.#g.now()

    const hz = AIR_BAND_MIN + this.#depth * (AIR_BAND_MAX - AIR_BAND_MIN)
    holdAt(band.frequency, now)
    band.frequency.setTargetAtTime(hz, now, 0.18)

    // Depth also opens the amount of air, not just its colour: at the mouth of
    // the passage the field is barely moving, and it fills as the eye descends.
    holdAt(gain.gain, now)
    gain.gain.setTargetAtTime(0.35 + this.#depth * 0.65, now, 0.2)
  }

  /* --------------------------------- relays ------------------------------- */

  #scheduleRelay(rig: Rig): void {
    if (rig.relay !== 0) return
    const wait = RELAY_MIN_MS + Math.random() * (RELAY_MAX_MS - RELAY_MIN_MS)
    rig.relay = this.#g.later(() => {
      rig.relay = 0
      if (!rig.live || this.#current !== 'machine' || this.#g.closed) return
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        this.#scheduleRelay(rig)
        return
      }
      this.#relay(rig)
      this.#scheduleRelay(rig)
    }, wait)
  }

  #cancelRelay(rig: Rig): void {
    if (rig.relay === 0) return
    this.#g.cancel(rig.relay)
    rig.relay = 0
  }

  /**
   * A contactor closing somewhere in the rack: a dry, high click and a small
   * body. Fired into the room's bus, not the master, so it fades with the room.
   */
  #relay(rig: Rig): void {
    const g = this.#g
    const t = g.now() + 0.005
    const hz = 2300 + Math.random() * 1100
    const nodes: AudioNode[] = []

    const noise = g.noise(g.white)
    const band = g.biquad('bandpass', hz, 2.4)
    const env = g.gain(0.0001)
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(0.055, t + 0.002)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.026)
    noise.connect(band)
    band.connect(env)
    env.connect(rig.bus)

    const body = g.osc('triangle', 196)
    const bodyEnv = g.gain(0.0001)
    bodyEnv.gain.setValueAtTime(0.0001, t)
    bodyEnv.gain.exponentialRampToValueAtTime(0.03, t + 0.003)
    bodyEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.05)
    body.connect(bodyEnv)
    bodyEnv.connect(rig.bus)

    noise.start(t, Math.random() * 1.5)
    noise.stop(t + 0.04)
    body.start(t)
    body.stop(t + 0.07)

    nodes.push(noise, band, env, body, bodyEnv)
    g.release(nodes, 240)
  }

  /* -------------------------------- building ------------------------------ */

  #build(id: RoomId): Rig | null {
    if (this.#g.closed) return null
    const g = this.#g
    const { ctx } = g
    const t = ctx.currentTime + 0.02
    const nodes: AudioNode[] = []
    const sources: AudioScheduledSourceNode[] = []
    /** Sources that do not start at their buffer's beginning (air only). */
    const offsets = new Map<AudioScheduledSourceNode, number>()

    const own = <T extends AudioNode>(node: T): T => {
      nodes.push(node)
      return node
    }

    const bus = own(g.gain(0.0001))
    bus.connect(g.bedBus)

    const send = own(g.gain(SEND[id]))
    bus.connect(send)
    send.connect(g.roomIn)

    const tone = own(g.biquad('lowpass', TONE[id].base, 0.6))
    tone.connect(bus)

    const rig: Rig = {
      id,
      bus,
      tone,
      band: null,
      depth: null,
      nodes,
      sources,
      retires: 0,
      relay: 0,
      live: true,
    }

    if (id === 'paper') {
      // Room air: pink noise through two low passes, the second one drifting on
      // an 18 s cycle so the room is never quite still.
      const air = own(g.noise(g.bedBuffer(), true))
      const lp = own(g.biquad('lowpass', 560, 0.55))
      const airGain = own(g.gain(0.8))
      air.connect(lp)
      lp.connect(airGain)
      airGain.connect(tone)

      const sweep = own(g.osc('sine', 0.055))
      const sweepDepth = own(g.gain(150))
      sweep.connect(sweepDepth)
      sweepDepth.connect(lp.frequency)

      const breathe = own(g.osc('sine', 0.031))
      const breatheDepth = own(g.gain(0.2))
      breathe.connect(breatheDepth)
      breatheDepth.connect(airGain.gain)

      // The hum of a sheet that is being kept flat: the old room tone, two
      // oscillators a third of a hertz apart, and nothing above it.
      const humA = own(g.osc('sine', 57.3))
      const humAGain = own(g.gain(0.22))
      const humB = own(g.osc('sine', 57.62))
      const humBGain = own(g.gain(0.07))
      humA.connect(humAGain)
      humAGain.connect(bus)
      humB.connect(humBGain)
      humBGain.connect(bus)

      sources.push(air, sweep, breathe, humA, humB)
    } else if (id === 'machine') {
      // One fan, two bands: the body of the rack and the hiss of its top.
      const fan = own(g.noise(g.bedBuffer(), true))
      const body = own(g.biquad('bandpass', 240, 0.7))
      const bodyGain = own(g.gain(0.8))
      fan.connect(body)
      body.connect(bodyGain)
      bodyGain.connect(tone)

      const top = own(g.biquad('bandpass', 1600, 0.7))
      const topGain = own(g.gain(0.09))
      fan.connect(top)
      top.connect(topGain)
      topGain.connect(tone)

      const wander = own(g.osc('sine', 0.09))
      const wanderDepth = own(g.gain(24))
      wander.connect(wanderDepth)
      wanderDepth.connect(body.frequency)

      // A transformer: 50 Hz and its neighbour, beating at 0.7 Hz, with the
      // 100 Hz harmonic that makes it audible on a laptop.
      const hum = own(g.osc('sine', 50))
      const humGain = own(g.gain(0.11))
      const beat = own(g.osc('sine', 50.7))
      const beatGain = own(g.gain(0.11))
      const harmonic = own(g.osc('sine', 100.3))
      const harmonicGain = own(g.gain(0.045))
      hum.connect(humGain)
      humGain.connect(bus)
      beat.connect(beatGain)
      beatGain.connect(bus)
      harmonic.connect(harmonicGain)
      harmonicGain.connect(bus)

      sources.push(fan, wander, hum, beat, harmonic)
    } else if (id === 'ink') {
      // Pressure, not a note: two sines a hair apart, a low pass, and an octave
      // for the speakers that cannot reach 38 Hz.
      const subA = own(g.osc('sine', 38))
      const subAGain = own(g.gain(0.26))
      const subB = own(g.osc('sine', 38.6))
      const subBGain = own(g.gain(0.2))
      const pressure = own(g.biquad('lowpass', 120, 0.6))
      subA.connect(subAGain)
      subAGain.connect(pressure)
      subB.connect(subBGain)
      subBGain.connect(pressure)
      pressure.connect(bus)

      const octave = own(g.osc('sine', 76.2))
      const octaveGain = own(g.gain(0.045))
      octave.connect(octaveGain)
      octaveGain.connect(bus)

      // The rest of the spectrum is a rumble with its top cut off at 85 Hz.
      const rumble = own(g.noise(g.bedBuffer(), true))
      const rumbleLp = own(g.biquad('lowpass', 85, 0.8))
      const rumbleGain = own(g.gain(0.5))
      rumble.connect(rumbleLp)
      rumbleLp.connect(rumbleGain)
      rumbleGain.connect(tone)

      sources.push(subA, subB, octave, rumble)
    } else {
      // The passage: air in a band, its width set by the flight's depth, and a
      // gust that wanders across it. Two sources from one six-second buffer,
      // started a third apart, so the loop never lines up with itself.
      const wind = own(g.noise(g.bedBuffer(), true))
      const band = own(g.biquad('bandpass', AIR_BAND_MIN, 0.55))
      const depthGain = own(g.gain(0.35))
      const windGain = own(g.gain(0.62))
      wind.connect(band)
      band.connect(depthGain)
      depthGain.connect(windGain)
      windGain.connect(tone)

      const hiss = own(g.noise(g.bedBuffer(), true))
      const hissHp = own(g.biquad('highpass', 2400, 0.7))
      const hissGain = own(g.gain(0.05))
      hiss.connect(hissHp)
      hissHp.connect(hissGain)
      hissGain.connect(tone)

      const gust = own(g.osc('sine', 0.07))
      const gustLevel = own(g.gain(0.22))
      gust.connect(gustLevel)
      gustLevel.connect(windGain.gain)

      const gustBand = own(g.gain(70))
      gust.connect(gustBand)
      gustBand.connect(band.frequency)

      rig.band = band
      rig.depth = depthGain
      sources.push(wind, hiss, gust)
      // Started a third into the buffer so the two noise sources never share a
      // phase, and the loop never lines up with itself.
      offsets.set(hiss, 2.4)
    }

    for (const source of sources) {
      const offset = offsets.get(source) ?? 0
      try {
        // Only a buffer source takes an offset; a room's oscillators start at 0.
        if (source instanceof AudioBufferSourceNode) source.start(t, offset)
        else source.start(t)
      } catch {
        /* already running — a rig is built once */
      }
    }

    // A room is born silent and is ramped by `enter`; `live` is what the relay
    // scheduler reads, not the context state.
    this.#rigs.set(id, rig)
    return rig
  }

  /* -------------------------------- teardown ------------------------------ */

  /** Fade every room out, stop its sources, and let the foundry reclaim the nodes. */
  dispose(fade = 0.4): void {
    const now = this.#g.now()
    const seconds = Math.max(0.04, fade)

    for (const rig of this.#rigs.values()) {
      rig.live = false
      this.#cancelRelay(rig)
      if (rig.retires !== 0) {
        this.#g.cancel(rig.retires)
        rig.retires = 0
      }

      holdAt(rig.bus.gain, now)
      rig.bus.gain.setTargetAtTime(0.0001, now, seconds / 4)
      this.#g.stopAt(rig.sources, now + seconds * 1.8)
      this.#g.release(rig.nodes, seconds * 1800 + 200)
    }

    this.#rigs.clear()
    this.#current = null
  }
}

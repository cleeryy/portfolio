import { clamp, type Foundry } from './graph'

/**
 * sound/cues.ts — the marks
 *
 * A cue is a place being touched: a switch, a reading, a mark on the drawing, a
 * plate turning over. Every one is built from oscillators and noise at the
 * moment it fires and released when its tail has passed — there is no sample
 * bank, and there is nothing looping here.
 *
 * The shapes are deliberate:
 *
 * - **contact + mass.** A click is a noise scrape (the contact) over a dropping
 *   triangle (the mass). One without the other is a beep.
 * - **pitch is information.** A node's tier sets its note: edge above, services
 *   below. A reader who hears the drawing twice learns the stack without being
 *   told which plan they are pointing at.
 * - **pan is position.** The territory's x decides where the mark sits between
 *   the speakers, so the drawing has a left and a right when it is heard.
 * - **dry is a texture.** The plate change is deliberately almost dry: the
 *   shared room is a building, and paper being turned should not echo.
 */

export type NodeTier = 'edge' | 'fabric' | 'services'

/** One line of telemetry, for `inspect()` and for the validation harness. */
export type CueStamp = {
  name: string
  /** `performance.now()` at the moment of firing. */
  at: number
  hz?: number
  pan?: number
  p?: number
}

/** Peak amplitudes, relative to the master. */
const PEAK = {
  click: 0.62,
  ping: 0.45,
  hover: 0.2,
  open: 0.42,
  brush: 0.3,
  boot: 0.34,
  node: 0.17,
  depth: 0.1,
  creak: 0.055,
} as const

/** The stack, heard from the top down. */
const NODE_HZ: Record<NodeTier, number> = { edge: 1760, fabric: 1180, services: 800 }

function stamp(name: string, extra: Omit<CueStamp, 'name' | 'at'> = {}): CueStamp {
  return { name, at: typeof performance === 'undefined' ? Date.now() : performance.now(), ...extra }
}

export class CueBank {
  #g: Foundry

  constructor(g: Foundry) {
    this.#g = g
  }

  /* ------------------------------- interface ------------------------------ */

  /** Soft relay tick — the default interface acknowledgement. */
  click(scale: number): CueStamp {
    const g = this.#g
    const { ctx } = g
    const t = ctx.currentTime + 0.004
    const vary = 0.93 + Math.random() * 0.14
    const peak = PEAK.click * vary * scale
    const nodes: AudioNode[] = []

    const panner = g.panner((Math.random() - 0.5) * 0.14)
    panner.connect(g.cueBus)
    const send = g.gain(0.14)
    panner.connect(send)
    send.connect(g.roomIn)
    nodes.push(panner, send)

    // Contact: a short highpassed noise scrape.
    const tick = g.noise(g.white)
    const highpass = g.biquad('highpass', 1700 + Math.random() * 500, 0.6)
    const tickEnv = g.gain(0.0001)
    tickEnv.gain.setValueAtTime(0.0001, t)
    tickEnv.gain.exponentialRampToValueAtTime(peak, t + 0.0015)
    tickEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.018)
    tick.connect(highpass)
    highpass.connect(tickEnv)
    tickEnv.connect(panner)

    // Mass: a low body that makes it a switch and not a beep.
    const body = g.osc('triangle', 188 * vary)
    body.frequency.setValueAtTime(188 * vary, t)
    body.frequency.exponentialRampToValueAtTime(142 * vary, t + 0.04)
    const bodyLp = g.biquad('lowpass', 760, 0.5)
    const bodyEnv = g.gain(0.0001)
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

    nodes.push(tick, highpass, tickEnv, body, bodyLp, bodyEnv)
    g.release(nodes, 180)
    return stamp('click', { hz: 188 * vary, pan: panner.pan.value })
  }

  /** Sonar reading — for section arrivals, never for buttons. */
  ping(scale: number): CueStamp {
    const g = this.#g
    const { ctx } = g
    const t = ctx.currentTime + 0.003
    const base = 806 * (0.98 + Math.random() * 0.04)
    const peak = PEAK.ping * scale
    const nodes: AudioNode[] = []

    const panner = g.panner((Math.random() - 0.5) * 0.36)
    panner.connect(g.cueBus)
    const send = g.gain(0.4)
    panner.connect(send)
    send.connect(g.roomIn)
    nodes.push(panner, send)

    const body = g.osc('sine', base)
    body.frequency.setValueAtTime(base, t)
    body.frequency.exponentialRampToValueAtTime(base * 0.76, t + 1.2)

    // The tail darkens as it travels: a reading, not a chime.
    const tone = g.biquad('lowpass', 3800, 0.4)
    tone.frequency.setValueAtTime(3800, t)
    tone.frequency.exponentialRampToValueAtTime(820, t + 1.1)

    const env = g.gain(0.0001)
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(peak, t + 0.005)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 1.4)

    body.connect(tone)
    tone.connect(env)
    env.connect(panner)

    // Faint octave partial — the steel of the transducer.
    const edge = g.osc('sine', base * 2.01)
    edge.frequency.setValueAtTime(base * 2.01, t)
    edge.frequency.exponentialRampToValueAtTime(base * 1.62, t + 0.3)
    const edgeEnv = g.gain(0.0001)
    edgeEnv.gain.setValueAtTime(0.0001, t)
    edgeEnv.gain.exponentialRampToValueAtTime(peak * 0.12, t + 0.004)
    edgeEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.34)
    edge.connect(edgeEnv)
    edgeEnv.connect(panner)

    body.start(t)
    body.stop(t + 1.45)
    edge.start(t)
    edge.stop(t + 0.4)

    nodes.push(body, tone, env, edge, edgeEnv)
    g.release(nodes, 1550)
    return stamp('ping', { hz: base, pan: panner.pan.value })
  }

  /** Barely-there tick for pointer travel. Rate-limited by the caller. */
  hover(scale: number): CueStamp {
    const g = this.#g
    const { ctx } = g
    const t = ctx.currentTime + 0.002
    const peak = PEAK.hover * scale
    const hz = 4200 + Math.random() * 1400

    const source = g.noise(g.white)
    const band = g.biquad('bandpass', hz, 1.4)
    const env = g.gain(0.0001)
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(peak, t + 0.0008)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.012)

    source.connect(band)
    band.connect(env)
    env.connect(g.cueBus)

    source.start(t, Math.random() * 1.5)
    source.stop(t + 0.02)

    g.release([source, band, env], 90)
    return stamp('hover', { hz })
  }

  /** Filtered swell for a section transition. Rate-limited by the caller. */
  open(scale: number): CueStamp {
    const g = this.#g
    const { ctx } = g
    const t = ctx.currentTime + 0.005
    const peak = PEAK.open * scale
    const nodes: AudioNode[] = []

    const panner = g.panner((Math.random() - 0.5) * 0.2)
    panner.connect(g.cueBus)
    const send = g.gain(0.45)
    panner.connect(send)
    send.connect(g.roomIn)
    nodes.push(panner, send)

    // Air opening: band rises as the pressure changes.
    const air = g.noise(g.white)
    const band = g.biquad('bandpass', 240, 0.8)
    band.frequency.setValueAtTime(240, t)
    band.frequency.exponentialRampToValueAtTime(1500, t + 0.5)
    const airEnv = g.gain(0.0001)
    airEnv.gain.setValueAtTime(0.0001, t)
    airEnv.gain.exponentialRampToValueAtTime(peak, t + 0.17)
    airEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.66)
    air.connect(band)
    band.connect(airEnv)
    airEnv.connect(panner)

    // Pressure underneath it.
    const sub = g.osc('sine', 78)
    sub.frequency.setValueAtTime(78, t)
    sub.frequency.exponentialRampToValueAtTime(44, t + 0.55)
    const subEnv = g.gain(0.0001)
    subEnv.gain.setValueAtTime(0.0001, t)
    subEnv.gain.exponentialRampToValueAtTime(peak * 0.7, t + 0.08)
    subEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
    sub.connect(subEnv)
    subEnv.connect(panner)

    air.start(t, Math.random() * 1.2)
    air.stop(t + 0.7)
    sub.start(t)
    sub.stop(t + 0.65)

    nodes.push(air, band, airEnv, sub, subEnv)
    g.release(nodes, 800)
    return stamp('open', { hz: 240 })
  }

  /* -------------------------------- the plate ----------------------------- */

  /**
   * The plate change: one sheet of paper turned over.
   *
   * 160 ms, three layers — a low band that carries the drag, a brighter band
   * that arrives 20 ms later (the far edge of the sheet leaving the block), and
   * a short triangle for the paper's mass. Almost no room send: a page turning
   * is close to the reader, and reverb would turn it into a whoosh.
   */
  brush(scale: number): CueStamp {
    const g = this.#g
    const { ctx } = g
    const t = ctx.currentTime + 0.01
    const peak = PEAK.brush * scale
    const nodes: AudioNode[] = []

    const panner = g.panner((Math.random() - 0.5) * 0.36)
    panner.connect(g.cueBus)
    const send = g.gain(0.07)
    panner.connect(send)
    send.connect(g.roomIn)
    nodes.push(panner, send)

    const sheet = g.noise(g.white)

    // The drag: the sheet's body leaving the surface.
    const low = g.biquad('bandpass', 900 + Math.random() * 220, 0.8)
    const lowEnv = g.gain(0.0001)
    lowEnv.gain.setValueAtTime(0.0001, t)
    lowEnv.gain.exponentialRampToValueAtTime(peak, t + 0.012)
    lowEnv.gain.exponentialRampToValueAtTime(peak * 0.35, t + 0.06)
    lowEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    sheet.connect(low)
    low.connect(lowEnv)
    lowEnv.connect(panner)

    // The slip: the free edge, brighter and a beat later.
    const high = g.biquad('bandpass', 3200 + Math.random() * 900, 0.6)
    const highEnv = g.gain(0.0001)
    highEnv.gain.setValueAtTime(0.0001, t + 0.02)
    highEnv.gain.exponentialRampToValueAtTime(peak * 0.5, t + 0.045)
    highEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.155)
    sheet.connect(high)
    high.connect(highEnv)
    highEnv.connect(panner)

    // The block: paper has mass, and mass is a low thump.
    const body = g.osc('triangle', 168)
    const bodyEnv = g.gain(0.0001)
    bodyEnv.gain.setValueAtTime(0.0001, t)
    bodyEnv.gain.exponentialRampToValueAtTime(peak * 0.3, t + 0.006)
    bodyEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.07)
    body.connect(bodyEnv)
    bodyEnv.connect(panner)

    sheet.start(t, Math.random() * 1.4)
    sheet.stop(t + 0.2)
    body.start(t)
    body.stop(t + 0.09)

    nodes.push(sheet, low, lowEnv, high, highEnv, body, bodyEnv)
    g.release(nodes, 260)
    return stamp('brush', { hz: 168, pan: panner.pan.value })
  }

  /** The boot plate engaging: one power tick, centre, and nothing else. */
  boot(scale: number): CueStamp {
    const g = this.#g
    const { ctx } = g
    const t = ctx.currentTime + 0.004
    const peak = PEAK.boot * scale
    const nodes: AudioNode[] = []

    const panner = g.panner(0)
    panner.connect(g.cueBus)
    const send = g.gain(0.12)
    panner.connect(send)
    send.connect(g.roomIn)
    nodes.push(panner, send)

    // The contact of the switch.
    const contact = g.noise(g.white)
    const highpass = g.biquad('highpass', 2600, 0.7)
    const contactEnv = g.gain(0.0001)
    contactEnv.gain.setValueAtTime(0.0001, t)
    contactEnv.gain.exponentialRampToValueAtTime(peak, t + 0.0015)
    contactEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.014)
    contact.connect(highpass)
    highpass.connect(contactEnv)
    contactEnv.connect(panner)

    // The chassis answering: 132 Hz falling to 96, a tenth of a second.
    const body = g.osc('sine', 132)
    body.frequency.setValueAtTime(132, t)
    body.frequency.exponentialRampToValueAtTime(96, t + 0.09)
    const bodyEnv = g.gain(0.0001)
    bodyEnv.gain.setValueAtTime(0.0001, t)
    bodyEnv.gain.exponentialRampToValueAtTime(peak * 0.55, t + 0.004)
    bodyEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.11)
    body.connect(bodyEnv)
    bodyEnv.connect(panner)

    contact.start(t, Math.random() * 1.5)
    contact.stop(t + 0.03)
    body.start(t)
    body.stop(t + 0.13)

    nodes.push(contact, highpass, contactEnv, body, bodyEnv)
    g.release(nodes, 200)
    return stamp('boot', { hz: 132 })
  }

  /* -------------------------------- the 3D -------------------------------- */

  /**
   * A mark under the pointer: a tiny click whose pitch is its plan and whose
   * position is its x. 180ms, one room send, no tail worth waiting for.
   */
  node(x: number, tier: NodeTier, scale: number): CueStamp {
    const g = this.#g
    const { ctx } = g
    const t = ctx.currentTime + 0.004
    const hz = NODE_HZ[tier]
    const pan = clamp(x, -1, 1) * 0.78
    const peak = PEAK.node * scale
    const nodes: AudioNode[] = []

    const panner = g.panner(pan)
    panner.connect(g.cueBus)
    const send = g.gain(0.24)
    panner.connect(send)
    send.connect(g.roomIn)
    nodes.push(panner, send)

    // The reading: a sine with a short fall, the same instrument as the ping,
    // an octave and a half up.
    const body = g.osc('sine', hz)
    body.frequency.setValueAtTime(hz, t)
    body.frequency.exponentialRampToValueAtTime(hz * 0.86, t + 0.1)
    const bodyEnv = g.gain(0.0001)
    bodyEnv.gain.setValueAtTime(0.0001, t)
    bodyEnv.gain.exponentialRampToValueAtTime(peak, t + 0.003)
    bodyEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.17)
    body.connect(bodyEnv)
    bodyEnv.connect(panner)

    // The transducer's edge, an octave up, gone in 60ms.
    const edge = g.osc('sine', hz * 2.02)
    const edgeEnv = g.gain(0.0001)
    edgeEnv.gain.setValueAtTime(0.0001, t)
    edgeEnv.gain.exponentialRampToValueAtTime(peak * 0.18, t + 0.002)
    edgeEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    edge.connect(edgeEnv)
    edgeEnv.connect(panner)

    // The contact of the pointer on the mark.
    const contact = g.noise(g.white)
    const band = g.biquad('bandpass', 3200 + Math.random() * 800, 1.2)
    const contactEnv = g.gain(0.0001)
    contactEnv.gain.setValueAtTime(0.0001, t)
    contactEnv.gain.exponentialRampToValueAtTime(peak * 0.45, t + 0.0015)
    contactEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.012)
    contact.connect(band)
    band.connect(contactEnv)
    contactEnv.connect(panner)

    body.start(t)
    body.stop(t + 0.2)
    edge.start(t)
    edge.stop(t + 0.08)
    contact.start(t, Math.random() * 1.5)
    contact.stop(t + 0.02)

    nodes.push(body, bodyEnv, edge, edgeEnv, contact, band, contactEnv)
    g.release(nodes, 280)
    return stamp('node', { hz, pan })
  }

  /**
   * The passage moving past: a band of noise whose width is the depth. This is
   * an accent, never a bed — the air room carries the continuous part, and this
   * fires only when the eye has actually travelled.
   */
  depth(p: number, scale: number): CueStamp {
    const g = this.#g
    const { ctx } = g
    const t = ctx.currentTime + 0.005
    const band = 420 + p * 2400
    const peak = (PEAK.depth * (0.45 + 0.55 * p)) * scale
    const nodes: AudioNode[] = []

    const panner = g.panner((Math.random() - 0.5) * 0.5)
    panner.connect(g.cueBus)
    const send = g.gain(0.25)
    panner.connect(send)
    send.connect(g.roomIn)
    nodes.push(panner, send)

    const air = g.noise(g.white)
    const filter = g.biquad('bandpass', band, 0.9)
    const env = g.gain(0.0001)
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(peak, t + 0.05)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.22)
    air.connect(filter)
    filter.connect(env)
    env.connect(panner)

    air.start(t, Math.random() * 1.6)
    air.stop(t + 0.26)

    nodes.push(air, filter, env)
    g.release(nodes, 340)
    return stamp('depth', { hz: band, pan: panner.pan.value, p })
  }

  /**
   * The ink creak: the sheet complaining at speed. A band of noise chopped by a
   * 43 Hz square-ish gain, so it is a stick-slip rattle rather than a sweep.
   * Fired by `velocity`, never heard at rest.
   */
  creak(intensity: number, scale: number): CueStamp {
    const g = this.#g
    const { ctx } = g
    const t = ctx.currentTime + 0.004
    const peak = PEAK.creak * (0.4 + 0.6 * intensity) * scale
    const hz = 330 + Math.random() * 150
    const nodes: AudioNode[] = []

    const panner = g.panner((Math.random() - 0.5) * 0.24)
    panner.connect(g.cueBus)
    const send = g.gain(0.16)
    panner.connect(send)
    send.connect(g.roomIn)
    nodes.push(panner, send)

    const source = g.noise(g.white)
    const band = g.biquad('bandpass', hz, 9)
    band.frequency.setValueAtTime(hz, t)
    band.frequency.exponentialRampToValueAtTime(hz * 0.62, t + 0.13)

    // Grain: a gain that swings through zero turns a smooth band into a
    // sequence of contacts.
    const grain = g.gain(1)
    const lfo = g.osc('sine', 43)
    const lfoDepth = g.gain(1)
    lfo.connect(lfoDepth)
    lfoDepth.connect(grain.gain)

    const env = g.gain(0.0001)
    env.gain.setValueAtTime(0.0001, t)
    env.gain.exponentialRampToValueAtTime(peak, t + 0.012)
    env.gain.exponentialRampToValueAtTime(peak * 0.7, t + 0.08)
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)

    source.connect(band)
    band.connect(grain)
    grain.connect(env)
    env.connect(panner)

    source.start(t, Math.random() * 1.4)
    source.stop(t + 0.18)
    lfo.start(t)
    lfo.stop(t + 0.18)

    nodes.push(source, band, grain, lfo, lfoDepth, env)
    g.release(nodes, 240)
    return stamp('creak', { hz })
  }
}

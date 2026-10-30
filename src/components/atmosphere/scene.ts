import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  OrthographicCamera,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three'
import { gsap } from 'gsap'
import { ATMOSPHERE_FRAG, ATMOSPHERE_VERT } from './shaders'

/* ============================================================================
   The atmosphere: the sheet the whole page is printed on
   ----------------------------------------------------------------------------
   One responsibility — make the ground feel like a sheet of paper being moved
   under a lamp — and the hero's engineering discipline, deliberately:

   - one renderer, one fullscreen triangle, one program, one draw call;
   - `gsap.ticker` only, so the whole site shares one RAF;
   - no per-frame allocation: three uniform writes and one render;
   - DPR capped at 1.5, halved on high-DPI screens and further reduced by a
     fixed pixel ladder, because this is texture, not detail;
   - while the lens is open the sheet is drawn at 30 Hz, not 60: the drift is
     the only thing moving, and nobody can see a hairline move at 30;
   - the opaque dark chapter covers the viewport, so the render is skipped
     while it does — nobody pays for pixels nobody sees;
   - hidden tab → ticker removed; `webglcontextlost` → stop, and the page is
     left on its CSS ground rather than on a dead canvas;
   - any failure at setup returns `null`, which is the no-WebGL path: the
     section is simply not there, and the page is unchanged.

   Why it keeps drawing when the reader stops: the drift *is* the subject. A
   frozen sheet is a photograph of a sheet. The cost is bounded by the pixel
   ladder above and by the skip under the ink band, so idle is cheap without
   being dead.
   ========================================================================== */

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

/** Raw sRGB, matching --ink (#131c19) exactly — written straight to the
    framebuffer, so three's colour management never enters the path. */
const INK: [number, number, number] = [0x13 / 255, 0x1c / 255, 0x19 / 255]

/** Peak ink alpha. 5.6% of the ink over the ground — the contrast budget in
    DESIGN.md, with room for 8-bit rounding at the top of the printed ladder.
    Measured on the rendered page: see the lane report. */
const INK_BUDGET = 0.056

/** It is texture, not detail. */
const MAX_DPR = 1.5

/** Above this, the extra samples buy nothing on a field of hairlines. */
const MAX_PIXELS = 2_000_000

/** Above 1.25 device pixels per CSS pixel the field stops being resolution-
    bound (a hairline is already sub-pixel), so the buffer is scaled back. */
const HIGH_DPI = 1.25
const HIGH_DPI_SCALE = 0.8

/** Scroll speed that saturates the lens, in CSS px/s. */
const VELOCITY_REF = 2600

/** Below this fraction of VELOCITY_REF the lens stays open: slow scroll is
    almost nothing, which is the brief. */
const VELOCITY_DEAD = 0.055

/** Plate-change spike: attack, then decay. Peaks with the veil's plateau. */
const PULSE_RISE = 0.24
const PULSE_FALL = 0.62

export type AtmosphereHandle = {
  /** Spike the lens for one plate change. Safe to call at any time. */
  pulse: () => void
  dispose: () => void
}

export function createAtmosphere(host: HTMLElement): AtmosphereHandle | null {
  const reduced = window.matchMedia(REDUCED_QUERY).matches

  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({ alpha: true, antialias: false })
  } catch {
    return null
  }

  if (!renderer.getContext()) {
    renderer.dispose()
    return null
  }

  // A fullscreen field needs no MSAA, and the layer is never opaque: the
  // page's own ground shows through wherever the shader writes nothing.
  renderer.setClearAlpha(0)

  const canvas = renderer.domElement
  canvas.className = 'atm__canvas'
  host.appendChild(canvas)

  const scene = new Scene()
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

  const geometry = new BufferGeometry()
  // One triangle, wound so it covers the clip square: (-1,-1) (3,-1) (-1,3).
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3),
  )

  const uniforms = {
    uTime: { value: 0 },
    uAspect: { value: 1 },
    uBend: { value: 0 },
    uPulse: { value: 0 },
    uBudget: { value: INK_BUDGET },
    uInk: { value: new Vector3(INK[0], INK[1], INK[2]) },
  }

  const material = new ShaderMaterial({
    uniforms,
    vertexShader: ATMOSPHERE_VERT,
    fragmentShader: ATMOSPHERE_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })

  const sheet = new Mesh(geometry, material)
  sheet.frustumCulled = false
  scene.add(sheet)

  /* ---- viewport --------------------------------------------------------- */

  let width = 1
  let height = 1
  let lastRatio = 0
  let pendingResize = 0

  const resize = () => {
    const w = Math.max(1, window.innerWidth)
    const h = Math.max(1, window.innerHeight)

    let ratio = Math.min(window.devicePixelRatio || 1, MAX_DPR)
    if (ratio > HIGH_DPI) ratio *= HIGH_DPI_SCALE
    // The pixel ladder: deterministic, never oscillating, never re-measured in
    // the frame loop.
    while (w * h * ratio * ratio > MAX_PIXELS && ratio > 0.6) ratio *= 0.8

    // A mobile URL bar collapsing by a pixel is not a resize.
    if (w === width && h === height && ratio === lastRatio) return

    width = w
    height = h
    lastRatio = ratio

    renderer.setPixelRatio(ratio)
    renderer.setSize(w, h, false)
    uniforms.uAspect.value = w / h

    if (reduced) drawOnce()
  }

  const scheduleResize = () => {
    if (pendingResize) return
    pendingResize = requestAnimationFrame(() => {
      pendingResize = 0
      resize()
    })
  }

  /* ---- state ------------------------------------------------------------ */

  const state = {
    time: 0,
    bend: 0,
    pulse: 0,
    pulseClock: Number.POSITIVE_INFINITY,
    lastScroll: 0,
    resumed: true,
    covered: false,
    frame: 0,
    parity: 0,
    running: false,
  }

  const clamp = (value: number, min: number, max: number) =>
    value < min ? min : value > max ? max : value

  /** The ink chapter is opaque; while it owns the viewport, nothing renders. */
  const isCovered = () => {
    const band = document.getElementById('ranges')
    if (!band) return false
    const rect = band.getBoundingClientRect()
    return rect.top <= 1 && rect.bottom >= window.innerHeight - 1
  }

  const draw = () => {
    uniforms.uTime.value = state.time
    uniforms.uBend.value = state.bend
    uniforms.uPulse.value = state.pulse
    renderer.render(scene, camera)
  }

  const drawOnce = () => {
    draw()
    if (canvas.dataset.live !== 'true') canvas.dataset.live = 'true'
  }

  /* ---- frame ------------------------------------------------------------ */

  const frame = (_time: number, deltaMs: number) => {
    const dt = Math.min(Math.max(deltaMs, 0) / 1000, 0.05)

    state.time += dt

    /* Scroll velocity, in px/s, normalised and dead-zoned: a slow scroll
       leaves the lens open, a throw bends the field. */
    const scroll = window.scrollY || 0
    if (state.resumed) {
      state.lastScroll = scroll
      state.resumed = false
    }
    const speed = dt > 0 ? (scroll - state.lastScroll) / dt : 0
    state.lastScroll = scroll

    let target = clamp(speed / VELOCITY_REF, -1, 1)
    const magnitude = Math.abs(target)
    target = magnitude <= VELOCITY_DEAD ? 0 : Math.sign(target) * (magnitude - VELOCITY_DEAD) / (1 - VELOCITY_DEAD)

    // Attack fast, release slow: the sheet resists, then settles.
    const damping = Math.abs(target) > Math.abs(state.bend) ? 12 : 2.4
    state.bend += (target - state.bend) * Math.min(1, dt * damping)

    /* The plate-change spike: rise, hold an instant, decay. Allocation-free and
       deterministic — no timers, no closure per transition. */
    if (state.pulseClock < PULSE_RISE + PULSE_FALL) {
      state.pulseClock += dt
      const t = state.pulseClock
      const raw = t < PULSE_RISE ? t / PULSE_RISE : Math.max(0, 1 - (t - PULSE_RISE) / PULSE_FALL)
      state.pulse = raw * raw * (3 - 2 * raw)
    } else if (state.pulse !== 0) {
      state.pulse = 0
    }

    /* Ten times a second is enough to know whether the ink band owns the
       viewport; the check itself is a single rect read. */
    state.frame = (state.frame + 1) % 10
    if (state.frame === 0) state.covered = isCovered()

    /* The drift does not need 60 Hz: while the lens is open, every second tick
       is enough, and the sheet is a texture. As soon as it is thrown — or a
       plate change spikes the lens — the full rate resumes, so the reaction
       that the reader actually watches is never stepped. */
    state.parity ^= 1
    const still = Math.abs(state.bend) < 0.015 && state.pulse < 0.008
    if (state.covered || (still && state.parity === 0)) return

    draw()
  }

  const stop = () => {
    if (!state.running) return
    state.running = false
    gsap.ticker.remove(frame)
  }

  const start = () => {
    if (state.running || reduced || document.visibilityState !== 'visible') return
    state.running = true
    state.resumed = true
    gsap.ticker.add(frame)
  }

  const onVisibility = () => {
    if (document.visibilityState === 'visible') start()
    else stop()
  }

  const onContextLost = (event: Event) => {
    // The sheet is gone. Stop cleanly and leave the page on its CSS ground:
    // a half-rebuilt field would be worse than no field.
    event.preventDefault()
    stop()
    if (canvas.parentNode === host) host.removeChild(canvas)
  }

  const pulse = () => {
    state.pulseClock = 0
    state.pulse = 0
    if (reduced) drawOnce()
  }

  /* ---- lifecycle -------------------------------------------------------- */

  const observer = new ResizeObserver(scheduleResize)
  observer.observe(document.documentElement)
  window.addEventListener('resize', scheduleResize)

  canvas.addEventListener('webglcontextlost', onContextLost)
  document.addEventListener('visibilitychange', onVisibility)

  const dispose = () => {
    stop()
    if (pendingResize) cancelAnimationFrame(pendingResize)
    pendingResize = 0

    observer.disconnect()
    window.removeEventListener('resize', scheduleResize)
    canvas.removeEventListener('webglcontextlost', onContextLost)
    document.removeEventListener('visibilitychange', onVisibility)

    scene.clear()
    geometry.dispose()
    material.dispose()
    renderer.dispose()

    if (canvas.parentNode === host) host.removeChild(canvas)
  }

  resize()
  drawOnce()

  /* A shader that failed to compile leaves a transparent canvas, which is
     survivable but dishonest: the layer would claim to be live and paint
     nothing. One check after the first real draw — a fresh context has no
     stale error — and the lane reports itself unavailable instead. */
  const gl = renderer.getContext()
  if (gl.getError() !== gl.NO_ERROR) {
    dispose()
    return null
  }

  start()

  return { pulse, dispose }
}

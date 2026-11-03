import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { gsap } from 'gsap'
import { sound } from '../lib/sound'
import { getPointer } from '../lib/pointer'
import { effectiveReduced, subscribeMotion } from '../lib/motion'
import { ATMOSPHERE_FRAG, ATMOSPHERE_VERT } from './shaders'

/* ============================================================================
   The atmosphere: the sheet the whole page is printed on
   ----------------------------------------------------------------------------
   One responsibility — make the ground feel like a sheet of paper being moved
   under a lamp — and the hero's engineering discipline, deliberately:

   - one renderer, one fullscreen triangle, one program, one draw call for the
     sheet — four at most once the instrument below is on the plate;
   - `gsap.ticker` only, so the whole site shares one RAF;
   - no per-frame allocation: six uniform writes and one render;
   - DPR capped at 1.5, halved on high-DPI screens and further reduced by a
     fixed pixel ladder, because this is texture, not detail;
   - while the sheet is at rest it is drawn at 30 Hz, not 60: the drift is the
     only thing moving, and nobody can see a hairline move at 30;
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

   The sheet has one more material property, added in V3: **speed coarsens the
   print**. The same damped throw that bends the field also grows the dither
   cell from one device pixel to three, spreads the contour hairlines and, at the
   top of the range, keeps the ink only where the screen prints — so the contours
   break into dots. It is the sheet being dragged under the lamp, and it costs one
   uniform, one multiply and two smoothsteps in the existing program. No second
   context, no second program, no allocation: the value is a scalar in `state`.

   In V6 the pointer adds **the loupe** (`uLens`, `uLensR`, `uLensOn`, `uMark`):
   under the glass the ink is printed 2.3× denser, the screen's cell reaches
   three device pixels and holds ink back into dots, the contour prints a second
   time 2.4 px out of register, and the rim, one inner highlight and the
   measuring reticle bound it. `getPointer()` is a synchronous read from the one
   shared pointer module — no second listener, no second RAF — and the positions
   are damped here with the same 0.18 constant. Under reduced motion — the
   system's or the panel's override — the loop never starts, so the aperture
   stays at zero.

   In V8 the sheet carries a second scene: **the survey instrument**. One
   renderer, one canvas, one `gsap.ticker` callback, and four draw calls at the
   very most — the sheet, the graticule, the orbit ring, the thirteen marks. The
   instrument has its own `Scene` and its own orthographic camera (frustum two
   units tall, so one world unit is half the viewport and a pose scale is a
   fraction of the screen), drawn into the same buffer with `autoClear` off.

   The instrument is not a timeline per chapter. It is a table of poses — a
   station on the sheet, a scale, a spin rate, an opacity — read from the page:
   every eighth frame the loop asks which `main > section[id]` spans the
   viewport centre and damps toward that chapter's pose with one time-correct
   exponential, λ = 3/s. A chapter absent from the DOM is absent from the
   reading (that is the graceful fallback for chapters not written yet), and a
   chapter that declares opacity 0 simply fades the instrument out. Nothing is
   keyed to a scroll offset, so a jump, a resize and a route change all land on
   the same station.

   On the ink chapter the band's fill moves *behind* the canvas (atmosphere.css,
   `data-deep`), so the instrument can print on the dark surface while the
   chapter's own type stays above it. The instrument reads `--deep-ink` from
   that section once per mode change and lifts its ink with it: no second
   palette, no hardcoded dark. The chart and sunk bands take the same fill
   treatment but are light, so the instrument keeps the sheet's ink there — the
   mode flag is `data-deep` alone.

   Under reduced motion — the system's or the panel's override — the loop never
   starts, and a preference that flips mid-session stops it, closes the lens and
   settles the instrument where it stands. The instrument is posed once, at its
   station, with no spin and no tilt, and a scroll burst re-reads the pose
   through a single `requestAnimationFrame`.
   ========================================================================== */

/** Raw sRGB, matching --ink (#131c19) exactly — written straight to the
    framebuffer, so three's colour management never enters the path. */
const INK: [number, number, number] = [0x13 / 255, 0x1c / 255, 0x19 / 255]

/** Raw sRGB, matching --mark (#bf1f34): the rim, the reticle and the ticks the
    loupe lays on the plate. */
const MARK: [number, number, number] = [0xbf / 255, 0x1f / 255, 0x34 / 255]

/** Radius of the loupe, in UV. The brief's 0.085: about 76 px on a 900 px
    viewport, small enough to read as a magnifier and not as a vignette. */
const LENS_RADIUS = 0.042

/** The same 0.18 per-frame damping the pointer module uses, as a time constant
    so the glide survives a dropped frame: 1 − exp(−dt · 11.9) ≈ 0.18 at 60 Hz. */
const LENS_DAMP = 11.9

/** Peak ink alpha. 5.6% of the ink over the ground — the contrast budget in
    DESIGN.md, with room for 8-bit rounding at the top of the printed ladder.
    The coarse print can only widen *coverage*: every pixel's alpha is still
    clamped to this ceiling at the end of the shader, so a coarse frame is denser
    but never darker than a fine one. The one exception is the loupe: under the
    glass the brief lets the print reach 2.3× this ceiling, because a magnifier
    that cannot darken the ink reveals nothing. The guard is restored outside
    the ring. Measured on the rendered page: see the lane report. */
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

/* ---- the coarse print ---------------------------------------------------
   The same normalised speed, read again for a second property of the paper:
   as the sheet is dragged, the screen loses its fineness. The numbers are the
   whole mapping, so they are stated once, here. */

/** Normalised speed at which the print starts to coarsen. Just above the lens's
    dead zone, so a reading scroll is still fine print. */
const COARSE_DEAD = 0.04

/** The span above COARSE_DEAD over which the screen reaches full coarseness —
    3× cells, spread hairlines, torn contours. */
const COARSE_SPAN = 0.46

/** Attack is nearly immediate (the paper takes the pressure), release is a hard
    settle: 1 → 0.02 in 355ms, i.e. fine print again within the brief's ~350ms.
    The lens is deliberately NOT reused for this: it releases over ~1.7s, and a
    print that took that long to come back would read as a filter fading. */
const COARSE_ATTACK = 14
const COARSE_RELEASE = 11

/** Below this the screen is a 1× cell again — the sheet has settled, and the
    value is snapped to zero so the shader's `floor(gl_FragCoord / cell)` is
    exactly the original screen. */
const COARSE_FLOOR = 0.02

/** Plate-change spike: attack, then decay. Peaks with the veil's plateau. */
const PULSE_RISE = 0.24
const PULSE_FALL = 0.62

/* ---- the instrument ----------------------------------------------------
   Every number below is a choice, so each one says what it is. The object is
   built at local radius 1 and scaled by the pose; the camera is the only place
   the viewport is involved. */

/** World radius at pose scale 1. The frustum is two units tall, so 0.2 is a
    sphere 0.2 viewport heights across — a plate-relative size, not a pixel one. */
const INSTRUMENT_K = 0.2

/** Below this CSS width the instrument is a distraction on a phone; the pose's
    scale and opacity are both multiplied by the same factor, computed once per
    resize and never in the frame. */
const COMPACT_WIDTH = 900
const COMPACT_FACTOR = 0.7

/** Pose damping, per second: λ = 3 is 63% of the way in 330ms. The instrument
    glides to its station and stops; it never follows the scroll frame by frame,
    which would read as a sticker on the glass. */
const POSE_DAMP = 3

/** The pose is re-read from the page every eighth frame. ~130ms at 60Hz: a
    section boundary cannot cross the centre line faster than that, and it keeps
    the `getBoundingClientRect` reads off the per-frame path. */
const POSE_SAMPLE = 8

/** ±6° of tilt at the edge of the viewport: enough that the sphere reads as an
    object in the room, small enough that the ring never reaches the type. */
const TILT = 0.10472

/** The first frame is not axis-aligned: a graticule seen straight down a
    meridian looks like a ladder, and the sphere reads as a disc. */
const ANGLE_START = 0.6

/** Line alphas. The ring is half the graticule — it is an annotation, not a
    second grid — and the ink chapter lifts both by a tenth, the same relative
    step the light sheet's ink takes on the dark band. */
const GRATICULE_ALPHA = 0.2
const DEEP_GRATICULE_ALPHA = 0.22
const RING_ALPHA = 0.1
const DEEP_RING_ALPHA = 0.11

/** The draw budget: one `LineSegments` for the graticule, one `LineLoop` for
    the ring, one `Points` for the thirteen marks. 960 graticule segments. */
const MERIDIANS = 24
const MERIDIAN_STEPS = 24
const PARALLELS = 12
const PARALLEL_STEPS = 32
const PARALLEL_LIMIT = 75
const PARALLEL_ARC = 150
const RING_RADIUS = 1.14
const RING_SEGMENTS = 96
const STATIONS = 12

/** The golden angle, so twelve dots on a sphere never line up on a meridian. */
const GOLDEN_ANGLE = 2.399963

/** Marks are printed symbols, not little spheres: their size is stated in CSS
    pixels and does not attenuate with the pose's scale. The node sits inside
    the graticule (0.86) so its larger mark never breaks the silhouette. */
const STATION_SIZE = 2.2
const STATION_ALPHA = 0.55
const NODE_SIZE = 6
const NODE_ALPHA = 0.95
const NODE_RADIUS = 0.86
const NODE_LATITUDE = 0.62
const NODE_LONGITUDE = 2.1

const DEG = Math.PI / 180

/* ---- the pose table ----------------------------------------------------
   Where the instrument is pinned on each chapter, in the sheet's reading order:
   cover → work → index → statement → territory → flight → operator → contact.
   `x`/`y` are viewport fractions, `scale` multiplies INSTRUMENT_K, `spin` is
   rad/s, `opacity` is the instrument's own alpha. Read from the page, never from
   a scroll timeline (the record is keyed by section id, so the order below is
   documentation — nothing iterates it); `territory` and `flight` declare zero
   opacity so the instrument leaves the reading chapters, and a pose whose
   chapter is not mounted is simply never sampled.

   The instrument reads `data-deep` only. The chart and sunk bands are opaque,
   but they are light platforms under the same sheet, so those chapters keep the
   sheet's ink: `index` and `statement` print in ink like any light chapter, and
   the one palette lift in this file stays the ink band's. */
type Pose = { x: number; y: number; scale: number; spin: number; opacity: number }

const POSES: Record<string, Pose> = {
  cover: { x: 0.76, y: 0.42, scale: 1.0, spin: 0.1, opacity: 0.85 },
  work: { x: 0.22, y: 0.3, scale: 0.72, spin: -0.08, opacity: 0.55 },
  index: { x: 0.72, y: 0.35, scale: 0.55, spin: 0.14, opacity: 0.4 },
  statement: { x: 0.5, y: 0.62, scale: 1.55, spin: 0.06, opacity: 0.3 },
  territory: { x: 0.5, y: 0.42, scale: 0.6, spin: 0.05, opacity: 0 },
  flight: { x: 0.5, y: 0.42, scale: 0.6, spin: 0.05, opacity: 0 },
  operator: { x: 0.84, y: 0.22, scale: 0.45, spin: 0.12, opacity: 0.35 },
  contact: { x: 0.14, y: 0.72, scale: 0.35, spin: -0.1, opacity: 0.45 },
}

/* The stations, in one program. A `ShaderMaterial` is how thirteen marks of
   different sizes and colours stay a single draw call: `Points` has no
   per-vertex size, and two `Points` objects would spend the budget. The size is
   `aSize * uDpr` and nothing else, which is exactly `sizeAttenuation: false`
   written out: a mark is a printed symbol and must not grow with the sphere. */
const STATION_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aMark;

  uniform float uDpr;
  uniform float uAlpha;
  uniform vec3 uInk;
  uniform vec3 uMark;

  varying vec3 vCol;
  varying float vAlpha;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uDpr;
    vCol = mix(uInk, uMark, aMark);
    vAlpha = aAlpha * uAlpha;
  }
`

const STATION_FRAG = /* glsl */ `
  varying vec3 vCol;
  varying float vAlpha;

  void main() {
    // A round mark: the square sprite is cut back to a disc, not masked.
    vec2 centred = gl_PointCoord - 0.5;
    if (dot(centred, centred) > 0.25) discard;
    gl_FragColor = vec4(vCol, vAlpha);
  }
`

/** `#rrggbb`, `#rgb` or `rgb(r, g, b)` → raw sRGB in 0..1, into `out`. Only
    called when the chapter or its deep flag changes, so the regex is free. */
const parseInk = (raw: string, out: [number, number, number]): boolean => {
  const text = raw.trim()

  if (text.charAt(0) === '#') {
    const digits = text.slice(1)
    const hex =
      digits.length === 3
        ? digits.charAt(0) +
          digits.charAt(0) +
          digits.charAt(1) +
          digits.charAt(1) +
          digits.charAt(2) +
          digits.charAt(2)
        : digits
    if (hex.length !== 6) return false
    const value = Number.parseInt(hex, 16)
    if (!Number.isFinite(value)) return false
    out[0] = ((value >> 16) & 0xff) / 255
    out[1] = ((value >> 8) & 0xff) / 255
    out[2] = (value & 0xff) / 255
    return true
  }

  const channels = /rgba?\(([^)]*)\)/.exec(text)
  if (!channels) return false
  const parts = channels[1].split(/[,\s/]+/).filter((part) => part.length > 0)
  if (parts.length < 3) return false
  for (let i = 0; i < 3; i += 1) {
    const channel = Number.parseFloat(parts[i])
    if (!Number.isFinite(channel)) return false
    out[i] = Math.min(1, Math.max(0, channel / 255))
  }
  return true
}

export type AtmosphereHandle = {
  /** Spike the lens for one plate change. Safe to call at any time. */
  pulse: () => void
  dispose: () => void
}

export function createAtmosphere(host: HTMLElement): AtmosphereHandle | null {
  // The effective preference, and it is mutable: the panel's override can change
  // mid-session, and every reader of this flag below must see the new answer.
  let reduced = effectiveReduced()
  // A finger has no hover and no loupe: the scene is the same, the glass is not.
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches

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
  // Two scenes, one buffer: the clear belongs to `draw()`, not to `render()`,
  // and the draw-call counter is read after both renders, so it must not reset
  // itself in between.
  renderer.autoClear = false
  renderer.info.autoReset = false

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
    uCoarse: { value: 0 },
    uBudget: { value: INK_BUDGET },
    // Device pixels per CSS pixel, as the renderer actually draws: the shader
    // needs it to keep the rim and reticle at a fixed CSS width after the DPR
    // ladder has scaled the buffer back.
    uDpr: { value: 1 },
    uInk: { value: new Vector3(INK[0], INK[1], INK[2]) },
    uLens: { value: new Vector2(0.5, 0.5) },
    uLensR: { value: LENS_RADIUS },
    uLensOn: { value: 0 },
    uMark: { value: new Vector3(MARK[0], MARK[1], MARK[2]) },
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

  /* ---- the instrument: a second scene in the same renderer ----------------
     One renderer, one canvas, one RAF. Its own camera is orthographic and its
     frustum is two units tall, so the object is built at local radius 1 and the
     pose decides how much of the viewport that radius covers. Every mesh,
     attribute and material is built here: the frame loop below only writes
     transforms, opacities and the two ink uniforms. */

  const instrumentScene = new Scene()
  const instrumentCamera = new OrthographicCamera(-1, 1, 1, -1, -10, 10)

  // `mount` is where the sheet pins the instrument (position, scale, tilt);
  // `spinner` is the sphere's own turn, so tilt never fights the spin.
  const mount = new Group()
  const spinner = new Group()
  mount.add(spinner)
  instrumentScene.add(mount)

  /** Half the viewport width in world units. Owned by `resize()`. */
  let aspect = 1

  /* The graticule: 24 meridians and 12 parallels, as one `LineSegments`.
     A meridian runs over both poles, so it is a full great circle; the 24 are
     spaced by a full turn's worth of longitude (2π/24) and therefore all
     distinct — spacing them by π/24 would draw every circle twice and double
     its alpha against the parallels. 24 × 24 + 12 × 32 = 960 segments. */
  const buildGraticule = (): BufferGeometry => {
    const meridianLon = (Math.PI * 2) / MERIDIANS
    const meridianLat = Math.PI / MERIDIAN_STEPS
    const parallelLon = (Math.PI * 2) / PARALLEL_STEPS
    const parallelLat = PARALLEL_ARC / (PARALLELS - 1)

    const positions = new Float32Array(
      (MERIDIANS * MERIDIAN_STEPS + PARALLELS * PARALLEL_STEPS) * 6,
    )
    let cursor = 0

    for (let m = 0; m < MERIDIANS; m += 1) {
      const lon = m * meridianLon
      const cosLon = Math.cos(lon)
      const sinLon = Math.sin(lon)
      let cosLat = Math.cos(-Math.PI / 2)
      let sinLat = Math.sin(-Math.PI / 2)
      for (let s = 0; s < MERIDIAN_STEPS; s += 1) {
        const nextLat = -Math.PI / 2 + (s + 1) * meridianLat
        const cosNext = Math.cos(nextLat)
        const sinNext = Math.sin(nextLat)
        positions[cursor] = cosLat * cosLon
        positions[cursor + 1] = sinLat
        positions[cursor + 2] = cosLat * sinLon
        positions[cursor + 3] = cosNext * cosLon
        positions[cursor + 4] = sinNext
        positions[cursor + 5] = cosNext * sinLon
        cursor += 6
        cosLat = cosNext
        sinLat = sinNext
      }
    }

    /* The parallels: twelve latitudes from −75° to +75°, where the convergence
       stops being readable at this size. Each is 32 chords, which at radius 1 is
       under a pixel of sag at the sizes the pose asks for. */
    for (let p = 0; p < PARALLELS; p += 1) {
      const lat = (-PARALLEL_LIMIT + p * parallelLat) * DEG
      const cosLat = Math.cos(lat)
      const sinLat = Math.sin(lat)
      for (let s = 0; s < PARALLEL_STEPS; s += 1) {
        const from = s * parallelLon
        const to = (s + 1) * parallelLon
        positions[cursor] = Math.cos(from) * cosLat
        positions[cursor + 1] = sinLat
        positions[cursor + 2] = Math.sin(from) * cosLat
        positions[cursor + 3] = Math.cos(to) * cosLat
        positions[cursor + 4] = sinLat
        positions[cursor + 5] = Math.sin(to) * cosLat
        cursor += 6
      }
    }

    const graticuleGeometry = new BufferGeometry()
    graticuleGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    return graticuleGeometry
  }

  /* Both inks are raw sRGB. `setRGB(..., SRGBColorSpace)` puts a `Color` into
     the renderer's working space so the line materials print `#131c19` exactly;
     the points' uniform stays raw because a `ShaderMaterial` writes to the
     framebuffer without conversion — the same path the sheet's INK takes. */
  const inkColor = new Color().setRGB(INK[0], INK[1], INK[2], SRGBColorSpace)
  /** The scratch the ink is parsed into. One tuple, reused for the lifetime. */
  const ink: [number, number, number] = [INK[0], INK[1], INK[2]]

  const graticuleGeometry = buildGraticule()
  const graticuleMaterial = new LineBasicMaterial({
    color: inkColor,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    opacity: GRATICULE_ALPHA,
  })
  const graticule = new LineSegments(graticuleGeometry, graticuleMaterial)
  graticule.frustumCulled = false
  spinner.add(graticule)

  /* The orbit ring: one circle in its local XY plane, tilted so it crosses the
     graticule at an angle instead of hugging a parallel. It lives inside
     `spinner`, so the ring turns with the sphere — the orbit belongs to the
     object, not to the page. */
  const ringGeometry = new BufferGeometry()
  const ringPositions = new Float32Array(RING_SEGMENTS * 3)
  for (let i = 0; i < RING_SEGMENTS; i += 1) {
    const angle = (i / RING_SEGMENTS) * Math.PI * 2
    ringPositions[i * 3] = Math.cos(angle) * RING_RADIUS
    ringPositions[i * 3 + 1] = Math.sin(angle) * RING_RADIUS
    ringPositions[i * 3 + 2] = 0
  }
  ringGeometry.setAttribute('position', new Float32BufferAttribute(ringPositions, 3))

  const ringMaterial = new LineBasicMaterial({
    color: inkColor,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    opacity: RING_ALPHA,
  })
  const ring = new LineLoop(ringGeometry, ringMaterial)
  ring.rotation.x = 1.08
  ring.rotation.z = 0.38
  ring.frustumCulled = false
  spinner.add(ring)

  /* The thirteen marks in one `Points`: twelve stations on a Fibonacci sphere
     (even coverage without a seam) and the one crimson node, inside the sphere
     at a fixed latitude so it rides the spin without leaving its parallel. */
  const buildStations = (): BufferGeometry => {
    const points: number[] = []
    const sizes: number[] = []
    const alphas: number[] = []
    const marks: number[] = []

    for (let i = 0; i < STATIONS; i += 1) {
      const y = 1 - (2 * (i + 0.5)) / STATIONS
      const radius = Math.sqrt(Math.max(0, 1 - y * y))
      const phi = i * GOLDEN_ANGLE
      points.push(Math.cos(phi) * radius, y, Math.sin(phi) * radius)
      sizes.push(STATION_SIZE)
      alphas.push(STATION_ALPHA)
      marks.push(0)
    }

    points.push(
      Math.cos(NODE_LATITUDE) * Math.cos(NODE_LONGITUDE) * NODE_RADIUS,
      Math.sin(NODE_LATITUDE) * NODE_RADIUS,
      Math.cos(NODE_LATITUDE) * Math.sin(NODE_LONGITUDE) * NODE_RADIUS,
    )
    sizes.push(NODE_SIZE)
    alphas.push(NODE_ALPHA)
    marks.push(1)

    const stationGeometry = new BufferGeometry()
    stationGeometry.setAttribute('position', new Float32BufferAttribute(points, 3))
    stationGeometry.setAttribute('aSize', new Float32BufferAttribute(sizes, 1))
    stationGeometry.setAttribute('aAlpha', new Float32BufferAttribute(alphas, 1))
    stationGeometry.setAttribute('aMark', new Float32BufferAttribute(marks, 1))
    return stationGeometry
  }

  const stationGeometry = buildStations()
  const stationUniforms = {
    // CSS pixels per device pixel: the marks are printed in CSS pixels.
    uDpr: { value: 1 },
    uAlpha: { value: 0 },
    uInk: { value: new Vector3(INK[0], INK[1], INK[2]) },
    uMark: { value: new Vector3(MARK[0], MARK[1], MARK[2]) },
  }
  const stationMaterial = new ShaderMaterial({
    uniforms: stationUniforms,
    vertexShader: STATION_VERT,
    fragmentShader: STATION_FRAG,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  })
  const stations = new Points(stationGeometry, stationMaterial)
  stations.frustumCulled = false
  spinner.add(stations)

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
    uniforms.uDpr.value = ratio

    /* The instrument, resized with the sheet: the frustum keeps the sphere
       round, the marks get the buffer's own device ratio, and the mount is
       moved from the current pose because the pose is stated in viewport
       fractions and the width just changed. */
    aspect = w / h
    instrumentCamera.left = -aspect
    instrumentCamera.right = aspect
    instrumentCamera.top = 1
    instrumentCamera.bottom = -1
    instrumentCamera.updateProjectionMatrix()
    stationUniforms.uDpr.value = ratio

    // The compact factor is decided once per resize, never in the frame.
    state.compact = w < COMPACT_WIDTH ? COMPACT_FACTOR : 1
    samplePose()
    if (reduced) settleInstant()
    applyPose()

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
    coarse: 0,
    pulse: 0,
    pulseClock: Number.POSITIVE_INFINITY,
    lastScroll: 0,
    resumed: true,
    covered: false,
    frame: 0,
    parity: 0,
    running: false,
    // The loupe, in UV space. Initialised to the centre so the first open
    // glides from the middle of the plate rather than from a corner.
    lensX: 0.5,
    lensY: 0.5,
    lensOn: 0,
    // The instrument. Its pose starts at the cover's station with the ink off,
    // so the first frames fade it in where the sheet will actually pin it
    // rather than sliding it in from a corner.
    x: POSES.cover.x,
    y: POSES.cover.y,
    scale: POSES.cover.scale,
    spin: POSES.cover.spin,
    targetX: POSES.cover.x,
    targetY: POSES.cover.y,
    targetScale: POSES.cover.scale,
    targetSpin: POSES.cover.spin,
    instrumentOpacity: 0,
    targetOpacity: 0,
    // The spin angle, integrated from the damped rate. Not zero, so the first
    // frame is not seen down a meridian.
    angle: ANGLE_START,
    tiltX: 0,
    tiltZ: 0,
    // Breadth of the applied pose, decided per resize.
    compact: 1,
    poseFrame: 0,
    // The current chapter's mode: `deep` lifts the ink, `inkId` is what it was
    // read for, so the computed style is touched only when the chapter changes.
    deep: false,
    inkId: '',
    // The layer is fixed, so it is always on screen; the observer keeps this
    // honest if that ever stops being true.
    inView: true,
  }

  const clamp = (value: number, min: number, max: number) =>
    value < min ? min : value > max ? max : value

  /** The ink chapter is opaque; while it owns the viewport, the sheet is not
      drawn — only the instrument, which prints on the band. */
  const isCovered = () => {
    const band = document.getElementById('operator')
    if (!band) return false
    const rect = band.getBoundingClientRect()
    return rect.top <= 1 && rect.bottom >= window.innerHeight - 1
  }

  const draw = () => {
    // One clear for both scenes. Every instrument material is depthTest: false
    // and depthWrite: false, so the second render needs no depth clear and
    // cannot sort against the first.
    renderer.info.reset()
    renderer.clear()

    if (!state.covered) {
      uniforms.uTime.value = state.time
      uniforms.uBend.value = state.bend
      uniforms.uCoarse.value = state.coarse
      uniforms.uPulse.value = state.pulse
      uniforms.uLens.value.set(state.lensX, state.lensY)
      uniforms.uLensOn.value = state.lensOn
      renderer.render(scene, camera)
    }

    /* The instrument's own alpha is the pose's: the whole object fades as one
       plate, and the line alphas are ratios of it (the ring at half the
       graticule) rather than independent opacities. Four draw calls at most —
       the sheet, the graticule, the ring and the thirteen marks — and one when
       the band owns the viewport. */
    if (state.instrumentOpacity > 0.004) {
      graticuleMaterial.opacity =
        (state.deep ? DEEP_GRATICULE_ALPHA : GRATICULE_ALPHA) * state.instrumentOpacity
      ringMaterial.opacity = (state.deep ? DEEP_RING_ALPHA : RING_ALPHA) * state.instrumentOpacity
      stationUniforms.uAlpha.value = state.instrumentOpacity
      renderer.render(instrumentScene, instrumentCamera)
    }
  }

  const drawOnce = () => {
    draw()
    if (canvas.dataset.live !== 'true') canvas.dataset.live = 'true'
  }

  /* ---- the pose: where the instrument stands on each chapter ------------- */

  /** The sections that ask for the instrument, and the `main` they were found
      in. A route change replaces `main`, so that is the one signal worth
      re-querying on — never the frame. */
  let sectionRoot: Element | null = null
  let sectionEls: HTMLElement[] = []

  const sectionsStale = () => {
    if (sectionRoot === null || !sectionRoot.isConnected) return true
    for (let i = 0; i < sectionEls.length; i += 1) {
      if (!sectionEls[i].isConnected) return true
    }
    return false
  }

  const rebuildSections = () => {
    const found = document.querySelectorAll<HTMLElement>('main > section[id]')
    const kept: HTMLElement[] = []
    for (let i = 0; i < found.length; i += 1) {
      const el = found[i]
      if (Object.hasOwn(POSES, el.id)) kept.push(el)
    }
    sectionEls = kept
    sectionRoot = document.querySelector('main')
  }

  /** The chapter's ink. Called only when the chapter or its deep flag changes:
      `getComputedStyle` is the one expensive read in the pose path. */
  const readInk = (el: HTMLElement, deep: boolean) => {
    if (deep) {
      const styles = getComputedStyle(el)
      const raw = styles.getPropertyValue('--deep-ink').trim() || styles.color
      // A token that does not parse leaves the sheet's ink in place: an
      // instrument in the wrong grey is better than one that disappears.
      if (!parseInk(raw, ink)) {
        ink[0] = INK[0]
        ink[1] = INK[1]
        ink[2] = INK[2]
      }
    } else {
      ink[0] = INK[0]
      ink[1] = INK[1]
      ink[2] = INK[2]
    }

    inkColor.setRGB(ink[0], ink[1], ink[2], SRGBColorSpace)
    graticuleMaterial.color.copy(inkColor)
    ringMaterial.color.copy(inkColor)
    // Raw sRGB: a ShaderMaterial writes to the framebuffer unconverted.
    stationUniforms.uInk.value.set(ink[0], ink[1], ink[2])
  }

  /**
   * Read the pose from the page and write the targets. The chapter that spans
   * the viewport's centre line is the one being read; if none does (a boundary
   * is exactly on it), the nearest wins. No home chapter at all — another
   * route — is the instrument's absence, not an error.
   */
  const samplePose = () => {
    if (sectionsStale()) rebuildSections()

    const centre = window.innerHeight * 0.5
    let spanning: HTMLElement | null = null
    let nearest: HTMLElement | null = null
    let nearestGap = Number.POSITIVE_INFINITY

    for (let i = 0; i < sectionEls.length; i += 1) {
      const el = sectionEls[i]
      const rect = el.getBoundingClientRect()
      if (rect.top <= centre && rect.bottom >= centre) {
        spanning = el
        break
      }
      const gap = rect.top > centre ? rect.top - centre : centre - rect.bottom
      if (gap < nearestGap) {
        nearestGap = gap
        nearest = el
      }
    }

    const chosen = spanning ?? nearest

    if (!chosen) {
      state.targetOpacity = 0
      if (state.deep || state.inkId !== '') {
        state.deep = false
        state.inkId = ''
        readInk(host, false)
      }
      return
    }

    const pose = POSES[chosen.id]
    state.targetX = pose.x
    state.targetY = pose.y
    state.targetScale = pose.scale * state.compact
    // Under reduced motion the sphere is still: the rate is settled to zero and
    // the angle never integrates.
    state.targetSpin = reduced ? 0 : pose.spin
    state.targetOpacity = pose.opacity * state.compact

    const deep = chosen.dataset.deep === 'true'
    if (chosen.id !== state.inkId || deep !== state.deep) {
      state.inkId = chosen.id
      state.deep = deep
      readInk(chosen, deep)
    }
  }

  /** Write the current pose to the scene graph. Object writes only. */
  const applyPose = () => {
    mount.position.x = (state.x - 0.5) * 2 * aspect
    mount.position.y = (0.5 - state.y) * 2
    mount.scale.setScalar(INSTRUMENT_K * state.scale)
    mount.rotation.z = state.tiltZ
    mount.rotation.x = state.tiltX
    // The angle is the integral of the damped rate: the sphere never jumps when
    // a chapter asks for a different turn.
    spinner.rotation.y = state.angle
  }

  /** The reduced-motion path: no damping, no spin, no tilt — the station the
      page says, applied as a fact rather than as a movement. */
  const settleInstant = () => {
    state.x = state.targetX
    state.y = state.targetY
    state.scale = state.targetScale
    state.spin = state.targetSpin
    state.instrumentOpacity = state.targetOpacity
    state.tiltX = 0
    state.tiltZ = 0
    applyPose()
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

    /* The print's own property, read from the same signal but not through the
       lens: it takes the speed before the lens damps it, so releasing the wheel
       starts the settle immediately instead of waiting out a 1.7s tail. */
    const throwSpeed = Math.abs(target)

    /* The sound lane reads this number rather than opening a second scroll
       listener: the room's low pass opens with the throw, and the audio side
       damps it and returns it to rest when this loop stops being called. */
    sound.velocity(throwSpeed)

    const ramp = clamp((throwSpeed - COARSE_DEAD) / COARSE_SPAN, 0, 1)
    const coarseTarget = ramp * ramp * (3 - 2 * ramp)
    state.coarse +=
      (coarseTarget - state.coarse) *
      Math.min(1, dt * (coarseTarget > state.coarse ? COARSE_ATTACK : COARSE_RELEASE))
    // The screen snaps back to exactly 1× rather than approaching it forever.
    if (state.coarse < COARSE_FLOOR) state.coarse = 0

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

    /* The loupe. The pointer module owns the sample (one listener, no second
       rAF); this loop owns the damping, because the atmosphere is already a
       frame. Position and aperture share one time constant, so the glass
       arrives as one object instead of a point chasing a fading circle.

       On a coarse pointer there is no hover, so the aperture target is always
       zero; under reduced motion this loop never starts at all. */
    const pointer = getPointer()
    const lensTargetX = width > 0 ? pointer.x / width : 0.5
    const lensTargetY = height > 0 ? 1 - pointer.y / height : 0.5
    const lensTarget = fine && pointer.inside ? 1 : 0

    if (state.lensOn === 0 && lensTarget === 1) {
      // Opening: start under the pointer. A loupe that slid in from the middle
      // of the sheet would read as a wipe, not as glass.
      state.lensX = lensTargetX
      state.lensY = lensTargetY
    }

    const aperture = Math.min(1, dt * LENS_DAMP)
    if (state.lensOn > 0 || lensTarget === 1) {
      state.lensX += (lensTargetX - state.lensX) * aperture
      state.lensY += (lensTargetY - state.lensY) * aperture
    }
    state.lensOn += (lensTarget - state.lensOn) * aperture
    // ~95 % in 260 ms; the two ends are snapped so "shut" and "open" are
    // exact states rather than a limit, and the idle test below can trust them.
    if (state.lensOn < 0.002) state.lensOn = 0
    else if (state.lensOn > 0.998) state.lensOn = 1

    /* An open but stationary loupe is still a live reading — the field drifts
       under the glass — but that drift is the only motion, so the 30 Hz idle is
       enough. Moving the glass, opening it or closing it restores full rate. */
    const lensSettled =
      state.lensOn === 0 ||
      (state.lensOn === 1 &&
        Math.abs(lensTargetX - state.lensX) < 0.0004 &&
        Math.abs(lensTargetY - state.lensY) < 0.0004)

    /* Ten times a second is enough to know whether the ink band owns the
       viewport; the check itself is a single rect read. */
    state.frame = (state.frame + 1) % 10
    if (state.frame === 0) state.covered = isCovered()

    /* The instrument's station, read from the page rather than driven by a
       timeline. Eight frames is ~130ms: a chapter boundary cannot cross the
       centre line faster than that, and the rect reads stay off the per-frame
       path. */
    state.poseFrame = (state.poseFrame + 1) % POSE_SAMPLE
    if (state.poseFrame === 0) samplePose()

    /* One damping for the whole pose, time-correct: λ = 3/s is 63% of the way
       in 330ms. The spin is damped as a rate, not as an angle, so a chapter
       that turns the sphere faster eases into the new speed instead of
       snapping the world. */
    const settle = 1 - Math.exp(-POSE_DAMP * dt)
    state.x += (state.targetX - state.x) * settle
    state.y += (state.targetY - state.y) * settle
    state.scale += (state.targetScale - state.scale) * settle
    state.spin += (state.targetSpin - state.spin) * settle
    state.instrumentOpacity += (state.targetOpacity - state.instrumentOpacity) * settle

    // Integrated from the damped rate: the angle is the only thing that grows.
    state.angle += state.spin * dt

    /* ±6° of tilt from the pointer sample the loupe already took: one listener,
       one read, no third rAF. A finger has no hover, so it gets none, and the
       target is zero outside the window rather than the last corner. */
    const tiltZ = fine && pointer.inside ? (pointer.x / width - 0.5) * 2 * TILT : 0
    const tiltX = fine && pointer.inside ? -(pointer.y / height - 0.5) * 2 * TILT : 0
    state.tiltZ += (tiltZ - state.tiltZ) * settle
    state.tiltX += (tiltX - state.tiltX) * settle

    applyPose()

    /* A pose that has arrived is not a reason to run at full rate — but the
       angle keeps advancing, so "still" still draws: at 30 Hz, which is the
       speed of a settled instrument, not a frozen one. */
    const poseSettled =
      Math.abs(state.targetX - state.x) < 0.0005 &&
      Math.abs(state.targetY - state.y) < 0.0005 &&
      Math.abs(state.targetScale - state.scale) < 0.0005 &&
      Math.abs(state.targetSpin - state.spin) < 0.0005 &&
      Math.abs(state.targetOpacity - state.instrumentOpacity) < 0.002
    const instrumentLive = state.instrumentOpacity > 0.004

    /* The drift does not need 60 Hz: at rest every second tick is enough, and
       the sheet is a texture. As soon as it is thrown — or a plate change
       spikes the field, or the loupe moves — the full rate resumes, so the
       reaction that the reader actually watches is never stepped.

       The coarse print is part of "moving", but it is never the reason the loop
       stays at full rate for long: it settles to zero in 355ms, while the lens
       is still easing back. It therefore adds no time to the full-rate window
       (the brief's cap is 600ms). */
    state.parity ^= 1
    const still =
      Math.abs(state.bend) < 0.015 &&
      state.coarse === 0 &&
      state.pulse < 0.008 &&
      // A moving or easing loupe needs the full rate; a settled one is the
      // sheet's own 30 Hz drift again.
      lensSettled &&
      poseSettled
    // Nothing to draw at all; or nothing that needs 60 Hz. The two tests are
    // separate so a covered viewport that *does* carry the instrument still
    // keeps the sheet's 30 Hz idle instead of paying for a frame nobody sees.
    if (state.covered && !instrumentLive) return
    if (still && state.parity === 0) return

    draw()
  }

  const stop = () => {
    if (!state.running) return
    state.running = false
    gsap.ticker.remove(frame)
  }

  const start = () => {
    if (state.running || reduced || !state.inView) return
    if (document.visibilityState !== 'visible') return
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

  /* Under reduced motion the ticker never starts, so the instrument needs its
     own way to follow the page. One passive scroll listener, one frame per
     burst: the pose is read, settled without damping, and the plate is redrawn
     once. No loop survives the burst. */
  let poseFrame = 0
  const onPoseScroll = () => {
    if (poseFrame) return
    poseFrame = requestAnimationFrame(() => {
      poseFrame = 0
      samplePose()
      settleInstant()
      state.covered = isCovered()
      drawOnce()
    })
  }

  /* The layer is fixed and always on screen, so this is a latent guard rather
     than an optimisation: if it is ever parked outside the field — a future
     panel, a print stylesheet — the loop stops instead of drawing a canvas
     nobody can see. */
  const intersection = new IntersectionObserver(
    (entries) => {
      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i]
        state.inView = entry.isIntersecting
        if (state.inView) start()
        else stop()
      }
    },
    { threshold: 0 },
  )
  intersection.observe(host)

  /* ---- the reader's motion preference, honouring a mid-session flip --------
     One subscription for the life of the surface, released by `dispose`. The
     callback runs on a rare event — the system's query flipping, or the panel's
     override being set — never inside `frame()`, so nothing is added to the
     per-frame path. */

  const applyMotionState = () => {
    const next = effectiveReduced()
    if (next === reduced) return
    reduced = next
    if (reduced) {
      stop()
      // The loupe is a live pointer reading and the spin is the loop's own
      // integral: both stop with the loop, and the plate is reprinted once, still.
      state.lensOn = 0
      state.spin = 0
      state.targetSpin = 0
      state.tiltX = 0
      state.tiltZ = 0
      // The plate is at rest, so it must be printed at rest: a throw frozen into
      // `bend`, `coarse` or `pulse` would leave the sheet mid-gesture under a
      // reader who just asked for stillness.
      state.bend = 0
      state.coarse = 0
      state.pulse = 0
      state.pulseClock = Number.POSITIVE_INFINITY
      samplePose()
      settleInstant()
      state.covered = isCovered()
      drawOnce()
      window.addEventListener('scroll', onPoseScroll, { passive: true })
    } else {
      window.removeEventListener('scroll', onPoseScroll)
      state.resumed = true
      samplePose()
      applyPose()
      start()
    }
  }
  const releaseMotion = subscribeMotion(applyMotionState)

  /* ---- lifecycle -------------------------------------------------------- */

  const observer = new ResizeObserver(scheduleResize)
  observer.observe(document.documentElement)
  window.addEventListener('resize', scheduleResize)
  if (reduced) window.addEventListener('scroll', onPoseScroll, { passive: true })

  canvas.addEventListener('webglcontextlost', onContextLost)
  document.addEventListener('visibilitychange', onVisibility)

  const dispose = () => {
    releaseMotion()
    stop()
    if (pendingResize) cancelAnimationFrame(pendingResize)
    pendingResize = 0
    if (poseFrame) cancelAnimationFrame(poseFrame)
    poseFrame = 0

    observer.disconnect()
    intersection.disconnect()
    window.removeEventListener('resize', scheduleResize)
    window.removeEventListener('scroll', onPoseScroll)
    canvas.removeEventListener('webglcontextlost', onContextLost)
    document.removeEventListener('visibilitychange', onVisibility)

    scene.clear()
    instrumentScene.clear()
    geometry.dispose()
    material.dispose()
    graticuleGeometry.dispose()
    graticuleMaterial.dispose()
    ringGeometry.dispose()
    ringMaterial.dispose()
    stationGeometry.dispose()
    stationMaterial.dispose()
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

  /* The dev handle: the draw-call count, the pose and the loop state, for the
     browser to read. A production bundle carries none of it. */
  if (import.meta.env.DEV) {
    type Probe = {
      calls: () => number
      pose: () => typeof state
      running: () => boolean
    }
    ;(window as unknown as { __atm?: Probe }).__atm = {
      calls: () => renderer.info.render.calls,
      pose: () => ({ ...state }),
      running: () => state.running,
    }
  }

  return { pulse, dispose }
}

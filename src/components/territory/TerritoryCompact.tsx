import { useEffect, useRef } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  LineSegments,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three'
import { gsap } from 'gsap'
import { territoryLinks, territoryStations, territoryTrace, type TierId } from '../../content/territory'

/* ============================================================================
   The compact schema — the territory on a phone
   ----------------------------------------------------------------------------
   Not the desktop plate shrunk. The plate is a 1212 × 576 drawing of twelve
   stations; a 390 × 388 box cannot hold that, so this is the same survey cut
   down to the eight marks that carry the argument — three of the edge's four
   doors (opnsense, caddy, warpgate), the two nodes and the backup target, and
   the two services a visitor would actually use.

   What is kept, because it is the section:
   - the three plans, EDGE / FABRIC / SERVICES, in the same order and the same
     share of the footprint; strata are roles, and every mark but pve1 and pve3
     is a guest;
   - the walk: one request from the edge, through the proxy, onto a service;
   - the quiet tie from a guest to the node it hangs from, which only reaches
     that node when the mark is being read;
   - one crimson mark: the ringed control point (opnsense).

   What is deliberately dropped at this size: the plan graticule, the off-site
   branch, the projected DOM labels. The labels are replaced by the readout line
   under the canvas — it names the mark and spells its chain — because eight
   words at 11px on a 390px drawing is a diagram read through a keyhole.

   Engineering (same discipline as the hero and the desktop plate):
   - one renderer, one orthographic camera, three draw calls, 24 line segments
     (12 plan edges + 12 links), 8 point sprites, no triangles, no textures;
   - DPR capped at 1.75 — the drawing is 1px hairlines, not a photograph;
   - one ticker: GSAP's. It is *removed* as soon as the orbit and the trace
     settle, so an idle phone draws zero frames, and it is removed while the
     section is offscreen or the tab is hidden;
   - a tap hit-tests against the projected marks in CSS pixels with a 34px
     radius;
   - reduced motion draws one frame and never turns;
   - no WebGL lands on an SVG plate built from the same table, so the fallback
     cannot drift from the drawing.
   ========================================================================== */

const TIERS: TierId[] = ['edge', 'fabric', 'services']
const TIER_INDEX: Record<TierId, number> = { edge: 0, fabric: 1, services: 2 }

/**
 * The plans. Same footprint for all three, and deliberately taller in z than
 * the desktop plate: a phone band is nearly square, and a plan seen at 35° has
 * to be deep for the stack to fill a square instead of a letterbox.
 */
const PLAN_X = 1.7
const PLAN_Z = 1.15
const TIER_Y: Record<TierId, number> = { edge: 1.35, fabric: 0, services: -1.35 }

/** Base view, and how far a finger may turn it. ±20°, exactly as asked. */
const BASE_AZ = 0.24
const BASE_EL = 0.44
const ORBIT = 0.349

/** The frame's margins. Wider than the desktop plate's, because a thumb covers. */
const FILL_X = 0.9
const FILL_Y = 0.88
const TIER_FILL_X = 0.97
const TIER_FILL_Y = 0.5

/** The link that does not reach its node until the mark is read: 0.62 units. */
const PEG = 0.62

/** The eight marks, placed on their own plan. Layout, not geography. */
const MARKS: { id: string; x: number; z: number }[] = [
  { id: 'warpgate', x: -1.24, z: -0.42 },
  { id: 'opnsense', x: 0, z: 0.32 },
  { id: 'caddy', x: 1.18, z: -0.4 },
  { id: 'pve1', x: -1.02, z: 0.3 },
  { id: 'pve3', x: 0.42, z: -0.34 },
  { id: 'pbs', x: 1.28, z: 0.52 },
  { id: 'nextcloud', x: -0.92, z: 0.34 },
  { id: 'mealboard', x: 0.7, z: -0.16 },
]

const MARK_IDS = new Set(MARKS.map((mark) => mark.id))

const byId = new Map(territoryStations.map((station) => [station.id, station]))

const markAt = new Map(MARKS.map((mark) => [mark.id, mark]))

/* Raw sRGB, matching --ink, --contour and --mark. Every material is a custom
   ShaderMaterial writing straight to the framebuffer, so three's colour
   management never enters the path and the WebGL ink equals the CSS ink. */
const INK: [number, number, number] = [0x13 / 255, 0x1c / 255, 0x19 / 255]
const CONTOUR: [number, number, number] = [0xb2 / 255, 0xbc / 255, 0xb1 / 255]
const MARK: [number, number, number] = [0xbf / 255, 0x1f / 255, 0x34 / 255]

/* --------------------------------------------------------------------------
   Shaders
   ------------------------------------------------------------------------ */

const PLANE_VERT = /* glsl */ `
  attribute float aTier;
  varying float vTier;

  void main() {
    vTier = aTier;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const PLANE_FRAG = /* glsl */ `
  uniform vec3 uContour;
  uniform float uTierFocus;
  uniform float uTrace;

  varying float vTier;

  void main() {
    // Framing a stratum brings its plan forward and drops the other two to a
    // ruling: the reader keeps the context of what sits above and below.
    float tier = (uTierFocus < -0.5 || abs(vTier - uTierFocus) < 0.5) ? 1.0 : 0.34;
    gl_FragColor = vec4(uContour, 0.72 * tier * (1.0 - 0.35 * uTrace));
  }
`

const LINK_VERT = /* glsl */ `
  attribute vec3 aTo;
  attribute float aTie;
  attribute float aFocus;
  attribute float aTone;

  uniform float uTrace;

  varying float vAlpha;

  void main() {
    // Both vertices of a link are anchored at its source; aTo carries the
    // target (and, for the first vertex, the source again). Both therefore
    // compute the same endpoint function and the pair lands on the segment.
    float lit = aFocus * uTrace;

    // A host tie rests as a short tick on its own plan, pointing at the node it
    // hangs from. Tracing the mark lets it reach that node — the one relation
    // on the sheet that is not traffic.
    vec3 across = vec3(aTo.x - position.x, 0.0, aTo.z - position.z);
    float span = max(length(across), 0.0001);
    vec3 peg = position + (across / span) * min(${PEG.toFixed(2)}, span);
    vec3 end = aTie > 0.5 ? mix(peg, aTo, lit) : aTo;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(end, 1.0);

    vAlpha = mix(1.0, aFocus, uTrace) * mix(aTone, 1.0, lit);
  }
`

const LINK_FRAG = /* glsl */ `
  uniform vec3 uInk;
  uniform float uOpacity;

  varying float vAlpha;

  void main() {
    gl_FragColor = vec4(uInk, vAlpha * uOpacity);
  }
`

const NODE_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aKind;
  attribute float aTier;
  attribute float aFocus;

  uniform float uDpr;
  uniform float uTrace;
  uniform float uTierFocus;

  varying float vKind;
  varying float vAlpha;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = aSize * uDpr;

    float tier = (uTierFocus < -0.5 || abs(aTier - uTierFocus) < 0.5) ? 1.0 : 0.34;
    vAlpha = tier * mix(1.0, aFocus, uTrace);
    vKind = aKind;
  }
`

const NODE_FRAG = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uMark;

  varying float vKind;
  varying float vAlpha;

  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float ax = abs(q.x);
    float ay = abs(q.y);
    float shape = 0.0;
    float ring = 0.0;

    if (vKind < 0.5) {
      // Station: a survey cross.
      float h = (1.0 - smoothstep(0.09, 0.16, ay)) * (1.0 - step(0.84, ax));
      float v = (1.0 - smoothstep(0.09, 0.16, ax)) * (1.0 - step(0.84, ay));
      shape = max(h, v);
    } else if (vKind < 1.5) {
      // Service: a filled square.
      shape = 1.0 - smoothstep(0.4, 0.48, max(ax, ay));
    } else {
      // Control point: one hairline ring around a crosshair. The drawing's one
      // crimson mark, and the only place it is allowed.
      float d = length(q);
      ring = 1.0 - smoothstep(0.014, 0.045, abs(d - 0.37));
      float h = (1.0 - smoothstep(0.014, 0.045, ay)) * (1.0 - step(0.14, ax));
      float v = (1.0 - smoothstep(0.014, 0.045, ax)) * (1.0 - step(0.14, ay));
      shape = max(ring, max(h, v));
    }

    if (shape < 0.004) discard;

    vec3 c = vKind > 1.5 ? mix(uInk, uMark, ring) : uInk;
    gl_FragColor = vec4(c, vAlpha * shape);
  }
`

/* --------------------------------------------------------------------------
   The SVG plate — what is drawn when WebGL never arrives
   --------------------------------------------------------------------------
   Built from the same table and the same projection, at a fixed reference size,
   so it is a view of the drawing and not a second illustration. Hairlines carry
   `vector-effect: non-scaling-stroke`: the plate scales, the 1px rule does not.
   ------------------------------------------------------------------------ */

const PLATE_W = 390
const PLATE_H = 340
const PLATE_PAD = 16

type PlateMark = { id: string; kind: string; x: number; y: number }

function buildPlate(): { planes: string[]; marks: PlateMark[] } {
  // The same bearing and elevation as the canvas at rest, so the fallback is the
  // drawing the scene would have shown and not a second view of it.
  const az = BASE_AZ
  const el = BASE_EL
  const cosA = Math.cos(az)
  const sinA = Math.sin(az)
  const cosE = Math.cos(el)
  const sinE = Math.sin(el)

  const project = (x: number, y: number, z: number) => ({
    x: x * cosA - z * sinA,
    y: -(-x * sinA * sinE + y * cosE - z * cosA * sinE),
  })

  const corners = (tier: TierId) =>
    [
      [-PLAN_X, TIER_Y[tier], -PLAN_Z],
      [PLAN_X, TIER_Y[tier], -PLAN_Z],
      [PLAN_X, TIER_Y[tier], PLAN_Z],
      [-PLAN_X, TIER_Y[tier], PLAN_Z],
    ].map(([x, y, z]) => project(x, y, z))

  const raw = TIERS.map(corners)
  const marks = MARKS.map((mark) => {
    const station = byId.get(mark.id)
    const p = project(mark.x, TIER_Y[station?.tier ?? 'fabric'], mark.z)
    return { id: mark.id, kind: station?.kind ?? 'service', ...p }
  })

  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const collect = (p: { x: number; y: number }) => {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  for (const plane of raw) for (const p of plane) collect(p)
  for (const mark of marks) collect(mark)

  const scale = Math.min(
    (PLATE_W - PLATE_PAD * 2) / Math.max(0.001, maxX - minX),
    (PLATE_H - PLATE_PAD * 2) / Math.max(0.001, maxY - minY),
  )
  const ox = PLATE_W / 2 - ((minX + maxX) / 2) * scale
  const oy = PLATE_H / 2 - ((minY + maxY) / 2) * scale
  const sx = (value: number) => Math.round((value * scale + ox) * 10) / 10
  const sy = (value: number) => Math.round((value * scale + oy) * 10) / 10

  const planes = raw.map(
    (plane) => `M${plane.map((p) => `${sx(p.x)} ${sy(p.y)}`).join('L')}Z`,
  )

  return {
    planes,
    marks: marks.map((mark) => ({ id: mark.id, kind: mark.kind, x: sx(mark.x), y: sy(mark.y) })),
  }
}

const PLATE = buildPlate()

function CompactPlate() {
  return (
    <svg
      className="tty-mini__plate"
      viewBox={`0 0 ${PLATE_W} ${PLATE_H}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
      focusable="false"
    >
      {PLATE.planes.map((d) => (
        <path className="tty-mini__plane" d={d} key={d} />
      ))}

      {PLATE.marks.map((mark) =>
        mark.kind === 'node' ? (
          <path
            className="tty-mini__mark"
            key={mark.id}
            d={`M${mark.x - 5} ${mark.y}H${mark.x + 5}M${mark.x} ${mark.y - 5}V${mark.y + 5}`}
          />
        ) : mark.kind === 'service' ? (
          <rect
            className="tty-mini__mark tty-mini__mark--service"
            key={mark.id}
            x={mark.x - 4}
            y={mark.y - 4}
            width="8"
            height="8"
          />
        ) : (
          <g key={mark.id}>
            <circle className="tty-mini__mark tty-mini__mark--ring" cx={mark.x} cy={mark.y} r="8" />
            <path
              className="tty-mini__mark"
              d={`M${mark.x - 3} ${mark.y}H${mark.x + 3}M${mark.x} ${mark.y - 3}V${mark.y + 3}`}
            />
          </g>
        ),
      )}
    </svg>
  )
}

/* --------------------------------------------------------------------------
   The scene
   ------------------------------------------------------------------------ */

export type CompactHandle = {
  /** Frame one plan, or the whole stack. */
  frame: (tier: TierId | null) => void
  /** Light one mark's walk, or clear the drawing. */
  trace: (id: string | null) => void
}

type Props = {
  tier: TierId | null
  focus: string | null
  handleRef: { current: CompactHandle | null }
  onFocus: (id: string | null) => void
  onReady: () => void
  onUnavailable: () => void
}

export default function TerritoryCompact({ tier, focus, handleRef, onFocus, onReady, onUnavailable }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const live = useRef({ onFocus, onReady, onUnavailable })
  useEffect(() => {
    live.current = { onFocus, onReady, onUnavailable }
  })

  /* ---- the scene, built once ------------------------------------------- */

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' })
    } catch {
      live.current.onUnavailable()
      return
    }

    if (!renderer.getContext()) {
      renderer.dispose()
      live.current.onUnavailable()
      return
    }

    const dprCap = 1.75
    renderer.setClearAlpha(0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap))

    const canvas = renderer.domElement
    canvas.className = 'tty-mini__canvas'
    host.appendChild(canvas)

    const scene = new Scene()
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200)

    /* ---- geometry ------------------------------------------------------- */

    const world: Vector3[] = []
    const nodePos: number[] = []
    const nodeSize: number[] = []
    const nodeKind: number[] = []
    const nodeTier: number[] = []
    const nodeFocus: number[] = []

    const NODE_SIZE = { node: 22, service: 16, control: 32 }

    const nodeIndex = new Map<string, number>()

    MARKS.forEach((mark) => {
      const station = byId.get(mark.id)
      if (!station) return
      const y = TIER_Y[station.tier]
      nodeIndex.set(mark.id, world.length)
      world.push(new Vector3(mark.x, y, mark.z))
      nodePos.push(mark.x, y, mark.z)
      nodeSize.push(NODE_SIZE[station.kind])
      nodeKind.push(station.kind === 'control' ? 2 : station.kind === 'service' ? 1 : 0)
      nodeTier.push(TIER_INDEX[station.tier])
      nodeFocus.push(1)
    })

    // Plan neatlines: four edges per plan, twelve segments. No internal
    // graticule at this size — at 1px on a 390px drawing it reads as graph
    // paper, not as a plan.
    const planePos: number[] = []
    const planeTier: number[] = []
    const edges: [number, number, number, number][] = [
      [-PLAN_X, -PLAN_Z, PLAN_X, -PLAN_Z],
      [PLAN_X, -PLAN_Z, PLAN_X, PLAN_Z],
      [PLAN_X, PLAN_Z, -PLAN_X, PLAN_Z],
      [-PLAN_X, PLAN_Z, -PLAN_X, -PLAN_Z],
    ]
    TIERS.forEach((tierId, index) => {
      const y = TIER_Y[tierId]
      for (const [ax, az, bx, bz] of edges) {
        planePos.push(ax, y, az, bx, y, bz)
        planeTier.push(index, index)
      }
    })

    // Links: only those whose two ends are both on this plate. The tokens
    // (`internet`, `off-site`) are not drawn here; the readout still names them.
    const links = territoryLinks.filter((link) => MARK_IDS.has(link.a) && MARK_IDS.has(link.b))

    const linkPos: number[] = []
    const linkTo: number[] = []
    const linkTie: number[] = []
    const linkTone: number[] = []
    const linkFocus: number[] = []

    const pointOf = (id: string) => {
      const mark = markAt.get(id)
      const station = byId.get(id)
      if (!mark || !station) return null
      return { x: mark.x, y: TIER_Y[station.tier], z: mark.z }
    }

    for (const link of links) {
      const a = pointOf(link.a)
      const b = pointOf(link.b)
      if (!a || !b) continue
      const tie = link.tie === true
      const tone = tie ? 0.55 : 1
      linkPos.push(a.x, a.y, a.z, a.x, a.y, a.z)
      linkTo.push(a.x, a.y, a.z, b.x, b.y, b.z)
      linkTie.push(tie ? 1 : 0, tie ? 1 : 0)
      linkTone.push(tone, tone)
      linkFocus.push(1, 1)
    }

    const planeGeometry = new BufferGeometry()
    planeGeometry.setAttribute('position', new Float32BufferAttribute(planePos, 3))
    planeGeometry.setAttribute('aTier', new Float32BufferAttribute(planeTier, 1))

    const linkGeometry = new BufferGeometry()
    linkGeometry.setAttribute('position', new Float32BufferAttribute(linkPos, 3))
    linkGeometry.setAttribute('aTo', new Float32BufferAttribute(linkTo, 3))
    linkGeometry.setAttribute('aTie', new Float32BufferAttribute(linkTie, 1))
    linkGeometry.setAttribute('aTone', new Float32BufferAttribute(linkTone, 1))
    linkGeometry.setAttribute(
      'aFocus',
      new Float32BufferAttribute(linkFocus, 1).setUsage(DynamicDrawUsage),
    )

    const nodeGeometry = new BufferGeometry()
    nodeGeometry.setAttribute('position', new Float32BufferAttribute(nodePos, 3))
    nodeGeometry.setAttribute('aSize', new Float32BufferAttribute(nodeSize, 1))
    nodeGeometry.setAttribute('aKind', new Float32BufferAttribute(nodeKind, 1))
    nodeGeometry.setAttribute('aTier', new Float32BufferAttribute(nodeTier, 1))
    nodeGeometry.setAttribute(
      'aFocus',
      new Float32BufferAttribute(nodeFocus, 1).setUsage(DynamicDrawUsage),
    )

    /* ---- materials ------------------------------------------------------ */

    const uniforms = {
      uTrace: { value: 0 },
      uTierFocus: { value: -1 },
      uDpr: { value: renderer.getPixelRatio() },
      uInk: { value: new Vector3(INK[0], INK[1], INK[2]) },
      uMark: { value: new Vector3(MARK[0], MARK[1], MARK[2]) },
      uContour: { value: new Vector3(CONTOUR[0], CONTOUR[1], CONTOUR[2]) },
      uOpacity: { value: 0.62 },
    }

    const shared = { uniforms, transparent: true, depthTest: false, depthWrite: false }

    const planeMaterial = new ShaderMaterial({
      ...shared,
      vertexShader: PLANE_VERT,
      fragmentShader: PLANE_FRAG,
    })
    const linkMaterial = new ShaderMaterial({
      ...shared,
      vertexShader: LINK_VERT,
      fragmentShader: LINK_FRAG,
    })
    const nodeMaterial = new ShaderMaterial({
      ...shared,
      vertexShader: NODE_VERT,
      fragmentShader: NODE_FRAG,
    })

    const planes = new LineSegments(planeGeometry, planeMaterial)
    planes.renderOrder = 0
    const linksMesh = new LineSegments(linkGeometry, linkMaterial)
    linksMesh.renderOrder = 1
    const marks = new Points(nodeGeometry, nodeMaterial)
    marks.renderOrder = 2
    scene.add(planes, linksMesh, marks)

    /* ---- the frame ------------------------------------------------------ */

    const linkFocusAttr = linkGeometry.getAttribute('aFocus') as BufferAttribute
    const nodeFocusAttr = nodeGeometry.getAttribute('aFocus') as BufferAttribute
    const linkFocusArray = linkFocusAttr.array as Float32Array
    const nodeFocusArray = nodeFocusAttr.array as Float32Array

    const view = { w: 1, h: 1, aspect: 1 }
    const cam = {
      az: BASE_AZ,
      azGoal: BASE_AZ,
      zoom: 1,
      zoomGoal: 1,
      center: new Vector3(),
      centerGoal: new Vector3(),
      tier: null as TierId | null,
    }
    let trace = 0
    let traceGoal = 0
    let focusId: string | null = null

    /**
     * The fit. An orthographic camera translates linearly, so the union of the
     * drawing over the orbit can be centred and scaled exactly: no iterative
     * solve, and the corner that swings out at ±20° is inside the frame rather
     * than clipped by it.
     */
    const probe = new OrthographicCamera(-1, 1, 1, -1, 0.1, 200)
    const scratch = new Vector3()
    const rightAxis = new Vector3()
    const upAxis = new Vector3()

    const placeProbe = (az: number, el: number, center: Vector3) => {
      probe.position.set(
        center.x + Math.sin(az) * Math.cos(el) * 40,
        center.y + Math.sin(el) * 40,
        center.z + Math.cos(az) * Math.cos(el) * 40,
      )
      probe.up.set(0, 1, 0)
      probe.lookAt(center)
      probe.updateMatrixWorld()
      probe.matrixWorldInverse.copy(probe.matrixWorld).invert()
    }

    const fit = (points: Vector3[], centerY: number, fillX: number, fillY: number) => {
      const center = new Vector3(0, centerY, 0)

      placeProbe(BASE_AZ, BASE_EL, center)
      let minX = Infinity
      let maxX = -Infinity
      let minY = Infinity
      let maxY = -Infinity
      for (const point of points) {
        scratch.copy(point).applyMatrix4(probe.matrixWorldInverse)
        if (scratch.x < minX) minX = scratch.x
        if (scratch.x > maxX) maxX = scratch.x
        if (scratch.y < minY) minY = scratch.y
        if (scratch.y > maxY) maxY = scratch.y
      }

      // Slide the aim so the projected drawing is centred, not the origin.
      rightAxis.setFromMatrixColumn(probe.matrixWorld, 0)
      upAxis.setFromMatrixColumn(probe.matrixWorld, 1)
      center.addScaledVector(rightAxis, (minX + maxX) / 2)
      center.addScaledVector(upAxis, (minY + maxY) / 2)

      // Then measure the whole sweep at the new aim, and fit the scale to it.
      minX = Infinity
      maxX = -Infinity
      minY = Infinity
      maxY = -Infinity
      for (const az of [BASE_AZ - ORBIT, BASE_AZ, BASE_AZ + ORBIT]) {
        placeProbe(az, BASE_EL, center)
        for (const point of points) {
          scratch.copy(point).applyMatrix4(probe.matrixWorldInverse)
          if (scratch.x < minX) minX = scratch.x
          if (scratch.x > maxX) maxX = scratch.x
          if (scratch.y < minY) minY = scratch.y
          if (scratch.y > maxY) maxY = scratch.y
        }
      }

      const hx = Math.max(Math.abs(minX), Math.abs(maxX), 0.001)
      const hy = Math.max(Math.abs(minY), Math.abs(maxY), 0.001)
      const zoom = Math.min((fillX * view.aspect) / hx, fillY / hy)

      return { center, zoom }
    }

    const stackPoints = world.slice()
    for (const tierId of TIERS) {
      const y = TIER_Y[tierId]
      stackPoints.push(
        new Vector3(-PLAN_X, y, -PLAN_Z),
        new Vector3(PLAN_X, y, -PLAN_Z),
        new Vector3(PLAN_X, y, PLAN_Z),
        new Vector3(-PLAN_X, y, PLAN_Z),
      )
    }

    const tierPoints = new Map<TierId, Vector3[]>()
    for (const tierId of TIERS) {
      const y = TIER_Y[tierId]
      const points = [
        new Vector3(-PLAN_X, y, -PLAN_Z),
        new Vector3(PLAN_X, y, -PLAN_Z),
        new Vector3(PLAN_X, y, PLAN_Z),
        new Vector3(-PLAN_X, y, PLAN_Z),
      ]
      for (const [id, index] of nodeIndex) {
        const station = byId.get(id)
        if (station?.tier === tierId) points.push(world[index])
      }
      tierPoints.set(tierId, points)
    }

    let overviewFit = { center: new Vector3(), zoom: 1 }
    const tierFits = new Map<TierId, { center: Vector3; zoom: number }>()

    const solve = () => {
      overviewFit = fit(stackPoints, 0, FILL_X, FILL_Y)
      tierFits.clear()
      for (const tierId of TIERS) {
        tierFits.set(tierId, fit(tierPoints.get(tierId) ?? [], TIER_Y[tierId], TIER_FILL_X, TIER_FILL_Y))
      }
    }

    const placeCamera = () => {
      const el = BASE_EL
      const dir = scratch.set(
        Math.sin(cam.az) * Math.cos(el),
        Math.sin(el),
        Math.cos(cam.az) * Math.cos(el),
      )
      camera.position.copy(cam.center).addScaledVector(dir, 40)
      camera.up.set(0, 1, 0)
      camera.lookAt(cam.center)
      camera.zoom = cam.zoom
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld()
    }

    /* ---- projection of the marks, for the tap --------------------------- */

    const screen = new Float32Array(world.length * 2)

    const projectMarks = () => {
      for (let i = 0; i < world.length; i++) {
        scratch.copy(world[i]).project(camera)
        screen[i * 2] = (scratch.x * 0.5 + 0.5) * view.w
        screen[i * 2 + 1] = (-scratch.y * 0.5 + 0.5) * view.h
      }
    }

    const hitTest = (px: number, py: number): string | null => {
      const radius = 34
      let best: string | null = null
      let bestDist = radius * radius
      for (const [id, index] of nodeIndex) {
        const dx = screen[index * 2] - px
        const dy = screen[index * 2 + 1] - py
        const d = dx * dx + dy * dy
        if (d <= bestDist) {
          bestDist = d
          best = id
        }
      }
      return best
    }

    /* ---- focus ---------------------------------------------------------- */

    const applyFocus = (id: string | null) => {
      linkFocusArray.fill(id ? 0.08 : 1)
      nodeFocusArray.fill(id ? 0.18 : 1)

      if (id) {
        const lit = new Set(territoryTrace(id))
        for (const [markId, index] of nodeIndex) {
          if (lit.has(markId)) nodeFocusArray[index] = 1
        }
        for (let i = 0; i < links.length; i++) {
          if (!lit.has(links[i].a) || !lit.has(links[i].b)) continue
          linkFocusArray[i * 2] = 1
          linkFocusArray[i * 2 + 1] = 1
        }
      }

      linkFocusAttr.needsUpdate = true
      nodeFocusAttr.needsUpdate = true

      // The trace is one eased scalar: it dims the rest of the sheet and lets
      // the traced ties reach their nodes. Reduced motion gets it at once, so
      // the single frame it draws is already the final state.
      traceGoal = id ? 1 : 0
      if (reduced) {
        trace = traceGoal
        uniforms.uTrace.value = trace
      }
    }

    const select = (id: string | null) => {
      if (id === focusId) return
      focusId = id
      applyFocus(id)
      live.current.onFocus(id)
      wake()
    }

    const setTrace = (id: string | null) => {
      if (id === focusId) return
      focusId = id
      applyFocus(id)
      wake()
    }

    /* ---- drawing -------------------------------------------------------- */

    const render = () => {
      if (lost) return
      placeCamera()
      projectMarks()
      renderer.render(scene, camera)
    }

    const step = (dt: number) => {
      const k = reduced ? 1 : 1 - Math.exp(-Math.min(dt, 0.05) * 10)
      let moving = false

      const approach = (current: number, goal: number) => {
        const delta = goal - current
        if (Math.abs(delta) < 0.0004) return goal
        moving = true
        return current + delta * k
      }

      cam.az = approach(cam.az, cam.azGoal)
      cam.zoom = approach(cam.zoom, cam.zoomGoal)
      cam.center.x = approach(cam.center.x, cam.centerGoal.x)
      cam.center.y = approach(cam.center.y, cam.centerGoal.y)
      cam.center.z = approach(cam.center.z, cam.centerGoal.z)

      trace = approach(trace, traceGoal)
      uniforms.uTrace.value = trace

      render()
      return moving
    }

    /* ---- the loop ------------------------------------------------------- */

    let running = false
    let onScreen = false
    /** The context is gone: nothing may reach the renderer again. */
    let lost = false

    const stop = () => {
      if (!running) return
      running = false
      gsap.ticker.remove(tick)
    }

    const tick = (_time: number, deltaMs: number) => {
      if (!step(Math.min(deltaMs / 1000, 0.05))) stop()
    }

    const wake = () => {
      if (reduced) {
        if (onScreen) render()
        return
      }
      if (!onScreen || document.visibilityState !== 'visible') return
      if (running) return
      running = true
      gsap.ticker.add(tick)
    }

    /* ---- viewport ------------------------------------------------------- */

    const resize = () => {
      if (lost) return
      const w = host.clientWidth || 1
      const h = host.clientHeight || 1
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap)

      renderer.setPixelRatio(dpr)
      renderer.setSize(w, h, false)
      uniforms.uDpr.value = dpr

      view.w = w
      view.h = h
      view.aspect = w / h

      camera.left = -view.aspect
      camera.right = view.aspect
      camera.top = 1
      camera.bottom = -1
      camera.updateProjectionMatrix()

      solve()

      const framed = cam.tier ? tierFits.get(cam.tier) : null
      const goal = framed ?? overviewFit
      cam.centerGoal.copy(goal.center)
      cam.zoomGoal = goal.zoom
      cam.center.copy(goal.center)
      cam.zoom = goal.zoom

      render()
    }

    /* ---- input ---------------------------------------------------------- */

    let drag: { id: number; x: number; y: number; moved: number } | null = null

    const localPoint = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect()
      return { x: event.clientX - rect.left, y: event.clientY - rect.top }
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: 0 }
      try {
        canvas.setPointerCapture(event.pointerId)
      } catch {
        /* capture is an optimisation; the gesture works without it */
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!drag || drag.id !== event.pointerId) return
      const dx = event.clientX - drag.x
      drag.moved += Math.abs(dx)
      drag.x = event.clientX
      drag.y = event.clientY

      // Under reduced motion the plate does not turn: the tap still reads.
      if (reduced || drag.moved < 6) return

      cam.azGoal = Math.min(BASE_AZ + ORBIT, Math.max(BASE_AZ - ORBIT, cam.azGoal - dx * 0.0035))
      wake()
    }

    const endDrag = (event: PointerEvent) => {
      if (!drag) return
      const wasTap = drag.moved < 10
      drag = null
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
      if (!wasTap) return

      const point = localPoint(event)
      const hit = hitTest(point.x, point.y)
      select(hit)
    }

    const onPointerCancel = (event: PointerEvent) => {
      drag = null
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)
    }

    const onContextLost = (event: Event) => {
      event.preventDefault()
      lost = true
      stop()
      live.current.onUnavailable()
    }

    /* ---- lifecycle ------------------------------------------------------ */

    const observer = new IntersectionObserver(
      (entries) => {
        onScreen = entries[0]?.isIntersecting ?? false
        if (onScreen) wake()
        else stop()
      },
      { rootMargin: '80px' },
    )

    const resizeObserver = new ResizeObserver(() => resize())

    const onVisibility = () => {
      if (document.visibilityState === 'visible') wake()
      else stop()
    }

    const frame = (next: TierId | null) => {
      cam.tier = next
      uniforms.uTierFocus.value = next ? TIER_INDEX[next] : -1
      const goal = next ? tierFits.get(next) : overviewFit
      if (goal) {
        cam.centerGoal.copy(goal.center)
        cam.zoomGoal = goal.zoom
      }
      wake()
    }

    handleRef.current = { frame, trace: setTrace }

    // The first frame exists before the canvas is faded in, so the plate is
    // never an empty rectangle under the readout.
    resize()
    applyFocus(focusId)
    live.current.onReady()

    observer.observe(host)
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove, { passive: true })
    canvas.addEventListener('pointerup', endDrag)
    canvas.addEventListener('pointercancel', onPointerCancel)
    canvas.addEventListener('webglcontextlost', onContextLost)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('resize', resize)
    resizeObserver.observe(host)

    return () => {
      stop()
      observer.disconnect()
      resizeObserver.disconnect()
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', endDrag)
      canvas.removeEventListener('pointercancel', onPointerCancel)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', resize)

      if (handleRef.current) handleRef.current = null

      scene.clear()
      planeGeometry.dispose()
      linkGeometry.dispose()
      nodeGeometry.dispose()
      planeMaterial.dispose()
      linkMaterial.dispose()
      nodeMaterial.dispose()
      renderer.dispose()

      if (canvas.parentNode === host) host.removeChild(canvas)
    }
    // Built once: the tier and the focused mark travel through the handle and
    // through `trace` below, so a tap never re-creates a renderer.
  }, [handleRef])

  /* ---- what the section asks for, after mount --------------------------- */

  useEffect(() => {
    handleRef.current?.frame(tier)
  }, [tier, handleRef])

  useEffect(() => {
    handleRef.current?.trace(focus)
  }, [focus, handleRef])

  return (
    <div className="tty-mini__scene">
      <div className="tty-mini__canvas-host" ref={hostRef} aria-hidden="true" />
      <CompactPlate />
    </div>
  )
}

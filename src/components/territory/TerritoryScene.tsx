import { useEffect, useRef } from 'react'
import {
  BufferAttribute,
  BufferGeometry,
  DynamicDrawUsage,
  Float32BufferAttribute,
  Group,
  LineSegments,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector3,
  WebGLRenderer,
} from 'three'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  ENTRY_ID,
  EXIT_ID,
  territoryStations,
  territoryTrunkLinks,
  type TierId,
} from '../../content/territory'

gsap.registerPlugin(ScrollTrigger)

/* ============================================================================
   The schema: three plans, one path
   ----------------------------------------------------------------------------
   What the drawing has to make legible in one look is not the hardware — it is
   the order a request goes through it, and the fact that every service is a
   guest of one of two machines. So the plate is a section, not a floor plan:

   - three hairline plans, stacked. EDGE on top, FABRIC in the middle, SERVICES
     at the bottom. Same footprint: one site, three levels.
   - traffic enters from above the edge plane, is forwarded across it, crosses
     the fabric and lands on the service that answers.
   - pointing at a mark lights only that mark's chain and drops everything else
     to a ruling. At rest, the drawing is still.

   Engineering discipline is the hero's, deliberately: one renderer, one ticker
   (gsap's — never a second rAF), three draw calls, no allocation in the frame
   loop, DPR capped at 2, every listener and GPU object released on unmount, and
   any failure lands on the SVG plate rather than an empty rectangle.
   ========================================================================== */

const TIERS: TierId[] = ['edge', 'fabric', 'services']
const TIER_INDEX: Record<TierId, number> = { edge: 0, fabric: 1, services: 2 }

/** Vertical position of each plan, in drawing units. The group is scaled on Y. */
const TIER_Y: Record<TierId, number> = { edge: 1.28, fabric: 0, services: -1.28 }

/** The plan's footprint. All three share it. */
const PLANE_X = 4.5
const PLANE_Z = 1.32

/** Base camera. Orbit is clamped around these, never free. */
const BASE_AZ = 0.28
const BASE_EL = 0.38
/** The stack is not symmetric: the entry sits above the top plane. The overview
    looks slightly high so the drawing is centred in its box, not the box's middle. */
const OVERVIEW_LOOK = 0.34
const AZ_LIMIT = 0.384 /* ±22° */
const EL_LIMIT = 0.244 /* ±14° */
const TIER_EL = 0.7

/* Raw sRGB, matching --ink, --contour and --mark. Every material is a custom
   ShaderMaterial writing straight to the framebuffer, so three's colour
   management never enters the path and the WebGL ink matches the CSS ink. */
const INK: [number, number, number] = [0x13 / 255, 0x1c / 255, 0x19 / 255]
const CONTOUR: [number, number, number] = [0xb2 / 255, 0xbc / 255, 0xb1 / 255]
const MARK: [number, number, number] = [0xbf / 255, 0x1f / 255, 0x34 / 255]

/* --------------------------------------------------------------------------
   Shaders
   ------------------------------------------------------------------------ */

const PLANE_VERT = /* glsl */ `
  attribute float aTier;
  attribute float aRule;

  varying float vTier;
  varying float vRule;

  void main() {
    vTier = aTier;
    vRule = aRule;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const PLANE_FRAG = /* glsl */ `
  uniform vec3 uContour;
  uniform float uReveal;
  uniform float uTierFocus;
  uniform float uFocus;

  varying float vTier;
  varying float vRule;

  void main() {
    // Framing one stratum drops the others to a ruling instead of hiding them:
    // the reader keeps the context of what is above and below.
    float tier = (uTierFocus < -0.5 || abs(vTier - uTierFocus) < 0.5) ? 1.0 : 0.42;
    float appear = smoothstep(0.0, 0.14, uReveal);
    float a = 0.5 * vRule * tier * appear * (1.0 - 0.35 * uFocus);

    gl_FragColor = vec4(uContour, a);
  }
`

const EDGE_VERT = /* glsl */ `
  attribute vec3 aTo;
  attribute float aOrder;
  attribute float aDash;
  attribute float aDist;
  attribute float aFocus;

  uniform float uReveal;
  uniform float uFocus;

  varying float vAlpha;
  varying float vDash;
  varying float vDist;

  void main() {
    // Both vertices of a link start at its source; the head walks towards the
    // target as the survey is inked. That is the pen drawing the edge.
    float t = clamp((uReveal - aOrder) / 0.26, 0.0, 1.0);
    vec3 p = mix(position, aTo, t);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);

    vAlpha = smoothstep(0.0, 0.02, t) * mix(1.0, aFocus, uFocus);
    vDash = aDash;
    vDist = aDist * t;
  }
`

const EDGE_FRAG = /* glsl */ `
  uniform vec3 uInk;
  uniform float uOpacity;

  varying float vAlpha;
  varying float vDash;
  varying float vDist;

  void main() {
    // The backup branch is the only dashed line on the sheet, and the only place
    // a pattern is allowed to carry meaning.
    if (vDash > 0.5) {
      float phase = fract(vDist / 0.17);
      if (phase > 0.56) discard;
    }

    gl_FragColor = vec4(uInk, vAlpha * uOpacity);
  }
`

const NODE_VERT = /* glsl */ `
  attribute float aOrder;
  attribute float aSize;
  attribute float aKind;
  attribute float aFocus;

  uniform float uReveal;
  uniform float uDpr;
  uniform float uFocus;

  varying float vKind;
  varying float vAlpha;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    float appear = smoothstep(aOrder - 0.06, aOrder + 0.14, uReveal);
    gl_PointSize = aSize * uDpr * (0.55 + 0.45 * appear);

    vAlpha = appear * mix(1.0, aFocus, uFocus);
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
      // Station: a survey cross. A place, not a thing served.
      float h = (1.0 - smoothstep(0.09, 0.16, ay)) * (1.0 - step(0.86, ax));
      float v = (1.0 - smoothstep(0.09, 0.16, ax)) * (1.0 - step(0.86, ay));
      shape = max(h, v);
    } else if (vKind < 1.5) {
      // Service: a filled square.
      shape = 1.0 - smoothstep(0.42, 0.5, max(ax, ay));
    } else {
      // Control point: one ring, hairline, with a crosshair inside. The ring is
      // the only crimson on the drawing.
      float d = length(q);
      ring = 1.0 - smoothstep(0.016, 0.05, abs(d - 0.37));
      float h = (1.0 - smoothstep(0.016, 0.05, ay)) * (1.0 - step(0.15, ax));
      float v = (1.0 - smoothstep(0.016, 0.05, ax)) * (1.0 - step(0.15, ay));
      shape = max(ring, max(h, v));
    }

    if (shape < 0.004) discard;

    vec3 c = vKind > 1.5 ? mix(uInk, uMark, ring) : uInk;
    gl_FragColor = vec4(c, vAlpha * shape);
  }
`

/* --------------------------------------------------------------------------
   Shapes of the data
   ------------------------------------------------------------------------ */

type Vec = { x: number; y: number; z: number }

type Edge = { a: string; b: string; dash: boolean; order: number; dist: number }

type LabelSpec = {
  /** Station id, token id, or `tier:<id>` for a plan caption. */
  id: string
  kind: 'station' | 'token' | 'tier'
  x: number
  y: number
  z: number
  /** Which side of the anchor the text sits on. `left` puts the leader on its right. */
  side: 'right' | 'left'
  /** Distance from the anchor to the text, wide enough to clear the mark. */
  offset: number
  dy: number
}

type LabelBox = {
  el: HTMLElement
  text: string
  w: number
  h: number
  sx: number
  sy: number
  /** How far the text had to move from its mark; the leader grows to reach back. */
  lead: number
  visible: boolean
  painted: boolean
}

function edgeKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

export type TerritorySceneHandle = {
  /** Ease to a framing of one stratum, or back to the whole stack. */
  frame: (tier: TierId | null) => void
}

type Props = {
  /** Localised captions for the two marks that are not station names. */
  entryLabel: string
  exitLabel: string
  /** Localised names of the three strata, printed on their own plan. */
  tierLabels: Record<TierId, string>
  /** The mark whose chain is lit, owned by the section so the register can echo it. */
  focus: string | null
  handleRef: { current: TerritorySceneHandle | null }
  onFocus: (id: string | null) => void
  onReady: () => void
  onUnavailable: () => void
}

export default function TerritoryScene({
  entryLabel,
  exitLabel,
  tierLabels,
  focus,
  handleRef,
  onFocus,
  onReady,
  onUnavailable,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const labelHostRef = useRef<HTMLDivElement | null>(null)

  // The labels follow the same chain the drawing lights: the mark that was
  // pointed at is ink, everything it passes through is secondary ink, and the
  // rest of the sheet drops to a ruling.
  const chain = focus ? (territoryStations.find((station) => station.id === focus)?.chain ?? null) : null

  // Callbacks are read through a ref so a parent render never rebuilds the
  // scene: a hover must not dispose a renderer, and a language switch must not
  // either.
  const latest = useRef({ onFocus, onReady, onUnavailable })
  useEffect(() => {
    latest.current = { onFocus, onReady, onUnavailable }
  })

  useEffect(() => {
    const host = hostRef.current
    const labelHost = labelHostRef.current
    if (!host || !labelHost) return

    // A phone gets the register, not a 3D scene squeezed into 390px.
    if (!window.matchMedia('(min-width: 900px)').matches) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true })
    } catch {
      latest.current.onUnavailable()
      return
    }

    if (!renderer.getContext()) {
      renderer.dispose()
      latest.current.onUnavailable()
      return
    }

    renderer.setClearAlpha(0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

    const canvas = renderer.domElement
    canvas.className = 'tty-scene__canvas'
    host.appendChild(canvas)

    const scene = new Scene()
    const stack = new Group()
    scene.add(stack)

    const camera = new PerspectiveCamera(26, 1, 0.5, 140)

    /* ---- points --------------------------------------------------------- */

    const points = new Map<string, Vec>()
    for (const station of territoryStations) {
      points.set(station.id, { x: station.x, y: TIER_Y[station.tier], z: station.z })
    }

    const opnsense = points.get('opnsense')
    const pbs = points.get('pbs')
    if (!opnsense || !pbs) return

    points.set(ENTRY_ID, { x: opnsense.x, y: TIER_Y.edge + 0.72, z: opnsense.z })
    points.set(EXIT_ID, { x: pbs.x + 1.45, y: TIER_Y.fabric, z: pbs.z })

    /* ---- links ---------------------------------------------------------- */

    const edges: Edge[] = []
    const seen = new Set<string>()

    for (const station of territoryStations) {
      for (let i = 0; i < station.chain.length - 1; i++) {
        const a = station.chain[i]
        const b = station.chain[i + 1]
        const key = edgeKey(a, b)
        if (seen.has(key)) continue
        seen.add(key)
        edges.push({ a, b, dash: a === 'pbs' || b === 'pbs', order: 0, dist: 0 })
      }
    }

    for (const link of territoryTrunkLinks) {
      const key = edgeKey(link.a, link.b)
      if (seen.has(key)) continue
      seen.add(key)
      edges.push({ a: link.a, b: link.b, dash: false, order: 0, dist: 0 })
    }

    // Inked from the top of the sheet down. Deterministic, so the drawing always
    // arrives in the same order.
    edges.sort((p, q) => (points.get(q.a)?.y ?? 0) - (points.get(p.a)?.y ?? 0))
    edges.forEach((edge, index) => {
      const a = points.get(edge.a)
      const b = points.get(edge.b)
      edge.order = 0.04 + index * 0.028
      edge.dist = a && b ? Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z) : 1
    })

    /* ---- geometry: the three plans -------------------------------------- */

    const planePos: number[] = []
    const planeTier: number[] = []
    const planeRule: number[] = []

    const pushPlane = (
      ax: number,
      az: number,
      bx: number,
      bz: number,
      y: number,
      tier: number,
      rule: number,
    ) => {
      planePos.push(ax, y, az, bx, y, bz)
      planeTier.push(tier, tier)
      planeRule.push(rule, rule)
    }

    TIERS.forEach((tier, index) => {
      const y = TIER_Y[tier]
      // Neatline: the plan's edge, the strongest line of the three.
      pushPlane(-PLANE_X, -PLANE_Z, PLANE_X, -PLANE_Z, y, index, 1)
      pushPlane(PLANE_X, -PLANE_Z, PLANE_X, PLANE_Z, y, index, 1)
      pushPlane(PLANE_X, PLANE_Z, -PLANE_X, PLANE_Z, y, index, 1)
      pushPlane(-PLANE_X, PLANE_Z, -PLANE_X, -PLANE_Z, y, index, 1)

      // Graticule: three in one direction, two in the other. Enough to read as a
      // plan, not enough to read as graph paper.
      for (const gx of [-2.3, 0, 2.3]) pushPlane(gx, -PLANE_Z, gx, PLANE_Z, y, index, 0.42)
      for (const gz of [-0.66, 0.66]) pushPlane(-PLANE_X, gz, PLANE_X, gz, y, index, 0.42)
    })

    const planeGeometry = new BufferGeometry()
    planeGeometry.setAttribute('position', new Float32BufferAttribute(planePos, 3))
    planeGeometry.setAttribute('aTier', new Float32BufferAttribute(planeTier, 1))
    planeGeometry.setAttribute('aRule', new Float32BufferAttribute(planeRule, 1))

    /* ---- geometry: the links -------------------------------------------- */

    const linkPos: number[] = []
    const linkTo: number[] = []
    const linkOrder: number[] = []
    const linkDash: number[] = []
    const linkDist: number[] = []
    const linkFocus: number[] = []

    for (const edge of edges) {
      const a = points.get(edge.a)
      const b = points.get(edge.b)
      if (!a || !b) continue
      linkPos.push(a.x, a.y, a.z, a.x, a.y, a.z)
      linkTo.push(a.x, a.y, a.z, b.x, b.y, b.z)
      linkOrder.push(edge.order, edge.order)
      linkDash.push(edge.dash ? 1 : 0, edge.dash ? 1 : 0)
      linkDist.push(0, edge.dist)
      linkFocus.push(1, 1)
    }

    const linkGeometry = new BufferGeometry()
    linkGeometry.setAttribute('position', new Float32BufferAttribute(linkPos, 3))
    linkGeometry.setAttribute('aTo', new Float32BufferAttribute(linkTo, 3))
    linkGeometry.setAttribute('aOrder', new Float32BufferAttribute(linkOrder, 1))
    linkGeometry.setAttribute('aDash', new Float32BufferAttribute(linkDash, 1))
    linkGeometry.setAttribute('aDist', new Float32BufferAttribute(linkDist, 1))
    linkGeometry.setAttribute(
      'aFocus',
      new Float32BufferAttribute(linkFocus, 1).setUsage(DynamicDrawUsage),
    )

    /* ---- geometry: the marks -------------------------------------------- */

    const nodePos: number[] = []
    const nodeOrder: number[] = []
    const nodeSize: number[] = []
    const nodeKind: number[] = []
    const nodeFocus: number[] = []

    const NODE_SIZE = { station: 14, service: 10, control: 38 }
    const TIER_ORDER = { edge: 0.3, fabric: 0.52, services: 0.7 }

    for (const station of territoryStations) {
      const p = points.get(station.id)
      if (!p) continue
      nodePos.push(p.x, p.y, p.z)
      nodeOrder.push(TIER_ORDER[station.tier] + (station.x + 4.5) * 0.01)
      nodeSize.push(NODE_SIZE[station.kind])
      nodeKind.push(station.kind === 'control' ? 2 : station.kind === 'service' ? 1 : 0)
      nodeFocus.push(1)
    }

    const nodeGeometry = new BufferGeometry()
    nodeGeometry.setAttribute('position', new Float32BufferAttribute(nodePos, 3))
    nodeGeometry.setAttribute('aOrder', new Float32BufferAttribute(nodeOrder, 1))
    nodeGeometry.setAttribute('aSize', new Float32BufferAttribute(nodeSize, 1))
    nodeGeometry.setAttribute('aKind', new Float32BufferAttribute(nodeKind, 1))
    nodeGeometry.setAttribute(
      'aFocus',
      new Float32BufferAttribute(nodeFocus, 1).setUsage(DynamicDrawUsage),
    )

    /* ---- materials ------------------------------------------------------- */

    const uniforms = {
      uReveal: { value: reduced ? 1 : 0 },
      uFocus: { value: 0 },
      uTierFocus: { value: -1 },
      uDpr: { value: renderer.getPixelRatio() },
      uInk: { value: new Vector3(INK[0], INK[1], INK[2]) },
      uMark: { value: new Vector3(MARK[0], MARK[1], MARK[2]) },
      uContour: { value: new Vector3(CONTOUR[0], CONTOUR[1], CONTOUR[2]) },
      uOpacity: { value: 0.44 },
    }

    const shared = { uniforms, transparent: true, depthTest: false, depthWrite: false }

    const planeMaterial = new ShaderMaterial({
      ...shared,
      vertexShader: PLANE_VERT,
      fragmentShader: PLANE_FRAG,
    })
    const linkMaterial = new ShaderMaterial({
      ...shared,
      vertexShader: EDGE_VERT,
      fragmentShader: EDGE_FRAG,
    })
    const nodeMaterial = new ShaderMaterial({
      ...shared,
      vertexShader: NODE_VERT,
      fragmentShader: NODE_FRAG,
    })

    const planes = new LineSegments(planeGeometry, planeMaterial)
    planes.renderOrder = 0
    const links = new LineSegments(linkGeometry, linkMaterial)
    links.renderOrder = 1
    const marks = new Points(nodeGeometry, nodeMaterial)
    marks.renderOrder = 2
    stack.add(planes, links, marks)

    /* ---- labels ---------------------------------------------------------- */

    const specs: LabelSpec[] = []

    for (const station of territoryStations) {
      const p = points.get(station.id)
      if (!p) continue
      specs.push({
        id: station.id,
        kind: 'station',
        x: p.x,
        y: p.y,
        z: p.z,
        side: 'right',
        offset: station.kind === 'control' ? 22 : 13,
        dy: 0,
      })
    }

    specs.push({
      id: ENTRY_ID,
      kind: 'token',
      x: opnsense.x,
      y: TIER_Y.edge + 0.72,
      z: opnsense.z,
      side: 'right',
      offset: 12,
      dy: -14,
    })
    specs.push({
      id: EXIT_ID,
      kind: 'token',
      x: pbs.x + 1.45,
      y: TIER_Y.fabric,
      z: pbs.z,
      side: 'left',
      offset: 12,
      dy: 0,
    })

    for (const tier of TIERS) {
      // The caption is placed on the plane's leftmost projected corner each
      // frame, so its leader always ends on the drawing and never in the air.
      specs.push({
        id: `tier:${tier}`,
        kind: 'tier',
        x: -PLANE_X,
        y: TIER_Y[tier],
        z: 0,
        side: 'left',
        offset: 14,
        dy: 0,
      })
    }

    const boxes: LabelBox[] = []
    const kept: LabelSpec[] = []

    for (const spec of specs) {
      const el = labelHost.querySelector<HTMLElement>(`[data-label-id="${spec.id}"]`)
      if (!el) continue
      kept.push(spec)
      boxes.push({ el, text: '', w: 0, h: 14, sx: 0, sy: 0, lead: 12, visible: false, painted: false })
    }

    const measure = () => {
      for (const box of boxes) {
        box.text = box.el.textContent ?? ''
        box.w = box.el.offsetWidth
        box.h = box.el.offsetHeight
      }
    }

    const stationAt = new Map<string, number>()
    kept.forEach((spec, index) => {
      if (spec.kind === 'station') stationAt.set(spec.id, index)
    })

    const scratch = new Vector3()
    const view = { w: 1, h: 1 }

    /* ---- camera ---------------------------------------------------------- */

    const cam = { az: BASE_AZ, el: BASE_EL, dist: 22, lookY: OVERVIEW_LOOK }
    const goal = { az: BASE_AZ, el: BASE_EL, dist: 22, lookY: OVERVIEW_LOOK }
    const lookTarget = new Vector3()
    let elBase = BASE_EL
    let framed: TierId | null = null
    let homeDist = 22
    const tierDist: Record<TierId, number> = { edge: 22, fabric: 22, services: 22 }

    const placeCamera = (dist: number, az: number, el: number, lookY: number) => {
      const cos = Math.cos(el)
      camera.position.set(
        dist * cos * Math.sin(az),
        lookY + dist * Math.sin(el),
        dist * cos * Math.cos(az),
      )
      lookTarget.set(0, lookY, 0)
      camera.lookAt(lookTarget)
      camera.updateMatrixWorld()
    }

    const fitPoints = new Float32Array(30)
    const corner = (i: number, x: number, y: number, z: number) => {
      fitPoints[i * 3] = x
      fitPoints[i * 3 + 1] = y
      fitPoints[i * 3 + 2] = z
    }

    /**
     * Fit a set of points to the frame by projecting them, five passes. A
     * bounding sphere would be simpler and wrong: the stack is nine units wide
     * and four deep, and a sphere around it pushes the drawing into a third of
     * the canvas. Five passes because the projection is not linear in distance.
     */
    const fit = (count: number, az: number, el: number, lookY: number, fillX: number, fillY: number) => {
      let dist = cam.dist
      for (let pass = 0; pass < 5; pass++) {
        placeCamera(dist, az, el, lookY)
        let mx = 0
        let my = 0
        for (let i = 0; i < count; i++) {
          scratch.set(fitPoints[i * 3], fitPoints[i * 3 + 1], fitPoints[i * 3 + 2]).project(camera)
          const ax = Math.abs(scratch.x)
          const ay = Math.abs(scratch.y)
          if (ax > mx) mx = ax
          if (ay > my) my = ay
        }
        dist *= Math.max(mx / fillX, my / fillY, 0.25)
      }
      return dist
    }

    /* ---- state ----------------------------------------------------------- */

    const state = {
      reveal: reduced ? 1 : 0,
      elapsed: 0,
      sep: 1,
      scroll: 1,
      first: true,
      focus: null as string | null,
      ink: -1,
      clientX: 0,
      clientY: 0,
      /** Pointer position inside the canvas, straight from the event. */
      px: 0,
      py: 0,
      dragX: 0,
      dragY: 0,
      inside: false,
      dragging: false,
      moved: 0,
      pointerType: 'mouse',
      onScreen: false,
    }

    let tickerOn = false

    /* ---- focus ----------------------------------------------------------- */

    const nodeIndex = new Map<string, number>()
    territoryStations.forEach((station, index) => nodeIndex.set(station.id, index))

    const linkIndex = new Map<string, number>()
    edges.forEach((edge, index) => linkIndex.set(edgeKey(edge.a, edge.b), index))

    const focusAttr = linkGeometry.getAttribute('aFocus') as BufferAttribute
    const nodeFocusAttr = nodeGeometry.getAttribute('aFocus') as BufferAttribute
    const focusArray = focusAttr.array as Float32Array
    const nodeFocusArray = nodeFocusAttr.array as Float32Array

    const applyFocus = (id: string | null) => {
      const own = id ? nodeIndex.get(id) : undefined
      const chain = own === undefined ? undefined : territoryStations[own].chain

      focusArray.fill(id ? 0.1 : 1)
      nodeFocusArray.fill(id ? 0.1 : 1)
      uniforms.uFocus.value = id ? 1 : 0

      if (chain) {
        for (const step of chain) {
          const index = nodeIndex.get(step)
          if (index !== undefined) nodeFocusArray[index] = 1
        }
        for (let i = 0; i < chain.length - 1; i++) {
          const index = linkIndex.get(edgeKey(chain[i], chain[i + 1]))
          if (index === undefined) continue
          focusArray[index * 2] = 1
          focusArray[index * 2 + 1] = 1
        }
      }

      focusAttr.needsUpdate = true
      nodeFocusAttr.needsUpdate = true
    }

    /* ---- projection + labels --------------------------------------------- */

    const place = new Int32Array(boxes.length)
    const placeX = new Float32Array(boxes.length)
    const placeY = new Float32Array(boxes.length)
    const stationMarks = new Float32Array(boxes.length * 2)
    let stationMarkCount = 0

    const PLANE_CORNERS = new Float32Array([-PLANE_X, -PLANE_Z, PLANE_X, -PLANE_Z, PLANE_X, PLANE_Z, -PLANE_X, PLANE_Z])
    const tierAnchor = new Float32Array(3)

    const leftmostCorner = (tier: TierId) => {
      let bestX = Infinity
      tierAnchor[0] = 0
      tierAnchor[1] = 0
      for (let i = 0; i < 8; i += 2) {
        scratch.set(PLANE_CORNERS[i], TIER_Y[tier] * state.sep, PLANE_CORNERS[i + 1]).project(camera)
        const sx = (scratch.x * 0.5 + 0.5) * view.w
        if (sx < bestX) {
          bestX = sx
          tierAnchor[0] = sx
          tierAnchor[1] = (-scratch.y * 0.5 + 0.5) * view.h
          tierAnchor[2] = scratch.z
        }
      }
    }

    const project = () => {
      for (let i = 0; i < kept.length; i++) {
        const spec = kept[i]
        const box = boxes[i]
        if (spec.kind === 'tier') {
          leftmostCorner(spec.id.slice(5) as TierId)
          box.sx = tierAnchor[0]
          box.sy = tierAnchor[1]
          box.visible = tierAnchor[2] > -1 && tierAnchor[2] < 1
          continue
        }
        scratch.set(spec.x, spec.y * state.sep, spec.z).project(camera)
        box.sx = (scratch.x * 0.5 + 0.5) * view.w
        box.sy = (-scratch.y * 0.5 + 0.5) * view.h
        box.visible = scratch.z > -1 && scratch.z < 1
      }

      // Marks are obstacles for the text: a label never sits on another mark.
      stationMarkCount = 0
      for (let i = 0; i < kept.length; i++) {
        if (kept[i].kind !== 'station') continue
        const box = boxes[i]
        if (!box.visible) continue
        stationMarks[stationMarkCount * 2] = box.sx
        stationMarks[stationMarkCount * 2 + 1] = box.sy
        stationMarkCount++
      }
    }

    const hideLabel = (box: LabelBox) => {
      if (!box.painted) return
      box.el.style.visibility = 'hidden'
      box.painted = false
    }

    const drawLabels = () => {
      let count = 0

      for (let i = 0; i < kept.length; i++) {
        const box = boxes[i]
        const spec = kept[i]

        if (box.visible && box.text !== (box.el.textContent ?? '')) measure()

        if (!box.visible || box.w === 0) {
          hideLabel(box)
          continue
        }

        let side = spec.side
        if (side === 'right' && box.sx + spec.offset + box.w > view.w - 6) side = 'left'

        const left = side === 'right' ? box.sx + spec.offset : box.sx - spec.offset - box.w
        const top = box.sy + spec.dy - box.h / 2

        if (left < -box.w || left > view.w || top + box.h < 0 || top > view.h) {
          hideLabel(box)
          continue
        }

        place[count] = i
        placeX[count] = left
        placeY[count] = top
        count++
      }

      // Sort by column, then push down anything that would sit on a neighbour.
      // Text is never stacked: the leader gives way, the label stays where it is.
      for (let i = 1; i < count; i++) {
        const index = place[i]
        const x = placeX[i]
        const y = placeY[i]
        let j = i - 1
        while (j >= 0 && placeY[j] > y) {
          placeY[j + 1] = placeY[j]
          placeX[j + 1] = placeX[j]
          place[j + 1] = place[j]
          j--
        }
        placeY[j + 1] = y
        placeX[j + 1] = x
        place[j + 1] = index
      }

      for (let i = 0; i < count; i++) {
        const box = boxes[place[i]]
        let left = placeX[i]
        let top = placeY[i]

        for (let pass = 0; pass < 4; pass++) {
          let moved = false
          for (let j = 0; j < i; j++) {
            const other = boxes[place[j]]
            if (
              left < placeX[j] + other.w + 6 &&
              left + box.w + 6 > placeX[j] &&
              top < placeY[j] + other.h + 2 &&
              top + box.h + 2 > placeY[j]
            ) {
              top = placeY[j] + other.h + 2
              moved = true
            }
          }
          for (let m = 0; m < stationMarkCount; m++) {
            const mx = stationMarks[m * 2]
            const my = stationMarks[m * 2 + 1]
            if (mx > left - 5 && mx < left + box.w + 5 && my > top - 4 && my < top + box.h + 4) {
              top = my + 9
              moved = true
            }
          }
          if (!moved) break
        }

        if (top + box.h > view.h || top < 0) {
          hideLabel(box)
          placeY[i] = top
          continue
        }

        placeY[i] = top

        const shift = Math.abs(top - (box.sy + kept[place[i]].dy - box.h / 2))
        const lead = Math.round((kept[place[i]].offset + Math.min(26, shift)) * 2) / 2
        if (lead !== box.lead) {
          box.lead = lead
          box.el.style.setProperty('--lead', `${lead}px`)
        }

        box.el.style.transform = `translate3d(${Math.round(left * 2) / 2}px, ${Math.round(top * 2) / 2}px, 0)`
        box.el.dataset.side = left + box.w / 2 < box.sx ? 'left' : 'right'
        if (!box.painted) {
          box.el.style.visibility = 'visible'
          box.painted = true
        }
      }
    }

    /* ---- hit test -------------------------------------------------------- */

    const hitTest = () => {
      const px = state.px
      const py = state.py
      const radius = state.pointerType === 'touch' ? 26 : 18
      let best: string | null = null
      let bestDist = radius * radius

      for (const station of territoryStations) {
        const index = stationAt.get(station.id)
        if (index === undefined) continue
        const box = boxes[index]
        if (!box.visible) continue
        const dx = box.sx - px
        const dy = box.sy - py
        const d = dx * dx + dy * dy
        if (d < bestDist) {
          bestDist = d
          best = station.id
        }
      }

      return best
    }

    /* ---- draw ------------------------------------------------------------ */

    const draw = (dt: number) => {
      const k = reduced ? 1 : 1 - Math.exp(-dt * 7)

      if (state.dragging) {
        const dx = state.clientX - state.dragX
        const dy = state.clientY - state.dragY
        state.dragX = state.clientX
        state.dragY = state.clientY
        state.moved += Math.abs(dx) + Math.abs(dy)

        goal.az = Math.min(BASE_AZ + AZ_LIMIT, Math.max(BASE_AZ - AZ_LIMIT, goal.az - dx * 0.0012))
        if (state.pointerType !== 'touch') {
          goal.el = Math.min(elBase + EL_LIMIT, Math.max(elBase - EL_LIMIT, goal.el + dy * 0.0011))
        }
      }

      const targetSep = reduced ? 1 : 0.6 + 0.4 * state.scroll
      state.sep = state.first
        ? targetSep
        : state.sep + (targetSep - state.sep) * (reduced ? 1 : Math.min(1, dt * 4))
      state.first = false
      stack.scale.y = state.sep

      if (!reduced) {
        state.elapsed += dt
        state.reveal = Math.min(1, Math.max(0, (state.elapsed - 0.1) / 1.35))
      }
      uniforms.uReveal.value = state.reveal

      cam.az += (goal.az - cam.az) * k
      cam.el += (goal.el - cam.el) * k
      cam.dist += (goal.dist - cam.dist) * k
      cam.lookY += (goal.lookY - cam.lookY) * k

      const drift = reduced ? 0 : Math.sin(state.elapsed * 0.16) * 0.012
      const lift = reduced ? 0 : (state.scroll - 1) * 0.09
      placeCamera(cam.dist, cam.az + drift, Math.max(0.06, cam.el + lift), cam.lookY)

      project()

      let hovered: string | null = null
      if (state.inside && !state.dragging) hovered = hitTest()
      if (hovered !== state.focus) {
        state.focus = hovered
        applyFocus(hovered)
        latest.current.onFocus(hovered)
      }

      // The names arrive with the ink, not before it: a label on a mark that
      // has not been drawn yet reads as a wireframe with floating text.
      const raw = reduced ? 1 : Math.min(1, Math.max(0, (state.reveal - 0.5) / 0.28))
      const ink = Math.round(raw * 40) / 40
      if (ink !== state.ink) {
        state.ink = ink
        labelHost.style.opacity = ink.toFixed(3)
      }

      drawLabels()
      renderer.render(scene, camera)
    }

    const drawOnce = () => {
      state.first = true
      draw(0)
    }

    /* ---- viewport -------------------------------------------------------- */

    const resize = () => {
      const w = host.clientWidth || 1
      const h = host.clientHeight || 1
      const dpr = Math.min(window.devicePixelRatio || 1, 2)

      renderer.setPixelRatio(dpr)
      renderer.setSize(w, h, false)
      uniforms.uDpr.value = dpr

      camera.aspect = w / h
      camera.updateProjectionMatrix()

      view.w = w
      view.h = h

      let i = 0
      for (const y of [-TIER_Y.edge, TIER_Y.edge]) {
        for (const x of [-PLANE_X, PLANE_X]) {
          for (const z of [-PLANE_Z, PLANE_Z]) corner(i++, x, y, z)
        }
      }
      // The two annotations live outside the planes and must stay on the sheet.
      corner(i++, opnsense.x, TIER_Y.edge + 0.72, opnsense.z)
      corner(i++, pbs.x + 1.45, TIER_Y.fabric, pbs.z)
      homeDist = fit(i, BASE_AZ, BASE_EL, OVERVIEW_LOOK, 0.86, 0.84)

      for (const tier of TIERS) {
        let c = 0
        for (const x of [-PLANE_X, PLANE_X]) {
          for (const z of [-PLANE_Z, PLANE_Z]) corner(c++, x, TIER_Y[tier], z)
        }
        tierDist[tier] = fit(4, BASE_AZ, TIER_EL, TIER_Y[tier], 0.9, 0.6)
      }

      goal.dist = framed ? tierDist[framed] : homeDist
      if (framed) goal.lookY = TIER_Y[framed] * state.sep

      if (state.first) {
        cam.dist = goal.dist
        cam.lookY = goal.lookY
      }

      measure()
      if (reduced) drawOnce()
    }

    /* ---- api ------------------------------------------------------------- */

    const frame = (tier: TierId | null) => {
      framed = tier
      uniforms.uTierFocus.value = tier ? TIER_INDEX[tier] : -1

      if (tier) {
        goal.el = TIER_EL
        elBase = TIER_EL
        goal.lookY = TIER_Y[tier] * state.sep
        goal.dist = tierDist[tier]
      } else {
        goal.el = BASE_EL
        elBase = BASE_EL
        goal.lookY = OVERVIEW_LOOK
        goal.dist = homeDist
      }

      if (reduced) drawOnce()
    }

    handleRef.current = { frame }

    /* ---- input ----------------------------------------------------------- */

    const remember = (event: PointerEvent) => {
      state.pointerType = event.pointerType || 'mouse'
      state.clientX = event.clientX
      state.clientY = event.clientY
      state.px = event.offsetX
      state.py = event.offsetY
      state.inside = true
    }

    const onPointerMove = (event: PointerEvent) => {
      remember(event)
      if (!state.dragging) {
        state.dragX = event.clientX
        state.dragY = event.clientY
      }
      // Without a ticker (reduced motion) the drawing still has to answer the
      // pointer: one render per event, which the browser already coalesces.
      if (reduced) drawOnce()
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      remember(event)
      state.dragX = event.clientX
      state.dragY = event.clientY
      state.dragging = true
      state.moved = 0
      canvas.setPointerCapture(event.pointerId)
    }

    const endDrag = (event: PointerEvent) => {
      if (!state.dragging) return
      state.dragging = false
      const tapped = state.moved < 6

      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId)

      if (tapped) {
        state.px = event.offsetX
        state.py = event.offsetY
        const next = hitTest()
        const value = next && next === state.focus ? null : next
        state.focus = value
        applyFocus(value)
        latest.current.onFocus(value)
      }

      if (state.pointerType === 'touch') state.inside = false
      if (reduced) drawOnce()
    }

    const onPointerLeave = () => {
      if (state.dragging) return
      state.inside = false
      if (state.focus !== null) {
        state.focus = null
        applyFocus(null)
        latest.current.onFocus(null)
      }
      if (reduced) drawOnce()
    }

    const onPointerEnter = (event: PointerEvent) => {
      remember(event)
    }

    /* ---- lifecycle ------------------------------------------------------- */

    const tick = (_time: number, deltaMs: number) => {
      draw(Math.min(deltaMs / 1000, 0.05))
    }

    const sync = () => {
      const want = state.onScreen && document.visibilityState === 'visible' && !reduced
      if (want && !tickerOn) {
        tickerOn = true
        gsap.ticker.add(tick)
      } else if (!want && tickerOn) {
        tickerOn = false
        gsap.ticker.remove(tick)
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        state.onScreen = entries[0]?.isIntersecting ?? false
        sync()
      },
      { rootMargin: '120px' },
    )
    observer.observe(host)

    const resizeObserver = new ResizeObserver(() => resize())
    const onVisibility = () => sync()

    const onContextLost = (event: Event) => {
      event.preventDefault()
      if (tickerOn) {
        gsap.ticker.remove(tick)
        tickerOn = false
      }
      latest.current.onUnavailable()
    }

    const scrollTrigger = reduced
      ? null
      : ScrollTrigger.create({
          trigger: host,
          start: 'top bottom',
          end: 'top 38%',
          onUpdate: (self) => {
            state.scroll = self.progress
          },
        })

    if (scrollTrigger) state.scroll = scrollTrigger.progress

    canvas.addEventListener('pointermove', onPointerMove, { passive: true })
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', endDrag)
    canvas.addEventListener('pointercancel', endDrag)
    canvas.addEventListener('pointerenter', onPointerEnter)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('webglcontextlost', onContextLost)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('resize', resize)

    // The first frame is drawn before the canvas is faded in, so the plate is
    // never an empty rectangle; the SVG stays under it until then.
    resize()
    resizeObserver.observe(host)

    if (reduced) {
      state.sep = 1
      state.reveal = 1
      uniforms.uReveal.value = 1
    }
    drawOnce()
    latest.current.onReady()
    sync()

    // A language switch rewrites the two annotations and the three captions in
    // the DOM. The widths change with the words, so the layout is re-measured
    // and, without a ticker, redrawn once.
    const textObserver = new MutationObserver(() => {
      measure()
      if (reduced) drawOnce()
    })
    textObserver.observe(labelHost, { characterData: true, childList: true, subtree: true })

    // Webfonts land after first layout and change the width of every label.
    let disposed = false
    document.fonts.ready.then(() => {
      if (disposed) return
      measure()
      if (reduced) drawOnce()
    })

    /* ---- teardown -------------------------------------------------------- */

    return () => {
      disposed = true
      if (tickerOn) {
        gsap.ticker.remove(tick)
        tickerOn = false
      }

      observer.disconnect()
      resizeObserver.disconnect()
      textObserver.disconnect()
      scrollTrigger?.kill()

      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', endDrag)
      canvas.removeEventListener('pointercancel', endDrag)
      canvas.removeEventListener('pointerenter', onPointerEnter)
      canvas.removeEventListener('pointerleave', onPointerLeave)
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
    // Built once. `handleRef` is a stable ref from the section, and focus and
    // framing travel through it: a hover or a language switch never tears the
    // renderer down.
  }, [handleRef])

  return (
    <div className="tty-scene">
      <div className="tty-scene__stage" ref={hostRef} aria-hidden="true" />

      <div className="tty-scene__labels" ref={labelHostRef} aria-hidden="true">
        {territoryStations.map((station) => (
          <span
            className="tty-label"
            key={station.id}
            data-label-id={station.id}
            data-kind={station.kind}
            data-active={focus === station.id ? 'true' : undefined}
            data-chain={chain && station.id !== focus && chain.includes(station.id) ? 'true' : undefined}
            data-dim={focus !== null && !chain?.includes(station.id) ? 'true' : undefined}
          >
            {station.id}
          </span>
        ))}

        <span
          className="tty-label tty-label--token"
          data-label-id={ENTRY_ID}
          data-kind="token"
          data-chain={chain && chain.includes(ENTRY_ID) ? 'true' : undefined}
          data-dim={focus !== null && !chain?.includes(ENTRY_ID) ? 'true' : undefined}
        >
          {entryLabel}
        </span>
        <span
          className="tty-label tty-label--token"
          data-label-id={EXIT_ID}
          data-kind="token"
          data-chain={chain && chain.includes(EXIT_ID) ? 'true' : undefined}
          data-dim={focus !== null && !chain?.includes(EXIT_ID) ? 'true' : undefined}
        >
          {exitLabel}
        </span>

        {TIERS.map((tier) => (
          <span
            className="tty-label tty-label--tier"
            key={tier}
            data-label-id={`tier:${tier}`}
            data-kind="tier"
            data-dim={focus !== null ? 'true' : undefined}
          >
            {tierLabels[tier]}
          </span>
        ))}
      </div>
    </div>
  )
}

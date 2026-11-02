import { useEffect, useMemo, useRef } from 'react'
import { sound } from '../../lib/sound'
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
  territoryLinks,
  territoryStations,
  territoryTrace,
  type LinkKind,
  type TierId,
} from '../../content/territory'

gsap.registerPlugin(ScrollTrigger)

/* ============================================================================
   The schema: three plans, one path
   ----------------------------------------------------------------------------
   What the drawing has to make legible in one look is not the hardware — it is
   the order a request goes through it, and the fact that every mark except the
   two nodes is a guest of one of those nodes. So the plate is a section, not a
   floor plan:

   - three hairline plans, stacked. EDGE on top, FABRIC in the middle, SERVICES
     at the bottom. Same footprint: one site, three levels.
   - traffic enters from above the edge plane, is forwarded across it, crosses
     the fabric and lands on the service that answers.
   - a guest is tied to its node by a short, quiet peg. At rest it is a stub, so
     ten guests do not read as a comb; when a mark is traced the pegs of that
     walk grow to the node and the argument becomes a line you can follow —
     which is the whole point, since the firewall and the proxy hang from the
     same chassis they front.
   - pointing at a mark lights only that mark's walk and drops everything else
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

/** The two annotations that sit off the plans: above the edge, off the right. */
const ENTRY_GAP = 0.74
const EXIT_GAP = 1.3

/** Base camera. Orbit is clamped around these, never free. */
const BASE_AZ = 0.28
const BASE_EL = 0.38
/** The stack is not symmetric: the entry sits above the top plane. The overview
    looks slightly high so the drawing is centred in its box, not the box's middle. */
const OVERVIEW_LOOK = 0.34
const AZ_LIMIT = 0.384 /* ±22° */
const EL_LIMIT = 0.244 /* ±14° */
const TIER_EL = 0.7

/** Field of view, and the half-angle it implies: the frame maths needs both. */
const CAM_FOV = 26
const TAN_HALF_FOV = Math.tan((CAM_FOV * Math.PI) / 360)

/* --------------------------------------------------------------------------
   The dive
   --------------------------------------------------------------------------
   The last twelfth of the drawing's pass is a fall, not a fade: the camera
   leaves the overview and drops into the fabric plan, between the two nodes,
   while the field of view opens and the stack grows. The drawing does not stop
   existing when the section does — the same geometry, stretched on Z, becomes
   the corridor the passage continues into.

   These are the numbers the scene is built on; the DOM dissolve happens at
   `DIVE_FADE`, and `DIVE_STRETCH` multiplies the links' Z only, so the plans
   and the marks keep their reading while the traffic elongates past the lens.
   -------------------------------------------------------------------------- */
const DIVE_START = 0.88
const DIVE_SPAN = 1 - DIVE_START
/** The landing point, in stack space: inside the fabric plan, between pve1/pve3. */
const DIVE_X = 0
const DIVE_Y = 0.4
const DIVE_Z = 2.2
const DIVE_FOV = 68
const DIVE_SCALE = 1.35
const DIVE_STRETCH = 1.2
const DIVE_FADE = 0.8
/** Chases per second: the fall follows the scroll, the eye arrives after it. */
const DIVE_EASE = 9

/**
 * The frame. A drawing that stops short of the measure reads as pushed into a
 * corner, one that touches it reads as a mistake — so the marks are held inside
 * 8% of the panel edge at every point of the turn, and the planes never leave
 * it at all. The fit is taken on the union of the sweep, not at rest, because
 * the near corner of the plan swings out as the stack turns.
 */
const MARK_FILL_X = 0.84 /* 8% and 92% */
const MARK_FILL_Y = 0.88
const CORNER_FILL_X = 0.95
const CORNER_FILL_Y = 0.95
/** A tier framed close: the plan fills the width, the caption has room. */
const TIER_FILL_X = 0.9
const TIER_FILL_Y = 0.62
/** Positions of the turn the frame is fitted on. Five is already generous. */
const TURN_STEPS = 5

/**
 * The turn. The whole stack is rotated on Y by the section's own progress, so
 * the drawing reads as an object rather than a printed cut: it arrives at one
 * angle and leaves at the other, passing through the base view in the middle.
 * 10° end to end — a drift you notice only if you look for it. Wider than this
 * and the fit has to back off to keep the swinging corner inside the panel,
 * which shrinks the drawing to pay for a gesture nobody asked for.
 */
const TURN_SWEEP = 0.17
const TURN_START = -TURN_SWEEP / 2
/** Radians per second of the turn chasing its target. Never mechanically latched. */
const TURN_EASE = 3.2

/** How strongly a tie inks at rest, against a route link. */
const TIE_TONE = 0.55

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
  uniform float uTrace;

  varying float vTier;
  varying float vRule;

  void main() {
    // Framing one stratum drops the others to a ruling instead of hiding them:
    // the reader keeps the context of what is above and below.
    float tier = (uTierFocus < -0.5 || abs(vTier - uTierFocus) < 0.5) ? 1.0 : 0.42;
    float appear = smoothstep(0.0, 0.14, uReveal);
    float a = 0.5 * vRule * tier * appear * (1.0 - 0.35 * uTrace);

    gl_FragColor = vec4(uContour, a);
  }
`

const EDGE_VERT = /* glsl */ `
  attribute vec3 aTo;
  attribute float aOrder;
  attribute float aDash;
  attribute float aDist;
  attribute float aFocus;
  attribute float aTone;
  attribute float aTie;

  uniform float uReveal;
  uniform float uTrace;
  uniform float uStretch;

  varying float vAlpha;
  varying float vDash;
  varying float vDist;

  void main() {
    // Both vertices of a link start at its source; the head walks towards the
    // target as the survey is inked. That is the pen drawing the edge.
    float t = clamp((uReveal - aOrder) / 0.26, 0.0, 1.0);

    // A host tie rests as a short tick lying on its own plan, pointing at the
    // node it hangs from — never a line to it, because ten of those close the
    // sheet into a comb and a tick that ran towards the proxy would be lost in
    // the fan of routes. When the mark is traced the tick lifts and reaches the
    // node, which is the one relation the drawing cannot state as traffic.
    // 0.46 drawing units: long enough to read as a mark, short enough not to
    // reach. Routes reach from the first frame, so the tick never applies.
    float lit = aFocus * uTrace;
    vec3 across = vec3(aTo.x - position.x, 0.0, aTo.z - position.z);
    float span = max(length(across), 0.0001);
    vec3 peg = position + (across / span) * min(0.46, span);
    // A route reaches its target from the first frame; a tie only grows to the
    // node it hangs from once the mark is traced.
    vec3 end = aTie > 0.5 ? mix(peg, aTo, lit) : aTo;
    vec3 p = mix(position, end, t);

    // The dive: the links keep their plan coordinates and stretch away from the
    // middle of the stack on Z, so the drawing becomes a corridor without a
    // second geometry. 1 at rest — the survey as drawn.
    p.z *= uStretch;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);

    vAlpha =
      smoothstep(0.0, 0.02, t) *
      mix(1.0, aFocus, uTrace) *
      mix(aTone, 1.0, lit);
    vDash = aDash;
    vDist = aDist * mix(0.34, 1.0, lit) * t;
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
  uniform float uTrace;

  varying float vKind;
  varying float vAlpha;

  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);

    float appear = smoothstep(aOrder - 0.06, aOrder + 0.14, uReveal);
    gl_PointSize = aSize * uDpr * (0.55 + 0.45 * appear);

    vAlpha = appear * mix(1.0, aFocus, uTrace);
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

type Edge = { a: string; b: string; kind: LinkKind; tie: boolean; order: number; dist: number }

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

  // The labels follow the same trace the drawing lights: the mark that was
  // pointed at is ink, everything that answers with it is secondary ink, and the
  // rest of the sheet drops to a ruling. Same function, so the words, the marks
  // and the pegs can never disagree.
  const traced = useMemo(() => (focus ? new Set(territoryTrace(focus)) : null), [focus])

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

    const camera = new PerspectiveCamera(CAM_FOV, 1, 0.5, 140)

    /* ---- points --------------------------------------------------------- */

    const points = new Map<string, Vec>()
    for (const station of territoryStations) {
      points.set(station.id, { x: station.x, y: TIER_Y[station.tier], z: station.z })
    }

    const opnsense = points.get('opnsense')
    const pbs = points.get('pbs')
    if (!opnsense || !pbs) return

    const entryY = TIER_Y.edge + ENTRY_GAP
    const exitX = pbs.x + EXIT_GAP
    points.set(ENTRY_ID, { x: opnsense.x, y: entryY, z: opnsense.z })
    points.set(EXIT_ID, { x: exitX, y: TIER_Y.fabric, z: pbs.z })

    /* ---- links ---------------------------------------------------------- */

    // Every link comes from the content module, already derived: route links
    // walked by a chain, ties from `host`, the vmbr1 span. Nothing is invented
    // here, so the drawing and the register cannot disagree.
    const edges: Edge[] = territoryLinks.map((link) => ({
      a: link.a,
      b: link.b,
      kind: link.kind,
      tie: link.tie === true,
      order: 0,
      dist: 0,
    }))

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
    const linkTie: number[] = []
    const linkTone: number[] = []

    for (const edge of edges) {
      const a = points.get(edge.a)
      const b = points.get(edge.b)
      if (!a || !b) continue
      const tie = edge.tie
      const dash = edge.kind === 'backup' ? 1 : 0
      const tone = tie ? TIE_TONE : 1

      linkPos.push(a.x, a.y, a.z, a.x, a.y, a.z)
      linkTo.push(a.x, a.y, a.z, b.x, b.y, b.z)
      linkOrder.push(edge.order, edge.order)
      linkDash.push(dash, dash)
      linkDist.push(0, edge.dist)
      linkFocus.push(1, 1)
      linkTie.push(tie ? 1 : 0, tie ? 1 : 0)
      linkTone.push(tone, tone)
    }

    const linkGeometry = new BufferGeometry()
    linkGeometry.setAttribute('position', new Float32BufferAttribute(linkPos, 3))
    linkGeometry.setAttribute('aTo', new Float32BufferAttribute(linkTo, 3))
    linkGeometry.setAttribute('aOrder', new Float32BufferAttribute(linkOrder, 1))
    linkGeometry.setAttribute('aDash', new Float32BufferAttribute(linkDash, 1))
    linkGeometry.setAttribute('aDist', new Float32BufferAttribute(linkDist, 1))
    linkGeometry.setAttribute('aTie', new Float32BufferAttribute(linkTie, 1))
    linkGeometry.setAttribute('aTone', new Float32BufferAttribute(linkTone, 1))
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

    const NODE_SIZE = { node: 14, service: 10, control: 38 }
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
      uTrace: { value: 0 },
      uTierFocus: { value: -1 },
      uDpr: { value: renderer.getPixelRatio() },
      uInk: { value: new Vector3(INK[0], INK[1], INK[2]) },
      uMark: { value: new Vector3(MARK[0], MARK[1], MARK[2]) },
      uContour: { value: new Vector3(CONTOUR[0], CONTOUR[1], CONTOUR[2]) },
      uOpacity: { value: 0.44 },
      /** 1 at rest; the links' Z multiplier during the dive. */
      uStretch: { value: 1 },
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
        // Two marks have a line leaving them to the right at their own height —
        // pve1 sends the trunk and the backup bus, pbs sends the bus off the
        // sheet — and a word on a line is a word read twice. Their names are set
        // above the mark; everything else sits level with its own.
        dy: station.id === 'pbs' || station.id === 'pve1' ? -15 : 0,
      })
    }

    specs.push({
      id: ENTRY_ID,
      kind: 'token',
      x: opnsense.x,
      y: entryY,
      z: opnsense.z,
      side: 'right',
      offset: 12,
      dy: -14,
    })
    specs.push({
      id: EXIT_ID,
      kind: 'token',
      x: exitX,
      y: TIER_Y.fabric,
      z: pbs.z,
      side: 'right',
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

    const cam = { az: BASE_AZ, el: BASE_EL, dist: 22, lookY: OVERVIEW_LOOK, lookX: 0 }
    const goal = { az: BASE_AZ, el: BASE_EL, dist: 22, lookY: OVERVIEW_LOOK, lookX: 0 }
    const lookTarget = new Vector3()
    let elBase = BASE_EL
    let framed: TierId | null = null
    let homeDist = 22
    /** The overview aim, solved on resize: the drawing's own centre, not the box's. */
    let homeLook = OVERVIEW_LOOK
    let homeLookX = 0
    const tierDist: Record<TierId, number> = { edge: 22, fabric: 22, services: 22 }

    /**
     * The camera, with an aim that can be moved off the stack's origin on both
     * axes. The origin is a construction point, not a composition: the drawing
     * is asymmetric in x (the sheet leaves by the right) and in y (the near
     * corner of the bottom plan is magnified by the perspective), so the frame
     * is centred by measurement, not by assumption.
     */
    const placeCamera = (
      dist: number,
      az: number,
      el: number,
      lookY: number,
      lookX: number,
    ) => {
      const cos = Math.cos(el)
      const rightX = Math.cos(az)
      const rightZ = -Math.sin(az)
      camera.position.set(
        dist * cos * Math.sin(az) + lookX * rightX,
        lookY + dist * Math.sin(el),
        dist * cos * Math.cos(az) + lookX * rightZ,
      )
      lookTarget.set(lookX * rightX, lookY, lookX * rightZ)
      camera.lookAt(lookTarget)
      camera.updateMatrixWorld()
    }

    const fitPoints = new Float32Array(84)
    const corner = (i: number, x: number, y: number, z: number) => {
      fitPoints[i * 3] = x
      fitPoints[i * 3 + 1] = y
      fitPoints[i * 3 + 2] = z
    }

    /** Projected bounds of a slice of that buffer, over the whole turn. */
    const extent = { minX: 0, maxX: 0, minY: 0, maxY: 0 }

    /**
     * Project a range of points at one camera, at five positions of the turn,
     * and keep the union's bounds. The stack's own matrix is applied because the
     * drawing turns: a frame fitted at rest would clip the corner that swings
     * towards the camera at the ends of the sweep.
     */
    const measureExtent = (
      dist: number,
      el: number,
      lookY: number,
      lookX: number,
      from: number,
      to: number,
    ) => {
      extent.minX = Infinity
      extent.maxX = -Infinity
      extent.minY = Infinity
      extent.maxY = -Infinity
      for (let step = 0; step < TURN_STEPS; step++) {
        stack.rotation.y = TURN_START + (step / (TURN_STEPS - 1)) * TURN_SWEEP
        // The fit is the framed drawing, never the dive's grown state.
        stack.scale.set(1, 1, 1)
        stack.updateMatrixWorld(true)
        placeCamera(dist, BASE_AZ, el, lookY, lookX)
        for (let i = from; i < to; i++) {
          scratch
            .set(fitPoints[i * 3], fitPoints[i * 3 + 1], fitPoints[i * 3 + 2])
            .applyMatrix4(stack.matrixWorld)
            .project(camera)
          if (scratch.x < extent.minX) extent.minX = scratch.x
          if (scratch.x > extent.maxX) extent.maxX = scratch.x
          if (scratch.y < extent.minY) extent.minY = scratch.y
          if (scratch.y > extent.maxY) extent.maxY = scratch.y
        }
      }
    }

    /**
     * How far the camera has to back off for a range to sit inside its margins.
     * The projection is not linear in distance, so this is the multiplier for
     * one pass of a fixed-point loop, not a formula.
     */
    const overflow = (
      dist: number,
      el: number,
      lookY: number,
      lookX: number,
      from: number,
      to: number,
      fillX: number,
      fillY: number,
    ) => {
      measureExtent(dist, el, lookY, lookX, from, to)
      return Math.max(
        Math.abs(extent.minX) / fillX,
        Math.abs(extent.maxX) / fillX,
        Math.abs(extent.minY) / fillY,
        Math.abs(extent.maxY) / fillY,
      )
    }

    /* ---- state ----------------------------------------------------------- */

    const state = {
      reveal: reduced ? 1 : 0,
      elapsed: 0,
      sep: 1,
      scroll: 1,
      /** Scroll progress through the whole section, 0..1: what the turn follows. */
      turn: 0.5,
      /** Eased turn, so a wheel tick never latches the drawing at an angle. */
      spin: 0.5,
      /** Where the last twelfth of the pass puts the camera, 0..1. */
      diveTarget: 0,
      /** Eased dive, so a fast wheel does not teleport the camera. */
      dive: 0,
      /** Whether the section's DOM is dissolved (the cross is written once). */
      deep: false,
      first: true,
      focus: null as string | null,
      /** Eased 0..1 of how much of the sheet is traced. */
      trace: 0,
      ink: -1,
      /** Last label opacity written, so the dive writes only on a change. */
      labelAlpha: -1,
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

    /* The section, for the DOM dissolve. The canvas lives inside `.tty`; the
       attribute is the one channel from the frame loop to the stylesheet, and it
       is removed by the teardown so a lost context cannot leave the words at
       zero. */
    const section = host.closest<HTMLElement>('.tty')

    const setDeep = (deep: boolean) => {
      if (!section || state.deep === deep) return
      state.deep = deep
      if (deep) section.setAttribute('data-dive', 'deep')
      else section.removeAttribute('data-dive')
    }

    /** The dive's target, from the last twelfth of the turn's own progress. */
    const aimDive = (progress: number) => {
      const raw = Math.min(1, Math.max(0, (progress - DIVE_START) / DIVE_SPAN))
      // Smoothstep: the fall leaves and lands at rest, never at a wheel tick's
      // full speed.
      state.diveTarget = raw * raw * (3 - 2 * raw)
    }

    /* ---- focus ----------------------------------------------------------- */

    const nodeIndex = new Map<string, number>()
    territoryStations.forEach((station, index) => nodeIndex.set(station.id, index))

    const focusAttr = linkGeometry.getAttribute('aFocus') as BufferAttribute
    const nodeFocusAttr = nodeGeometry.getAttribute('aFocus') as BufferAttribute
    const focusArray = focusAttr.array as Float32Array
    const nodeFocusArray = nodeFocusAttr.array as Float32Array

    /**
     * Lighting is a graph rule, not a second drawing: a mark on the trace is
     * ink, a link is lit when both of its ends are ink. That is why a guest's
     * tie to its node lights whenever the guest does, and why the backup branch
     * only appears when the backup target is the thing being read.
     */
    const applyFocus = (id: string | null) => {
      focusArray.fill(id ? 0.1 : 1)
      nodeFocusArray.fill(id ? 0.1 : 1)

      if (id) {
        const lit = new Set(territoryTrace(id))

        for (const step of lit) {
          const index = nodeIndex.get(step)
          if (index !== undefined) nodeFocusArray[index] = 1
        }

        for (let i = 0; i < edges.length; i++) {
          if (!lit.has(edges[i].a) || !lit.has(edges[i].b)) continue
          focusArray[i * 2] = 1
          focusArray[i * 2 + 1] = 1
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
        scratch
          .set(PLANE_CORNERS[i], TIER_Y[tier], PLANE_CORNERS[i + 1])
          .applyMatrix4(stack.matrixWorld)
          .project(camera)
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
        // The stack turns and separates; a label anchored in stack space has to
        // travel with it or it slides off its own mark.
        scratch.set(spec.x, spec.y, spec.z).applyMatrix4(stack.matrixWorld).project(camera)
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

      // The turn: the section's own progress drives it, then the drawing eases
      // after it, so a fast wheel is followed by the object rather than the
      // object snapping under the cursor. It is applied to the stack, not the
      // camera, so the drag's ±22° still adds to it instead of canceling it.
      state.spin = state.first
        ? state.turn
        : state.spin + (state.turn - state.spin) * (reduced ? 1 : Math.min(1, dt * TURN_EASE))

      // The fall. One item of state, eased on the same ticker: the scroll only
      // sets its target, so a wheel flick is followed by a camera instead of a
      // cut. Under reduced motion the target is never written and the dive
      // stays at its final (rest) state.
      state.dive = state.first
        ? state.diveTarget
        : state.dive + (state.diveTarget - state.dive) * (reduced ? 1 : Math.min(1, dt * DIVE_EASE))
      const dive = state.dive

      stack.rotation.y = TURN_START + state.spin * TURN_SWEEP
      // The stack grows as the camera enters it, so the near plans and the
      // stretched links pass the lens instead of receding from it.
      const grow = 1 + (DIVE_SCALE - 1) * dive
      stack.scale.set(grow, state.sep * grow, grow)
      stack.updateMatrixWorld(true)
      state.first = false

      // The links' own Z multiplier: one uniform, no geometry upload.
      uniforms.uStretch.value = 1 + DIVE_STRETCH * dive

      // The trace: one eased scalar decides how much of the sheet is lit and
      // how far the ties of the traced walk reach. Uniform only — no buffer
      // upload per frame, and it settles.
      const traceTarget = state.focus ? 1 : 0
      state.trace = reduced
        ? traceTarget
        : state.trace + (traceTarget - state.trace) * Math.min(1, dt * 12)
      uniforms.uTrace.value = state.trace

      if (!reduced) {
        state.elapsed += dt
        state.reveal = Math.min(1, Math.max(0, (state.elapsed - 0.1) / 1.35))
      }
      uniforms.uReveal.value = state.reveal

      cam.az += (goal.az - cam.az) * k
      cam.el += (goal.el - cam.el) * k
      cam.dist += (goal.dist - cam.dist) * k
      cam.lookY += (goal.lookY - cam.lookY) * k
      cam.lookX += (goal.lookX - cam.lookX) * k

      const drift = reduced ? 0 : Math.sin(state.elapsed * 0.16) * 0.012
      const lift = reduced ? 0 : (state.scroll - 1) * 0.09
      placeCamera(cam.dist, cam.az + drift, Math.max(0.06, cam.el + lift), cam.lookY, cam.lookX)

      // The dive, composed on top of the settled framing: the camera leaves the
      // overview and lands inside the fabric plan. The point is transformed by
      // the stack's own matrix, so the fall follows the drawing as it turns and
      // separates. `scratch` is the projection scratch — no allocation here.
      if (dive > 0) {
        scratch.set(DIVE_X, DIVE_Y, DIVE_Z).applyMatrix4(stack.matrixWorld)
        camera.position.lerp(scratch, dive)
        camera.lookAt(lookTarget)
      }

      // The lens opens with the fall and closes when the reader scrolls back
      // out. Written only when it moves: a projection matrix rebuild per frame
      // is cheap, per inert frame it is not.
      const fov = CAM_FOV + (DIVE_FOV - CAM_FOV) * dive
      if (Math.abs(camera.fov - fov) > 0.01) {
        camera.fov = fov
        camera.updateProjectionMatrix()
      }
      if (dive > 0) camera.updateMatrixWorld()

      project()

      // Past halfway the drawing has no readable marks to point at: the lens is
      // inside the stack, so the hit test would answer for a projection nobody
      // can see. Dropping it also clears the trace, which is what lets the
      // labels dissolve without a lit chain stranded on screen.
      let hovered: string | null = null
      if (state.inside && !state.dragging && dive < 0.5) hovered = hitTest()
      if (hovered !== state.focus) {
        state.focus = hovered
        applyFocus(hovered)
        latest.current.onFocus(hovered)
        // A mark under the pointer: its tier is the note, its x the pan.
        const mark = hovered ? territoryStations.find((s) => s.id === hovered) : undefined
        if (mark) sound.node(mark.x, mark.tier)
      }

      // The names arrive with the ink, not before it: a label on a mark that
      // has not been drawn yet reads as a wireframe with floating text. They
      // leave with the dive: a label projected from a falling camera is noise
      // over the drawing, so the field dissolves as the camera passes it.
      const raw = reduced ? 1 : Math.min(1, Math.max(0, (state.reveal - 0.5) / 0.28))
      const ink = Math.round(raw * 40) / 40
      if (ink !== state.ink) state.ink = ink
      const labelAlpha = Math.round(ink * (1 - dive) * 40) / 40
      if (labelAlpha !== state.labelAlpha) {
        state.labelAlpha = labelAlpha
        labelHost.style.opacity = labelAlpha.toFixed(3)
      }

      // The section's prose dissolves once the camera is inside the drawing.
      // The register below is not part of this: it is the inventory the reader
      // has not read yet, and blanking it would remove content from the page.
      setDeep(dive > DIVE_FADE)

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

      // The frame's points, in stack space. The twelve plane corners first, so
      // the sheet's own edge can be fitted separately from the marks; then the
      // marks — the stations and the two annotations. They are what the eye
      // measures, and they are what must land inside the 8% margin.
      let i = 0
      for (const tier of TIERS) {
        for (const x of [-PLANE_X, PLANE_X]) {
          for (const z of [-PLANE_Z, PLANE_Z]) corner(i++, x, TIER_Y[tier], z)
        }
      }
      const cornerCount = i
      for (const station of territoryStations) {
        corner(i++, station.x, TIER_Y[station.tier], station.z)
      }
      corner(i++, opnsense.x, entryY, opnsense.z)
      corner(i++, exitX, TIER_Y.fabric, pbs.z)
      const pointCount = i

      // Distance and aim are solved together: back off until the marks sit
      // inside their margin and the planes inside theirs, then move the aim
      // until the whole drawing — planes and marks — is centred. Centring the
      // marks alone is what left the sheet hanging: the near corner of a plan
      // is magnified by the perspective and reaches far below the last mark, so
      // the space under the drawing was being paid for at the top.
      let dist = cam.dist
      let lookY = OVERVIEW_LOOK
      let lookX = 0
      for (let pass = 0; pass < 6; pass++) {
        const k = Math.max(
          overflow(dist, BASE_EL, lookY, lookX, 0, cornerCount, CORNER_FILL_X, CORNER_FILL_Y),
          overflow(dist, BASE_EL, lookY, lookX, cornerCount, pointCount, MARK_FILL_X, MARK_FILL_Y),
        )
        dist *= Math.max(k, 0.2)
        measureExtent(dist, BASE_EL, lookY, lookX, 0, pointCount)
        // Aim lower and the drawing rises; aim right and it slides left. Both
        // are applied to the camera and its target together, so the projection
        // is only translated.
        lookY += (((extent.minY + extent.maxY) / 2) * dist * TAN_HALF_FOV) / Math.cos(BASE_EL)
        lookX += ((extent.maxX + extent.minX) / 2) * dist * TAN_HALF_FOV * camera.aspect
      }
      homeDist = dist
      homeLook = lookY
      homeLookX = lookX

      for (const tier of TIERS) {
        const from = TIERS.indexOf(tier) * 4
        let d = cam.dist
        for (let pass = 0; pass < 4; pass++) {
          d *= Math.max(
            overflow(d, TIER_EL, TIER_Y[tier], 0, from, from + 4, TIER_FILL_X, TIER_FILL_Y),
            0.2,
          )
        }
        tierDist[tier] = d
      }

      goal.dist = framed ? tierDist[framed] : homeDist
      goal.lookY = framed ? TIER_Y[framed] * state.sep : homeLook
      goal.lookX = framed ? 0 : homeLookX

      if (state.first) {
        cam.dist = goal.dist
        cam.lookY = goal.lookY
        cam.lookX = goal.lookX
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
        goal.lookX = 0
        goal.dist = tierDist[tier]
      } else {
        goal.el = BASE_EL
        elBase = BASE_EL
        goal.lookY = homeLook
        goal.lookX = homeLookX
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
      // The SVG plate returns at full strength: a dissolved section over a
      // poster would be a chapter with no words.
      setDeep(false)
      labelHost.style.removeProperty('opacity')
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

    // The turn runs over the passage the reader actually watches — the plate's
    // centre crossing the middle of the viewport — and not over its full
    // transit. A 576px plate in a 900px viewport is only wholly on screen for
    // 324px of scroll; tied to the whole transit, the sweep would spend most of
    // its travel off screen and arrive as a surprise. This range is the plate's
    // own reading window, so the drift is spread across it. Its last twelfth is
    // the dive: the turn is the section's pass, and the fall is its end.
    const turnTrigger = reduced
      ? null
      : ScrollTrigger.create({
          trigger: host,
          start: 'center 72%',
          end: 'center 28%',
          onUpdate: (self) => {
            state.turn = self.progress
            aimDive(self.progress)
          },
        })

    if (turnTrigger) {
      state.turn = turnTrigger.progress
      aimDive(turnTrigger.progress)
    }

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

      setDeep(false)

      observer.disconnect()
      resizeObserver.disconnect()
      textObserver.disconnect()
      scrollTrigger?.kill()
      turnTrigger?.kill()

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
            data-chain={traced && station.id !== focus && traced.has(station.id) ? 'true' : undefined}
            data-dim={focus !== null && !traced?.has(station.id) ? 'true' : undefined}
          >
            {station.id}
          </span>
        ))}

        <span
          className="tty-label tty-label--token"
          data-label-id={ENTRY_ID}
          data-kind="token"
          data-chain={traced?.has(ENTRY_ID) ? 'true' : undefined}
          data-dim={focus !== null && !traced?.has(ENTRY_ID) ? 'true' : undefined}
        >
          {entryLabel}
        </span>
        <span
          className="tty-label tty-label--token"
          data-label-id={EXIT_ID}
          data-kind="token"
          data-chain={traced?.has(EXIT_ID) ? 'true' : undefined}
          data-dim={focus !== null && !traced?.has(EXIT_ID) ? 'true' : undefined}
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

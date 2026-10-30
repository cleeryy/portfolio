import { useEffect, useRef } from 'react'
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineSegments,
  OrthographicCamera,
  Points,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import './hero.css'

/* ============================================================================
   The plot: a network survey drawn the way a plotter would draw it.

   Responsibility, and nothing else: show the topology the operator runs —
   stations, links, and a packet travelling between them — and react additively
   to the pointer. It is the drawing under the type, never the subject.

   Everything after the first upload happens on the GPU. A frame writes five
   uniforms and two transforms; no geometry, string or object is allocated.
   ========================================================================== */

/* --------------------------------------------------------------------------
   Survey marks. Coordinates are in a normalised [-1, 1] plot box; the camera
   fits that box to the viewport, so the same drawing works at every size.

   `kind`: 0 = station cross (infrastructure), 1 = service square.
   `tone`: 0 = ink, 1 = survey mark.
   `order`: when the mark is drawn, 0..1, inside-out.
   `tier`: 0/1 stay on small screens, 2 is the far field.
   -------------------------------------------------------------------------- */

type Station = {
  id: string
  x: number
  y: number
  size: number
  kind: 0 | 1 | 2
  tone: 0 | 1
  alpha: number
  order: number
  tier: 0 | 1 | 2
}

const STATIONS: Station[] = [
  // The operated core: a primary survey station is a ringed cross.
  { id: 'ring', x: 0, y: 0.02, size: 58, kind: 2, tone: 0, alpha: 0.42, order: 0, tier: 0 },
  { id: 'cluster', x: 0, y: 0.02, size: 24, kind: 0, tone: 1, alpha: 1, order: 0.04, tier: 0 },

  { id: 'pve1', x: -0.16, y: 0.16, size: 15, kind: 0, tone: 0, alpha: 0.95, order: 0.12, tier: 0 },
  { id: 'pve3', x: 0.14, y: 0.17, size: 15, kind: 0, tone: 0, alpha: 0.95, order: 0.16, tier: 0 },
  { id: 'opnsense', x: -0.32, y: -0.02, size: 18, kind: 0, tone: 1, alpha: 1, order: 0.26, tier: 0 },
  { id: 'wireguard', x: 0.1, y: -0.38, size: 15, kind: 0, tone: 0, alpha: 0.95, order: 0.3, tier: 0 },

  // Services sitting on top of it, laid out as a plan rather than a ring.
  { id: 'pbs', x: -0.28, y: 0.32, size: 10, kind: 1, tone: 0, alpha: 0.9, order: 0.4, tier: 1 },
  { id: 'monitor', x: 0.02, y: 0.36, size: 10, kind: 1, tone: 0, alpha: 0.9, order: 0.44, tier: 1 },
  { id: 'mic', x: 0.26, y: 0.34, size: 9, kind: 1, tone: 0, alpha: 0.85, order: 0.48, tier: 1 },
  { id: 'meal', x: -0.54, y: 0.1, size: 9, kind: 1, tone: 0, alpha: 0.85, order: 0.52, tier: 1 },
  { id: 'proxy', x: 0.3, y: 0.02, size: 10, kind: 1, tone: 0, alpha: 0.9, order: 0.56, tier: 1 },
  { id: 'dns', x: 0.46, y: -0.12, size: 9, kind: 1, tone: 0, alpha: 0.85, order: 0.6, tier: 1 },
  { id: 'git', x: 0.18, y: -0.16, size: 9, kind: 1, tone: 0, alpha: 0.85, order: 0.64, tier: 1 },
  { id: 'deploy', x: -0.08, y: -0.2, size: 9, kind: 1, tone: 0, alpha: 0.85, order: 0.68, tier: 1 },
  { id: 'courses', x: -0.34, y: -0.36, size: 9, kind: 1, tone: 0, alpha: 0.85, order: 0.72, tier: 1 },

  // Far field: the ranges he trains on sit outside the territory he operates.
  { id: 'range-nw', x: -0.76, y: -0.44, size: 13, kind: 0, tone: 0, alpha: 0.36, order: 0.8, tier: 2 },
  { id: 'range-n', x: -0.62, y: 0.5, size: 13, kind: 0, tone: 0, alpha: 0.36, order: 0.84, tier: 2 },
  { id: 'range-e', x: 0.7, y: 0.38, size: 13, kind: 0, tone: 0, alpha: 0.36, order: 0.88, tier: 2 },
  { id: 'range-se', x: 0.6, y: -0.5, size: 13, kind: 0, tone: 0, alpha: 0.36, order: 0.92, tier: 2 },
]

type Link = { a: string; b: string; tone?: 0 | 1; pulse?: boolean }

const LINKS: Link[] = [
  { a: 'cluster', b: 'pve1', tone: 1, pulse: true },
  { a: 'cluster', b: 'pve3', tone: 1 },
  { a: 'pve1', b: 'pve3' },
  { a: 'cluster', b: 'opnsense', tone: 1, pulse: true },
  { a: 'cluster', b: 'proxy' },
  { a: 'cluster', b: 'deploy' },
  { a: 'cluster', b: 'wireguard' },
  { a: 'pve1', b: 'pbs' },
  { a: 'pve3', b: 'monitor' },
  { a: 'pve3', b: 'mic', pulse: true },
  { a: 'pve3', b: 'git' },
  { a: 'opnsense', b: 'meal' },
  { a: 'opnsense', b: 'wireguard' },
  { a: 'proxy', b: 'dns', pulse: true },
  { a: 'proxy', b: 'git' },
  { a: 'deploy', b: 'courses', pulse: true },
  { a: 'courses', b: 'range-nw' },
  { a: 'monitor', b: 'range-e' },
]

/* --------------------------------------------------------------------------
   Shaders. Colours are passed as raw sRGB floats and written straight to the
   framebuffer: every material here is a custom ShaderMaterial, so three's
   colour management never enters the path and the WebGL ink matches the CSS
   ink exactly.
   -------------------------------------------------------------------------- */

const DISPLACE = /* glsl */ `
  vec2 surveyDisplace(vec2 p, vec2 pointer, float repel) {
    vec2 d = p - pointer;
    float r2 = dot(d, d);
    float falloff = exp(-r2 * 24.0) * repel;
    float len = sqrt(r2) + 0.0001;
    return p + (d / len) * falloff;
  }
`

const NODE_VERT = /* glsl */ `
  attribute float aOrder;
  attribute float aSize;
  attribute float aTone;
  attribute float aKind;
  attribute float aAlpha;

  uniform float uReveal;
  uniform float uDepth;
  uniform float uDpr;
  uniform vec2 uPointer;
  uniform float uRepel;

  varying float vTone;
  varying float vKind;
  varying float vAlpha;

  ${DISPLACE}

  void main() {
    vec2 p = surveyDisplace(position.xy, uPointer, uRepel);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);

    float appear = smoothstep(aOrder - 0.03, aOrder + 0.09, uReveal);
    gl_PointSize = aSize * uDpr * (0.35 + 0.65 * appear);

    vAlpha = aAlpha * appear * (1.0 - 0.4 * uDepth);
    vTone = aTone;
    vKind = aKind;
  }
`

const NODE_FRAG = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uMark;

  varying float vTone;
  varying float vKind;
  varying float vAlpha;

  void main() {
    vec2 q = gl_PointCoord - 0.5;
    float ax = abs(q.x);
    float ay = abs(q.y);
    float shape;

    if (vKind < 0.5) {
      // Survey station: a plus, drawn with two feathered bars.
      float arm = 0.075;
      float hBar = 1.0 - smoothstep(arm - 0.02, arm + 0.02, ay);
      float vBar = 1.0 - smoothstep(arm - 0.02, arm + 0.02, ax);
      shape = max(hBar, vBar);
    } else if (vKind < 1.5) {
      // Service: a filled square, smaller than the station it sits on.
      shape = 1.0 - smoothstep(0.28, 0.32, max(ax, ay));
    } else {
      // Primary station: one ring around the hub, the way a survey sheet marks
      // a control point. Kept hairline-thin so it reads as a ruling, not a dial.
      float d = length(q);
      shape = 1.0 - smoothstep(0.006, 0.016, abs(d - 0.34));
    }

    if (shape < 0.004) discard;

    vec3 c = mix(uInk, uMark, step(0.5, vTone));
    gl_FragColor = vec4(c, vAlpha * shape);
  }
`

const LINE_VERT = /* glsl */ `
  attribute vec2 aTo;
  attribute float aOrder;
  attribute float aTone;

  uniform float uReveal;
  uniform float uDepth;
  uniform vec2 uPointer;
  uniform float uRepel;

  varying float vAlpha;
  varying float vTone;

  ${DISPLACE}

  void main() {
    // Both endpoints start at the source; the head walks to the target as the
    // reveal passes this link's order. That is the pen drawing the edge.
    float t = clamp((uReveal - aOrder) / 0.16, 0.0, 1.0);
    vec2 p = surveyDisplace(mix(position.xy, aTo, t), uPointer, uRepel);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);

    vAlpha = step(0.001, t) * (1.0 - 0.55 * uDepth);
    vTone = aTone;
  }
`

const LINE_FRAG = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uMark;
  uniform float uOpacity;

  varying float vAlpha;
  varying float vTone;

  void main() {
    vec3 c = mix(uInk, uMark, step(0.5, vTone));
    gl_FragColor = vec4(c, vAlpha * uOpacity);
  }
`

const PULSE_VERT = /* glsl */ `
  attribute vec2 aTo;
  attribute float aPhase;
  attribute float aSpeed;
  attribute float aOrder;

  uniform float uTime;
  uniform float uReveal;
  uniform float uDepth;
  uniform float uDpr;
  uniform vec2 uPointer;
  uniform float uRepel;

  varying float vAlpha;

  ${DISPLACE}

  void main() {
    float t = fract(aPhase + uTime * aSpeed);
    vec2 p = surveyDisplace(mix(position.xy, aTo, t), uPointer, uRepel);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0.0, 1.0);

    float gate = smoothstep(aOrder + 0.12, aOrder + 0.3, uReveal);
    float alive = smoothstep(0.0, 0.07, t) * (1.0 - smoothstep(0.93, 1.0, t));

    gl_PointSize = 8.0 * uDpr;
    vAlpha = gate * alive * (1.0 - 0.2 * uDepth);
  }
`

const PULSE_FRAG = /* glsl */ `
  uniform vec3 uMark;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    float core = 1.0 - smoothstep(0.08, 0.2, d);
    float halo = (1.0 - smoothstep(0.18, 0.5, d)) * 0.22;
    float a = (core + halo) * vAlpha;

    if (a < 0.004) discard;
    gl_FragColor = vec4(uMark, a);
  }
`

/* Raw sRGB, matching --ink (#131c19) and --mark (#bf1f34). */
const INK: [number, number, number] = [0x13 / 255, 0x1c / 255, 0x19 / 255]
const MARK: [number, number, number] = [0xbf / 255, 0x1f / 255, 0x34 / 255]

type HeroSceneProps = {
  /** Fired once a frame has actually been drawn, so the canvas can fade in. */
  onReady: () => void
  /** Fired when WebGL is missing, the context is lost, or setup throws. */
  onUnavailable: () => void
}

export default function HeroScene({ onReady, onUnavailable }: HeroSceneProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches

    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true })
    } catch {
      onUnavailable()
      return
    }

    if (!renderer.getContext()) {
      renderer.dispose()
      onUnavailable()
      return
    }

    renderer.setClearAlpha(0)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))

    const canvas = renderer.domElement
    canvas.className = 'hero-scene__canvas'
    host.appendChild(canvas)

    const scene = new Scene()
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10)
    camera.position.z = 5

    const plot = new Group()
    scene.add(plot)

    /* ---- geometry ------------------------------------------------------- */

    const compact = window.matchMedia('(max-width: 760px)').matches
    const stations = compact ? STATIONS.filter((s) => s.tier < 2) : STATIONS
    const byId = new Map(stations.map((s) => [s.id, s]))
    const links = LINKS.filter((l) => byId.has(l.a) && byId.has(l.b))

    const geometries: BufferGeometry[] = []
    const materials: ShaderMaterial[] = []

    const nodePos: number[] = []
    const nodeOrder: number[] = []
    const nodeSize: number[] = []
    const nodeTone: number[] = []
    const nodeKind: number[] = []
    const nodeAlpha: number[] = []

    for (const s of stations) {
      nodePos.push(s.x, s.y, 0)
      nodeOrder.push(s.order)
      nodeSize.push(s.size)
      nodeTone.push(s.tone)
      nodeKind.push(s.kind)
      nodeAlpha.push(s.alpha)
    }

    const nodeGeometry = new BufferGeometry()
    nodeGeometry.setAttribute('position', new Float32BufferAttribute(nodePos, 3))
    nodeGeometry.setAttribute('aOrder', new Float32BufferAttribute(nodeOrder, 1))
    nodeGeometry.setAttribute('aSize', new Float32BufferAttribute(nodeSize, 1))
    nodeGeometry.setAttribute('aTone', new Float32BufferAttribute(nodeTone, 1))
    nodeGeometry.setAttribute('aKind', new Float32BufferAttribute(nodeKind, 1))
    nodeGeometry.setAttribute('aAlpha', new Float32BufferAttribute(nodeAlpha, 1))
    geometries.push(nodeGeometry)

    const edgePos: number[] = []
    const edgeTo: number[] = []
    const edgeOrder: number[] = []
    const edgeTone: number[] = []

    for (const l of links) {
      const a = byId.get(l.a)
      const b = byId.get(l.b)
      if (!a || !b) continue
      const order = Math.max(a.order, b.order) + 0.02
      // Both vertices are anchored at the source; aTo carries the destination.
      edgePos.push(a.x, a.y, 0, a.x, a.y, 0)
      edgeTo.push(a.x, a.y, b.x, b.y)
      edgeOrder.push(order, order)
      edgeTone.push(l.tone ?? 0, l.tone ?? 0)
    }

    const edgeGeometry = new BufferGeometry()
    edgeGeometry.setAttribute('position', new Float32BufferAttribute(edgePos, 3))
    edgeGeometry.setAttribute('aTo', new Float32BufferAttribute(edgeTo, 2))
    edgeGeometry.setAttribute('aOrder', new Float32BufferAttribute(edgeOrder, 1))
    edgeGeometry.setAttribute('aTone', new Float32BufferAttribute(edgeTone, 1))
    geometries.push(edgeGeometry)

    const pulseLinks = links.filter((l) => l.pulse).slice(0, compact ? 3 : 6)
    const pulsePos: number[] = []
    const pulseTo: number[] = []
    const pulsePhase: number[] = []
    const pulseSpeed: number[] = []
    const pulseOrder: number[] = []

    pulseLinks.forEach((l, i) => {
      const a = byId.get(l.a)
      const b = byId.get(l.b)
      if (!a || !b) return
      pulsePos.push(a.x, a.y, 0)
      pulseTo.push(b.x, b.y)
      pulsePhase.push((i * 0.37) % 1)
      pulseSpeed.push(0.055 + (i % 3) * 0.022)
      pulseOrder.push(Math.max(a.order, b.order) + 0.02)
    })

    let pulseGeometry: BufferGeometry | null = null
    if (pulseLinks.length > 0) {
      pulseGeometry = new BufferGeometry()
      pulseGeometry.setAttribute('position', new Float32BufferAttribute(pulsePos, 3))
      pulseGeometry.setAttribute('aTo', new Float32BufferAttribute(pulseTo, 2))
      pulseGeometry.setAttribute('aPhase', new Float32BufferAttribute(pulsePhase, 1))
      pulseGeometry.setAttribute('aSpeed', new Float32BufferAttribute(pulseSpeed, 1))
      pulseGeometry.setAttribute('aOrder', new Float32BufferAttribute(pulseOrder, 1))
      geometries.push(pulseGeometry)
    }

    /* ---- materials ------------------------------------------------------ */
    // One uniform record shared by all three programs: a single write per frame.

    const uniforms = {
      uTime: { value: 0 },
      uReveal: { value: reduced ? 1 : 0 },
      uDepth: { value: 0 },
      uDpr: { value: renderer.getPixelRatio() },
      uPointer: { value: new Vector2(9, 9) },
      uRepel: { value: fine && !reduced ? 0.055 : 0 },
      uInk: { value: new Vector3(INK[0], INK[1], INK[2]) },
      uMark: { value: new Vector3(MARK[0], MARK[1], MARK[2]) },
      uOpacity: { value: 0.46 },
    }

    const shared = {
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }

    const lineMaterial = new ShaderMaterial({
      ...shared,
      vertexShader: LINE_VERT,
      fragmentShader: LINE_FRAG,
    })
    const nodeMaterial = new ShaderMaterial({
      ...shared,
      vertexShader: NODE_VERT,
      fragmentShader: NODE_FRAG,
    })
    materials.push(lineMaterial, nodeMaterial)

    const lines = new LineSegments(edgeGeometry, lineMaterial)
    lines.renderOrder = 0
    plot.add(lines)

    const nodes = new Points(nodeGeometry, nodeMaterial)
    nodes.renderOrder = 1
    plot.add(nodes)

    let pulses: Points | null = null
    if (pulseGeometry) {
      const pulseMaterial = new ShaderMaterial({
        ...shared,
        vertexShader: PULSE_VERT,
        fragmentShader: PULSE_FRAG,
      })
      materials.push(pulseMaterial)
      pulses = new Points(pulseGeometry, pulseMaterial)
      pulses.renderOrder = 2
      plot.add(pulses)
    }

    /* ---- viewport ------------------------------------------------------- */

    const bias = { x: 0, y: 0, scale: 1 }
    const view = { w: 1, h: 1 }
    let heroHeight = 1

    const resize = () => {
      const w = host.clientWidth || 1
      const h = host.clientHeight || 1
      const aspect = w / h
      const nextDpr = Math.min(window.devicePixelRatio || 1, 2)

      renderer.setPixelRatio(nextDpr)
      renderer.setSize(w, h, false)
      uniforms.uDpr.value = nextDpr

      if (aspect >= 1) {
        camera.left = -aspect
        camera.right = aspect
        camera.top = 1
        camera.bottom = -1
      } else {
        camera.left = -1
        camera.right = 1
        camera.top = 1 / aspect
        camera.bottom = -1 / aspect
      }
      camera.updateProjectionMatrix()

      // Wide screens: the plot sits to the right of the type, which occupies the
      // left half. Narrow screens: the type is full width, so the drawing moves
      // up behind the display face and drops to an underlay (see hero.css).
      const roomy = aspect > 1.15 && w > 980
      bias.x = roomy ? 0.76 : 0
      bias.y = roomy ? 0.12 : 0.55
      bias.scale = roomy ? 1.15 : 1.1

      view.w = w
      view.h = h
      heroHeight = h
    }

    /* ---- state ---------------------------------------------------------- */

    const state = {
      time: 0,
      elapsed: 0,
      reveal: 0,
      depth: 0,
      depthTarget: 0,
      clientX: 0,
      clientY: 0,
      targetX: 0,
      targetY: 0,
      smoothX: 0,
      smoothY: 0,
      pointerSeen: false,
      onScreen: true,
    }

    let raf = 0
    let running = false
    let last = 0

    const paint = () => {
      plot.position.x = bias.x + state.smoothX * 0.04
      plot.position.y = bias.y - state.smoothY * 0.04 + state.depth * 0.16
      plot.scale.setScalar(bias.scale * (1 + state.depth * 0.05))
    }

    const frame = (now: number) => {
      if (!running) return
      raf = requestAnimationFrame(frame)

      const dt = last === 0 ? 1 / 60 : Math.min((now - last) / 1000, 0.05)
      last = now

      state.time = (state.time + dt) % 1000
      state.elapsed += dt

      // Deterministic draw-in: hold, then a cubic ease to exactly 1.
      const raw = Math.max(0, (state.elapsed - 0.18) / 1.5)
      state.reveal = raw >= 1 ? 1 : 1 - Math.pow(1 - raw, 3)

      state.depth += (state.depthTarget - state.depth) * Math.min(1, dt * 5)

      // Pointer → plot space. Read from cached client coords so the conversion
      // happens once per frame rather than once per pointer event.
      if (state.pointerSeen) {
        const nx = (state.clientX / view.w) * 2 - 1
        const ny = 1 - (state.clientY / view.h) * 2
        state.targetX = nx * camera.right - bias.x
        state.targetY = ny * camera.top - bias.y
        const k = Math.min(1, dt * 3.4)
        state.smoothX += (state.targetX - state.smoothX) * k
        state.smoothY += (state.targetY - state.smoothY) * k
        uniforms.uPointer.value.set(state.smoothX, state.smoothY)
      }

      uniforms.uTime.value = state.time
      uniforms.uReveal.value = state.reveal
      uniforms.uDepth.value = state.depth

      paint()
      renderer.render(scene, camera)
    }

    const sync = () => {
      const want = state.onScreen && document.visibilityState === 'visible' && !reduced
      if (want && !running) {
        running = true
        last = 0
        raf = requestAnimationFrame(frame)
      } else if (!want && running) {
        running = false
        cancelAnimationFrame(raf)
      }
    }

    /* ---- listeners ------------------------------------------------------ */

    const onPointerMove = (event: PointerEvent) => {
      state.clientX = event.clientX
      state.clientY = event.clientY
      state.pointerSeen = true
    }

    const onScroll = () => {
      const scrolled = window.scrollY || window.pageYOffset || 0
      state.depthTarget = Math.min(1, Math.max(0, scrolled / Math.max(1, heroHeight)))
    }

    const onVisibility = () => sync()

    const onContextLost = (event: Event) => {
      // The context is gone: stop drawing and hand the hero back to its poster.
      // A half-rebuilt scene would be worse than no scene.
      event.preventDefault()
      running = false
      cancelAnimationFrame(raf)
      onUnavailable()
    }

    const observer = new IntersectionObserver(
      (entries) => {
        state.onScreen = entries[0]?.isIntersecting ?? false
        sync()
      },
      { rootMargin: '80px' },
    )
    observer.observe(host)

    const resizeObserver = new ResizeObserver(() => resize())

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })
    document.addEventListener('visibilitychange', onVisibility)
    canvas.addEventListener('webglcontextlost', onContextLost)

    resize()
    resizeObserver.observe(host)
    onScroll()

    /* ---- first frame ---------------------------------------------------- */

    if (reduced) {
      // Static poster state: fully drawn, no drift, no pointer reaction.
      state.reveal = 1
      uniforms.uReveal.value = 1
      paint()
      renderer.render(scene, camera)
      onReady()
    } else {
      // One frame before announcing readiness: the canvas is only faded in once
      // there is something in it, so the fallback sheet is never replaced by an
      // empty rectangle.
      paint()
      renderer.render(scene, camera)
      onReady()
      sync()
    }

    /* ---- teardown ------------------------------------------------------- */

    return () => {
      running = false
      cancelAnimationFrame(raf)

      observer.disconnect()
      resizeObserver.disconnect()

      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('scroll', onScroll)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('webglcontextlost', onContextLost)

      scene.clear()

      for (const geometry of geometries) geometry.dispose()
      for (const material of materials) material.dispose()
      renderer.dispose()

      if (canvas.parentNode === host) host.removeChild(canvas)
    }
  }, [onReady, onUnavailable])

  return <div className="hero-scene" ref={hostRef} aria-hidden="true" />
}

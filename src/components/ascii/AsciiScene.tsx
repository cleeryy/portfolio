import { useLayoutEffect, useRef } from 'react'
import {
  ClampToEdgeWrapping,
  DataTexture,
  DoubleSide,
  InstancedBufferGeometry,
  InstancedInterleavedBuffer,
  InterleavedBufferAttribute,
  LinearFilter,
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  RGBAFormat,
  Scene,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { buildPlate } from './plate'
import { ATLAS_HEIGHT, ATLAS_WIDTH, createAtlasTexture, drawAtlas } from './atlas'
import { CONTOUR, buildContourField } from './contour'
import { GLYPH } from './glyphs'

gsap.registerPlugin(ScrollTrigger)

/* ============================================================================
   AsciiScene — the schematic, printed in type
   ----------------------------------------------------------------------------
   One instanced quad per cell, one atlas texture, one draw call. Everything
   that moves is a vertex-shader decision on a uniform:

   - the **resolve** — `uResolve` runs 0 → 1 over 1.2s, and each cell flips from
     a hashed noise glyph to its target when the wave, which starts at the
     control point, reaches its `aOrder`;
   - the **contour** — the atmosphere's field is baked once into a small
     tangent/coverage texture and drifted by a uniform, so the engraving moves
     while the network stays;
   - the **scan** — the pointer's cell cluster re-picks its glyphs at 7 Hz, a
     cursor made of characters rather than a blob.

   The CPU computes only what is fixed: which glyph belongs to which cell, its
   printed level, whether it is crimson, and the order the wave reaches it. That
   table is the same one `composePre` prints as text.

   Discipline borrowed from `#territory`: one ticker (gsap's, never a second
   rAF), no allocation in the loop, DPR capped at 1.5, offscreen and hidden tabs
   stop the ticker, every GPU object is disposed, and a lost context hands the
   section back to the `<pre>` rather than to an empty rectangle.
   ========================================================================== */

type Props = {
  cols: number
  rows: number
  onReady: () => void
  onUnavailable: () => void
  onFocus: (id: string | null) => void
}

/** Raw sRGB, matching --ink and --mark exactly. */
const INK: [number, number, number] = [0x13 / 255, 0x1c / 255, 0x19 / 255]
const MARK: [number, number, number] = [0xbf / 255, 0x1f / 255, 0x34 / 255]

/** 1.5 device pixels per CSS pixel is enough for type; more is not detail. */
const MAX_DPR = 1.5

/** The resolve: the brief's ~1.2s, with the plotter's own settle. */
const RESOLVE_SECONDS = 1.2

/* --------------------------------------------------------------------------
   Shaders
   ------------------------------------------------------------------------ */

const VERT = /* glsl */ `
  precision highp float;

  attribute vec2 aCell;
  attribute float aGlyph;
  attribute float aLevel;
  attribute float aMark;
  attribute float aOrder;
  attribute float aHalo;

  uniform vec2 uGrid;
  uniform float uResolve;
  uniform float uTime;
  uniform vec2 uPointer;
  uniform float uScan;

  uniform sampler2D uField;
  uniform vec2 uDrift;

  varying vec2 vUv;
  varying float vGlyph;
  varying float vLevel;
  varying float vMark;

  const float ASC_PI = 3.141592653589793;

  // The character-level hash: the resolve noise and the scan's churn. The
  // contour field no longer needs it — that is baked into a texture.
  float ascHash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  void main() {
    vec2 cellUv = aCell / uGrid;
    vec2 cellSize = 1.0 / uGrid;

    float glyph = aGlyph;
    float level = aLevel;

    // A cell the network left blank belongs to the contour field. The field is
    // baked once (see contour.ts) and drifted by a uniform: one texture read,
    // not twenty-eight noise evaluations per instance. The halo attribute keeps
    // one cell of clean paper around every link and mark.
    if (glyph < 0.0 && aHalo < 0.5) {
      vec4 field = texture2D(uField, cellUv + uDrift);
      float coverage = field.b;

      if (coverage < ${CONTOUR.contourLow}) {
        glyph = -1.0;
        level = 0.0;
      } else if (coverage < ${CONTOUR.stippleBelow}) {
        glyph = ${GLYPH.quote}.0;
        level = ${CONTOUR.alphaStipple};
      } else {
        // The tangent is the contour's own direction: the mark runs along the
        // line, so the field reads as an engraving and not as dust.
        vec2 tangent = field.rg * 2.0 - 1.0;
        float angle = atan(tangent.y, tangent.x);
        if (angle < 0.0) angle += ASC_PI;
        if (angle >= ASC_PI) angle -= ASC_PI;

        float eighth = ASC_PI / 8.0;
        glyph =
          (angle < eighth || angle >= ASC_PI - eighth) ? ${GLYPH.dash}.0 :
          angle < 3.0 * eighth ? ${GLYPH.backslash}.0 :
          angle < 5.0 * eighth ? ${GLYPH.bar}.0 : ${GLYPH.slash}.0;

        level = ${CONTOUR.alphaLine};
      }
    }

    // The resolve: noise until the wave from the control point reaches the
    // cell, then the drawing. A hard flip, because a character cannot fade.
    float seed = ascHash12(aCell + vec2(9.7, 3.1));
    float noiseGlyph = floor(ascHash12(aCell + vec2(1.3, 7.7)) * 12.0);
    float noiseLevel = 0.2 + 0.24 * seed;
    float settled = step(aOrder, uResolve);
    glyph = settled > 0.5 ? glyph : noiseGlyph;
    level = settled > 0.5 ? level : noiseLevel;

    // The scan: the cells the pointer passes re-pick their glyphs. The seed is
    // quantised to ~7 swaps a second, so the cluster churns like a cursor.
    if (uScan > 0.001) {
      float reach = 1.0 - smoothstep(1.4, 4.2, distance(aCell, uPointer));
      float swap = reach * uScan;
      if (swap > 0.001) {
        float pick = ascHash12(aCell * 1.7 + vec2(floor(uTime * 7.0) * 13.0, 0.0));
        if (pick < swap) {
          float scanGlyph =
            pick < 0.17 ? 10.0 :
            pick < 0.34 ? 5.0 :
            pick < 0.50 ? 7.0 :
            pick < 0.66 ? 6.0 :
            pick < 0.83 ? 0.0 : 8.0;
          glyph = scanGlyph;
          level = max(level, 0.82);
        }
      }
    }

    vGlyph = glyph;
    vLevel = level;
    vMark = aMark;
    vUv = position.xy + 0.5;

    vec2 p = cellUv + position.xy * cellSize;
    gl_Position = vec4(p.x * 2.0 - 1.0, 1.0 - p.y * 2.0, 0.0, 1.0);
  }
`

const FRAG = /* glsl */ `
  precision highp float;

  uniform sampler2D uAtlas;
  uniform vec3 uInk;
  uniform vec3 uMark;

  varying vec2 vUv;
  varying float vGlyph;
  varying float vLevel;
  varying float vMark;

  void main() {
    if (vGlyph < 0.0 || vLevel < 0.002) discard;

    float col = mod(vGlyph, 4.0);
    float row = floor(vGlyph / 4.0);

    // 2% inset per cell: a mip level can never read the neighbouring glyph.
    vec2 local = vec2(0.02) + vUv * 0.96;
    vec2 uv = vec2((col + local.x) / 4.0, 1.0 - (row + local.y) / 3.0);

    float ink = texture2D(uAtlas, uv).a;
    if (ink < 0.02) discard;

    vec3 color = vMark > 0.5 ? uMark : uInk;
    gl_FragColor = vec4(color, ink * vLevel);
  }
`

/* --------------------------------------------------------------------------
   The component
   ------------------------------------------------------------------------ */

export default function AsciiScene({ cols, rows, onReady, onUnavailable, onFocus }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  // Callbacks travel through a ref: a hover must not rebuild the renderer, and
  // a language switch must not either.
  const latest = useRef({ onReady, onUnavailable, onFocus })
  useLayoutEffect(() => {
    latest.current = { onReady, onUnavailable, onFocus }
  })

  useLayoutEffect(() => {
    const host = hostRef.current
    if (!host) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const fine = window.matchMedia('(pointer: fine)').matches

    let renderer: WebGLRenderer
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: false })
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR))

    const canvas = renderer.domElement
    canvas.className = 'asc__canvas'
    host.appendChild(canvas)

    const scene = new Scene()
    // The vertex shader writes clip space directly; the camera exists because
    // three's renderer asks for one.
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1)

    /* ---- the fixed drawing ---------------------------------------------- */

    const plate = buildPlate(cols, rows)
    const count = cols * rows

    const base = new PlaneGeometry(1, 1)
    const geometry = new InstancedBufferGeometry()
    geometry.index = base.index
    geometry.setAttribute('position', base.getAttribute('position'))

    const buffer = new InstancedInterleavedBuffer(plate.data, 7)
    geometry.setAttribute('aCell', new InterleavedBufferAttribute(buffer, 2, 0))
    geometry.setAttribute('aGlyph', new InterleavedBufferAttribute(buffer, 1, 2))
    geometry.setAttribute('aLevel', new InterleavedBufferAttribute(buffer, 1, 3))
    geometry.setAttribute('aMark', new InterleavedBufferAttribute(buffer, 1, 4))
    geometry.setAttribute('aOrder', new InterleavedBufferAttribute(buffer, 1, 5))
    geometry.setAttribute('aHalo', new InterleavedBufferAttribute(buffer, 1, 6))
    geometry.instanceCount = count

    /* ---- the atlas ------------------------------------------------------ */

    const atlasCanvas = document.createElement('canvas')
    atlasCanvas.width = ATLAS_WIDTH
    atlasCanvas.height = ATLAS_HEIGHT
    const ctx = atlasCanvas.getContext('2d')

    if (!ctx) {
      base.dispose()
      geometry.dispose()
      renderer.dispose()
      if (canvas.parentNode === host) host.removeChild(canvas)
      latest.current.onUnavailable()
      return
    }

    drawAtlas(ctx)
    const texture = createAtlasTexture(atlasCanvas)

    /* ---- the contour field, baked once -------------------------------- */

    const contour = buildContourField(cols, rows)
    const fieldTexture = new DataTexture(
      contour.data,
      contour.width,
      contour.height,
      RGBAFormat,
      UnsignedByteType,
    )
    fieldTexture.minFilter = LinearFilter
    fieldTexture.magFilter = LinearFilter
    fieldTexture.wrapS = ClampToEdgeWrapping
    fieldTexture.wrapT = ClampToEdgeWrapping
    fieldTexture.needsUpdate = true

    /* ---- the material --------------------------------------------------- */

    const uniforms = {
      uAtlas: { value: texture },
      uField: { value: fieldTexture },
      uDrift: { value: new Vector2(0, 0) },
      uGrid: { value: new Vector2(cols, rows) },
      uInk: { value: new Vector3(INK[0], INK[1], INK[2]) },
      uMark: { value: new Vector3(MARK[0], MARK[1], MARK[2]) },
      uResolve: { value: reduced ? 1 : 0 },
      uTime: { value: 0 },
      uPointer: { value: new Vector2(-20, -20) },
      uScan: { value: 0 },
    }

    const material = new ShaderMaterial({
      uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      // The vertex shader flips y to put the cell origin at the top left; that
      // reverses the plane's winding, so the quad is not a front face anymore.
      side: DoubleSide,
    })

    const mesh = new Mesh(geometry, material)
    mesh.frustumCulled = false
    scene.add(mesh)

    /* ---- state ---------------------------------------------------------- */

    const state = {
      time: 0,
      /** Pointer in cell coordinates. */
      px: -20,
      py: -20,
      inside: false,
      scan: 0,
      parity: 0,
      focus: null as string | null,
      onScreen: false,
      pointerType: 'mouse',
      downX: 0,
      downY: 0,
    }

    let tickerOn = false
    let disposed = false

    /* ---- draw ----------------------------------------------------------- */

    const draw = () => {
      uniforms.uTime.value = state.time
      uniforms.uDrift.value.set(
        Math.sin(state.time * CONTOUR.driftRateX) * CONTOUR.driftAmpX,
        Math.cos(state.time * CONTOUR.driftRateY) * CONTOUR.driftAmpY,
      )
      uniforms.uPointer.value.set(state.px, state.py)
      uniforms.uScan.value = state.scan
      renderer.render(scene, camera)
    }

    const drawOnce = () => draw()

    const tick = (_time: number, deltaMs: number) => {
      const dt = Math.min(Math.max(deltaMs, 0) / 1000, 0.05)
      state.time += dt

      const target = state.inside && fine && !reduced ? 1 : 0
      state.scan += (target - state.scan) * Math.min(1, dt * 11)
      if (Math.abs(target - state.scan) < 0.002) state.scan = target

      // The contour drift is a texture, not an instrument: while nothing is
      // being resolved or scanned, every second frame is enough.
      const idle = state.scan === 0 && uniforms.uResolve.value >= 1
      state.parity ^= 1
      if (idle && state.parity === 0) return

      draw()
    }

    /* ---- pointer -------------------------------------------------------- */

    const hitTest = (px: number, py: number, radius: number): string | null => {
      let best: string | null = null
      let bestDistance = radius * radius

      for (const mark of plate.marks) {
        const dx = mark.x - px
        const dy = mark.y - py
        const distance = dx * dx + dy * dy
        if (distance < bestDistance) {
          bestDistance = distance
          best = mark.id
        }
      }

      return best
    }

    const cellOf = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const width = rect.width || 1
      const height = rect.height || 1
      return {
        x: ((event.clientX - rect.left) / width) * cols,
        y: ((event.clientY - rect.top) / height) * rows,
      }
    }

    const setFocus = (id: string | null) => {
      if (id === state.focus) return
      state.focus = id
      latest.current.onFocus(id)
    }

    const onPointerMove = (event: PointerEvent) => {
      state.pointerType = event.pointerType || 'mouse'
      const cell = cellOf(event)
      state.px = cell.x
      state.py = cell.y
      state.inside = true

      // A touch has no hover: the readout is the tap's answer, not the drag's.
      if (state.pointerType === 'touch') return

      const radius = 4.2
      setFocus(hitTest(cell.x, cell.y, radius))
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return
      state.downX = event.clientX
      state.downY = event.clientY
      const cell = cellOf(event)
      state.px = cell.x
      state.py = cell.y
      state.inside = true
    }

    const onPointerUp = (event: PointerEvent) => {
      const moved = Math.hypot(event.clientX - state.downX, event.clientY - state.downY)
      if (moved > 8) return

      const cell = cellOf(event)
      if (event.pointerType === 'touch') {
        const hit = hitTest(cell.x, cell.y, 6.5)
        setFocus(hit && hit === state.focus ? null : hit)
        if (hit) state.inside = true
      }
    }

    const onPointerLeave = () => {
      state.inside = false
      // A phone's pointer leaves as soon as the tap ends; the reading is the
      // answer to that tap and has to stay on the sheet.
      if (state.pointerType === 'touch') return
      setFocus(null)
    }

    const onPointerEnter = (event: PointerEvent) => {
      state.pointerType = event.pointerType || 'mouse'
    }

    /* ---- lifecycle ------------------------------------------------------ */

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

    const resize = () => {
      const width = host.clientWidth || 1
      const height = host.clientHeight || 1
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, MAX_DPR))
      renderer.setSize(width, height, false)
      if (reduced) drawOnce()
    }

    resize()
    drawOnce()

    // A shader that failed to compile leaves a transparent canvas. One check
    // after the first real draw, then hand the section back to the text — and
    // release the context now, because the parent unmounts this scene.
    const gl = renderer.getContext()
    if (gl.getError() !== gl.NO_ERROR) {
      scene.clear()
      geometry.dispose()
      base.dispose()
      material.dispose()
      texture.dispose()
      fieldTexture.dispose()
      renderer.dispose()
      if (canvas.parentNode === host) host.removeChild(canvas)
      latest.current.onUnavailable()
      return
    }

    canvas.dataset.cells = String(count)
    canvas.dataset.calls = String(renderer.info.render.calls)

    const observer = new IntersectionObserver(
      (entries) => {
        state.onScreen = entries[0]?.isIntersecting ?? false
        sync()
      },
      { rootMargin: '120px' },
    )
    observer.observe(host)

    const resizeObserver = new ResizeObserver(() => resize())
    resizeObserver.observe(host)

    const onVisibility = () => sync()

    const onContextLost = (event: Event) => {
      event.preventDefault()
      if (tickerOn) {
        gsap.ticker.remove(tick)
        tickerOn = false
      }
      latest.current.onUnavailable()
    }

    canvas.addEventListener('pointermove', onPointerMove, { passive: true })
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)
    canvas.addEventListener('pointerenter', onPointerEnter)
    canvas.addEventListener('pointerleave', onPointerLeave)
    canvas.addEventListener('webglcontextlost', onContextLost)
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('resize', resize)

    /* ---- the resolve ---------------------------------------------------- */

    let tween: gsap.core.Tween | null = null
    let trigger: ScrollTrigger | null = null

    const play = () => {
      if (reduced) return
      tween?.kill()
      tween = gsap.to(uniforms.uResolve, {
        value: 1,
        duration: RESOLVE_SECONDS,
        ease: 'power2.out',
      })
    }

    const reset = () => {
      if (reduced) return
      tween?.kill()
      tween = null
      uniforms.uResolve.value = 0
    }

    if (!reduced) {
      // The resolve starts as the plate's top edge enters the reading band, so
      // a reader who stops with the plate half in view sees the schematic, not
      // a field of noise waiting for the centre of the screen.
      trigger = ScrollTrigger.create({
        trigger: host,
        start: 'top 82%',
        onEnter: play,
        onLeaveBack: reset,
      })

      // A reload or a deep link can land with the plate already in view; the
      // trigger would not fire until the reader scrolls away and back.
      if (host.getBoundingClientRect().top < window.innerHeight * 0.82) play()
    }

    latest.current.onReady()
    sync()

    /* ---- webfonts ------------------------------------------------------- */

    const fonts = typeof document.fonts !== 'undefined' ? document.fonts.ready : null
    fonts
      ?.then(() => {
        if (disposed) return
        drawAtlas(ctx)
        texture.needsUpdate = true
        drawOnce()
      })
      .catch(() => {
        /* the fallback stack is already drawn */
      })

    /* ---- teardown ------------------------------------------------------- */

    return () => {
      disposed = true

      if (tickerOn) {
        gsap.ticker.remove(tick)
        tickerOn = false
      }

      observer.disconnect()
      resizeObserver.disconnect()
      trigger?.kill()
      tween?.kill()

      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
      canvas.removeEventListener('pointerenter', onPointerEnter)
      canvas.removeEventListener('pointerleave', onPointerLeave)
      canvas.removeEventListener('webglcontextlost', onContextLost)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('resize', resize)

      scene.clear()
      geometry.dispose()
      base.dispose()
      material.dispose()
      texture.dispose()
      fieldTexture.dispose()
      renderer.dispose()

      if (canvas.parentNode === host) host.removeChild(canvas)
    }
  }, [cols, rows])

  return <div className="asc-scene" ref={hostRef} aria-hidden="true" />
}

import { useEffect, useRef } from 'react'
import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  LineSegments,
  PerspectiveCamera,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
} from 'three'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  RELIEF_BOX,
  RELIEF_DRIFT,
  RELIEF_SWEEP,
  RELIEF_TILT,
  buildReliefGeometry,
  getReliefModel,
} from './reliefField'

gsap.registerPlugin(ScrollTrigger)

/* ============================================================================
   ReliefScene — the solid, turned
   ----------------------------------------------------------------------------
   One renderer, one buffer, one draw call. The object is a single LineSegments
   mesh: top faces, bottom faces and cut edges are all in the same position
   array, so there is nothing to sort, nothing to instance, and nothing to
   allocate in the frame loop. A frame writes four numbers — spin, tilt, the
   idle sway and (on resize) the depth window — and calls render.

   **The frame is fitted on the union of the move, not on the pose at rest.**
   The section asks the solid to turn 40° as it crosses the viewport and to lean
   ±6° with the pointer. A camera solved at rest would let the near corner swing
   into the trim at one end of the turn, which is the classic way a fitted
   drawing clips. So the fit projects the object's eight bounding corners at
   fifteen poses — five spins, three tilts — and backs off until every one of
   them lands inside the target box. It also centres by measurement: the target
   box is the right two thirds of the plate, not the middle of it.

   **The far side is printed, not shaded.** Depth is a varying worked out in
   the vertex shader from view-space z: past the middle of the object the ink
   starts to break through the same 8 × 8 Bayer screen the atmosphere prints
   with, on cells that grow from one device pixel to two. Near contours are
   continuous hairlines; far ones dissolve into a coarser dot chain. No fill, no
   shading, no glow — a line drawing that recedes the way a printed sheet does.

   **Nothing runs when nobody is looking.** The ticker is added on an
   IntersectionObserver and removed on `visibilitychange`; the model is not even
   built until the section is within 700px of the viewport, so a visitor reading
   the hero never pays for a terrain they may never reach.

   Reduced motion: one frame, a three-quarter angle, no pointer coupling, no
   idle drift, no ticker.
   ========================================================================== */

const CAM_FOV = 30
const TAN_HALF_FOV = Math.tan((CAM_FOV * Math.PI) / 360)
const CAM_AZ = 0.52
/* A portrait frame is nearly square, and the island is not: seen from a desk's
   26°, a 3.2-wide solid leaves a third of a phone's band empty. So the phone
   looks down on it a little harder — the same object, composed for the frame it
   is printed in, with more of the contour legible at 390px. */
const CAM_EL_FINE = 0.46
const CAM_EL_COARSE = 0.7

/** Spin and tilt poses the frame is solved against. Five is already generous. */
const SPIN_STEPS = 5
const TILTS = [-1, 0, 1]

/** Damped chases: the object has mass, the scrollbar does not. */
const SPIN_EASE = 3.1
const TILT_EASE = 5.4
const DRIFT_RATE = 0.085

const MAX_DPR_FINE = 2
const MAX_DPR_COARSE = 1.6

/* Raw sRGB, matching --ink and --mark. Custom ShaderMaterial writing straight
   to the framebuffer, exactly as the hero, the territory and the passage do, so
   the WebGL ink matches the CSS ink to the byte. */
const INK: [number, number, number] = [0x13 / 255, 0x1c / 255, 0x19 / 255]
const MARK: [number, number, number] = [0xbf / 255, 0x1f / 255, 0x34 / 255]

/* --------------------------------------------------------------------------
   Shaders
   ------------------------------------------------------------------------ */

const VERT = /* glsl */ `
  attribute float aWeight;
  attribute float aCrime;

  uniform vec2 uDepth;

  varying float vWeight;
  varying float vCrime;
  varying float vFar;

  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);

    // The object turns, so depth cannot be baked into a vertex attribute: it is
    // read from the view matrix, every frame, for free.
    vFar = smoothstep(uDepth.x, uDepth.y, -mv.z);

    vWeight = aWeight;
    vCrime = aCrime;

    gl_Position = projectionMatrix * mv;
  }
`

const FRAG = /* glsl */ `
  precision highp float;

  uniform vec3 uInk;
  uniform vec3 uMark;
  uniform float uBreak;

  varying float vWeight;
  varying float vCrime;
  varying float vFar;

  /* The atmosphere's screen, verbatim: 8 × 8, the recursive construction, on
     device pixels. Two drawings, one halftone. */
  float bayerSeed(vec2 a) {
    return mod(2.0 * a.x + 3.0 * a.y, 4.0);
  }

  float bayer8(vec2 fragCoord) {
    vec2 p = floor(fragCoord);
    float lo = bayerSeed(mod(p, 2.0));
    float mid = bayerSeed(mod(floor(p * 0.5), 2.0));
    float hi = bayerSeed(mod(floor(p * 0.25), 2.0));
    return (16.0 * lo + 4.0 * mid + hi) / 64.0;
  }

  void main() {
    if (vCrime > 0.5) {
      gl_FragColor = vec4(uMark, 1.0);
      return;
    }

    float far = clamp(vFar, 0.0, 1.0);

    // The cell grows with distance — one device pixel in front, two behind — so
    // the far face is *coarser*, not merely fainter. The screen can only remove
    // ink, so the drawing never becomes denser than it was drawn.
    float cell = 1.0 + step(0.42, far);
    float b = bayer8(floor(gl_FragCoord.xy / cell));

    float keep = mix(1.0, 0.5, smoothstep(0.3, 1.0, far) * uBreak);
    if (b > keep) discard;

    gl_FragColor = vec4(uInk, vWeight * mix(0.92, 0.7, far));
  }
`

/* --------------------------------------------------------------------------
   The scene
   ------------------------------------------------------------------------ */

type Props = {
  /** Ten levels and a lower DPR on a phone; twenty and 2 on a desk. */
  coarse: boolean
  onReady: () => void
  onUnavailable: () => void
}

export default function ReliefScene({ coarse, onReady, onUnavailable }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  // Callbacks travel through a ref: a parent render (a language switch) must
  // never tear the renderer down.
  const latest = useRef({ onReady, onUnavailable })
  useEffect(() => {
    latest.current = { onReady, onUnavailable }
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const box = coarse ? RELIEF_BOX.coarse : RELIEF_BOX.fine
    const camEl = coarse ? CAM_EL_COARSE : CAM_EL_FINE
    const maxDpr = coarse ? MAX_DPR_COARSE : MAX_DPR_FINE

    let disposed = false
    let started = false
    let lost = false
    let stop: (() => void) | null = null

    /* ---- state --------------------------------------------------------- */

    const state = {
      /** Scroll progress of the pass, 0..1, from the section's own trigger. */
      pass: 0.5,
      /** Eased spin and tilt: the object follows, it does not latch. */
      spin: 0,
      tilt: 0,
      tiltY: 0,
      elapsed: 0,
      onScreen: false,
      first: true,
    }

    let tickerOn = false

    /* ---- build --------------------------------------------------------- */

    const build = () => {
      if (started || disposed) return
      started = true

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

      const model = getReliefModel(coarse)
      const geometry = buildReliefGeometry(model)

      const scene = new Scene()
      const solid = new Group()
      scene.add(solid)

      const camera = new PerspectiveCamera(CAM_FOV, 1, 0.5, 120)

      // One buffer: every plate's top face, bottom face and cut edges.
      const buffer = new BufferGeometry()
      buffer.setAttribute('position', new Float32BufferAttribute(geometry.positions, 3))
      buffer.setAttribute('aWeight', new Float32BufferAttribute(geometry.weights, 1))
      buffer.setAttribute('aCrime', new Float32BufferAttribute(geometry.crimes, 1))

      const uniforms = {
        uInk: { value: new Vector3(INK[0], INK[1], INK[2]) },
        uMark: { value: new Vector3(MARK[0], MARK[1], MARK[2]) },
        uDepth: { value: new Vector2(6, 9) },
        uBreak: { value: 1 },
      }

      const material = new ShaderMaterial({
        uniforms,
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthTest: false,
        depthWrite: false,
      })

      const mesh = new LineSegments(buffer, material)
      // The object is a wireframe: every line prints, nothing hides another.
      // Its bounds are known and inside the frame, so culling is left on.
      solid.add(mesh)

      const canvas = renderer.domElement
      canvas.className = 'rlf__canvas'
      canvas.setAttribute('aria-hidden', 'true')
      host.appendChild(canvas)

      /* ---- the frame -------------------------------------------------- */

      // The fit points are the island's plan outline extruded from the sheet to
      // the top of the solid: every vertex of every plate is inside that prism,
      // and unlike a bounding box it does not reserve the four corners of a
      // rectangle the drawing never visits.
      const hullCount = model.hull.length / 2
      const fitCount = hullCount * 2
      const fitCorners = new Float32Array(fitCount * 3)
      for (let i = 0; i < hullCount; i++) {
        for (let level = 0; level < 2; level++) {
          const at = (i * 2 + level) * 3
          fitCorners[at] = model.hull[i * 2]
          fitCorners[at + 1] = level === 0 ? 0 : model.hullTop
          fitCorners[at + 2] = model.hull[i * 2 + 1]
        }
      }

      const scratch = new Vector3()
      const target = new Vector3()
      const extent = { minX: 0, maxX: 0, minY: 0, maxY: 0 }

      const placeCamera = (dist: number, lookX: number, lookY: number) => {
        const cos = Math.cos(camEl)
        const rightX = Math.cos(CAM_AZ)
        const rightZ = -Math.sin(CAM_AZ)

        camera.position.set(
          dist * cos * Math.sin(CAM_AZ) + lookX * rightX,
          lookY + dist * Math.sin(camEl),
          dist * cos * Math.cos(CAM_AZ) + lookX * rightZ,
        )
        target.set(lookX * rightX, lookY, lookX * rightZ)
        camera.lookAt(target)
        camera.updateMatrixWorld()
      }

      /** Projected bounds of the eight corners, over every pose of the move. */
      const measure = (dist: number, lookX: number, lookY: number) => {
        extent.minX = Infinity
        extent.maxX = -Infinity
        extent.minY = Infinity
        extent.maxY = -Infinity

        for (let s = 0; s < SPIN_STEPS; s++) {
          const span = RELIEF_SWEEP + RELIEF_DRIFT * 2
          const spin = -RELIEF_SWEEP / 2 - RELIEF_DRIFT + (s / (SPIN_STEPS - 1)) * span
          for (const tilt of TILTS) {
            solid.rotation.set(tilt * RELIEF_TILT, spin, 0)
            solid.updateMatrixWorld(true)
            placeCamera(dist, lookX, lookY)

            for (let i = 0; i < fitCount; i++) {
              scratch
                .set(fitCorners[i * 3], fitCorners[i * 3 + 1], fitCorners[i * 3 + 2])
                .applyMatrix4(solid.matrixWorld)
                .project(camera)
              if (scratch.x < extent.minX) extent.minX = scratch.x
              if (scratch.x > extent.maxX) extent.maxX = scratch.x
              if (scratch.y < extent.minY) extent.minY = scratch.y
              if (scratch.y > extent.maxY) extent.maxY = scratch.y
            }
          }
        }
      }

      let homeDist = 8
      let homeLookX = 0
      let homeLookY = 0.5

      const frame = () => {
        let dist = homeDist
        let lookX = homeLookX
        let lookY = homeLookY
        const cx = (box.x0 + box.x1) / 2
        const cy = (box.y0 + box.y1) / 2

        // Distance and aim are solved together: back off until the move fits
        // the box, then translate until it is centred in it. Seven passes is
        // two more than the projection needs to settle.
        for (let pass = 0; pass < 7; pass++) {
          measure(dist, lookX, lookY)

          const kx = (extent.maxX - extent.minX) / (box.x1 - box.x0)
          const ky = (extent.maxY - extent.minY) / (box.y1 - box.y0)
          dist *= Math.min(3, Math.max(0.4, Math.max(kx, ky)))

          const midX = (extent.maxX + extent.minX) / 2
          const midY = (extent.maxY + extent.minY) / 2
          lookX += (midX - cx) * dist * TAN_HALF_FOV * camera.aspect
          lookY += ((midY - cy) * dist * TAN_HALF_FOV) / Math.cos(camEl)
        }

        homeDist = dist
        homeLookX = lookX
        homeLookY = lookY

        // The depth window follows the fitted distance: the dissolve starts a
        // little in front of the middle of the object and is complete behind it.
        uniforms.uDepth.value.set(dist - 0.55, dist + 1.5)

        placeCamera(homeDist, homeLookX, homeLookY)
        solid.rotation.set(0, state.spin, 0)
        solid.updateMatrixWorld(true)
      }

      /* ---- draw -------------------------------------------------------- */

      const draw = (dt: number) => {
        const targetSpin = reduced ? RELIEF_SWEEP * 0.14 : (state.pass - 0.5) * RELIEF_SWEEP

        if (state.first) {
          state.spin = targetSpin
          state.tilt = 0
          state.first = false
        } else {
          state.spin += (targetSpin - state.spin) * (1 - Math.exp(-dt * SPIN_EASE))
        }

        const tiltTarget = reduced ? 0 : -state.tiltY * RELIEF_TILT
        state.tilt += (tiltTarget - state.tilt) * (1 - Math.exp(-dt * TILT_EASE))

        if (!reduced) state.elapsed += dt
        const drift = reduced ? 0 : Math.sin(state.elapsed * DRIFT_RATE) * RELIEF_DRIFT

        // Two numbers and one draw call. No matrix is composed per frame — the
        // group's Euler is written in place and the camera never moves.
        solid.rotation.set(state.tilt, state.spin + drift, 0)
        renderer.render(scene, camera)
      }

      const drawOnce = () => {
        state.first = true
        draw(0)
      }

      /* ---- viewport ---------------------------------------------------- */

      const resize = () => {
        const w = host.clientWidth || 1
        const h = host.clientHeight || 1

        const dpr = Math.min(window.devicePixelRatio || 1, maxDpr)
        renderer.setPixelRatio(dpr)
        renderer.setSize(w, h, false)

        camera.aspect = w / h
        camera.updateProjectionMatrix()

        state.first = true
        frame()
        if (reduced) drawOnce()
      }

      /* ---- lifecycle --------------------------------------------------- */

      const tick = (_time: number, deltaMs: number) => {
        draw(Math.min(Math.max(deltaMs, 0) / 1000, 0.05))
      }

      const sync = () => {
        const want =
          !reduced && !lost && state.onScreen && document.visibilityState === 'visible'
        if (want && !tickerOn) {
          state.first = true
          tickerOn = true
          gsap.ticker.add(tick)
        } else if (!want && tickerOn) {
          tickerOn = false
          gsap.ticker.remove(tick)
        }
      }

      const visibility = new IntersectionObserver(
        (entries) => {
          state.onScreen = entries[0]?.isIntersecting ?? false
          sync()
        },
        { rootMargin: '120px' },
      )
      visibility.observe(host)

      const resizeObserver = new ResizeObserver(() => resize())
      resizeObserver.observe(host)

      const onVisibility = () => sync()

      const onPointerMove = (event: PointerEvent) => {
        if (event.pointerType === 'touch') return
        // The pointer's height in the viewport, −1..1. Its x is deliberately
        // unused: a yaw that followed the pointer as well would fight the turn.
        state.tiltY = (event.clientY / window.innerHeight) * 2 - 1
      }

      const onPointerLeave = () => {
        state.tiltY = 0
      }

      const onContextLost = (event: Event) => {
        event.preventDefault()
        lost = true
        sync()
        latest.current.onUnavailable()
      }

      // The turn follows the section's own pass, not the page's scrollbar: the
      // solid is at its rest angle when the plate is centred.
      const trigger = reduced
        ? null
        : ScrollTrigger.create({
            trigger: host,
            // The object turns over the window the reader actually watches —
            // the plate crossing the middle of the viewport — not over its full
            // transit: tied to the transit, most of the sweep would happen while
            // the section is off screen.
            start: 'center 78%',
            end: 'center 22%',
            onUpdate: (self) => {
              state.pass = self.progress
            },
            onRefresh: (self) => {
              state.pass = self.progress
            },
          })

      if (trigger) state.pass = trigger.progress

      window.addEventListener('pointermove', onPointerMove, { passive: true })
      document.addEventListener('pointerleave', onPointerLeave)
      document.addEventListener('visibilitychange', onVisibility)
      canvas.addEventListener('webglcontextlost', onContextLost)

      resize()

      if (reduced) {
        state.spin = RELIEF_SWEEP * 0.14
        drawOnce()
      }

      latest.current.onReady()
      sync()

      stop = () => {
        if (tickerOn) {
          gsap.ticker.remove(tick)
          tickerOn = false
        }

        visibility.disconnect()
        resizeObserver.disconnect()
        trigger?.kill()

        window.removeEventListener('pointermove', onPointerMove)
        document.removeEventListener('pointerleave', onPointerLeave)
        document.removeEventListener('visibilitychange', onVisibility)
        canvas.removeEventListener('webglcontextlost', onContextLost)

        scene.clear()
        buffer.dispose()
        material.dispose()
        renderer.dispose()

        if (canvas.parentNode === host) host.removeChild(canvas)
      }
    }

    /* ---- approach ------------------------------------------------------ */

    // The terrain is built when the section is within 700px of the viewport. A
    // visitor who never scrolls this far never pays for it, and the build is
    // off the boot path — the hero's first second stays clean.
    const approach = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return
        approach.disconnect()
        build()
      },
      { rootMargin: '700px 0px' },
    )
    approach.observe(host)

    return () => {
      disposed = true
      approach.disconnect()
      stop?.()
      stop = null
    }
  }, [coarse])

  return <div className="rlf__stage" ref={hostRef} aria-hidden="true" />
}

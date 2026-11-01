import { useEffect, useRef } from 'react'
import {
  DynamicDrawUsage,
  Euler,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  Vector4,
  WebGLRenderer,
  type Texture,
} from 'three'
import { gsap } from 'gsap'
import { flightLabels } from '../../content/flight'
import { ATLAS_SIZE, createAtlasTexture, drawAtlas } from './atlas'
import { clamp01, handoff } from './curve'
import { FLIGHT_FRAG, FLIGHT_VERT } from './shaders'

/* ============================================================================
   FlightScene — the field, and the eye that crosses it
   ----------------------------------------------------------------------------
   One renderer, one instanced mesh, one texture, one draw call. Nothing is
   allocated in the frame loop: the camera writes a position and a roll, the
   hand-off writes two uniforms, and matrices are touched only when a generation
   is recycled — never for a plate that is merely on screen.

   **The field is a helix, not a scatter.** Random lanes plus random depths give
   a starfield: two labels land on the same screen point and the drawing reads
   as a bug. So the plates are placed on a ring of stations around the camera
   axis — each generation one ring, its stations staggered through the
   generation's depth slab, the whole field twisted by its z. Two plates are
   then never closer than a station's angle around the axis or a generation
   apart along it, which is the distance at which a 150px plate and a 100px
   plate stop touching.

   **The band repeats in six generations.** The eye travels −z; when a slab's
   last plate passes the camera the whole slab is pushed a full field forward,
   and when the eye backs up past a slab it is pulled back the same distance.
   Both directions are covered, so scrubbing the track either way never opens a
   hole in the tunnel — which a one-way recycle does, and which is the classic
   way this effect breaks on a scroll that is not a video.

   **The phone gets a shorter field and larger type, not a thinner one.**
   Twenty-four plates in a 76-unit band leave a portrait frame almost empty: at
   any instant only three are near enough to read. The field is therefore 40
   units long on a coarse pointer and 76 on a desk, the far dissolve is a
   uniform, and the face is set a third larger — so the number of plates a
   reader can actually read is the same on both.

   Depth is the shader's job (see shaders.ts): near plates dissolve past the
   lens, far plates break into the sheet's ordered screen, and the hand-off
   takes the ink back to the plate colour.
   ========================================================================== */

/** Slabs per field. Six keeps the generations a readable beat apart. */
const GEN_COUNT = 6

/**
 * Plate height at scale 1, in drawing units. Heights are absolute, so this one
 * number decides how far down the passage a label stays legible: at 0.62 the
 * face is ~18px at depth 10 and ~9px at depth 20 on a 900px frame — the band a
 * reader can actually read is twenty units deep, which is what makes the field
 * a passage instead of a starfield.
 */
const BASE_H_FINE = 0.62
/** The same plate, a third larger: a 390px frame needs the type closer. */
const BASE_H_COARSE = 0.86

/** The ring. Eleven stations on a flattened circle, radii alternating. */
const STATIONS_FINE = 11
const STATIONS_COARSE = 4
const RING_MIN = 3.8
const RING_MAX = 6.8
/** Vertical squash. A 16:9 frame is wider than tall, so the ring is too. */
const RING_FLAT_FINE = 0.56
/** A portrait frame takes the ring upright instead. */
const RING_FLAT_COARSE = 0.8
/** Radians of rotation per drawing unit of depth: the helix's pitch. */
const TWIST = 0.014

/** Devices. Coarse pointers get fewer plates and a lower cap, as the brief asks. */
const MAX_DPR_FINE = 2
const MAX_DPR_COARSE = 1.75
/** A hard guard for 4K/5K windows; the DPR cap alone is not a pixel budget. */
const PIXEL_BUDGET = 5_000_000

const TAU = Math.PI * 2

type FieldShape = {
  /** Length of the repeating band, in drawing units. */
  len: number
  /** How far the eye travels over the whole track: a little over one band. */
  travel: number
  /** Where a plate starts losing coverage because it is far away. */
  farA: number
  farB: number
  /** The hard cut. It must end before `len`, or a recycled slab would pop in. */
  goneA: number
  goneB: number
}

/** A desk has the room for depth; a phone gets the same density in less of it. */
const SHAPE_FINE: FieldShape = { len: 76, travel: 86, farA: 44, farB: 64, goneA: 68, goneB: 74 }
const SHAPE_COARSE: FieldShape = { len: 40, travel: 46, farA: 22, farB: 34, goneA: 36, goneB: 39 }

/* Raw sRGB, matching --ink and --deep. Every material is a custom ShaderMaterial
   writing straight to the framebuffer, exactly as the hero and the territory do,
   so the WebGL ink matches the CSS ink to the byte. */
const INK: readonly [number, number, number] = [0x13 / 255, 0x1c / 255, 0x19 / 255]
const DEEP: readonly [number, number, number] = [0x07 / 255, 0x16 / 255, 0x0f / 255]

type Slot = {
  gen: number
  /** Place on the ring, 0..stations-1. */
  station: number
  angle: number
  radius: number
  /** Depth inside the generation's slab, from its front edge. */
  z0: number
  cell: number
  scale: number
  rotZ: number
  rotY: number
  tone: number
}

type Field = {
  mesh: InstancedMesh
  placeAll: () => void
  /** Move any generation that has left the band. Returns true if a matrix changed. */
  recycle: (camZ: number) => boolean
}

/** The cartouche's box, in the sticky viewport's coordinates. */
export type ClearBox = {
  left: number
  top: number
  width: number
  height: number
  /** Bumped by the section whenever the box is re-measured. */
  version: number
}

type Props = {
  /**
   * The scrub proxy, owned by the section: GSAP tweens `p` from 0 to 1 with the
   * track's ScrollTrigger (`scrub: 0.6`). The scene damps it again — the eye has
   * mass — so the camera is not the scrollbar.
   */
  progress: { p: number }
  /** 0→1 as the plate enters the viewport: the field prints itself in. */
  enter: { p: number }
  /** Where the copy sits: the field is cleared there, not covered. */
  clear: { current: ClearBox }
  onReady: () => void
  onUnavailable: () => void
}

/**
 * Deterministic stations. Same field every visit; no layout shift on reload.
 *
 * Each generation is one ring, and its stations are staggered through the slab,
 * which is what turns six flat gates into one continuous helix. The half-step
 * angle offset is not a flourish: a four-station ring placed on the frame's
 * axes lands every plate exactly on the edge of a portrait frame, and the field
 * reads empty.
 */
function makeSlots(stations: number, genLen: number): Slot[] {
  let seed = 0x2026_1030
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 4294967296
  }

  const slots: Slot[] = []
  for (let gen = 0; gen < GEN_COUNT; gen++) {
    for (let station = 0; station < stations; station++) {
      const i = gen * stations + station
      // 7 is coprime with 11 (and 4), so the radii visit the whole range before
      // repeating; the ring alternates inner and outer plates instead of
      // printing a perfect circle.
      const span = Math.max(1, stations - 1)
      const radius = RING_MIN + (((station * 7) % stations) / span) * (RING_MAX - RING_MIN)

      slots.push({
        gen,
        station,
        angle: ((station + 0.5) / stations) * TAU + ((station * 0.37) % 1) * 0.16,
        radius,
        z0: (station / stations) * genLen + (rand() - 0.5) * 1.1,
        // Stride 17 is coprime with 40, so the atlas is walked in full before
        // any label repeats.
        cell: (i * 17 + 3) % flightLabels.length,
        scale: 0.86 + rand() * 0.34,
        rotZ: (rand() - 0.5) * 0.05,
        rotY: (rand() - 0.5) * 0.1,
        tone: 0.8 + rand() * 0.2,
      })
    }
  }
  return slots
}

export default function FlightScene({ progress, enter, clear, onReady, onUnavailable }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null)

  // Callbacks travel through a ref: a parent render must never rebuild the
  // renderer, and a language switch must never dispose the texture.
  const latest = useRef({ onReady, onUnavailable })
  useEffect(() => {
    latest.current = { onReady, onUnavailable }
  })

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

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

    const scene = new Scene()
    const camera = new PerspectiveCamera(46, 1, 0.5, 120)

    const canvas = renderer.domElement
    canvas.className = 'flt__canvas'
    canvas.setAttribute('aria-hidden', 'true')
    host.appendChild(canvas)

    const uniforms = {
      uAtlas: { value: null as Texture | null },
      uInk: { value: new Vector3(INK[0], INK[1], INK[2]) },
      uCover: { value: 1 },
      uFar: { value: new Vector2(SHAPE_FINE.farA, SHAPE_FINE.farB) },
      uGone: { value: new Vector2(SHAPE_FINE.goneA, SHAPE_FINE.goneB) },
      /**
       * The clearing around the type: centre and half-size in device pixels,
       * with the y axis flipped to `gl_FragCoord`. A negative half-size is the
       * "no clearing yet" state — see the ShaderMaterial's first frame.
       */
      uClear: { value: new Vector4(0, 0, -1e5, -1e5) },
      uClearFeather: { value: 40 },
      uResolution: { value: new Vector2(1, 1) },
    }

    const material = new ShaderMaterial({
      uniforms,
      vertexShader: FLIGHT_VERT,
      fragmentShader: FLIGHT_FRAG,
      // Ink is opaque and the canvas is the only thing that is transparent: the
      // page shows through the cleared buffer, never through a blend.
      transparent: false,
      depthTest: false,
      depthWrite: false,
    })

    const coarse =
      window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 900
    const stations = coarse ? STATIONS_COARSE : STATIONS_FINE
    const shape = coarse ? SHAPE_COARSE : SHAPE_FINE
    const plateHeight = coarse ? BASE_H_COARSE : BASE_H_FINE
    const genLen = shape.len / GEN_COUNT

    const state = {
      /** The eye's own progress: chases the scroll proxy. */
      p: clamp01(progress.p),
      enter: clamp01(enter.p),
      swayX: 0,
      swayY: 0,
      px: 0,
      py: 0,
      vel: 0,
      roll: 0,
      /** Set on the first frame and on every resume: no glide from a stale pose. */
      snap: true,
      onScreen: false,
      /** The box version the clearing uniform was last written from. */
      clearVersion: -1,
    }

    let field: Field | null = null
    let texture: Texture | null = null
    let atlasCanvas: HTMLCanvasElement | null = null
    /** Ring scale on X and Y, both read from the frame's aspect. */
    let lateral = 1
    let flat = coarse ? RING_FLAT_COARSE : RING_FLAT_FINE
    let running = false
    let disposed = false

    /* ---- viewport ------------------------------------------------------ */

    const resize = () => {
      const w = host.clientWidth || 1
      const h = host.clientHeight || 1
      const cap = window.matchMedia('(pointer: coarse)').matches
        ? MAX_DPR_COARSE
        : MAX_DPR_FINE

      let dpr = Math.min(window.devicePixelRatio || 1, cap)
      const pixels = w * h * dpr * dpr
      if (pixels > PIXEL_BUDGET) dpr *= Math.sqrt(PIXEL_BUDGET / pixels)

      renderer.setPixelRatio(dpr)
      renderer.setSize(w, h, false)
      uniforms.uResolution.value.set(w * dpr, h * dpr)
      // The clearing is written in device pixels, so a new ratio invalidates it.
      state.clearVersion = -1

      camera.aspect = w / h
      // Portrait gets a wider vertical field. A 46° lens on a 390 × 844 screen
      // is a 22° horizontal shaft: the ring would only exist at the corners.
      const portrait = camera.aspect < 0.9
      camera.fov = portrait ? 64 : 46
      camera.updateProjectionMatrix()

      // Keep the ring the same share of the frame at any aspect: the camera
      // distance is fixed, so the ring has to follow the lens.
      const nextLateral = Math.max(0.42, Math.min(1, camera.aspect * 0.92))
      const nextFlat = portrait ? RING_FLAT_COARSE : RING_FLAT_FINE

      if (Math.abs(nextLateral - lateral) > 0.02 || Math.abs(nextFlat - flat) > 0.02) {
        lateral = nextLateral
        flat = nextFlat
        field?.placeAll()
      }
    }

    /* ---- frame --------------------------------------------------------- */

    const draw = (dt: number) => {
      if (!field) return

      const target = clamp01(progress.p)
      const chase = state.snap ? 1 : 1 - Math.exp(-dt * 4)
      const before = state.p
      state.p += (target - state.p) * chase

      const velocity = dt > 0 ? (state.p - before) / dt : 0
      state.vel += (velocity - state.vel) * (1 - Math.exp(-dt * 6))

      const rollTarget = Math.max(-0.02, Math.min(0.02, state.vel * 0.055))
      state.roll += (rollTarget - state.roll) * (1 - Math.exp(-dt * 5))

      const enterTarget = clamp01(enter.p)
      state.enter = state.snap
        ? enterTarget
        : state.enter + (enterTarget - state.enter) * (1 - Math.exp(-dt * 7))

      // The pointer is additive and settles: it leans the corridor, it does not
      // steer it. ±0.15 units on X, ±0.08 on Y.
      const lean = state.snap ? 1 : 1 - Math.exp(-dt * 3.2)
      state.swayX += (state.px * 0.15 - state.swayX) * lean
      state.swayY += (state.py * -0.08 - state.swayY) * lean

      const p = state.p
      const camZ = -p * shape.travel

      camera.position.set(
        state.swayX + Math.sin(p * 3.3 + 0.4) * 0.1,
        state.swayY + Math.sin(p * 6.1 + 0.9) * 0.16,
        camZ,
      )
      // A roll from the throw, not from the pointer: the corridor banks when it
      // is being travelled, and is level when the reader stops.
      camera.rotation.set(0, 0, state.roll)

      if (field.recycle(camZ)) field.mesh.instanceMatrix.needsUpdate = true

      /* The copy's clearing. The type is not a panel: the field is told where
         the words are and thins to dots there, which is the sheet's own rule —
         the figure is the type, the field gives way to it. The box is measured
         once per layout (never per frame), and this branch runs only when the
         section has re-measured it. */
      const box = clear.current
      if (box.version !== state.clearVersion) {
        state.clearVersion = box.version
        const dpr = renderer.getPixelRatio()
        const viewH = host.clientHeight || 1
        if (box.width > 0 && box.height > 0) {
          // A margin of paper around the words: the clearing is the type's
          // breathing room, not its bounding box.
          const pad = 24
          uniforms.uClear.value.set(
            (box.left + box.width / 2) * dpr,
            (viewH - (box.top + box.height / 2)) * dpr,
            (box.width / 2 + pad) * dpr,
            (box.height / 2 + pad) * dpr,
          )
        } else {
          uniforms.uClear.value.set(0, 0, -1e5, -1e5)
        }
        uniforms.uClearFeather.value = 40 * dpr
      }

      /* The hand-off follows the *scroll*, not the damped eye: the plate's
         opacity and the type's reversal are already driven by the proxy, and a
         camera still catching up must not leave labels printed on a plate the
         page has already taken to ink. The damping is motion; the ink is a
         scroll state. */
      const h = handoff(clamp01(progress.p))
      uniforms.uInk.value.set(
        INK[0] + (DEEP[0] - INK[0]) * h,
        INK[1] + (DEEP[1] - INK[1]) * h,
        INK[2] + (DEEP[2] - INK[2]) * h,
      )
      uniforms.uCover.value = (1 - h) * state.enter

      state.snap = false
      renderer.render(scene, camera)
    }

    const tick = (_time: number, deltaMs: number) => {
      draw(Math.min(Math.max(deltaMs, 0) / 1000, 0.05))
    }

    /* ---- lifecycle ----------------------------------------------------- */

    const sync = () => {
      const want = state.onScreen && document.visibilityState === 'visible'
      if (want && !running) {
        state.snap = true
        running = true
        gsap.ticker.add(tick)
      } else if (!want && running) {
        running = false
        gsap.ticker.remove(tick)
      }
    }

    const observer = new IntersectionObserver(
      (entries) => {
        state.onScreen = entries[0]?.isIntersecting ?? false
        sync()
      },
      { rootMargin: '140px' },
    )

    const resizeObserver = new ResizeObserver(() => resize())

    const onVisibility = () => sync()

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return
      state.px = (event.clientX / window.innerWidth) * 2 - 1
      state.py = (event.clientY / window.innerHeight) * 2 - 1
    }

    const onPointerLeave = () => {
      state.px = 0
      state.py = 0
    }

    const onContextLost = (event: Event) => {
      event.preventDefault()
      teardown()
      latest.current.onUnavailable()
    }

    const teardown = () => {
      if (disposed) return
      disposed = true

      if (running) {
        running = false
        gsap.ticker.remove(tick)
      }

      observer.disconnect()
      resizeObserver.disconnect()

      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerleave', onPointerLeave)
      window.removeEventListener('resize', resize)
      document.removeEventListener('visibilitychange', onVisibility)
      canvas.removeEventListener('webglcontextlost', onContextLost)

      if (field) {
        scene.remove(field.mesh)
        field.mesh.geometry.dispose()
        field.mesh.dispose()
        field = null
      }

      material.dispose()
      texture?.dispose()
      texture = null

      if (atlasCanvas) {
        atlasCanvas.width = 0
        atlasCanvas.height = 0
        atlasCanvas = null
      }

      renderer.dispose()

      if (canvas.parentNode === host) host.removeChild(canvas)
    }

    /* ---- build -------------------------------------------------------- */

    const build = () => {
      if (disposed) return

      const sheet = document.createElement('canvas')
      sheet.width = ATLAS_SIZE
      sheet.height = ATLAS_SIZE
      const ctx = sheet.getContext('2d')
      if (!ctx) {
        latest.current.onUnavailable()
        return
      }

      const cells = drawAtlas(ctx, flightLabels)
      if (cells.length === 0) {
        latest.current.onUnavailable()
        return
      }

      atlasCanvas = sheet
      const tex = createAtlasTexture(sheet)
      texture = tex
      uniforms.uAtlas.value = tex
      uniforms.uFar.value.set(shape.farA, shape.farB)
      uniforms.uGone.value.set(shape.goneA, shape.goneB)

      const slots = makeSlots(stations, genLen)
      const count = slots.length

      const geometry = new PlaneGeometry(1, 1)
      const uvs = new Float32Array(count * 4)
      const tones = new Float32Array(count)

      for (let i = 0; i < count; i++) {
        const slot = slots[i]
        const cell = cells[slot.cell % cells.length]
        uvs[i * 4] = cell.u0
        uvs[i * 4 + 1] = cell.v0
        uvs[i * 4 + 2] = cell.u1
        uvs[i * 4 + 3] = cell.v1
        tones[i] = slot.tone
      }

      geometry.setAttribute('aUv', new InstancedBufferAttribute(uvs, 4))
      geometry.setAttribute('aTone', new InstancedBufferAttribute(tones, 1))

      const mesh = new InstancedMesh(geometry, material, count)
      // The field is a band around the eye; a bounding sphere taken at build
      // time would cull it the moment the camera moves a field's length.
      mesh.frustumCulled = false
      mesh.instanceMatrix.setUsage(DynamicDrawUsage)
      scene.add(mesh)

      const genZ = new Float32Array(GEN_COUNT)
      for (let g = 0; g < GEN_COUNT; g++) genZ[g] = -g * genLen

      const gens: number[][] = []
      for (let g = 0; g < GEN_COUNT; g++) gens.push([])
      for (let i = 0; i < count; i++) gens[slots[i].gen].push(i)

      const pos = new Vector3()
      const quat = new Quaternion()
      const euler = new Euler()
      const scale = new Vector3()
      const matrix = new Matrix4()

      const place = (i: number) => {
        const slot = slots[i]
        const cell = cells[slot.cell % cells.length]
        const height = plateHeight * slot.scale
        const z = genZ[slot.gen] - slot.z0
        // The twist is baked into the world, not applied per frame: the field is
        // a helix standing still in space, and the eye travels through it. That
        // is what keeps the matrices off the frame loop.
        const angle = slot.angle + z * TWIST

        pos.set(
          Math.cos(angle) * slot.radius * lateral,
          Math.sin(angle) * slot.radius * flat,
          z,
        )
        euler.set(0, slot.rotY, slot.rotZ)
        quat.setFromEuler(euler)
        // Width follows the cropped cell, so the string keeps the aspect it was
        // drawn at. A short name is a short plate.
        scale.set(height * cell.aspect, height, 1)
        matrix.compose(pos, quat, scale)
        mesh.setMatrixAt(i, matrix)
      }

      const placeAll = () => {
        for (let i = 0; i < count; i++) place(i)
        mesh.instanceMatrix.needsUpdate = true
      }

      const recycle = (camZ: number) => {
        let moved = false

        for (let g = 0; g < GEN_COUNT; g++) {
          let steps = 0
          // The slab's far edge has passed the eye: push it a whole field ahead.
          // The test is on the *last* plate, so nothing is moved while any part
          // of the slab is still in front of the camera.
          while (steps < 4 && genZ[g] - genLen > camZ + 0.5) {
            genZ[g] -= shape.len
            steps++
          }
          // The reader scrolled back: a slab left beyond the far edge comes back.
          while (steps < 8 && genZ[g] < camZ - shape.len - 1) {
            genZ[g] += shape.len
            steps++
          }

          if (steps > 0) {
            const list = gens[g]
            for (let k = 0; k < list.length; k++) place(list[k])
            moved = true
          }
        }

        return moved
      }

      field = { mesh, placeAll, recycle }

      resize()
      placeAll()
      state.snap = true
      draw(1 / 60)
      latest.current.onReady()
      sync()
    }

    /* ---- attach -------------------------------------------------------- */

    observer.observe(host)
    resizeObserver.observe(host)
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerleave', onPointerLeave)
    window.addEventListener('resize', resize)
    document.addEventListener('visibilitychange', onVisibility)
    canvas.addEventListener('webglcontextlost', onContextLost)

    resize()

    // The atlas is set only after the fonts have settled: drawing it against a
    // fallback and redrawing later would re-upload the texture mid-flight. If
    // the font promise rejects, the fallback is drawn once — never an empty
    // atlas, never an empty plate.
    const ready =
      typeof document.fonts !== 'undefined' ? document.fonts.ready : Promise.resolve()
    const buildNow = () => {
      if (!disposed) build()
    }
    ready.then(buildNow, buildNow)

    return teardown
    // `progress` and `enter` are stable proxies owned by the section; the scene
    // is built once and survives every re-render, language switch included.
  }, [progress, enter, clear])

  return <div className="flt__stage" ref={hostRef} aria-hidden="true" />
}

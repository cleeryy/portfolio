import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { gsap } from 'gsap'
import { domains, type Project } from '../../content/work'
import { useLang } from '../../lib/i18n'
import { getPointer, usePointerFrame } from '../../lib/pointer'
import { prefersReducedMotion } from '../../lib/reveal'
import ProjectSeal from '../../ui/ProjectSeal'
import './plate-pop.css'

/* ============================================================================
   PlatePop — one plate, for the whole wall
   ----------------------------------------------------------------------------
   The index is a wall of names; naming one pulls its plate out of the press: the
   seal, the name, one line of measurements and the instruments, at poster size,
   held beside the pointer or beside the row that has focus.

   **Why one element for the whole section.** Twenty plates would be twenty
   seals, twenty layout boxes and twenty things to keep in register. One plate
   that changes its reading is one object, and it is the honest model of what is
   happening: the reader is not opening twenty cards, they are reading one
   record at a time. It also makes the reveal mean something — the first name
   the pointer lands on is the plate being pulled; every name after it is the
   same plate re-set, so the clip is not replayed and the object never pretends
   to be new.

   **Why the place and the printing are two elements.** `translate3d` (the
   follow) and `clip-path` + `scale` + `rotate` (the reveal) are two gestures on
   two clocks. Written into one `transform` they would fight in the same frame;
   the outer element owns the place, the inner plate owns the press.

   **Why the follow is not a rAF.** The sheet already runs exactly one pointer
   frame (`lib/pointer`), and it exists only while the pointer is moving. A
   second loop here would double the work for the same signal and drift out of
   phase with the loupe and the ghost. The callback writes one transform string
   and nothing else: the plate's box and the viewport are measured when it
   appears, on a language switch and on resize — never per frame.

   **Why the anchor path exists.** A pointer is not the only way to name a row.
   A keyboard reader tabs down the same list, and under reduced motion there is
   no follow at all, so the plate hangs off the row's own rectangle: one
   measurement per focus change, no frames.

   **Why it keeps the last record while it leaves.** The take-down clips an
   object that is still legible; emptying the content first would clip a blank
   plate, which reads as a flash rather than as a plate being lifted. So the
   last subject is kept in state for as long as the component is mounted — it is
   hidden, `aria-hidden`, and costs one object.

   **Why it can be ignored.** The plate is decor: `aria-hidden`, `pointer-events:
   none`, no link of its own. Every fact it prints is already on the row that
   produced it and on the file behind that row, so nothing here is the only copy
   of anything, and a script that never runs leaves the wall of links intact.
   ========================================================================== */

export type PlateSubject = { project: Project; index: number }

type PlatePopProps = {
  subject: PlateSubject | null
  /** Mono margin label printed on the plate: the word for what it is. */
  note: string
  /** `pointer` follows the cursor; `anchor` hangs off `anchorRef`. */
  mode?: 'pointer' | 'anchor'
  anchorRef?: RefObject<HTMLElement | null>
}

/** A box and a point, in viewport CSS pixels. */
type Box = { w: number; h: number }
type Point = { x: number; y: number }

/** The seal at poster size: the plate is the file's header, enlarged. */
const SEAL = 220

/** How far the plate hangs from the cursor, in CSS px: clear of the hot zone. */
const OFFSET = 24

/** The margin every edge clamp keeps, so a plate never touches the frame. */
const MARGIN = 24

/** Per-frame damping of the follow: 0.16 at 60 Hz is a lag of about 120 ms. */
const DAMP = 0.16

/** The reveal, in seconds, from the press recipe the sheet borrows. */
const REVEAL = 0.42

/** The take-down is shorter: there is nothing left to read on the way out. */
const HIDE = 0.28

/** `power4.inOut` at both ends: the plate starts and stops with the press. */
const EASE = 'power4.inOut'

/** Clip states. Four percentages each, so GSAP interpolates shape into shape. */
const CLIP_SHUT = 'inset(100% 0% 0% 0%)'
const CLIP_OPEN = 'inset(0% 0% 0% 0%)'
const CLIP_GONE = 'inset(0% 0% 100% 0%)'

/** What a plate is printed at before it is registered: a slight swell, a tilt. */
const SCALE = 0.96
const TILT = -1.5

/** Two digits, because a plate reference is a coordinate, not a count. */
const pad2 = (value: number) => String(value).padStart(2, '0')

/** Clamped to the range, and never inverted when the range is a hair wide. */
function contain(x: number, y: number, plate: Box, frame: Box): Point {
  return {
    x: Math.min(Math.max(x, MARGIN), Math.max(MARGIN, frame.w - MARGIN - plate.w)),
    y: Math.min(Math.max(y, MARGIN), Math.max(MARGIN, frame.h - MARGIN - plate.h)),
  }
}

/** Beside the cursor, flipped to the other side when an edge is near. */
function besideCursor(x: number, y: number, plate: Box, frame: Box): Point {
  const right = x + OFFSET
  const below = y + OFFSET
  return contain(
    right + plate.w > frame.w - MARGIN ? x - OFFSET - plate.w : right,
    below + plate.h > frame.h - MARGIN ? y - OFFSET - plate.h : below,
    plate,
    frame,
  )
}

/**
 * Beside the row that named the plate, or the viewport's right margin when
 * there is no anchor to hang on. On a wide sheet the row ends before the
 * gutter, so the plate prints outside the field; when it does not fit there it
 * flips to the row's left and is clamped.
 */
function besideAnchor(rect: DOMRect | null, plate: Box, frame: Box): Point {
  if (!rect) {
    return contain(frame.w - MARGIN - plate.w, (frame.h - plate.h) / 2, plate, frame)
  }

  const right = rect.right + OFFSET
  return contain(
    right + plate.w > frame.w - MARGIN ? rect.left - OFFSET - plate.w : right,
    rect.top + rect.height / 2 - plate.h / 2,
    plate,
    frame,
  )
}

/** One transform, and nothing at all when the position has not moved. */
function place(el: HTMLElement | null, at: Point, last: Point): void {
  if (!el) return
  const x = Math.round(at.x)
  const y = Math.round(at.y)
  if (x === last.x && y === last.y) return
  last.x = x
  last.y = y
  el.style.transform = `translate3d(${x}px, ${y}px, 0)`
}

/** The plate is pulled: clipped from its foot, swelled, tilted, then set. */
function pull(plate: HTMLElement, reduced: boolean): gsap.core.Tween | null {
  if (reduced) {
    gsap.set(plate, { clipPath: CLIP_OPEN, scale: 1, rotation: 0, visibility: 'visible' })
    return null
  }

  return gsap.fromTo(
    plate,
    { clipPath: CLIP_SHUT, scale: SCALE, rotation: TILT, visibility: 'visible' },
    { clipPath: CLIP_OPEN, scale: 1, rotation: 0, duration: REVEAL, ease: EASE },
  )
}

/** …and lifted away upward, so the wall under it is never left covered. */
function lift(plate: HTMLElement, reduced: boolean): gsap.core.Tween | null {
  if (reduced) {
    gsap.set(plate, { clipPath: CLIP_GONE, visibility: 'hidden' })
    return null
  }

  return gsap.to(plate, {
    clipPath: CLIP_GONE,
    duration: HIDE,
    ease: EASE,
    onComplete: () => {
      gsap.set(plate, { visibility: 'hidden' })
    },
  })
}

export default function PlatePop({ subject, note, mode = 'pointer', anchorRef }: PlatePopProps) {
  const { lang, pick } = useLang()

  /**
   * The record on the plate. Updated during render, which is React's own
   * "derive state from a prop change" path: the component re-renders before the
   * commit, so the DOM is printed in the same frame the subject changed in.
   * `subject` going null does not clear it — the take-down needs something to
   * carry.
   */
  const [printed, setPrinted] = useState<PlateSubject | null>(null)
  if (subject && subject !== printed) setPrinted(subject)

  const rootRef = useRef<HTMLDivElement | null>(null)
  const plateRef = useRef<HTMLDivElement | null>(null)

  /** True between the start of a reveal and the start of its take-down. */
  const upRef = useRef(false)
  const reducedRef = useRef(false)
  const tweenRef = useRef<gsap.core.Tween | null>(null)

  /** Where the plate is, in viewport px, before rounding. */
  const at = useRef<Point>({ x: 0, y: 0 })
  /** The last written position: an idle frame writes nothing. */
  const painted = useRef<Point>({ x: Number.NaN, y: Number.NaN })
  /** The plate's own box and the viewport, both cached — no rect in a frame. */
  const size = useRef<Box>({ w: 0, h: 0 })
  const view = useRef<Box>({ w: 0, h: 0 })

  /* The preference is read, never subscribed to: the sheet keeps one media
     query listener, and a preference that flips mid-session is re-read on the
     next render, which every subject change causes. */
  useLayoutEffect(() => {
    reducedRef.current = prefersReducedMotion()
  })

  /* Fill, place, reveal — or take down. Runs after the commit, so the box
     measured here is the box that is about to be printed. A subject that
     arrives while the plate is down is a new plate and gets the pull; one that
     arrives while it is up only re-reads the same object, and the clip is not
     replayed. */
  useLayoutEffect(() => {
    const plate = plateRef.current
    if (!plate) return

    if (!subject) {
      if (!upRef.current) return
      upRef.current = false
      tweenRef.current?.kill()
      tweenRef.current = lift(plate, reducedRef.current)
      return
    }

    const fresh = !upRef.current
    upRef.current = true

    const doc = document.documentElement
    view.current.w = doc.clientWidth
    view.current.h = doc.clientHeight
    size.current.w = plate.offsetWidth
    size.current.h = plate.offsetHeight

    const under = mode === 'anchor' || reducedRef.current

    if (under) {
      at.current = besideAnchor(
        anchorRef?.current?.getBoundingClientRect() ?? null,
        size.current,
        view.current,
      )
      place(rootRef.current, at.current, painted.current)
    } else if (fresh) {
      const pointer = getPointer()
      at.current = pointer.inside
        ? besideCursor(pointer.x, pointer.y, size.current, view.current)
        : besideAnchor(null, size.current, view.current)
      place(rootRef.current, at.current, painted.current)
    }

    if (fresh) {
      tweenRef.current?.kill()
      tweenRef.current = pull(plate, reducedRef.current)
    }
  }, [subject, mode, lang, anchorRef])

  /* The follow rides the sheet's one pointer frame. It reads the cached box and
     the cached viewport and writes exactly one transform; the pointer module
     stops the loop when the pointer rests, so the plate costs nothing at rest. */
  usePointerFrame((pointer) => {
    if (!upRef.current || mode === 'anchor' || reducedRef.current) return
    if (!pointer.inside) return

    const target = besideCursor(pointer.x, pointer.y, size.current, view.current)
    at.current.x += (target.x - at.current.x) * DAMP
    at.current.y += (target.y - at.current.y) * DAMP
    place(rootRef.current, at.current, painted.current)
  })

  /* A resize re-measures the viewport once and re-hangs the plate when it is
     not following the pointer. The pointer path corrects itself on its next
     frame instead of reading here. */
  useEffect(() => {
    const onResize = () => {
      const doc = document.documentElement
      view.current.w = doc.clientWidth
      view.current.h = doc.clientHeight

      const plate = plateRef.current
      if (!upRef.current || !plate) return

      size.current.w = plate.offsetWidth
      size.current.h = plate.offsetHeight

      if (mode !== 'anchor' && !reducedRef.current) return
      at.current = besideAnchor(
        anchorRef?.current?.getBoundingClientRect() ?? null,
        size.current,
        view.current,
      )
      place(rootRef.current, at.current, painted.current)
    }

    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [mode, anchorRef])

  useEffect(() => {
    return () => {
      tweenRef.current?.kill()
    }
  }, [])

  const project = printed?.project
  const domain = project ? domains.find((entry) => entry.id === project.domain) : undefined

  return (
    <div className="pp" ref={rootRef} aria-hidden="true">
      <div className="pp__plate" ref={plateRef}>
        {printed && project ? (
          <>
            <span className="pp__tick" />
            <div className="pp__head">
              <span className="pp__note mono">{note}</span>
              <span className="pp__ref mono">{`W.${pad2(printed.index)}`}</span>
            </div>
            <ProjectSeal slug={project.slug} size={SEAL} className="pp__seal" />
            <p className="pp__name">{project.name}</p>
            <p className="pp__meta mono">
              {`${project.year} · ${pick(project.status)}${
                domain ? ` · ${pick(domain.label)}` : ''
              }`}
            </p>
            <p className="pp__stack mono">{project.stack.join(' + ')}</p>
          </>
        ) : null}
      </div>
    </div>
  )
}

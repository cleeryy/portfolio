import { useRef } from 'react'
import { getScrollVelocity, usePointerFrame } from '../lib/pointer'
import './ghost.css'

/* ============================================================================
   Ghost — the misprint in the big type
   ----------------------------------------------------------------------------
   The string is printed twice: an ink copy in normal flow, which is the text
   the reader and the accessibility tree get, and a crimson plate behind it,
   `aria-hidden`, multiplied into the paper. At rest the two are in perfect
   register — the ink covers the plate exactly, so a screenshot at rest shows one
   clean line. When the pointer moves or the sheet is thrown, the plate slips by
   at most 6 px / 4 px plus the scroll velocity, and settles back to 0.

   Geometry is transform-only. The custom properties `--reg-x` and `--reg-y` are
   written by one shared pointer frame (`lib/pointer.ts`); only the plate's
   transform reads them, so no layout is invalidated and `will-change` is honest.

   The intros that own a heading (the cover's rise from a mask) can defer the
   plate: with `mask`, the plate waits for `[data-ghost='ready']`, which the
   timeline sets when the ink copy has landed. Reduced motion never starts the
   pointer loop at all; the plate is present, static, offset by exactly one
   pixel (`ghost.css`).
   ========================================================================== */

/** Pointer separation, in CSS px. The plate may not travel further than this. */
const REG_X = 6
const REG_Y = 4

/* The plate never sits in perfect register: at rest it is one hair to the right
   and a half below, which is what makes the misprint read at a glance instead of
   only under the pointer. The pointer pushes it out from there. */
const BASE_X = 1
const BASE_Y = 0.6

/** Scroll velocity is read in px/frame and capped before it reaches the plate. */
const SCROLL_MAX = 14
const SCROLL_GAIN = 0.9

/** The same damping as the pointer module: one constant, one settle. */
const DAMP = 0.18

/** Below this the plate is in register, and is written as exactly 0. */
const REST = 0.05

const clamp = (value: number, min: number, max: number) =>
  value < min ? min : value > max ? max : value

type GhostTag = 'h1' | 'h2' | 'p' | 'span'

type GhostProps = {
  /** The complete string. It is printed twice; only the ink copy is read out. */
  text: string
  /** The element that carries the heading's own layout. */
  as?: GhostTag
  className?: string
  /** Anchor target for `aria-labelledby`, as on any heading. */
  id?: string
  /**
   * Let an owning intro clip the ink copy and defer the plate until it lands.
   * The cover uses this; document headings do not.
   */
  mask?: boolean
}

type PlateState = {
  x: number
  y: number
  /** Last pointer sample, so a stationary pointer releases the plate. */
  lastX: number
  lastY: number
}

export default function Ghost({
  text,
  as = 'h1',
  className,
  id,
  mask = false,
}: GhostProps) {
  const rootRef = useRef<HTMLElement | null>(null)
  const plate = useRef<PlateState>({ x: 0, y: 0, lastX: Number.NaN, lastY: Number.NaN })

  /* One subscription for the component's life. The callback is held in a ref by
     the hook, so the fresh closure below never restarts the frame loop. Under
     reduced motion the module refuses the subscription, so this never runs. */
  usePointerFrame((pointer) => {
    const root = rootRef.current
    if (!root) return

    const state = plate.current
    const moved = pointer.x !== state.lastX || pointer.y !== state.lastY
    state.lastX = pointer.x
    state.lastY = pointer.y

    let targetX = BASE_X
    let targetY = BASE_Y

    if (moved && pointer.inside) {
      const rect = root.getBoundingClientRect()
      const halfW = rect.width > 0 ? rect.width / 2 : 1
      const halfH = rect.height > 0 ? rect.height / 2 : 1
      targetX = BASE_X + clamp((pointer.x - (rect.left + halfW)) / halfW, -1, 1) * REG_X
      targetY = BASE_Y + clamp((pointer.y - (rect.top + halfH)) / halfH, -1, 1) * REG_Y
    }

    /* The scroll component is already damped to ~90 ms by the pointer module;
       it is added, not damped again, so the lag stays the brief's. */
    const scroll = clamp(getScrollVelocity(), -SCROLL_MAX, SCROLL_MAX) * SCROLL_GAIN

    state.x += (targetX - state.x) * DAMP
    state.y += (targetY - state.y) * DAMP
    if (Math.abs(state.x - BASE_X) < REST) state.x = BASE_X
    if (Math.abs(state.y - BASE_Y) < REST) state.y = BASE_Y

    const y = state.y + scroll

    root.style.setProperty('--reg-x', `${state.x.toFixed(2)}px`)
    root.style.setProperty('--reg-y', `${y.toFixed(2)}px`)
  })

  const Tag = as

  return (
    <Tag
      className={className ? `ghost ${className}` : 'ghost'}
      id={id}
      ref={(node: HTMLElement | null) => {
        rootRef.current = node
      }}
      data-ghost={mask ? 'wait' : 'ready'}
    >
      {mask ? (
        <span className="ghost__mask">
          <span className="ghost__ink" data-ghost-ink="">
            {text}
          </span>
        </span>
      ) : (
        <span className="ghost__ink">{text}</span>
      )}

      {/* Decoration: a second impression, not a second reading. The string is
          drawn as generated content from `data-text`, so the DOM holds ONE copy
          of the text: `textContent`, the accessible name and a search engine all
          read the ink, never the plate. */}
      <span className="ghost__plate" aria-hidden="true" data-text={text} />
    </Tag>
  )
}

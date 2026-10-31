import { useEffect, useRef } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { gsap } from 'gsap'
import { RolloverLabel } from './Rollover'
import './ui.css'

type MagneticButtonProps = {
  children: ReactNode
  /** Renders an anchor when present. In-page targets are handed to the caller. */
  href?: string
  onClick?: (event: MouseEvent<HTMLElement>) => void
  /** `mark` is the primary action: ink plate, red registration square. */
  variant?: 'mark' | 'quiet'
  className?: string
  /**
   * The pointer HUD's label. Omitted, an in-page `href` prints itself
   * (`#territory`); `null` opts the plate out.
   */
  hud?: string | null
}

/** The HUD's reading of a destination: an in-page target prints its own id. */
function hudFor(href: string | undefined): string | undefined {
  if (!href) return undefined
  if (href.startsWith('#')) return href
  return href.replace(/^https?:\/\//, '').replace(/^\/$/, '')
}

/** Maximum travel of the plate and of its label, in px. Both are small on purpose. */
const PULL = 9
const LABEL_PULL = 4

/**
 * Pointer-additive pull, the way a magnet behaves near a steel rule: the element
 * leans toward the pointer and settles back when it leaves.
 *
 * It is an enhancement, never a requirement:
 * - Disabled on coarse pointers, where a finger covers the target anyway.
 * - Disabled under `prefers-reduced-motion`.
 * - Keyboard focus never moves the element, so the focus ring stays put.
 */
export default function MagneticButton({
  children,
  href,
  onClick,
  variant = 'mark',
  className,
  hud,
}: MagneticButtonProps) {
  const anchorRef = useRef<HTMLAnchorElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const labelRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const el: HTMLElement | null = href ? anchorRef.current : buttonRef.current
    const label = labelRef.current
    if (!el || !label) return

    const fine = window.matchMedia('(hover: hover) and (pointer: fine)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!fine.matches || reduced.matches) return

    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3.out' })
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3.out' })
    const lxTo = gsap.quickTo(label, 'x', { duration: 0.7, ease: 'power3.out' })
    const lyTo = gsap.quickTo(label, 'y', { duration: 0.7, ease: 'power3.out' })

    const onMove = (event: PointerEvent) => {
      const rect = el.getBoundingClientRect()
      if (rect.width === 0 || rect.height === 0) return
      const dx = gsap.utils.clamp(-1, 1, (event.clientX - (rect.left + rect.width / 2)) / (rect.width / 2))
      const dy = gsap.utils.clamp(-1, 1, (event.clientY - (rect.top + rect.height / 2)) / (rect.height / 2))
      xTo(dx * PULL)
      yTo(dy * PULL)
      lxTo(dx * LABEL_PULL)
      lyTo(dy * LABEL_PULL)
    }

    const onLeave = () => {
      xTo(0)
      yTo(0)
      lxTo(0)
      lyTo(0)
    }

    el.addEventListener('pointermove', onMove)
    el.addEventListener('pointerleave', onLeave)
    el.addEventListener('pointercancel', onLeave)

    return () => {
      el.removeEventListener('pointermove', onMove)
      el.removeEventListener('pointerleave', onLeave)
      el.removeEventListener('pointercancel', onLeave)
      gsap.killTweensOf([el, label])
      gsap.set([el, label], { x: 0, y: 0 })
    }
  }, [href])

  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (href && href.startsWith('#') && onClick) event.preventDefault()
    onClick?.(event)
  }

  const classes = ['magnet', `magnet--${variant}`, className].filter(Boolean).join(' ')
  const hudLabel = hud === undefined ? hudFor(href) : hud ?? undefined

  const content = (
    <>
      <span className="magnet__mark" aria-hidden="true" />
      {/* The label rolls over itself like every other place on the sheet; the
          magnet above it keeps its own additive pull on this wrapper. */}
      <span className="magnet__label" ref={labelRef}>
        {typeof children === 'string' ? <RolloverLabel text={children} /> : children}
      </span>
    </>
  )

  if (href) {
    return (
      <a ref={anchorRef} className={classes} href={href} onClick={handleClick} data-hud={hudLabel}>
        {content}
      </a>
    )
  }

  return (
    <button ref={buttonRef} className={classes} type="button" onClick={handleClick} data-hud={hudLabel}>
      {content}
    </button>
  )
}

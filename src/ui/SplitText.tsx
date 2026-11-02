import { useLayoutEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import { revealWords } from '../lib/reveal'
import './ui.css'

type SplitTag = 'h1' | 'h2' | 'h3' | 'p' | 'span'

type SplitTextProps = {
  /** The complete string. It is never broken for assistive tech. */
  text: string
  /** The semantic element to render. Headings keep their own level. */
  as?: SplitTag
  className?: string
  /** Anchor target, for the `aria-labelledby` a section points at this heading. */
  id?: string
  /** Wrap each word in a clipping box so it can rise from behind a mask. */
  mask?: boolean
  /**
   * Opt in to the scroll reveal: the words rise out of their masks once, when
   * the element enters. Off by default — the hero runs its own intro timeline
   * over the same words and must not be animated twice.
   */
  reveal?: boolean
}

/**
 * Word-level split for display type.
 *
 * Accessibility contract:
 * - The full string stays in the accessibility tree. Headings carry it as
 *   `aria-label` (a heading's name may come from the author), everything else
 *   carries it as a visually hidden text node. `aria-labelledby` still names a
 *   section whose heading is split, because the name is resolved on the
 *   heading itself.
 * - Every decorative fragment is `aria-hidden`, so the split is invisible to
 *   assistive tech and to text search: one clean sentence, not seven spans.
 * - Nothing is hidden by CSS. The words are laid out at full opacity in the
 *   stylesheet; only JS (GSAP, in the section that owns the intro) may move
 *   them. If the script never runs, or fails, the text is already readable.
 */
export default function SplitText({
  text,
  as = 'span',
  className,
  id,
  mask = true,
  reveal = false,
}: SplitTextProps) {
  const rootRef = useRef<HTMLElement | null>(null)

  const words = text.split(/\s+/).filter(Boolean)
  const units: ReactNode[] = []

  words.forEach((word, index) => {
    const inner = (
      <span className="split__i" data-split-unit="" key={`i${index}`}>
        {word}
      </span>
    )

    units.push(
      mask ? (
        <span className="split__w" aria-hidden="true" key={`w${index}`}>
          {inner}
        </span>
      ) : (
        inner
      ),
    )

    // A real space between the inline-blocks keeps natural line breaking and
    // justification working; it is decoration like the words around it.
    if (index < words.length - 1) units.push(' ')
  })

  // The reveal is keyed on the string: a language switch replaces every span,
  // and the new words have to be set up again before they are painted.
  useLayoutEffect(() => {
    const el = rootRef.current
    if (!reveal || !el) return
    const unitsInDom = Array.from(el.querySelectorAll<HTMLElement>('[data-split-unit]'))
    return revealWords(el, unitsInDom)
  }, [reveal, text])

  const Tag = as
  const named = as === 'h1' || as === 'h2' || as === 'h3'

  return (
    <Tag
      className={className ? `split ${className}` : 'split'}
      data-split=""
      id={id}
      ref={(node: HTMLElement | null) => {
        rootRef.current = node
      }}
      {...(named ? { 'aria-label': text } : {})}
    >
      {/* Headings are named by aria-label; other elements need a real text node
          because browsers refuse to name a generic element from aria-label. */}
      {named ? null : <span className="sr-only">{text}</span>}
      {units}
    </Tag>
  )
}

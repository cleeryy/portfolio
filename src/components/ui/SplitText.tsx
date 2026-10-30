import type { ReactNode } from 'react'
import './ui.css'

type SplitTag = 'h1' | 'h2' | 'h3' | 'p' | 'span'

type SplitTextProps = {
  /** The complete string. It is never broken for assistive tech. */
  text: string
  /** The semantic element to render. Headings keep their own level. */
  as?: SplitTag
  className?: string
  /** Wrap each word in a clipping box so it can rise from behind a mask. */
  mask?: boolean
}

/**
 * Word-level split for display type.
 *
 * Accessibility contract:
 * - The full string stays in the accessibility tree. Headings carry it as
 *   `aria-label` (a heading's name may come from the author), everything else
 *   carries it as a visually hidden text node.
 * - Every decorative fragment is `aria-hidden`, so the split is invisible to
 *   assistive tech and to text search: one clean sentence, not seven spans.
 * - Nothing is hidden by CSS. The words are laid out at full opacity in the
 *   stylesheet; only JS (GSAP, in the section that owns the intro) may move
 *   them. If the script never runs, or fails, the text is already readable.
 */
export default function SplitText({ text, as = 'span', className, mask = true }: SplitTextProps) {
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

  const Tag = as
  const named = as === 'h1' || as === 'h2' || as === 'h3'

  return (
    <Tag
      className={className ? `split ${className}` : 'split'}
      data-split=""
      {...(named ? { 'aria-label': text } : {})}
    >
      {/* Headings are named by aria-label; other elements need a real text node
          because browsers refuse to name a generic element from aria-label. */}
      {named ? null : <span className="sr-only">{text}</span>}
      {units}
    </Tag>
  )
}

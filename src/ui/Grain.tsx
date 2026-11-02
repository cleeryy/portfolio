import './ui.css'

/**
 * Plotter-sheet tooth.
 *
 * A single fixed layer of fine monochrome noise at very low opacity. It is what
 * keeps large flat areas of the ground from reading as a CSS colour swatch: a
 * printed sheet has texture, a div does not.
 *
 * No blend mode on purpose — `multiply` over a WebGL canvas that repaints would
 * force a full-screen blend every frame, and the gain is invisible at this
 * opacity. `aria-hidden` and pointer-transparent: it is paper, not content.
 */
export default function Grain() {
  return <div className="grain" aria-hidden="true" />
}

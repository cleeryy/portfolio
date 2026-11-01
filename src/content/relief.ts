import type { Bi } from '../lib/i18n'

/**
 * The relief — two lines of copy, written twice.
 *
 * This section is an asset, not a chapter: a plate reference, one sentence that
 * says what the object is and where it goes, and the coordinate the crimson
 * tick marks. No claim, no flourish, no "journey". A reader who skips the
 * drawing still knows what they skipped.
 */
export type ReliefCopy = {
  /** The plate's name. One word, and the same word in both languages. */
  title: string
  /** Two sentences: what it is, and what the next section does with it. */
  line: string
  /** The coordinate the single crimson tick marks, printed in the margin. */
  coord: string
  /** `{n}` is replaced with the level count the model was actually built at. */
  contours: string
  /** The honest scale note of a plate drawn to composition, not to ground. */
  scale: string
}

export const RELIEF_REF = '#relief'

export const reliefCopy: Bi<ReliefCopy> = {
  en: {
    title: 'Relief',
    line: 'The ground the network stands on, cut into contour plates. The next section draws the same terrain at full size.',
    coord: '43.6045° N 1.4442° E',
    contours: '{n} contours',
    scale: 'not to scale',
  },
  fr: {
    title: 'Relief',
    line: 'Le sol sur lequel le réseau repose, découpé en courbes de niveau. La section suivante dessine ce même terrain à taille réelle.',
    coord: '43.6045° N 1.4442° E',
    contours: '{n} courbes',
    scale: 'sans échelle',
  },
}

import type { Bi } from '../lib/i18n'

/* ============================================================================
   #ascii — the schematic, printed as text
   ----------------------------------------------------------------------------
   The copy has one job: say that this is not a second drawing. It is the same
   survey, set again — the plate above is line-work, this one is characters —
   and then get out of the way of the plate.

   The legend is the only technical prose the section is allowed. Every key is a
   character the plate actually prints, and the note explains the two things a
   character grid cannot say by itself: a three-cell peg is a guest hanging from
   a node, and a gap in a link is the backup branch.

   French is written, not translated: same claim, French punctuation.
   ========================================================================== */

export type AsciiLegendItem = {
  /** The character(s) printed in the drawing. */
  glyph: string
  label: string
  /** The control point is the one crimson cluster, and its key says so. */
  mark?: boolean
  /** A canvas-only mark: the text fallback has no atmosphere to print. */
  field?: boolean
}

export type AsciiCopy = {
  title: string
  lead: string
  plateLabel: string
  plateScale: string
  gridLabel: string
  counts: { marks: string; links: string }
  legendLabel: string
  legend: AsciiLegendItem[]
  legendNote: string
  /** The resting reading line, on a fine pointer. */
  read: string
  /** The resting reading line, on a phone. */
  readTap: string
  fallbackLabel: string
  /** Spoken description of the plate, for the reader who cannot see it. */
  diagram: string
}

export const asciiCopy: Bi<AsciiCopy> = {
  en: {
    title: 'The same survey, set in type.',
    lead: 'The drawing above is printed a second time on this plate, and here it is a text: every cell is one character, chosen for the way its ink lies along the line that crosses it.',
    plateLabel: 'character plate',
    plateScale: 'one cell, one character',
    gridLabel: 'grid',
    counts: { marks: 'marks', links: 'links' },
    legendLabel: 'Legend',
    legend: [
      { glyph: '+', label: 'node' },
      { glyph: ':', label: 'service' },
      { glyph: '*', label: 'control point', mark: true },
      { glyph: '/ — \\ |', label: 'link, by direction' },
      { glyph: "'", label: 'contour field', field: true },
    ],
    legendNote:
      'A three-cell peg is a guest hanging from a node; a whole-cell gap in a link is the backup branch. The full inventory is the register above, under #territory.',
    read: 'point at a mark to read its chain',
    readTap: 'tap a mark to read its chain',
    fallbackLabel: 'no canvas — the plate is printed as text',
    diagram:
      'The same stations and the same links as the territory plate, set as characters in three strata: edge at the top, fabric in the middle, services at the foot. The control point is the only crimson cluster; every other cell is a character chosen for the direction of the line that passes through it.',
  },
  fr: {
    title: 'Le même relevé, composé en caractères.',
    lead: 'Le dessin ci-dessus est imprimé une seconde fois sur cette planche, et ici c’est un texte\u00a0: chaque case est un caractère, choisi pour la façon dont son encre épouse la ligne qui la traverse.',
    plateLabel: 'planche de caractères',
    plateScale: 'une case, un caractère',
    gridLabel: 'grille',
    counts: { marks: 'marques', links: 'liens' },
    legendLabel: 'Légende',
    legend: [
      { glyph: '+', label: 'nœud' },
      { glyph: ':', label: 'service' },
      { glyph: '*', label: 'point de contrôle', mark: true },
      { glyph: '/ — \\ |', label: 'lien, selon la direction' },
      { glyph: "'", label: 'champ de courbes', field: true },
    ],
    legendNote:
      'Un trait de trois cases est un invité suspendu à un nœud\u00a0; une case vide dans un lien est la branche de sauvegarde. L’inventaire complet est le registre plus haut, sous #territory.',
    read: 'pointez une marque pour lire sa chaîne',
    readTap: 'touchez une marque pour lire sa chaîne',
    fallbackLabel: 'sans canvas — la planche est imprimée en texte',
    diagram:
      'Les mêmes stations et les mêmes liens que la planche du territoire, composés en caractères sur trois strates\u00a0: la bordure en haut, le socle au milieu, les services au pied. Le point de contrôle est le seul amas cramoisi\u00a0; chaque autre case est un caractère choisi pour la direction de la ligne qui la traverse.',
  },
}

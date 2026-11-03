import type { Bi } from '../lib/i18n'
import { fr } from '../lib/typo'

/* ============================================================================
   statement.ts — the chapter that is only a sentence
   ----------------------------------------------------------------------------
   One paragraph, set at plate scale, that prints itself word by word as the
   reader scrolls. Three devices inside the text, and nothing else:

   - `strong` — the word is set heavier and wider, and it answers the pointer by
     rolling (the site's existing width-axis device);
   - `plate` — the word stays in the sentence, in ink, and its project's seal is
     printed behind it as a low-density field. Hovering it lifts the full plate,
     so the sentence can be played with;
   - everything else — plain ink.

   The paragraph is the same claim as the cover, one register lower: not "look at
   my stack", but "this is a thing I keep alive". No number that is not on the
   rest of the sheet.
   ========================================================================== */

export type StatementPart = {
  /** The visible word or fragment. Never invented: it is the sentence. */
  text: string
  /** Set heavier + wider, and rolling on hover. */
  strong?: boolean
  /** Printed on the plate of this project slug (`content/work.ts`). */
  plate?: string
}

export type StatementCopy = {
  margin: string
  /** Earlier line, set small, above the paragraph. */
  lead: string
  lines: StatementPart[][]
  /** Printed after the paragraph, in mono. */
  note: string
  /** The plate's caption when a word is hovered. */
  hint: string
}

export const statement: Bi<StatementCopy> = {
  en: {
    margin: 'statement',
    lead: 'Read it as a sentence, not as a list.',
    lines: [
      [{ text: 'I don’t rent my infrastructure. I ' }, { text: 'run', strong: true }, { text: ' it.' }],
      [
        { text: 'Twenty projects, one cluster, eight segments, and a backup I have ' },
        { text: 'restored', plate: 'lab' },
        { text: '.' },
      ],
      [
        { text: 'A network is not a diagram you draw once — it is a thing you keep ' },
        { text: 'alive', strong: true },
        { text: '.' },
      ],
    ],
    note: 'the same claim as the cover, one register lower',
    hint: 'the plate is a project — open it',
  },
  fr: {
    margin: 'déclaration',
    lead: fr('À lire comme une phrase, pas comme une liste.'),
    lines: [
      [{ text: fr('Je ne loue pas mon infrastructure. Je l’') }, { text: 'exploite', strong: true }, { text: '.' }],
      [
        { text: fr('Vingt projets, un cluster, huit segments, et une sauvegarde que j’ai ') },
        { text: 'restaurée', plate: 'lab' },
        { text: '.' },
      ],
      [
        { text: fr('Un réseau n’est pas un schéma qu’on dessine une fois — c’est une chose qu’on maintient en ') },
        { text: 'vie', strong: true },
        { text: '.' },
      ],
    ],
    note: fr('la même affirmation que la couverture, un registre plus bas'),
    hint: fr('la planche est un projet — ouvrez-la'),
  },
}

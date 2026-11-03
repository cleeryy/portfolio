import type { Bi } from '../lib/i18n'
import { fr } from '../lib/typo'

/* ============================================================================
   browse.ts — the index, as a wall of plates
   ----------------------------------------------------------------------------
   The section that lets a visitor *play* with the register instead of reading it:
   a list of names, and a plate that comes to the pointer when one is named.

   No photography, no screenshot: the plate is drawn from the project's own data —
   its seal, its stack, its state, its year — because a fake screenshot of a
   private service would be a lie. The plate is the same object as the file's
   header, at poster size.
   ========================================================================== */

export type BrowseCopy = {
  title: string
  lead: string
  hint: string
  /** Printed on the plate, under the name. */
  plateNote: string
  /** The line under the list. */
  foot: string
  openAll: string
}

export const browse: Bi<BrowseCopy> = {
  en: {
    title: 'Open a file.',
    lead: 'Twenty projects, from a two-node cluster to a painting app. Point at a name — the plate comes to you.',
    hint: 'point at a name',
    plateNote: 'plate',
    foot: 'Every file has a page: what it is, what I did, where it stands.',
    openAll: 'The whole register',
  },
  fr: {
    title: fr('Ouvrir une fiche.'),
    lead: fr('Vingt projets, d’un cluster à deux nœuds à une application de peinture. Pointez un nom — la planche vient à vous.'),
    hint: fr('pointez un nom'),
    plateNote: 'planche',
    foot: fr('Chaque fiche a sa page\u00a0: ce que c’est, ce que j’ai fait, où ça en est.'),
    openAll: 'Tout le registre',
  },
}

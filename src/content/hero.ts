import type { Bi } from '../lib/i18n'
import { fr } from '../lib/typo'

/* ============================================================================
   hero.ts — the cover
   ----------------------------------------------------------------------------
   The cover is type on a sheet, not a diagram. The old survey plot is gone: the
   first drawing on this site is now the section, printed at the foot of the
   viewport — four bands, hairline rules, one reading each. It is drawn in DOM,
   so it cannot fail, cannot blank, and costs no frame.

   Copy rules:
   - the claim is one sentence, present tense, first person, no metaphor;
   - the note gives the four numbers that make the claim checkable;
   - nothing claims availability, a job title, or a date the owner has not
     stated. `readings` are facts, not scoreboard.
   ========================================================================== */

export type HeroReadout = {
  key: string
  label: string
  value: string
}

/** One band of the section drawing at the foot of the cover. */
export type HeroBand = {
  /** Two digits, printed in the margin of the band. */
  ref: string
  name: string
  /** The instruments that live in this band, in mono. */
  detail: string
  /** The one reading the band is worth. */
  value: string
}

export type HeroCopy = {
  kicker: string
  claim: string
  note: string
  primaryCta: string
  secondaryCta: string
  /** Caption over the section drawing. */
  figureLabel: string
  /** Caption under the section drawing. */
  figureNote: string
  /** Margin annotation next to the handle. */
  margin: string
  scaleNote: string
  readouts: HeroReadout[]
  bands: HeroBand[]
}

/**
 * Language-invariant: the graticule reference printed behind the handle. This is
 * the production VLAN of the operator's own plan — an RFC1918 block, so it is a
 * coordinate, not a disclosure.
 */
export const gridReference = '10.1.20.x'

export const hero: Bi<HeroCopy> = {
  en: {
    kicker: 'Toulouse, FR — infrastructure & security',
    claim: 'I run the network I learn on.',
    note: 'Two Proxmox nodes, eight network segments, forty-five services, and a backup I restore on purpose. Third year at ESGI Toulouse, three afternoons a week in a company’s IT department, the rest in the lab.',
    primaryCta: 'See the work',
    secondaryCta: 'Open the map',
    figureLabel: 'cut through the stack',
    figureNote: 'the same territory, drawn flat',
    margin: 'cover sheet — 01',
    scaleNote: 'surveyed from Toulouse',
    readouts: [
      { key: 'nodes', label: 'nodes', value: '2' },
      { key: 'guests', label: 'guests', value: '52' },
      { key: 'services', label: 'services', value: '45' },
      { key: 'routes', label: 'routes', value: '66' },
    ],
    bands: [
      { ref: '01', name: 'edge', detail: 'opnsense · caddy · warpgate', value: 'one door' },
      { ref: '02', name: 'fabric', detail: 'pve1 · pve3 · vmbr1', value: '2 nodes' },
      { ref: '03', name: 'services', detail: 'mail · photos · git · media', value: '45 documented' },
      { ref: '04', name: 'backup', detail: 'pbs · rclone crypt', value: 'restored 09/2026' },
    ],
  },
  fr: {
    kicker: fr('Toulouse, FR — infrastructure & sécurité'),
    claim: fr('J’exploite le réseau sur lequel j’apprends.'),
    note: fr('Deux nœuds Proxmox, huit segments réseau, quarante-cinq services et une sauvegarde que je restaure exprès. Troisième année à l’ESGI Toulouse, trois après-midis par semaine dans l’informatique d’une entreprise, le reste au labo.'),
    primaryCta: 'Voir les projets',
    secondaryCta: 'Ouvrir la carte',
    figureLabel: fr('coupe dans la pile'),
    figureNote: fr('le même territoire, à plat'),
    margin: 'feuille de couverture — 01',
    scaleNote: fr('relevé depuis Toulouse'),
    readouts: [
      { key: 'nodes', label: 'nœuds', value: '2' },
      { key: 'guests', label: 'invités', value: '52' },
      { key: 'services', label: 'services', value: '45' },
      { key: 'routes', label: 'routes', value: '66' },
    ],
    bands: [
      { ref: '01', name: 'bordure', detail: 'opnsense · caddy · warpgate', value: 'une seule porte' },
      { ref: '02', name: 'socle', detail: 'pve1 · pve3 · vmbr1', value: '2 nœuds' },
      { ref: '03', name: 'services', detail: 'mail · photos · git · médias', value: '45 documentés' },
      { ref: '04', name: 'sauvegarde', detail: 'pbs · rclone crypt', value: 'restauré 09/2026' },
    ],
  },
}

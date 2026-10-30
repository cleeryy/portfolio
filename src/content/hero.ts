import type { Bi } from '../lib/i18n'

/**
 * Every string the hero needs, in both languages.
 *
 * The module is `Bi<HeroCopy>`: the language split happens once, at the top, and
 * each branch holds plain strings.
 *
 * Copy rule for this file: nothing is invented. No metrics, no dates, no
 * employers. The cluster names and the edge stack are the operator's own; the
 * rest is deliberately qualitative. A number that cannot be verified does not
 * appear.
 */

export type HeroReadout = {
  /** Stable key for list rendering. */
  key: string
  label: string
  value: string
}

export type HeroCopy = {
  /** One line, the whole position. Sets the register for the page. */
  claim: string
  /** Two sentences of context. Never repeats the claim. */
  note: string
  primaryCta: string
  secondaryCta: string
  /** Copy for the map collar's scale block. */
  scaleNote: string
  /** Honest status readings, rendered as a survey legend. */
  readouts: HeroReadout[]
}

/** Language-invariant: a handle is a handle. */
export const handle = 'cleeryy'

/**
 * Language-invariant: the graticule reference printed behind the handle. This is
 * the production VLAN of the operator's own network plan — an RFC1918 block, so
 * it is a coordinate, not a disclosure.
 */
export const gridReference = '10.1.20.x'

export const hero: Bi<HeroCopy> = {
  en: {
    claim: "I run my own network end to end, and train on everyone else's.",
    note: 'Hypervisor, edge firewall, tunnel, reverse proxy, backups. The plot behind this text is the one I actually operate — the ranges are where I practise on networks that are not mine.',
    primaryCta: 'Open the map',
    secondaryCta: 'The operator',
    scaleNote: 'one room, no rented cloud',
    readouts: [
      { key: 'site', label: 'site', value: 'home lab, FR' },
      { key: 'cluster', label: 'cluster', value: 'pve1 + pve3' },
      { key: 'edge', label: 'edge', value: 'OPNsense + WireGuard' },
      { key: 'backup', label: 'backup', value: 'PBS + offsite' },
    ],
  },
  fr: {
    claim: "J'exploite mon réseau de bout en bout, et je m'entraîne sur celui des autres.",
    note: "Hyperviseur, pare-feu périmétrique, tunnel, reverse proxy, sauvegardes. La carte derrière ce texte est celle que j'exploite vraiment\u00a0; les terrains d'entraînement, eux, ne m'appartiennent pas.",
    primaryCta: 'Ouvrir la carte',
    secondaryCta: "L'opérateur",
    scaleNote: 'une pièce, aucun cloud loué',
    readouts: [
      { key: 'site', label: 'site', value: 'labo maison, FR' },
      { key: 'cluster', label: 'cluster', value: 'pve1 + pve3' },
      { key: 'edge', label: 'périmètre', value: 'OPNsense + WireGuard' },
      { key: 'backup', label: 'sauvegarde', value: 'PBS + hors site' },
    ],
  },
}

import type { Bi } from '../lib/i18n'

/**
 * Every string the hero needs, in both languages.
 *
 * The module is `Bi<HeroCopy>`: the language split happens once, at the top, and
 * each branch holds plain strings.
 *
 * Copy rule for this file: the claim does two things in one breath — what he has
 * built, and the contract he is asking for. The note names the two roles, the
 * city and the two years, then points at the two halves of the page that can be
 * checked. The four collar readings are the CV's headline facts, each traceable
 * to FACTS.md (§3 for the degree, §6 for the competition, §7 for the cluster and
 * the published routes). No score, no rank, no date the owner has not stated.
 */

export type HeroReadout = {
  /** Stable key for list rendering. */
  key: string
  label: string
  value: string
}

export type HeroCopy = {
  /** One line, the whole position: proof, then the request. */
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
    claim: "I run my own network end to end. I'm looking for an alternance in cybersecurity.",
    note: "SOC or offensive security, Toulouse, 2026–2027. The plot behind this text is the network I actually operate; the dark chapter below is the training record I can show.",
    primaryCta: 'Read the path',
    secondaryCta: 'See the network',
    scaleNote: 'surveyed from Toulouse',
    readouts: [
      { key: 'study', label: 'studying', value: 'ESGI B3, SRC' },
      { key: 'ctf', label: 'ctf', value: 'THCon 2025' },
      { key: 'cluster', label: 'cluster', value: '52 guests' },
      { key: 'routes', label: 'reverse proxy', value: '39 public routes' },
    ],
  },
  fr: {
    claim: 'J’exploite mon réseau de bout en bout. Je cherche une alternance en cybersécurité.',
    note: 'SOC ou sécurité offensive, Toulouse, 2026–2027. La carte derrière ce texte est le réseau que j’exploite vraiment\u00a0; le chapitre sombre plus bas, le relevé d’entraînement que je peux montrer.',
    primaryCta: 'Lire le parcours',
    secondaryCta: 'Voir le réseau',
    scaleNote: 'relevé depuis Toulouse',
    readouts: [
      { key: 'study', label: 'études', value: 'ESGI B3, SRC' },
      { key: 'ctf', label: 'ctf', value: 'THCon 2025' },
      { key: 'cluster', label: 'cluster', value: '52 invités' },
      { key: 'routes', label: 'reverse proxy', value: '38 routes publiques' },
    ],
  },
}

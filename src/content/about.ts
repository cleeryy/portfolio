import type { Bi } from '../lib/i18n'

/**
 * The operator, first person, short.
 *
 * Three paragraphs, in this order and no other: where he stands (the degree and
 * the mandate), what he does in parallel (three afternoons a week, no employer
 * named and no contract type asserted), and what the evenings go to plus the
 * contract he is asking for.
 *
 * What is not in this file: an employer, a job title, a certification, a
 * portrait, a "passionate about cybersecurity" opening. He holds no certification
 * yet and that is written plainly, in the prose, rather than implied by a logo.
 *
 * The French is written as French, not as a translation of the English: same
 * position, different sentence. That is the rule for every content module.
 *
 * Shape of the section: a margin column of annotations, one reading column of
 * prose. `timeline` is retired — see the note above it. Nothing in this module
 * may grow a third column.
 */

export type AboutAnnotation = {
  /** The key, not a heading: a field card is read in glances. */
  key: string
  value: string
}

export type AboutCopy = {
  title: string
  /** Two or three short paragraphs. First person, no CV theatre. */
  paragraphs: string[]
  /** Margin annotations, printed at the foot of the reading column. */
  annotations: AboutAnnotation[]
  /** Only rendered when `timeline` has entries. */
  timelineLabel: string
}

export const about: Bi<AboutCopy> = {
  en: {
    title: 'I would rather read a system than trust it.',
    paragraphs: [
      'I am in my third year at ESGI Toulouse: Bachelor 3, programme “SRC”, 2026–2027.',
      'Three afternoons a week, alongside the degree, I work with an IT company in Toulouse — since May 2026.',
      'The rest of my time goes to the lab, to writeups, or to a tool I was missing. No certification yet: what I have is a network I run end to end and writeups anyone can read. What I want next is an alternance in a SOC or on an offensive team, in Toulouse, for 2026–2027.',
    ],
    annotations: [
      { key: 'based', value: 'Toulouse, FR' },
      { key: 'seeking', value: 'alternance, SOC or pentest' },
    ],
    timelineLabel: 'parcours',
  },
  fr: {
    title: 'Je préfère lire un système plutôt que lui faire confiance.',
    paragraphs: [
      'Je suis en troisième année à l’ESGI Toulouse\u00a0: Bachelor 3, programme «\u00a0SRC\u00a0», 2026–2027.',
      'Trois après-midis par semaine, en marge du cursus, je travaille avec une entreprise informatique de Toulouse — depuis mai 2026.',
      'Le reste du temps va au labo, aux writeups, ou à l’outil qui me manquait. Aucune certification à ce jour\u00a0: ce que j’ai, c’est un réseau que j’exploite de bout en bout et des writeups que n’importe qui peut lire. Ce que je cherche maintenant, c’est une alternance en SOC ou en sécurité offensive, à Toulouse, pour 2026–2027.',
    ],
    annotations: [
      { key: 'basé', value: 'Toulouse, FR' },
      { key: 'recherche', value: 'alternance, SOC ou pentest' },
    ],
    timelineLabel: 'parcours',
  },
}

export type CareerEntry = {
  /** Four digits, or an open range such as `'2023—'`. Never invented. */
  year: string
  label: Bi
  /** Optional line: what the year was, in one sentence. */
  note?: Bi
}

/**
 * The career ledger — retired.
 *
 * It stays exported and empty on purpose: `#path` now carries the dated parcours,
 * and this section does not read it any more. `About.tsx` still guards on the
 * length, so a list could come back here without a redesign, but the chronology
 * belongs to `#path` and must not be written twice.
 */
export const timeline: CareerEntry[] = []

/*
 * Certifications: no list is exported and none is rendered. He holds none, and
 * the About prose says so in one clause. If one is ever earned and considered
 * relevant, it becomes its own typed export here and its own branch in
 * `About.tsx` — never a logo strip, and never implied by copy.
 */

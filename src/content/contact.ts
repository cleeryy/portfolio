import type { Bi } from '../lib/i18n'
import { fr } from '../lib/typo'
import { cover } from './cover'
import { featured, projects } from './work'

/* ============================================================================
   contact.ts — the closing plate
   ----------------------------------------------------------------------------
   One invitation, three addresses, the sheet's own manifest, the colophon. No
   form, no availability badge, no invented start date: the ask is an invitation
   to write, not a claim about when he is free.

   The docket is derived, never typed. The register owns how many files the sheet
   carries, the cover owns how many nodes, services and routes it was drawn from,
   and this file only counts them — so adding a project to `work.ts` moves the
   slip in the same commit, and the sheet cannot print a number it no longer
   has. A reading that cannot be found throws at import: a docket that quietly
   reports zero is worse than one that does not print at all.

   The email is supplied by the owner and is the one value in this file that is
   not prose.
   ========================================================================== */

/** Approved by the owner. The primary call to action of the whole sheet. */
export const contactEmail = 'clery.arqueferradou@gmail.com'

/** The public profile he actually uses. No logo wall, no other network. */
export const sourceUrl = 'https://github.com/cleeryy'
export const sourceLabel = 'github.com/cleeryy'

/** Where the writeups are published. */
export const blogUrl = 'https://blog.cleeryy.cloud'
export const blogLabel = 'blog.cleeryy.cloud'

/** The home sheet prints eight sections, this one included. */
const CHAPTERS = 8

/** The five plates under `featured`, plus the closing plate the reader is on. */
const PLATES = featured.length + 1

/** Every project with a file in the register. */
const RECORDS = projects.length

/** The docket is a dated print. Its edition does not roll with the clock the
 *  way the copyright line does. */
const EDITION = 2026

/**
 * One reading off the cover, as an integer.
 *
 * The cover's readouts are the sheet's own facts; the docket quotes them rather
 * than restating them. `en` is read on purpose: a digit is the same in both
 * languages, and the label beside it is the part that gets written twice.
 */
function reading(key: string): number {
  const readout = cover.en.readouts.find((entry) => entry.key === key)
  const value = readout ? Number.parseInt(readout.value, 10) : Number.NaN
  if (!Number.isFinite(value)) throw new Error(`contact.ts: the cover has no "${key}" reading`)
  return value
}

/**
 * What the sheet counts, stated once — every value the docket prints. The
 * padding to two digits happens at the point of print (`two`): `08`, not `8`, so
 * the column of values has one width and can be set flush.
 */
export const sheetManifest = {
  chapters: CHAPTERS,
  plates: PLATES,
  records: RECORDS,
  nodes: reading('nodes'),
  services: reading('services'),
  routes: reading('routes'),
} as const

/** Two digits, the way a printed docket counts. */
const two = (value: number) => String(value).padStart(2, '0')

export type DocketRow = {
  key: string
  value: string
}

export type DocketCopy = {
  /** The margin annotation: it names the artefact, not the slip's masthead. */
  rail: string
  /** The slip's own masthead, printed at its head. */
  kicker: string
  /** The docket's number and edition, printed at the head of the slip. */
  ref: string
  title: string
  rows: DocketRow[]
  totalLabel: string
  totalValue: string
  stamp: string
  foot: string
}

export type ContactCopy = {
  margin: string
  title: string
  invite: string
  mailKey: string
  codeKey: string
  blogKey: string
  docket: DocketCopy
  credit: string
  backToTop: string
  scaleNote: string
}

type DocketLabels = {
  chapters: string
  plates: string
  records: string
  nodes: string
  services: string
  routes: string
}

/** The six rows, from the one manifest. The labels are the only translated part. */
function docketRows(labels: DocketLabels): DocketRow[] {
  return [
    { key: labels.chapters, value: two(sheetManifest.chapters) },
    { key: labels.plates, value: two(sheetManifest.plates) },
    { key: labels.records, value: two(sheetManifest.records) },
    { key: labels.nodes, value: two(sheetManifest.nodes) },
    { key: labels.services, value: two(sheetManifest.services) },
    { key: labels.routes, value: two(sheetManifest.routes) },
  ]
}

export const contact: Bi<ContactCopy> = {
  en: {
    margin: 'the request',
    title: 'An alternance in a SOC, or on the offensive side.',
    invite:
      'That is what I am looking for. I also answer anything else: what the system is, what is broken, or what you want built. A paragraph is enough — I answer.',
    mailKey: 'mail',
    codeKey: 'code',
    blogKey: 'writing',
    docket: {
      rail: 'closing slip',
      kicker: 'sheet manifest',
      ref: `no. ${two(sheetManifest.chapters)} / ${EDITION}`,
      title: 'The sheet, itemised.',
      rows: docketRows({
        chapters: 'chapters',
        plates: 'plates',
        records: 'records',
        nodes: 'nodes',
        services: 'services',
        routes: 'routes',
      }),
      totalLabel: 'the ask',
      totalValue: 'one letter',
      stamp: 'filed',
      foot: 'alternance · SOC or offensive · Toulouse',
    },
    credit: 'drawn and hosted by cleeryy',
    backToTop: 'Back to the top of the sheet',
    scaleNote: 'not to scale',
  },
  fr: {
    margin: 'la demande',
    title: fr('Une alternance en SOC, ou en sécurité offensive.'),
    invite: fr('C’est ce que je cherche. Je réponds aussi pour le reste\u00a0: ce qu’est le système, ce qui est cassé, ou ce que vous voulez construire. Un paragraphe suffit — je réponds.'),
    mailKey: 'courriel',
    codeKey: 'code',
    blogKey: 'écrits',
    docket: {
      rail: fr('bordereau'),
      kicker: fr('manifeste de la feuille'),
      ref: fr(`n° ${two(sheetManifest.chapters)} / ${EDITION}`),
      title: fr('La feuille, détaillée.'),
      rows: docketRows({
        chapters: 'chapitres',
        plates: 'planches',
        records: 'fiches',
        nodes: fr('nœuds'),
        services: 'services',
        routes: 'routes',
      }),
      totalLabel: fr('la demande'),
      totalValue: fr('une lettre'),
      stamp: fr('déposé'),
      foot: fr('alternance · SOC ou offensive · Toulouse'),
    },
    credit: fr('dessiné et hébergé par cleeryy'),
    backToTop: fr('Retour en haut de la feuille'),
    scaleNote: 'sans échelle',
  },
}

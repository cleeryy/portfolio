import type { Bi } from '../lib/i18n'
import { fr } from '../lib/typo'

/* ============================================================================
   site.ts — chrome copy: the one navigation table, document metadata, the 404.
   ----------------------------------------------------------------------------
   Everything a page needs that is not the page. Kept apart from the content
   modules so a route can change its title without touching a project.

   There is exactly **one** navigation table, and it is split by what a reader
   can do with each entry:

   - `documents` are the five places a reader can open. The index overlay prints
     them at plate scale; the bar still links only to the cover, because a bar
     with six destinations in it was the thing this pass replaced.
   - `chapters` are the eight plates of the home sheet, in reading order, named
     in the site's own lowercase voice. `homeSections` is *derived* from them, so
     a chapter inserted here is known by every instrument at once (the margin
     chrome, the bar's live reading, the overlay's numbered column, the
     atmosphere's pose table) and no surface can print a plate the others do not
     have.

   `routeReading` is the bar's answer on a document that is not the cover: a
   route prints its own name and no plate number, because a route is not a plate
   of the cover. A file under `/work` reads the project's name instead, and an
   address the sheet does not hold reads `missingReading`.
   ========================================================================== */

/** A document: a place a reader can open, with the label the index prints. */
export type SiteDocument = { id: string; label: Bi; href: string }

export const documents: SiteDocument[] = [
  { id: 'work', label: { en: 'Work', fr: 'Projets' }, href: '/work' },
  { id: 'practice', label: { en: 'Practice', fr: 'Pratique' }, href: '/practice' },
  { id: 'notes', label: { en: 'Notes', fr: 'Notes' }, href: '/notes' },
  { id: 'about', label: { en: 'About', fr: fr('À propos') }, href: '/about' },
  { id: 'contact', label: { en: 'Contact', fr: 'Contact' }, href: '/#contact' },
]

/** A chapter of the home sheet: an id the section carries, and its name. */
export type Chapter = { id: string; label: Bi }

export const chapters: Chapter[] = [
  { id: 'cover', label: { en: 'cover', fr: 'couverture' } },
  { id: 'work', label: { en: 'selected work', fr: fr('travaux choisis') } },
  { id: 'index', label: { en: 'the index', fr: fr('l’index') } },
  { id: 'statement', label: { en: 'statement', fr: fr('déclaration') } },
  { id: 'territory', label: { en: 'territory', fr: 'territoire' } },
  { id: 'flight', label: { en: 'passage', fr: 'passage' } },
  { id: 'operator', label: { en: 'operator', fr: fr('l’opérateur') } },
  { id: 'contact', label: { en: 'contact', fr: 'contact' } },
]

/**
 * Home section ids, in reading order — derived from `chapters`, never written
 * twice.
 *
 * The margin chrome counts the plates from this list (`03/08`), the bar's live
 * reading names the chapter under the reading line and prints its number, the
 * index overlay prints the eight rows with the same numbers, and the
 * atmosphere's pose table is keyed by the same ids — so a chapter inserted here
 * is a chapter the whole sheet knows about, and the numbers on three surfaces
 * cannot drift apart.
 */
export const homeSections = chapters.map((chapter) => chapter.id)

/**
 * What the bar prints on a route: the route's name, no plate number. A route is
 * a document, not a plate of the cover, so counting it in eighths would be a
 * measurement of nothing.
 */
export const routeReading: Record<'work' | 'notes' | 'practice' | 'about', Bi> = {
  work: { en: 'the register', fr: 'le registre' },
  notes: { en: 'field notes', fr: fr('notes de terrain') },
  practice: { en: 'practice', fr: 'pratique' },
  about: { en: 'about', fr: fr('à propos') },
}

/**
 * An address the sheet does not hold. The 404 page and a `/work/:slug` the
 * register does not carry both read this — the bar states the fact instead of
 * going quiet.
 */
export const missingReading: Bi = { en: 'no such plate', fr: fr('planche introuvable') }

export type RouteKey = 'cover' | 'work' | 'notes' | 'practice' | 'about' | 'notFound'

export const titles: Record<RouteKey, Bi> = {
  cover: { en: 'cleeryy — infrastructure & security', fr: fr('cleeryy — infrastructure & sécurité') },
  work: { en: 'cleeryy — the register', fr: 'cleeryy — le registre' },
  notes: { en: 'cleeryy — field notes', fr: fr('cleeryy — notes de terrain') },
  practice: { en: 'cleeryy — practice', fr: 'cleeryy — pratique' },
  about: { en: 'cleeryy — about', fr: fr('cleeryy — à propos') },
  notFound: { en: 'cleeryy — no such plate', fr: 'cleeryy — planche introuvable' },
}

export const descriptions: Record<RouteKey, Bi> = {
  cover: {
    en: 'Cléry A-Ferradou, Toulouse. Two Proxmox nodes, eight network segments, forty-five services — and twenty projects, documented one file at a time.',
    fr: fr('Cléry A-Ferradou, Toulouse. Deux nœuds Proxmox, huit segments réseau, quarante-cinq services — et vingt projets, documentés fiche par fiche.'),
  },
  work: {
    en: 'Twenty projects: infrastructure, security tooling, applications and the archive. What each one is, what I did, and where it stands.',
    fr: fr('Vingt projets\u00a0: infrastructure, outils de sécurité, applications et archives. Ce que chacun est, ce que j’ai fait, et où il en est.'),
  },
  notes: {
    en: 'Posts and writeups: Proxmox, SSH, Docker, and the CTF challenges I worked through.',
    fr: fr('Articles et writeups\u00a0: Proxmox, SSH, Docker, et les challenges CTF que j’ai traversés.'),
  },
  practice: {
    en: 'Eight writeups and one CTF: the offensive record, the public accounts, and the instruments installed in the lab.',
    fr: fr('Huit writeups et un CTF\u00a0: le versant offensif, les comptes publics et les instruments installés dans le labo.'),
  },
  about: {
    en: 'The record: school, work, the lab — and what is deliberately missing from this site.',
    fr: fr('Le parcours\u00a0: l’école, le travail, le labo — et ce qui manque volontairement à ce site.'),
  },
  notFound: {
    en: 'No such plate on this sheet.',
    fr: fr('Aucune planche de ce nom sur cette feuille.'),
  },
}

export type NotFoundCopy = {
  margin: string
  title: string
  lead: string
  coverCta: string
  workCta: string
}

export const notFound: Bi<NotFoundCopy> = {
  en: {
    margin: 'plate missing',
    title: 'No such plate.',
    lead: 'The address exists, the sheet does not have it. It was renamed, or it never was.',
    coverCta: 'The cover',
    workCta: 'The register',
  },
  fr: {
    margin: 'planche absente',
    title: fr('Aucune planche de ce nom.'),
    lead: fr('L’adresse existe, la feuille ne l’a pas. Renommée, ou jamais dressée.'),
    coverCta: 'La couverture',
    workCta: 'Le registre',
  },
}

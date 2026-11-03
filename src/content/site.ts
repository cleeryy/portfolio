import type { Bi } from '../lib/i18n'
import { fr } from '../lib/typo'

/* ============================================================================
   site.ts — chrome copy: the one navigation table, document metadata, the 404.
   ----------------------------------------------------------------------------
   Everything a page needs that is not the page. Kept apart from the content
   modules so a route can change its title without touching a project.

   There is one table per kind of place, and neither is written twice:

   - `navItems` are the documents — every address the index panel prints at
     title size, in reading order. The bar no longer repeats them: the panel is
     the navigation, and this table is its only source.
   - `chapters` are the eight plates of the home sheet, with the name the bar's
     live reading and the panel's chapter column print. `homeSections` is
     *derived* from it, so a chapter inserted here is a chapter the margin
     chrome, the reading, the panel and the atmosphere's pose table all know.

   `routeReading` is what the bar prints on a document that is not the cover: a
   route states its own name and no plate number, because a route is not a plate
   of the cover and counting it in eighths would measure nothing. A file under
   `/work` states the project's name; an address the sheet does not hold states
   `missingReading`.
   ========================================================================== */

/** A document: a place a reader can open, its label, and what kind of address it is. */
export type NavItem = { id: string; label: Bi; href: string; kind: 'route' | 'anchor' }

export const navItems: NavItem[] = [
  { id: 'work', label: { en: 'Work', fr: 'Projets' }, href: '/work', kind: 'route' },
  { id: 'territory', label: { en: 'Territory', fr: 'Territoire' }, href: '/#territory', kind: 'anchor' },
  { id: 'practice', label: { en: 'Practice', fr: 'Pratique' }, href: '/practice', kind: 'route' },
  { id: 'notes', label: { en: 'Notes', fr: 'Notes' }, href: '/notes', kind: 'route' },
  { id: 'about', label: { en: 'About', fr: 'À propos' }, href: '/about', kind: 'route' },
  { id: 'contact', label: { en: 'Contact', fr: 'Contact' }, href: '/#contact', kind: 'anchor' },
]

/** A chapter of the home sheet: the id its section carries, and its name. */
export type Chapter = { id: string; label: Bi }

/**
 * The eight plates of the home sheet, in reading order. The names are lowercase
 * because the reading is a measurement printed in the margin, not a heading.
 */
export const chapters: Chapter[] = [
  { id: 'cover', label: { en: 'cover', fr: 'couverture' } },
  { id: 'work', label: { en: 'selected work', fr: fr('travaux choisis') } },
  { id: 'index', label: { en: 'index', fr: 'index' } },
  { id: 'statement', label: { en: 'statement', fr: fr('déclaration') } },
  { id: 'territory', label: { en: 'territory', fr: 'territoire' } },
  { id: 'flight', label: { en: 'the passage', fr: 'le passage' } },
  { id: 'operator', label: { en: 'operator', fr: 'opérateur' } },
  { id: 'contact', label: { en: 'contact', fr: 'contact' } },
]

/**
 * Home section ids, in reading order — derived from `chapters`, never written
 * twice. The chrome counts the plates (`03/08`), the bar's reading names the
 * chapter under the reading line, the panel prints the same eight numbers, and
 * the atmosphere's pose table is keyed by the same ids.
 */
export const homeSections = chapters.map((chapter) => chapter.id)

/** The bar's reading on a document: the route's own name, no plate number. */
export const routeReading: Record<'work' | 'notes' | 'practice' | 'about', Bi> = {
  work: { en: 'the register', fr: 'le registre' },
  notes: { en: 'field notes', fr: fr('notes de terrain') },
  practice: { en: 'practice', fr: 'pratique' },
  about: { en: 'about', fr: fr('à propos') },
}

/** An address the sheet does not hold — the 404 and a missing file both read it. */
export const missingReading: Bi = { en: 'no such plate', fr: fr('planche introuvable') }

export type RouteKey = 'cover' | 'work' | 'notes' | 'practice' | 'about' | 'notFound'

export const titles: Record<RouteKey, Bi> = {
  cover: { en: 'cleeryy — infrastructure & security', fr: fr('cleeryy — infrastructure & sécurité') },
  work: { en: 'cleeryy — the register', fr: 'cleeryy — le registre' },
  notes: { en: 'cleeryy — field notes', fr: fr('cleeryy — notes de terrain') },
  practice: { en: 'cleeryy — practice', fr: 'cleeryy — pratique' },
  about: { en: 'cleeryy — about', fr: 'cleeryy — à propos' },
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

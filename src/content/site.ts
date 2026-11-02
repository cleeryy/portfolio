import type { Bi } from '../lib/i18n'
import { fr } from '../lib/typo'

/* ============================================================================
   site.ts — chrome copy: navigation, document metadata, the 404.
   ----------------------------------------------------------------------------
   Everything a page needs that is not the page. Kept apart from the content
   modules so a route can change its title without touching a project.
   ========================================================================== */

export const navItems: { id: string; label: Bi; href: string; kind: 'route' | 'anchor' }[] = [
  { id: 'work', label: { en: 'Work', fr: 'Projets' }, href: '/work', kind: 'route' },
  { id: 'territory', label: { en: 'Territory', fr: 'Territoire' }, href: '/#territory', kind: 'anchor' },
  { id: 'practice', label: { en: 'Practice', fr: 'Pratique' }, href: '/practice', kind: 'route' },
  { id: 'notes', label: { en: 'Notes', fr: 'Notes' }, href: '/notes', kind: 'route' },
  { id: 'about', label: { en: 'About', fr: 'À propos' }, href: '/about', kind: 'route' },
  { id: 'contact', label: { en: 'Contact', fr: 'Contact' }, href: '/#contact', kind: 'anchor' },
]

/** Home section ids, in reading order. The instrument chrome counts these. */
export const homeSections = ['cover', 'work', 'territory', 'flight', 'operator', 'contact']

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

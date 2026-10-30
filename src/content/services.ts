import type { Bi } from '../lib/i18n'

/**
 * The projects — the software pinned to the sheet.
 *
 * This is the CV's engineering register, not a product page. Six entries, which
 * is the cap, chosen for a security hire: the tools that read a network, then
 * the software that ships. Every entry carries four checkable things — one line
 * of what it is, the stack in mono, the status it has today, and exactly one real
 * address (the running service, or the code when the code is the door).
 *
 * Rules:
 * - No seventh entry, nothing aspirational. Every `href` resolves today.
 * - Status is a fact read off the deployment, never a promise: `in production`
 *   only where something actually serves, `in progress` otherwise.
 * - No user counts, no star counts, no "used by" — none of it is verifiable.
 * - `stack` is set in mono, joined with `+` at render: instruments, not a
 *   sentence. Never `Node · React · Docker`, which the design refuses.
 * - The portfolio itself is deliberately absent: a slot spent on this page is a
 *   slot not spent on work the reader can judge.
 */

export type InstallationKind = 'hosted' | 'desk' | 'sheet'

export type InstallationLink = {
  /** What the click does, in two words. Set above the address. */
  label: Bi
  /** The address as printed on the sheet: no scheme, no trailing slash. */
  display: string
  href: string
}

export type Installation = {
  id: string
  /**
   * Display name, written exactly as the repository names it. A proper name is
   * the same in both languages.
   */
  name: Bi
  /** Which survey symbol marks it. See `kindLabel` for the legend. */
  kind: InstallationKind
  /** One sentence: what it is, not what it could become. */
  what: Bi
  /** Instruments, in the order they matter. Joined with `+` at render. */
  stack: string[]
  /** Where it stands today, in two or three words. */
  status: Bi
  link: InstallationLink
}

const IN_PRODUCTION: Bi = { en: 'in production', fr: 'en production' }

export const installations: Installation[] = [
  {
    id: 'cipherbot',
    name: { en: 'cipherbot', fr: 'cipherbot' },
    kind: 'hosted',
    what: {
      en: 'A Discord bot for a security community: CVE lookup on the NVD, MITRE ATT&CK techniques, RDAP, and hash or URL reputation from VirusTotal.',
      fr: 'Un bot Discord pour une communauté cybersécurité\u00a0: recherche de CVE sur le NVD, techniques MITRE ATT&CK, RDAP, et réputation de hash ou d’URL via VirusTotal.',
    },
    stack: ['Rust', 'SQLite'],
    status: IN_PRODUCTION,
    link: {
      label: { en: 'source', fr: 'code source' },
      display: 'github.com/cleeryy/cipherbot',
      href: 'https://github.com/cleeryy/cipherbot',
    },
  },
  {
    id: 'atlas-live',
    name: { en: 'atlas-live', fr: 'atlas-live' },
    kind: 'hosted',
    what: {
      en: 'A live map of the cluster: a dependency-free Python collector behind an SVG page that refreshes every 15 seconds — 52 documented flows, 17 TCP probes.',
      fr: 'Une carte du cluster en direct\u00a0: un collecteur Python sans dépendance derrière une page SVG qui se rafraîchit toutes les 15 secondes — 52 flux documentés, 17 sondes TCP.',
    },
    stack: ['Python', 'SVG', 'JavaScript'],
    status: IN_PRODUCTION,
    link: {
      label: { en: 'live map', fr: 'carte en ligne' },
      display: 'atlas.cleeryy.cloud',
      href: 'https://atlas.cleeryy.cloud',
    },
  },
  {
    id: 'vegjustice',
    name: { en: 'VegJustice', fr: 'VegJustice' },
    kind: 'hosted',
    what: {
      en: 'A Paper and Purpur plugin that runs justice, police and a judicial economy on a roleplay server — 230 commits, the project I have iterated on the longest.',
      fr: 'Un plugin Paper et Purpur qui fait tourner la justice, la police et une économie judiciaire sur un serveur RP — 230 commits, le projet que j’ai le plus itéré.',
    },
    stack: ['Java 21', 'Paper', 'Purpur'],
    status: IN_PRODUCTION,
    link: {
      label: { en: 'source', fr: 'code source' },
      display: 'git.cleeryy.cloud/cleeryy/VegJustice',
      href: 'https://git.cleeryy.cloud/cleeryy/VegJustice',
    },
  },
  {
    id: 'micforge',
    name: { en: 'micforge', fr: 'micforge' },
    kind: 'desk',
    what: {
      en: 'Real-time microphone processing on Windows: noise suppression, gate, compressor, EQ, de-esser, limiter — pure-Rust DSP, AGPL-3.0.',
      fr: 'Traitement du micro en temps réel sous Windows\u00a0: réduction de bruit, gate, compresseur, EQ, de-esser, limiteur — DSP en Rust pur, AGPL-3.0.',
    },
    stack: ['Rust', 'Tauri v2', 'cpal'],
    status: { en: 'in progress', fr: 'en cours' },
    link: {
      label: { en: 'source', fr: 'code source' },
      display: 'github.com/cleeryy/micforge',
      href: 'https://github.com/cleeryy/micforge',
    },
  },
  {
    id: 'balcon',
    name: { en: 'balcon', fr: 'balcon' },
    kind: 'hosted',
    what: {
      en: 'A modern changedetection.io: point it at a page, get told when the page changes.',
      fr: 'Un changedetection.io moderne\u00a0: on vise une page, on est prévenu quand elle change.',
    },
    stack: ['Next.js 16', 'Prisma', 'SQLite', 'FastAPI'],
    status: IN_PRODUCTION,
    link: {
      label: { en: 'source', fr: 'code source' },
      display: 'github.com/cleeryy/balcon',
      href: 'https://github.com/cleeryy/balcon',
    },
  },
  {
    id: 'mealboard',
    name: { en: 'mealboard', fr: 'mealboard' },
    kind: 'hosted',
    what: {
      en: 'A weekly meal planner and a shopping list that agree with each other, self-hosted, one SQLite file.',
      fr: 'Un planificateur de repas et une liste de courses qui s’accordent, auto-hébergés, un seul fichier SQLite.',
    },
    stack: ['Next.js', 'SQLite', 'Docker'],
    status: IN_PRODUCTION,
    link: {
      label: { en: 'live site', fr: 'site en ligne' },
      display: 'mealboard.cleeryy.cloud',
      href: 'https://mealboard.cleeryy.cloud',
    },
  },
]

export type ServicesCopy = {
  title: string
  lead: string
  /** Heading over the symbol key. */
  keyLabel: string
  /** One line per survey symbol. */
  kindLabel: Record<InstallationKind, string>
  /** Ledger column keys: the project, and its one address. */
  columnKeys: { project: string; address: string }
  /** Foot note. Explains the asymmetry of the addresses, nothing else. */
  note: string
}

export const servicesCopy: Bi<ServicesCopy> = {
  en: {
    title: 'The software I build.',
    lead: 'Six projects: what each one is, what it is built with, and whether it runs today. One address per entry — the running service, or the code.',
    keyLabel: 'key',
    kindLabel: {
      hosted: 'on a server',
      desk: 'on a desk',
      sheet: 'this sheet',
    },
    columnKeys: { project: 'project', address: 'address' },
    note: 'Where the repository is private, the link goes to the thing that runs.',
  },
  fr: {
    title: 'Les logiciels que je construis.',
    lead: 'Six projets\u00a0: ce que chacun est, avec quoi il est construit, et s’il tourne aujourd’hui. Une adresse par entrée — le service en ligne, ou le code.',
    keyLabel: 'légende',
    kindLabel: {
      hosted: 'sur un serveur',
      desk: 'sur un bureau',
      sheet: 'cette feuille',
    },
    columnKeys: { project: 'projet', address: 'adresse' },
    note: 'Quand le dépôt est privé, le lien mène à la chose qui tourne.',
  },
}

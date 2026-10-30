import type { Bi } from '../lib/i18n'

/**
 * The installations — the software pinned to the sheet.
 *
 * Gazetteer rules for this file:
 * - Four real projects, no fifth, nothing aspirational. Every `href` resolves
 *   today; there is exactly one address per entry, because a second link turns a
 *   gazetteer into a card with buttons.
 * - Mealboard's repository is private, so its only public door is the running
 *   service. That asymmetry is real and the section's foot note says so.
 * - No user counts, no "used by", no star counts: none of it is verifiable and
 *   none of it is the point.
 * - `stack` is set in mono, joined with `+` — a list of instruments, not a
 *   sentence. Never `Node · React · Docker`, which the design refuses.
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
   * Display name. Proper names are the same in both languages; a name that is
   * really a description ("This sheet") is written in each language separately
   * and the apostrophe stays typographic.
   */
  name: Bi
  /** Which survey symbol marks it. See `kindLabel` for the legend. */
  kind: InstallationKind
  /** One sentence: what it is, not what it could become. */
  what: Bi
  /** Instruments, in the order they matter. Joined with `+` at render. */
  stack: string[]
  link: InstallationLink
}

export const installations: Installation[] = [
  {
    id: 'mealboard',
    name: { en: 'Mealboard', fr: 'Mealboard' },
    kind: 'hosted',
    what: {
      en: 'A meal planner and a shopping list that agree with each other: plan the week, and the list follows.',
      fr: 'Un planificateur de repas et une liste de courses qui s’accordent\u00a0: on planifie la semaine, la liste suit.',
    },
    stack: ['Next.js', 'SQLite', 'Docker'],
    link: {
      label: { en: 'live site', fr: 'site en ligne' },
      display: 'mealboard.cleeryy.cloud',
      href: 'https://mealboard.cleeryy.cloud',
    },
  },
  {
    id: 'micforge',
    name: { en: 'MicForge', fr: 'MicForge' },
    kind: 'desk',
    what: {
      en: 'A desktop app that shapes microphone audio in real time, with a preset for the mic you actually own.',
      fr: 'Une appli de bureau qui travaille le son du micro en direct, avec un préréglage pour n’importe quel micro.',
    },
    stack: ['Rust', 'Tauri v2', 'cpal'],
    link: {
      label: { en: 'source', fr: 'code source' },
      display: 'github.com/cleeryy/micforge',
      href: 'https://github.com/cleeryy/micforge',
    },
  },
  {
    id: 'tchounis',
    name: { en: 'Tchouni’s Pharmacy', fr: 'Tchouni’s Pharmacy' },
    kind: 'hosted',
    what: {
      en: 'Coursework turned into a documentation site: each page is a file, and pushing the file publishes it.',
      fr: 'Des cours de pharmacie transformés en site de documentation\u00a0: chaque page est un fichier du dépôt, on pousse le fichier, la page est publiée.',
    },
    stack: ['Next.js', 'Fumadocs', 'MDX'],
    link: {
      label: { en: 'live site', fr: 'site en ligne' },
      display: 'tchounis-pharmacy.cleeryy.cloud',
      href: 'https://tchounis-pharmacy.cleeryy.cloud',
    },
  },
  {
    id: 'sheet',
    name: { en: 'This sheet', fr: 'Cette feuille' },
    kind: 'sheet',
    what: {
      en: 'The page you are reading: a survey drawn in React, one WebGL plot, no template.',
      fr: 'La page que vous lisez\u00a0: un relevé dessiné en React, une seule vue WebGL, aucun gabarit.',
    },
    stack: ['React', 'GSAP', 'Three.js'],
    link: {
      label: { en: 'source', fr: 'code source' },
      display: 'github.com/cleeryy/portfolio',
      href: 'https://github.com/cleeryy/portfolio',
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
  /** Ledger column keys: the installation, and its one address. */
  columnKeys: { installation: string; address: string }
  /** Foot note. Explains the asymmetry of the addresses, nothing else. */
  note: string
}

export const servicesCopy: Bi<ServicesCopy> = {
  en: {
    title: 'Built here, kept running.',
    lead: 'The things I could not find ready-made: services on the cluster, a tool for a desk, and this page. Each carries one address — the live site, or the code when the code is the only way in.',
    keyLabel: 'key',
    kindLabel: {
      hosted: 'hosted',
      desk: 'on a desk',
      sheet: 'this sheet',
    },
    columnKeys: { installation: 'installation', address: 'address' },
    note: 'Where the repository is private, the link goes to the thing that runs.',
  },
  fr: {
    title: 'Construits ici, maintenus en marche.',
    lead: 'Ce que je n’ai pas trouvé tout fait\u00a0: des services sur le cluster, un outil posé sur un bureau, et cette page. Une seule adresse chacun — le site en ligne, ou le code quand c’est le code qui ouvre la porte.',
    keyLabel: 'légende',
    kindLabel: {
      hosted: 'hébergé',
      desk: 'sur un bureau',
      sheet: 'cette feuille',
    },
    columnKeys: { installation: 'installation', address: 'adresse' },
    note: 'Quand le dépôt est privé, le lien mène à la chose qui tourne.',
  },
}

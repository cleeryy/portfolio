import type { Bi } from '../lib/i18n'

/**
 * The parcours — the sheet's one chronological register.
 *
 * Two rules govern this file, and they are the whole point of the section:
 *
 * 1. **Order.** Oldest first, keyed on the month a step starts. There is one
 *    deliberate exception, and it closes the line: the degree runs 2026–2027 and
 *    is still open, so it is the last station even though the blog relaunch
 *    (October 2026) started after it. A reader looking for a CV has to arrive at
 *    the present, not leave from it.
 *
 * 2. **Nothing inferred.** No employer name, no contract type, no rank, no
 *    certification, no date for the start of the degree: none of those are
 *    documented, so none of them are written. `what` says only what a source
 *    says. Where a public URL exists the entry carries it; where it does not,
 *    the entry is text — no placeholder, no dead link.
 *
 * Dates are held twice: `period` is the mono coordinate the reader sees
 * (`2025.04`), `datetime` is the machine-readable value for `<time>`.
 */
export type PathEntry = {
  id: string
  /** The mono coordinate: `YYYY.MM`, or a year range for a step still open. */
  period: string
  /** Machine-readable value for `<time>`. `YYYY-MM`, or `YYYY` for a range. */
  datetime: string
  title: Bi
  /** The second line: the school, the city, the home of the work. */
  organisation: Bi
  what: Bi
  /** Public and confirmed only. */
  link?: { href: string; display: string }
  /** The step in progress. Exactly one entry, and the only crimson in the section. */
  current?: true
}

const BLOG = 'https://blog.cleeryy.cloud'

export const pathEntries: PathEntry[] = [
  {
    id: 'thcon',
    period: '2025.04',
    datetime: '2025-04',
    title: { en: 'THCon 2025', fr: 'THCon 2025' },
    organisation: {
      en: 'Toulouse Hacking Convention',
      fr: 'Toulouse Hacking Convention',
    },
    what: {
      en: 'First competition on record: played remotely against the challenge servers. Misc, “neoprivesc” — privilege escalation through sudo on NixOS, 500 points.',
      fr: 'Première compétition documentée\u00a0: jouée à distance contre les serveurs de challenge. Catégorie misc, épreuve «\u00a0neoprivesc\u00a0» — élévation de privilèges via sudo sous NixOS, 500 points.',
    },
  },
  {
    id: 'writeups',
    period: '2025.11',
    datetime: '2025-11',
    title: { en: 'Seven write-ups', fr: 'Sept writeups' },
    organisation: { en: 'Hack The Box', fr: 'Hack The Box' },
    what: {
      en: 'Seven challenges solved and documented in three days: SSTI in a WordPress plugin, stored XSS with a Selenium bot, SSRF to Redis to pickle to RCE, AES-CBC bit-flipping, a 64-bit ELF, a PowerShell/.NET dropper recovered from a pcap, a Solidity contract.',
      fr: 'Sept challenges résolus et documentés en trois jours\u00a0: SSTI dans un plugin WordPress, XSS stocké avec bot Selenium, SSRF vers Redis puis pickle puis RCE, bit-flipping AES-CBC, un ELF 64 bits, un dropper PowerShell/.NET retrouvé dans un pcap, un contrat Solidity.',
    },
    link: { href: BLOG, display: 'blog.cleeryy.cloud' },
  },
  {
    id: 'parallel',
    period: '2026.05',
    datetime: '2026-05',
    title: { en: 'Three afternoons a week', fr: 'Trois après-midis par semaine' },
    organisation: { en: 'Toulouse', fr: 'Toulouse' },
    what: {
      en: 'Since May 2026, in parallel with my studies: same city, same weeks.',
      fr: 'Depuis mai 2026, en parallèle du cursus\u00a0: même ville, mêmes semaines.',
    },
  },
  {
    id: 'homelab',
    period: '2026.09',
    datetime: '2026-09',
    title: { en: 'The lab, rebuilt', fr: 'Le labo, reconstruit' },
    organisation: { en: 'Personal', fr: 'Personnel' },
    what: {
      en: 'A backup system first — Proxmox Backup Server plus an encrypted off-site copy, a restore tested and booted on 10 September — then 40+ guests moved onto the new VLANs over three days at the end of the month.',
      fr: 'Un système de sauvegarde d’abord — Proxmox Backup Server et une copie hors-site chiffrée, restore testé et démarré le 10 septembre — puis plus de 40 invités basculés sur les nouveaux VLAN en trois jours, à la fin du mois.',
    },
  },
  {
    id: 'blog',
    period: '2026.10',
    datetime: '2026-10',
    title: { en: 'The blog, back on a pipeline', fr: 'Le blog, repassé en pipeline' },
    organisation: { en: 'blog.cleeryy.cloud', fr: 'blog.cleeryy.cloud' },
    what: {
      en: 'Hugo rebuilt from a backup of the old VPS, then the whole path from commit to served page: push, CI, image scan, deploy.',
      fr: 'Hugo reconstruit depuis une sauvegarde de l’ancien VPS, puis tout le chemin du commit à la page servie\u00a0: push, CI, scan d’image, déploiement.',
    },
    link: { href: BLOG, display: 'blog.cleeryy.cloud' },
  },
  {
    id: 'esgi',
    period: '2026–2027',
    datetime: '2026',
    title: { en: 'Bachelor 3', fr: 'Bachelor 3' },
    organisation: {
      en: 'ESGI Toulouse, programme « SRC »',
      fr: 'ESGI Toulouse, programme « SRC »',
    },
    what: {
      en: 'Third year: containers, Python scripting, cryptography fundamentals, professional English, and the year project.',
      fr: 'Troisième année\u00a0: conteneurisation, scripting Python, fondamentaux de la cryptographie, anglais professionnel et projet annuel.',
    },
    current: true,
  },
]

export type PathCopy = {
  title: string
  /** One paragraph of context. */
  intro: string
  /**
   * The owner's own statement, confirmed directly: a work-study contract, in
   * cybersecurity, in Toulouse, for 2026–2027. It is not in FACTS.md, and it is
   * the only sentence in this file that is a wish rather than a record.
   */
  ask: string
  /** The register's foot: reading order and provenance, in one line. */
  note: string
  /** The mark on the step in progress. */
  nowLabel: string
}

export const pathCopy: Bi<PathCopy> = {
  en: {
    title: 'The path, surveyed.',
    intro:
      'Six entries, oldest first, each one dated: a competition played remotely on servers that are not mine, seven write-ups in three days, three afternoons a week beside the degree, a lab rebuilt, a blog put back on a pipeline.',
    ask: 'I am looking for a work-study contract in cybersecurity — SOC or offensive security — in Toulouse, for 2026–2027.',
    note: 'Oldest first, the open year last. Every step is dated; the links go to the work itself.',
    nowLabel: 'in progress',
  },
  fr: {
    title: 'Le parcours, relevé.',
    intro:
      'Six étapes, de la plus ancienne à la plus récente, toutes datées\u00a0: une compétition jouée à distance sur des serveurs qui ne sont pas les miens, sept writeups en trois jours, trois après-midis par semaine en marge du cursus, un labo reconstruit, un blog repassé en pipeline.',
    ask: 'Je cherche une alternance en cybersécurité — SOC ou sécurité offensive — à Toulouse, pour 2026–2027.',
    note: 'De la plus ancienne à la plus récente, l’étape en cours ferme la ligne. Chaque étape est datée\u00a0; les liens mènent au travail lui-même.',
    nowLabel: 'en cours',
  },
}

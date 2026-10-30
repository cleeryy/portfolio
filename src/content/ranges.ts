import type { Bi } from '../lib/i18n'

/**
 * Training, in the order a recruiter can check it.
 *
 * The register leads with evidence and only then with practice: one competition
 * played against real challenge servers, seven writeups published on the blog,
 * and only afterwards the four platforms where the rest of the hours go.
 *
 * Copy rules:
 * - A row carries a link only when a public page actually documents it. The
 *   platform rows therefore have no link and no handle: the owner practises
 *   there, and nothing quantitative about it is documented.
 * - No rank, no score, no streak, no count of owned machines, no "top x%". A
 *   challenge's own point value is a property of the challenge and is written as
 *   such; the player's result is never printed because it is not documented.
 * - `meta` is the one measured line under the name: a date, a format. Never a
 *   badge, never a result.
 */
export type TrainingGround = {
  id: string
  /** Proper nouns stay identical in both languages. */
  name: Bi<string>
  /** A public page that documents the row. Only set when it exists. */
  href?: string
  /** One short line under the name: a date, a format. */
  meta?: Bi
  /** What it was, or what he does there — never what he scored. */
  focus: Bi
}

const BLOG = 'https://blog.cleeryy.cloud'

/** The record: what can be opened and read. */
export const evidence: TrainingGround[] = [
  {
    id: 'thcon',
    name: { en: 'THCon 2025', fr: 'THCon 2025' },
    meta: { en: '12 April 2025', fr: '12 avril 2025' },
    focus: {
      en: 'The Toulouse Hacking Convention, played remotely against the challenge servers. Misc, “neoprivesc”, 500 points: privilege escalation through sudo on NixOS.',
      fr: 'La Toulouse Hacking Convention, jouée à distance contre les serveurs de challenge. Catégorie misc, épreuve «\u00a0neoprivesc\u00a0», 500 points\u00a0: élévation de privilèges via sudo sous NixOS.',
    },
  },
  {
    id: 'writeups',
    name: { en: 'Seven writeups', fr: 'Sept writeups' },
    href: BLOG,
    meta: { en: '26–28 November 2025', fr: '26–28 novembre 2025' },
    focus: {
      en: 'One page per class of bug: SSTI in a WordPress plugin (CVE-2024-6386), stored XSS with a Selenium bot, SSRF to Redis to pickle to RCE, AES-CBC bit-flipping, a 64-bit ELF reversed, a PowerShell/.NET dropper and its pcap, a Solidity contract.',
      fr: 'Une page par classe de faille\u00a0: SSTI dans un plugin WordPress (CVE-2024-6386), XSS stocké avec un bot Selenium, SSRF vers Redis puis pickle puis RCE, bit-flipping AES-CBC, rétro-ingénierie d’un ELF 64 bits, un dropper PowerShell/.NET et son pcap, un contrat Solidity.',
    },
  },
]

/** The practice: named grounds, no profile, no number. */
export const platforms: TrainingGround[] = [
  {
    id: 'thm',
    name: { en: 'TryHackMe', fr: 'TryHackMe' },
    focus: {
      en: 'Guided rooms. What I use when a subject has to be covered end to end rather than in one hard corner of it.',
      fr: 'Des rooms guidées. Ce que j’utilise quand un sujet doit être couvert de bout en bout plutôt que dans un coin difficile.',
    },
  },
  {
    id: 'htb',
    name: { en: 'Hack The Box', fr: 'Hack The Box' },
    focus: {
      en: 'Bare machines, no hints: enumeration, foothold, privilege escalation. The evening spent stuck is the lesson.',
      fr: 'Des machines nues, sans indice\u00a0: énumération, pied dans la place, élévation de privilèges. La soirée passée bloqué est la leçon.',
    },
  },
  {
    id: 'rootme',
    name: { en: 'Root-Me', fr: 'Root-Me' },
    focus: {
      en: 'The French challenge library: web, crypto, network, forensics. Small, precise problems that fit in an hour.',
      fr: 'La bibliothèque de challenges française\u00a0: web, crypto, réseau, forensics. Des problèmes petits et précis, qui tiennent dans une heure.',
    },
  },
  {
    id: 'portswigger',
    name: { en: 'PortSwigger Web Security Academy', fr: 'PortSwigger Web Security Academy' },
    focus: {
      en: 'Web security, class by class: injection, broken authentication, request smuggling. Written by the people who make Burp Suite.',
      fr: 'La sécurité web, classe par classe\u00a0: injection, authentification cassée, request smuggling. Écrite par ceux qui font Burp Suite.',
    },
  },
]

export type RangesCopy = {
  title: string
  /** Two paragraphs: the record first, then the practice. */
  intro: string[]
  columnKeys: { ground: string; practice: string }
  registerNote: string
}

export const rangesCopy: Bi<RangesCopy> = {
  en: {
    title: "Other people's terrain.",
    intro: [
      'The record comes first. A challenge played against the servers of THCon 2025, then seven writeups published over three days in November 2025 — web, crypto, reverse, malware, blockchain. Each one is a page you can open and read.',
      'Then the practice, where the rest of the hours go: rooms, bare machines, the French challenge library, web security labs. No handle, no score, no rank printed here — I publish what I solve, and that is the record.',
    ],
    columnKeys: { ground: 'ground', practice: 'practice' },
    registerNote: 'No rank, no score of mine — the record is what I publish.',
  },
  fr: {
    title: 'Le terrain des autres.',
    intro: [
      'Le relevé d’abord. Une épreuve jouée contre les serveurs de la THCon 2025, puis sept writeups publiés en trois jours en novembre 2025 — web, crypto, reverse, malware, blockchain. Chacun est une page qu’on peut ouvrir et lire.',
      'Vient ensuite la pratique, là où passent les autres heures\u00a0: des rooms, des machines nues, la bibliothèque de challenges française, des labos de sécurité web. Aucun pseudo, aucun score, aucun classement ici\u00a0: je publie ce que je résous, et c’est ça qui fait foi.',
    ],
    columnKeys: { ground: 'terrain', practice: 'pratique' },
    registerNote: 'Aucun classement, aucun score personnel\u00a0: ce que je publie fait foi.',
  },
}

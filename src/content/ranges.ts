import type { Bi } from '../lib/i18n'

/**
 * Training grounds.
 *
 * Platform facts are public and safe; a profile URL exists only once cleeryy has
 * confirmed the handle used there (they differ per platform). While `profileUrl`
 * is absent the row renders as plain text — no placeholder, no "pending", no
 * dead link, no invented handle.
 *
 * Copy rule for this file: no ranks, no points, no badges, no "top x%", no count
 * of owned machines, no event names. What he does there, never what he scored.
 */
export type TrainingGround = {
  id: string
  /** Proper nouns stay identical in both languages; the CTF row does not. */
  name: Bi<string>
  /** Public home of the platform. Not rendered while no profile is confirmed. */
  url?: string
  /** Confirmed public profile, if one exists. Optional by design. */
  profileUrl?: string
  focus: Bi
}

export const platforms: TrainingGround[] = [
  {
    id: 'thm',
    name: { en: 'TryHackMe', fr: 'TryHackMe' },
    url: 'https://tryhackme.com',
    focus: {
      en: 'Guided rooms, from fundamentals to a full attack chain. The fastest way to keep breadth when one subject is not the point.',
      fr: 'Des rooms guidées, des fondamentaux à une chaîne d’attaque complète. Le moyen le plus rapide de garder de la largeur quand un seul sujet n’est pas le but.',
    },
  },
  {
    id: 'htb',
    name: { en: 'Hack The Box', fr: 'Hack The Box' },
    url: 'https://www.hackthebox.com',
    focus: {
      en: 'Bare machines, no hints: enumeration, foothold, privilege escalation. This is where being stuck for an evening is the lesson.',
      fr: 'Des machines nues, sans indice\u00a0: énumération, pied dans la place, élévation de privilèges. C’est là qu’être bloqué une soirée entière est la leçon.',
    },
  },
  {
    id: 'rootme',
    name: { en: 'Root-Me', fr: 'Root-Me' },
    url: 'https://www.root-me.org',
    focus: {
      en: 'The French challenge library: web, crypto, network, forensics. Small, specific problems that fit in an hour.',
      fr: 'La bibliothèque de challenges française\u00a0: web, crypto, réseau, forensics. Des problèmes petits et précis, qui tiennent dans une heure.',
    },
  },
  {
    id: 'portswigger',
    name: { en: 'PortSwigger Academy', fr: 'PortSwigger Academy' },
    url: 'https://portswigger.net/web-security',
    focus: {
      en: 'Web security taken seriously — every class of injection, broken authentication and request smuggling, written by the people who make Burp Suite.',
      fr: 'La sécurité web prise au sérieux — chaque classe d’injection, d’authentification cassée et de request smuggling, écrite par ceux qui font Burp Suite.',
    },
  },
]

/**
 * The competitions row: not a platform, so it carries no URL at all.
 * TODO(cleeryy): event names, once the calendar is settled. Never rendered.
 */
export const fieldwork: TrainingGround = {
  id: 'ctf',
  name: { en: 'CTF competitions', fr: 'Compétitions CTF' },
  focus: {
    en: 'Virtual and on-site events, weeks-long and one-night formats. Reading a network you have never seen, while the clock runs.',
    fr: 'Des épreuves en ligne et sur place, formats de plusieurs semaines ou d’une seule nuit. Lire un réseau jamais vu, pendant que l’horloge tourne.',
  },
}

export type RangesCopy = {
  title: string
  /** The passion beat. Two paragraphs, first person, no scoreboard. */
  intro: string[]
  columnKeys: { ground: string; practice: string }
  registerNote: string
}

export const rangesCopy: Bi<RangesCopy> = {
  en: {
    title: "Other people's terrain.",
    intro: [
      "A homelab only teaches you the mistakes you made yourself. It says nothing about the port nobody documented, the account someone opened 'temporarily' three years ago, or the service that works because of one line in a config file.",
      "That is what other people's networks are for: you arrive with no history, and you have to read the terrain before you can move through it. Guided rooms for breadth, bare machines to be properly stuck, competitions when the clock is the only thing that matters.",
    ],
    columnKeys: { ground: 'ground', practice: 'practice' },
    registerNote: 'No scores, no ranks — the practice is the record.',
  },
  fr: {
    title: 'Le terrain des autres.',
    intro: [
      'Un labo maison n’apprend que les erreurs qu’on a faites soi-même. Il ne dit rien du port que personne n’a documenté, du compte ouvert «\u00a0temporairement\u00a0» il y a trois ans, ni du service qui tient grâce à une ligne dans un fichier de configuration.',
      'C’est exactement à ça que servent les réseaux des autres\u00a0: on y arrive sans historique, et il faut lire le terrain avant de pouvoir avancer. Des rooms guidées pour la largeur, des machines nues pour être vraiment bloqué, des compétitions quand seule l’horloge compte.',
    ],
    columnKeys: { ground: 'terrain', practice: 'pratique' },
    registerNote: 'Pas de scores, pas de classements\u00a0: seule la pratique fait foi.',
  },
}

import type { Bi } from '../lib/i18n'
import { fr } from '../lib/typo'

/* ============================================================================
   practice.ts — the offensive record
   ----------------------------------------------------------------------------
   The only content module that speaks to the offensive side directly, because it
   is the side a recruiter in Toulouse will look for.

   Rules:
   - one line of technique per challenge: what the exercise actually required;
   - no score, no rank, no platform handle — none of it is documented;
   - every `href` is a real, published writeup on blog.cleeryy.cloud;
   - the tool lists are what is installed in the lab (FACTS.md), not a wish list.
   ========================================================================== */

export type RangeKind = 'ctf' | 'writeup'

export type RangeEntry = {
  id: string
  name: string
  kind: RangeKind
  year: string
  technique: Bi
  href: string
}

export const ranges: RangeEntry[] = [
  {
    id: 'neoprivesc',
    name: 'neoprivesc — THCon 2025',
    kind: 'ctf',
    year: '2025',
    technique: {
      en: 'A NixOS box, a sudo rule that looks harmless, and a way up.',
      fr: fr('Une machine NixOS, une règle sudo qui paraît inoffensive, et un chemin vers le haut.'),
    },
    href: 'https://blog.cleeryy.cloud/writeups/thcon2025/neoprivesc/',
  },
  {
    id: 'lemon-industries',
    name: 'lemon industries',
    kind: 'writeup',
    year: '2025',
    technique: {
      en: 'SSTI in a WordPress plugin — CVE-2024-6386 — with the quote filter bypassed.',
      fr: fr('SSTI dans un plugin WordPress — CVE-2024-6386 — avec le filtre de quotes contourné.'),
    },
    href: 'https://blog.cleeryy.cloud/writeups/cbc2025/lemon-industries/',
  },
  {
    id: 'notesy',
    name: 'notesy',
    kind: 'writeup',
    year: '2025',
    technique: {
      en: 'Stored XSS, and the Selenium bot that reads the note back to you.',
      fr: fr('XSS stocké, et le bot Selenium qui vous relit la note.'),
    },
    href: 'https://blog.cleeryy.cloud/writeups/cbc2025/notesy/',
  },
  {
    id: 'scrapeware',
    name: 'scrapeware',
    kind: 'writeup',
    year: '2025',
    technique: {
      en: 'SSRF into Redis, a pickle payload, and a shell.',
      fr: fr('SSRF vers Redis, une charge pickle, et un shell.'),
    },
    href: 'https://blog.cleeryy.cloud/writeups/cbc2025/scrapeware/',
  },
  {
    id: 'bankflip',
    name: 'bankflip',
    kind: 'writeup',
    year: '2025',
    technique: {
      en: 'AES-CBC bit-flipping against a Flask session, one block at a time.',
      fr: fr('Bit-flipping AES-CBC contre une session Flask, bloc par bloc.'),
    },
    href: 'https://blog.cleeryy.cloud/writeups/cbc2025/bankflip/',
  },
  {
    id: 'threekeys',
    name: 'threekeys',
    kind: 'writeup',
    year: '2025',
    technique: {
      en: 'An ELF with three AES keys and an order short enough to brute force.',
      fr: fr('Un ELF à trois clés AES et un ordre assez court pour être attaqué.'),
    },
    href: 'https://blog.cleeryy.cloud/writeups/cbc2025/threekeys/',
  },
  {
    id: 'monkey',
    name: 'monkey',
    kind: 'writeup',
    year: '2025',
    technique: {
      en: 'A PowerShell dropper, a .NET assembly, an XOR key, and the pcap behind it.',
      fr: fr('Un dropper PowerShell, un assembly .NET, une clé XOR, et le pcap derrière.'),
    },
    href: 'https://blog.cleeryy.cloud/writeups/cbc2025/monkey/',
  },
  {
    id: 'one-more-round',
    name: 'one more round',
    kind: 'writeup',
    year: '2025',
    technique: {
      en: 'Solidity reentrancy, and the accounting that hides it.',
      fr: fr('Réentrance Solidity, et la comptabilité qui la cache.'),
    },
    href: 'https://blog.cleeryy.cloud/writeups/cbc2025/one-more-round/',
  },
]

export type ToolBlock = { label: Bi; items: string[] }

export const tools: ToolBlock[] = [
  {
    label: { en: 'web', fr: 'web' },
    items: ['nmap', 'ffuf', 'gobuster', 'sqlmap', 'nikto', 'hydra', 'whatweb', 'wafw00f', 'proxychains'],
  },
  {
    label: { en: 'crypto', fr: 'crypto' },
    items: ['pycryptodome', 'AES-CBC bit-flipping', 'XOR', 'key brute force'],
  },
  {
    label: { en: 'reverse & forensic', fr: fr('reverse & forensic') },
    items: ['strings', 'apktool', 'jadx', 'protobuf', 'pcap', '.NET assembly'],
  },
  {
    label: { en: 'systems', fr: 'systèmes' },
    items: ['sudo', 'NixOS', 'Windows privilege escalation', 'SYSTEM'],
  },
]

export type PracticePageCopy = {
  title: string
  lead: string
  countLabel: string
  rangesLabel: string
  rangesLead: string
  toolsLabel: string
  toolsLead: string
  askTitle: string
  ask: string
  workCta: string
  notesCta: string
}

export const practiceCopy: Bi<PracticePageCopy> = {
  en: {
    title: 'What I practise on.',
    lead: 'Eight challenges written up, one CTF played, and a lab that keeps the tools installed. This is the offensive side of the sheet: what the exercise was, what it took, and where the writeup is.',
    countLabel: 'entries',
    rangesLabel: 'ranges',
    rangesLead: 'Each line is a challenge I actually solved, documented the week it was solved. No score, no rank — the writeup is the proof.',
    toolsLabel: 'instruments',
    toolsLead: 'What is installed in the lab. Not a list of things I have read about.',
    askTitle: 'What I am looking for',
    ask: 'An alternance in a SOC or on an offensive team, in Toulouse. What I bring is on this page: eight writeups anyone can read, a network I run end to end, and the habit of writing down what I did — including when it did not work.',
    workCta: 'The register',
    notesCta: 'All the writing',
  },
  fr: {
    title: fr('Ce sur quoi je m’entraîne.'),
    lead: fr('Huit challenges rédigés, un CTF joué, et un labo qui garde les outils installés. C’est le versant offensif de la feuille\u00a0: quel était l’exercice, ce qu’il fallait faire, et où lire le writeup.'),
    countLabel: 'entrées',
    rangesLabel: 'terrains',
    rangesLead: fr('Chaque ligne est un challenge que j’ai réellement résolu, documenté la semaine où il l’a été. Aucun score, aucun rang — le writeup est la preuve.'),
    toolsLabel: 'instruments',
    toolsLead: fr('Ce qui est installé dans le labo. Pas une liste de choses lues quelque part.'),
    askTitle: fr('Ce que je cherche'),
    ask: fr('Une alternance en SOC ou dans une équipe offensive, à Toulouse. Ce que j’apporte est sur cette page\u00a0: huit writeups que n’importe qui peut lire, un réseau que j’exploite de bout en bout, et l’habitude d’écrire ce que j’ai fait — y compris quand ça n’a pas marché.'),
    workCta: 'Le registre',
    notesCta: 'Tous les écrits',
  },
}

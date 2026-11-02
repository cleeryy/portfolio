import type { Bi } from '../lib/i18n'
import { fr } from '../lib/typo'

/* ============================================================================
   about.ts — the operator, twice
   ----------------------------------------------------------------------------
   Two modules in one file, because they must not drift:

   - `operator` is the home chapter, on ink, short: two paragraphs, four
     readings, one way out to the long version.
   - `aboutPage` is the long version: the dated record, the five domains of
     practice with a qualifier on each, and the one paragraph that says what is
     deliberately absent.

   Nothing here asserts an employer, a job title, a contract type, a diploma, a
   certification or an availability date. He holds no certification and the prose
   says so in a clause, not in a badge.
   ========================================================================== */

export type OperatorFact = { key: string; value: string }

export type OperatorCopy = {
  margin: string
  title: string
  paragraphs: string[]
  facts: OperatorFact[]
  moreLabel: string
}

export const operator: Bi<OperatorCopy> = {
  en: {
    margin: 'the operator',
    title: 'I learn systems by running them.',
    paragraphs: [
      'Third year at ESGI Toulouse, Bachelor 3, programme “SRC”, 2026–2027. Three afternoons a week I work with an IT company in Toulouse; the rest of the week goes to this lab, to a writeup, or to a tool I was missing.',
      'No certification yet. What I have instead: a network I run end to end, a backup I have restored and booted, and writeups anyone can read. I would rather show you the cluster than a badge.',
    ],
    facts: [
      { key: 'based', value: 'Toulouse, FR' },
      { key: 'studying', value: 'ESGI B3 — SRC' },
      { key: 'working', value: 'IT, 3 afternoons' },
      { key: 'certifications', value: 'none yet' },
    ],
    moreLabel: 'The long version',
  },
  fr: {
    margin: 'l’opérateur',
    title: fr('J’apprends les systèmes en les exploitant.'),
    paragraphs: [
      fr('Troisième année à l’ESGI Toulouse, Bachelor 3, programme «\u00a0SRC\u00a0», 2026–2027. Trois après-midis par semaine, je travaille avec une entreprise informatique de Toulouse\u00a0; le reste de la semaine va à ce labo, à un writeup, ou à l’outil qui me manquait.'),
      fr('Aucune certification à ce jour. Ce que j’ai à la place\u00a0: un réseau que j’exploite de bout en bout, une sauvegarde que j’ai restaurée et démarrée, et des writeups que n’importe qui peut lire. Je préfère montrer le cluster qu’un badge.'),
    ],
    facts: [
      { key: 'basé', value: 'Toulouse, FR' },
      { key: 'études', value: 'ESGI B3 — SRC' },
      { key: 'travail', value: 'IT, 3 après-midis' },
      { key: 'certifications', value: 'aucune à ce jour' },
    ],
    moreLabel: 'La version longue',
  },
}

/* -------------------------------------------------------------------------- */
/* /about                                                                      */
/* -------------------------------------------------------------------------- */

export type AboutPageCopy = {
  title: string
  lead: string
  recordLabel: string
  recordLead: string
  domainsLabel: string
  domainsLead: string
  honestyTitle: string
  honesty: string
  contactCta: string
  contactNote: string
}

export const aboutPage: Bi<AboutPageCopy> = {
  en: {
    title: 'The record, without the costume.',
    lead: 'What I have done, what I actually work with, and what is deliberately missing. If a line here is not checkable somewhere, it should not be here.',
    recordLabel: 'record',
    recordLead: 'Dated, oldest first. School, work, and the lab.',
    domainsLabel: 'practice',
    domainsLead: 'Five domains, each with an honest qualifier and one thing to point at.',
    honestyTitle: 'What is not here',
    honesty:
      'No certifications, no platform ranks, no user counts, no testimonials. Not because they were left out of the design — because they do not exist. If a number appears on this site, it comes from the thing it describes.',
    contactCta: 'Write to me',
    contactNote: 'One address, no form.',
  },
  fr: {
    title: fr('Le parcours, sans le costume.'),
    lead: fr('Ce que j’ai fait, ce avec quoi je travaille vraiment, et ce qui manque volontairement. Si une ligne ici n’est vérifiable nulle part, elle ne devrait pas y être.'),
    recordLabel: 'parcours',
    recordLead: fr('Daté, du plus ancien au plus récent. L’école, le travail, et le labo.'),
    domainsLabel: 'pratique',
    domainsLead: fr('Cinq domaines, chacun avec une mention honnête et une chose à montrer.'),
    honestyTitle: 'Ce qui n’est pas là',
    honesty: fr('Pas de certification, pas de classement de plateforme, pas de nombre d’utilisateurs, pas de témoignage. Non pas parce qu’ils ont été retirés du design — parce qu’ils n’existent pas. Si un chiffre apparaît sur ce site, il vient de la chose qu’il décrit.'),
    contactCta: 'M’écrire',
    contactNote: fr('Une adresse, pas de formulaire.'),
  },
}

export type RecordEntry = {
  year: string
  label: Bi
  note: Bi
}

export const record: RecordEntry[] = [
  {
    year: '2020',
    label: { en: 'First GitHub account', fr: 'Premier compte GitHub' },
    note: { en: 'The first public trace.', fr: fr('La première trace publique.') },
  },
  {
    year: '2025',
    label: { en: 'Blog, CTF, writeups', fr: 'Blog, CTF, writeups' },
    note: {
      en: 'A Hugo blog on a VPS, a first CTF at THCon 2025, and seven Hack The Box writeups published in November.',
      fr: fr('Un blog Hugo sur un VPS, un premier CTF à la THCon 2025, et sept writeups Hack The Box publiés en novembre.'),
    },
  },
  {
    year: '2026',
    label: { en: 'Three afternoons a week in IT', fr: 'Trois après-midis par semaine dans l’IT' },
    note: {
      en: 'Alongside the degree, with an IT company in Toulouse, since May.',
      fr: fr('En marge du cursus, dans une entreprise informatique de Toulouse, depuis mai.'),
    },
  },
  {
    year: '2026',
    label: { en: 'The lab rebuilt', fr: 'Le labo reconstruit' },
    note: {
      en: 'Migration onto a new VLAN plan, a real backup tier, and a restore booted before the job was closed.',
      fr: fr('Migration vers un nouveau plan de VLAN, une vraie sauvegarde, et une restauration démarrée avant de clore le chantier.'),
    },
  },
  {
    year: '2026',
    label: { en: 'Blog on a GitOps pipeline', fr: 'Le blog sur un pipeline GitOps' },
    note: {
      en: 'Rebuilt from a VPS backup: Hugo, CI, image scan, GHCR, Dokploy.',
      fr: fr('Reconstruit depuis une sauvegarde du VPS\u00a0: Hugo, CI, scan d’image, GHCR, Dokploy.'),
    },
  },
  {
    year: '2026',
    label: { en: 'Bachelor 3, ESGI Toulouse', fr: 'Bachelor 3, ESGI Toulouse' },
    note: {
      en: 'Programme “SRC”, 2026–2027.',
      fr: fr('Programme «\u00a0SRC\u00a0», 2026–2027.'),
    },
  },
]

export type Practice = {
  id: string
  label: Bi
  qualifier: Bi
  instruments: string[]
  proof: Bi
}

const PRODUCTION: Bi = { en: 'in production', fr: 'en production' }
const LAB: Bi = { en: 'in a lab', fr: 'en labo' }

export const practice: Practice[] = [
  {
    id: 'network',
    label: { en: 'Network & edge', fr: fr('Réseau & bordure') },
    qualifier: PRODUCTION,
    instruments: ['OPNsense', 'WireGuard', 'NetBird', 'Cloudflare Tunnel', 'Unbound', 'Technitium', 'Suricata', 'CrowdSec'],
    proof: {
      en: 'Eight segments and one door. Every rule in the firewall has a reason written next to it.',
      fr: fr('Huit segments et une seule porte. Chaque règle du pare-feu a sa raison écrite à côté.'),
    },
  },
  {
    id: 'virtualisation',
    label: { en: 'Virtualisation & storage', fr: fr('Virtualisation & stockage') },
    qualifier: PRODUCTION,
    instruments: ['Proxmox VE 9.2', 'LXC', 'QEMU', 'LVM-thin', 'ZFS', 'NFS', 'PBS'],
    proof: {
      en: 'Fifty-two guests, forty-five documented services, and one restore booted before the backup was called valid.',
      fr: fr('Cinquante-deux invités, quarante-cinq services documentés, et une restauration démarrée avant de déclarer la sauvegarde valide.'),
    },
  },
  {
    id: 'identity',
    label: { en: 'Identity & delivery', fr: fr('Identité & livraison') },
    qualifier: PRODUCTION,
    instruments: ['Authentik', 'Warpgate', 'Infisical', 'Vaultwarden', 'Caddy', 'Dokploy', 'Forgejo', 'GitHub Actions'],
    proof: {
      en: 'Sixty-six routes behind one proxy, one SSH door, and every secret in a vault rather than a compose file.',
      fr: fr('Soixante-six routes derrière un proxy, une seule porte SSH, et chaque secret dans un coffre plutôt que dans un compose.'),
    },
  },
  {
    id: 'offensive',
    label: { en: 'Offensive practice', fr: fr('Pratique offensive') },
    qualifier: LAB,
    instruments: ['Hack The Box', 'THCon', 'nmap', 'ffuf', 'gobuster', 'sqlmap', 'hashcat', 'john'],
    proof: {
      en: 'Seven published writeups and one CTF played. No rank, because there is no rank to show.',
      fr: fr('Sept writeups publiés et un CTF joué. Aucun rang, parce qu’il n’y a aucun rang à montrer.'),
    },
  },
  {
    id: 'code',
    label: { en: 'Code', fr: 'Code' },
    qualifier: PRODUCTION,
    instruments: ['TypeScript', 'Next.js', 'Go', 'Rust', 'Python', 'Java 21', 'Kotlin', 'Bash'],
    proof: {
      en: 'The register: twenty projects, from a painting app to a Minecraft plugin.',
      fr: fr('Le registre\u00a0: vingt projets, d’une application de peinture à un plugin Minecraft.'),
    },
  },
]

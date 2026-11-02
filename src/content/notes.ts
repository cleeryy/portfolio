import type { Bi } from '../lib/i18n'
import { fr } from '../lib/typo'

/* ============================================================================
   notes.ts — the writing, as a register
   ----------------------------------------------------------------------------
   Every entry resolves today on blog.cleeryy.cloud (checked against the blog's
   own sitemap). Dates are publication dates, not revision dates; the blog sorts
   by its own front matter and this file follows it.

   A note is one line: what the piece actually contains. No "deep dive", no
   "everything you need to know".
   ========================================================================== */

export type NoteKind = 'post' | 'writeup' | 'ctf'

export type Note = {
  /** ISO date, printed as `2026-10-30` in mono. */
  date: string
  title: string
  kind: NoteKind
  line: Bi
  href: string
}

export const notes: Note[] = [
  {
    date: '2026-10-30',
    title: 'Docker in 10 minutes',
    kind: 'post',
    line: { en: 'Four commands, three mistakes, and what a container is not.', fr: fr('Quatre commandes, trois erreurs, et ce qu’un conteneur n’est pas.') },
    href: 'https://blog.cleeryy.cloud/posts/docker-in-10-minutes/',
  },
  {
    date: '2026-10-27',
    title: 'SSH done right',
    kind: 'post',
    line: { en: 'Keys, agents, a config file, and what never belongs in ~/.ssh.', fr: fr('Clés, agents, un fichier de config, et ce qui ne va jamais dans ~/.ssh.') },
    href: 'https://blog.cleeryy.cloud/posts/ssh-done-right/',
  },
  {
    date: '2026-10-23',
    title: 'Naming things',
    kind: 'post',
    line: { en: 'Hostnames, VLANs and guests: a scheme you can read at three in the morning.', fr: fr('Noms d’hôtes, VLAN et invités\u00a0: un schéma lisible à trois heures du matin.') },
    href: 'https://blog.cleeryy.cloud/posts/naming-things/',
  },
  {
    date: '2026-10-20',
    title: 'LXC vs VM',
    kind: 'post',
    line: { en: 'What the difference actually costs, in practice.', fr: fr('Ce que la différence coûte vraiment, en pratique.') },
    href: 'https://blog.cleeryy.cloud/posts/lxc-vs-vm/',
  },
  {
    date: '2026-10-19',
    title: 'Your first Proxmox VM',
    kind: 'post',
    line: { en: 'From an ISO to a machine you can SSH into.', fr: fr('D’une ISO à une machine joignable en SSH.') },
    href: 'https://blog.cleeryy.cloud/posts/proxmox-first-vm/',
  },
  {
    date: '2026-10-19',
    title: 'What is a homelab',
    kind: 'post',
    line: { en: 'Why own the thing that hosts your photos.', fr: fr('Pourquoi posséder la machine qui héberge vos photos.') },
    href: 'https://blog.cleeryy.cloud/posts/what-is-a-homelab/',
  },
  {
    date: '2026-10-19',
    title: 'Welcome back',
    kind: 'post',
    line: { en: 'The blog returns, rebuilt in GitOps.', fr: fr('Le blog revient, reconstruit en GitOps.') },
    href: 'https://blog.cleeryy.cloud/posts/welcome-back/',
  },
  {
    date: '2025-11-28',
    title: 'bankflip',
    kind: 'writeup',
    line: { en: 'AES-CBC bit-flipping against a Flask application.', fr: fr('Bit-flipping AES-CBC contre une application Flask.') },
    href: 'https://blog.cleeryy.cloud/writeups/cbc2025/bankflip/',
  },
  {
    date: '2025-11-28',
    title: 'monkey',
    kind: 'writeup',
    line: { en: 'A PowerShell dropper, a .NET assembly, and the pcap behind it.', fr: fr('Un dropper PowerShell, un assembly .NET, et le pcap derrière.') },
    href: 'https://blog.cleeryy.cloud/writeups/cbc2025/monkey/',
  },
  {
    date: '2025-11-28',
    title: 'notesy',
    kind: 'writeup',
    line: { en: 'Stored XSS and the Selenium bot that reads it.', fr: fr('XSS stocké et le bot Selenium qui le lit.') },
    href: 'https://blog.cleeryy.cloud/writeups/cbc2025/notesy/',
  },
  {
    date: '2025-11-28',
    title: 'one more round',
    kind: 'writeup',
    line: { en: 'A Solidity reentrancy, and the accounting that hides it.', fr: fr('Une réentrance Solidity, et la comptabilité qui la cache.') },
    href: 'https://blog.cleeryy.cloud/writeups/cbc2025/one-more-round/',
  },
  {
    date: '2025-11-28',
    title: 'scrapeware',
    kind: 'writeup',
    line: { en: 'SSRF into Redis, a pickle, and a shell.', fr: fr('SSRF vers Redis, un pickle, et un shell.') },
    href: 'https://blog.cleeryy.cloud/writeups/cbc2025/scrapeware/',
  },
  {
    date: '2025-11-28',
    title: 'threekeys',
    kind: 'writeup',
    line: { en: 'An ELF with three AES keys and a brute-forceable order.', fr: fr('Un ELF à trois clés AES et un ordre attaquable.') },
    href: 'https://blog.cleeryy.cloud/writeups/cbc2025/threekeys/',
  },
  {
    date: '2025-11-26',
    title: 'lemon industries',
    kind: 'writeup',
    line: { en: 'SSTI in a WordPress plugin, CVE-2024-6386.', fr: fr('SSTI dans un plugin WordPress, CVE-2024-6386.') },
    href: 'https://blog.cleeryy.cloud/writeups/cbc2025/lemon-industries/',
  },
  {
    date: '2025-04-16',
    title: 'my own VPN infrastructure',
    kind: 'post',
    line: { en: 'WireGuard on a Raspberry Pi, wake-on-LAN, and reaching the LAN from outside.', fr: fr('WireGuard sur un Raspberry Pi, wake-on-LAN, et atteindre le LAN depuis l’extérieur.') },
    href: 'https://blog.cleeryy.cloud/posts/my-own-vpn-infrastructure/',
  },
  {
    date: '2025-04-12',
    title: 'neoprivesc',
    kind: 'ctf',
    line: { en: 'THCon 2025, misc: sudo, NixOS, and a way up.', fr: fr('THCon 2025, misc\u00a0: sudo, NixOS, et un chemin vers le haut.') },
    href: 'https://blog.cleeryy.cloud/writeups/thcon2025/neoprivesc/',
  },
]

export const notesKindLabel: Record<NoteKind, Bi> = {
  post: { en: 'post', fr: 'article' },
  writeup: { en: 'writeup', fr: 'writeup' },
  ctf: { en: 'ctf', fr: 'ctf' },
}

export type NotesCopy = {
  title: string
  lead: string
  countLabel: string
  allLabel: string
  allNote: string
  practiceCta: string
  yearLabel: string
  emptyYear: string
}

export const notesCopy: Bi<NotesCopy> = {
  en: {
    title: 'Field notes',
    lead: 'Posts about running this, and writeups from the ranges. Everything is public and nothing is scheduled — I write when I have something to say.',
    countLabel: 'entries',
    allLabel: 'Read everything',
    allNote: 'blog.cleeryy.cloud',
    practiceCta: 'The offensive record',
    yearLabel: 'year',
    emptyYear: 'Nothing published this year.',
  },
  fr: {
    title: 'Notes de terrain',
    lead: fr('Des articles sur l’exploitation de ce réseau, et des writeups des terrains d’entraînement. Tout est public et rien n’est planifié — j’écris quand j’ai quelque chose à dire.'),
    countLabel: 'entrées',
    allLabel: 'Tout lire',
    allNote: 'blog.cleeryy.cloud',
    practiceCta: 'Le registre offensif',
    yearLabel: 'année',
    emptyYear: fr('Rien de publié cette année.'),
  },
}

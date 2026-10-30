import type { Bi } from '../lib/i18n'

/**
 * The seven domains — the CV page, as a ledger.
 *
 * Rules for this file, on top of the sheet's own:
 * - Every line is traceable to `FACTS.md` §4. Nothing here is aspirational: no
 *   certification, no platform rank, no "advanced" or "expert".
 * - `depth` is not decoration. It is the honest distance between the practice
 *   and a production network: `production` runs every day on his own cluster,
 *   `lab` is challenge ranges that were written up, `coursework` is taught this
 *   term. A recruiter must be able to tell those apart in the margin.
 * - There is no cloud row, because there is no cloud practice: `FACTS.md` §4
 *   records AWS, Azure and GCP as absent. A row added "to look complete" would
 *   be the one lie that spoils the other six.
 * - `proof` is a real pointer or plain text. Only the blog is linked, and only
 *   for the three domains that have a writeup there; everything else is stated
 *   as fact with its date, because no public URL exists for it.
 * - Tools are instruments, not adjectives: 3–6 named per domain, set in mono.
 *   The list is a selection of what he reaches for, never a claim of mastery.
 */

export type SkillDepth = 'production' | 'lab' | 'coursework'

export type SkillDomain = {
  /** Stable anchor id: `#skills-<id>`. Never translated. */
  id: string
  name: Bi
  depth: SkillDepth
  /** One line: what he actually does in this domain. Not what he could do. */
  line: Bi
  /** 3–6 instruments or techniques, joined with `+` at render. */
  tools: Bi<string[]>
  /** The evidence: a writeup, a project, a piece of the homelab. */
  proof: Bi
  /** Present only when the proof itself is published. */
  proofHref?: string
}

/** Reading order of the legend. Matches the proportion of the ledger. */
export const depthOrder: SkillDepth[] = ['production', 'lab', 'coursework']

export const domains: SkillDomain[] = [
  {
    id: 'offensive',
    name: { en: 'Offensive — web', fr: 'Offensive — web' },
    depth: 'lab',
    line: {
      en: 'Web pentesting, from a first request to a shell: template injection, stored XSS triggered by a bot, SSRF that ends in pickle and RCE.',
      fr: 'Pentest web, de la première requête jusqu’au shell\u00a0: injection de template, XSS stocké déclenché par un bot, SSRF qui finit en pickle puis en RCE.',
    },
    tools: {
      en: ['nmap', 'ffuf', 'sqlmap', 'nikto', 'wpscan', 'proxychains'],
      fr: ['nmap', 'ffuf', 'sqlmap', 'nikto', 'wpscan', 'proxychains'],
    },
    proof: {
      en: 'Three writeups on the blog: lemon industries, notesy, scrapeware.',
      fr: 'Trois writeups sur le blog\u00a0: lemon industries, notesy, scrapeware.',
    },
    proofHref: 'https://blog.cleeryy.cloud',
  },
  {
    id: 'reverse',
    name: { en: 'Reverse & forensics', fr: 'Reverse et forensic' },
    depth: 'lab',
    line: {
      en: 'Samples and binaries read until the mechanism is clear: a PowerShell dropper, an ELF, an APK, a pcap with the stolen data still in it.',
      fr: 'Des échantillons et des binaires lus jusqu’au mécanisme\u00a0: un dropper PowerShell, un ELF, un APK, un pcap avec les données volées encore dedans.',
    },
    tools: {
      en: [
        'PowerShell/.NET dropper',
        'XOR schema',
        'ELF 64-bit',
        'apktool + jadx',
        'pcap',
        'C++ race condition PoC',
      ],
      fr: [
        'dropper PowerShell/.NET',
        'schéma XOR',
        'ELF 64 bits',
        'apktool + jadx',
        'pcap',
        'PoC race condition C++',
      ],
    },
    proof: {
      en: 'monkey and threekeys, written up on the blog.',
      fr: 'monkey et threekeys, rédigés sur le blog.',
    },
    proofHref: 'https://blog.cleeryy.cloud',
  },
  {
    id: 'crypto',
    name: { en: 'Applied cryptography', fr: 'Cryptographie appliquée' },
    depth: 'coursework',
    line: {
      en: 'Where a cipher breaks on its mode rather than its key: AES-CBC bit-flipping on a Flask app, XOR, and keys short enough to brute force.',
      fr: 'Là où c’est le mode qui cède, pas la clé\u00a0: bit-flipping AES-CBC sur une application Flask, XOR, et des clés assez courtes pour tomber en force brute.',
    },
    tools: {
      en: ['AES-CBC', 'bit-flipping', 'XOR', 'Flask + pycryptodome', 'key brute force'],
      fr: ['AES-CBC', 'bit-flipping', 'XOR', 'Flask + pycryptodome', 'force brute de clé'],
    },
    proof: {
      en: 'bankflip, written up on the blog — and the fundamentals course running this term.',
      fr: 'bankflip, rédigé sur le blog — et le cours de fondamentaux qui tourne ce semestre.',
    },
    proofHref: 'https://blog.cleeryy.cloud',
  },
  {
    id: 'network',
    name: { en: 'Network & edge', fr: 'Réseau et périmètre' },
    depth: 'production',
    line: {
      en: 'The only door into the lab: eight segments, three forwards in, the rest out through a tunnel with a kill-switch — and a rule base moved from legacy to MVC by hand.',
      fr: 'La seule porte du labo\u00a0: huit segments, trois redirections entrantes, le reste sort par un tunnel avec coupe-circuit — et une base de règles migrée à la main du legacy au MVC.',
    },
    tools: {
      en: [
        'OPNsense (8 segments, NAT, policy routing)',
        'WireGuard',
        'NetBird mesh',
        'Cloudflare Tunnel',
        'Unbound + Technitium',
        'Suricata + CrowdSec',
      ],
      fr: [
        'OPNsense (8 segments, NAT, policy routing)',
        'WireGuard',
        'mesh NetBird',
        'Cloudflare Tunnel',
        'Unbound + Technitium',
        'Suricata + CrowdSec',
      ],
    },
    proof: {
      en: 'Formalised as a network audit in LaTeX/TikZ, 10/09/2026.',
      fr: 'Formalisé en audit réseau LaTeX/TikZ, le 10/09/2026.',
    },
  },
  {
    id: 'infrastructure',
    name: { en: 'Infrastructure', fr: 'Infrastructure' },
    depth: 'production',
    line: {
      en: 'A two-node cluster in real service: 52 guests, two retention tiers, and a restore that was booted rather than assumed.',
      fr: 'Un cluster à deux nœuds réellement en service\u00a0: 52 invités, deux niveaux de rétention, et une restauration démarrée pour de vrai, pas supposée.',
    },
    tools: {
      en: [
        'Proxmox VE 9.2',
        'LVM-thin (~5.9 TB)',
        'ZFS + NFS',
        'PBS (keep-7 / keep-3)',
        'Docker + Swarm',
        'Dokploy + Caddy',
      ],
      fr: [
        'Proxmox VE 9.2',
        'LVM-thin (~5,9 To)',
        'ZFS + NFS',
        'PBS (keep-7 / keep-3)',
        'Docker + Swarm',
        'Dokploy + Caddy',
      ],
    },
    proof: {
      en: 'PBS restore booted on 10/09/2026 — keep-7 on five critical guests, keep-3 on thirty-six others.',
      fr: 'Restauration PBS démarrée le 10/09/2026 — keep-7 sur cinq invités critiques, keep-3 sur trente-six autres.',
    },
  },
  {
    id: 'detection',
    name: { en: 'Detection & observability', fr: 'Détection et supervision' },
    depth: 'production',
    line: {
      en: 'Everything that moves on the cluster leaves a trace: 27 agents reporting, rules written by hand, and the dashboards that make a failure visible.',
      fr: 'Tout ce qui bouge sur le cluster laisse une trace\u00a0: 27 agents qui remontent, des règles écrites à la main, et les tableaux de bord qui rendent une panne visible.',
    },
    tools: {
      en: ['Wazuh 4.14.9', 'Prometheus', 'Grafana', 'pve-exporter', 'Checkmk', 'Uptime Kuma + ntfy'],
      fr: ['Wazuh 4.14.9', 'Prometheus', 'Grafana', 'pve-exporter', 'Checkmk', 'Uptime Kuma + ntfy'],
    },
    proof: {
      en: 'Wazuh audit of 28/10/2026: 27 agents registered, 11 custom rules.',
      fr: 'Audit Wazuh du 28/10/2026\u00a0: 27 agents enregistrés, 11 règles personnalisées.',
    },
  },
  {
    id: 'code',
    name: { en: 'Code', fr: 'Code' },
    depth: 'production',
    line: {
      en: 'What I write when the tool does not exist: services, a Minecraft plugin, a desktop audio app, and the DSP under it.',
      fr: 'Ce que j’écris quand l’outil n’existe pas\u00a0: des services, un plugin Minecraft, une appli audio de bureau, et le DSP en dessous.',
    },
    tools: {
      en: ['TypeScript / Next.js', 'Go', 'Rust (Axum, Tauri)', 'Python', 'Java 21', 'Kotlin'],
      fr: ['TypeScript / Next.js', 'Go', 'Rust (Axum, Tauri)', 'Python', 'Java 21', 'Kotlin'],
    },
    proof: {
      en: 'VegJustice, 230 commits; MicForge in Rust and Tauri; mealboard, in production.',
      fr: 'VegJustice, 230 commits\u00a0; MicForge en Rust et Tauri\u00a0; mealboard, en production.',
    },
  },
]

export type SkillsCopy = {
  title: string
  lead: string
  /** Legend heading over the three depth qualifiers. */
  keyLabel: string
  /** The qualifier as printed in the margin of each entry. */
  depth: Record<SkillDepth, string>
  /** What that qualifier means, one short line each. */
  depthNote: Record<SkillDepth, string>
  /** Accessible name of the margin index. */
  indexLabel: string
  /** Column key above the margin index. */
  indexKey: string
  /** Label in front of each proof pointer. */
  proofLabel: string
  /** Foot note: what this section deliberately does not claim. */
  note: string
}

export const skillsCopy: Bi<SkillsCopy> = {
  en: {
    title: 'Seven domains, each with its proof.',
    lead: 'Under each name: what I actually do there, the instruments I reach for, and what you can check. Depth is stated, not implied — a challenge range is not a production network.',
    keyLabel: 'depth',
    depth: {
      production: 'in production',
      lab: 'in a lab',
      coursework: 'coursework',
    },
    depthNote: {
      production: 'runs every day, on my own infrastructure',
      lab: 'challenge ranges, then written up',
      coursework: 'taught this term, applied in exercises',
    },
    indexLabel: 'Domains',
    indexKey: 'domains',
    proofLabel: 'proof',
    note: 'No cloud row: nothing here ran on AWS, Azure or GCP. The writeups linked above are in English.',
  },
  fr: {
    title: 'Sept domaines, chacun avec sa preuve.',
    lead: 'Sous chaque nom\u00a0: ce que j’y fais vraiment, les instruments que j’utilise, et ce que vous pouvez vérifier. La profondeur est dite, pas suggérée — un terrain d’entraînement n’est pas un réseau de production.',
    keyLabel: 'profondeur',
    depth: {
      production: 'en production',
      lab: 'en labo',
      coursework: 'en cours',
    },
    depthNote: {
      production: 'tourne tous les jours, sur mon infrastructure',
      lab: 'terrains d’entraînement, puis writeups',
      coursework: 'enseigné ce semestre, appliqué en TP',
    },
    indexLabel: 'Domaines',
    indexKey: 'domaines',
    proofLabel: 'preuve',
    note: 'Pas de ligne «\u00a0cloud\u00a0»\u00a0: rien ici n’a tourné sur AWS, Azure ni GCP. Les writeups liés ci-dessus sont en anglais.',
  },
}

import type { Bi } from '../lib/i18n'

/* ============================================================================
   The passage — the labels the flight carries
   ----------------------------------------------------------------------------
   The section is a camera flight through the same territory the plate drew
   flat, so its labels are not decoration: every one of them is a thing that
   already exists on this sheet.

   Provenance, group by group:

   - machines and guests — `homelab/content/architecture/*`, the same rows the
     territory's placement table and reverse-proxy config are built from;
   - addresses, interfaces, ports — the network and firewall docs (`vmbr1`,
     `wg0`, `udp/51920`, the two private /24s);
   - training — the THCon 2025 challenge and the seven write-ups
     (`neoprivesc`, `sudo`, `CVE-2024-6386`, `AES-CBC`, SSTI/SSRF/XSS, the
     pcap's `4444/tcp`, the ATT&CK technique the dropper was tagged with);
   - instruments — the stacks the work chapter names (`Rust`, `Tauri`,
     `SQLite`, `Next.js`, `Docker`), the school and the city.

   Nothing here is a claim. A label drifting past says "this name exists on
   this sheet"; the sections that own a name are the ones that say what it is.

   This module owns the words and the names only. The still plate's arrangement
   lives in `FlightStill.tsx`, because a composed frame is a layout, not copy.
   ========================================================================== */

/**
 * Forty strings, in atlas order — four columns by ten rows, one label per cell.
 * The count is the layout: the atlas is 1024 × 1024 with 256 × 102 cells, so a
 * change here is a change to `atlas.ts`.
 */
export const flightLabels: string[] = [
  /* the two chassis every mark hangs from */
  'pve1',
  'pve3',
  /* edge */
  'caddy',
  'opnsense',
  'warpgate',
  'authentik',
  /* backup */
  'pbs',
  /* services */
  'nextcloud',
  'forgejo',
  'immich',
  'jellyfin',
  'mealboard',
  /* the fabric and the tunnel */
  'vmbr1',
  'wg0',
  '10.1.20.0/24',
  '10.1.50.0/24',
  'udp/51920',
  'LXC 578',
  'VM 501',
  /* training */
  'CVE-2024-6386',
  'neoprivesc',
  'THCon 2025',
  '500 points',
  'AES-CBC',
  'SSTI',
  'SSRF',
  'XSS',
  'sudo',
  '4444/tcp',
  'T1204',
  'SYSTEM',
  'keep-7',
  /* instruments */
  'Rust',
  'Tauri',
  'SQLite',
  'Next.js',
  'Docker',
  /* the school, the city */
  'ESGI',
  'Bachelor 3',
  'Toulouse',
]

export type FlightCopy = {
  title: string
  lead: string
  /** Spoken description of the drawing, for the reader who cannot see it. */
  diagram: string
}

/**
 * The sheet's voice: an instrument reading, then the argument in one breath.
 * French is written, not translated — same meaning, French punctuation.
 */
export const flightCopy: Bi<FlightCopy> = {
  en: {
    title: 'The passage',
    lead:
      'The map above is flat. Here it becomes a depth: the names it holds — machines, guests, addresses, ground — pass at full size, one at a time, until the sheet turns to ink.',
    diagram:
      'A forward flight through the labels of this territory — machines, guests, addresses, training grounds — thinning into the ink plate the next chapter is printed on.',
  },
  fr: {
    title: 'Le passage',
    lead:
      'La carte au-dessus est plate. Ici elle devient une profondeur\u00a0: les noms qu’elle retient — machines, invités, adresses, terrain — passent à leur taille, un par un, jusqu’à ce que la feuille vire à l’encre.',
    diagram:
      'Un vol vers l’avant à travers les noms de ce territoire — machines, invités, adresses, terrains d’entraînement — qui s’amincissent jusqu’à la plaque d’encre du chapitre suivant.',
  },
}

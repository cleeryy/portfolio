import type { Bi } from '../lib/i18n'

/**
 * The operator, first person, short.
 *
 * What is true and may be said here: he runs the homelab end to end, he trains
 * on other people's networks (guided rooms, bare machines, web security labs,
 * CTFs online and on site), and he writes the tools he is missing. What is not
 * in this file: a job title ladder, an employer, a certification, a portrait,
 * a "passionate about cybersecurity" opening. None of it would be a fact.
 *
 * The French is written as French, not as a translation of the English: same
 * position, different sentence. That is the rule for every content module.
 *
 * Shape of the section: a margin column of annotations, one reading column of
 * prose. `timeline` is wired and empty — see the note above it. Nothing in this
 * module may grow a third column.
 */

export type AboutAnnotation = {
  /** The key, not a heading: a field card is read in glances. */
  key: string
  value: string
}

export type AboutCopy = {
  title: string
  /** Two or three short paragraphs. First person, no CV theatre. */
  paragraphs: string[]
  /** Margin annotations, printed at the foot of the reading column. */
  annotations: AboutAnnotation[]
  /** Only rendered when `timeline` has entries. */
  timelineLabel: string
}

export const about: Bi<AboutCopy> = {
  en: {
    title: 'I would rather read a system than trust it.',
    paragraphs: [
      'I run the network drawn at the top of this sheet: two Proxmox nodes in one room, an OPNsense edge, a WireGuard tunnel, a reverse proxy, backups that get restored rather than merely written. It began as a way to see the whole path a request takes, and stayed because the path is the interesting part.',
      'The rest of the time I practise on networks that are not mine — TryHackMe, Hack The Box, Root-Me, PortSwigger, and CTFs, online or on site. Same instruments, no history, no documentation: you read the terrain before you move through it.',
      'When nothing off the shelf fits, I build the thing: the meal planner, the microphone chain, this page. Not because building is fun — because a tool I cannot open is a tool I cannot repair.',
    ],
    annotations: [
      { key: 'resident', value: 'one room, FR' },
      { key: 'practice', value: 'offensive security' },
    ],
    timelineLabel: 'parcours',
  },
  fr: {
    title: 'Je préfère lire un système plutôt que lui faire confiance.',
    paragraphs: [
      'J’exploite le réseau dessiné en haut de cette feuille\u00a0: deux nœuds Proxmox dans une pièce, une bordure OPNsense, un tunnel WireGuard, un reverse proxy, des sauvegardes dont je restaure vraiment au lieu de les empiler. C’était au départ pour voir le trajet complet d’une requête\u00a0; je suis resté parce que c’est le trajet qui est intéressant.',
      'Le reste du temps, je m’entraîne sur des réseaux qui ne sont pas à moi — TryHackMe, Hack The Box, Root-Me, PortSwigger, et des CTF, en ligne ou sur place. Mêmes instruments, aucun historique, aucune documentation\u00a0: on lit le terrain avant d’y avancer.',
      'Quand rien ne convient, je construis l’outil\u00a0: le planificateur de repas, la chaîne audio, cette page. Pas par goût de construire — parce qu’un outil que je ne peux pas ouvrir est un outil que je ne peux pas réparer.',
    ],
    annotations: [
      { key: 'domicile', value: 'une pièce, FR' },
      { key: 'pratique', value: 'sécurité offensive' },
    ],
    timelineLabel: 'parcours',
  },
}

export type CareerEntry = {
  /** Four digits, or an open range such as `'2023—'`. Never invented. */
  year: string
  label: Bi
  /** Optional line: what the year was, in one sentence. */
  note?: Bi
}

/**
 * The career ledger.
 *
 * Left empty on purpose. The section is already shaped for it: `About.tsx`
 * renders the ledger (a ruled row per year, the year in mono) only when this
 * array is not empty, and `about.css` already carries the styles, so adding
 * entries later is a content edit and not a redesign.
 */
// TODO(cleeryy): parcours — filled after a grilling session
export const timeline: CareerEntry[] = []

/*
 * Certifications: no list is exported and none is rendered. If one is ever
 * earned and considered relevant, it becomes its own typed export here and its
 * own branch in `About.tsx` — never a logo strip, and never implied by copy.
 */

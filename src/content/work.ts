import type { Bi } from '../lib/i18n'
import { fr } from '../lib/typo'

/* ============================================================================
   work.ts — the register
   ----------------------------------------------------------------------------
   Every project with a page, and the only place the projects are described.

   Rules that hold for every entry:

   - `claim` is one line. It is read on the home traverse and in the file
     header: it must survive being the only thing someone reads.
   - `summary` says why the thing exists, what it does, and where it stands.
     Two or three sentences. No adjective doing the work of a fact.
   - `did` is three verbs. What he actually built, not the scope of the idea.
   - `stack` is mono in the UI: instruments, not a sentence.
   - `links` only holds addresses that resolve today, publicly. A service behind
     SSO is not a link — it is `access`.
   - `status` is read off the deployment, never a promise.

   French is written, not translated. `fr()` sets the punctuation spacing.
   ========================================================================== */

export type Domain = 'infrastructure' | 'security' | 'software' | 'experiments'

export type ProjectLink = {
  label: Bi
  href: string
  /** Printed under the address: what the reader will find there. */
  note: Bi
}

export type Project = {
  slug: string
  name: string
  domain: Domain
  /** Four digits, or a range with an en dash. Never a guess. */
  year: string
  status: Bi
  /** One line. The whole project in a breath. */
  claim: Bi
  /** Two or three sentences: why it exists, what it does, where it stands. */
  summary: Bi
  /** Three things he actually did. */
  did: Bi<string[]>
  stack: string[]
  /** Public, resolvable addresses only. */
  links: ProjectLink[]
  /** Printed in the header when the thing is not publicly reachable. */
  access?: Bi
  /** Home traverse order, 1–5. Everything else lives in the register only. */
  featured?: number
}

export const domains: { id: Domain; label: Bi; note: Bi }[] = [
  {
    id: 'infrastructure',
    label: { en: 'Infrastructure & operations', fr: fr('Infrastructure & exploitation') },
    note: { en: 'What runs, and what keeps it running.', fr: fr('Ce qui tourne, et ce qui le fait tourner.') },
  },
  {
    id: 'security',
    label: { en: 'Security & offensive', fr: fr('Sécurité & offensive') },
    note: { en: 'Tools and research from practice.', fr: fr('Outils et recherche issus de la pratique.') },
  },
  {
    id: 'software',
    label: { en: 'Applications & tools', fr: fr('Applications & outils') },
    note: { en: 'Built to be used, not to be demoed.', fr: fr('Faits pour servir, pas pour être démontrés.') },
  },
  {
    id: 'experiments',
    label: { en: 'Experiments & archive', fr: fr('Expériences & archives') },
    note: { en: 'Kept for what they taught.', fr: fr('Gardés pour ce qu’ils ont appris.') },
  },
]

const IN_PRODUCTION: Bi = { en: 'in production', fr: 'en production' }
const IN_PROGRESS: Bi = { en: 'in progress', fr: 'en cours' }
const PROTOTYPE: Bi = { en: 'prototype', fr: 'prototype' }
const ARCHIVE: Bi = { en: 'archive', fr: 'archive' }

export const projects: Project[] = [
  {
    slug: 'lab',
    name: 'the lab',
    domain: 'infrastructure',
    year: '2026',
    status: IN_PRODUCTION,
    featured: 1,
    claim: {
      en: 'Two second-hand servers in a flat, and fifty-two guests that have to stay up.',
      fr: fr('Deux serveurs d’occasion dans un appartement, et cinquante-deux invités qui doivent rester debout.'),
    },
    summary: {
      en: 'The network this site runs on: two Proxmox nodes, an OPNsense firewall that splits the connection into eight segments, forty-five documented services from mail to photos, and a backup tier I test on purpose. I rebuilt it in September 2026 — a full migration, then a restore I booted before calling it done.',
      fr: fr('Le réseau sur lequel tourne ce site : deux nœuds Proxmox, un pare-feu OPNsense qui découpe la connexion en huit segments, quarante-cinq services documentés du mail aux photos, et une sauvegarde que je teste exprès. Reconstruit en septembre 2026 — migration complète, puis restauration démarrée avant de dire que c’était fait.'),
    },
    did: {
      en: [
        'Moved more than forty guests onto a new VLAN plan without losing a service.',
        'Wrote two backup tiers by criticality, with weekly garbage collection and a monthly verify.',
        'Restored a guest from PBS and booted it — the only proof that a backup counts.',
      ],
      fr: [
        fr('Migré plus de quarante invités vers un nouveau plan de VLAN sans perdre un service.'),
        fr('Écrit deux niveaux de sauvegarde selon la criticité, avec purge hebdomadaire et vérification mensuelle.'),
        fr('Restauré un invité depuis PBS et démarré la machine — la seule preuve qu’une sauvegarde existe.'),
      ],
    },
    stack: ['Proxmox VE 9.2', 'LVM-thin', 'OPNsense', 'WireGuard', 'PBS', 'Caddy'],
    links: [],
    access: {
      en: 'The documentation and the addresses are private. The numbers on this site come from them.',
      fr: fr('La documentation et les adresses sont privées. Les chiffres de ce site en viennent.'),
    },
  },
  {
    slug: 'cipherbot',
    name: 'cipherbot',
    domain: 'security',
    year: '2026',
    status: IN_PRODUCTION,
    featured: 2,
    claim: {
      en: 'A security question answered inside the channel, not in six browser tabs.',
      fr: fr('Une question de sécurité traitée dans le salon, pas dans six onglets.'),
    },
    summary: {
      en: 'A Discord bot for a security community: CVE lookup on the NVD, MITRE ATT&CK techniques, RDAP for a domain, hash and URL reputation from VirusTotal. One Rust binary with a local SQLite cache — a repeat lookup costs nothing, and a rate limit upstream does not stop the conversation.',
      fr: fr('Un bot Discord pour une communauté cybersécurité : recherche de CVE sur le NVD, techniques MITRE ATT&CK, RDAP pour un domaine, réputation d’un hash ou d’une URL via VirusTotal. Un seul binaire Rust avec un cache SQLite local — une recherche répétée ne coûte rien, et une limite de débit en amont n’arrête pas la conversation.'),
    },
    did: {
      en: [
        'Put four unrelated APIs behind one command grammar.',
        'Cached every answer in SQLite, respecting each source’s rate limit separately.',
        'Shipped it as a single container on the swarm and kept it there.',
      ],
      fr: [
        fr('Réuni quatre API sans rapport derrière une seule grammaire de commandes.'),
        fr('Mis en cache chaque réponse en SQLite, en respectant séparément la limite de chaque source.'),
        fr('Livré en un conteneur unique sur le swarm, et laissé en place.'),
      ],
    },
    stack: ['Rust', 'serenity', 'SQLite', 'Docker'],
    links: [
      {
        label: { en: 'source', fr: 'code' },
        href: 'https://github.com/cleeryy/cipherbot',
        note: { en: 'github.com/cleeryy/cipherbot', fr: 'github.com/cleeryy/cipherbot' },
      },
    ],
  },
  {
    slug: 'openclip',
    name: 'calque',
    domain: 'software',
    year: '2026',
    status: IN_PROGRESS,
    featured: 3,
    claim: {
      en: 'A painting studio for Android tablets that never phones home.',
      fr: fr('Un studio de peinture pour tablette Android qui n’appelle jamais la maison.'),
    },
    summary: {
      en: 'Brushes with pressure, layers and masks, comic pages, frame-by-frame animation. A clean-room Kotlin app under GPL-3.0: the tablet apps I could find were subscriptions, abandoned, or both. One hundred commits so far, and the brush engine is the part that keeps taking the time.',
      fr: fr('Des pinceaux sensibles à la pression, des calques et des masques, des planches de BD, de l’animation image par image. Une application Kotlin écrite de zéro sous GPL-3.0 : les applis de dessin que je trouvais étaient par abonnement, abandonnées, ou les deux. Cent commits à ce jour, et c’est le moteur de pinceau qui prend le temps.'),
    },
    did: {
      en: [
        'Built the brush and layer model on Android’s own canvas pipeline, importing no engine.',
        'Added page layout and onion-skin animation for comic work.',
        'Kept it offline-first: no account, no telemetry, nothing leaves the tablet.',
      ],
      fr: [
        fr('Construit le modèle de pinceau et de calques sur le pipeline canvas d’Android, sans importer de moteur.'),
        fr('Ajouté la mise en page et l’animation avec pelure d’oignon pour la BD.'),
        fr('Gardé hors-ligne d’abord : pas de compte, pas de télémétrie, rien ne quitte la tablette.'),
      ],
    },
    stack: ['Kotlin', 'Android', 'GPL-3.0'],
    links: [
      {
        label: { en: 'source', fr: 'code' },
        href: 'https://github.com/cleeryy/openclip',
        note: { en: 'github.com/cleeryy/openclip', fr: 'github.com/cleeryy/openclip' },
      },
    ],
  },
  {
    slug: 'vegjustice',
    name: 'vegjustice',
    domain: 'software',
    year: '2026',
    status: IN_PRODUCTION,
    featured: 4,
    claim: {
      en: 'A justice system for a roleplay server, with courts, fines and a budget.',
      fr: fr('Un système judiciaire pour serveur roleplay, avec tribunaux, amendes et budget.'),
    },
    summary: {
      en: 'Police, charges, hearings, sentences and a judicial economy, as a Paper/Purpur plugin in Java 21. It is the project I have iterated on the longest — two hundred and thirty commits — because a roleplay server finds every edge case a specification leaves out.',
      fr: fr('Police, chefs d’accusation, audiences, peines et économie judiciaire, en plugin Paper/Purpur pour Java 21. C’est le projet que j’ai le plus itéré — deux cent trente commits — parce qu’un serveur roleplay trouve chaque cas limite qu’une spécification oublie.'),
    },
    did: {
      en: [
        'Modelled a case from report to sentence: charge, hearing, verdict, record.',
        'Built the money side so fines and bail actually move between players.',
        'Kept the staff commands small enough for non-technical moderators.',
      ],
      fr: [
        fr('Modélisé une affaire du dépôt de plainte à la peine : chef d’accusation, audience, verdict, casier.'),
        fr('Construit le volet financier pour que les amendes et la caution circulent vraiment entre joueurs.'),
        fr('Gardé des commandes de modération assez simples pour des bénévoles non techniciens.'),
      ],
    },
    stack: ['Java 21', 'Paper', 'Purpur'],
    links: [],
    access: {
      en: 'Running on a private game server; the source sits on a private forge.',
      fr: fr('En production sur un serveur de jeu privé ; le code est sur une forge privée.'),
    },
  },
  {
    slug: 'atlas-live',
    name: 'atlas-live',
    domain: 'infrastructure',
    year: '2026',
    status: IN_PRODUCTION,
    featured: 5,
    claim: {
      en: 'The cluster, drawn live as SVG, with no build step and no dependencies.',
      fr: fr('Le cluster, dessiné en direct en SVG, sans build ni dépendance.'),
    },
    summary: {
      en: 'A Python collector on the standard library walks the cluster every fifteen seconds, resolves the fifty-two documented flows and probes seventeen TCP ports, then writes one page of SVG and JavaScript. It is the first thing I open when something feels slow.',
      fr: fr('Un collecteur Python sur la bibliothèque standard parcourt le cluster toutes les quinze secondes, résout les cinquante-deux flux documentés et sonde dix-sept ports TCP, puis écrit une page de SVG et de JavaScript. C’est la première chose que j’ouvre quand quelque chose me paraît lent.'),
    },
    did: {
      en: [
        'Derived the flow model from the reverse-proxy config, not from a hand-drawn diagram.',
        'Kept the collector dependency-free so a distribution upgrade cannot break it.',
        'Generated the printed posters from the same inventory file.',
      ],
      fr: [
        fr('Déduit le modèle de flux de la configuration du reverse proxy, pas d’un schéma dessiné à la main.'),
        fr('Gardé le collecteur sans dépendance pour qu’une montée de version ne puisse pas le casser.'),
        fr('Généré les posters imprimés depuis le même fichier d’inventaire.'),
      ],
    },
    stack: ['Python', 'SVG', 'JavaScript'],
    links: [],
    access: {
      en: 'Internal only — it shows the live map, addresses included.',
      fr: fr('Interne uniquement — il affiche la carte en direct, adresses comprises.'),
    },
  },
  {
    slug: 'blog',
    name: 'blog',
    domain: 'software',
    year: '2025',
    status: IN_PRODUCTION,
    claim: {
      en: 'Notes from the lab, shipped by the same pipeline as the code.',
      fr: fr('Des notes de labo, livrées par le même pipeline que le code.'),
    },
    summary: {
      en: 'Hugo, a Git push, GitHub Actions that build a multi-arch image, scan it with Trivy and push to GHCR, then Dokploy redeploys. Posts on Proxmox, SSH, Docker, and the writeups below. The pipeline is half the point: if a post cannot ship through CI, it does not ship.',
      fr: fr('Hugo, un push Git, des GitHub Actions qui construisent une image multi-arch, la scannent avec Trivy et la poussent sur GHCR, puis Dokploy redéploie. Des articles sur Proxmox, SSH, Docker, et les writeups ci-dessous. Le pipeline compte autant que le texte : si un article ne passe pas la CI, il ne sort pas.'),
    },
    did: {
      en: [
        'Rebuilt the blog from a VPS backup into a GitOps pipeline.',
        'Wrote the build, the scan and the deploy as one path with no manual step.',
        'Kept every post in Markdown, in the repo, next to its history.',
      ],
      fr: [
        fr('Reconstruit le blog depuis une sauvegarde du VPS vers un pipeline GitOps.'),
        fr('Écrit le build, le scan et le déploiement comme un seul chemin, sans étape manuelle.'),
        fr('Gardé chaque article en Markdown, dans le dépôt, à côté de son historique.'),
      ],
    },
    stack: ['Hugo', 'Docker', 'GitHub Actions', 'GHCR', 'Dokploy'],
    links: [
      {
        label: { en: 'read', fr: 'lire' },
        href: 'https://blog.cleeryy.cloud',
        note: { en: 'blog.cleeryy.cloud', fr: 'blog.cleeryy.cloud' },
      },
    ],
  },
  {
    slug: 'micforge',
    name: 'micforge',
    domain: 'software',
    year: '2026',
    status: IN_PROGRESS,
    claim: {
      en: 'A microphone chain that runs while you speak, written in Rust.',
      fr: fr('Une chaîne micro qui tourne pendant que tu parles, écrite en Rust.'),
    },
    summary: {
      en: 'Noise suppression, gate, compressor, EQ, de-esser and limiter in real time, packaged as a Tauri v2 app for Windows with the DSP in plain Rust. Built because the chain I wanted cost more than the microphone. In progress: the DSP is the finished part, the installer is not.',
      fr: fr('Réduction de bruit, gate, compresseur, EQ, de-esser et limiteur en temps réel, dans une application Tauri v2 pour Windows avec le DSP en Rust pur. Construit parce que la chaîne que je voulais coûtait plus cher que le micro. En cours : le DSP est fini, l’installeur ne l’est pas.'),
    },
    did: {
      en: [
        'Wrote each stage as a sample-by-sample processor with no allocation on the audio thread.',
        'Wired the chain into a Tauri backend so the interface never touches the buffer.',
        'Tuned it on a real microphone in a real room, not on a test signal.',
      ],
      fr: [
        fr('Écrit chaque étage comme un processeur échantillon par échantillon, sans allocation sur le thread audio.'),
        fr('Câblé la chaîne dans un backend Tauri pour que l’interface ne touche jamais au tampon.'),
        fr('Réglé sur un vrai micro dans une vraie pièce, pas sur un signal de test.'),
      ],
    },
    stack: ['Rust', 'Tauri v2', 'DSP', 'AGPL-3.0'],
    links: [
      {
        label: { en: 'source', fr: 'code' },
        href: 'https://github.com/cleeryy/micforge',
        note: { en: 'github.com/cleeryy/micforge', fr: 'github.com/cleeryy/micforge' },
      },
    ],
  },
  {
    slug: 'zenfree',
    name: 'zenfree',
    domain: 'software',
    year: '2026',
    status: PROTOTYPE,
    claim: {
      en: 'One OpenAI-compatible endpoint in front of free model providers.',
      fr: fr('Un point d’entrée compatible OpenAI devant des fournisseurs de modèles gratuits.'),
    },
    summary: {
      en: 'A Rust gateway that exposes a single API and routes to free providers, with fallbacks and key handling. Prototype: the routing works, the hardening does not, and I would not put it in front of anything that matters yet.',
      fr: fr('Une passerelle Rust qui expose une seule API et route vers des fournisseurs gratuits, avec bascules et gestion des clés. Prototype : le routage fonctionne, le durcissement non — je ne le mettrais pas encore devant quelque chose d’important.'),
    },
    did: {
      en: [
        'Normalised four providers behind one request shape.',
        'Added a fallback when a provider rate-limits or drops.',
        'Kept keys and rotation out of the client entirely.',
      ],
      fr: [
        fr('Normalisé quatre fournisseurs derrière une seule forme de requête.'),
        fr('Ajouté une bascule quand un fournisseur limite le débit ou tombe.'),
        fr('Gardé les clés et leur rotation entièrement hors du client.'),
      ],
    },
    stack: ['Rust', 'Axum', 'Docker'],
    links: [],
    access: {
      en: 'Prototype, private repository.',
      fr: fr('Prototype, dépôt privé.'),
    },
  },
  {
    slug: 'jambon',
    name: 'jambon',
    domain: 'software',
    year: '2026',
    status: PROTOTYPE,
    claim: {
      en: 'Proxmox from a Discord channel, in Rust.',
      fr: fr('Proxmox depuis un salon Discord, en Rust.'),
    },
    summary: {
      en: 'Cluster view, guest state and slash commands, built in July–August 2026 over forty-five commits. It replaced an earlier Go attempt; that one is still in the archive, and it is the reason this one has a smaller scope.',
      fr: fr('Vue du cluster, état des invités et commandes slash, construit en juillet–août 2026 en quarante-cinq commits. Il remplace une première tentative en Go, restée aux archives — c’est elle qui a donné à celui-ci un périmètre plus étroit.'),
    },
    did: {
      en: [
        'Wrote the Proxmox client by hand against the API.',
        'Kept every action idempotent, so a repeated command is safe.',
        'Cut the scope after the first version tried to do everything.',
      ],
      fr: [
        fr('Écrit le client Proxmox à la main contre l’API.'),
        fr('Rendu chaque action idempotente, pour qu’une commande répétée soit sans risque.'),
        fr('Réduit le périmètre après une première version qui voulait tout faire.'),
      ],
    },
    stack: ['Rust', 'Proxmox API', 'Discord'],
    links: [
      {
        label: { en: 'source', fr: 'code' },
        href: 'https://github.com/cleeryy/jambon',
        note: { en: 'github.com/cleeryy/jambon', fr: 'github.com/cleeryy/jambon' },
      },
    ],
  },
  {
    slug: 'hello',
    name: 'hello',
    domain: 'software',
    year: '2026',
    status: IN_PRODUCTION,
    claim: {
      en: 'Wake-on-LAN as an API, small enough to run on a Pi.',
      fr: fr('Le Wake-on-LAN en API, assez petit pour tourner sur un Pi.'),
    },
    summary: {
      en: 'A Go/Gin service that sends magic packets, with CI, tagged releases and a container image. It runs on a Raspberry Pi at home and is the first thing I reach for when a machine is asleep.',
      fr: fr('Un service Go/Gin qui envoie des paquets magiques, avec CI, releases taguées et image Docker. Il tourne sur un Raspberry Pi à la maison, et c’est la première chose que j’utilise quand une machine dort.'),
    },
    did: {
      en: [
        'Kept the API to one endpoint and one job.',
        'Added releases so the binary is a download, not a build.',
        'Ran it on ARM before calling it done.',
      ],
      fr: [
        fr('Gardé une API à un seul endpoint et un seul travail.'),
        fr('Ajouté des releases pour que le binaire se télécharge au lieu de se compiler.'),
        fr('Testé sur ARM avant de le déclarer fini.'),
      ],
    },
    stack: ['Go', 'Gin', 'Docker'],
    links: [
      {
        label: { en: 'source', fr: 'code' },
        href: 'https://github.com/cleeryy/hello',
        note: { en: 'github.com/cleeryy/hello', fr: 'github.com/cleeryy/hello' },
      },
    ],
  },
  {
    slug: 'balcon',
    name: 'balcon',
    domain: 'software',
    year: '2026',
    status: IN_PRODUCTION,
    claim: {
      en: 'A page watcher I control, because the hosted ones charge per check.',
      fr: fr('Un surveillant de pages que je contrôle, parce que les services hébergés facturent à la vérification.'),
    },
    summary: {
      en: 'Next.js 16, Prisma, and a Python sidecar on curl_cffi for the pages that do not want to be fetched. It watches a page, diffs it, and notifies. Self-hosted: one database, no per-check pricing, no vendor deciding what I may watch.',
      fr: fr('Next.js 16, Prisma, et un sidecar Python sur curl_cffi pour les pages qui n’aiment pas être lues. Il surveille une page, la diffe, et prévient. Auto-hébergé : une base, pas de tarif à la vérification, aucun prestataire pour décider ce que j’ai le droit de surveiller.'),
    },
    did: {
      en: [
        'Split the crawler into a sidecar so a bad page cannot block the app.',
        'Stored diffs rather than screenshots, so the notification says what changed.',
        'Ran the scheduler inside the process, with no external cron.',
      ],
      fr: [
        fr('Séparé le crawler dans un sidecar pour qu’une page cassée ne bloque pas l’application.'),
        fr('Stocké des diffs plutôt que des captures, pour que la notification dise ce qui a changé.'),
        fr('Fait tourner l’ordonnanceur dans le processus, sans cron externe.'),
      ],
    },
    stack: ['Next.js 16', 'TypeScript', 'Prisma', 'SQLite', 'FastAPI'],
    links: [
      {
        label: { en: 'source', fr: 'code' },
        href: 'https://github.com/cleeryy/balcon',
        note: { en: 'github.com/cleeryy/balcon', fr: 'github.com/cleeryy/balcon' },
      },
    ],
    access: {
      en: 'The running instance is private.',
      fr: fr('L’instance qui tourne est privée.'),
    },
  },
  {
    slug: 'mealboard',
    name: 'mealboard',
    domain: 'software',
    year: '2026',
    status: IN_PRODUCTION,
    claim: {
      en: 'Seven dinners, one shopping list, no decision at seven in the evening.',
      fr: fr('Sept dîners, une liste de courses, aucune décision à dix-neuf heures.'),
    },
    summary: {
      en: 'A Next.js app with one SQLite file: plan the week, generate the list, keep the recipes you actually cook. Self-hosted because a meal planner should not need an account.',
      fr: fr('Une application Next.js avec un seul fichier SQLite : planifier la semaine, générer la liste, garder les recettes qu’on cuisine vraiment. Auto-hébergée, parce qu’un planificateur de repas n’a pas besoin d’un compte.'),
    },
    did: {
      en: [
        'Modelled the week as the unit, not the recipe.',
        'Generated the list from the plan, including what is already in the cupboard.',
        'Kept the whole thing in one container and one file.',
      ],
      fr: [
        fr('Modélisé la semaine comme unité, pas la recette.'),
        fr('Généré la liste depuis le plan, en tenant compte de ce qui est déjà dans le placard.'),
        fr('Gardé l’ensemble dans un conteneur et un fichier.'),
      ],
    },
    stack: ['Next.js', 'TypeScript', 'SQLite'],
    links: [],
    access: {
      en: 'Private instance — the source is not public either.',
      fr: fr('Instance privée — le code ne l’est pas non plus.'),
    },
  },
  {
    slug: 'arneph',
    name: 'arneph',
    domain: 'software',
    year: '2026',
    status: IN_PRODUCTION,
    claim: {
      en: 'A webtoon reader that scrolls the way the strip is drawn.',
      fr: fr('Un lecteur de webtoon qui défile comme la planche est dessinée.'),
    },
    summary: {
      en: 'Next.js 16 and React 19 on Supabase: a vertical reader built for long-strip comics, plus a WYSIWYG editor to assemble your own episodes. Public — the only application of mine you can open without an account.',
      fr: fr('Next.js 16 et React 19 sur Supabase : un lecteur vertical pensé pour les bandes longues, et un éditeur WYSIWYG pour assembler ses propres épisodes. Public — la seule de mes applications qu’on peut ouvrir sans compte.'),
    },
    did: {
      en: [
        'Built the reader around scroll position rather than pages.',
        'Wrote the editor so an episode is assembled, not coded.',
        'Tested the reading state with Vitest.',
      ],
      fr: [
        fr('Construit le lecteur autour de la position de défilement plutôt que de pages.'),
        fr('Écrit l’éditeur pour qu’un épisode s’assemble au lieu de se coder.'),
        fr('Testé l’état de lecture avec Vitest.'),
      ],
    },
    stack: ['Next.js 16', 'React 19', 'Supabase', 'Vitest'],
    links: [
      {
        label: { en: 'open', fr: 'ouvrir' },
        href: 'https://arneph.cleeryy.cloud',
        note: { en: 'arneph.cleeryy.cloud', fr: 'arneph.cleeryy.cloud' },
      },
      {
        label: { en: 'source', fr: 'code' },
        href: 'https://github.com/cleeryy/arneph',
        note: { en: 'github.com/cleeryy/arneph', fr: 'github.com/cleeryy/arneph' },
      },
    ],
  },
  {
    slug: 'tchounis-pharmacy',
    name: 'tchounis-pharmacy',
    domain: 'software',
    year: '2026',
    status: IN_PRODUCTION,
    claim: {
      en: 'A revision site where every line can be traced to a source.',
      fr: fr('Un site de révision où chaque ligne renvoie à une source.'),
    },
    summary: {
      en: 'A Fumadocs site built from a course’s PDFs: UE2.11, semester 3, generated sidebar, full-text search. Content is restricted to the course material and official references — when a fact is not there, the page says so instead of filling the gap.',
      fr: fr('Un site Fumadocs construit depuis les PDF d’un cours : UE2.11, semestre 3, barre latérale générée, recherche plein texte. Le contenu se limite au cours et aux références officielles — quand un fait n’y est pas, la page le dit au lieu de combler le vide.'),
    },
    did: {
      en: [
        'Parsed the course material into MDX with a stable structure.',
        'Generated the sidebar and the search index from the files, not by hand.',
        'Wrote the editorial rule: no invented drug data, ever.',
      ],
      fr: [
        fr('Découpé le cours en MDX avec une structure stable.'),
        fr('Généré la barre latérale et l’index de recherche depuis les fichiers, pas à la main.'),
        fr('Écrit la règle éditoriale : aucune donnée médicamenteuse inventée, jamais.'),
      ],
    },
    stack: ['Fumadocs', 'Next.js', 'MDX', 'TypeScript'],
    links: [
      {
        label: { en: 'open', fr: 'ouvrir' },
        href: 'https://tchounis-pharmacy.cleeryy.cloud',
        note: { en: 'tchounis-pharmacy.cleeryy.cloud', fr: 'tchounis-pharmacy.cleeryy.cloud' },
      },
    ],
  },
  {
    slug: 'gices',
    name: 'gices',
    domain: 'software',
    year: '2026',
    status: PROTOTYPE,
    claim: {
      en: 'The mail that arrives on paper, tracked like the rest.',
      fr: fr('Le courrier qui arrive en papier, suivi comme le reste.'),
    },
    summary: {
      en: 'Next.js 14, Prisma and NextAuth: what came in, what it is, what has to be answered, and when. Built for a household rather than a company — a prototype that turned into something used every week.',
      fr: fr('Next.js 14, Prisma et NextAuth : ce qui est arrivé, ce que c’est, ce qu’il faut y répondre, et quand. Construit pour un foyer plutôt que pour une entreprise — un prototype devenu outil hebdomadaire.'),
    },
    did: {
      en: [
        'Modelled paper and email as one object with two origins.',
        'Added reminders by due date rather than by arrival.',
        'Kept authentication boring: one provider, one session.',
      ],
      fr: [
        fr('Modélisé le papier et le courriel comme un seul objet à deux origines.'),
        fr('Ajouté des rappels par échéance plutôt que par arrivée.'),
        fr('Gardé une authentification ennuyeuse : un fournisseur, une session.'),
      ],
    },
    stack: ['Next.js 14', 'TypeScript', 'Prisma', 'NextAuth'],
    links: [
      {
        label: { en: 'source', fr: 'code' },
        href: 'https://github.com/cleeryy/gices',
        note: { en: 'github.com/cleeryy/gices', fr: 'github.com/cleeryy/gices' },
      },
    ],
  },
  {
    slug: 'gv-downloader',
    name: 'gv-downloader',
    domain: 'infrastructure',
    year: '2026',
    status: IN_PRODUCTION,
    claim: {
      en: 'Downloads that survive a reboot mid-transfer.',
      fr: fr('Des téléchargements qui survivent à un redémarrage en pleine copie.'),
    },
    summary: {
      en: 'A Rust/Axum web UI that takes an archive, identifies it by magic bytes rather than extension, resumes with Range requests, and retries. It feeds a GameVault instance, so it has to be right about what a file is before it moves it.',
      fr: fr('Une interface web Rust/Axum qui prend une archive, l’identifie par ses magic bytes plutôt que par son extension, reprend avec des requêtes Range, et réessaie. Elle alimente une instance GameVault : elle doit donc savoir ce qu’est un fichier avant de le déplacer.'),
    },
    did: {
      en: [
        'Detected zip, rar and 7z from their headers, not their names.',
        'Resumed transfers from the last byte written.',
        'Restored its own queue at boot.',
      ],
      fr: [
        fr('Détecté zip, rar et 7z depuis leurs en-têtes, pas depuis leurs noms.'),
        fr('Repris les transferts au dernier octet écrit.'),
        fr('Restauré sa propre file d’attente au démarrage.'),
      ],
    },
    stack: ['Rust', 'Axum', 'Docker'],
    links: [],
    access: {
      en: 'Internal service, private source.',
      fr: fr('Service interne, code privé.'),
    },
  },
  {
    slug: 'ifsi-edt',
    name: 'ifsi-edt',
    domain: 'infrastructure',
    year: '2026',
    status: IN_PRODUCTION,
    claim: {
      en: 'A timetable PDF turned into a calendar you can subscribe to.',
      fr: fr('Un emploi du temps en PDF transformé en calendrier auquel s’abonner.'),
    },
    summary: {
      en: 'Python: reproduces a Shibboleth/CAS login over plain HTTP, pulls the weekly PDF from Moodle, filters it by group, and publishes an iCalendar feed. It exists because the official timetable is a PDF published on Monday, for a week that started on Monday.',
      fr: fr('Python : reproduit une connexion Shibboleth/CAS en HTTP pur, récupère le PDF hebdomadaire sur Moodle, le filtre par groupe et publie un flux iCalendar. Il existe parce que l’emploi du temps officiel est un PDF publié le lundi, pour une semaine qui a commencé le lundi.'),
    },
    did: {
      en: [
        'Reverse-engineered the SSO flow with plain requests and cookies.',
        'Parsed the PDF into events, with rooms and groups.',
        'Published a stable iCal URL a phone can subscribe to.',
      ],
      fr: [
        fr('Rétro-conçu le flux SSO avec de simples requêtes et des cookies.'),
        fr('Analysé le PDF pour en sortir des événements, avec salles et groupes.'),
        fr('Publié une URL iCal stable, abonnable depuis un téléphone.'),
      ],
    },
    stack: ['Python', 'Docker', 'iCalendar'],
    links: [],
    access: {
      en: 'Private, and used by someone else — so the address stays private too.',
      fr: fr('Privé, et utilisé par quelqu’un d’autre — l’adresse reste donc privée aussi.'),
    },
  },
  {
    slug: 'caddy-config',
    name: 'caddy-config',
    domain: 'infrastructure',
    year: '2026',
    status: IN_PRODUCTION,
    claim: {
      en: 'Sixty-six vhosts, one file per route, one command to sync.',
      fr: fr('Soixante-six vhosts, un fichier par route, une commande pour synchroniser.'),
    },
    summary: {
      en: 'The reverse proxy in front of everything: wildcard TLS by DNS-01, forward_auth templates for Authentik, and a small tool that pushes the configuration and reloads. A route is a file, so a change is a diff and a rollback is a revert.',
      fr: fr('Le reverse proxy devant tout : TLS wildcard par DNS-01, gabarits forward_auth pour Authentik, et un petit outil qui pousse la configuration et recharge. Une route est un fichier : un changement est un diff, un retour arrière est un revert.'),
    },
    did: {
      en: [
        'Split public and private routes into two trees sharing one template.',
        'Wrote the auth template once and applied it to every sensitive host.',
        'Made the sync a command with a dry run.',
      ],
      fr: [
        fr('Séparé les routes publiques et privées en deux arbres partageant un gabarit.'),
        fr('Écrit le gabarit d’authentification une fois et appliqué à chaque hôte sensible.'),
        fr('Fait de la synchronisation une commande avec un mode à blanc.'),
      ],
    },
    stack: ['Caddy', 'DNS-01', 'Authentik', 'Bash'],
    links: [],
    access: {
      en: 'Private repository — the routes it publishes are public, the config is not.',
      fr: fr('Dépôt privé — les routes qu’il publie sont publiques, la configuration non.'),
    },
  },
  {
    slug: 'rogueplanet',
    name: 'rogueplanet',
    domain: 'security',
    year: '2026',
    status: ARCHIVE,
    claim: {
      en: 'A race condition against Defender, taken to SYSTEM.',
      fr: fr('Une race condition contre Defender, jusqu’à SYSTEM.'),
    },
    summary: {
      en: 'A C++ proof of concept, tested on Windows 10 and 11, that escalates through a race in Defender’s file handling. Archived on purpose: the README references an existing public analysis — the implementation is mine, the discovery is not, and the page says so.',
      fr: fr('Un proof of concept C++, testé sur Windows 10 et 11, qui escalade via une race dans la gestion de fichiers de Defender. Archivé volontairement : le README renvoie à une analyse publique existante — l’implémentation est de moi, la découverte non, et la page le dit.'),
    },
    did: {
      en: [
        'Reproduced the race reliably enough to test a mitigation.',
        'Kept the proof of concept small: one binary, no persistence.',
        'Documented what is mine and what is not.',
      ],
      fr: [
        fr('Reproduit la race assez fiablement pour tester une atténuation.'),
        fr('Gardé un proof of concept petit : un binaire, aucune persistance.'),
        fr('Documenté ce qui est de moi et ce qui ne l’est pas.'),
      ],
    },
    stack: ['C++', 'Windows'],
    links: [],
    access: {
      en: 'Private repository, kept as a record.',
      fr: fr('Dépôt privé, conservé comme trace.'),
    },
  },
  {
    slug: 'infra-company',
    name: 'infra-company',
    domain: 'experiments',
    year: '2026',
    status: PROTOTYPE,
    claim: {
      en: 'Twenty-nine agents playing an infrastructure company.',
      fr: fr('Vingt-neuf agents qui jouent une entreprise d’infrastructure.'),
    },
    summary: {
      en: 'A local simulation: guilds for compute, network, data, reliability and strategy, with runbooks, change requests, and a safety veto that can stop a change. A prototype in prompts and process — the interesting part is where it fails, not where it works.',
      fr: fr('Une simulation locale : des guildes compute, réseau, données, fiabilité et stratégie, avec des runbooks, des demandes de changement et un veto de sûreté qui peut arrêter un changement. Un prototype en prompts et en processus — la partie intéressante est là où ça échoue, pas là où ça marche.'),
    },
    did: {
      en: [
        'Wrote the guild contracts and the hand-off between them.',
        'Added a change-request path with an explicit veto.',
        'Ran it against real tasks from my own backlog.',
      ],
      fr: [
        fr('Écrit les contrats des guildes et les passations entre elles.'),
        fr('Ajouté un chemin de demande de changement avec un veto explicite.'),
        fr('Confronté à de vraies tâches de mon propre backlog.'),
      ],
    },
    stack: ['Markdown', 'prompts', 'process'],
    links: [],
    access: {
      en: 'Local only — it is a process experiment, not a product.',
      fr: fr('Local uniquement — c’est une expérience de processus, pas un produit.'),
    },
  },
]

export const featured = projects
  .filter((project) => project.featured !== undefined)
  .sort((a, b) => (a.featured ?? 0) - (b.featured ?? 0))

export function projectBySlug(slug: string): Project | undefined {
  return projects.find((project) => project.slug === slug)
}

export function projectsByDomain(domain: Domain): Project[] {
  return projects.filter((project) => project.domain === domain)
}

/* -------------------------------------------------------------------------- */
/* Page copy                                                                   */
/* -------------------------------------------------------------------------- */

export type WorkCopy = {
  title: string
  lead: string
  countLabel: string
  /** Foot note under the register. */
  note: string
  openLabel: string
  trailTitle: string
  trailLead: string
  trailNote: string
}

export const workCopy: Bi<WorkCopy> = {
  en: {
    title: 'The register',
    lead: 'Twenty projects, ordered by what they are rather than by when I started them. Each file says what the thing is, what I did, and where it stands — including the ones that stopped.',
    countLabel: 'projects',
    note: 'Links go to the repository or the running service. “Private” means behind SSO or closed source, not broken.',
    openLabel: 'open file',
    trailTitle: 'Selected work',
    trailLead: 'Five files worth opening first.',
    trailNote: 'The rest is in the register.',
  },
  fr: {
    title: 'Le registre',
    lead: fr('Vingt projets, classés par ce qu’ils sont plutôt que par leur date de début. Chaque fiche dit ce que c’est, ce que j’ai fait, et où ça en est — y compris ceux qui se sont arrêtés.'),
    countLabel: 'projets',
    note: fr('Les liens mènent au dépôt ou au service en ligne. « Privé » veut dire derrière un SSO ou fermé, pas cassé.'),
    openLabel: 'ouvrir la fiche',
    trailTitle: 'Travaux choisis',
    trailLead: fr('Cinq fiches à ouvrir en premier.'),
    trailNote: fr('Le reste est au registre.'),
  },
}

export type FileCopy = {
  fileLabel: string
  summaryLabel: string
  didLabel: string
  stackLabel: string
  linksLabel: string
  statusLabel: string
  yearLabel: string
  accessLabel: string
  nextLabel: string
  prevLabel: string
  backLabel: string
  noLink: string
  missingTitle: string
  missingLead: string
  missingCta: string
}

export const fileCopy: Bi<FileCopy> = {
  en: {
    fileLabel: 'file',
    summaryLabel: 'What it is',
    didLabel: 'What I did',
    stackLabel: 'Built with',
    linksLabel: 'Open',
    statusLabel: 'state',
    yearLabel: 'year',
    accessLabel: 'access',
    nextLabel: 'next file',
    prevLabel: 'previous file',
    backLabel: 'the register',
    noLink: 'No public address. The code, the service, or both are private.',
    missingTitle: 'This file is not in the register.',
    missingLead: 'The address exists, the project does not — or it did under another name.',
    missingCta: 'Back to the register',
  },
  fr: {
    fileLabel: 'fiche',
    summaryLabel: 'Ce que c’est',
    didLabel: 'Ce que j’ai fait',
    stackLabel: 'Construit avec',
    linksLabel: 'Ouvrir',
    statusLabel: 'état',
    yearLabel: 'année',
    accessLabel: 'accès',
    nextLabel: 'fiche suivante',
    prevLabel: 'fiche précédente',
    backLabel: 'le registre',
    noLink: fr('Aucune adresse publique. Le code, le service, ou les deux sont privés.'),
    missingTitle: fr('Cette fiche n’est pas au registre.'),
    missingLead: fr('L’adresse existe, le projet non — ou il a existé sous un autre nom.'),
    missingCta: 'Retour au registre',
  },
}

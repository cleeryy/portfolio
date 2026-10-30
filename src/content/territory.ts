import type { Bi } from '../lib/i18n'

/**
 * Inventory of the real homelab, distilled into the marks the section draws.
 *
 * Sources, and what each one is allowed to say:
 * - `homelab/content/architecture/service-placement.mdx` — which node carries
 *   which guest. Every `host` below is a row in that table.
 * - `homelab/content/architecture/node-roles.mdx` — what each node is for, and
 *   the `vmbr1` trunk between them.
 * - `homelab/content/architecture/network.mdx` — OPNsense VM 501 on `pve3`,
 *   WireGuard as an interface on it (`wg0`, udp/51920), the 1 Gbit/s trunk.
 * - `homelab/content/architecture/backups.mdx` — PBS as LXC 578 on `pve3`, the
 *   target of both nodes, and the encrypted off-site copy that leaves at 06:00.
 * - `homelab/content/architecture/security.mdx` — Warpgate as the only SSH door,
 *   Caddy as the only ingress, Authentik as the one SSO.
 * - the reverse-proxy config — what is exposed. The counts come from there and
 *   nowhere else.
 *
 * The plate is a *section*, not a floor plan: a mark's stratum is the role it
 * plays, not the chassis it sits in. Which is exactly why the hosting relation
 * has to be drawn separately: `opnsense`, `caddy`, `warpgate` and `authentik`
 * work on the edge stratum and still run inside `pve3`. Every mark except the
 * two nodes is a guest, and `host` is the only thing that says so.
 */

export type TierId = 'edge' | 'fabric' | 'services'
export type MarkKind = 'node' | 'service' | 'control'

/** Marks that are not stations: the way in, and where the copies leave the sheet. */
export const ENTRY_ID = 'internet'
export const EXIT_ID = 'off-site'

export type TerritoryStation = {
  id: string
  tier: TierId
  kind: MarkKind
  /**
   * Plan coordinates on the mark's own stratum, in drawing units. Layout, not
   * geography — the plate is explicitly not to scale.
   */
  x: number
  z: number
  /**
   * The walk that explains this mark: the ingress path for everything on the
   * request path, the backup branch for the backup target. Consecutive ids in a
   * chain are the route links of the drawing. Nodes have no chain: a place is
   * not a leg, and hovering one answers with what it carries.
   */
  chain: string[]
  /**
   * The node this mark runs on, from the placement table. Drawn as a short tie
   * that only reaches the node when its walk is traced — the one relation on
   * the sheet that is not traffic.
   */
  host?: string
  /** The backup target: its tie to its own node is a backup line, not a host line. */
  backup?: boolean
}

/** The ingress every served mark shares, up to the proxy. */
const VIA_EDGE = [ENTRY_ID, 'opnsense', 'caddy']

export const territoryStations: TerritoryStation[] = [
  /* EDGE — where the outside ends. Four doors, all of them guests of `pve3`:
     opnsense (501), caddy (2010), warpgate (222), authentik (130). The firewall
     is a VM like any other, and WireGuard is an interface on it — `wg0`,
     udp/51920 — so it is a line in opnsense's register row, not a mark.

     The plan is drawn as a sheet seen from above and the front: marks sit where
     the drawing needs them, on the plan's own measure, not in a grid. The edge
     row keeps to the back of its plan and the services row to the front, which
     is what makes the section read as a stack of three rather than one flat
     diagram with two rules through it. */
  { id: 'warpgate', tier: 'edge', kind: 'service', x: -3.55, z: -0.5, chain: [ENTRY_ID, 'opnsense', 'warpgate'], host: 'pve3' },
  { id: 'opnsense', tier: 'edge', kind: 'control', x: -2.2, z: 0.2, chain: [ENTRY_ID, 'opnsense'], host: 'pve3' },
  { id: 'caddy', tier: 'edge', kind: 'service', x: -0.9, z: -0.85, chain: [...VIA_EDGE], host: 'pve3' },
  { id: 'authentik', tier: 'edge', kind: 'service', x: 0.55, z: -0.3, chain: [...VIA_EDGE, 'authentik'], host: 'pve3' },

  /* FABRIC — the two nodes everything is a guest of, joined by vmbr1, and the
     backup target hanging off pve3 on the dashed branch. */
  { id: 'pve1', tier: 'fabric', kind: 'node', x: -2.0, z: 0.1, chain: [] },
  { id: 'pve3', tier: 'fabric', kind: 'node', x: 0.45, z: -0.55, chain: [] },
  { id: 'pbs', tier: 'fabric', kind: 'service', x: 3.05, z: 0.35, chain: ['pve1', 'pbs', EXIT_ID], host: 'pve3', backup: true },

  /* SERVICES — what gets used every day. The older Docker VMs stayed on pve1:
     nextcloud (200), forgejo (111). Everything newer is a container on pve3:
     immich (276), jellyfin (300), mealboard (Dokploy, obiwan 205). */
  { id: 'nextcloud', tier: 'services', kind: 'service', x: -4.35, z: 0.95, chain: [...VIA_EDGE, 'nextcloud'], host: 'pve1' },
  { id: 'forgejo', tier: 'services', kind: 'service', x: -2.7, z: 0.5, chain: [...VIA_EDGE, 'forgejo'], host: 'pve1' },
  { id: 'immich', tier: 'services', kind: 'service', x: -0.85, z: 1.0, chain: [...VIA_EDGE, 'immich'], host: 'pve3' },
  { id: 'jellyfin', tier: 'services', kind: 'service', x: 0.35, z: 0.55, chain: [...VIA_EDGE, 'jellyfin'], host: 'pve3' },
  { id: 'mealboard', tier: 'services', kind: 'service', x: 1.6, z: 0.8, chain: [...VIA_EDGE, 'mealboard'], host: 'pve3' },
]

/**
 * A link family. `route` is traffic, `host` is a guest hanging from a node,
 * `trunk` is `vmbr1` between the two chassis, `backup` is the dashed branch.
 */
export type LinkKind = 'route' | 'host' | 'trunk' | 'backup'

export type TerritoryLink = {
  a: string
  b: string
  kind: LinkKind
  /** A tie hangs from a node at rest; a route reaches its target. */
  tie?: boolean
}

function linkKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

/**
 * Every link on the sheet, derived — route links from the walks, ties from
 * `host`, and the one span that belongs to no walk. Nothing is declared twice:
 * a link exists because a chain walks it, or because a mark is a guest.
 */
function buildLinks(): TerritoryLink[] {
  const links: TerritoryLink[] = []
  const seen = new Set<string>()

  const add = (a: string, b: string, kind: LinkKind, tie = false) => {
    const key = linkKey(a, b)
    if (seen.has(key) || a === b) return
    seen.add(key)
    links.push({ a, b, kind, tie })
  }

  for (const station of territoryStations) {
    const backup = station.id === 'pbs' || station.chain.includes('pbs')
    for (let i = 0; i < station.chain.length - 1; i++) {
      add(station.chain[i], station.chain[i + 1], backup ? 'backup' : 'route')
    }
    if (station.host) add(station.id, station.host, station.backup ? 'backup' : 'host', true)
  }

  // `vmbr1`, VLAN-aware, 1 Gbit/s, direct cable: the only link between the
  // nodes that is not a guest hanging from one of them.
  add('pve1', 'pve3', 'trunk')

  return links
}

export const territoryLinks: TerritoryLink[] = buildLinks()

const byId = new Map(territoryStations.map((station) => [station.id, station]))

/** The guests a node carries — derived, so the drawing and the register agree. */
export function territoryGuests(id: string): TerritoryStation[] {
  return territoryStations.filter((station) => station.host === id)
}

/** The trunk peer of a node. The only link of its kind, so at most one answer. */
export function territoryPeers(id: string): string[] {
  const peers: string[] = []
  for (const link of territoryLinks) {
    if (link.kind !== 'trunk') continue
    if (link.a === id) peers.push(link.b)
    if (link.b === id) peers.push(link.a)
  }
  return peers
}

/**
 * Everything that answers when a mark is pointed at: its own walk, the nodes
 * those marks hang from, and — for a node — everything it carries plus the
 * trunk. The scene lights a link only when both of its ends are in here, so the
 * drawing can never show a route the words do not name.
 */
export function territoryTrace(id: string): string[] {
  const station = byId.get(id)
  if (!station) return []

  const lit = new Set<string>([id])
  for (const step of station.chain) lit.add(step)

  // Every guest on the walk answers with the node it hangs from.
  for (const step of [...lit]) {
    const host = byId.get(step)?.host
    if (host) lit.add(host)
  }

  // A node answers with what it carries and with the trunk it shares.
  for (const guest of territoryGuests(id)) lit.add(guest.id)
  for (const peer of territoryPeers(id)) lit.add(peer)

  return [...lit]
}

/**
 * Two counts and their source. Both were read off the reverse-proxy config —
 * distinct `host` matchers in `sites/public` and `sites/private` — so they are
 * allowed on the page; uptime, load or "99.9%" figures are not, and do not
 * appear anywhere in this file.
 */
export const territorySummary = {
  exposedPublicHosts: 39,
  internalHosts: 28,
  source: {
    en: 'counted from the reverse-proxy config, 30 October 2026',
    fr: 'comptés dans la configuration du reverse proxy, 30 octobre 2026',
  } satisfies Bi,
}

export type TerritoryGroup = {
  id: string
  kind: 'tier' | 'concern'
  label: Bi
  /** One line of framing for the register. Editorial, not a technical claim. */
  role: Bi
  /** Real hostnames / roles, kept short — these are drawn on the plate. */
  nodes: string[]
  note: Bi
}

export const territoryGroups: TerritoryGroup[] = [
  {
    id: 'edge',
    kind: 'tier',
    label: { en: 'Edge', fr: 'Bordure' },
    role: { en: 'where the outside ends', fr: 'là où l’extérieur s’arrête' },
    nodes: ['opnsense', 'caddy', 'warpgate', 'authentik', 'technitium'],
    note: {
      en: 'All five run on pve3 — firewall, ingress, SSH door, SSO and internal DNS on one chassis. Losing that node takes ingress, identity and name resolution down together, which is the failure the restore order is written around. WireGuard is an interface on the firewall (wg0, udp/51920), not a machine.',
      fr: 'Les cinq tournent sur pve3 — pare-feu, ingress, porte SSH, SSO et DNS interne sur un seul châssis. Perdre ce nœud emporte l’ingress, l’identité et la résolution de noms d’un coup\u00a0: c’est la panne autour de laquelle l’ordre de restauration est écrit. WireGuard est une interface du pare-feu (wg0, udp/51920), pas une machine.',
    },
  },
  {
    id: 'fabric',
    kind: 'tier',
    label: { en: 'Fabric', fr: 'Socle' },
    role: { en: 'what everything sits on', fr: 'sur quoi tout repose' },
    nodes: ['pve1', 'pve3', 'pbs'],
    note: {
      en: 'Two nodes, deliberately unequal: pve1 the quiet infrastructure box, pve3 the loaded production one. vmbr1 is the VLAN-aware trunk between them. pbs is a container on pve3 that both nodes back up to, so the encrypted copy leaving the site is the only thing that breaks the shared fate.',
      fr: 'Deux nœuds, volontairement inégaux\u00a0: pve1 la machine d’infrastructure tranquille, pve3 la production chargée. vmbr1 est le trunk VLAN entre les deux. pbs est un conteneur sur pve3 vers lequel les deux nœuds sauvegardent\u00a0: seule la copie chiffrée qui sort du site rompt le destin partagé.',
    },
  },
  {
    id: 'services',
    kind: 'tier',
    label: { en: 'Services', fr: 'Services' },
    role: { en: 'what gets used every day', fr: 'ce qui sert tous les jours' },
    nodes: ['nextcloud', 'forgejo', 'matrix', 'immich', 'jellyfin', 'mealboard'],
    note: {
      en: 'The older Docker VMs stayed on pve1 — files (nextcloud) and git (forgejo); everything newer landed on pve3 as a single-purpose container: photos (immich), media (jellyfin), and the apps I build (mealboard, through Dokploy on obiwan).',
      fr: 'Les vieilles VM Docker sont restées sur pve1 — fichiers (nextcloud) et git (forgejo)\u00a0; tout ce qui est plus récent a atterri sur pve3 en conteneur dédié\u00a0: photos (immich), médias (jellyfin) et les applis que je construis (mealboard, via Dokploy sur obiwan).',
    },
  },
  {
    id: 'identity',
    kind: 'concern',
    label: { en: 'Identity', fr: 'Identité' },
    role: { en: 'who is allowed to touch it', fr: 'qui a le droit d’y toucher' },
    nodes: ['authentik', 'warpgate', 'guacamole', 'technitium', 'wazuh'],
    note: {
      en: 'One SSO in front of the internal routes, a bastion that logs every session, one internal resolver, and a SIEM that watches the rest.',
      fr: 'Un SSO unique devant les routes internes, un bastion qui journalise chaque session, un résolveur interne unique et un SIEM qui surveille le reste.',
    },
  },
  {
    id: 'signal',
    kind: 'concern',
    label: { en: 'Signal', fr: 'Signal' },
    role: { en: 'what tells the truth about it', fr: 'ce qui dit la vérité sur son état' },
    nodes: ['prometheus', 'grafana', 'beszel', 'scraparr'],
    note: {
      en: 'Metrics scraped from the hypervisor down to the download client. If a dashboard is green, it is because a check said so.',
      fr: 'Des métriques collectées de l’hyperviseur jusqu’au client de téléchargement. Un tableau de bord vert, c’est un check qui l’a dit.',
    },
  },
  {
    id: 'delivery',
    kind: 'concern',
    label: { en: 'Delivery', fr: 'Livraison' },
    role: { en: 'how changes reach it', fr: 'comment les changements y arrivent' },
    nodes: ['dokploy', 'caddy', 'forgejo-runner', 'n8n'],
    note: {
      en: 'Deploys start in git: the forge sits on pve1 and its runner on pve3, on purpose, so builds do not contend with the infrastructure node. The reverse-proxy config is versioned and re-applied by cron.',
      fr: 'Les déploiements partent de git\u00a0: la forge est sur pve1 et son runner sur pve3, exprès, pour que les builds ne se battent pas avec le nœud d’infrastructure. La config du reverse proxy est versionnée et réappliquée par cron.',
    },
  },
]

/** Glyphs used by the plate, so the legend and the drawing cannot drift. */
export type LegendKey = 'service' | 'node' | 'control' | 'host' | 'backup'

export type TerritoryCopy = {
  title: string
  lead: string
  plateLabel: string
  plateScale: string
  countLabels: { published: string; internal: string }
  registerLabel: string
  registerNote: string
  legendLabel: string
  legend: { key: LegendKey; label: string }[]
  /** Accessible name of the row of stratum buttons. */
  strataLabel: string
  /** Header of the cross-cutting rows on the fallback plate. */
  concernsLabel: string
  /** The one line that teaches the drawing before a word is hovered. */
  readInstruction: string
  /** The caption that keeps the strata from being read as machines. */
  legendNote: string
  /**
   * The reading line's joinery: how a mark is tied to its node, and how a node
   * states the trunk and what it carries.
   */
  readout: { on: string; trunk: string; guests: string }
  /**
   * The labels that are not station names. `entry` / `exit` are drawn on the
   * scene and on the SVG plate; `cluster` / `backup` are kept for the plate's
   * annotations when a failure trims the drawing down to rules.
   */
  annotations: { entry: string; exit: string; cluster: string; backup: string }
  diagramTitle: string
  diagramDesc: string
  /** Shown on the drawing only when WebGL never arrives. */
  fallbackLabel: string
}

export const territoryCopy: Bi<TerritoryCopy> = {
  en: {
    title: 'Every name here is a thing that runs.',
    lead: 'One room, two Proxmox nodes, one edge. The plate below keeps the order I actually work in: what lets traffic in, what everything runs on, and what gets used every day. Every mark except the two nodes is a guest — including the firewall and the proxy, which is a single point of failure I accept on purpose.',
    plateLabel: 'territory survey',
    plateScale: 'not to scale',
    countLabels: { published: 'published routes', internal: 'internal routes' },
    registerLabel: 'register',
    registerNote: 'every station the lab runs — the drawing is the path, this is the inventory',
    legendLabel: 'Legend',
    legend: [
      { key: 'service', label: 'service' },
      { key: 'node', label: 'node' },
      { key: 'control', label: 'control point' },
      { key: 'host', label: 'hosted on' },
      { key: 'backup', label: 'backup path' },
    ],
    strataLabel: 'Strata',
    concernsLabel: 'cross-cutting',
    readInstruction: 'traffic enters above the edge → crosses the fabric → lands on a service',
    legendNote:
      'strata are roles, not machines — everything but pve1 and pve3 is a guest, and the quiet tie says which node it hangs from',
    readout: { on: 'on', trunk: 'vmbr1 trunk', guests: 'guests' },
    annotations: { entry: 'internet', exit: 'off-site', cluster: 'cluster', backup: 'backup' },
    diagramTitle: 'Three strata of one homelab, and the path a request takes through them.',
    diagramDesc:
      'Three stacked plans. Edge, at the top: opnsense is the only way in and the single control point, drawn as a ring, with WireGuard as an interface on it rather than a separate machine; caddy terminates HTTPS; warpgate is the only SSH door; authentik is the SSO. All four run on pve3, and a quiet tie joins each of them to the node beneath. Fabric, in the middle: pve1 and pve3 are the two Proxmox nodes, joined by the vmbr1 trunk; pbs is a container on pve3 and the backup target of both, on a dashed branch that leaves the sheet as an encrypted off-site copy. Services, at the bottom: nextcloud and forgejo run on pve1; immich, jellyfin and mealboard run on pve3. A request arrives from the internet above the edge, is forwarded by opnsense to caddy, and lands on the service that answers it. Pointing at a mark lights its route, the node it hangs from and the links between them, and prints the chain in words; the drawing turns as the section moves, and the register below lists every station, including the ones the drawing leaves out.',
    fallbackLabel: 'drawing unavailable — the register below carries the same stations',
  },
  fr: {
    title: 'Ici, chaque nom est une chose qui tourne.',
    lead: 'Une pièce, deux nœuds Proxmox, une seule bordure. La planche ci-dessous garde l’ordre dans lequel je travaille vraiment\u00a0: ce qui laisse entrer le trafic, ce sur quoi tout repose, et ce qui sert tous les jours. Tout ce qui est dessiné sauf les deux nœuds est un invité — y compris le pare-feu et le proxy, un point de défaillance que j’assume.',
    plateLabel: 'planche du territoire',
    plateScale: 'sans échelle',
    countLabels: { published: 'routes publiées', internal: 'routes internes' },
    registerLabel: 'registre',
    registerNote: 'chaque station du labo — le dessin est le chemin, ceci est l’inventaire',
    legendLabel: 'Légende',
    legend: [
      { key: 'service', label: 'service' },
      { key: 'node', label: 'nœud' },
      { key: 'control', label: 'point de contrôle' },
      { key: 'host', label: 'hébergé sur' },
      { key: 'backup', label: 'chemin de sauvegarde' },
    ],
    strataLabel: 'Strates',
    concernsLabel: 'transversal',
    readInstruction: 'le trafic entre au-dessus de la bordure → traverse le socle → atterrit sur un service',
    legendNote:
      'les strates sont des rôles, pas des machines — tout sauf pve1 et pve3 est un invité, et le trait discret dit de quel nœud il dépend',
    readout: { on: 'sur', trunk: 'trunk vmbr1', guests: 'invités' },
    annotations: { entry: 'internet', exit: 'hors site', cluster: 'cluster', backup: 'sauvegarde' },
    diagramTitle: 'Trois strates d’un même labo, et le chemin qu’une requête y prend.',
    diagramDesc:
      'Trois plans superposés. Bordure, en haut\u00a0: opnsense est le seul point d’entrée et l’unique point de contrôle, dessiné en anneau, avec WireGuard comme interface sur lui plutôt qu’une machine séparée\u00a0; caddy termine le HTTPS\u00a0; warpgate est la seule porte SSH\u00a0; authentik est le SSO. Les quatre tournent sur pve3, et un trait discret relie chacun au nœud en dessous. Socle, au milieu\u00a0: pve1 et pve3 sont les deux nœuds Proxmox, reliés par le trunk vmbr1\u00a0; pbs est un conteneur sur pve3 et la cible de sauvegarde des deux, sur une branche pointillée qui sort de la feuille vers une copie chiffrée hors site. Services, en bas\u00a0: nextcloud et forgejo tournent sur pve1\u00a0; immich, jellyfin et mealboard sur pve3. Une requête arrive d’internet au-dessus de la bordure, est transmise par opnsense à caddy et atterrit sur le service qui répond. Pointer une marque allume sa route, le nœud dont elle dépend et les liens entre eux, et écrit la chaîne en toutes lettres\u00a0; le dessin tourne pendant que la section défile, et le registre ci-dessous liste chaque station, y compris celles que le dessin laisse de côté.',
    fallbackLabel: 'dessin indisponible — le registre ci-dessous porte les mêmes stations',
  },
}

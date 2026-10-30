import type { Bi } from '../lib/i18n'

/**
 * Inventory of the real homelab, distilled into the marks the section draws.
 *
 * Sources, and what each one is allowed to say:
 * - `/root/caddy-config/sites/{public,private}` — what is exposed, and to which
 *   upstream. The counts come from here and nowhere else.
 * - `homelab/content/architecture/network.mdx` — the edge (OPNsense VM 501 on
 *   `pve3`), the NAT forwards, WireGuard, the inter-node trunk.
 * - `service-placement.mdx` — which node carries which guest.
 * - `backups.mdx` — PBS on `pve3`, the rclone crypt copy that leaves the site.
 * - `security.mdx` — Warpgate as the only SSH door, Caddy as the only ingress.
 *
 * The plate is a *section*, not a floor plan: a mark's stratum is the role it
 * plays in a request, not the chassis it sits in. Everything on the fabric and
 * services strata is virtual and runs on `pve1` or `pve3`; the plate says so in
 * one line of mono rather than drawing a hosting line per guest.
 */

export type TierId = 'edge' | 'fabric' | 'services'
export type MarkKind = 'station' | 'service' | 'control'

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
   * The chain that explains this mark: the ingress path for everything on the
   * request path, the backup branch for the backup target. Consecutive ids in a
   * chain are the links of the drawing, so nothing is drawn that no chain walks
   * — except the cluster trunk, which is declared separately below.
   */
  chain: string[]
}

/** The ingress path every served mark shares, up to the proxy. */
const VIA_EDGE = [ENTRY_ID, 'opnsense', 'caddy']

export const territoryStations: TerritoryStation[] = [
  /* EDGE — where the outside ends. opnsense is the only way in, and the one
     control point on the sheet. */
  { id: 'opnsense', tier: 'edge', kind: 'control', x: -2.15, z: 0.45, chain: [ENTRY_ID, 'opnsense'] },
  { id: 'wireguard', tier: 'edge', kind: 'station', x: -3.55, z: 0.95, chain: [ENTRY_ID, 'opnsense', 'wireguard'] },
  { id: 'caddy', tier: 'edge', kind: 'station', x: -0.3, z: -0.5, chain: [...VIA_EDGE] },
  { id: 'warpgate', tier: 'edge', kind: 'station', x: 1.65, z: 0.8, chain: [ENTRY_ID, 'opnsense', 'warpgate'] },

  /* FABRIC — the two nodes everything is a guest of, and the backup target.
     `pbs` is chained from `pve3` on purpose: its path is the backup branch, not
     the request path. */
  { id: 'pve1', tier: 'fabric', kind: 'station', x: -2.3, z: 0.3, chain: [...VIA_EDGE, 'pve1'] },
  { id: 'pve3', tier: 'fabric', kind: 'station', x: 0.7, z: -0.25, chain: [...VIA_EDGE, 'pve3'] },
  { id: 'pbs', tier: 'fabric', kind: 'service', x: 3.05, z: 0.75, chain: ['pve3', 'pbs', EXIT_ID] },

  /* SERVICES — what gets used every day, each drawn on the node that carries it:
     nextcloud (VM 200), forgejo (LXC 111) and matrix (LXC 107) on pve1;
     immich (LXC 276), jellyfin (VM 300) and mealboard (Dokploy, obiwan 205) on
     pve3. */
  { id: 'nextcloud', tier: 'services', kind: 'service', x: -3.4, z: -0.8, chain: [...VIA_EDGE, 'pve1', 'nextcloud'] },
  { id: 'forgejo', tier: 'services', kind: 'service', x: -2.3, z: 0.62, chain: [...VIA_EDGE, 'pve1', 'forgejo'] },
  { id: 'matrix', tier: 'services', kind: 'service', x: -1.2, z: -0.3, chain: [...VIA_EDGE, 'pve1', 'matrix'] },
  { id: 'immich', tier: 'services', kind: 'service', x: 0.0, z: 0.46, chain: [...VIA_EDGE, 'pve3', 'immich'] },
  { id: 'jellyfin', tier: 'services', kind: 'service', x: 1.15, z: -0.88, chain: [...VIA_EDGE, 'pve3', 'jellyfin'] },
  { id: 'mealboard', tier: 'services', kind: 'service', x: 2.3, z: 0.17, chain: [...VIA_EDGE, 'pve3', 'mealboard'] },
]

/**
 * The cluster trunk — `vmbr1`, VLAN-aware, 1 Gbit/s between `pve3` and `pve1`.
 * It is a real link and it is on no request path, so it is declared here rather
 * than derived from a chain: hovering a mark never lights it.
 */
export const territoryTrunkLinks: { a: string; b: string }[] = [{ a: 'pve1', b: 'pve3' }]

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
    role: { en: 'where the outside ends', fr: "là où l’extérieur s’arrête" },
    nodes: ['opnsense', 'wireguard', 'warpgate', 'adguard', 'technitium'],
    note: {
      en: 'VLAN split between production and management, OPNsense as the only way in, WireGuard for remote access and a bastion that logs every session.',
      fr: 'Cloisonnement VLAN entre production et management, OPNsense comme seul point d’entrée, WireGuard pour l’accès distant et un bastion qui journalise chaque session.',
    },
  },
  {
    id: 'fabric',
    kind: 'tier',
    label: { en: 'Fabric', fr: 'Socle' },
    role: { en: 'what everything sits on', fr: 'sur quoi tout repose' },
    nodes: ['pve1', 'pve3', 'vzdump', 'pbs'],
    note: {
      en: 'Two-node Proxmox cluster — the firewall is itself a guest of pve3 — container-per-service, snapshots before every risky change, and a Proxmox Backup Server that actually gets restored from.',
      fr: 'Cluster Proxmox à deux nœuds — le pare-feu est lui-même un invité de pve3 — un conteneur par service, snapshot avant chaque changement risqué, et un Proxmox Backup Server dont je restaure vraiment.',
    },
  },
  {
    id: 'services',
    kind: 'tier',
    label: { en: 'Services', fr: 'Services' },
    role: { en: 'what gets used every day', fr: 'ce qui sert tous les jours' },
    nodes: ['nextcloud', 'immich', 'jellyfin', 'forgejo', 'matrix', 'mealboard'],
    note: {
      en: 'The things actually used daily: files, photos, media, git, chat — and the apps I build for myself when nothing fits.',
      fr: 'Ce qui sert vraiment tous les jours\u00a0: fichiers, photos, médias, git, chat — et les applis que je construis quand rien ne convient.',
    },
  },
  {
    id: 'identity',
    kind: 'concern',
    label: { en: 'Identity', fr: 'Identité' },
    role: { en: 'who is allowed to touch it', fr: 'qui a le droit d’y toucher' },
    nodes: ['authentik', 'infisical', 'wazuh'],
    note: {
      en: 'One SSO in front of the internal services, secrets that never live in a repo, and a SIEM that watches the rest.',
      fr: 'Un SSO unique devant les services internes, des secrets qui ne vivent jamais dans un dépôt, et un SIEM qui surveille le reste.',
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
    nodes: ['dokploy', 'caddy', 'github-actions', 'n8n', 'umami'],
    note: {
      en: 'Deploys run from git, the reverse proxy config is versioned and re-applied by cron, and every site ships through the same pipeline.',
      fr: 'Les déploiements partent de git, la config du reverse proxy est versionnée et réappliquée par cron, chaque site passe par le même pipeline.',
    },
  },
]

/** Glyphs used by the plate, so the legend and the drawing cannot drift. */
export type LegendKey = 'service' | 'station' | 'control' | 'backup'

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
   * The labels that are not station names. `entry` / `exit` are drawn on the
   * scene; `cluster` / `backup` only appear on the SVG plate that takes over
   * when WebGL is unavailable.
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
    lead: 'One room, two Proxmox nodes, one edge. The plate below keeps the order I actually work in: what lets traffic in, what everything runs on, and what gets used every day. Nothing on it is aspirational — if a name is drawn, it answers.',
    plateLabel: 'territory survey',
    plateScale: 'not to scale',
    countLabels: { published: 'published routes', internal: 'internal routes' },
    registerLabel: 'register',
    registerNote: 'every station the lab runs — the drawing is the path, this is the inventory',
    legendLabel: 'Legend',
    legend: [
      { key: 'service', label: 'service' },
      { key: 'station', label: 'station' },
      { key: 'control', label: 'control point' },
      { key: 'backup', label: 'backup path' },
    ],
    strataLabel: 'Strata',
    concernsLabel: 'cross-cutting',
    readInstruction: 'traffic enters above the edge → crosses the fabric → lands on a service',
    legendNote: 'strata are roles, not machines — every square runs on pve1 or pve3',
    annotations: { entry: 'internet', exit: 'off-site', cluster: 'cluster', backup: 'backup' },
    diagramTitle: 'Three strata of one homelab, and the path a request takes through them.',
    diagramDesc:
      'Three stacked plans. Edge, at the top: opnsense is the only way in and the single control point, drawn as a ring; wireguard is the remote-access tunnel; caddy terminates HTTPS; warpgate is the only SSH door. Fabric, in the middle: pve1 and pve3 are the two Proxmox nodes, joined by their inter-node trunk, with pbs hanging off pve3 on a dashed line that leaves the sheet for an encrypted off-site copy. Services, at the bottom: nextcloud, forgejo and matrix run on pve1; immich, jellyfin and mealboard run on pve3. A request arrives from the internet above the edge, is forwarded by opnsense to caddy, crosses the fabric, and lands on the service that answers it. Pointing at a mark lights its route and dims everything else; the register below lists every station, including the ones the drawing leaves out.',
    fallbackLabel: 'drawing unavailable — the register below carries the same stations',
  },
  fr: {
    title: 'Ici, chaque nom est une chose qui tourne.',
    lead: 'Une pièce, deux nœuds Proxmox, une seule bordure. La planche ci-dessous garde l’ordre dans lequel je travaille vraiment\u00a0: ce qui laisse entrer le trafic, ce sur quoi tout repose, et ce qui sert tous les jours. Rien n’y est prospectif — si un nom est dessiné, il répond.',
    plateLabel: 'planche du territoire',
    plateScale: 'sans échelle',
    countLabels: { published: 'routes publiées', internal: 'routes internes' },
    registerLabel: 'registre',
    registerNote: 'chaque station du labo — le dessin est le chemin, ceci est l’inventaire',
    legendLabel: 'Légende',
    legend: [
      { key: 'service', label: 'service' },
      { key: 'station', label: 'station' },
      { key: 'control', label: 'point de contrôle' },
      { key: 'backup', label: 'chemin de sauvegarde' },
    ],
    strataLabel: 'Strates',
    concernsLabel: 'transversal',
    readInstruction: 'le trafic entre au-dessus de la bordure → traverse le socle → atterrit sur un service',
    legendNote: 'les strates sont des rôles, pas des machines — chaque carré tourne sur pve1 ou pve3',
    annotations: { entry: 'internet', exit: 'hors site', cluster: 'cluster', backup: 'sauvegarde' },
    diagramTitle: 'Trois strates d’un même labo, et le chemin qu’une requête y prend.',
    diagramDesc:
      'Trois plans superposés. Bordure, en haut\u00a0: opnsense est le seul point d’entrée et l’unique point de contrôle, dessiné en anneau\u00a0; wireguard est le tunnel d’accès distant\u00a0; caddy termine le HTTPS\u00a0; warpgate est la seule porte SSH. Socle, au milieu\u00a0: pve1 et pve3 sont les deux nœuds Proxmox, reliés par leur trunk inter-nœuds, avec pbs suspendu à pve3 par un trait pointillé qui sort de la feuille vers une copie chiffrée hors site. Services, en bas\u00a0: nextcloud, forgejo et matrix tournent sur pve1\u00a0; immich, jellyfin et mealboard sur pve3. Une requête arrive d’internet au-dessus de la bordure, est transmise par opnsense à caddy, traverse le socle et atterrit sur le service qui répond. Pointer une marque allume sa route et éteint le reste\u00a0; le registre ci-dessous liste chaque station, y compris celles que le dessin laisse de côté.',
    fallbackLabel: 'dessin indisponible — le registre ci-dessous porte les mêmes stations',
  },
}

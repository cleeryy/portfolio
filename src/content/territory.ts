import type { Bi } from '../lib/i18n'

/**
 * Inventory of the real homelab, extracted from the reverse-proxy config (the
 * source of truth for what is exposed). No invented host, no invented metric.
 *
 * The order below is the reading order of the plate: edge → fabric → services,
 * then the three rows that cut across all three (identity, signal, delivery).
 * `nodes` is always listed in the order the plate draws it, left to right.
 */
export type TerritoryKind = 'tier' | 'concern'

export type TerritoryGroup = {
  id: string
  kind: TerritoryKind
  label: Bi
  /** One line of framing for the register. Editorial, not a technical claim. */
  role: Bi
  /** Real hostnames / roles, kept short — these are drawn on the plate. */
  nodes: string[]
  note: Bi
}

/**
 * Two counts and their source. Both were read off the reverse-proxy config, so
 * they are allowed on the page; uptime, load or "99.9%" figures are not, and do
 * not appear anywhere in this file.
 */
export const territorySummary = {
  exposedPublicHosts: 37,
  internalHosts: 26,
  nodes: 2,
  source: {
    en: 'counted from the reverse-proxy config',
    fr: 'comptés dans la configuration du reverse proxy',
  } satisfies Bi,
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
      en: 'Two-node Proxmox cluster, container-per-service, snapshots before every risky change and a Proxmox Backup Server that actually gets restored from.',
      fr: 'Cluster Proxmox à deux nœuds, un conteneur par service, snapshot avant chaque changement risqué et un Proxmox Backup Server dont je restaure vraiment.',
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
export type LegendKey = 'station' | 'service' | 'control' | 'cluster' | 'backup'

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
  concernsLabel: string
  /** The four words printed on the plate itself. */
  annotations: { public: string; cluster: string; backup: string; offSite: string }
  diagramTitle: string
  diagramDesc: string
}

export const territoryCopy: Bi<TerritoryCopy> = {
  en: {
    title: 'Every name here is a thing that runs.',
    lead: 'One room, two Proxmox nodes, one edge. The plate below keeps the order I actually work in: what lets traffic in, what everything runs on, and what gets used every day. Nothing on it is aspirational — if a name is drawn, it answers.',
    plateLabel: 'territory survey',
    plateScale: 'not to scale',
    countLabels: { published: 'published hostnames', internal: 'internal hostnames' },
    registerLabel: 'register',
    registerNote: 'every station on the plate, in the order it is drawn',
    legendLabel: 'Legend',
    legend: [
      { key: 'station', label: 'station' },
      { key: 'service', label: 'service' },
      { key: 'control', label: 'control point' },
      { key: 'cluster', label: 'cluster link' },
      { key: 'backup', label: 'backup path' },
    ],
    concernsLabel: 'cross-cutting',
    annotations: { public: 'public', cluster: 'cluster', backup: 'backup', offSite: 'off-site' },
    diagramTitle: 'Survey of the homelab: one edge, one two-node cluster, and the services behind them.',
    diagramDesc:
      'Three strata, each hung from a labelled rule. Edge: opnsense, the control point and the only way in, with wireguard, warpgate, adguard and technitium behind it. Fabric: pve1 and pve3 joined as a cluster, with vzdump writing to pbs and then off the sheet. Services: nextcloud, immich, jellyfin, forgejo, matrix, mealboard. Below, three cross-cutting rows — identity: authentik, infisical, wazuh; signal: prometheus, grafana, beszel, scraparr; delivery: dokploy, caddy, github-actions, n8n, umami. The full register follows the plate as text.',
  },
  fr: {
    title: 'Ici, chaque nom est une chose qui tourne.',
    lead: 'Une pièce, deux nœuds Proxmox, une seule bordure. La planche ci-dessous garde l’ordre dans lequel je travaille vraiment\u00a0: ce qui laisse entrer le trafic, ce sur quoi tout repose, et ce qui sert tous les jours. Rien n’y est prospectif — si un nom est dessiné, il répond.',
    plateLabel: 'planche du territoire',
    plateScale: 'sans échelle',
    countLabels: { published: 'hôtes publiés', internal: 'hôtes internes' },
    registerLabel: 'registre',
    registerNote: 'chaque station de la planche, dans l’ordre du dessin',
    legendLabel: 'Légende',
    legend: [
      { key: 'station', label: 'station' },
      { key: 'service', label: 'service' },
      { key: 'control', label: 'point de contrôle' },
      { key: 'cluster', label: 'lien de cluster' },
      { key: 'backup', label: 'chemin de sauvegarde' },
    ],
    concernsLabel: 'transversal',
    annotations: { public: 'public', cluster: 'cluster', backup: 'sauvegarde', offSite: 'hors site' },
    diagramTitle: 'Relevé du labo\u00a0: une bordure, un cluster à deux nœuds, et les services derrière.',
    diagramDesc:
      'Trois strates, chacune suspendue à une règle étiquetée. Bordure\u00a0: opnsense, point de contrôle et seul point d’entrée, avec wireguard, warpgate, adguard et technitium derrière. Socle\u00a0: pve1 et pve3 réunis en cluster, avec vzdump qui écrit vers pbs puis hors de la feuille. Services\u00a0: nextcloud, immich, jellyfin, forgejo, matrix, mealboard. En dessous, trois lignes transversales — identité\u00a0: authentik, infisical, wazuh\u00a0; signal\u00a0: prometheus, grafana, beszel, scraparr\u00a0; livraison\u00a0: dokploy, caddy, github-actions, n8n, umami. Le registre complet suit la planche en texte.',
  },
}

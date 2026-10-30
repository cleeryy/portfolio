# FACTS.md — fiche de faits vérifiés sur cleeryy

> Source : audit des fichiers de la machine `hermesagent` (CT 125) + Nextcloud (agendas) + GitHub API + `pvesh` live, le **30/10/2026**.
> Destinataire : agent qui écrit le contenu de `cleeryy.com` (repo `cleeryy/portfolio`).
> Conventions : chaque fait porte sa source (`chemin` ou outil). `[PRIVE]` = ne doit pas apparaître sur le site public. `absent` = non trouvé dans les sources, à ne pas inventer.
> Rien dans ce document n'est une reformulation marketing : ce sont des faits bruts, l'écriture se fait après.

---

## 1. Identité publique

- **Handle** : `cleeryy` — source: `gh api users/cleeryy` (login), `blog/hugo.toml` (`owner = "cleeryy"`).
- **Nom** : Cléry A-Ferradou — source: `gh api users/cleeryy` (`name`), `blog` git log (`Cléry A-Ferradou <…>`). Publiable (déjà public sur GitHub), mais à confirmer par cle.
- **Email** : `clery.arqueferradou@gmail.com` — source: `/home/hermes/.gitconfig`. **[PRIVE]**
- **Ville / région** : Toulouse, France — source: `blog/content/about/index.md` (« based in toulouse, france »), `Nextcloud dlgu-1` (« ESGI Toulouse, 22 Impasse Charles Fourier, 31200 Toulouse »). Localisation GitHub : « France ».
- **Site / blog** : `cleeryy.com` (ancien blog, Apache/VPS) → aujourd'hui `blog.cleeryy.cloud` — source: `gh api users/cleeryy` (`blog`), `blog/content/posts/welcome-back.md`.
- **Langues** : français (toute la doc interne, les commits et les échanges sont en FR) ; anglais écrit (le blog public est intégralement rédigé en anglais) — source: `blog/content/**`, `homelab/content/**`. Aucun niveau certifié documenté.
- **Disponibilité (stage / alternance / CDI)** : `absent` — aucune source ne la documente. État factuel au 30/10/2026 : 3ᵉ année ESGI Toulouse + présence récurrente chez CTI Toulouse 3 après-midis/semaine (voir §2).
- **Bio GitHub** : « hey :) » — source: `gh api users/cleeryy`.

## 2. Parcours (timeline)

- `2020-07-10` | Création du compte GitHub `cleeryy` | GitHub | premier point de présence publique identifiable | source: `gh api users/cleeryy` (`created_at`)
- `2023-08-04` | Premier dépôt public (`smoothwastaken`, config de profil) | GitHub | premiers dépôts publics, avant tout projet d'infra | source: `gh api users/cleeryy/repos`
- `2025-04-08` | Blog personnel (Hugo, thème terminal, Apache sur VPS) | `cleeryy.com` | publication d'articles cybersécurité/homelab en anglais | source: `blog/content/about/index.md` (front matter), `blog/content/posts/welcome-back.md`
- `2025-04-12` | Participation au CTF de la THCon 2025 | Toulouse Hacking Convention | joueur, connexion à distance aux serveurs de challenge (challenge misc « neoprivesc », 500 pts) | source: `blog/content/writeups/thcon2025/neoprivesc.md`
- `2025-04-16` | Projet VPN maison | perso | serveur WireGuard sur Raspberry Pi 4 (PiVPN), wake-on-lan, accès distant au LAN | source: `blog/content/posts/my-own-vpn-infrastructure.md`
- `2025-11-26 → 2025-11-28` | Publication de 7 writeups de challenges Hack The Box | blog | résolution + rédaction (web/SSTI, XSS, SSRF→pickle→RCE, crypto AES-CBC, reverse ELF, malware PowerShell/.NET, blockchain Solidity) | source: `blog/content/writeups/cbc2025/*.md`
- `2025-12-04` | Comité pédagogique T1 en tant que délégué | ESGI Toulouse | représentation de classe (année non nommée dans la source) | source: `Nextcloud` agenda `dlgu-1`
- `2026-05-06 →` | Alternance / emploi (3 après-midis par semaine : lundi, mardi, mercredi 13h30–17h30) | CTI, 1 Impasse Henri Ramet, 31100 Toulouse **[PRIVE]** | présence récurrente documentée jusqu'au 15/02/2027 minimum | source: `Nextcloud` agenda `travail` (série « CTI Toulouse »), `/home/hermes/AGENTS.md` (« travail/CTI/alternance »)
- `2026-06-09` | PoC « RoguePlanet » (race condition, Windows Defender, shell SYSTEM) | perso | dépôt C++ + binaire + capture ; README repris d'une analyse existante, pas de découverte personnelle documentée | source: `git.cleeryy.cloud/cleeryy/RoguePlanet` (4 commits)
- `2026-06-26 → 2026-07-17` | Fin d'année ESGI : contrôles, projet annuel, partiels, soutenance orale | ESGI Toulouse | rendu de livrables + soutenance 20 min + 10 min de questions | source: `Nextcloud` agenda `esgi`
- `2026-07-02` | Comité pédagogique T3 (délégué) | ESGI Toulouse | source: `Nextcloud` agenda `dlgu-1`
- `2026-07-10` | Projet GreenRoute (UML2) | ESGI | plateforme de livraison éco-responsable du dernier kilomètre, modélisation UML | source: `gh api repos/cleeryy/GreenRoute-UML`
- `2026-09` | Reconstruction du homelab (migration VLAN 26–28/09, système de sauvegarde PBS, restore testé) | perso | 40+ invités migrés sur VLAN 20/50, PBS + copie hors-site chiffrée, restore booté le 10/09/2026 | source: `homelab/content/architecture/overview.mdx`, `.../backups.mdx`
- `2026-10-19` | Relance du blog en GitOps (Hugo → GitHub → Dokploy, CI Trivy/GHCR) | perso | pipeline complet à partir d'une sauvegarde de l'ancien VPS | source: `blog/content/posts/welcome-back.md`
- `2026-10-30` | Portfolio `cleeryy.com` en cours de construction | perso | repo TypeScript, `DESIGN.md`, déjà servi en preview | source: `gh api repos/cleeryy/portfolio`, `docker ps` sur l'hôte Dokploy (port 7747)

Non daté / non plaçable : début du cursus ESGI (B1/B2) — `absent`.

## 3. Certifications & formations

- **Certifications professionnelles (OSCP, eJPT, CEH, CCNA, ISO 27001, TOEIC…) : `absent`.** Aucune trace dans `/home/hermes/**`, `blog/content/**`, `homelab/content/**`, `work/**` (recherche `OSCP|eJPT|CEH|CCNA|TOEIC|certification` → 0 résultat pertinent).
- **Formation en cours** : Bachelor 3 ESGI Toulouse, programme désigné « SRC » dans les supports de TP — statut : `en cours` (2026–2027) — source: `nextcloud-upload/scripting-python/TP-Seance-1.md` (« ESGI Bachelor 3 SRC »), `Nextcloud dlgu-1` (« 3e annee ESGI »).
- **Matières du trimestre 1 2026–2027** (documentées par l'emploi du temps) : conteneurisation avancée, scripting Python, projet annuel, anglais professionnel, fondamentaux de la cryptographie — source: `Nextcloud` agenda `apiedusignfr` (semaine du 09/11/2026).
- **Année 2025–2026** : année ESGI non nommée dans les sources, avec projet annuel + soutenance (juin–juillet 2026) — source: `Nextcloud` agenda `esgi`.
- Aucun identifiant public de certification vérifiable.

## 4. Compétences techniques (classées, avec preuves)

**Offensive — web** — *pratique régulière en lab*
- SSTI Twig via plugin WordPress (CVE-2024-6386), contournement de filtrage de quotes, `wpscan` — source: `blog/content/writeups/cbc2025/lemon-industries.md`
- XSS stocké + bot Selenium, exfiltration de cookie — source: `.../notesy.md`
- SSRF → Redis → pickle → RCE — source: `.../scrapeware.md`
- Outillage installé et maintenu dans un lab dédié : nmap, ffuf, gobuster, sqlmap, nikto, hydra, john, hashcat, whatweb, wafw00f, proxychains, seclists — source: `/home/hermes/esgi-full.py` (provisionnement du CT `esgi-python`), `homelab/content/backups.mdx` (CT `exegol` VLAN 60 « offensive-security workspace »)

**Reverse / malware / forensic** — *pratique régulière en lab*
- Reverse d'un dropper PowerShell chargeant un assembly .NET, extraction du schéma XOR, déchiffrement d'une exfiltration HTTP dans un pcap — source: `blog/content/writeups/cbc2025/monkey.md`
- Reverse d'un ELF 64-bit (AES triple, brute force d'ordre de clés), `strings`, analyse PIE/NX — source: `.../threekeys.md`
- Reverse d'APK (apktool, jadx, décodage protobuf) — source: `/root/reverseapk/` (hôte `code`)
- PoC C++ de race condition sur Windows Defender (escalade SYSTEM) — source: `/root/RoguePlanet/`

**Cryptographie appliquée** — *pratique régulière*
- AES-CBC bit-flipping sur application Flask/pycryptodome, XOR, brute force de clés — source: `blog/content/writeups/cbc2025/bankflip.md`, `.../threekeys.md`, `.../monkey.md`
- Cours « Fondamentaux de la cryptographie » en cours (B3) — source: `Nextcloud` agenda `apiedusignfr`

**Réseau / edge** — *pratique régulière (production personnelle)*
- OPNsense : 8 segments (LAN + 7 VLAN), NAT/port-forwards, règles legacy + migration MVC, groupes d'interfaces, policy routing, kill-switch — source: `homelab/content/architecture/network.mdx`, `docs/flux-matrix-opnsense.md`, `docs/regles-firewall-cibles-par-interface.md`
- WireGuard (road-warrior + client commercial AirVPN), NetBird (mesh, exit node, DNS scoping), Cloudflare Tunnel — source: `.../network.mdx`, `homelab-backlog/BACKLOG.md` (incident NetBird 27–28/10/2026)
- DNS : Unbound + Technitium (zone interne, blocage publicitaire), dnsmasq DHCP — source: `.../network.mdx`, `homelab/content/services/core/dns.mdx`
- Détection réseau : Suricata IDS, CrowdSec, logs pf — source: `homelab/content/architecture/security.mdx`
- Audit réseau formalisé et rendu en LaTeX/TikZ — source: `/home/hermes/audit-reseau/audit-flux.tex` (10/09/2026)

**Infra / virtualisation** — *pratique régulière (production personnelle)*
- Proxmox VE 9.2, cluster 2 nœuds quorate, LXC + QEMU, corosync, HA, snapshots, `qm`/`pct`/`pvesh`/`pvesm` — source: `homelab/content/inventory/nodes.mdx`, `.../containers.mdx`
- Stockage : LVM-thin (5 PV, ~5,9 To), ZFS (pool déclaré/désactivé), NFS, TRIM (`pct fstrim`), gestion de capacité — source: `homelab/content/architecture/storage.mdx`
- PBS : jobs 02h00 (keep-7) / 04h00 (keep-3), GC, verify, restore testé — source: `.../backups.mdx`
- Caddy en frontal unique, wildcard TLS DNS-01 Cloudflare, `forward_auth` — source: `caddy-config/` (38 vhosts publics + 28 privés), `homelab/content/services/core/reverse-proxy.mdx`

**Systèmes & conteneurs** — *pratique régulière*
- Debian/Ubuntu/Alpine, systemd, Docker, Docker Swarm (update order `stop-first`), Dokploy — source: `homelab/content/operations/dokploy.mdx`, `blog/content/homelab/index.md`
- PostgreSQL (partagé + bases applicatives), dumps `pg_dump -Fc` — source: `homelab/content/services/core/postgresql.mdx`, `.../backups.mdx`

**Identité & secrets** — *pratique régulière*
- Authentik (SSO, OIDC, forward_auth), Warpgate (bastion SSH SSO), Vaultwarden — source: `homelab/content/architecture/security.mdx`, skill `authentik-oidc-app`
- Infisical self-hosted (Universal Auth, identités par service, arborescence `apps/…`/`infra/…`) — source: `homelab/content/services/core/infisical.mdx`, `/home/hermes/AGENTS.md`

**Observabilité / SIEM** — *pratique régulière*
- Prometheus + Grafana + pve-exporter + scraparr ; Beszel (legacy) ; Checkmk Raw 2.3 ; Uptime Kuma ; ntfy ; Umami — source: `homelab/content/services/core/monitoring.mdx`, `.../checkmk.mdx`, `docs/checkmk-plan-supervision-2026-10-27.md`
- Wazuh 4.14.9 (manager + indexer + dashboard, 27 agents dont 23 actifs, 11 règles custom, 71 011 documents de vulnérabilités, 233 542 alertes indexées) — source: `docs/audit-wazuh-2026-10-28.md`

**Développement** — *pratique régulière*
- TypeScript / Next.js 16 (App Router, Tailwind, shadcn, Prisma, NextAuth) — source: `/root/balcon`, `/root/gices`, `/root/arneph`, `/root/mealboard`
- Go (Gin, API wake-on-lan, CI + releases) — source: `gh api repos/cleeryy/hello`
- Rust (Axum, serenity, Tauri v2, DSP) — source: `/root/gv-downloader/AGENTS.md`, `gh api repos/cleeryy/cipherbot`, `.../micforge`, `.../zenfree`
- Python (stdlib, FastAPI, Playwright, scripts d'automatisation) — source: `/root/atlas-lab/live/server.py`, `/root/wikimasters-bot/`, `/home/hermes/esgi-full.py`
- Java 21 (plugin Paper/Purpur, 230 commits) — source: `git.cleeryy.cloud/cleeryy/VegJustice`
- Kotlin/Android (app de dessin, 100 commits) — source: `gh api repos/cleeryy/openclip`
- Lua (dotfiles Neovim), C (fork NUSspli), Bash — source: `gh api users/cleeryy/repos`
- HTML/CSS/SVG vanilla, Hugo, MDX/Fumadocs, LaTeX/TikZ, Manim — source: `/root/atlas-lab/live/static/index.html`, `blog/`, `homelab/`, `/home/hermes/audit-reseau/`, `/root/manim-demo/`

**Cloud / delivery** — *pratique régulière*
- GitHub Actions (lint, build multi-arch buildx/QEMU, scan Trivy, GHCR), Dokploy (build depuis Git, swarm), Forgejo + runner (forge maison), mirroring Forgejo↔GitHub — source: `blog/content/posts/welcome-back.md`, `homelab/content/architecture/overview.mdx`
- Cloudflare (DNS, tunnels, cache) ; VPS OVH (Dokploy + Traefik + supervision) **[PRIVE]** — source: `homelab/content/services/core/cloudflared.mdx`, `/home/hermes/AGENTS.md`
- Hors-site chiffré : rclone `crypt` → Google Drive — source: `/home/hermes/AGENTS.md`, `homelab/content/architecture/backups.mdx`
- AWS / Azure / GCP : `absent` (aucune trace).

**Orchestration d'agents IA** — *prototype*
- Simulation d'entreprise d'infra à 29 agents (guildes compute/réseau/data/reliability/strategy, runbooks, change-requests) — source: `/home/hermes/infra-company/AGENTS.md`

## 5. Plateformes d'entraînement

- **Hack The Box** — pratique attestée par 7 writeups de challenges publiés les 26–28/11/2025 (web, crypto, reverse, forensics, blockchain) — source: `blog/content/writeups/cbc2025/*.md`. Pseudo exact, URL de profil, rang, nombre de machines : `absent`.
- **TryHackMe** — `absent` (aucune trace).
- **Root-Me** — `absent` (aucune trace).
- **PortSwigger Academy** — `absent` (aucune trace), même si les vulns web travaillées (SSTI, XSS, SSRF) recoupent le corpus.
- Seul pseudo connu, toutes plateformes confondues : `cleeryy` (GitHub) — source: `gh api users/cleeryy`.

## 6. CTF

- **THCon 2025** (Toulouse Hacking Convention) | 2025 | épreuve jouée à distance (connexion `nc`/SSH aux serveurs de challenge) | rôle : joueur | challenge documenté : « neoprivesc », catégorie misc, 500 pts (priv-esc via sudo/NixOS) | résultat / classement : `absent` — source: `blog/content/writeups/thcon2025/neoprivesc.md` (date 2025-04-12, prompt `exegol-thcon ctf`).
- **Challenges Hack The Box** | 2025 | en ligne | rôle : joueur | 7 challenges résolus et documentés (`bankflip` 30 pts, `lemon industries` 20 pts, `scrapeware` 300 pts, `threekeys`, `monkey`, `notesy`, `one more round`) — les points affichés sont ceux du challenge, pas un score d'événement | source: `blog/content/writeups/cbc2025/*.md`.
- **Organisation d'un CTF** : `absent` — aucune source.
- Zoom sur le dossier `cbc2025` : le nom de l'événement d'origine n'est documenté nulle part dans le repo ; les front matter indiquent seulement `HackTheBox`. À ne pas présenter comme un événement nommé sans confirmation de cle.

## 7. Homelab — inventaire publiable

**Chiffres vérifiés (30/10/2026)**

- **2 nœuds** Proxmox VE 9.2.11 en cluster quorate (1 nœud « compute/prod », 1 nœud « infra/gestion ») — source: `homelab/content/inventory/nodes.mdx`.
- **52 invités** : 41 LXC + 11 VM, dont **48 allumés** ; répartition 40 sur le nœud compute, 12 sur le nœud infra — source: `pvesh get /cluster/resources --type vm` exécuté le 30/10/2026 (la doc cite 40 CT au 27/10, un CT a été ajouté depuis).
- **45 services documentés** (une page wiki par service) — source: `homelab/content/services/**` (45 fichiers `.mdx`).
- **38 routes publiques + 28 routes privées** devant Caddy — source: `caddy-config/sites/public` (38 fichiers) et `caddy-config/sites/private` (28).
- **8 segments réseau** : LAN non taggé + 7 VLAN (admin, prod, préprod, IoT, guest, management, home) — source: `homelab/content/architecture/network.mdx`.
- **2 sites physiques** reliés par un mesh NetBird (**[PRIVE]** : plan d'adressage `100.121.0.0/16`, 7 peers) — source: `.../network.mdx`.
- **Capacités** : pool thin ~5,9 To (~34 % utilisé), datastore PBS ~600 Go, NAS principal 5,44 To, NAS secondaire 3,63 To — source: `.../storage.mdx`, `.../backups.mdx`.
- **Sauvegardes** : 2 jobs (02h00 keep-7 sur 5 invités critiques, 04h00 keep-3 sur 36 invités), restore testé et booté le 10/09/2026, copie hors-site chiffrée — source: `.../backups.mdx`.
- **Détection** : 27 agents Wazuh enregistrés (23 actifs), 11 règles custom, ~233 k alertes indexées — source: `docs/audit-wazuh-2026-10-28.md`.

**Par fonction**

*Edge / routage* — OPNsense (pare-feu virtualisé, 8 segments, NAT minimal 80/443/SSH/UDP VPN), WireGuard, NetBird, Cloudflare Tunnel. *Ils forment la seule porte d'entrée du lab : tout le trafic entrant passe par 3 forwards, tout le trafic sortant « interne » passe par un tunnel avec kill-switch.* **[PRIVE]** : IDs de VM, IP WAN/LAN, plan d'adressage.

*Hyperviseur / stockage* — 2 nœuds Proxmox en cluster, LVM-thin sur 5 disques physiques, un pool ZFS, NFS externe. *Le compute porte l'edge et la production, le nœud infra porte la forge, les bases et les VMs historiques ; l'asymétrie est assumée et documentée.* **[PRIVE]** : noms de nœuds, IP de management, noms des NAS.

*Identité & accès* — Authentik (SSO/OIDC), Warpgate (unique porte SSH, SSO), Vaultwarden, Guacamole. *Un seul chemin SSH vers tout le parc, derrière SSO ; les routes sensibles de Caddy appellent Authentik en `forward_auth`.* **[PRIVE]** : nom d'hôte public du bastion.

*Observabilité / SIEM* — Prometheus + Grafana + exporter Proxmox, Checkmk, Wazuh (SIEM), Uptime Kuma, ntfy, Umami. *Métriques, disponibilité, sécurité et analytics, avec une bascule en cours de Beszel vers la pile Prometheus/Grafana.* **[PRIVE]** : URLs internes, seuils, volumétrie d'alertes nominative.

*Services applicatifs* — Nextcloud, Immich, AFFiNE, SearXNG, Vaultwarden, Infisical, Stalwart (mail), Synapse/Element, Jellyfin + stack *arr, Forgejo. *Auto-hébergement assumé : photos, documents, secrets, mail, git, médias — chaque service a sa page, son impact de panne et son propriétaire documentés.* **[PRIVE]** : noms d'hôtes, ports, IP internes.

*Sauvegarde / DR* — Proxmox Backup Server, rclone `crypt` vers Google Drive, copies locales + NAS. *Deux niveaux de rétention selon la criticité, GC hebdomadaire, verify mensuel, et une règle écrite : une sauvegarde non restaurée n'existe pas.*

*Delivery / GitOps* — Dokploy (Docker Swarm) sur un LXC dédié, Caddy en frontal unique, Forgejo + runner, miroir GitHub, CI build multi-arch + scan Trivy + GHCR. *Push → CI → image scannée → Dokploy redéploie → Caddy sert : le blog et le wiki tournent par ce chemin.* **[PRIVE]** : nom de l'hôte Dokploy, ports publiés.

## 8. Projets

- **portfolio** — site portfolio personnel (celui en cours) — TypeScript — *en cours* — `github.com/cleeryy/portfolio`, preview servie sur l'hôte Dokploy — source: `gh api repos/cleeryy/portfolio`, `docker ps`.
- **blog** — blog technique Hugo (homelab, CTF writeups) en CI/CD complet — Hugo/Docker/Go templates — *en prod*, `blog.cleeryy.cloud` — source: `gh api repos/cleeryy/blog`, `blog/content/posts/welcome-back.md`.
- **homelab (wiki)** — documentation d'exploitation du cluster (architecture, inventaire, opérations), générée en Fumadocs/Next.js et déployée par Dokploy — TypeScript/MDX — *en prod* (zone privée) — source: `gh api repos/cleeryy/homelab` (**[PRIVE]** : dépôt privé), `homelab/content/**`.
- **atlas-live / homelab-diagrams** — carte temps réel du cluster (collecteur Python stdlib, page SVG/JS sans build, 15 s de rafraîchissement, 52 flux documentés, 17 sondes TCP) + génération de posters SVG depuis une source unique `inventory.yaml` — Python/SVG — *en prod*, `atlas.cleeryy.cloud` — source: `homelab/content/services/core/atlas-live.mdx`, `/root/atlas-lab/`.
- **caddy-config** — configuration de reverse-proxy versionnée (66 vhosts, templates TLS/forward-auth, script `caddyctl` + sync Git) — Caddy — *en prod* — source: `/home/hermes/caddy-config/` (journal de commits au 30/10/2026).
- **cipherbot** — bot Discord « OS » d'une communauté cybersécurité : lookup CVE (NVD), techniques MITRE ATT&CK, RDAP, réputation hash/URL (VirusTotal), un binaire Rust + SQLite — Rust/serenity — *en prod* (conteneur swarm) — source: `/root/cipherbot/README.md`, `gh api repos/cleeryy/cipherbot`, `docker ps`.
- **jambon** — bot Discord de pilotage d'instances Proxmox (vue cluster, commandes slash) — Rust — *prototype/publié*, 45 commits, juillet–août 2026 — source: `gh api repos/cleeryy/jambon`.
- **proxcontrol** — même intention que `jambon` en Go, dépôt antérieur — Go — *abandonné/remplacé* — source: `gh api repos/cleeryy/proxcontrol` (dernier push 2026-08-24).
- **hello** — API wake-on-lan minimaliste, CI + releases + image Docker, tourne sur un Raspberry Pi à domicile — Go/Gin — *en prod* — source: `gh api repos/cleeryy/hello`, `/root/hello/README.md`, `homelab/content/architecture/network.mdx` (panneau `:8083`).
- **mealboard** — planning de repas hebdomadaire + liste de courses, self-hosted, une base SQLite — Next.js — *en prod*, `mealboard.cleeryy.cloud` — source: `/root/mealboard/README.md`, `docker ps`, `caddy-config/sites/public/mealboard.caddy`.
- **balcon** — clone moderne de changedetection.io (surveillance de pages web + notifications) : Next.js 16, Prisma/SQLite, sidecar Python FastAPI (`curl_cffi`), cron in-process — TypeScript/Python — *en prod*, `balcon.cleeryy.cloud` — source: `/root/balcon/README.md`, `docker ps`.
- **arneph** — lecteur/éditeur de webtoons (scroll vertical, éditeur WYSIWYG) — Next.js 16/React 19/Supabase, tests Vitest — *en prod*, `arneph.cleeryy.cloud` — source: `/root/arneph/README.md`, `caddy-config/sites/public/arneph.caddy`.
- **tchounis-pharmacy** — site de révision en Fumadocs pour un cours de pharmacologie (UE2.11 S3), sources PDF, sidebar générée — MDX/TypeScript — *en prod*, `tchounis-pharmacy.cleeryy.cloud` — source: `gh api repos/cleeryy/tchounis-pharmacy`, `/root/tchounis-pharmacy/`, `AGENTS-code.md`. Contexte personnel de destination : **[PRIVE]**.
- **ifsi-edt** — service d'emploi du temps : SSO Shibboleth/CAS reproduit en HTTP pur, extraction de PDF hebdomadaires Moodle, filtrage par groupes, publication d'un flux iCalendar abonnable — Python/Docker — *en prod*, `ifsi.cleeryy.cloud` — source: `/home/hermes/ifsi-edt/README.md`. Destinataire : **[PRIVE]** (tiers, ne pas nommer).
- **zenfree** — passerelle self-hosted exposant une API compatible OpenAI et routant vers des modèles gratuits, anonymement — Rust — *prototype avancé* (phases 0–7, Docker/systemd) — source: `gh api repos/cleeryy/zenfree`, `/root/zenfree/README.md`.
- **openclip (Calque)** — studio de peinture open-source pour tablettes Android, clean-room (pinceaux à pression, calques/masques, pages de BD, animation image par image) — Kotlin, GPL-3.0 — *en cours*, 100 commits — source: `gh api repos/cleeryy/openclip`, `/root/openclip/README.md`.
- **micforge** — traitement micro temps réel sous Windows (suppression de bruit, gate, compresseur, EQ, de-esser, limiteur), Rust + Tauri v2, DSP pur Rust, AGPL-3.0 — *en cours*, 6 commits, octobre 2026 — source: `gh api repos/cleeryy/micforge`, `/root/yeti-voice/README.md`.
- **VegJustice** — plugin Minecraft (Paper 1.21/Purpur) : système de justice, police et économie judiciaire pour serveur RP — Java 21, 230 commits (projet le plus itéré) — *en prod sur serveur de jeu* — source: `git.cleeryy.cloud/cleeryy/VegJustice`, `/root/VegJustice/README.md`.
- **gv-downloader** — WebUI Rust/Axum de téléchargement de jeux vers GameVault : détection zip/rar/7z par magic bytes, reprise via `Range`, retries et reprise au boot — Rust — *en prod interne* — source: `/root/gv-downloader/AGENTS.md`.
- **gices** — application de suivi du courrier physique et électronique (usage interne) — Next.js 14/TypeScript/Prisma/NextAuth, Docker — *prototype/prod interne* — source: `gh api repos/cleeryy/gices`, `/root/gices/README.md`.
- **GreenRoute (UML2)** — projet scolaire : plateforme de livraison éco-responsable du dernier kilomètre — Python — *rendu (2026-07-10)* — source: `gh api repos/cleeryy/GreenRoute-UML`.
- **RoguePlanet** — PoC C++ d'escalade SYSTEM via race condition sur Windows Defender, testé Win10/Win11 — *archive/expérimentation* — source: `/root/RoguePlanet/README.md`.
- **umbra / pivpn-web** — gestionnaires web de PiVPN/WireGuard, deux générations (TS puis Python) — *prototypes*, 2025-12 → 2026-05 — source: `gh api users/cleeryy/repos`.
- **clarr** — nettoyage automatisé de la stack *arr — Go — *prototype* — source: `gh api repos/cleeryy/clarr`.
- **regezz** — site d'apprentissage des regex — TypeScript — *prototype* — source: `gh api repos/cleeryy/regezz`.
- **infra-company** — simulation d'une entreprise d'infrastructure à 29 agents IA (guildes réseau/compute/data/reliability/strategy, runbooks, change-requests, veto de sûreté) — Markdown/prompts — *prototype local* — source: `/home/hermes/infra-company/AGENTS.md`.
- **esgi-python + tp-runner** — lab Docker d'apprentissage Python (6 séances, correcteurs, runners) pour un cours ESGI — Python/Docker — *outil interne* — source: `/home/hermes/esgi-full.py`, `/root/tp-runner/README.md`, `nextcloud-upload/scripting-python/`.
- **audit réseau** — rapport d'audit OPNsense/Proxmox/VPS généré en LaTeX (tableaux de flux, schémas TikZ) — *archive 10/09/2026* — source: `/home/hermes/audit-reseau/audit-flux.tex`.

## 9. Ce qui manque

À fournir par cleeryy (introuvable dans les sources) :

1. **CV** : aucun fichier CV/lettre exploitable trouvé — rien à citer.
2. **Pseudos et URLs de profils** : TryHackMe, HackTheBox, Root-Me, PortSwigger — absents. Aucun chiffre (rang, machines, points, streaks) n'est sourçable.
3. **Résultats CTF** : classements THCon 2025, nom d'équipe, éventuel autre événement (le dossier `cbc2025` n'est pas explicité).
4. **Certifications** : aucune, à confirmer comme un choix ou un oubli.
5. **Dates ESGI** : année de début du cursus (B1/B2), intitulé exact du bachelor et signification de « SRC ».
6. **CTI** : nom complet de l'entreprise, intitulé du poste, type de contrat (alternance/apprentissage/stage), dates de début et de fin, missions. Rien de tout cela n'est documenté.
7. **Disponibilité** : recherche de stage/alternance/CDI, date cible, mobilité, rythme.
8. **Langues** : niveau réel en anglais (aucun test référencé).
9. **LinkedIn / contacts publics** : aucun lien professionnel dans les sources (seul l'email privé apparaît).
10. **Statut réel de chaque projet** : « en prod » est déduit de la présence d'un conteneur/vhost ; `prototype`/`abandonné` reste une lecture de l'activité Git, pas une déclaration.
11. **Blog** : date de création initiale (avant avril 2025) et rythme réel de publication.
12. **Âge, permis, localisation exacte** (Toulouse intra-muros vs agglo) — absents, et à ne pas déduire.

## 10. Bloc prêt à coller

```text
Cléry A-Ferradou — handle: cleeryy — Toulouse, France — github.com/cleeryy (29 dépôts publics, compte créé 2020)
Formation: Bachelor 3 ESGI Toulouse (programme "SRC"), 2026-2027 — délégué de classe (comités pédagogiques déc. 2025, juil. 2026, nov. 2026)
En parallèle: présence récurrente chez CTI (Toulouse) 3 après-midis/semaine depuis mai 2026
Langues: français (natif), anglais (blog technique intégralement écrit en anglais)
Disponibilité: non documentée

CTF / pratique offensive
- THCon 2025 (Toulouse Hacking Convention), joueur, 12/04/2025 — challenge misc "neoprivesc" (500 pts)
- 7 writeups Hack The Box publiés (26-28/11/2025): SSTI WordPress/CVE-2024-6386, XSS+bot Selenium, SSRF→Redis→pickle→RCE, AES-CBC bit-flipping, reverse ELF, malware PowerShell/.NET + pcap, blockchain Solidity
- Rang / classement / pseudo de plateforme: non documenté

Compétences (pratique régulière sauf mention)
- Réseau/edge: OPNsense (VLAN, NAT, policy routing, WireGuard, NetBird, Cloudflare Tunnel), DNS Unbound/Technitium, Suricata, CrowdSec
- Infra: Proxmox VE 9.2 (2 nœuds, 52 invités dont 48 actifs), LVM-thin, ZFS, NFS, PBS, restore testé
- Systèmes: Debian/Ubuntu/Alpine, systemd, Docker, Docker Swarm, Dokploy
- Identité/secrets: Authentik (OIDC), Warpgate (bastion SSH SSO), Infisical, Vaultwarden
- Observabilité: Prometheus, Grafana, Checkmk, Wazuh (27 agents), Uptime Kuma, ntfy
- Dev: TypeScript/Next.js, Go, Rust, Python, Java 21, Kotlin, Lua, Bash
- Delivery: GitHub Actions (build multi-arch, Trivy, GHCR), Forgejo + runner, Dokploy, Caddy
- Hors-site: PBS + rclone crypt → Google Drive
- Non pratiqué / non documenté: AWS, Azure, GCP, certifications

Homelab (chiffres vérifiés 30/10/2026)
- 2 nœuds Proxmox quorate, 52 invités (41 LXC + 11 VM), 45 services documentés
- 8 segments réseau (LAN + 7 VLAN), 38 routes publiques + 28 privées derrière Caddy
- 2 sites reliés par un mesh WireGuard/NetBird
- Sauvegardes: 2 jobs (02h00 keep-7 / 04h00 keep-3), GC hebdo, verify mensuel, restore booté le 10/09/2026
- ~5,9 To de stockage thin, ~600 Go de datastore PBS, 2 NAS

Projets publics (github.com/cleeryy)
- blog — blog technique Hugo, CI/CD complet, blog.cleeryy.cloud
- hello — API wake-on-lan en Go (CI, releases, Docker), en prod sur Raspberry Pi
- mealboard — planning de repas Next.js + SQLite, self-hosted
- balcon — clone de changedetection.io (Next.js 16 + Prisma + sidecar FastAPI)
- arneph — lecteur/éditeur de webtoons (Next.js 16, Supabase)
- cipherbot — bot Discord cybersécurité en Rust (CVE NVD, MITRE ATT&CK, RDAP, VirusTotal)
- jambon / proxcontrol — bots Discord de pilotage Proxmox (Rust, Go)
- openclip "Calque" — studio de peinture Android (Kotlin, GPL-3.0)
- micforge — traitement micro temps réel Windows (Rust + Tauri, AGPL-3.0)
- zenfree — passerelle OpenAI-compatible vers modèles gratuits (Rust)
- VegJustice — plugin Minecraft Paper (Java 21, 230 commits)
- gices — suivi de courrier (Next.js 14, Prisma, NextAuth)
- GreenRoute — projet ESGI UML2, livraison dernier kilomètre
- tchounis-pharmacy — site de révision Fumadocs (pharmacologie UE2.11)
- atlas-live — carte temps réel du cluster (Python stdlib + SVG, 15 s de refresh)
```

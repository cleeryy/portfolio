# cleeryy.com

A portfolio built as **a map of a territory I operate**: the homelab drawn as a survey,
the training ranges at its edge, and the software that runs on it.

Live: <https://cleeryy.com> · Design rationale: [`DESIGN.md`](./DESIGN.md)

## Stack

| Layer | Choice |
| --- | --- |
| Build | Vite 8 + React 19 + TypeScript |
| Motion | GSAP 3 (ScrollTrigger) + **Lenis** (the only smooth-scroll engine) |
| 3D | Three.js — one orthographic survey scene in the hero, GPU-only per-frame work |
| Sound | Web Audio API, fully synthesized (no audio files), **off by default** |
| Copy | Bilingual EN/FR, written twice — see `src/content/*` |

## Develop

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # tsc -b && vite build → dist/
pnpm preview    # serve dist/
pnpm lint       # oxlint
```

## Where content lives

| File | Holds |
| --- | --- |
| `src/content/hero.ts` | handle, positioning line, collar readings |
| `src/content/territory.ts` | the homelab inventory (nodes, tiers, counts) |
| `src/content/ranges.ts` | training platforms — `profileUrl` is `null` until handles are confirmed |
| `src/content/services.ts` | the installations (name, one line, stack, address) |
| `src/content/about.ts` | first-person copy; `timeline: []` renders nothing until filled |
| `src/content/contact.ts` | address + invitation |

Every string is a `{ en, fr }` pair consumed through `useLang().pick(...)`.

## Deploy

Container listens on **8080** (nginx unprivileged, uid 101); the compose file publishes
**7747** on the host.

```sh
docker compose up -d --build
curl -I http://127.0.0.1:7747/
```

Dokploy: app type **Docker Compose**, compose path `docker-compose.yml`, container port
**8080**, healthcheck path `/`. Caddy route lives in the `caddy-config` repo
(`sites/public/portfolio.caddy`): `cleeryy.com` → `obiwan:7747`, `www` → 301.

## Non-negotiables

- One smooth-scroll engine (Lenis). Never add Locomotive or a second RAF loop.
- `prefers-reduced-motion` renders final states; no intro, no drift, no smooth scroll.
- The hero canvas must degrade to a complete static frame if WebGL/JS fails.
- No invented metrics, ranks, testimonials, logos or certifications. Numbers come from
  the config they describe.
- Tokens only (`src/styles/tokens.css`) — no raw hex in components.

CI (`.github/workflows/ci.yml`): lint + build on every push to `main`.

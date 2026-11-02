# cleeryy.com

A portfolio built as **a survey sheet of a network I run** — the lab drawn as a map,
and twenty projects documented one file at a time on the same sheet.

Live: <https://cleeryy.com> · Design rationale: [`DESIGN.md`](./DESIGN.md) · Source map: [`ARCHITECTURE.md`](./ARCHITECTURE.md)

## Stack

| Layer | Choice |
| --- | --- |
| Build | Vite 8 + React 19 + TypeScript |
| Motion | GSAP 3 (ScrollTrigger) + **Lenis** (the only smooth-scroll engine) |
| 3D | Three.js — two scenes only: the territory schema and the passage |
| Sound | Web Audio API, fully synthesized (no audio files), **off by default** |
| Copy | Bilingual EN/FR, written twice — see `src/content/*` |
| Routing | 60-line history router, no dependency (`src/lib/router.tsx`) |

## Routes

| Route | What it is |
| --- | --- |
| `/` | cover → selected work → territory → passage → operator → contact |
| `/work` | the register: 20 projects, grouped by domain |
| `/work/:slug` | one file per project (claim, what it is, what I did, state, links) |
| `/notes` | the writing: posts and CTF writeups, linked to the blog |
| `/about` | the record, five domains of practice, what is deliberately absent |
| `*` | a 404 that is not a dead end |

## Develop

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm build      # tsc -b && vite build → dist/
pnpm typecheck  # tsc -b --noEmit
pnpm preview    # serve dist/
pnpm lint       # oxlint
```

## Where content lives

| File | Holds |
| --- | --- |
| `src/content/cover.ts` | the cover: claim, note, four readings, the four-band section |
| `src/content/work.ts` | the register: 20 projects, domains, page and file copy |
| `src/content/notes.ts` | the writing: 16 entries with dates and real URLs |
| `src/content/about.ts` | the operator chapter, the record, the five domains |
| `src/content/contact.ts` | the ask, three addresses (email is owner-supplied) |
| `src/content/site.ts` | navigation, page titles, meta descriptions, 404 |
| `src/lib/typo.ts` | `fr()` — French punctuation spacing, applied once at authoring |

Every string is a `{ en, fr }` pair consumed through `useLang().pick(...)`.

## Deploy

Container listens on **8080** (nginx unprivileged, uid 101); the compose file publishes
**7747** on the host. nginx already has the SPA fallback, so deep links (`/work/lab`)
resolve to the app shell.

```sh
docker compose up -d --build
curl -I http://127.0.0.1:7747/
```

Dokploy: app type **Docker Compose**, compose path `docker-compose.yml`, container port
**8080**, healthcheck path `/`. Caddy route lives in the `caddy-config` repo
(`sites/public/portfolio.caddy`): `cleeryy.com` → `obiwan:7747`, `www` → 301.

## Non-negotiables

- One smooth-scroll engine (Lenis). Never add Locomotive or a second RAF loop.
- `prefers-reduced-motion` renders final states: no boot, no drift, no pin, no smooth
  scroll, no route wipe.
- The cover has **no canvas**. The only two WebGL scenes are the territory and the
  passage, and both must degrade to their DOM/SVG poster.
- Every project page comes from `src/content/work.ts`. A project added without an entry
  does not exist.
- No invented metrics, ranks, certifications, employers or testimonials. Numbers come
  from the thing they describe; the register says which links are private and why.
- Tokens only (`src/styles/tokens.css`) — no raw hex in components.

CI (`.github/workflows/ci.yml`): lint + build on every push to `main`.

# BRIEF-V5 — cleeryy.com, pass 5: the sheet gets a body of work

**Read this whole file before touching a line.** Then read `DESIGN.md` (the design
contract), then `src/content/*.ts` (the copy is already written — do not rewrite it).

---

## 1. What is being done, and why

The current site is a beautiful design with a CV wearing a map costume. It has eleven
chapters, most of which are atmosphere: `relief`, `ascii`, `interlude`, `request`,
`ranges`, `path`, `skills`. A visitor cannot see a single project in depth.

This pass keeps the visual language **exactly** — same tokens, same two typefaces,
same graticule, same crimson, same hairlines, same motion curve — and replaces the
*information architecture* with a real portfolio: a compact home page, a register of
twenty projects, and one file per project.

### Non-negotiables (a regression here is a failed pass)

1. **Do not touch the design language.** `src/styles/tokens.css` values, the two
   families (Archivo + Spline Sans Mono), square corners, zero shadows, zero
   gradients, hairline rules, the single crimson accent rationed to a few marks per
   screen. No new colour, no new radius, no card.
2. **Keep the three devices the owner loves:**
   - the **3D territory schema** (`#territory`, `Territory*.tsx`) — untouched;
   - the **tunnel / descent** (`#flight`, `Flight*.tsx`, the instanced mono plates) —
     untouched except its copy (already in `src/content/flight.ts` if present) and the
     chapter it hands off to;
   - the **horizontal pinned traverse** — kept, moved from `#ranges` to `#work`;
   - **light → dark → light alternation** — the passage turns dark, the operator
     chapter stays dark, contact returns to the sheet.
3. **One smooth-scroll engine (Lenis). Never a second RAF loop.** Reuse
   `src/lib/reveal.ts` (`MOTION`, `initMotionSystem`), GSAP ScrollTrigger, and the
   existing helpers. Do not add a dependency except `react-router-dom` **only if you
   cannot** implement the 60-line router described in §4 (prefer the router: the
   bundle matters).
4. **`prefers-reduced-motion` renders final states.** No intro, no drift, no pin, no
   smooth scroll, no route-wipe.
5. **No invented fact.** Every string comes from `src/content/*.ts`. If a section
   needs a label that is not there, add it to the content module and keep it in both
   languages — never inline English in a component.
6. **Bilingual.** Every visible string goes through `useLang().pick()`. French is
   written, not translated; the existing modules already are.
7. **Nothing is deleted that is referenced.** After the deletions in §3, `tsc -b`
   must pass with zero unused imports.

---

## 2. The new site

```
/                 cover → selected work (horizontal) → territory (3D)
                  → passage (tunnel, turns dark) → operator (deep) → contact
/work             the register: 20 projects, grouped by domain
/work/:slug       one file per project
/notes            the writing: 16 posts and writeups, linked to the blog
/about            the record, five domains of practice, what is not here
*                 a 404 sheet that is not a dead end
```

Nav (5 items + language + sound): `Work` · `Territory` · `Notes` · `About` · `Contact`.
`Work`, `Notes`, `About` are routes; `Territory` and `Contact` are home anchors
(`/#territory`, `/#contact`) and must work from any route.

Section ids on the home page, in order: `cover`, `work`, `territory`, `flight`,
`operator`, `contact`. `#top` stays on `<main>`.

---

## 3. Delete, keep, adapt

**Delete these component trees** (and their CSS, and their content modules once
nothing imports them):

| Path | Why |
| --- | --- |
| `src/components/hero/HeroScene.tsx` | the survey plot the owner does not want; the cover is type + a drawn section now |
| `src/components/relief/*` | no content payload |
| `src/components/ascii/*` | no content payload |
| `src/components/ranges/*` | the CTF register is now `/notes`; the horizontal mechanic moves to `#work` |
| `src/components/services/*` | replaced by the register |
| `src/components/path/*` | folded into `#operator` + `/about` |
| `src/components/skills/*` | folded into `/about` (`practice`) |
| `src/components/interlude/*` | folded into `contact` |
| `src/content/{ascii,ranges,services,path,skills,relief}.ts` | their copy has no reader |

**Keep untouched:** `Atmosphere`, `SheetGrid`, `Territory*`, `Flight*`, `Cursor`,
`Grain`, `ScrollProgress`, `PointerHud`, `lib/*` (except `reveal.ts` if a rig needs a
new export), `styles/*`.

**Adapt:**
- `BootGate` — it currently waits on the hero's `data-scene="live"` attribute. That
  signal no longer exists. Remove the observer; the plate lifts on (bundle committed +
  `document.fonts.ready`), ceiling 0.92s. Keep the sessionStorage skip and the reduced
  motion skip.
- `InstrumentChrome` — plates are now **six** (cover + five nav targets). Derive the
  divisor from the nav links instead of hardcoding `08`. Render it on `/` only.
- `NavBar` — new items, route-aware (`aria-current="page"` on routes, section observer
  on `/` only), same compact-on-scroll behaviour, same `Rollover`, same sound cues.
- `lib/sound/rooms.ts` mapping — `cover → paper`, `work → paper`,
  `territory → machine`, `flight → air`, `operator → ink`, `contact → paper`.
  Unknown ids must be a no-op, not an error.
- `flight.ts` copy: new title/lead (below). Keep every label in `flightLabels` — they
  are facts from the lab.

---

## 4. Router

Create `src/lib/router.tsx`:

```ts
export type Route = { path: string; params: Record<string, string> }
export function useRoute(): Route              // subscribes to popstate
export function navigate(to: string): void     // pushState + scroll to top (or to hash)
export function Link(props): JSX.Element       // <a href> that intercepts plain left-clicks
```

Rules:
- `pushState` on internal navigation; `popstate` handled; `<a href>` stays real so
  middle-click, ctrl-click and copy-link work.
- On route change: `window.scrollTo(0, 0)` (instant, not smooth), close the mobile
  nav, update `document.title` and `<meta name="description">`, then after paint call
  `ScrollTrigger.refresh()` and kill/recreate the page's own triggers.
- Hash links (`/#territory`) navigate home first, then `scrollToId` after the home
  page mounts (one rAF, then a 2nd if layout moved).
- Route table:
  - `/` → `Home`
  - `/work` → `Register`
  - `/work/:slug` → `ProjectFile` (match a single segment; unknown slug renders the
    project 404 copy from `fileCopy.missing*`)
  - `/notes` → `NotesPage`
  - `/about` → `AboutPage`
  - anything else → `NotFound` (404 copy: `notFound` export you will add to
    `src/content/site.ts` — write it in both languages, short).
- Titles: `cleeryy — cover` / `— the register` / `— <project name>` / `— field notes`
  / `— about`. Descriptions: one sentence per route, bilingual, from content.
- **Route transition**: 220ms, transform + opacity only, no layout shift, skipped
  under reduced motion. Use one fixed hairline rule that wipes across under the nav
  (scaleX 0→1→0) — no full-screen plate, no waiting.

No `react-router-dom`. The site ships five static routes; a dependency is not worth
30 kB.

---

## 5. Section by section

Everything below assumes tokens only (`--ground`, `--ink`, `--step-*`, `--gutter`,
`--ease-out`…). No raw hex in a component.

### 5.1 `#cover` — the cover (light)

Type on the sheet. **No canvas.**

```
┌ nav ────────────────────────────────────────────────────────────────────┐
│ ▪ Toulouse, FR — infrastructure & security                              │
│                                                                          │
│ cleeryy                                     ┌ collar ┐                   │
│                                             │ 2      │ nodes             │
│ I run the network I learn on.               │ 52     │ guests            │
│                                             │ 45     │ services          │
│ Two Proxmox nodes, eight segments…          │ 66     │ routes            │
│                                                                          │
│ [See the work]  Open the map                                             │
├──────────────────────────────────────────────────────────────────────────┤
│ 01 edge       opnsense · caddy · warpgate              one door          │
│ 02 fabric     pve1 · pve3 · vmbr1                      2 nodes           │
│ 03 services   mail · photos · git · media              45 documented     │
│ 04 backup     pbs · rclone crypt                       restored 09/2026   │
│ cut through the stack                          the same territory, flat   │
└──────────────────────────────────────────────────────────────────────────┘
```

- `100dvh` minimum, minus the nav; the section drawing sits on the bottom rule.
- Handle: `--step-6`, width axis `--width-plate`, tracking `--tracking-plate`, one
  line at 1440. Claim at `--step-3`, max 26ch. Note at `--step-1`, max 54ch,
  `--ink-2`. CTAs: magnetic primary (reuse `MagneticButton`), plain mono secondary.
- Collar: four readings in the right margin, label above value, mono 11px; they must
  align to the handle's cap-height, not float. Below 900px they become a 2×2 grid
  under the note.
- Section drawing: four bands, each `ref · name · detail · value` on one line,
  hairline rule between bands, `value` right-aligned and in mono; a 2px crimson tick
  on the band that is hovered/focused (bands are not interactive — the tick is a
  registration mark, not a button).
- Motion (reuse the `MOTION` table): handle rises from a mask, claim word by word,
  note fades, bands' rules draw left→right with 60ms stagger. Nothing moves after
  that. The cursor reticle already exists.
- Remove every reference to `HeroScene` and its poster fallback.

### 5.2 `#work` — selected work, horizontal (light)

Pinned traverse at ≥900px with a fine pointer; vertical stack below that.

- Header before the pin: title `Selected work` (`--step-4`), lead (`workCopy.trailLead`)
  in the right half, max 40ch.
- Six plates: the five `featured` projects in `work.ts` order + one closing plate
  (“Twenty projects, one register” → `/work`).
- Plate layout: 62vw wide, 24vw peek of the next. Top rule with `W.01` (mono) left and
  the domain label right. Name at `--step-5` (clamp), claim at `--step-2` max 32ch,
  then a bottom row: `stack.join(' + ')` mono 11px, status mono, `open file` link.
  A deterministic **project seal** (see 6.3) at the top-right, 96px.
- The closing plate uses `--deep` ink as background **only if** it reads as a chapter
  end, not a second dark band — otherwise keep it light and let the passage own the
  dark. Prefer light.
- Progress: a 1px rule at the foot of the section, crimson, `scaleX` = traverse
  progress. Counter `plate 01/06` mono, bottom-left, in the section's gutter.
- Mobile: no pin, plates stack full-width with 24px gaps, same content, seals at 64px.

### 5.3 `#territory` — unchanged

Do not restyle. Only: update its lead if it references removed chapters
(`#ranges`, “the dark chapter below”). It currently says “the dark chapter below is
the training record” — that sentence must change to point at `/notes` or disappear.
Keep every station, link and interaction.

### 5.4 `#flight` — the passage (turns dark)

Unchanged mechanically. New copy (`flight.ts`):

```ts
title: 'The passage' / 'Le passage'
lead EN: 'The map above is flat. Here it becomes a depth: the names it holds — machines,
guests, addresses, ground — pass at full size, one at a time, until the sheet turns to ink.'
lead FR: 'La carte au-dessus est plate. Ici elle devient une profondeur : les noms
qu’elle retient — machines, invités, adresses, terrain — passent à leur taille, un par
un, jusqu’à ce que la feuille vire à l’encre.'
```

The plate must end at `--deep` and hand off to `#operator` with **no light seam**.
Today it hands off to `#ranges`; change the handoff target and make sure the ink
continues through the whole operator chapter.

### 5.5 `#operator` — the operator (deep ink)

```
┌ the operator ───────────────────────────────────────────────────────────┐
│ I learn systems by running them.                                        │
│                                                                          │
│ Third year at ESGI Toulouse, Bachelor 3, programme “SRC”, 2026–2027…     │
│                                                                          │
│ No certification yet. What I have instead: a network I run end to end…   │
│                                                                          │
│ based          Toulouse, FR                                             │
│ studying       ESGI B3 — SRC                                            │
│ working        IT, 3 afternoons                                         │
│ certifications none yet                                                 │
│                                              [The long version] →       │
└──────────────────────────────────────────────────────────────────────────┘
```

- Full ink background, top rule in `--deep-ink-2`, one crimson mark only.
- Two columns: margin rail (label `the operator`, mono, vertical) + reading column.
  Facts are a 4-row ledger on the right, mono 11px, `--deep-ink-2`.
- Link to `/about` with the `Rollover` treatment.
- `.on-deep` handling already exists in `base.css` — use it; do not invent a second
  deep theme.

### 5.6 `#contact` — closing (back to light)

Reuse `contact.ts`. Layout: margin label `the request`, the ask at `--step-4`/`--step-5`
(max 20ch/line), the invitation at `--step-1` max 50ch, then a ledger of three
addresses: `mail` (mailto, `--step-2`, underlined), `code` (github), `writing`
(blog). Footer: colophon + scale bar + `back to top`, as today.

---

## 6. The three new pages

### 6.1 `/work` — the register

Header: title `The register` (`--step-4`), lead max 44ch, and a mono reading
`20 projects`. Then four groups in `domains[]` order. Group header: label
(`--step-2`), note (`--ink-3`), count (mono). Then rows.

Row grid (12 cols): `name` (display, `--step-2`, width axis on hover) · `claim`
(`--ink-2`, 1–2 lines, 5 cols) · `stack` (mono 11, 2 cols) · `status` (mono 11) ·
`year` (mono 11). The whole row is a `Link` to `/work/<slug>`. Hairline under each
row; on hover the row's rule goes `--ink`, the name lifts to width 106, and a 6px
crimson registration square slides in at the left gutter (transform only).

Mobile: two-line block — name + year on one line, claim under, stack/status in a
mono line, whole block tappable (≥44px).

Foot note: `workCopy.note`.

### 6.2 `/work/:slug` — the file

Two columns: reading column (max 62ch) + a meta rail (right, 280px, sticky under the
nav).

```
file W.03 / software                        [ seal 240px ]
calque
A painting studio for Android tablets that never phones home.

What it is
  <summary>

What I did
  — <did[0]>
  — <did[1]>
  — <did[2]>

state    in progress        access   —
year     2026               built with  Kotlin + Android
Open
  source   github.com/cleeryy/openclip
```

- Name at `--step-5`; claim at `--step-2`, `--ink-2`.
- Labels (`What it is`, `What I did`, `Open`) are mono 11px uppercase-free, in the
  margin of the reading column, not above it (same device as the rest of the sheet).
- `did` items: a crimson hairline tick (4px, 1px rule) then the sentence. No bullets,
  no numbers.
- Meta rail: `state`, `year`, `access` (or `workCopy.noLink`), `built with`
  (`stack.join(' + ')`), then the links as stacked rows: label mono, address
  underlined, external. **All links `rel="noreferrer" target="_blank"`** except
  internal ones.
- Foot: previous/next file in register order, two full-width rows with mono labels
  and names at `--step-2`; a final row back to `/work`.
- Unknown slug: the missing copy + link back. Status 200 is fine (static app).

### 6.3 The project seal (one component, `ProjectSeal.tsx`)

A deterministic mark, drawn in DOM/SVG, no canvas, no asset:

- a 7×7 lattice of 2px dots, radius 1px, `--contour`;
- ink a path from a hash of the slug (FNV-1a over the slug, then a small LCG) — about
  14–18 dots in `--ink` forming a random walk from the top-left;
- exactly one dot in `--mark`;
- a hairline frame, 1px, `--contour`, with a `+` registration cross at one corner.

Size is a prop (`96`, `240`). It must look like a station plot on a survey sheet, not
a logo, not a QR code. Same slug → same seal on the traverse and on the file.

### 6.4 `/notes`

Header: `Field notes`, lead, count. Then groups by year, newest first (2026, 2025).
Row: `date` (mono 11) · `kind` (mono 11, in the margin) · `title` (display
`--step-2`) · `line` (`--ink-2`). The whole row links to `note.href` in a new tab.
Foot: `Read everything — blog.cleeryy.cloud`.

### 6.5 `/about`

Header: `The record, without the costume.` + lead. Then three blocks separated by the
sheet's ruled chapter device (a top rule + margin label):

1. **record** — `record[]`: year in the mono margin, label at `--step-2`, note in
   `--ink-2`. A vertical hairline runs through the years (a spine), as on a survey
   log.
2. **practice** — `practice[]`: five blocks. label (`--step-2`) + qualifier (mono
   11px, inside a 1px hairline plate, crimson text — this is the only place a tag is
   allowed, because it is a measurement), instruments on one mono line joined with
   ` + `, and `proof` at `--step-0` `--ink-2` max 52ch.
3. **honesty** — an ink band (the page's one dark break): title + one paragraph at
   `--step-3`, max 34ch, `--deep-ink`. Then the contact CTA.

### 6.6 `404`

Not a joke page. A sheet with a missing plate: title (`--step-4`), one line, and two
links: `the register`, `the cover`. Keep it 60vh, no illustration.

---

## 7. Folders and naming

```
src/components/cover/Cover.tsx        cover.css
src/components/work/WorkTraverse.tsx  work-traverse.css
src/components/work/Plate.tsx
src/components/seal/ProjectSeal.tsx
src/components/operator/Operator.tsx  operator.css
src/components/register/Register.tsx  register.css
src/components/project/ProjectFile.tsx project.css
src/components/notes/NotesPage.tsx    notes-page.css
src/components/about/AboutPage.tsx    about-page.css
src/components/site/NotFound.tsx      not-found.css
src/pages/Home.tsx
src/content/{hero,work,about,contact,notes,site}.ts
src/lib/router.tsx  src/lib/typo.ts  src/lib/seo.ts
```

Every component reads copy from `src/content`; every style is in its own CSS file
imported by the component; every class is prefixed with the component (`cover__`,
`reg__`, `file__`, `notes__`, `about__`, `op__`).

---

## 8. Content rules (already enforced in the modules — keep them)

- Facts only. The numbers on the cover (`2 / 52 / 45 / 66`) come from `hero.readouts`.
- No employer name, no job title, no contract type, no certification, no rank, no
  availability date.
- A project's status is `in production`, `in progress`, `prototype` or `archive` — read
  off `work.ts`, never inferred in a component.
- Links only from `work.ts` / `notes.ts`. Do not add a link to a private service.

---

## 9. Acceptance criteria (check these before you say done)

1. `pnpm lint` → 0 error, `pnpm build` → exit 0, no TypeScript error, no unused file
   left importing a deleted module.
2. `grep -r "HeroScene\|#ranges\|#ascii\|#relief\|#path\|#skills\|#services" src/`
   returns nothing.
3. All six routes render with real content at 1440×900 and 390×844, no horizontal
   overflow (`document.documentElement.scrollWidth <= innerWidth + 1`).
4. `prefers-reduced-motion: reduce` → no pin, no intro, no smooth scroll, final states.
5. Keyboard: nav, plates, register rows, links and prev/next are reachable, visible
   focus ring (`--focus`), no focus trap.
6. Console clean (no React key warning, no 404 asset, no WebGL error).
7. `document.title` changes per route; `lang` still follows the language switch.
8. Deep link `/work/cipherbot` reloads correctly (Vite dev + `pnpm preview`).
9. Lighthouse: no CLS from the cover; the cover's LCP is text, not a canvas.
10. The site still looks like the same sheet: same ground, same rules, same type,
    same crimson, same silence.

## 10. Git

Work on branch `v5` (already checked out). Commit in logical steps with conventional
messages (`feat(work): …`, `refactor(home): drop the survey plot`, …). **Do not push
and do not merge.** Report the commits at the end.

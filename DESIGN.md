# DESIGN.md — cleeryy

A portfolio built as **a map of a territory he operates**.

---

## 1. Thesis: CARTOGRAPHY — the survey sheet

The whole page is one plotted sheet: a pale land tint, a printed graticule, drafting
ink, hairline rules, and **one** survey mark in crimson. Type is the figure the drawing
is subordinate to. Nothing on the page is a card, a chip, or a panel.

### Why this subject, and not "security aesthetic"

cleeryy does not *talk* about networks — he **draws** them. A network diagram, a VLAN
plan, a port table, a tunnel map, a backup schedule: every artefact of his actual
practice is already a map. Cartography is therefore not a metaphor borrowed from films
about hackers; it is the same object as the work, rendered at a different scale.

It also solves the site's structural problem. The brief asks for "a map of a territory",
and a map is only credible if it has a coordinate system. Contours, a graticule, a
scale bar and a legend are real instruments, not decoration — they give the page a
geometry to lay sections onto, and they give the reader a way to read it
("where am I on this sheet?") that a résumé cannot.

The second half of the subject fits without a seam: **a CTF is a survey of unfamiliar
terrain**. You map someone else's network with the same instruments. So the training
ranges sit on the same sheet, at its edge, drawn faint — surveyed, but not owned.

### Why not the alternatives

- **B — DOSSIER.** The obvious choice for a security operator, and that is the problem.
  Redaction bars and classification stamps are a costume. He works on live
  infrastructure, not on engagement reports; a redacted PDF would be an aesthetic
  borrowed from a job he does not do.
- **C — SIGNAL.** On a dark ground this collapses into the green-terminal tell within
  one screen, and telemetry describes a *moment*, while this subject is a *place*. A
  place deserves a map.

### Tells refused on purpose

| Tempting default | What this site does instead |
| --- | --- |
| cream `#F4F1EA` + high-contrast serif + terracotta | cool sage-grey ground, one grotesque, one mono, crimson mark |
| near-black hero + acid accent | light dominant surface; the only dark band is the training chapter |
| matrix green, glitch text, padlocks, "ACCESS GRANTED" | plotting conventions: station crosses, ringed control points, a scale bar |
| rounded cards, soft shadows, gradient blobs | square corners, 1px rules, zero shadows, zero gradients |
| caps-tracked eyebrow above each heading | headings carry a **margin annotation** to the side, or nothing |
| `a · b · c` metadata strings | separate lines, or `+` |
| `→` appended to links | an underline, or a moving registration square |
| `01 / 02 / 03` section numbering | places on a map are named, not numbered |

---

## 2. Tokens

Defined in `src/styles/tokens.css`. Components must consume the token, not the hex.

### Colour — six surfaces/inks, one accent

| Token | Hex | Job | Why this value |
| --- | --- | --- | --- |
| `--ground` | `#E7E9E2` | page surface | the pale land tint of a topographic sheet; cool, so it never reads as paper cream |
| `--ink` | `#131C19` | type, rules | drafting ink with a green cast — it belongs to the ground's family instead of punching a hole in it. Never `#000` |
| `--ink-2` | `#3F4C47` | secondary copy | ~9:1 on ground; carries paragraphs without competing with headings |
| `--ink-3` | `#55625D` | annotations | ~5.6:1 on ground, so 11px legend keys still pass AA |
| `--contour` | `#B2BCB1` | graticule, hairlines | the printed grid under the drawing |
| `--chart` | `#C9D3CC` | shallow-water tint | reserved for the plot and quiet fills; never carries text |
| `--deep` | `#0E1613` | chapter break | exactly one dark band on the whole site (Ranges) |
| **`--mark`** | **`#BF1F34`** | **accent** | a survey control mark: cool crimson, closer to a grease pencil than terracotta or vermilion. Rationed to ~4 marks per screen |

Derived steps (`--ground-raised`, `--ground-sunk`, `--deep-2`, `--mark-deep`) are tints of
the same six, not new hues.

### Type — two families

| Token | Stack | Job |
| --- | --- | --- |
| `--font-display` / `--font-text` | `Archivo` → Helvetica Neue → Arial | everything that is read. A grotesque drawn for signage and dense print; its **width axis** lets the handle sit wide like a map title while body copy stays at 100% |
| `--font-mono` | `Spline Sans Mono` → ui-monospace → Menlo | **measurements only**: coordinates, legend keys, the scale bar, the language switch. Never prose, never every small label |

Loaded via a Google Fonts `<link>` with `preconnect` in `index.html`, `display=swap`, and
a system fallback stack so a failed font request changes the letterforms but not the
layout.

### Scale

| Token | Value | Used for |
| --- | --- | --- |
| `--step--2` | 11px | legend keys, scale bar, `#section` refs |
| `--step--1` | 13px | legend values, captions |
| `--step-0` | 16px | base |
| `--step-1` | 18px | lead paragraph (the hero note) |
| `--step-2` | `clamp(20px, …, 24px)` | subheads |
| `--step-3` | `clamp(24px, …, 34px)` | the positioning line |
| `--step-4` | `clamp(32px, …, 52px)` | section titles |
| `--step-5` | `clamp(44px, …, 88px)` | chapter numerals |
| `--step-6` | `clamp(52px, 0.5rem + 17vw, 168px)` | the handle |

Measure is capped at `--measure: 62ch`; the hero note at 54ch. Nothing runs past 80ch.

### Space, motion, geometry

- **Space**: 4px base, then a wide-gutter rhythm (`--s-1`…`--s-10`). `--gutter`
  collapses from 4.5rem to 1.25rem and never to zero — a sheet always has a margin.
- **Easing**: one family. `--ease-out` (fast settle, like a pen reaching the next mark),
  `--ease-draw` for rules. No bounce, no elastic: a plotter has no personality.
- **Duration**: `140 / 280 / 640 / 1100ms`.
- **Radius**: `--r-0: 0`, `--r-1: 1px`, `--r-2: 2px`. A chart has no rounded corners.
- **Shadows**: none.

---

## 3. Page structure

```
┌───────────────────────────────────────────────────────────────────────────┐
│  ▪ cleeryy        Territory  Ranges  Services  About  Contact   EN FR ◂Son │  nav, fixed, 1px rule
├───────────────────────────────────────────────────────────────────────────┤
│ · · · graticule 24 / 120px · · · · · · · · · · · · · · · · · · · · · · · · │
│                                                     ⊕                     │
│   cleeryy                        ●────────●          ·                    │
│                                  │ ╲    ╱ │      ●───┼───●                │
│   I run my own network           ●──⊕───●        ╲  │  ╱                  │   ← WebGL plot
│   end to end, and train           ╲    ╱          ●─●     (stations, links,│
│   on everyone else's.              ●──●                    travelling dot) │
│                                                                           │
│   Hypervisor, edge firewall, tunnel, reverse proxy, backups…               │
│                                                                           │
│   [▪ Open the map]    The operator                         10.1.20.x      │
├───────────────────────────────────────────────────────────────────────────┤
│ site            cluster        edge              backup                    │  collar
│ home lab, FR    pve1 + pve3    OPNsense + WG     PBS + offsite   ┃┄┄┄┄┄    │  (legend + scale)
└───────────────────────────────────────────────────────────────────────────┘
        ↓
   #territory   the homelab drawn at full size: annotated topology, leader lines
        ↓
   #ranges      HARD CHAPTER BREAK — ink band. The training grounds as a register
        ↓
   #services    the apps he runs, as installations pinned to the map
        ↓
   #about       the operator, first person, short
        ↓
   #contact     one line, one address, no form theatre
```

**Section id contract** (the nav observes and scrolls to these): `path`, `skills`,
`territory`, `ranges`, `services`, `about`, `contact`. `#top` lives on `<main>`.
Page order is CV-first: where he comes from, what he can be trusted with, the network he
runs, the terrain he practises on, the work, the person, the request.

---

## 4. Section sequence

| # | Section | Job | Copy rule |
| --- | --- | --- | --- |
| 1 | **Hero** | who, what, and the territory in one viewport | one claim, two sentences of context, four honest readings |
| 2 | **Territory** | the homelab as a real place: edge → cluster → services, annotated with leader lines | every node is a thing that exists; no aspirational architecture |
| 3 | **Ranges** | the training grounds (TryHackMe, HackTheBox, Root-Me, PortSwigger, on-site CTFs) | name the platform and what he does there. No scores, no ranks, no "top 1%" |
| 4 | **Services** | the software he builds and hosts (mealboard, micforge, the course site) | one line each, plus a link. No invented user counts |
| 5 | **About** | the operator, plainly | no CV theatre, no certifications he does not hold |
| 6 | **Contact** | one address, one invitation | the address is supplied by the owner (`CONTACT_EMAIL`); it is the one value I refuse to invent |

---

## 5. Motion narrative

**Boot (≤ 1.9s, zero layout shift).** The sheet is ruled first: the graticule wipes in
from the left. Then the figure: the handle rises from behind its mask, the positioning
line follows word by word, then the note, the actions, and finally the collar. Every
element is laid out at full opacity before GSAP touches it, so the sequence can fail
without hiding anything. Measured CLS: **0**.

**The plot draws itself.** Stations appear inside-out by `aOrder`; each edge is a line
whose head walks from its source to its target as the reveal passes it — literally a
pen drawing the map. Packets start moving only once the survey is inked.

**Scroll.** The plot is not pinned and the page is never hijacked. As the hero leaves,
the drawing drifts up, scales 5% and dims (`uDepth`), while the type scrolls away at its
own speed. It is depth, not parallax theatre.

**Pointer.** Two additive reactions, both small: the group leans by 4% of the pointer
offset, and each vertex is displaced away from the cursor by a gaussian falloff in the
vertex shader (`uRepel`, 0.055 units). The CTA is magnetic to 9px, its label to 4px.

**Reduced motion.** No intro (final states are already in the markup), no drift, no
magnetic pull, native cursor, and Lenis is never created. The plot renders **one**
complete frame and stops.

**Technical contract (`HeroScene.tsx`).** Orthographic camera, three draw calls, all
per-frame work on the GPU: a frame writes five uniforms and two transforms, and
allocates nothing. DPR capped at 2. Rendering stops via `IntersectionObserver` and
`visibilitychange`. Pointer conversion happens once per frame from cached client
coordinates, never per event. Teardown disposes every geometry, material and the
renderer, removes all listeners and cancels the rAF. WebGL absent, setup throwing, or
`webglcontextlost` all land on `onUnavailable()` → the CSS poster (graticule + type)
stays, and the hero is never an empty rectangle.

---

## 6. Sound design intent

The audio lane's `lib/sound.ts` already implements this thesis, so the intent here is a
confirmation, not a new proposal:

- **The room, not a soundtrack.** Relay ticks, a sonar reading, the low tone of a
  machine hall. No melody, no rhythm.
- **Off by default and never autoplayed.** No `AudioContext` before a real gesture; a
  stored "on" still waits for the next one.
- **Nothing on the frame loop.** Every modulation lives in the audio graph as an
  oscillator driving an `AudioParam`.
- **Silence is the default state of a document.** The hero is readable with the sound
  off, and the toggle is a small plate in the nav (`SoundToggle`), not a splash.

---

## 7. Asset provenance rules

1. **No stock photography of people.** There is no portrait, and none is implied.
2. **No invented logos, certifications, employers or testimonials.** Nothing on this
   site claims a relationship that does not exist.
3. **No hand-authored illustration.** Every mark on the page is geometric: CSS rules,
   CSS-drawn crosses and scale ticks, or GLSL point sprites (station cross, service
   square, control ring, packet). The grain is a generated `feTurbulence` tile.
4. **Network facts are derived, not decorated.** Node names (`pve1`, `pve3`), the edge
   stack (OPNsense + WireGuard), the backup tier (PBS + offsite) and the production VLAN
   reference (`10.1.20.x`) come from the operator's real setup. Only **private**
   addressing is shown; no public host, no credential, no internal hostname.
5. **No number without a source.** If a metric cannot be verified, it is written as
   prose or omitted. The hero's four readings are facts, not statistics.
6. **Bilingual copy is written twice.** French is not a translation of English — same
   meaning, idiomatic in both, with French punctuation (non-breaking space before `;`).

---

## 8. Scope of this pass

> Paths in this section are the ones of the pass that built them (v1). The current tree
> is `ARCHITECTURE.md`; the files moved in v7, the roles did not.

**Built here**

| File | Role |
| --- | --- |
| `DESIGN.md` | this document |
| `src/styles/tokens.css` | colour, type, space, motion, layers |
| `src/styles/base.css` | reset, page type, focus, selection, scrollbar, Lenis interplay, `.on-deep`, reduced motion |
| `src/components/hero/Hero.tsx` | hero composition + the single intro timeline |
| `src/components/hero/HeroScene.tsx` | the WebGL survey (shaders, topology, lifecycle) |
| `src/components/hero/hero.css` | sheet, plot, type block, collar |
| `src/components/nav/NavBar.tsx` + `nav.css` | fixed bar, section observer, EN/FR, `SoundToggle` slot, non-takeover index panel |
| `src/components/ui/SplitText.tsx` | accessible word split (full string preserved for AT) |
| `src/components/ui/MagneticButton.tsx` | pointer-additive CTA, disabled on coarse pointers / reduced motion |
| `src/components/ui/Cursor.tsx` | survey reticle, difference-blended, desktop only |
| `src/components/ui/Grain.tsx` | plotter-sheet tooth |
| `src/components/ui/ui.css` | the four primitives above |
| `src/content/hero.ts` | bilingual hero copy, typed `Bi<HeroCopy>` |
| `index.html` | title, description, OG/Twitter, theme-color, fonts, `lang` |

**Wiring left to the orchestrator:** `App.tsx` must render `<NavBar />`, `<Hero />`,
`<Cursor />` and `<Grain />` inside `<main id="top">`; `tokens.css` and `base.css` are
already imported by `main.tsx`.

**Deliberately dropped**

- The giant outlined grid reference behind the handle. At large sizes it was cropped by
  the nav and competed with the plot; it now sits in the sheet's margin, at annotation
  scale, where a real map puts it.
- The two-column hero (claim left, note right). The note sat on top of the drawing.
  Claim and note share one column so the right half belongs to the map.
- Section numbering and any "01/02/03" device. Places are named.
- `og:image`: there is no asset yet. A tag pointing at a missing file is worse than no
  tag. It is a follow-up, together with the favicon (still the Vite default).

**Known gaps**

- `CONTACT_EMAIL` must be supplied by the owner before the contact section is written.
- The favicon in `public/` is still the scaffold default; it needs a real mark.
- **Mobile is composed, not degraded.** Below 900px the hero plot is rebuilt for a portrait
band (8 stations, larger marks, brighter ink, horizontal touch drag, `touch-action: pan-y`),
`#territory` mounts its own compact schema (three plans, 8 marks, tap to read a chain, ±20°
drag orbit, no projected labels), `#ranges` becomes a native scroll-snap deck at 84vw with a
16vw peek and a `01/06` counter, the printed grid keeps its three bays at a lower alpha, the
instrument chrome becomes two readings at the foot of the page, and `#path` grows an inked
spine that draws with scroll. Tap targets are ≥44px, `100dvh` and safe-area insets are honoured.

---

## 9. V2 addenda (still the same sheet)

**Boot.** A ground plate is ruled before the page is drawn: graticule wipes in, handle rises,
a scale is drawn with three mono ticks. Progress comes from three real signals (bundle
committed, `document.fonts.ready`, the hero's first WebGL frame via `data-scene="live"`), it
never passes 0.92s, and the plate lifts on a transform wipe. Skipped entirely on return visits
(`sessionStorage`) and under reduced motion. Handoff event: `sheet:ready` (`src/components/boot/handoff.ts`).

**Motion system.** `src/lib/reveal.ts` owns the section rig: a registration tick drawn along
the section's top rule, a mono coordinate (`data-rig-coord`) printing the section's real
`scrollY`, and word-level heading reveals (`SplitText`, accessible name preserved). `#ranges`
pins and traverses horizontally above 900px with a fine pointer; below that and on touch it
stays a vertical register. `ScrollProgress` is the sheet's scale at the right gutter — a gauge,
not navigation.

**Territory is now a schema, not a plate.** Three hairline plans stack EDGE → FABRIC → SERVICES;
one request enters from above, crosses the crimson control point, is forwarded by `caddy` and
lands on a service. 12 stations and 22 links, every one traceable to `homelab/content/architecture`
or the reverse-proxy config. The model is the placement table's, not a tidy diagram: `pve1` (infra,
2× E5-2450v2, 64 GB) and `pve3` (compute, 2× Silver 4208, ~172 GB) are the only two nodes, and
**every other mark is a guest** — `opnsense` included, which is why the firewall, `caddy`,
`warpgate` and `authentik` all hang off `pve3` on a quiet tie. `wireguard` is not a mark: it is
`wg0`, udp/51920, on the firewall. `pbs` is LXC 578 on `pve3` and the target of both nodes, on the
dashed branch that leaves the sheet. Strata are roles; the tie is the chassis. Hover prints the
walk in words *and* the node the mark hangs from (`… → nextcloud · on pve1`); hovering a node
prints the `vmbr1` trunk and how much of the sheet it carries, and lights every guest at once —
which is the whole argument of the section. Tier names are buttons that frame one plan. The stack
turns on Y with the section's own progress (two ScrollTriggers: entry for the separation, the whole
pass for the turn), eased, composed with the ±22°/±14° drag rather than fighting it. Drawn with
3 draw calls (lines + points, no triangles), DOM labels, reduced motion renders one static frame
with no turn, no WebGL falls back to the SVG plate — itself built from the same data, so it cannot
drift. The DOM register below carries the same inventory as text.

Counts are re-surveyed from the config and stated as *routes*: **39 published, 28 internal** (one file = one route).

**CV chapter.** `#path` is a pinned horizontal traverse of dated steps (oldest first, the
open year last) and `#skills` is a ledger: a sticky margin rail of seven domains, each with an
honest qualifier (`in production` / `in a lab` / `coursework`), its instruments and one proof
pointer. Facts come from `FACTS.md`; nothing is asserted that the audit could not source.

**Known gaps.** No platform handles (THM/HTB/Root-Me/PortSwigger) are documented, so the ranges
chapter names practice without ranks; no certifications exist and none are claimed.

**Motion pass v3 — the grammar of the genre, transcribed.** Four devices, all derived from
measurements the sheet already had:

- **One curve, one table.** `MOTION` in `src/lib/reveal.ts`: duration 0.9, `cubic-bezier(.16,1,.3,1)`,
  stagger 0.05, travel 100%. Reveals are *reversible* (`toggleActions: play/reverse`) and snap to the
  geometry-asked state on refresh, so a font swap or a language switch can never leave a heading masked.
- **Char rollover.** `Rollover` splits a label into two lines of characters and drives the pair from an
  integrated hover ratio (±2/s), reverting from wherever the pointer left. The accessible name lives once,
  in `.sr-only`; the rolling copies are `aria-hidden`. Plain pointer/touch get a drawn rule instead.
- **Instrument chrome.** A margin column at mid-height, three labelled readings (`paris` clock,
  `plate 0n/08`, `sheet 0nn%`), derived from the nav's `aria-current` and one ScrollTrigger — never a
  second copy of the section list. It flips to deep ink over the band; below 900px it becomes
  two readings (`plate`, `sheet`) at 10px in the bottom-left gutter, printed over the sheet and
  suppressed while the cover or the ink band owns that edge.
- **Printed grid.** `SheetGrid` draws the 12 column boundaries on the content measure (0.00px error at
  1440/1280/1024), reformatting to 6 bays, then 3 bays on a phone at 22% alpha, and tinting for
  the ink band.

**Velocity is a material.** Above the lens bend, damped scroll speed now coarsens the plate itself:
the Bayer cell grows 1×→3×, hairlines thicken and tear into dots, then the fine print returns in ~350ms.
Denser, never darker: the text-column worst pixel stays at 12/255.

**Passage (`#flight`) — the descent.** Between the map and the ink chapter: a 320vh track
(220vh on a phone) with a sticky plate, a single instanced field of 60 mono plates (24 on
coarse pointers) recycled in six generations both ways, drawn in one call. Each plate is a
runtime atlas cell (40 labels drawn once from `--font-mono`, no asset); distance is
**coverage, never alpha** — an 8×8 Bayer discard eats far plates into the same dots the
atmosphere uses. The cartouche is type on the sheet with a measured clear-box handed to the
shader, so the field parts around the words instead of printing under them. At 86% the plate
turns `--deep`, the ink lerps and `#ranges` takes over with no light seam; the type flips in
one frame at the luminance crossover (3.7:1 is the geometric maximum there — a cross-fade
would dip to 1.1:1).

**Ground alternation.** The ink band is no longer the only dark surface: `#flight` turns dark
inside its own track, and the deep palette has been shifted green (`--deep #07160f`,
`--deep-2 #0e2419`, `--deep-ink #dbe7dd`, `--deep-ink-2 #93ab9b`) so both chapters read as the
same material. The light sheet is unchanged.

**v4 — three new plates, and the page becomes eleven.**

- **`#relief`** — the terrain the network stands on: a seeded height field cut into 20 contour
  levels, each drawn top and bottom with a stitch every fourth vertex (a contour model in card),
  17k line segments, one draw call, ~0.3ms of JS per frame. Far lines break into the same 8×8
  Bayer screen as the atmosphere; one crimson survey pin at the summit, Toulouse's real coordinate
  beside it. Turns 40° across its pass, tilts ±6° with the pointer.
- **`#ascii`** — the same schematic printed as characters: 110×64 cells, 12 punctuation glyphs
  chosen by *direction* (not luminance), 422 inked cells, one instanced draw. The `<pre>` fallback
  is composed from the same matrix, so the text and the canvas can never disagree.
- **`#request`** — the chapter plate before contact: the ask, set at plate scale on ink, with a
  measure that draws and one `clip-path` step out. No button.
- **Type as material** — Archivo's width axis now settles headings 112→104 after the mask lands,
  lifts links to 106 on hover and breathes the handle ±2 above 900px only.
- **Sound as a place** — four rooms (paper, machine, ink, air) crossfaded at 0.8s as you move
  between plates, a brush on every plate change, tier-pitched node cues in the territory, the air
  bed's band following the passage's depth, and the room tone's cutoff following scroll velocity.
  Still off by default, still gesture-gated, still zero audio files.

---

## 10. V5 — the sheet gets a body of work

**This section supersedes the page structure of §3, the section sequence of §4, the
hero of §5.1, and the "built here" table of §8.** §1 (thesis), §2 (tokens), §6 (sound)
and §7 (provenance) still hold word for word. The sheet did not change; what is printed
on it did.

### What was wrong

V1–V4 were a survey of the lab with a CV in the margin. Eleven chapters, and five of
them — `relief`, `ascii`, `interlude`, `request`, `ranges` — carried no payload a reader
could use. The work itself was six one-line entries under `services`. A recruiter could
admire the drawing and still not know what had been built. The owner's verdict was
exact: the form was right, the content was not a portfolio.

### What the pass keeps, because it is the identity

- **The territory schema** (`#territory`) — the one interactive 3D drawing, unchanged:
  two chassis, every other mark a guest, the request walking edge → fabric → services.
- **The passage** (`#flight`) — the camera descent through the plate labels, the same
  instanced field, the same Bayer dissolve into ink. It is now the door to the operator
  chapter instead of the training one.
- **The horizontal traverse** — moved from `#ranges` to `#work`, same grammar: one pin,
  one timeline, a progress rule, a mono plate counter, no scroll hijack.
- **The ground alternation** — light sheet, the passage turning `--deep` inside its own
  track, the operator chapter on ink, contact returning to the sheet.
- Tokens, the two families, the graticule, the grain, the boot plate, the instrument
  chrome, the survey reticle, the four sound rooms. None of it was touched.

### What it drops

The hero survey plot (the first interactive schema — it was a second territory drawn at
a smaller size, competing with the real one 1 200 px below and unreadable at rest);
`#relief`, `#ascii`, `#interlude`, `#request`; `#ranges` as a chapter (its evidence is the
writeups, which now have `/notes`); `#path` and `#skills` as chapters (folded into
`#operator` and `/about`); `#services` as one-liners (it became the register).

### The reading order

```
/          cover → selected work → territory → passage → operator → contact   (6 plates)
/work      the register — 20 projects in 4 domains, one row each
/work/:slug  one file per project
/notes     the writing — 16 posts and writeups, linked to the blog
/about     the record, five domains of practice, and what is not here
*          a 404 that is not a dead end
```

Nav is five items (`Work · Territory · Notes · About · Contact`) plus the language
switch and the sound plate. Two are anchors on the home sheet, three are routes; every
anchor works from any route.

### The cover is type, not a diagram

The four bands at the foot of the cover — edge, fabric, services, backup — are a
*section*, the drawing an architect prints when a plan is not enough: four hairlines,
one reading each (`one door`, `2 nodes`, `45 documented`, `restored 09/2026`). It is
DOM, so it cannot fail, cannot blank on a lost WebGL context, and costs no frame. The
handle rises out of its mask, the claim prints word by word, the rules draw left to
right; then nothing moves. The first 3D moment on the site is now the territory, which
is the one that earns it.

Removing the canvas also removed the hero's `data-scene="live"` handshake: the boot
plate now releases on the bundle plus `document.fonts.ready`, still capped at 0.92 s.

### The traverse, the register, the file

- **`#work`** — six plates: the five featured projects in register order plus a closing
  plate that states the count and hands over to `/work`. 62 vw plate, 24 vw peek, one
  ScrollTrigger with `scrub`, the pin on an inner element so `#work` keeps the position
  the document gave it. Under 900 px, on a coarse pointer, or under reduced motion it is
  a vertical stack at every width — the same six records, no pin, no translate.
- **`/work`** — the register, grouped by domain (infrastructure, security, software,
  experiments). One row per project: name, claim, stack, status, year; the row is the
  link. The foot note says what "private" means, because half of what he runs is behind
  SSO and a dead link would be a lie.
- **`/work/:slug`** — the file: claim, what it is, what he did (three verbs), the meta
  rail (state, year, access, stack), the links that actually resolve, and previous/next
  in register order. Unknown slug renders the missing-file copy, not a blank page.
- **The seal** — a 7 × 7 station lattice with a self-avoiding ink trace of 14–18
  stations and exactly one crimson mark, seeded by FNV-1a over the slug. Same slug, same
  mark, on the traverse and on the file: the project's own coordinate, not a logo.

### Routing

A 60-line history router (`src/lib/router.tsx`): `pushState`, `popstate`, real `<a href>`
so middle-click and copy-link keep working, one 220 ms rule wipe between plates, scroll
to top on navigation, hash targets resolved after mount. No router dependency — the site
has five static routes and nginx already falls back to `index.html`.

### Copy doctrine, tightened

Every string lives in `src/content/*.ts` as a `{ en, fr }` pair; French is written, not
translated (`fr()` sets the non-breaking spaces once, at authoring time). Facts only: no
certification, no platform rank, no user count, no employer, no diploma claimed, no
availability date. The one ask the owner states himself — an alternance in a SOC or on
the offensive side — is the only request on the sheet. The class-delegate line was
removed on his instruction: it was the exact "LinkedIn suceur" register the design is
supposed to refuse.

### Counts

6 home plates · 5 nav items · 20 project files · 4 domains · 16 notes · 24 URLs in
`sitemap.xml` · 4 sound rooms · 1 canvas above the fold (none) · 2 canvases in the whole
site (territory, passage).

---

## 11. The acceptance bar, applied (v7)

This pass runs the site against `build-awwwards-quality-sites` — the installed skill the
project was briefed with — as an **acceptance bar, never a claim**. Nothing on this site
says "award"; nothing is borrowed from a reference.

### The direction, in the skill's own terms

| Field | Decision |
| --- | --- |
| Visual thesis | A printed survey sheet, imperfectly registered: pale land tint, drafting ink, one crimson control mark, letterpress vocabulary instead of "cyber" costume |
| Hero focal asset | **None.** The cover is the handle, the claim, four readings and a drawn section — geometry the browser draws, not a stock photograph of a network |
| Type hierarchy | Archivo (variable width 75–115, weight 300–700) for everything read; Spline Sans Mono for measurements only; six fluid steps |
| Colour | Six surfaces and inks, one accent (`#BF1F34`), no gradient, no shadow, no glass |
| Section sequence | cover → selected work → territory → passage → operator → contact |
| Motion narrative | plate ruled (boot) → type printed, plate pulls into register → one pinned traverse → schema turns, then dives → descent into ink → still chapter → the ask |
| Smooth scroll | Lenis, only engine, connected to ScrollTrigger, destroyed on teardown |
| Three.js | **Two scenes, each with one job**: the territory (spatial reading of a real network) and the passage (a depth transition between chapters). No ornamental canvas |
| Asset provenance | No photograph, no generated person, no logo wall, no icon library. Every mark is a hairline, a dot lattice, or a glyph drawn by the shader; the project seals are generated from the slug (FNV-1a + self-avoiding walk) |
| Build box | `code` (CT 119) — opencode `orchestrator` writes the code, Hermes writes the copy and holds the bar |

### Validation performed

- `pnpm lint` 0 error · `pnpm build` exit 0 · `pnpm typecheck` exit 0.
- Seven routes (`/`, `/work`, `/work/:slug`, `/practice`, `/notes`, `/about`, 404) and
  all twenty project files render with the expected `h1`, title and description.
- 390 / 768 / 1440: `scrollWidth ≤ innerWidth + 1` everywhere; no clipped type.
- Console clean on every route and across repeated navigations.
- Keyboard: thirty focus stops, visible ring on each, tab order follows reading order,
  the mobile panel closes on Escape and traps nothing.
- `prefers-reduced-motion: reduce`: no boot plate, no pin, no traverse translate, no
  loupe, no reprint, no dive, no hover lift — final states only, and the ghost plate is
  frozen at its 1 px misregistration.
- **No JavaScript**: a `<noscript>` sheet carries the claim, the four readings and the
  three addresses in the same ink, with no font request. The rest of the site is a
  client-rendered application, and that is stated below rather than hidden.
- One smooth-scroll engine, one pointer rAF, two WebGL contexts maximum, both paused
  offscreen and on `visibilitychange`, DPR capped at 2.

### Deliberate deviations, and why

- **No photography, no avatar.** The skill asks for photographs "for every avatar"; the
  operator is not the subject of this site, the network is, and there is no avatar to
  illustrate. A portrait would be a costume.
- **No generated imagery.** The concept *is* a drawing. A generated hero image would be
  a second, weaker language competing with the schema.
- **No icon set.** Four interface symbols exist; three are drawn as rules, and the
  language switch is type.
- **A 380 ms route transition.** Longer than a cut, but it *covers* the swap instead of
  fading through it, and the new content is committed at 80 ms, so nothing is delayed
  beyond the press stroke.
- **A client-rendered site with a static fallback.** No SSG: the fallback is the sheet
  in `<noscript>`, not a prerendered page. If search visibility ever matters more than
  the app, prerendering the five documents is the next step — it is a build change, not
  a design one.


## 12. The sheet is played, not read (v8)

v8 adds nothing to the direction — same paper, same ink, same crimson, same two
faces. It changes **what happens while you read**, because a page of correct copy
that never moves is still a page you skim. Four devices, one per chapter type.

### The instrument

A graticule sphere — 24 meridians, 12 parallels, one tilted orbit, twelve stations,
one crimson node — drawn as a **second scene inside the existing atmosphere
renderer** (`chrome/scene.ts`), so the site still opens two WebGL contexts, not
three. It is a survey instrument, not an ornament: it follows the scroll with a
damped pose (λ ≈ 3/s) through a table of eight positions, one per chapter, and it
flips to `--deep-ink` on the ink chapters. It is never over the reading column on
the cover, it stands down entirely on `#territory` and `#flight` (those chapters
have their own scenes), and under `prefers-reduced-motion` it is still there but
frozen — the object is part of the composition, the spin is the animation.

### The index wall (`#index`)

The register, turned into something you can play with: twenty names in two ruled
columns, each row a file, and **one plate for the whole section** that fills with
the named project and comes to the pointer — a `clip-path` open, a 0.96 → 1 lift,
a 1.5° settle, then a 0.16 damped follow. The plate is drawn from the project's own
data (seal, stack, state, year), never a screenshot: a fake capture of a private
service would be a lie. Keyboard focus gets the same plate, anchored to the margin
instead of the pointer; coarse pointers get a seal per row and tap-to-open. A 44 px
`--chart` gutter marks the chapter, because `--ground-sunk` alone is 4 % darker
than the sheet and does not read as a change of ground.

### The statement (`#statement`)

One sentence, at plate scale, on `--chart`: *"I don't rent my infrastructure. I run
it. Twenty projects, one cluster, eight segments, and a backup I have restored. A
network is not a diagram you draw once — it is a thing you keep alive."* Words rise
out of their masks as the line enters; three devices live inside the text — `strong`
words set wider and rolling on hover, and one `plate` word that keeps its letters and
sits on a printed seal field, which opens into the project's plate on hover. The
word is never replaced by a glyph: a sentence that hides a word is a sentence you
cannot read, and this chapter is the one that asks to be read.

### The bar, and the index overlay

Three controls and one live reading: the mark, `cover · 01/08` (the current chapter,
name and counter, flipped digit by digit), `Index`, `EN/FR`, `Sound`. The five text
links are gone from the collar — they were the panel, printed twice. The `Index`
button opens the sheet turned over: five documents at title size, the eight chapters
with their plate numbers, the twenty files of the register under a printed head, and
the three switches the bar cannot carry (sound, motion, language). It is a real
dialog: `aria-modal`, focus moved in and trapped, `Esc` and an outside press out,
the page behind locked, focus returned to the button that opened it.

### Motion is a preference, and the sheet may only tighten it

`lib/motion.ts` holds two sources: the system query and a switch in the overlay,
stored in `localStorage`. The switch can only *add* restraint — a reader whose system
asks for stillness is never offered motion back. Both the instrument's spin and loupe,
the reprint, the veil and the row rolls read the same predicate, so the whole sheet
answers one answer.

### Validation performed

- `pnpm lint` 0 error · `pnpm typecheck` 0 · `pnpm build` exit 0.
- Eight chapters in the new reading order; 390 / 768 / 1440 with
  `scrollWidth === clientWidth`; console clean through a full scroll and the overlay.
- Waste of the instrument: draw calls ≤ 4 per frame, one RAF, one context; paused
  offscreen and on `visibilitychange`.
- Reduced motion: instrument frozen, plate opens without clip/scale, sentence printed,
  overlay without wipe or stagger.
- The overlay: keyboard-only open/close, `Tab` cycles inside, `Esc` returns focus to
  `Index`, the page behind does not scroll.
- No JavaScript: the `<noscript>` sheet is unchanged and still carries the addresses.

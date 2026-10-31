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
`#ranges` becomes a native scroll-snap deck with a progress ruler, and `#path` grows an inked
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
  second copy of the section list. It flips to deep ink over the band and disappears below 900px.
- **Printed grid.** `SheetGrid` draws the 12 column boundaries on the content measure (0.00px error at
  1440/1280/1024), reformatting to 6 bays then 3 then none, and tinting for the ink band.

**Velocity is a material.** Above the lens bend, damped scroll speed now coarsens the plate itself:
the Bayer cell grows 1×→3×, hairlines thicken and tear into dots, then the fine print returns in ~350ms.
Denser, never darker: the text-column worst pixel stays at 12/255.

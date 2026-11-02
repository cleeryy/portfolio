# Architecture

The map of `src/`. A file is sorted by **what it is**, not by where it is used:
a route is a page, a chapter of the home is a section, a layer pinned over the
document is chrome, a thing you can use twice is a primitive.

```
src/
  App.tsx                 the shell: chrome + routed page
  main.tsx                mount, providers, global stylesheets
  pages/                  ONE FOLDER PER ROUTE, self-contained
    home/Home.tsx
    work/Work.tsx  work.css
    project/Project.tsx  project.css
    practice/Practice.tsx  practice.css
    notes/Notes.tsx  notes.css
    about/About.tsx  about.css
    not-found/NotFound.tsx  not-found.css
  sections/               THE SIX CHAPTERS OF THE HOME, each self-contained
    cover/Cover.tsx  cover.css
    work/SelectedWork.tsx  selected-work.css  Plate.tsx  plate.css
    territory/Territory.tsx  TerritoryScene.tsx  TerritoryPlate.tsx
              TerritoryCompact.tsx  territory.css
    flight/Flight.tsx  FlightScene.tsx  FlightStill.tsx  atlas.ts  curve.ts
              shaders.ts  flight.css
    operator/Operator.tsx  operator.css
    contact/Contact.tsx  contact.css
  chrome/                 FIXED LAYERS, never in the document flow
    NavBar.tsx  nav.css
    InstrumentChrome.tsx  chrome.css  PointerHud.tsx  reading.ts
    BootGate.tsx  boot.css  handoff.ts
    Reprint.tsx  reprint.css
    Atmosphere.tsx  atmosphere.css  scene.ts  shaders.ts  bayer.ts
    SheetGrid.tsx  grid.css
  ui/                     REUSABLE PRIMITIVES (no page, no section)
    Cursor.tsx  Grain.tsx  MagneticButton.tsx  Rollover.tsx  rollover.css
    ScrollProgress.tsx  SoundToggle.tsx  sound.css  SplitText.tsx  ui.css
    Ghost.tsx  ghost.css  ProjectSeal.tsx  seal.css
  content/                ALL COPY, one module per surface
    cover.ts  work.ts  practice.ts  notes.ts  about.ts  contact.ts
    territory.ts  flight.ts  site.ts
  lib/                    LOGIC, NO JSX
    router.tsx  seo.ts  pointer.ts  reveal.ts  scroll.ts  typo.ts  i18n.tsx
    currentSection.ts  veil.ts  reprint.ts
    sound/index.ts  sound/graph.ts  sound/rooms.ts  sound/cues.ts
  styles/
    tokens.css  base.css
```

## Folders

**`pages/`** — one folder per route, named after the route (`/work` is `work/`,
`/nope` is `not-found/`). Belongs: the page component, its `main`, its own
stylesheet, and the sections it composes. Never: a second page, a fixed layer,
a primitive, a copy string.

**`sections/`** — the six chapters of `/`. Belongs: a section, the scene and the
poster it degrades to, the sub-components only it renders (`Plate`,
`TerritoryPlate`, `TerritoryCompact`), its data-shaping helpers (`atlas.ts`,
`curve.ts`, `shaders.ts`), its stylesheet. Never: anything reachable from a
second page, a route, chrome.

**`chrome/`** — fixed layers: `position: fixed`, or a canvas painted under the
reading, or a gate over it. Belongs: nav, instrument margins, pointer readout,
boot gate, plate change, atmosphere, sheet grid. Never: anything in the document
flow, anything that scrolls with the page, a section.

**`ui/`** — primitives, mounted anywhere, aware of nothing. Belongs: a button, a
label rollover, a word splitter, a cursor, grain, the seal. Never: a section, a
copy string, a route, a `querySelector` for a surface it does not render.

**`content/`** — every string the site prints, one module per surface, all
`Bi<…>` pairs consumed through `useLang().pick(...)`. Belongs: copy, links,
project records, navigation labels, page titles. Never: JSX, a selector, a
number that is computed rather than described.

**`lib/`** — logic with no JSX (only `router.tsx` and `i18n.tsx`, which must
ship components). Belongs: routing, metadata, scroll, reveal, pointer, sound,
the one-line handoffs (`reprint.ts`). Never: a visual component, a copy string,
a `className`.

**`styles/`** — `tokens.css` (the only place a raw colour, size or curve is
written) and `base.css` (the reset and the sheet). Never: a component's own
layout, which lives beside the component.

**`App.tsx`** — chrome, then the routed page, then the layers that must sit above
every page. It chooses a page; it does not render one.

## Import direction

`pages → sections → ui`, `pages → chrome`, and everything → `content` / `lib` /
`styles`. Never the reverse: a section does not import a page, chrome does not
import a section, `ui` imports neither. `lib` may import a `chrome` module only
for a shared constant (`veil.ts` takes the dither tile from `chrome/bayer`).

## Where do I add…

| I am adding | It goes in | Then |
| --- | --- | --- |
| a project | `content/work.ts` | the register and `/work/:slug` pick it up; no page to write |
| a route | `pages/<name>/<Name>.tsx` + its css | add the branch in `App.tsx`, the title in `content/site.ts` |
| a chapter of the home | `sections/<name>/` | mount it in `pages/home/Home.tsx`, add its id to `content/site.ts` |
| a fixed layer | `chrome/` | mount it once, in `App.tsx` |
| a button, a label, a split | `ui/` | import it where it is used; it takes copy as a prop |
| a string | the `content/` module of that surface | write both `en` and `fr` |
| a shared behaviour | `lib/` | no JSX unless it has to be a hook |
| a colour, size, easing | `styles/tokens.css` | a component reads the token, never the literal |

`DESIGN.md` says why the sheet looks the way it does. This file says where the
code lives.

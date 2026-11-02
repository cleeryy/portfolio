# BRIEF-V7 — put the code in order

The site works and the design is settled. What is wrong is the **map of the source**:
`src/components/` currently holds route pages, home sections, fixed chrome, WebGL scenes
and reusable primitives in the same folder, with collisions (`work/` is the home
traverse while `register/` and `project/` are the work pages; `hero.ts` is the copy of
`Cover.tsx`; `about/` contains a page and `operator/` a section).

This pass is a **pure refactor**: move files, rename for consistency, fix imports. No
visual change, no behaviour change, no copy change. If you are tempted to "improve" a
component while moving it, don't — the diff must read as renames.

## Target tree (source of truth)

```
src/
  App.tsx                  the shell: chrome + routed page
  main.tsx
  pages/                   ONE FOLDER PER ROUTE, self-contained
    home/Home.tsx
    work/Work.tsx  work.css
    project/Project.tsx  project.css
    practice/Practice.tsx  practice.css
    notes/Notes.tsx  notes.css
    about/About.tsx  about.css
    not-found/NotFound.tsx  not-found.css
  sections/                THE SIX CHAPTERS OF THE HOME, each self-contained
    cover/Cover.tsx  cover.css
    work/SelectedWork.tsx  selected-work.css  Plate.tsx  plate.css
    territory/Territory.tsx  TerritoryScene.tsx  TerritoryPlate.tsx  TerritoryCompact.tsx  territory.css
    flight/Flight.tsx  FlightScene.tsx  FlightStill.tsx  atlas.ts  curve.ts  shaders.ts  flight.css
    operator/Operator.tsx  operator.css
    contact/Contact.tsx  contact.css
  chrome/                  FIXED LAYERS, never in the document flow
    NavBar.tsx  nav.css
    InstrumentChrome.tsx  chrome.css  PointerHud.tsx  reading.ts
    BootGate.tsx  boot.css  handoff.ts
    Reprint.tsx  reprint.css
    Atmosphere.tsx  atmosphere.css  scene.ts  shaders.ts  bayer.ts
    SheetGrid.tsx  grid.css
  ui/                      REUSABLE PRIMITIVES (no page, no section)
    Cursor.tsx  Grain.tsx  MagneticButton.tsx  Rollover.tsx  rollover.css
    ScrollProgress.tsx  SoundToggle.tsx  sound.css  SplitText.tsx  ui.css
    Ghost.tsx  ghost.css  ProjectSeal.tsx  seal.css
  content/                 ALL COPY, one module per surface
    cover.ts (was hero.ts)  work.ts  practice.ts  notes.ts  about.ts  contact.ts  territory.ts  flight.ts  site.ts
  lib/                     LOGIC, NO JSX
    router.tsx  seo.ts  pointer.ts  reveal.ts  scroll.ts  typo.ts  i18n.tsx
    currentSection.ts  veil.ts
    sound/index.ts (was lib/sound.ts)  sound/graph.ts  sound/rooms.ts  sound/cues.ts
  styles/
    tokens.css  base.css
```

## What goes where, file by file

- `components/about/AboutPage.tsx` → `pages/about/About.tsx`; `about-page.css` → `about.css`.
- `components/practice/PracticePage.tsx` → `pages/practice/Practice.tsx`; css renamed.
- `components/notes/NotesPage.tsx` → `pages/notes/Notes.tsx`; css renamed.
- `components/register/Register.tsx` → `pages/work/Work.tsx` (it renders the route `/work`); css renamed `work.css`.
- `components/project/ProjectFile.tsx` → `pages/project/Project.tsx`; css renamed.
- `components/site/NotFound.tsx` → `pages/not-found/NotFound.tsx`; css renamed.
- `components/site/Reprint.tsx` → `chrome/Reprint.tsx` (+ `reprint.css`).
- `components/work/WorkTraverse.tsx` → `sections/work/SelectedWork.tsx` (the home chapter);
  `Plate.tsx`, `plate.css` move with it; `work-traverse.css` → `selected-work.css`.
- `components/cover/*`, `components/operator/*`, `components/contact/*`,
  `components/territory/*`, `components/flight/*` → same names under `sections/`.
- `components/nav/*` → `chrome/NavBar.tsx` + `nav.css`.
- `components/chrome/*` → `chrome/` (same filenames).
- `components/boot/*` → `chrome/` (same filenames).
- `components/atmosphere/*` → `chrome/atmosphere/` (keep `scene.ts`, `shaders.ts`, `bayer.ts` together — it is one WebGL unit) OR `chrome/` flat if you prefer less nesting; pick one and be consistent.
- `components/grid/*` → `chrome/SheetGrid.tsx` + `grid.css`.
- `components/ui/*` → `ui/` (same filenames).
- `components/type/Ghost.tsx` + `ghost.css` → `ui/`.
- `components/seal/*` → `ui/ProjectSeal.tsx` + `seal.css`.
- `content/hero.ts` → `content/cover.ts`, and the exported constant `hero` renamed to `cover` (update its consumers: `Cover.tsx`).
- `lib/sound.ts` → `lib/sound/index.ts` (imports from `'../../lib/sound'` keep resolving; verify).
- `pages/Home.tsx` → `pages/home/Home.tsx`.

## Rules

1. Use `git mv` for every file so history follows. The final `git diff -M --stat` must
   show renames, not delete+add.
2. Update **every** import (relative paths change depth). `tsc -b` is the judge.
3. Keep CSS `@import`s / relative asset URLs working; CSS files move with their owner.
4. No component logic, no class names, no copy, no CSS values change. The only allowed
   code changes are: file paths, import specifiers, the `hero` → `cover` export rename,
   and import ordering if a linter demands it.
5. Barrel files are forbidden: no `index.ts` re-exporting a folder.
6. Naming: a file is named after its default export (`Work.tsx` exports `Work`). One
   exception: `SelectedWork.tsx` may keep its more precise name.
7. `App.tsx` imports pages from `./pages/…`; a page imports its sections from
   `../../sections/…`, chrome from `../../chrome/…`, primitives from `../../ui/…`,
   copy from `../../content/…`, logic from `../../lib/…`.
8. Delete nothing that is still used. If a file is genuinely dead after the move (no
   import anywhere), list it in the report instead of deleting it silently.

## Also in this pass

- Write `ARCHITECTURE.md` at the repo root: the tree above, one line per folder saying
  what belongs there and what never does, and a short "where do I add…" table (a new
  project? `content/work.ts`; a new route? `pages/<name>/`; a new home chapter?
  `sections/<name>/`; a new fixed layer? `chrome/`; a new button? `ui/`). Keep it under
  120 lines, no marketing.
- Add a `README.md` line pointing to `ARCHITECTURE.md`.
- Add to `package.json` a `typecheck` script (`tsc -b --noEmit` or the equivalent that
  works with this tsconfig) and use it in the report.

## Acceptance

- `pnpm lint` 0 error, `pnpm build` exit 0, `pnpm typecheck` exit 0.
- `find src -type f | sort` matches the tree above (no `components/` left).
- Every route still renders: `/`, `/work`, `/work/lab`, `/practice`, `/notes`, `/about`,
  `/nope` — same `h1`, same title, no console error.
- Screenshots before/after the refactor at 1440 for `/` and `/work` must be pixel-equal
  apart from the atmosphere drift. If they are not, something changed that should not
  have — find it.
- Commit in conventional commits (`refactor(pages): …`, `refactor(sections): …`,
  `refactor(chrome): …`, `docs(architecture): …`). Do not push, do not merge.

REPORT: the rename table (old → new), any file listed as dead, the before/after
screenshot comparison result, and the three commands' output.

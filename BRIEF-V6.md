# BRIEF-V6 — the sheet is printed, and you can see it

V5 fixed the information architecture. This pass does not touch the structure: it
gives the site **one specific graphic signature** that a visitor remembers, and it
adds the security content the owner needs for an alternance in Toulouse.

The identity to push, because it is already the site's own: **a printed survey
sheet, imperfectly registered.** Not "more effects" — a print shop's vocabulary,
used precisely, everywhere.

Three devices, one grammar:

1. **The loupe** — under the pointer the sheet's printed screen becomes visible: the
   Bayer cell grows, the contours break into dots, and the ink slips out of
   registration by a hair. It reads as a printer's magnifier crossing the page.
2. **The misprint** — the big type carries a crimson ghost plate, offset by the
   pointer and by scroll velocity, snapping back to register at rest. No blur, no
   glow: a solid second impression, in `--mark`, multiplied.
3. **The reprint** — a route change is a new plate pulled off the press: the old
   page dithered out through the same 8×8 screen, the new one stamped in with its
   ghost sliding into register.

Plus one 3D continuity: **the dive** — the territory does not end, it descends. The
camera falls through the fabric into the passage, so the map and the tunnel are one
movement instead of two sections.

Rules that do not move: tokens only, one smooth-scroll engine, one shared rAF for
pointer work, DPR capped, reduced motion renders the registered state, no second
WebGL context, no dependency.

---

## 1. One pointer loop (`src/lib/pointer.ts`)

There are now three consumers of the pointer (atmosphere loupe, type ghost, magnetic
buttons). Create one module:

```ts
export type PointerState = { x: number; y: number; vx: number; vy: number; inside: boolean }
export function usePointerFrame(cb: (p: PointerState) => void): void
```

- One `pointermove` listener on `window` (passive), one rAF that runs **only while
  the pointer has moved in the last 400 ms or the value is still settling**, then
  stops. No idle loop.
- Values in CSS pixels; `vx/vy` are damped deltas per frame (0.18 factor).
- `inside` is false until the first move and after `pointerleave`.
- Coarse pointers (no hover) never start the loop.
- Expose the current state synchronously as `getPointer()` for the atmosphere scene,
  which is already on its own frame loop.

`MagneticButton` and the cursor may stay as they are; do not refactor them.

## 2. The loupe (atmosphere shader)

`src/components/atmosphere/shaders.ts` / `scene.ts`. Add three uniforms:

- `uLens` (vec2, pointer in UV, 0..1)
- `uLensR` (float, radius in UV, default 0.085)
- `uLensOn` (float 0..1, eased: 0 → 1 over ~260 ms on enter, back to 0 on leave)

In the fragment, after the existing colour is computed:

- `d = length((vUv - uLens) * vec2(uAspect, 1.0))`
- `ring = smoothstep(uLensR, uLensR * 0.72, d)` (1 at the centre, 0 outside)
- Grow the ordered-screen cell inside the ring: add `ring * 2.0` to the existing
  coarsening term (max 3 device px), **do not change the ink's darkness** — the
  sheet gets coarser, never darker. Keep the existing `uBudget` cap.
- Misregistration: sample the contour field at `vUv + vec2(0.0016, 0.0007) * ring`
  for one of the two contour passes, so the line doubles inside the loupe. At the
  loupe's rim, tint the doubled line with `uMark` at 35% — one ring of crimson
  where the glass edge passes, nothing inside.
- The loupe must be invisible at `uLensOn = 0` and must not move the type's
  contrast (the `uBudget` guard already protects the reading column; keep it).

Add `uMark` (vec3) if it is not already a uniform. Drive the uniforms from the
existing frame loop, reading `getPointer()`; damp `uLensOn` and the UV position
(λ ≈ 0.18) so the loupe glides.

Reduced motion: `uLensOn` stays 0.

## 3. The misprint (big type)

New component `src/components/type/Ghost.tsx` (+ `ghost.css`):

```tsx
<Ghost text="cleeryy" className="cover__handle" as="h1" />
```

It renders the string twice: the ink copy (normal flow, the accessible name) and an
`aria-hidden` copy in `--mark`, absolutely positioned exactly over it with
`mix-blend-mode: multiply`, `pointer-events: none`. The ghost is offset by two CSS
custom properties set on the wrapper:

- at rest `--reg-x: 0px; --reg-y: 0px` (perfect register);
- driven by pointer: `x = clamp(p.x - w/2, -1, 1) * 6`, `y = clamp(p.y - h/2, -1, 1) * 4`;
- plus scroll velocity: `y += clamp(vy, -14, 14) * 0.9`, applied with a 90 ms lag.

Use it on: the cover handle, the `h1` of `/work`, `/notes`, `/about`, and a project
file's name. Not on section titles, not on body.

Keep the existing SplitText intro working: the ghost must appear only when the ink
copy has landed (fade in 120 ms after the intro, or be present in the final state
under reduced motion). Under reduced motion the ghost exists but never moves and is
offset by exactly 1px at `--mark` — a printed misregistration, not a zero-opacity
copy (it must still read as a deliberate mark).

Performance: transform only, `will-change: transform` on the ghost, no layout.

## 4. The reprint (route transition)

`src/components/site/RouteRule.tsx` currently draws one hairline. Replace it with
`src/components/site/Reprint.tsx`:

- A fixed, full-viewport canvas (one, mounted once, `pointer-events: none`, z below
  the nav and above the page), **created lazily on the first internal navigation**.
- On navigation: draw the *outgoing* page as a dithered dissolve is impossible
  without a screenshot — so do not fake one. Instead draw the **new plate being
  pulled**: a 380 ms sequence in which an 8×8 Bayer screen at 3 device px sweeps
  left→right (a hard edge, no gradient), the outgoing page is dimmed to `--ground`
  with a `clip-path` wedge, and one 2px crimson registration line runs along the
  sweep. It must read as a press stroke, not a fade.
- Sequence: 0–80 ms the sweep enters from the left at 0 width; 80–300 ms it crosses;
  300–380 ms it exits right; the canvas clears and stops.
- If the reduced-motion query matches, do not mount the canvas at all — the existing
  instant cut stays.
- The route content must be committed at t=80 ms (so the sweep covers the swap), and
  `window.scrollTo` happens before the sweep starts.

Keep it under 30 KB of code, no images, no external shader.

## 5. The dive (territory → passage)

This is the 3D continuity, and it is the riskiest item — implement it defensively.

In `TerritoryScene.tsx`, the section already turns the stack on Y across its pass.
Add a final phase on the **last 12%** of the section's own ScrollTrigger:

- `camera.position` lerps toward `(0, 0.4, 2.2)` in stack space (a point inside the
  fabric plan, between `pve1` and `pve3`), `camera.fov` 42 → 68, and the stack's
  `group.scale` grows 1 → 1.35 so the near planes pass the camera.
- The line material gains a `uStretch` uniform: link vertices' Z is multiplied by
  `1 + 1.2 * dive`, so the drawing elongates into a corridor — the same geometry
  becomes the passage.
- At `dive > 0.8`, the section's DOM (title, lead, register) fades to 0 and
  `pointer-events: none`.
- If `prefers-reduced-motion`, skip the dive entirely (final state, no camera move).
- If the WebGL context is lost or unavailable, the SVG poster stays and the section
  ends normally.

If any part of this cannot be done without breaking the existing labels/legibility,
**do the camera move only** (no vertex stretch) and report it. A subtle dive is
better than a broken schema.

## 6. Cyber content — `/practice` (the only content addition)

The owner is looking for an alternance in cybersecurity in Toulouse. The site is
already honest about what he has; it now needs one page that shows the offensive
work as a record, without dressing it up.

New content module `src/content/practice.ts` (bilingual, same `fr()` helper):

```ts
export type RangeEntry = {
  id: string
  name: string            // 'THCon 2025 — neoprivesc'
  kind: Bi                // 'ctf' | 'writeup'
  year: string
  technique: Bi           // one line: what the challenge actually required
  href: string            // the blog writeup (already verified)
}
export const ranges: RangeEntry[]  // THCon + the 7 Hack The Box writeups
export const practiceCopy: Bi<{ title, lead, rangesLabel, rangesLead, toolsLabel, toolsLead, tools: {label: Bi, items: string[]}[], ask: Bi }>
```

The seven entries, exactly (from `src/content/notes.ts`, do not invent):
neoprivesc (THCon 2025, misc, sudo/NixOS), lemon industries (SSTI, WordPress/CVE-2024-6386),
notesy (stored XSS + Selenium bot), scrapeware (SSRF → Redis → pickle → RCE),
bankflip (AES-CBC bit-flipping), threekeys (ELF + three AES keys), monkey (PowerShell
dropper + .NET + pcap), one more round (Solidity reentrancy). That is eight entries
(1 CTF + 7 writeups).

`technique` is one line, factual, taken from the writeup subject. No score, no rank,
no platform handle.

Tools: four lists, only what is documented in FACTS: web (nmap, ffuf, gobuster,
sqlmap, nikto, whatweb, wafw00f, Burp absent), crypto (pycryptodome, XOR, bit-flipping),
reverse/forensic (Ghidra? absent → strings, apktool, jadx, pcap analysis),
systems (sudo, NixOS, Windows privilege escalation).

Page `/practice`:
- header: title, lead, count (`8 entries`);
- the ranges as a register (same row grammar as `/notes`): year, kind, name,
  technique, external link;
- the tools as four blocks (label + mono list);
- the ask: one paragraph, first person, stating the alternance in a SOC or on the
  offensive side, Toulouse — and what he brings, no adjective;
- a link back to `/work` and `/notes`.

Wire it: route `/practice`, nav item? **No** — the nav stays at five. Link it from
`/about` (a row in the honesty block or after `practice`) and from `/notes` (a foot
line), and add it to `public/sitemap.xml` (25 URLs now).

Home addition — one line only, in the cover's action row, in mono with a crimson
square: `hero.ask` = "alternance — SOC or offensive, Toulouse" / "alternance — SOC
ou offensive, Toulouse". It replaces nothing; it sits after the two CTAs.

## 7. Acceptance

- `pnpm lint` + `pnpm build` exit 0, no new dependency, no second WebGL context.
- Loupe: invisible at rest, follows the pointer with damping, gone on `pointerleave`
  and on touch devices; `uBudget` still protects the reading column (no text below
  ~12/255 contrast).
- Ghost: at rest the crimson copy is exactly behind the ink (0 px) — a screenshot at
  rest must show no visible duplication. On move it separates ≤6 px.
- Reprint: 380 ms, no layout shift, no white flash, absent under reduced motion, and
  a deep link (`/work/lab` typed) still lands directly with no sweep.
- Dive: 60 fps on the section (measure), labels still legible before it starts,
  reduced motion → no dive.
- `/practice` renders 8 rows, all links resolve, `document.title` set.
- No horizontal overflow at 390/1440 on all routes; console clean.
- Commit on branch `v6` (branch off `main`), push nothing.

# BRIEF-V10 — the reference pass

Five sites were studied for this pass, at 1440×900 and 390×844, with their shipped
source read where the browser could reach it:

- `contentarchitecture.dev` — Next 16, Sanity, Lenis, Motion; one canvas for the
  plotted spiral, a 2,700px sticky dive, 520px torn seams, and the `ESTIMATE`
  slip with dashed trim, dot leaders and a solid total row.
- `fineacts.co` — WordPress, GSAP 3.14 + ScrollTrigger + SplitText + Lottie; a
  wordmark assembled from flying letters, hard full-bleed colour bands, 300px
  section words, and a footer wordmark cropped by the viewport.
- `grids03.obys.agency` — Vite, GSAP, Lenis and OGL; 403 to the browser, so the
  Wayback capture and the parent `grids.obys.agency` were used. The useful idea
  is the grid inspector toggle, not the page itself.
- `macmillan.studio` — Nuxt, GSAP 3.15, three r154; a custom wheel chaptering,
  a dithered WebGL plate, a ticket-shaped project card that slides out/in
  vertically, and a black/acid-green contact chapter that reads as a till receipt.
- `andreas.vision` — React 19 + Vite, no GSAP; a white sheet inside a blue
  halftone field, a boot that prints word by word, and a sticky circle that
  becomes a map as the page scrolls. The circle is driven by CSS scalars, so the
  DOM labels and the canvas never drift.

The rule for the pass: take the **mechanic**, not the skin. This sheet already has
its own ground, grid, instrument and print language; the references had to be
translated into that language or left alone.

## What was taken, and where it landed

1. **The boot opens through the ring** — `chrome/BootGate.tsx`, `boot.css`.
   The plate is no longer translated off the page. A radial mask cuts a hole from
   the instrument's first route pose (`x .76`, `y .42`, the same pose as
   `scene.ts`), and the radius is measured to the furthest viewport corner at
   lift. The page is seen through the ring that will live on it. The old
   bottom-edge wipe remains as the fallback for an engine that cannot mask.
   No new renderer, listener or tween owner.

2. **The closing docket** — `sections/contact/Contact.tsx`, `contact.css`,
   `content/contact.ts`, `lib/reveal.ts`.
   A printed manifest after the three-address ledger: dashed trim, solid head
   rule, six rows with printed dot leaders (`chapters 08`, `plates 06`,
   `records 20`, `nodes 02`, `services 45`, `routes 66`), one solid ink total
   (`the ask / one letter`), a `FILED` stamp and a barcode strip. The numbers are
   derived from `projects`, `featured` and the cover readouts — the slip cannot
   drift from the register. It is printed down out of a clip by a new
   `[data-reveal-print]` branch in `initSectionRig`, using the existing `attach`
   helper; a deep link that lands with the slip in frame prints it immediately.

3. **The chapter watermark** — `sections/operator/Operator.tsx`, `operator.css`.
   The dark chapter now prints its own noun, `operator`, at `--step-6` behind the
   reading at 5% deep ink. Static, cropped by the section edge, below the
   content in the stacking order. No motion: the title reveal is the entrance.

4. **The plate becomes a ticket** — `sections/shared/PlatePop.tsx`,
   `plate-pop.css`.
   The floating project plate gains a tear-off foot: dashed perforation, a
   dotted rule, `PLATE 03` / `cleeryy.cloud`, and a barcode built from one
   repeating gradient. The existing clip pull/lift still opens it from the foot.
   On a landscape phone the seal steps down and the stub stands down so the
   plate fits the frame.

5. **The passage is torn, not cut** — `sections/flight/Flight.tsx`,
   `flight.css`, `chrome/bayer.ts`.
   A 6rem band of the same 8×8 Bayer screen as the veil sits at the top of the
   sticky passage and dissolves by the hand-off's midpoint. It is driven by the
   existing scrub: `paint()` writes one quantised opacity (max 0.55), not a CSS
   variable on the whole subtree. It is absent under reduced motion and on the
   still fallback.

6. **The footer bookend** — `sections/contact/Contact.tsx`, `contact.css`.
   The sheet ends on its own name at plate scale, at 5.5% ink, cropped by the
   footer's bottom edge. Absolute, decorative, behind the colophon; the footer
   clips so it can never add scroll width.

## What was deliberately not taken

- **The full-screen colour cycling** on fineacts (flash and contrast risk, no
  reduced-motion story). The sheet's ground changes are already hard cuts with
  a printed veil; that is the same idea with a floor.
- **The fixed 900px chapter stage** on macmillan (kills native scroll, back and
  find-in-page). The sheet keeps the document as the scroll.
- **The grid inspector** from obys. A keydown and a global class for a dev
  affordance the site already prints in `grid.css`.
- **A static ragged edge on every `data-ground` band.** The hard cut is the
  site's own device and the veil already owns every boundary; a permanent mask
  on the two heaviest bands would be noise.
- **A second canvas / renderer / RAF.** Every effect above is DOM, CSS or the
  existing GSAP ticker. The atmosphere still owns one renderer, one fullscreen
  triangle and one ticker.

## Verification

- `pnpm typecheck` — clean.
- `pnpm lint` — clean; five pre-existing `react/only-export-components` warnings.
- `pnpm build` — clean; the existing >500kB chunk warning remains.
- Rendered checks: boot plate and mask at 0px / 400px / 1200px, desktop and
  390px contact docket, footer bookend, operator watermark, index plate ticket,
  flight seam at the pin and mid-passage, and the reduced-motion contact page.
- One real defect found and fixed during verification: a restored deep link to
  `#contact` on a phone leaves the docket already in frame, and a ScrollTrigger
  created already active does not fire `onEnter` for a paused tween. The print
  branch now snaps the tween when the slip is inside the start line.

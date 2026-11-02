/* ============================================================================
   reprint.ts — the plate change's registration desk
   ----------------------------------------------------------------------------
   `router.tsx` owns the navigation, `Reprint.tsx` owns the gesture. Neither
   should import the other: the router is used by pages that never mount the
   chrome, and the component must be free to disappear under reduced motion.

   So the component registers one run function here, and the router asks for it
   at navigation time. The contract is deliberately one line long: the run
   function receives the commit — the dispatch React listens to — and decides
   when the new page is allowed to appear behind the plate.

   `null` means "no gesture": the router then commits immediately, which is the
   instant cut a deep link or a reduced-motion reader gets.
   ========================================================================== */

export type ReprintRun = (commit: () => void) => void

let handler: ReprintRun | null = null

export function setReprintHandler(h: ReprintRun | null): void {
  handler = h
}

export function getReprintHandler(): ReprintRun | null {
  return handler
}

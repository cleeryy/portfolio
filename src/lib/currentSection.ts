/* ============================================================================
   currentSection.ts — which chapter crosses the reading line
   ----------------------------------------------------------------------------
   Two instruments need the same answer to one question: which `main > section`
   is under the middle of the viewport? They ask it separately — the chrome must
   never inherit the nav's state, because a nav item that names no section would
   otherwise print a plate that is not on screen — but they share this one
   measurement.

   A 10% band around mid-height, read through an IntersectionObserver, not a
   rectangle test: enters and leaves are reported symmetrically, so scrolling
   back up through a chapter restores its number instead of latching the last
   one that passed. The answer is resolved in the order of the site table, which
   is the order the sections are printed in, so a seam between two chapters
   still yields one stable reading.

   The caller supplies the ids: the chrome counts plates from `homeSections`,
   the nav asks which of its own destinations is current. Nothing is inferred
   from `aria-current` here — that is the nav's output, not a measurement.
   ========================================================================== */

/** The middle 10% of the viewport; 45% above and below leaves the line free. */
const BAND = '-45% 0px -45% 0px'

export type SectionWatcher = (id: string | null) => void

/**
 * Watch the home sections named in `ids` and report the one crossing the
 * reading line, or `null` when the reader is above the first of them.
 *
 * Returns its disposer; a component owns one watcher and calls it on unmount.
 */
export function observeCurrentSection(ids: readonly string[], onChange: SectionWatcher): () => void {
  const wanted = new Set(ids)
  const sections = Array.from(
    document.querySelectorAll<HTMLElement>('main > section[id]'),
  ).filter((node) => wanted.has(node.id))

  if (sections.length === 0) return () => {}

  const present = new Set<string>()
  let current: string | null = null

  const emit = () => {
    const next = ids.find((id) => present.has(id)) ?? null
    if (next === current) return
    current = next
    onChange(next)
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) present.add(entry.target.id)
        else present.delete(entry.target.id)
      }
      emit()
    },
    { rootMargin: BAND },
  )

  for (const section of sections) observer.observe(section)
  return () => observer.disconnect()
}

import { useMemo, useSyncExternalStore } from 'react'
import type { AnchorHTMLAttributes, MouseEvent, ReactElement, ReactNode } from 'react'
import { getLenis } from './scroll'

/* ============================================================================
   router.tsx — history, one thin layer, no dependency
   ----------------------------------------------------------------------------
   The site ships a handful of static routes, so this is the whole router: a
   pathname read from `window.location`, one subscription, one push.

   The contract with the rest of the sheet:

   - `useRoute()` is the only read. It returns the normalised pathname and the
     params filled from it (`/work/:slug` → `{ slug }`), and re-renders on both
     `popstate` and the app's own `portfolio:navigate` event.
   - `navigate()` is the only write. It pushes history, announces the change,
     then positions the scroll: instantly to the top of a new page, or on the
     hash target once the destination page has committed. A hash target can be
     mounted *after* `navigate()` returns (the home page mounts on the next
     commit), hence the two painted frames before the lookup.
   - `Link` is a real `<a href>`: the browser still owns middle-click,
     modifier-click, copy-link and external destinations. Only a plain left
     click on an internal address is taken over.
   ========================================================================== */

export type Route = { path: string; params: Record<string, string> }

/** The event a navigation broadcasts; the nav panel closes on it. */
const NAVIGATE_EVENT = 'portfolio:navigate'

const EMPTY_PARAMS: Record<string, string> = {}

/** `'/work/'` and `'/work'` are the same plate; the sheet only has one. */
function normalise(pathname: string): string {
  const trimmed = pathname.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

function currentPath(): string {
  return normalise(window.location.pathname)
}

function readParams(path: string): Record<string, string> {
  const match = /^\/work\/([^/]+)$/.exec(path)
  if (!match) return EMPTY_PARAMS
  try {
    return { slug: decodeURIComponent(match[1]) }
  } catch {
    // A malformed escape is still a slug; the page decides it does not exist.
    return { slug: match[1] }
  }
}

function subscribe(onStoreChange: () => void): () => void {
  window.addEventListener('popstate', onStoreChange)
  document.addEventListener(NAVIGATE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener('popstate', onStoreChange)
    document.removeEventListener(NAVIGATE_EVENT, onStoreChange)
  }
}

const getServerSnapshot = (): string => '/'

export function useRoute(): Route {
  const path = useSyncExternalStore(subscribe, currentPath, getServerSnapshot)
  // A path is a primitive, so the store snapshot is stable by value; the route
  // object is what memoises, otherwise every render would hand the pages a new
  // params identity.
  return useMemo(() => ({ path, params: readParams(path) }), [path])
}

/**
 * Instant positioning, never smooth: a route change is a plate change, not a
 * journey. Lenis is the scroll owner when it exists, so it is told too —
 * otherwise the next wheel tick would drag the page back to its old position.
 */
function jumpTo(target: number | Element): void {
  const lenis = getLenis()
  if (lenis) {
    lenis.scrollTo(target, { immediate: true })
    return
  }
  if (typeof target === 'number') window.scrollTo(0, 0)
  else target.scrollIntoView({ block: 'start', behavior: 'auto' })
}

/** Two frames: the first commits the new page, the second its layout. */
function afterPaint(callback: () => void): void {
  requestAnimationFrame(() => {
    requestAnimationFrame(callback)
  })
}

/* A hash destination can move after it was first reached: the home traverse
   inserts its pin spacer on the first ScrollTrigger refresh, and every section
   below it shifts by the spacer's height. `alignHash` is therefore called back
   by the shell after each refresh, for a short window after the navigation —
   never indefinitely, and never once the reader has taken over the scroll. */
let hashSettleUntil = 0
let hashSettleY = 0

/**
 * Re-align the current hash after a late layout change.
 *
 * Returns silently unless a hash navigation happened in the last three seconds
 * and the reader has not scrolled since the last alignment. The tolerance is a
 * few pixels: a target already under the bar must not be moved again.
 */
export function alignHash(): void {
  if (performance.now() > hashSettleUntil) return
  if (window.location.hash.length < 2) return
  if (Math.abs(window.scrollY - hashSettleY) > 8) {
    hashSettleUntil = 0
    return
  }

  let id: string
  try {
    id = decodeURIComponent(window.location.hash.slice(1))
  } catch {
    id = window.location.hash.slice(1)
  }

  const target = document.getElementById(id)
  if (!target) return

  // The sheet's sections carry `scroll-margin-block-start: var(--nav-h)`, so a
  // settled target sits under the bar rather than at y 0.
  if (Math.abs(target.getBoundingClientRect().top) <= 120) {
    hashSettleUntil = 0
    return
  }

  jumpTo(target)
  hashSettleY = window.scrollY
}

export function navigate(to: string): void {
  let url: URL
  try {
    url = new URL(to, window.location.href)
  } catch {
    return
  }

  // Anything not on this origin is the browser's business (mailto, github…).
  if (url.origin !== window.location.origin) {
    window.location.assign(url.href)
    return
  }

  let hash = ''
  if (url.hash.length > 1) {
    try {
      hash = decodeURIComponent(url.hash.slice(1))
    } catch {
      hash = url.hash.slice(1)
    }
  }

  const samePath = normalise(url.pathname) === currentPath()
  try {
    window.history.pushState(null, '', `${url.pathname}${url.search}${url.hash}`)
  } catch {
    // A failed push must not strand the reader: the scroll below still runs.
  }
  document.dispatchEvent(new CustomEvent(NAVIGATE_EVENT))

  if (hash === '') {
    hashSettleUntil = 0
    jumpTo(0)
    return
  }

  // The destination may be moved by a pin spacer created on the first refresh.
  hashSettleUntil = performance.now() + 3000
  hashSettleY = window.scrollY

  // A cross-page hash link starts on a fresh page, so its top is the honest
  // position while the home sections mount. A same-page hash has no reason to
  // pass through the top first.
  if (!samePath) jumpTo(0)

  const settle = () => {
    const target = document.getElementById(hash)
    if (!target) return
    jumpTo(target)
    hashSettleY = window.scrollY
  }

  afterPaint(() => {
    if (!document.getElementById(hash)) {
      jumpTo(0)
      return
    }
    settle()
    // A pinned section inserts its spacer on the first ScrollTrigger refresh,
    // which can run after this frame — the traverse's ~10k spacer moves every
    // target below it. By the next painted frame the sheet's geometry is final,
    // so the anchor is measured once more instead of landing short.
    requestAnimationFrame(settle)
  })
}

export type LinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & {
  to: string
  children?: ReactNode
}

export function Link({ to, children, onClick, ...rest }: LinkProps): ReactElement {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented) return

    // Plain left click only: every other gesture must stay native.
    if (event.button !== 0) return
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

    const anchor = event.currentTarget
    if (anchor.hasAttribute('download')) return
    const target = anchor.getAttribute('target')
    if (target !== null && target !== '' && target !== '_self') return

    let url: URL
    try {
      url = new URL(anchor.href, window.location.href)
    } catch {
      return
    }
    if (url.origin !== window.location.origin) return

    event.preventDefault()
    navigate(to)
  }

  return (
    <a {...rest} href={to} onClick={handleClick}>
      {children}
    </a>
  )
}

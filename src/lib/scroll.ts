import Lenis from 'lenis'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { effectiveReduced } from './motion'

gsap.registerPlugin(ScrollTrigger)

let lenis: Lenis | null = null
let tick: ((time: number) => void) | null = null
let mediaCleanup: (() => void) | null = null

/**
 * The single smooth-scroll instance for the whole site.
 * Lenis drives scroll; GSAP's ticker drives Lenis so both share one RAF loop,
 * and ScrollTrigger is told to update on every Lenis scroll event.
 */
export function initSmoothScroll(): Lenis | null {
  if (lenis) return lenis

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
  // The engine is built once, so it asks once — and it asks the sheet's own
  // predicate, not the machine's: a stored override must open on native scroll.
  if (effectiveReduced()) {
    // Native scrolling: still let ScrollTrigger know about scroll position.
    const onScroll = () => ScrollTrigger.update()
    window.addEventListener('scroll', onScroll, { passive: true })
    mediaCleanup = () => window.removeEventListener('scroll', onScroll)
    return null
  }

  lenis = new Lenis({
    duration: 1.15,
    easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    smoothWheel: true,
    syncTouch: false,
    touchMultiplier: 1.6,
  })

  lenis.on('scroll', ScrollTrigger.update)

  tick = (time: number) => {
    lenis?.raf(time * 1000)
  }
  gsap.ticker.add(tick)
  gsap.ticker.lagSmoothing(0)

  const onPrefChange = () => {
    // A reduced-motion switch mid-session must not leave the page frozen.
    if (reduced.matches) {
      lenis?.destroy()
      lenis = null
      if (tick) gsap.ticker.remove(tick)
      tick = null
      document.documentElement.classList.remove('has-smooth-scroll')
    }
  }
  reduced.addEventListener('change', onPrefChange)
  mediaCleanup = () => reduced.removeEventListener('change', onPrefChange)

  document.documentElement.classList.add('has-smooth-scroll')
  ScrollTrigger.refresh()

  return lenis
}

export function getLenis(): Lenis | null {
  return lenis
}

export function scrollToId(id: string) {
  const target = document.getElementById(id)
  if (!target) return
  if (lenis) {
    lenis.scrollTo(target, { offset: 0, duration: 1.4 })
  } else {
    target.scrollIntoView({ behavior: 'auto', block: 'start' })
  }
}

export function lockScroll(locked: boolean) {
  if (lenis) {
    if (locked) lenis.stop()
    else lenis.start()
  }
  document.documentElement.style.overflow = locked ? 'hidden' : ''
}

export function destroySmoothScroll() {
  mediaCleanup?.()
  mediaCleanup = null
  if (tick) gsap.ticker.remove(tick)
  tick = null
  lenis?.destroy()
  lenis = null
  document.documentElement.classList.remove('has-smooth-scroll')
}

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Lang = 'en' | 'fr'

/** A bilingual copy pair. Every content module exports strings in this shape. */
export type Bi<T = string> = Record<Lang, T>

const STORAGE_KEY = 'portfolio:lang'

type LangContextValue = {
  lang: Lang
  setLang: (lang: Lang) => void
  /** Pick the string for the active language. */
  pick: <T>(pair: Bi<T>) => T
}

const LangContext = createContext<LangContextValue | null>(null)

function detectInitialLang(): Lang {
  if (typeof window === 'undefined') return 'en'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'fr') return stored
  } catch {
    /* storage blocked — fall through to navigator */
  }
  const nav = window.navigator.language?.toLowerCase() ?? 'en'
  return nav.startsWith('fr') ? 'fr' : 'en'
}

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(detectInitialLang)

  useEffect(() => {
    document.documentElement.lang = lang
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      /* ignore */
    }
  }, [lang])

  const setLang = useCallback((next: Lang) => setLangState(next), [])
  const pick = useCallback(<T,>(pair: Bi<T>) => pair[lang] ?? pair.en, [lang])

  const value = useMemo<LangContextValue>(() => ({ lang, setLang, pick }), [lang, setLang, pick])

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) throw new Error('useLang must be used inside <LangProvider>')
  return ctx
}

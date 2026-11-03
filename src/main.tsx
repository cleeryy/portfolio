import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { LangProvider } from './lib/i18n'
import { initMotion } from './lib/motion'
import { initSmoothScroll } from './lib/scroll'
import './styles/tokens.css'
import './styles/base.css'

// The motion preference before anything reads it: the stored override is printed
// on `<html>` here, so no instrument is ever built in the wrong mode.
initMotion()

// One smooth-scroll engine for the whole site (Lenis), created before first paint
// of animated sections so ScrollTrigger measures the right scroll container.
initSmoothScroll()

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Missing #root element')

createRoot(rootElement).render(
  <StrictMode>
    <LangProvider>
      <App />
    </LangProvider>
  </StrictMode>,
)

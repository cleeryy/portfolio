import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { LangProvider } from './lib/i18n'
import { initSmoothScroll } from './lib/scroll'
import './styles/tokens.css'
import './styles/base.css'

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

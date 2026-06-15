import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { siteName } from './branding'

// Sprint 12 Task 9: the ops.sitedeck.pro subdomain gets its own document
// title. Same bundle, different page identity.
if (typeof document !== 'undefined') {
  document.title = siteName
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

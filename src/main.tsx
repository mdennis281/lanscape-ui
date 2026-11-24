import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from './components'
import { checkVersionFreshness } from './services/versionCheck'
import { initPlatform } from './platform'
import App from './App.tsx'

async function boot() {
  initPlatform();

  await checkVersionFreshness();

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  );
}

boot();

import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App.js';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import './styles.css';

// Global guard for unhandled rejections (#66). React error boundaries
// don't catch async failures, so we surface them in the devtools console
// with a recognisable tag and prevent the default white-screen.
window.addEventListener('unhandledrejection', (event) => {
  console.error('[dyad:unhandled-rejection]', event.reason);
});
window.addEventListener('error', (event) => {
  console.error('[dyad:uncaught]', event.error ?? event.message);
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary name="App">
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

// Development runtime error overlay to make client errors visible
function showOverlay(message: string) {
  try {
    let el = document.getElementById('__error_overlay__');
    if (!el) {
      el = document.createElement('div');
      el.id = '__error_overlay__';
      Object.assign(el.style, {
        position: 'fixed',
        inset: '12px',
        padding: '12px',
        background: 'rgba(200,20,20,0.95)',
        color: 'white',
        zIndex: '99999',
        fontFamily: 'monospace',
        whiteSpace: 'pre-wrap',
        maxHeight: '80vh',
        overflow: 'auto',
        borderRadius: '8px'
      });
      document.body.appendChild(el);
    }
    el.textContent = message;
  } catch (e) {
    // ignore
  }
}

window.addEventListener('error', (ev) => {
  console.error('Runtime error', ev.error || ev.message);
  showOverlay(String(ev.error || ev.message || 'Unknown runtime error'));
});
window.addEventListener('unhandledrejection', (ev) => {
  console.error('Unhandled rejection', ev.reason);
  showOverlay(String(ev.reason || 'Unhandled rejection'));
});

console.log('Starting App render');
try {
  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
} catch (e) {
  console.error('Render failed', e);
  showOverlay(String(e));
}

import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const shouldReloadForRuntimeError = (message: string) => {
  const normalized = message.toLowerCase();
  return (
    normalized.includes('failed to fetch dynamically imported module') ||
    normalized.includes('chunkloaderror') ||
    normalized.includes('loading chunk') ||
    normalized.includes('importing a module script failed')
  );
};

const safeReloadAfterChunkError = () => {
  const key = 'last_chunk_error_reload_at';
  const now = Date.now();
  const last = Number(sessionStorage.getItem(key) || '0');

  // Avoid reload loops if something else is broken
  if (now - last < 5000) return;

  sessionStorage.setItem(key, String(now));
  window.location.reload();
};

// Handle Vite preload errors (common after deploy with stale SW/chunks on Android)
window.addEventListener('vite:preloadError', (event) => {
  event.preventDefault();
  console.warn('[Runtime] Vite preload error detected. Reloading app...');
  safeReloadAfterChunkError();
});

// Extra fallback for chunk loading errors surfaced as unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const message =
    typeof reason === 'string'
      ? reason
      : String(reason?.message || reason || '');

  if (shouldReloadForRuntimeError(message)) {
    console.warn('[Runtime] Dynamic import/chunk error detected. Reloading app...');
    event.preventDefault();
    safeReloadAfterChunkError();
  }
});

// Register Service Worker - v2
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(registration => {
        console.log('[SW] Service Worker registered successfully:', registration);
        
        // Check for updates periodically
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000); // Check every hour
      })
      .catch(registrationError => {
        console.error('[SW] Service Worker registration failed:', registrationError);
      });
  });
}

// Setup online/offline event listeners globally
window.addEventListener('online', () => {
  console.log('[Network] Connection restored - online');
  // Dispatch custom event that components can listen to
  window.dispatchEvent(new CustomEvent('network-status-change', { detail: { isOnline: true } }));
});

window.addEventListener('offline', () => {
  console.log('[Network] Connection lost - offline');
  // Dispatch custom event that components can listen to
  window.dispatchEvent(new CustomEvent('network-status-change', { detail: { isOnline: false } }));
});

// Log initial network status
console.log('[Network] Initial status:', navigator.onLine ? 'online' : 'offline');

createRoot(document.getElementById("root")!).render(<App />);

const setupBadgeCloser = () => {
  const closeBtn = document.getElementById('lovable-badge-close');
  if (!closeBtn) return;
  
  const handleClose = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
    const badge = document.getElementById('lovable-badge');
    if (badge) badge.remove();
  };

  closeBtn.addEventListener('click', handleClose, true);
  closeBtn.addEventListener('touchend', handleClose, true);
};

const waitForBadge = () => {
  const checkBadge = () => {
    if (document.getElementById('lovable-badge-close')) {
      setupBadgeCloser();
    } else {
      requestAnimationFrame(checkBadge);
    }
  };
  checkBadge();
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForBadge);
} else {
  waitForBadge();
}

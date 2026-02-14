import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Service Worker registered by VitePWA plugin (registerType: autoUpdate)

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

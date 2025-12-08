import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' })
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

createRoot(document.getElementById("root")!).render(<App />);

const setupBadgeCloser = () => {
  const badge = document.getElementById('lovable-badge');
  const closeBtn = document.getElementById('lovable-badge-close');

  if (badge && closeBtn) {
    closeBtn.onclick = (e: any) => {
      e.preventDefault();
      e.stopPropagation();
      badge.remove();
    };

    document.addEventListener('keydown', (e) => {
      const badgeElement = document.getElementById('lovable-badge');
      if (e.key === 'Escape' && badgeElement) {
        badgeElement.remove();
      }
    });
  }
};

const observer = new MutationObserver(() => {
  const badge = document.getElementById('lovable-badge');
  if (badge) {
    setupBadgeCloser();
  }
});

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupBadgeCloser);
} else {
  setupBadgeCloser();
}

observer.observe(document.documentElement, { childList: true, subtree: true });

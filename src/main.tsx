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
    closeBtn.addEventListener('click', () => {
      badge.style.display = 'none';
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && badge.style.display !== 'none') {
        badge.style.display = 'none';
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', setupBadgeCloser);
const observer = new MutationObserver(() => {
  if (!document.getElementById('lovable-badge-close')) {
    setupBadgeCloser();
  }
});
observer.observe(document.body, { childList: true, subtree: true });

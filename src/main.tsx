import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

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

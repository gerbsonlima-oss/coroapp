/**
 * Dynamically injects a PWA manifest with tenant-specific start_url
 * This ensures installed PWAs open directly to the tenant's home page
 */
export const injectTenantManifest = (tenantSlug: string, tenantName?: string) => {
  const origin = window.location.origin;
  // Remove any existing dynamic manifest
  const existingManifest = document.querySelector('link[rel="manifest"][data-dynamic="true"]');
  if (existingManifest) {
    existingManifest.remove();
  }

  const manifest = {
    name: tenantName ? `${tenantName} - CantoSacro` : 'CantoSacro',
    short_name: tenantName?.split(' ')[0] || 'CantoSacro',
    description: 'Aplicativo para gestão de músicas e eventos litúrgicos',
    start_url: `${origin}/${tenantSlug}`,
    scope: `${origin}/`,
    display: 'standalone',
    background_color: '#1a1a2e',
    theme_color: '#6366f1',
    orientation: 'portrait-primary',
    icons: [
      {
        src: `${origin}/liturgia-plus-icon.png`,
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable'
      },
      {
        src: `${origin}/liturgia-plus-icon.png`,
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable'
      }
    ]
  };

  // Create blob URL for manifest
  const manifestBlob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
  const manifestUrl = URL.createObjectURL(manifestBlob);

  // Create and inject new manifest link
  const manifestLink = document.createElement('link');
  manifestLink.rel = 'manifest';
  manifestLink.href = manifestUrl;
  manifestLink.setAttribute('data-dynamic', 'true');
  
  // Remove static manifest link if exists
  const staticManifest = document.querySelector('link[rel="manifest"]:not([data-dynamic])');
  if (staticManifest) {
    staticManifest.remove();
  }

  document.head.appendChild(manifestLink);
  
  console.log(`[PWA] Manifest injected with start_url: /${tenantSlug}`);
};

import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Music, BookOpen, Calendar } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';

export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantSlug } = useTenant();
  
  // Build tenant-aware path
  const buildPath = (path: string): string => {
    if (!tenantSlug) return path;
    if (path === '/') return `/${tenantSlug}`;
    return `/${tenantSlug}${path}`;
  };
  
  // Check if current path matches (with or without tenant prefix)
  const isActive = (basePath: string): boolean => {
    const pathname = location.pathname;
    
    if (basePath === '/') {
      // Home is active if path is / or /:tenantSlug
      return pathname === '/' || pathname === `/${tenantSlug}`;
    }
    
    // Check both with and without tenant prefix
    return pathname.startsWith(basePath) || 
           pathname.startsWith(`/${tenantSlug}${basePath}`);
  };

  const navItems = [
    { label: 'Início', icon: Home, path: '/', isActive: isActive('/') },
    { label: 'Eventos', icon: Calendar, path: '/events', isActive: isActive('/events') },
    { label: 'Repertório', icon: Music, path: '/songs', isActive: isActive('/songs') },
    { label: 'Liturgia', icon: BookOpen, path: '/liturgy', isActive: isActive('/liturgy') },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm safe-area-inset-bottom">
      <div className="flex items-center justify-around px-0">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(buildPath(item.path))}
            className={`flex flex-col items-center gap-1 flex-1 py-3 px-2 transition-all duration-200 active:scale-95 ${
              item.isActive
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <item.icon className="h-6 w-6" />
            <span className="text-xs font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

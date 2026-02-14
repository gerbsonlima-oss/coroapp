import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Music, BookOpen, Calendar } from 'lucide-react';
import { useTenant } from '@/contexts/TenantContext';

export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenantSlug } = useTenant();
  
  const buildPath = (path: string): string => {
    if (!tenantSlug) return path;
    if (path === '/') return `/${tenantSlug}`;
    return `/${tenantSlug}${path}`;
  };
  
  const isActive = (basePath: string): boolean => {
    const pathname = location.pathname;
    if (basePath === '/') {
      return pathname === '/' || pathname === `/${tenantSlug}`;
    }
    return pathname.startsWith(basePath) || 
           pathname.startsWith(`/${tenantSlug}${basePath}`);
  };

  const navItems = [
    { label: 'Início', icon: Home, path: '/' },
    { label: 'Eventos', icon: Calendar, path: '/events' },
    { label: 'Repertório', icon: Music, path: '/songs' },
    { label: 'Liturgia', icon: BookOpen, path: '/liturgy' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/40 bg-card/95 backdrop-blur-xl safe-area-inset-bottom">
      <div className="flex items-center justify-around px-2">
        {navItems.map((item) => {
          const active = isActive(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(buildPath(item.path))}
              className={`relative flex flex-col items-center gap-0.5 flex-1 py-2.5 px-2 transition-all duration-200 active:scale-95 ${
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <div className={`relative p-1.5 rounded-2xl transition-all duration-300 ${
                active ? 'bg-primary/15' : ''
              }`}>
                <item.icon className={`h-5 w-5 transition-all duration-200 ${active ? 'scale-110' : ''}`} />
              </div>
              <span className={`text-[10px] leading-none transition-all duration-200 ${
                active ? 'font-bold' : 'font-medium'
              }`}>{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Music, BookOpen, Calendar } from 'lucide-react';
import { useTenantPath } from '@/contexts/TenantContext';

export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { buildPath } = useTenantPath();
  
  const isActive = (basePath: string): boolean => {
    const pathname = location.pathname;
    if (basePath === '/') {
      return pathname === '/' || pathname.split('/').length === 2;
    }
    return pathname.includes(basePath);
  };

  const navItems = [
    { label: 'Início', icon: Home, path: buildPath('/'), isActive: isActive('/'), basePath: '/' },
    { label: 'Eventos', icon: Calendar, path: buildPath('/events'), isActive: isActive('/events'), basePath: '/events' },
    { label: 'Repertório', icon: Music, path: buildPath('/songs'), isActive: isActive('/songs'), basePath: '/songs' },
    { label: 'Liturgia', icon: BookOpen, path: buildPath('/liturgy'), isActive: isActive('/liturgy'), basePath: '/liturgy' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm safe-area-inset-bottom">
      <div className="flex items-center justify-around px-0">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
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

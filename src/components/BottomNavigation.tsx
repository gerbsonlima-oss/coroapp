import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Music, BookOpen, Calendar, MessageCircle, ClipboardCheck } from 'lucide-react';
import { useTenant, useTenantPath } from '@/contexts/TenantContext';

export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { tenant } = useTenant();
  const { buildPath } = useTenantPath();

  const isActive = (basePath: string): boolean => {
    const globalPrefixes = new Set(['auth', 'e']);
    const appRoots = new Set([
      'events',
      'songs',
      'admin',
      'rehearsals',
      'liturgy',
      'chat',
      'audio-to-sheet',
      'choir-members',
      'pending-approval',
      'public',
    ]);
    const segments = location.pathname.split('/').filter(Boolean);
    const first = segments[0];
    const hasSlugPrefix = !!first && !globalPrefixes.has(first) && !appRoots.has(first);
    const pathname = hasSlugPrefix
      ? `/${segments.slice(1).join('/') || ''}` || '/'
      : location.pathname;

    if (basePath === '/') {
      return pathname === '/';
    }

    return pathname.startsWith(basePath);
  };

  const navItems: Array<{
    id: string;
    label: string;
    icon: typeof Home;
    path?: string;
    isActive: boolean;
    onClick?: () => void;
  }> = [
    { id: 'home', label: 'Início', icon: Home, path: '/', isActive: isActive('/') },
    { id: 'events', label: 'Eventos', icon: Calendar, path: '/events', isActive: isActive('/events') },
    { id: 'rehearsals', label: 'Ensaios', icon: ClipboardCheck, path: '/rehearsals', isActive: isActive('/rehearsals') },
    { id: 'songs', label: 'Repertório', icon: Music, path: '/songs', isActive: isActive('/songs') },
    { id: 'liturgy', label: 'Liturgia', icon: BookOpen, path: '/liturgy', isActive: isActive('/liturgy') },
  ];

  if (tenant?.chat_enabled) {
    navItems.push({
      id: 'chat',
      label: 'Chat',
      icon: MessageCircle,
      path: '/chat',
      isActive: isActive('/chat'),
    });
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm safe-area-inset-bottom">
      <div className="flex items-center justify-around px-0">
        {navItems.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              if (item.onClick) {
                item.onClick();
                return;
              }
              if (item.path) {
                navigate(buildPath(item.path));
              }
            }}
            className={`flex flex-col items-center gap-1 flex-1 py-3 px-2 transition-all duration-200 active:scale-95 ${
              item.isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
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

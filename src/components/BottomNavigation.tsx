import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Music, BookOpen, Calendar, Brain } from 'lucide-react';

export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  
  const isHomeActive = location.pathname === '/';
  const isEventsActive = location.pathname.startsWith('/events');
  const isSongsActive = location.pathname.startsWith('/songs');
  const isLiturgyActive = location.pathname.startsWith('/liturgy');
  const isQuizActive = location.pathname.startsWith('/quiz');

  const navItems = [
    { label: 'Início', icon: Home, path: '/', isActive: isHomeActive },
    { label: 'Eventos', icon: Calendar, path: '/events', isActive: isEventsActive },
    { label: 'Repertório', icon: Music, path: '/songs', isActive: isSongsActive },
    { label: 'Quiz', icon: Brain, path: '/quiz', isActive: isQuizActive },
    { label: 'Liturgia', icon: BookOpen, path: '/liturgy', isActive: isLiturgyActive },
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

import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Library, Mic2 } from 'lucide-react';
export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const isEventsActive = location.pathname.startsWith('/events');
  const isSongsActive = location.pathname.startsWith('/songs');
  const isAudioToSheetActive = location.pathname.startsWith('/audio-to-sheet');
  return <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm safe-area-inset-bottom">
      <div className="flex items-center justify-around px-0">
        <button 
          onClick={() => navigate('/events')} 
          className={`flex flex-col items-center gap-1 flex-1 py-3 px-2 transition-all duration-200 active:scale-95 ${
            isEventsActive 
              ? 'text-primary' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Home className="h-6 w-6" />
          <span className="text-xs font-medium">Eventos</span>
        </button>

        <button 
          onClick={() => navigate('/songs')} 
          className={`flex flex-col items-center gap-1 flex-1 py-3 px-2 transition-all duration-200 active:scale-95 ${
            isSongsActive 
              ? 'text-primary' 
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Library className="h-6 w-6" />
          <span className="text-xs font-medium">Biblioteca</span>
        </button>
      </div>
    </div>;
}
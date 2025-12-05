import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Library, Mic2 } from 'lucide-react';
export function BottomNavigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const isEventsActive = location.pathname.startsWith('/events');
  const isSongsActive = location.pathname.startsWith('/songs');
  const isAudioToSheetActive = location.pathname.startsWith('/audio-to-sheet');
  return <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border/50 bg-background/80 backdrop-blur-xl shadow-elevated">
      <div className="flex items-center justify-around safe-area-inset-bottom py-px px-[3px]">
        <button onClick={() => navigate('/events')} className={`flex flex-col items-center gap-1.5 min-w-[80px] py-2.5 px-4 rounded-xl transition-all duration-200 ${isEventsActive ? 'text-primary bg-primary/15 shadow-subtle border border-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-accent/80 active:scale-95'}`}>
          <Home className="h-6 w-6" />
          <span className="text-xs font-semibold">Eventos</span>
        </button>

        <button onClick={() => navigate('/songs')} className={`flex flex-col items-center gap-1.5 min-w-[80px] py-2.5 px-4 rounded-xl transition-all duration-200 ${isSongsActive ? 'text-primary bg-primary/15 shadow-subtle border border-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-accent/80 active:scale-95'}`}>
          <Library className="h-6 w-6" />
          <span className="text-xs font-semibold">Biblioteca</span>
        </button>

        <button onClick={() => navigate('/audio-to-sheet')} className={`flex flex-col items-center gap-1.5 min-w-[80px] py-2.5 px-4 rounded-xl transition-all duration-200 ${isAudioToSheetActive ? 'text-primary bg-primary/15 shadow-subtle border border-primary/20' : 'text-muted-foreground hover:text-foreground hover:bg-accent/80 active:scale-95'}`}>
          <Mic2 className="h-6 w-6" />
          <span className="text-xs font-semibold">Gravar</span>
        </button>
      </div>
    </div>;
}
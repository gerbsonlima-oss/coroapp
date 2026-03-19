import { useNavigate } from 'react-router-dom';
import { Music, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CachedImage } from './CachedImage';
import { useTenantPath } from '@/contexts/TenantContext';

interface Event {
  id: string;
  name: string;
  date: string;
  location: string | null;
  notes: string | null;
  cover_image_url: string | null;
}

interface EventCardProps {
  event: Event;
}

export const EventCard = ({ event }: EventCardProps) => {
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();

  return (
    <div
      onClick={() => navigate(buildPath(`/events/${event.id}`))}
      className="group cursor-pointer transition-all duration-300 hover:scale-[1.04] active:scale-[0.96]"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl shadow-[0_8px_32px_0_rgba(31,38,135,0.37)] hover:shadow-[0_12px_48px_0_rgba(31,38,135,0.5)] transition-all duration-300 border border-white/20 backdrop-blur-md bg-gradient-to-br from-white/10 to-white/5 group-hover:from-white/15 group-hover:to-white/8 group-hover:border-white/30">
        {event.cover_image_url ? (
          <>
            <CachedImage 
              src={event.cover_image_url} 
              alt={event.name}
              className="h-full w-full object-cover group-hover:scale-110 transition-transform duration-300"
              fallback={
                <div className="absolute inset-0 bg-gradient-to-br from-primary/50 via-primary/30 to-primary/10 flex items-center justify-center">
                  <Music className="h-12 w-12 md:h-16 md:w-16 text-white/80 relative z-10 drop-shadow-lg" />
                </div>
              }
            />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-black/5 to-black/40 opacity-60 group-hover:opacity-50 transition-opacity duration-300" />
            <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-transparent to-white/5 pointer-events-none" />
          </>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-primary/50 via-primary/30 to-primary/10 flex items-center justify-center relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <Music className="h-12 w-12 md:h-16 md:w-16 text-white/80 relative z-10 drop-shadow-lg" />
          </div>
        )}
      </div>
      <div className="space-y-2 px-2 py-3 rounded-lg mt-2 bg-gradient-to-br from-white/5 to-white/0 backdrop-blur-sm border border-white/10 group-hover:from-white/10 group-hover:to-white/5 group-hover:border-white/20 transition-all duration-300 shadow-md">
        <h3 className="font-bold text-sm md:text-base text-foreground line-clamp-2 drop-shadow-sm">
          {event.name}
        </h3>
        <div className="flex items-center gap-1.5 text-xs md:text-sm text-muted-foreground">
          <Calendar className="h-3.5 w-3.5 opacity-70" />
          <span>{format(new Date(event.date), "dd 'de' MMM", { locale: ptBR })}</span>
        </div>
      </div>
    </div>
  );
};



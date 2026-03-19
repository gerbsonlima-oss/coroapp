import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CloudDownload, 
  Trash2, 
  Music, 
  Calendar, 
  MapPin,
  HardDrive,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { parseDateOnlyLocal } from '@/utils/dateParsing';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface OfflineEvent {
  id: string;
  name: string;
  date: string;
  location: string | null;
  cover_image_url: string | null;
  savedAt: string;
  audioCount: number;
  songCount: number;
}

const OFFLINE_EVENTS_KEY = 'offline_events_complete';
const OFFLINE_EVENT_IDS_KEY = 'offline_event_ids';

function getSavedEventIds(): string[] {
  try {
    const stored = localStorage.getItem(OFFLINE_EVENT_IDS_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function getOfflineEvent(id: string): any | null {
  try {
    const stored = localStorage.getItem(`${OFFLINE_EVENTS_KEY}_${id}`);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function removeOfflineEvent(id: string): void {
  localStorage.removeItem(`${OFFLINE_EVENTS_KEY}_${id}`);
  const savedIds = getSavedEventIds().filter(savedId => savedId !== id);
  localStorage.setItem(OFFLINE_EVENT_IDS_KEY, JSON.stringify(savedIds));
}

export function OfflineEventsManager() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [offlineEvents, setOfflineEvents] = useState<OfflineEvent[]>([]);
  const [eventToRemove, setEventToRemove] = useState<OfflineEvent | null>(null);
  const [storageUsed, setStorageUsed] = useState<string>('');

  const loadOfflineEvents = () => {
    const ids = getSavedEventIds();
    const events: OfflineEvent[] = [];

    ids.forEach(id => {
      const data = getOfflineEvent(id);
      if (data?.event) {
        events.push({
          id: data.event.id,
          name: data.event.name,
          date: data.event.date,
          location: data.event.location,
          cover_image_url: data.event.cover_image_url,
          savedAt: data.savedAt,
          audioCount: data.audios?.length || 0,
          songCount: data.songs?.length || 0,
        });
      }
    });

    // Sort by saved date (newest first)
    events.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    setOfflineEvents(events);

    // Calculate approximate storage used
    calculateStorageUsed();
  };

  const calculateStorageUsed = () => {
    try {
      let total = 0;
      const ids = getSavedEventIds();
      ids.forEach(id => {
        const stored = localStorage.getItem(`${OFFLINE_EVENTS_KEY}_${id}`);
        if (stored) {
          total += stored.length * 2; // UTF-16 = 2 bytes per char
        }
      });
      
      if (total < 1024) {
        setStorageUsed(`${total} bytes`);
      } else if (total < 1024 * 1024) {
        setStorageUsed(`${(total / 1024).toFixed(1)} KB`);
      } else {
        setStorageUsed(`${(total / (1024 * 1024)).toFixed(1)} MB`);
      }
    } catch {
      setStorageUsed('Desconhecido');
    }
  };

  useEffect(() => {
    if (open) {
      loadOfflineEvents();
    }
  }, [open]);

  const handleRemove = (event: OfflineEvent) => {
    setEventToRemove(event);
  };

  const confirmRemove = () => {
    if (eventToRemove) {
      removeOfflineEvent(eventToRemove.id);
      toast.success(`"${eventToRemove.name}" removido do armazenamento offline`);
      loadOfflineEvents();
      setEventToRemove(null);
    }
  };

  const handleOpenEvent = (eventId: string) => {
    setOpen(false);
    navigate(`/e/${eventId}?offline=true`);
  };

  const savedCount = offlineEvents.length;

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 relative"
          >
            <CloudDownload className="h-4 w-4" />
            <span className="hidden sm:inline">Offline</span>
            {savedCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-medium">
                {savedCount}
              </span>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CloudDownload className="h-5 w-5 text-primary" />
              Eventos Salvos Offline
            </DialogTitle>
            <DialogDescription>
              Gerencie os eventos disponíveis para acesso sem internet.
            </DialogDescription>
          </DialogHeader>

          {offlineEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <CloudDownload className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="font-medium text-foreground mb-1">Nenhum evento salvo</p>
              <p className="text-sm text-muted-foreground max-w-[250px]">
                Salve eventos para acessá-los mesmo sem conexão com a internet.
              </p>
            </div>
          ) : (
            <>
              {/* Storage info */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                <HardDrive className="h-3.5 w-3.5" />
                <span>
                  {offlineEvents.length} evento{offlineEvents.length !== 1 ? 's' : ''} • {storageUsed} utilizados
                </span>
              </div>

              <ScrollArea className="flex-1 -mx-6 px-6">
                <div className="space-y-2 py-2">
                  {offlineEvents.map((event) => (
                    <Card 
                      key={event.id} 
                      className="p-3 flex items-start gap-3 hover:bg-accent/50 transition-colors"
                    >
                      {/* Cover image */}
                      <div 
                        className="h-14 w-14 rounded-lg overflow-hidden bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shrink-0 cursor-pointer"
                        onClick={() => handleOpenEvent(event.id)}
                      >
                        {event.cover_image_url ? (
                          <img 
                            src={event.cover_image_url} 
                            alt={event.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <Music className="h-6 w-6 text-primary/60" />
                        )}
                      </div>

                      {/* Event info */}
                      <div className="flex-1 min-w-0">
                        <h4 
                          className="font-medium text-sm truncate cursor-pointer hover:text-primary transition-colors"
                          onClick={() => handleOpenEvent(event.id)}
                        >
                          {event.name}
                        </h4>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                          <Calendar className="h-3 w-3" />
                          <span>{format(parseDateOnlyLocal(event.date), "dd MMM yyyy", { locale: ptBR })}</span>
                        </div>
                        {event.location && (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                            <MapPin className="h-3 w-3" />
                            <span className="truncate">{event.location}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {event.songCount} música{event.songCount !== 1 ? 's' : ''}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            {event.audioCount} áudio{event.audioCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-primary"
                          onClick={() => handleOpenEvent(event.id)}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemove(event)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirm Remove Dialog */}
      <AlertDialog open={!!eventToRemove} onOpenChange={() => setEventToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Remover evento offline?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O evento "{eventToRemove?.name}" será removido do armazenamento offline. 
              Você precisará de conexão com a internet para acessá-lo novamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={confirmRemove}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

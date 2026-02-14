import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Music, FileText } from 'lucide-react';
import { QuickAudioRecorder } from './QuickAudioRecorder';

interface QuickAudioFABProps {
  onSuccess?: () => void;
  eventId?: string;
  inEvent?: boolean;
}

export const QuickAudioFAB = ({ onSuccess, eventId, inEvent = false }: QuickAudioFABProps) => {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'new' | 'existing' | 'event' | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const handleNewMusic = () => {
    setMode('new');
    setOpen(true);
    setShowMenu(false);
  };

  const handleExistingMusic = () => {
    setMode(inEvent ? 'event' : 'existing');
    setOpen(true);
    setShowMenu(false);
  };

  const handleClose = () => {
    setOpen(false);
    setMode(null);
  };

  const bottomPosition = inEvent ? 'bottom-8' : 'md:bottom-8 bottom-24';

  return (
    <>
      <div className={`fixed ${bottomPosition} right-4 z-40 flex flex-col-reverse gap-2`}>
        {/* Menu items */}
        {showMenu && (
          <>
            {!inEvent && (
              <Button
                onClick={handleNewMusic}
                size="lg"
                className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white shadow-lg rounded-full px-4"
              >
                <Plus className="h-5 w-5" />
                <span className="text-sm font-medium">Nova Música</span>
              </Button>
            )}
            <Button
              onClick={handleExistingMusic}
              size="lg"
              className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-white shadow-lg rounded-full px-4"
            >
              <Music className="h-5 w-5" />
              <span className="text-sm font-medium">
                {inEvent ? 'Adicionar Áudio' : 'Adicionar Áudio'}
              </span>
            </Button>
          </>
        )}

        {/* Main FAB button */}
        <Button
          onClick={() => setShowMenu(!showMenu)}
          size="lg"
          className="h-14 w-14 rounded-full bg-gradient-to-r from-primary to-primary-hover hover:shadow-glow shadow-lg flex items-center justify-center text-white flex-shrink-0"
        >
          {showMenu ? (
            <Plus className="h-6 w-6 rotate-45 transition-transform" />
          ) : (
            <FileText className="h-6 w-6" />
          )}
        </Button>
      </div>

      {/* Audio Recorder Dialog */}
      {mode && (
        <QuickAudioRecorder
          open={open}
          onOpenChange={handleClose}
          mode={mode}
          eventId={inEvent ? eventId : undefined}
          onSuccess={() => {
            handleClose();
            onSuccess?.();
          }}
        />
      )}
    </>
  );
};

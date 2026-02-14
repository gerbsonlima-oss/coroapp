import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, CheckCircle, Check } from 'lucide-react';

interface SaveEventOfflineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventName: string;
  eventId: string;
  coverImageUrl: string | null;
  isSaving: boolean;
  progress: number;
  progressText: string;
  onSave: () => Promise<boolean>;
  isCompleted: boolean;
}

export function SaveEventOfflineDialog({
  open,
  onOpenChange,
  eventName,
  isSaving,
  progress,
  progressText,
  onSave,
  isCompleted
}: SaveEventOfflineDialogProps) {
  const [saveComplete, setSaveComplete] = useState(false);

  const handleSave = async () => {
    const success = await onSave();
    if (success) {
      setSaveComplete(true);
    }
  };

  const handleClose = () => {
    setSaveComplete(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Salvar Offline
          </DialogTitle>
          <DialogDescription>
            Baixe "{eventName}" para acessar mesmo sem internet.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Initial state - before saving */}
          {!isSaving && !isCompleted && !saveComplete && (
            <>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Check className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Acesso offline</p>
                    <p className="text-xs text-muted-foreground">
                      Todos os áudios e informações ficarão disponíveis sem conexão.
                    </p>
                  </div>
                </div>
              </div>

              <Button onClick={handleSave} className="w-full" size="lg">
                <Download className="mr-2 h-4 w-4" />
                Salvar Evento
              </Button>
            </>
          )}

          {/* Saving state */}
          {isSaving && (
            <div className="space-y-3">
              <Progress value={progress} className="h-2" />
              <p className="text-sm text-center text-muted-foreground">
                {progressText}
              </p>
              <p className="text-xs text-center text-muted-foreground">
                {progress}% concluído
              </p>
            </div>
          )}

          {/* Completed state */}
          {(isCompleted || saveComplete) && !isSaving && (
            <div className="space-y-4">
              <div className="text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-3">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <p className="font-medium">Evento salvo!</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Agora você pode acessá-lo mesmo sem internet.
                </p>
              </div>
              
              <Button onClick={handleClose} className="w-full">
                Concluído
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

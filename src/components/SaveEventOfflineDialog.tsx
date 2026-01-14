import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Download, CheckCircle, Smartphone, Share, Plus, X } from 'lucide-react';
import { toast } from 'sonner';

interface SaveEventOfflineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventName: string;
  isSaving: boolean;
  progress: number;
  progressText: string;
  onSave: () => Promise<boolean>;
  isCompleted: boolean;
}

// Detect iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);

// Check if app is installed (standalone mode)
const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

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
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  // Capture beforeinstallprompt event
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleSave = async () => {
    const success = await onSave();
    
    if (success) {
      // After saving, try to show install prompt or iOS instructions
      if (isIOS) {
        setShowIOSInstructions(true);
      } else if (deferredPrompt) {
        // Show install prompt for Android/Desktop
        try {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            toast.success('Atalho criado na tela inicial!');
          }
          setDeferredPrompt(null);
        } catch (e) {
          console.log('Install prompt failed:', e);
        }
      } else if (!isStandalone) {
        // If no install prompt available and not already installed
        toast.success('Evento salvo! Adicione o app à tela inicial para acesso rápido.', {
          duration: 5000
        });
      } else {
        toast.success('Evento salvo offline com sucesso!');
      }
    }
  };

  return (
    <>
      <Dialog open={open && !showIOSInstructions} onOpenChange={onOpenChange}>
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
            {!isSaving && !isCompleted && (
              <>
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Smartphone className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Acesso offline</p>
                      <p className="text-xs text-muted-foreground">
                        Todos os áudios e informações ficarão disponíveis sem conexão.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Plus className="h-5 w-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">Atalho na tela inicial</p>
                      <p className="text-xs text-muted-foreground">
                        Crie um atalho para abrir o evento diretamente.
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

            {isCompleted && !isSaving && (
              <div className="text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">Evento salvo!</p>
                  <p className="text-sm text-muted-foreground">
                    Agora você pode acessar offline.
                  </p>
                </div>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Fechar
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* iOS Instructions Dialog */}
      <AlertDialog open={showIOSInstructions} onOpenChange={setShowIOSInstructions}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Adicionar à Tela Inicial
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-left">
                <p>Para criar um atalho no seu iPhone/iPad:</p>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    Toque no ícone de compartilhar
                    <Share className="h-4 w-4 inline" />
                  </li>
                  <li>Role para baixo e selecione "Adicionar à Tela de Início"</li>
                  <li>Toque em "Adicionar" no canto superior direito</li>
                </ol>
                <div className="bg-green-500/10 rounded-lg p-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0" />
                  <p className="text-sm text-green-600 dark:text-green-400">
                    O evento já foi salvo offline!
                  </p>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => {
              setShowIOSInstructions(false);
              onOpenChange(false);
            }}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

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
import { Download, CheckCircle, Smartphone, Plus, MoreVertical, Home, Loader2 } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { injectEventManifest } from '@/hooks/useEventOfflineSave';
import { toast } from 'sonner';

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

// Detect platform
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid = /Android/.test(navigator.userAgent);

export function SaveEventOfflineDialog({
  open,
  onOpenChange,
  eventName,
  eventId,
  coverImageUrl,
  isSaving,
  progress,
  progressText,
  onSave,
  isCompleted
}: SaveEventOfflineDialogProps) {
  const [saveComplete, setSaveComplete] = useState(false);
  const [isInstallingShortcut, setIsInstallingShortcut] = useState(false);
  const [shortcutInstalled, setShortcutInstalled] = useState(false);
  
  const { isInstallable, promptInstall } = usePWAInstall();

  const handleSave = async () => {
    const success = await onSave();
    if (success) {
      setSaveComplete(true);
    }
  };

  const handleInstallShortcut = async () => {
    setIsInstallingShortcut(true);
    try {
      // Inject manifest with event-specific name and cover image
      await injectEventManifest({
        id: eventId,
        name: eventName,
        cover_image_url: coverImageUrl
      });
      
      // Small delay to ensure manifest is applied
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Trigger the native install prompt
      const installed = await promptInstall();
      
      if (installed) {
        setShortcutInstalled(true);
        toast.success('Atalho criado com sucesso!');
      } else {
        // User dismissed or cancelled - show message but don't treat as error
        toast.info('Instalação cancelada. Você pode tentar novamente.');
      }
    } catch (error) {
      console.error('Error installing shortcut:', error);
      toast.error('Erro ao criar atalho');
    } finally {
      setIsInstallingShortcut(false);
    }
  };

  const handleClose = () => {
    setSaveComplete(false);
    setShortcutInstalled(false);
    onOpenChange(false);
  };

  // Get platform-specific instructions
  const getInstructions = () => {
    if (isIOS) {
      return (
        <ol className="list-none space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
            <span>Toque no ícone de <strong className="text-foreground">Compartilhar</strong> (quadrado com seta)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
            <span>Selecione <strong className="text-foreground">"Adicionar à Tela de Início"</strong></span>
          </li>
        </ol>
      );
    } else if (isAndroid) {
      return (
        <ol className="list-none space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
            <div className="flex items-center gap-1 flex-wrap">
              <span>Toque no menu</span>
              <MoreVertical className="h-4 w-4 inline" />
              <span>(três pontos)</span>
            </div>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
            <span>Selecione <strong className="text-foreground">"Adicionar à tela inicial"</strong></span>
          </li>
        </ol>
      );
    } else {
      return (
        <ol className="list-none space-y-2 text-sm text-muted-foreground">
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
            <span>Clique no menu do navegador (⋮ ou ⋯)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
            <span>Selecione <strong className="text-foreground">"Adicionar à tela inicial"</strong></span>
          </li>
        </ol>
      );
    }
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
                      Após salvar, você poderá criar um atalho para acesso rápido.
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
                {!shortcutInstalled && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Agora crie um atalho para acesso rápido.
                  </p>
                )}
              </div>
              
              {!shortcutInstalled && (
                <>
                  {/* Auto install button if available */}
                  {isInstallable ? (
                    <Button 
                      onClick={handleInstallShortcut} 
                      className="w-full" 
                      size="lg"
                      disabled={isInstallingShortcut}
                    >
                      {isInstallingShortcut ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Criando atalho...
                        </>
                      ) : (
                        <>
                          <Home className="mr-2 h-4 w-4" />
                          Adicionar à Tela Inicial
                        </>
                      )}
                    </Button>
                  ) : (
                    /* Manual instructions inline */
                    <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                      <p className="text-sm font-medium flex items-center gap-2">
                        <Home className="h-4 w-4 text-primary" />
                        Para criar o atalho:
                      </p>
                      {getInstructions()}
                    </div>
                  )}
                </>
              )}
              
              {shortcutInstalled && (
                <div className="bg-green-500/10 rounded-lg p-3 text-center">
                  <p className="text-sm font-medium text-green-600 dark:text-green-400">
                    Atalho criado com sucesso!
                  </p>
                </div>
              )}
              
              <Button 
                onClick={handleClose} 
                variant={shortcutInstalled ? "default" : "outline"}
                className="w-full"
              >
                {shortcutInstalled ? 'Concluído' : 'Fechar'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

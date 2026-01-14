import { useState } from 'react';
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
  const [showInstructions, setShowInstructions] = useState(false);
  const [saveComplete, setSaveComplete] = useState(false);
  const [isInstallingShortcut, setIsInstallingShortcut] = useState(false);
  const [shortcutInstalled, setShortcutInstalled] = useState(false);
  
  const { isInstallable, promptInstall } = usePWAInstall();

  const handleSave = async () => {
    const success = await onSave();
    
    if (success) {
      setSaveComplete(true);
      // If PWA install is available, don't auto-show instructions
      // Instead, show the shortcut button
      if (!isInstallable) {
        // Show instructions after a short delay only if no auto-install available
        setTimeout(() => {
          setShowInstructions(true);
        }, 1500);
      }
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
      }
    } catch (error) {
      console.error('Error installing shortcut:', error);
      toast.error('Erro ao criar atalho');
      // Fall back to showing manual instructions
      setShowInstructions(true);
    } finally {
      setIsInstallingShortcut(false);
    }
  };

  const handleShowManualInstructions = () => {
    setShowInstructions(true);
  };

  const handleClose = () => {
    setShowInstructions(false);
    setSaveComplete(false);
    setShortcutInstalled(false);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open && !showInstructions} onOpenChange={onOpenChange}>
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

            {(isCompleted || saveComplete) && !isSaving && (
              <div className="text-center space-y-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">Evento salvo!</p>
                  <p className="text-sm text-muted-foreground">
                    {shortcutInstalled 
                      ? 'Atalho criado na tela inicial!' 
                      : 'Agora crie um atalho para acesso rápido.'}
                  </p>
                </div>
                
                {/* Shortcut installation button - only show if PWA install is available and not yet installed */}
                {!shortcutInstalled && (
                  <div className="space-y-2 pt-2">
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
                      <Button 
                        onClick={handleShowManualInstructions} 
                        variant="outline"
                        className="w-full" 
                        size="lg"
                      >
                        <Home className="mr-2 h-4 w-4" />
                        Ver instruções para criar atalho
                      </Button>
                    )}
                    
                    <Button 
                      onClick={handleClose} 
                      variant="ghost" 
                      className="w-full"
                    >
                      Fechar
                    </Button>
                  </div>
                )}

                {shortcutInstalled && (
                  <Button 
                    onClick={handleClose} 
                    className="w-full mt-4"
                  >
                    Concluído
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Platform-specific Instructions Dialog */}
      <AlertDialog open={showInstructions} onOpenChange={setShowInstructions}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Criar Atalho de Acesso Rápido
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-left">
                {isIOS ? (
                  <>
                    <p className="text-foreground font-medium">No seu iPhone/iPad:</p>
                    <ol className="list-none space-y-3 text-sm">
                      <li className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
                        <span>Toque no ícone de <strong>Compartilhar</strong> (quadrado com seta para cima) na barra inferior do Safari</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
                        <span>Role para baixo e selecione <strong>"Adicionar à Tela de Início"</strong></span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">3</span>
                        <span>Toque em <strong>"Adicionar"</strong> no canto superior direito</span>
                      </li>
                    </ol>
                  </>
                ) : isAndroid ? (
                  <>
                    <p className="text-foreground font-medium">No seu Android:</p>
                    <ol className="list-none space-y-3 text-sm">
                      <li className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
                        <div className="flex items-center gap-1">
                          <span>Toque no menu</span>
                          <MoreVertical className="h-4 w-4 inline" />
                          <span>(três pontos) no canto superior direito do Chrome</span>
                        </div>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
                        <span>Selecione <strong>"Adicionar à tela inicial"</strong></span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">3</span>
                        <span>Confirme tocando em <strong>"Adicionar"</strong></span>
                      </li>
                    </ol>
                  </>
                ) : (
                  <>
                    <p className="text-foreground font-medium">No seu navegador:</p>
                    <ol className="list-none space-y-3 text-sm">
                      <li className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">1</span>
                        <span>Clique no ícone de menu ou nos três pontos do navegador</span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">2</span>
                        <span>Procure por <strong>"Adicionar à tela inicial"</strong></span>
                      </li>
                      <li className="flex items-start gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium">3</span>
                        <span>Confirme a adição</span>
                      </li>
                    </ol>
                  </>
                )}
                
                <div className="bg-green-500/10 rounded-lg p-3 flex items-start gap-2 mt-4">
                  <CheckCircle className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-600 dark:text-green-400">
                      Evento salvo com sucesso!
                    </p>
                    <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-1">
                      O atalho abrirá o evento "{eventName}" diretamente, com todos os dados disponíveis offline.
                    </p>
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground mt-2">
                  💡 <strong>Dica:</strong> Você pode criar atalhos para vários eventos diferentes. Cada um abrirá o evento específico dentro do app.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={handleClose}>
              Entendi
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

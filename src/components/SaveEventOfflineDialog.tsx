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
import { Download, CheckCircle, Smartphone, Plus, MoreVertical } from 'lucide-react';

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

// Detect platform
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid = /Android/.test(navigator.userAgent);

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
  const [showInstructions, setShowInstructions] = useState(false);
  const [saveComplete, setSaveComplete] = useState(false);

  const handleSave = async () => {
    const success = await onSave();
    
    if (success) {
      setSaveComplete(true);
      // Show instructions after a short delay
      setTimeout(() => {
        setShowInstructions(true);
      }, 1500);
    }
  };

  const handleClose = () => {
    setShowInstructions(false);
    setSaveComplete(false);
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
              <div className="text-center space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-500" />
                </div>
                <div>
                  <p className="font-medium">Evento salvo!</p>
                  <p className="text-sm text-muted-foreground">
                    Preparando instruções para o atalho...
                  </p>
                </div>
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
                      O atalho abrirá este evento diretamente no app Liturgia+, com todos os dados disponíveis offline.
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

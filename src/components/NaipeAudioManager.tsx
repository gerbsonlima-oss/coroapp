import { useState, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { FileAudio, Trash2, Paperclip } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

export interface NaipeAudio {
  id?: string;
  name: string;
  file: File;
  audio_url?: string;
}

interface NaipeAudioManagerProps {
  naipe: string;
  naipeLabel: string;
  audios: NaipeAudio[];
  onAudiosChange: (audios: NaipeAudio[]) => void;
  disabled?: boolean;
  existingAudios?: { id: string; name: string; audio_url: string }[];
  onAudioDeleted?: () => void;
}

export const NaipeAudioManager = ({
  naipeLabel,
  audios,
  onAudiosChange,
  disabled = false,
  existingAudios = [],
  onAudioDeleted,
}: NaipeAudioManagerProps) => {
  const [deletingAudioId, setDeletingAudioId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDeleteExistingAudio = async (audioId: string, audioName: string) => {
    setDeletingAudioId(audioId);
    try {
      const { error } = await supabase
        .from('song_audios')
        .delete()
        .eq('id', audioId);

      if (error) throw error;

      toast.success(`Áudio "${audioName}" excluído com sucesso`);
      onAudioDeleted?.();
    } catch (error) {
      console.error('Erro ao excluir áudio:', error);
      toast.error('Erro ao excluir áudio');
    } finally {
      setDeletingAudioId(null);
    }
  };

  const handleFileChange = (file: File | null, index?: number) => {
    if (!file) return;

    const newAudio: NaipeAudio = {
      name: file.name,
      file,
    };

    if (index !== undefined) {
      const newAudios = [...audios];
      newAudios[index] = newAudio;
      onAudiosChange(newAudios);
    } else {
      onAudiosChange([...audios, newAudio]);
    }
  };

  const removeAudio = (index: number) => {
    const newAudios = audios.filter((_, i) => i !== index);
    onAudiosChange(newAudios);
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{naipeLabel}</span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          title="Anexar áudio"
          className="h-11 w-11 rounded bg-primary/10 hover:bg-primary/20 border border-primary/30 hover:border-primary/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
        >
          <Paperclip className="h-4 w-4 text-primary" />
        </button>
      </div>

      <Input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
        disabled={disabled}
        className="hidden"
      />
      
      {/* Áudios existentes e novos */}
      <div className="space-y-1">
        {existingAudios.map((audio) => (
          <div key={audio.id} className="flex items-center gap-1.5 px-2 py-1 bg-green-500/10 border border-green-500/30 rounded text-xs">
            <FileAudio className="h-3 w-3 text-green-600 flex-shrink-0" />
            <span className="flex-1 truncate">{audio.name}</span>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={disabled || deletingAudioId === audio.id}
                  className="h-9 w-9 hover:bg-red-500/20 rounded transition-all disabled:opacity-50 flex items-center justify-center"
                >
                  <Trash2 className="h-3 w-3 text-red-500" />
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                  <AlertDialogDescription>
                    Tem certeza que deseja excluir o áudio "{audio.name}"?
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => handleDeleteExistingAudio(audio.id, audio.name)}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        ))}
        
        {audios.map((audio, index) => (
          <div key={index} className="flex items-center gap-1.5 px-2 py-1 bg-primary/5 border border-primary/20 rounded text-xs">
            <FileAudio className="h-3 w-3 text-primary flex-shrink-0" />
            <span className="flex-1 truncate">{audio.name}</span>
            <button
              type="button"
              onClick={() => removeAudio(index)}
              disabled={disabled}
              className="h-9 w-9 hover:bg-red-500/20 rounded transition-all disabled:opacity-50 flex items-center justify-center"
            >
              <Trash2 className="h-3 w-3 text-red-500" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

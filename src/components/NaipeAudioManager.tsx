import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { FileAudio, Trash2, Plus } from 'lucide-react';
import { AudioRecorder } from './AudioRecorder';
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
  naipe,
  naipeLabel,
  audios,
  onAudiosChange,
  disabled = false,
  existingAudios = [],
  onAudioDeleted,
}: NaipeAudioManagerProps) => {
  const [audioNames, setAudioNames] = useState<Record<number, string>>({});
  const [deletingAudioId, setDeletingAudioId] = useState<string | null>(null);

  const handleDeleteExistingAudio = async (audioId: string, audioName: string) => {
    setDeletingAudioId(audioId);
    try {
      const { error } = await supabase
        .from('song_audios')
        .delete()
        .eq('id', audioId);

      if (error) throw error;

      toast.success(`Áudio "${audioName}" excluído com sucesso`);
      if (onAudioDeleted) {
        onAudioDeleted();
      }
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
      name: audioNames[index ?? audios.length] || file.name,
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

  const handleNameChange = (index: number, name: string) => {
    setAudioNames((prev) => ({ ...prev, [index]: name }));
    const newAudios = [...audios];
    if (newAudios[index]) {
      newAudios[index].name = name;
      onAudiosChange(newAudios);
    }
  };

  const removeAudio = (index: number) => {
    const newAudios = audios.filter((_, i) => i !== index);
    onAudiosChange(newAudios);
  };

  return (
    <div className="space-y-3">
      <Label className="text-sm font-medium">{naipeLabel}</Label>
      
      {/* Áudios existentes no banco */}
      {existingAudios.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Áudios já cadastrados:</p>
          {existingAudios.map((audio) => (
            <Card key={audio.id} className="p-3">
              <div className="flex items-center gap-2">
                <FileAudio className="h-4 w-4 text-green-500" />
                <span className="text-sm flex-1">{audio.name}</span>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={disabled || deletingAudioId === audio.id}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja excluir o áudio "{audio.name}"? Esta ação não pode ser desfeita.
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
            </Card>
          ))}
        </div>
      )}

      {/* Novos áudios sendo adicionados */}
      {audios.map((audio, index) => (
        <Card key={index} className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <FileAudio className="h-4 w-4" />
            <Input
              type="text"
              placeholder="Nome do áudio"
              value={audio.name}
              onChange={(e) => handleNameChange(index, e.target.value)}
              disabled={disabled}
              className="flex-1"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => removeAudio(index)}
              disabled={disabled}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </Card>
      ))}

      {/* Adicionar novo áudio */}
      <div className="space-y-2">
        <Input
          type="file"
          accept="audio/*"
          onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
          disabled={disabled}
          className="file:mr-4 file:rounded-full file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-primary-foreground hover:file:bg-primary/90"
        />
        <AudioRecorder
          naipeName={naipe}
          onRecordingComplete={(file) => handleFileChange(file)}
        />
      </div>
    </div>
  );
};

import { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { toast } from 'sonner';
import { Mic, Pause, Play, Save, Trash2, RotateCcw, X } from 'lucide-react';
import { uploadFileToBucket } from '@/utils/storageUpload';

interface QuickAudioRecorderProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: 'new' | 'existing' | 'event';
  eventId?: string;
  initialSongName?: string;
  onSuccess?: () => void;
}

interface DraftAudio {
  songId?: string;
  songName?: string;
  naipe: string;
  blob?: Blob;
  duration: number;
  recordedAt: number;
}

const NAIPES = [
  { key: 'soprano', label: 'Soprano' },
  { key: 'contralto', label: 'Contralto' },
  { key: 'tenor', label: 'Tenor' },
  { key: 'baixo', label: 'Baixo' },
  { key: 'todos', label: '4 vozes' },
];

export const QuickAudioRecorder = ({ open, onOpenChange, mode, eventId, initialSongName, onSuccess }: QuickAudioRecorderProps) => {
  const { tenantId } = useTenant();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const playbackRef = useRef<HTMLAudioElement>(null);

  const [recording, setRecording] = useState(false);
  const [paused, setPaused] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [recordingTime, setRecordingTime] = useState(0);
  const [naipe, setNaipe] = useState('soprano');
  const [songs, setSongs] = useState<any[]>([]);
  const [selectedSongId, setSelectedSongId] = useState('');
  const [newSongName, setNewSongName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [songSearchQuery, setSongSearchQuery] = useState('');
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const normalizeString = (str: string) => {
    return str
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  };

  const filteredSongs = songs.filter(song =>
    normalizeString(song.name).includes(normalizeString(songSearchQuery))
  );

  useEffect(() => {
    if (mode === 'existing') {
      fetchSongs();
    }

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    };
  }, [mode]);

  useEffect(() => {
    // Se recebeu initialSongName (do modal de seleção), usa diretamente
    if (initialSongName && mode === 'new') {
      setNewSongName(initialSongName);
    } else {
      // Caso contrário, carrega do draft
      const draft = localStorage.getItem('audio_draft');
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          setNaipe(parsed.naipe);
          if (mode === 'existing' && parsed.songId) {
            setSelectedSongId(parsed.songId);
          } else if (mode === 'new' && parsed.songName) {
            setNewSongName(parsed.songName);
          }
        } catch (e) {
          console.error('Error loading draft:', e);
        }
      }
    }

    // Check for selected song from event details modal
    if (mode === 'existing') {
      const selectedSongId = sessionStorage.getItem('selectedSongForAudio');
      if (selectedSongId) {
        setSelectedSongId(selectedSongId);
        sessionStorage.removeItem('selectedSongForAudio');
      }
    }
  }, [open, mode, initialSongName]);

  const fetchSongs = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('id, name')
        .order('name');
      
      if (error) throw error;
      setSongs(data || []);
    } catch (error) {
      toast.error('Erro ao carregar músicas');
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        chunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        setRecordedBlob(blob);
        saveDraft(blob);
      };

      mediaRecorder.start();
      setRecording(true);
      setPaused(false);
      setRecordingTime(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      toast.error('Erro ao acessar microfone');
    }
  };

  const pauseRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.pause();
      setPaused(true);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const resumeRecording = () => {
    if (mediaRecorderRef.current && paused) {
      mediaRecorderRef.current.resume();
      setPaused(false);
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
      setRecording(false);
      setPaused(false);
    }
  };

  const saveDraft = (blob?: Blob) => {
    const draft: DraftAudio = {
      naipe,
      duration: recordingTime,
      recordedAt: Date.now(),
    };

    if (mode === 'new') {
      draft.songName = newSongName;
    } else {
      draft.songId = selectedSongId;
    }

    localStorage.setItem('audio_draft', JSON.stringify(draft));
  };

  const playRecording = () => {
    if (recordedBlob && playbackRef.current) {
      const url = URL.createObjectURL(recordedBlob);
      playbackRef.current.src = url;
      playbackRef.current.play();
    }
  };

  const resetRecording = () => {
    setRecordedBlob(null);
    setRecordingTime(0);
    chunksRef.current = [];
    localStorage.removeItem('audio_draft');
  };

  const saveRecording = async () => {
    if (!recordedBlob) {
      toast.error('Nenhuma gravação realizada');
      return;
    }

    setIsLoading(true);
    try {
      const fileName = `audio_${Date.now()}.webm`;
      const file = new File([recordedBlob], fileName, { type: 'audio/webm' });
      const audioUrl = await uploadFileToBucket(file, 'song-audios', fileName);

      if (mode === 'new') {
        if (!newSongName) {
          toast.error('Insira o nome da música');
          setIsLoading(false);
          return;
        }

        const { data: songData, error: songError } = await supabase
          .from('songs')
          .insert([{ name: newSongName, type: 'outro', tenant_id: tenantId }])
          .select()
          .single();

        if (songError) throw songError;

        const { error: audioError } = await supabase
          .from('song_audios')
          .insert([{
            song_id: songData.id,
            tenant_id: tenantId,
            naipe,
            audio_url: audioUrl,
            name: `${newSongName} - ${naipe.charAt(0).toUpperCase() + naipe.slice(1)}`,
          }]);

        if (audioError) throw audioError;
        toast.success('Música e áudio criados com sucesso!');
      } else if (mode === 'event') {
        if (!selectedSongId) {
          toast.error('Selecione uma música');
          setIsLoading(false);
          return;
        }

        const { error: audioError } = await supabase
          .from('song_audios')
          .insert([{
            song_id: selectedSongId,
            tenant_id: tenantId,
            naipe,
            audio_url: audioUrl,
            name: `Áudio - ${naipe.charAt(0).toUpperCase() + naipe.slice(1)}`,
          }]);

        if (audioError) throw audioError;
        toast.success('Áudio adicionado ao evento!');
      } else {
        if (!selectedSongId) {
          toast.error('Selecione uma música');
          setIsLoading(false);
          return;
        }

        const { error: audioError } = await supabase
          .from('song_audios')
          .insert([{
            song_id: selectedSongId,
            tenant_id: tenantId,
            naipe,
            audio_url: audioUrl,
            name: `Áudio - ${naipe.charAt(0).toUpperCase() + naipe.slice(1)}`,
          }]);

        if (audioError) throw audioError;
        toast.success('Áudio adicionado com sucesso!');
      }

      localStorage.removeItem('audio_draft');
      resetRecording();
      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error('Error saving audio:', error);
      toast.error('Erro ao salvar áudio');
    } finally {
      setIsLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getModeTitle = () => {
    if (mode === 'new') return 'Nova Música + Áudio';
    if (mode === 'event') return 'Adicionar Áudio ao Evento';
    return 'Adicionar Áudio';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{getModeTitle()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Naipe Selection */}
          <div className="space-y-2">
            <Label htmlFor="naipe-select">Naipe</Label>
            <Select value={naipe} onValueChange={(value) => { setNaipe(value); saveDraft(); }}>
              <SelectTrigger id="naipe-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NAIPES.map(n => (
                  <SelectItem key={n.key} value={n.key}>
                    {n.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mode-specific fields */}
          {mode === 'new' ? (
            <div className="space-y-2">
              <Label htmlFor="song-name">Nome da Música</Label>
              <Input
                id="song-name"
                placeholder="Digite o nome..."
                value={newSongName}
                onChange={(e) => { setNewSongName(e.target.value); saveDraft(); }}
                disabled={recording || isLoading}
              />
            </div>
          ) : (
            <div className="space-y-3">
              <Label htmlFor="song-search">Selecione a Música</Label>
              <div className="relative">
                <Input
                  id="song-search"
                  placeholder="Buscar música..."
                  value={songSearchQuery}
                  onChange={(e) => setSongSearchQuery(e.target.value)}
                  disabled={recording || isLoading}
                  className="mb-2"
                />
                {selectedSongId && (
                  <button
                    onClick={() => {
                      setSelectedSongId('');
                      setSongSearchQuery('');
                    }}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                )}
              </div>
              {selectedSongId ? (
                <div className="p-3 rounded-lg bg-primary/10 border-2 border-primary text-sm">
                  <p className="font-medium text-foreground">
                    {songs.find(s => s.id === selectedSongId)?.name || 'Música selecionada'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {filteredSongs.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      {songs.length === 0 ? 'Nenhuma música disponível' : 'Nenhuma música encontrada'}
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {filteredSongs.map(song => (
                        <button
                          key={song.id}
                          onClick={() => {
                            setSelectedSongId(song.id);
                            setSongSearchQuery('');
                            saveDraft();
                          }}
                          className="w-full text-left px-3 py-2 rounded-lg transition-all text-sm bg-secondary/50 border-2 border-border/50 hover:border-primary/50 hover:bg-secondary"
                        >
                          {song.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Event-specific storage */}
          {mode === 'event' && eventId && (
            <input type="hidden" value={eventId} />
          )}

          {/* Recording Section */}
          <div className="space-y-3 border rounded-lg p-4 bg-muted/50">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary mb-2">
                {formatTime(recordingTime)}
              </div>
              {recording && (
                <div className="flex justify-center gap-1 mb-2">
                  <div className="h-2 w-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-xs text-red-500">Gravando...</span>
                </div>
              )}
            </div>

            {!recording && !recordedBlob ? (
              <Button
                onClick={startRecording}
                disabled={isLoading}
                className="w-full gap-2 bg-gradient-to-r from-primary to-primary-hover"
                size="lg"
              >
                <Mic className="h-5 w-5" />
                Iniciar Gravação
              </Button>
            ) : recording ? (
              <div className="flex gap-2">
                <Button
                  onClick={pauseRecording}
                  disabled={paused}
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                >
                  <Pause className="h-4 w-4" />
                  Pausar
                </Button>
                <Button
                  onClick={resumeRecording}
                  disabled={!paused}
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                >
                  <Play className="h-4 w-4" />
                  Retomar
                </Button>
                <Button
                  onClick={stopRecording}
                  variant="destructive"
                  size="sm"
                  className="flex-1 gap-2"
                >
                  Parar
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  onClick={playRecording}
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                >
                  <Play className="h-4 w-4" />
                  Ouvir
                </Button>
                <Button
                  onClick={resetRecording}
                  variant="outline"
                  size="sm"
                  className="flex-1"
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
            )}

            <audio ref={playbackRef} className="hidden" />
          </div>

          {/* Save Section */}
          {recordedBlob && (
            <div className="space-y-2">
              <Button
                onClick={saveRecording}
                disabled={isLoading}
                className="w-full gap-2 bg-gradient-to-r from-primary to-primary-hover"
                size="lg"
              >
                <Save className="h-5 w-5" />
                {isLoading ? 'Salvando...' : 'Salvar Áudio'}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

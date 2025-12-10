import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, Square, Play, Pause, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { usePitchDetection } from '@/hooks/usePitchDetection';
import { PitchVisualizer } from '@/components/PitchVisualizer';
import { exportToMidi } from '@/utils/midiExport';

interface AudioRecorderProps {
  onRecordingComplete: (file: File) => void;
  naipeName: string;
  compact?: boolean;
  disabled?: boolean;
}

export const AudioRecorder = ({ onRecordingComplete, naipeName, compact = true, disabled = false }: AudioRecorderProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [permissionIssue, setPermissionIssue] = useState<string | null>(null);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { 
    detectedNotes, 
    isAnalyzing, 
    startAnalysis, 
    stopAnalysis, 
    clearNotes 
  } = usePitchDetection();

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        
        // Cria um arquivo a partir do blob
        const file = new File(
          [blob],
          `${naipeName}_${Date.now()}.webm`,
          { type: 'audio/webm' }
        );
        onRecordingComplete(file);
        
        // Para todas as tracks do stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setPermissionIssue(null);
      clearNotes();
      
      // Inicia análise de pitch
      await startAnalysis();
      
      // Timer para mostrar tempo de gravação
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      toast.success('Gravação iniciada - Detectando notas...');
    } catch (error: any) {
      console.error('Erro ao iniciar gravação:', error);
      let msg = 'Erro ao acessar microfone. Verifique as permissões.';
      if (typeof window !== 'undefined' && !window.isSecureContext) {
        msg = 'Requer conexão segura (HTTPS) para usar o microfone.';
      } else if (error?.name === 'NotAllowedError') {
        msg = 'Permissão do microfone negada/fechada. Autorize no cadeado do navegador e tente novamente.';
      } else if (error?.name === 'NotFoundError') {
        msg = 'Nenhum microfone foi encontrado no dispositivo.';
      }
      setPermissionIssue(msg);
      toast.error(msg);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      stopAnalysis();
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      toast.success(`Gravação finalizada - ${detectedNotes.length} notas detectadas`);
    }
  };

  const togglePlayback = () => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const clearRecording = () => {
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioBlob(null);
    setAudioUrl(null);
    setIsPlaying(false);
    setRecordingTime(0);
    clearNotes();
  };

  const handleExportMidi = async () => {
    try {
      if (detectedNotes.length === 0) {
        toast.error('Nenhuma nota detectada para exportar');
        return;
      }
      
      const filename = `${naipeName}_${Date.now()}.mid`;
      await exportToMidi(detectedNotes, filename);
      toast.success('Arquivo MIDI exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar MIDI:', error);
      toast.error('Erro ao exportar arquivo MIDI');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            disabled={disabled}
            title={isRecording ? "Parar" : "Gravar"}
            className={`p-1.5 rounded border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
              isRecording 
                ? 'bg-red-500/20 hover:bg-red-500/30 border-red-500/50' 
                : 'bg-primary/10 hover:bg-primary/20 border-primary/30 hover:border-primary/50'
            }`}
          >
            {isRecording ? (
              <Square className="h-4 w-4 text-red-500" />
            ) : (
              <Mic className="h-4 w-4 text-primary" />
            )}
          </button>
        </div>

        {permissionIssue && (
          <p className="text-[11px] text-destructive">{permissionIssue}</p>
        )}

        {audioUrl && (
          <audio
            ref={audioRef}
            src={audioUrl}
            onEnded={() => setIsPlaying(false)}
            className="hidden"
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <PitchVisualizer notes={detectedNotes} isAnalyzing={isAnalyzing} />
      
      <div className="flex gap-2 items-center">
        {!audioBlob ? (
          <Button
            type="button"
            variant={isRecording ? "destructive" : "outline"}
            size="sm"
            onClick={isRecording ? stopRecording : startRecording}
            className="flex-1"
          >
            {isRecording ? (
              <>
                <Square className="h-4 w-4 mr-2" />
                Parar {formatTime(recordingTime)}
              </>
            ) : (
              <>
                <Mic className="h-4 w-4 mr-2" />
                Gravar Áudio
              </>
            )}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={togglePlayback}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4" />
              )}
            </Button>
            <span className="text-sm text-muted-foreground flex-1">
              Gravação: {formatTime(recordingTime)}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearRecording}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {detectedNotes.length > 0 && !isRecording && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleExportMidi}
          className="w-full"
        >
          <Download className="h-4 w-4 mr-2" />
          Exportar MIDI ({detectedNotes.length} notas)
        </Button>
      )}
      
      {permissionIssue && (
        <div className="space-y-2">
          <p className="text-xs text-destructive">{permissionIssue}</p>
          <Button type="button" variant="outline" size="sm" onClick={startRecording}>
            Tentar novamente
          </Button>
        </div>
      )}
      
      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onEnded={() => setIsPlaying(false)}
          className="hidden"
        />
      )}
    </div>
  );
};

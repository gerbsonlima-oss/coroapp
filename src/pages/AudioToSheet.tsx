import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Mic, Square, Play, Pause, Trash2, Download, ArrowLeft, Music } from 'lucide-react';
import { toast } from 'sonner';
import { exportToMidi } from '@/utils/midiExport';
import { SheetMusicNotation } from '@/components/SheetMusicNotation';
import { useNavigate } from 'react-router-dom';
import type { DetectedNote } from '@/hooks/usePitchDetection';

// Função auxiliar para conversão de frequência em nota
const frequencyToNoteName = (frequency: number): string => {
  const A4 = 440;
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  if (frequency === 0) return '';
  
  const halfSteps = 12 * Math.log2(frequency / A4);
  const noteIndex = Math.round(halfSteps) + 9;
  const octave = Math.floor((noteIndex + 12) / 12) + 3;
  const note = noteNames[(noteIndex % 12 + 12) % 12];
  
  return `${note}${octave}`;
};

// Função de autocorrelação
const autoCorrelate = (buffer: Float32Array, sampleRate: number): number => {
  let SIZE = buffer.length;
  let rms = 0;

  for (let i = 0; i < SIZE; i++) {
    const val = buffer[i];
    rms += val * val;
  }
  rms = Math.sqrt(rms / SIZE);

  if (rms < 0.015) return -1;

  let r1 = 0, r2 = SIZE - 1, thres = 0.2;
  for (let i = 0; i < SIZE / 2; i++) {
    if (Math.abs(buffer[i]) < thres) { r1 = i; break; }
  }
  for (let i = 1; i < SIZE / 2; i++) {
    if (Math.abs(buffer[SIZE - i]) < thres) { r2 = SIZE - i; break; }
  }

  buffer = buffer.slice(r1, r2);
  SIZE = buffer.length;

  const c = new Array(SIZE).fill(0);
  for (let i = 0; i < SIZE; i++) {
    for (let j = 0; j < SIZE - i; j++) {
      c[i] = c[i] + buffer[j] * buffer[j + i];
    }
  }

  let d = 0;
  while (c[d] > c[d + 1]) d++;

  let maxval = -1, maxpos = -1;
  for (let i = d; i < SIZE; i++) {
    if (c[i] > maxval) {
      maxval = c[i];
      maxpos = i;
    }
  }

  let T0 = maxpos;

  const x1 = c[T0 - 1], x2 = c[T0], x3 = c[T0 + 1];
  const a = (x1 + x3 - 2 * x2) / 2;
  const b = (x3 - x1) / 2;
  if (a) T0 = T0 - b / (2 * a);

  return sampleRate / T0;
};

export default function AudioToSheet() {
  const navigate = useNavigate();
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [detectedNotes, setDetectedNotes] = useState<DetectedNote[]>([]);
  
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number>(0);

  const startManualPitchAnalysis = (analyser: AnalyserNode, audioContext: AudioContext) => {
    const bufferLength = analyser.fftSize;
    const buffer = new Float32Array(bufferLength);
    let lastNoteTime = 0;
    let lastNoteName = '';
    
    const analyze = () => {
      if (!isRecording && !(window as any).currentAnalyser) return;
      
      analyser.getFloatTimeDomainData(buffer);
      const sampleRate = audioContext.sampleRate;
      const frequency = autoCorrelate(buffer, sampleRate);

      if (frequency >= 60 && frequency <= 2100) {
        const currentTime = (Date.now() - startTimeRef.current) / 1000;
        const noteName = frequencyToNoteName(frequency);
        
        console.log('Frequência detectada:', frequency, 'Hz -', noteName);
        
        if (noteName && (noteName !== lastNoteName || currentTime - lastNoteTime > 0.6)) {
          const confidence = Math.min(1, Math.abs(frequency) / 1000);
          
          const newNote: DetectedNote = {
            pitch: frequency,
            noteName,
            time: currentTime,
            confidence
          };
          
          console.log('Nova nota adicionada:', newNote);
          setDetectedNotes(prev => [...prev, newNote]);
          
          lastNoteName = noteName;
          lastNoteTime = currentTime;
        }
      }

      (window as any).pitchAnalysisFrame = requestAnimationFrame(analyze);
    };
    
    startTimeRef.current = Date.now();
    analyze();
  };

  const startRecording = async () => {
    try {
      console.log('Solicitando acesso ao microfone...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100
        } 
      });
      
      console.log('Microfone acessado, iniciando gravação e análise...');
      
      // Configura MediaRecorder
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
        console.log('Gravação finalizada');
      };

      // Inicia análise de pitch usando o MESMO stream
      const audioContext = new AudioContext({ sampleRate: 44100 });
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 4096;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);
      
      // Armazena referências temporárias
      (window as any).currentAudioContext = audioContext;
      (window as any).currentAnalyser = analyser;
      (window as any).currentStream = stream;

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      setDetectedNotes([]);
      
      // Inicia a análise manual
      startManualPitchAnalysis(analyser, audioContext);
      
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
      toast.success('Gravação iniciada - Detectando notas musicais...');
    } catch (error: any) {
      console.error('Erro ao iniciar gravação:', error);
      let msg = 'Erro ao acessar microfone. Verifique as permissões.';
      if (error?.name === 'NotAllowedError') {
        msg = 'Permissão do microfone negada. Autorize no navegador e tente novamente.';
      }
      toast.error(msg);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      console.log('Parando gravação...');
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      // Para análise manual
      if ((window as any).pitchAnalysisFrame) {
        cancelAnimationFrame((window as any).pitchAnalysisFrame);
      }
      
      // Limpa recursos
      const stream = (window as any).currentStream;
      const audioContext = (window as any).currentAudioContext;
      
      if (stream) {
        stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      }
      if (audioContext) {
        audioContext.close();
      }
      
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      
      console.log(`Gravação finalizada - ${detectedNotes.length} notas detectadas`);
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
    setDetectedNotes([]);
    toast.info('Gravação removida');
  };

  const [isPlayingMidi, setIsPlayingMidi] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);

  const handlePlayMidi = async () => {
    try {
      if (detectedNotes.length === 0) {
        toast.error('Nenhuma nota detectada para reproduzir');
        return;
      }

      // Para se já estiver tocando
      if (isPlayingMidi) {
        setIsPlayingMidi(false);
        if (audioContextRef.current) {
          audioContextRef.current.close();
          audioContextRef.current = null;
        }
        return;
      }

      // Cria um contexto de áudio para sintetizar as notas
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;
      setIsPlayingMidi(true);
      
      // Função para converter nome de nota para frequência
      const noteToFrequency = (noteName: string): number => {
        const A4 = 440;
        const notes: { [key: string]: number } = {
          'C': -9, 'C#': -8, 'D': -7, 'D#': -6, 'E': -5, 'F': -4,
          'F#': -3, 'G': -2, 'G#': -1, 'A': 0, 'A#': 1, 'B': 2
        };
        const note = noteName.slice(0, -1);
        const octave = parseInt(noteName.slice(-1));
        const halfSteps = notes[note] + (octave - 4) * 12;
        return A4 * Math.pow(2, halfSteps / 12);
      };

      // Toca cada nota sequencialmente
      let currentTime = audioContext.currentTime;
      const gainNode = audioContext.createGain();
      gainNode.connect(audioContext.destination);
      
      for (let i = 0; i < detectedNotes.length; i++) {
        const note = detectedNotes[i];
        const nextNote = detectedNotes[i + 1];
        const duration = nextNote ? (nextNote.time - note.time) : 0.5;
        
        if (duration < 0.05 || duration > 10) continue;
        
        const oscillator = audioContext.createOscillator();
        oscillator.type = 'sine';
        oscillator.frequency.value = noteToFrequency(note.noteName);
        
        const noteGain = audioContext.createGain();
        noteGain.gain.value = 0;
        noteGain.gain.setValueAtTime(0, currentTime);
        noteGain.gain.linearRampToValueAtTime(0.3, currentTime + 0.01);
        noteGain.gain.linearRampToValueAtTime(0.2, currentTime + duration * 0.7);
        noteGain.gain.linearRampToValueAtTime(0, currentTime + duration);
        
        oscillator.connect(noteGain);
        noteGain.connect(gainNode);
        
        oscillator.start(currentTime);
        oscillator.stop(currentTime + duration);
        
        currentTime += duration;
      }
      
      // Para de tocar ao final
      setTimeout(() => {
        setIsPlayingMidi(false);
        audioContext.close();
        audioContextRef.current = null;
      }, (currentTime - audioContext.currentTime) * 1000);
      
      toast.info('Reproduzindo prévia...');
      
    } catch (error) {
      console.error('Erro ao reproduzir prévia:', error);
      toast.error('Erro ao reproduzir prévia');
      setIsPlayingMidi(false);
    }
  };

  const handleExportMidi = async () => {
    try {
      if (detectedNotes.length === 0) {
        toast.error('Nenhuma nota detectada para exportar');
        return;
      }
      
      const filename = `partitura_${Date.now()}.mid`;
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-primary/5 pb-40">
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-xl"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Áudio para Partitura</h1>
            <p className="text-muted-foreground">
              Grave um áudio e veja as notas convertidas em partitura musical
            </p>
          </div>
        </div>

        {/* Recording Controls */}
        <Card className="p-6 space-y-4 rounded-2xl shadow-elegant">
          <div className="flex gap-3 items-center">
            {!audioBlob ? (
              <Button
                variant={isRecording ? "destructive" : "default"}
                size="lg"
                onClick={isRecording ? stopRecording : startRecording}
                className="flex-1 h-14 rounded-xl text-lg active:scale-95 transition-transform"
              >
                {isRecording ? (
                  <>
                    <Square className="h-5 w-5 mr-2" />
                    Parar Gravação {formatTime(recordingTime)}
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5 mr-2" />
                    Iniciar Gravação
                  </>
                )}
              </Button>
            ) : (
              <>
                <Button
                  variant="outline"
                  size="lg"
                  onClick={togglePlayback}
                  className="rounded-xl active:scale-95 transition-transform"
                >
                  {isPlaying ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </Button>
                <div className="flex-1 text-center">
                  <span className="text-sm text-muted-foreground">
                    Duração: {formatTime(recordingTime)}
                  </span>
                  <div className="text-xs text-muted-foreground mt-1">
                    {detectedNotes.length} notas detectadas
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={clearRecording}
                  className="rounded-xl"
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
              </>
            )}
          </div>

          {isRecording && (
            <div className="flex items-center justify-center gap-2 py-2">
              <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-sm text-muted-foreground">
                Analisando áudio em tempo real...
              </span>
            </div>
          )}

          {detectedNotes.length > 0 && !isRecording && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="lg"
                onClick={handlePlayMidi}
                className="flex-1 rounded-xl active:scale-95 transition-transform"
              >
                {isPlayingMidi ? (
                  <>
                    <Pause className="h-5 w-5 mr-2" />
                    Pausar Prévia
                  </>
                ) : (
                  <>
                    <Music className="h-5 w-5 mr-2" />
                    Ouvir Prévia
                  </>
                )}
              </Button>
              <Button
                variant="default"
                size="lg"
                onClick={handleExportMidi}
                className="flex-1 rounded-xl active:scale-95 transition-transform"
              >
                <Download className="h-5 w-5 mr-2" />
                Exportar MIDI
              </Button>
            </div>
          )}
        </Card>

        {/* Sheet Music Visualization */}
        {detectedNotes.length > 0 && (
          <Card className="p-4 sm:p-6 rounded-2xl shadow-elegant border-primary/10">
            <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
              <Music className="h-5 w-5 text-primary" />
              Partitura Musical
            </h2>
            <SheetMusicNotation notes={detectedNotes} />
          </Card>
        )}

        {detectedNotes.length === 0 && !isRecording && (
          <Card className="p-12 text-center rounded-2xl border-dashed">
            <Mic className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">
              Clique em "Iniciar Gravação" para começar a capturar áudio e converter em partitura
            </p>
          </Card>
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
    </div>
  );
}
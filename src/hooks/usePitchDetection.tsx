import { useState, useRef, useCallback } from 'react';

export interface DetectedNote {
  pitch: number; // frequency in Hz
  noteName: string;
  time: number; // timestamp in seconds
  confidence: number;
}

export const usePitchDetection = () => {
  const [detectedNotes, setDetectedNotes] = useState<DetectedNote[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

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

  const autoCorrelate = (buffer: Float32Array, sampleRate: number): number => {
    let SIZE = buffer.length;
    let rms = 0;

    for (let i = 0; i < SIZE; i++) {
      const val = buffer[i];
      rms += val * val;
    }
    rms = Math.sqrt(rms / SIZE);

    // Threshold mais sensível para captar sons mais suaves
    if (rms < 0.005) return -1;

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

  const analyzePitch = useCallback(() => {
    if (!analyserRef.current || !isAnalyzing || !audioContextRef.current) return;

    const bufferLength = analyserRef.current.fftSize;
    const buffer = new Float32Array(bufferLength);
    analyserRef.current.getFloatTimeDomainData(buffer);
    
    const sampleRate = audioContextRef.current.sampleRate;
    const frequency = autoCorrelate(buffer, sampleRate);

    // Log para debug
    if (frequency > 0) {
      console.log('Frequência detectada:', frequency);
    }

    // Range expandido: C2 (65Hz) até C7 (2093Hz)
    if (frequency >= 60 && frequency <= 2100) {
      const currentTime = (Date.now() - startTimeRef.current) / 1000;
      const noteName = frequencyToNoteName(frequency);
      
      if (noteName) {
        const confidence = Math.min(1, Math.abs(frequency) / 1000);
        
        setDetectedNotes(prev => {
          const lastNote = prev[prev.length - 1];
          
          // Agrupa notas similares com tolerância maior
          if (lastNote && Math.abs(lastNote.pitch - frequency) < 30 && 
              currentTime - lastNote.time < 0.3) {
            return prev;
          }
          
          const newNote = {
            pitch: frequency,
            noteName,
            time: currentTime,
            confidence
          };
          
          console.log('Nova nota detectada:', newNote);
          
          return [...prev, newNote];
        });
      }
    }

    animationFrameRef.current = requestAnimationFrame(analyzePitch);
  }, [isAnalyzing]);

  const startAnalysis = useCallback(async () => {
    try {
      console.log('Iniciando análise de pitch...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        } 
      });
      
      micStreamRef.current = stream;
      audioContextRef.current = new AudioContext({ sampleRate: 44100 });
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 4096; // FFT maior para melhor precisão
      analyserRef.current.smoothingTimeConstant = 0.8;
      
      source.connect(analyserRef.current);

      setIsAnalyzing(true);
      setDetectedNotes([]);
      startTimeRef.current = Date.now();
      
      console.log('AudioContext criado, iniciando análise contínua...');
      analyzePitch();
    } catch (error) {
      console.error('Erro ao iniciar análise de pitch:', error);
      throw error;
    }
  }, [analyzePitch]);

  const stopAnalysis = useCallback(() => {
    setIsAnalyzing(false);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
  }, []);

  const clearNotes = useCallback(() => {
    setDetectedNotes([]);
  }, []);

  return {
    detectedNotes,
    isAnalyzing,
    startAnalysis,
    stopAnalysis,
    clearNotes
  };
};

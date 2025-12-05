import type { DetectedNote } from '@/hooks/usePitchDetection';

// Função para converter nome de nota para MIDI number
const noteNameToMidiNumber = (noteName: string): number => {
  const noteMap: { [key: string]: number } = {
    'C': 0, 'C#': 1, 'D': 2, 'D#': 3, 'E': 4, 'F': 5,
    'F#': 6, 'G': 7, 'G#': 8, 'A': 9, 'A#': 10, 'B': 11
  };
  
  const note = noteName.slice(0, -1);
  const octave = parseInt(noteName.slice(-1));
  
  return (octave + 1) * 12 + noteMap[note];
};

// Cria um arquivo MIDI simples manualmente
const createMidiFile = (notes: Array<{ note: number; time: number; duration: number; velocity: number }>): Uint8Array => {
  const tracks: number[] = [];
  
  // Header do MIDI
  const header = [
    0x4D, 0x54, 0x68, 0x64, // "MThd"
    0x00, 0x00, 0x00, 0x06, // Header length
    0x00, 0x00, // Format 0
    0x00, 0x01, // One track
    0x00, 0x60  // 96 ticks per quarter note
  ];
  
  // Início do track
  const trackHeader = [
    0x4D, 0x54, 0x72, 0x6B // "MTrk"
  ];
  
  // Converte tempo para ticks
  const ticksPerBeat = 96;
  const beatsPerSecond = 2; // 120 BPM
  const ticksPerSecond = ticksPerBeat * beatsPerSecond;
  
  // Adiciona eventos MIDI
  notes.forEach(({ note, time, duration, velocity }) => {
    const ticks = Math.round(time * ticksPerSecond);
    const durationTicks = Math.round(duration * ticksPerSecond);
    const vel = Math.round(velocity * 127);
    
    // Note On
    tracks.push(...encodeVariableLength(ticks));
    tracks.push(0x90, note, vel);
    
    // Note Off
    tracks.push(...encodeVariableLength(durationTicks));
    tracks.push(0x80, note, 0);
  });
  
  // End of track
  tracks.push(0x00, 0xFF, 0x2F, 0x00);
  
  // Track length
  const trackLength = tracks.length;
  const lengthBytes = [
    (trackLength >> 24) & 0xFF,
    (trackLength >> 16) & 0xFF,
    (trackLength >> 8) & 0xFF,
    trackLength & 0xFF
  ];
  
  return new Uint8Array([...header, ...trackHeader, ...lengthBytes, ...tracks]);
};

// Codifica tempo variável do MIDI
const encodeVariableLength = (value: number): number[] => {
  const bytes: number[] = [];
  bytes.push(value & 0x7F);
  
  let v = value >> 7;
  while (v > 0) {
    bytes.unshift((v & 0x7F) | 0x80);
    v >>= 7;
  }
  
  return bytes;
};

// Processa notas detectadas para MIDI
const processNotesForMidi = (notes: DetectedNote[]): Array<{ note: number; time: number; duration: number; velocity: number }> => {
  const midiNotes: Array<{ note: number; time: number; duration: number; velocity: number }> = [];
  
  for (let i = 0; i < notes.length; i++) {
    const current = notes[i];
    const next = notes[i + 1];
    
    const duration = next ? (next.time - current.time) : 0.5;
    const velocity = Math.min(1, current.confidence * 0.8 + 0.2);
    
    if (duration > 0.05 && duration < 10) {
      midiNotes.push({
        note: noteNameToMidiNumber(current.noteName),
        time: current.time,
        duration,
        velocity
      });
    }
  }
  
  return midiNotes;
};

// Cria um blob MIDI a partir das notas detectadas
export const createMidiBlob = (notes: DetectedNote[]): Blob => {
  const midiNotes = processNotesForMidi(notes);
  const midiData = createMidiFile(midiNotes);
  return new Blob([midiData.buffer as ArrayBuffer], { type: 'audio/midi' });
};

export const exportToMidi = async (notes: DetectedNote[], filename: string = 'recording.mid') => {
  if (notes.length === 0) {
    throw new Error('Nenhuma nota detectada para exportar');
  }

  // Gera o arquivo MIDI usando a função compartilhada
  const blob = createMidiBlob(notes);
  
  // Download
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

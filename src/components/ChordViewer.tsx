import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Minus, RotateCcw, Music } from 'lucide-react';
import ChordSheetJS from 'chordsheetjs';

interface ChordViewerProps {
  chords: string;
}

const CHORD_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHORD_NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Função para detectar o tom original a partir dos acordes
const detectOriginalKey = (chords: string): string | null => {
  const chordPattern = /\[([A-G][#b]?m?[^[\]]*)\]/g;
  const matches = chords.match(chordPattern);
  if (matches && matches.length > 0) {
    const firstChord = matches[0].replace(/[\[\]]/g, '').replace(/m.*$/, '').replace(/7.*$/, '');
    return firstChord;
  }
  
  // Para formato texto simples, procura acordes no início das linhas
  const lines = chords.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    const match = trimmed.match(/^([A-G][#b]?)/);
    if (match) {
      return match[1];
    }
  }
  
  return null;
};

// Transpõe um acorde por n semitons
const transposeChord = (chord: string, semitones: number): string => {
  const chordMatch = chord.match(/^([A-G])([#b]?)(.*)/);
  if (!chordMatch) return chord;
  
  const [, root, accidental, suffix] = chordMatch;
  
  let noteIndex = CHORD_NOTES.indexOf(root);
  if (noteIndex === -1) return chord;
  
  // Ajusta para acidentes
  if (accidental === '#') {
    noteIndex = (noteIndex + 1) % 12;
  } else if (accidental === 'b') {
    noteIndex = (noteIndex - 1 + 12) % 12;
  }
  
  // Aplica transposição
  const newIndex = (noteIndex + semitones + 120) % 12; // +120 para evitar negativos
  
  // Usa bemóis para certos acordes para melhor legibilidade
  const useFlatNotation = semitones < 0;
  const newNote = useFlatNotation ? CHORD_NOTES_FLAT[newIndex] : CHORD_NOTES[newIndex];
  
  return newNote + suffix;
};

// Processa o texto transpondo todos os acordes
const processChords = (text: string, semitones: number): string => {
  if (semitones === 0) return text;
  
  // Formato ChordPro: [Acorde]
  const chordProProcessed = text.replace(/\[([A-G][#b]?[^\]]*)\]/g, (match, chord) => {
    return `[${transposeChord(chord, semitones)}]`;
  });
  
  // Formato texto simples: linhas que são apenas acordes
  const lines = chordProProcessed.split('\n');
  const processedLines = lines.map(line => {
    // Se a linha parece ser apenas acordes (espaços e acordes)
    if (/^[\s]*([A-G][#b]?[m7dim+sus2469\/]*)[\s]*/.test(line) && !/[a-z]{3,}/i.test(line.replace(/[A-G][#b]?[m7dim+sus2469\/]*/g, ''))) {
      return line.replace(/([A-G][#b]?[m7dim+sus2469\/]*)/g, (match) => {
        return transposeChord(match, semitones);
      });
    }
    return line;
  });
  
  return processedLines.join('\n');
};

// Renderiza o conteúdo com acordes destacados
const renderChordsHtml = (text: string): JSX.Element[] => {
  const lines = text.split('\n');
  
  return lines.map((line, lineIndex) => {
    // Formato ChordPro: substitui [Acorde] por spans destacados
    if (line.includes('[') && line.includes(']')) {
      const parts: (string | JSX.Element)[] = [];
      let lastIndex = 0;
      const regex = /\[([^\]]+)\]/g;
      let match;
      let partKey = 0;
      
      while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push(line.substring(lastIndex, match.index));
        }
        parts.push(
          <span key={`chord-${lineIndex}-${partKey++}`} className="chord-highlight">
            {match[1]}
          </span>
        );
        lastIndex = regex.lastIndex;
      }
      
      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }
      
      return (
        <div key={lineIndex} className="chord-line">
          {parts}
        </div>
      );
    }
    
    // Linha que parece ser apenas acordes
    const isChordLine = /^[\s]*([A-G][#b]?[m7dim+sus2469\/]*)[\s]*/.test(line) && 
                        !/[a-z]{3,}/i.test(line.replace(/[A-G][#b]?[m7dim+sus2469\/]*/g, ''));
    
    if (isChordLine && line.trim()) {
      const parts: (string | JSX.Element)[] = [];
      let lastIndex = 0;
      const regex = /([A-G][#b]?[m7dim+sus2469\/]*)/g;
      let match;
      let partKey = 0;
      
      while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push(line.substring(lastIndex, match.index));
        }
        parts.push(
          <span key={`chord-${lineIndex}-${partKey++}`} className="chord-highlight">
            {match[1]}
          </span>
        );
        lastIndex = regex.lastIndex;
      }
      
      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }
      
      return (
        <div key={lineIndex} className="chord-line chord-only">
          {parts}
        </div>
      );
    }
    
    // Linha normal de letra
    return (
      <div key={lineIndex} className="lyrics-line">
        {line || '\u00A0'}
      </div>
    );
  });
};

const ChordViewer = ({ chords }: ChordViewerProps) => {
  const [transpose, setTranspose] = useState(0);
  
  const originalKey = useMemo(() => detectOriginalKey(chords), [chords]);
  
  const transposedChords = useMemo(() => {
    return processChords(chords, transpose);
  }, [chords, transpose]);
  
  const currentKey = useMemo(() => {
    if (!originalKey) return null;
    return transposeChord(originalKey, transpose);
  }, [originalKey, transpose]);
  
  const handleTransposeUp = () => setTranspose(t => t + 1);
  const handleTransposeDown = () => setTranspose(t => t - 1);
  const handleReset = () => setTranspose(0);
  
  return (
    <div className="space-y-3">
      {/* Controles de Transposição */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTransposeDown}
            className="h-8 w-8 p-0"
          >
            <Minus className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleTransposeUp}
            className="h-8 w-8 p-0"
          >
            <Plus className="h-4 w-4" />
          </Button>
          {transpose !== 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="h-8 px-2 text-xs"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Resetar
            </Button>
          )}
        </div>
        
        {currentKey && (
          <div className="text-sm text-muted-foreground flex items-center gap-1">
            <Music className="h-3.5 w-3.5" />
            <span>Tom:</span>
            {transpose !== 0 ? (
              <>
                <span className="line-through opacity-50">{originalKey}</span>
                <span className="mx-1">→</span>
                <span className="font-bold text-primary">{currentKey}</span>
                <span className="text-xs opacity-70">
                  ({transpose > 0 ? '+' : ''}{transpose})
                </span>
              </>
            ) : (
              <span className="font-bold text-primary">{originalKey}</span>
            )}
          </div>
        )}
      </div>
      
      {/* Conteúdo da Cifra */}
      <div className="chord-sheet rounded-lg bg-secondary/30 p-4 overflow-x-auto">
        <div className="chord-content">
          {renderChordsHtml(transposedChords)}
        </div>
      </div>
    </div>
  );
};

export default ChordViewer;

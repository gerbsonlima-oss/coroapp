import { useState, useMemo } from 'react';
import { X, Plus, Minus, Type, Music, Moon, Sun } from 'lucide-react';

interface FullscreenChordViewerProps {
  chords: string;
  songName?: string;
  onClose: () => void;
}

const CHORD_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHORD_NOTES_FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const detectOriginalKey = (chords: string): string | null => {
  const chordPattern = /\[([A-G][#b]?m?[^[\]]*)\]/g;
  const matches = chords.match(chordPattern);
  if (matches && matches.length > 0) {
    const firstChord = matches[0].replace(/[\[\]]/g, '').replace(/m.*$/, '').replace(/7.*$/, '');
    return firstChord;
  }
  
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

const transposeChord = (chord: string, semitones: number): string => {
  const chordMatch = chord.match(/^([A-G])([#b]?)(.*)/);
  if (!chordMatch) return chord;
  
  const [, root, accidental, suffix] = chordMatch;
  
  let noteIndex = CHORD_NOTES.indexOf(root);
  if (noteIndex === -1) return chord;
  
  if (accidental === '#') {
    noteIndex = (noteIndex + 1) % 12;
  } else if (accidental === 'b') {
    noteIndex = (noteIndex - 1 + 12) % 12;
  }
  
  const newIndex = (noteIndex + semitones + 120) % 12;
  const useFlatNotation = semitones < 0;
  const newNote = useFlatNotation ? CHORD_NOTES_FLAT[newIndex] : CHORD_NOTES[newIndex];
  
  return newNote + suffix;
};

const processChords = (text: string, semitones: number): string => {
  if (semitones === 0) return text;
  
  const chordProProcessed = text.replace(/\[([A-G][#b]?[^\]]*)\]/g, (match, chord) => {
    return `[${transposeChord(chord, semitones)}]`;
  });
  
  const lines = chordProProcessed.split('\n');
  const processedLines = lines.map(line => {
    if (/^[\s]*([A-G][#b]?[m7dim+sus2469\/]*)[\s]*/.test(line) && !/[a-z]{3,}/i.test(line.replace(/[A-G][#b]?[m7dim+sus2469\/]*/g, ''))) {
      return line.replace(/([A-G][#b]?[m7dim+sus2469\/]*)/g, (match) => {
        return transposeChord(match, semitones);
      });
    }
    return line;
  });
  
  return processedLines.join('\n');
};

const renderChordsHtml = (text: string, isNightMode: boolean): JSX.Element[] => {
  const lines = text.split('\n');
  const chordClass = isNightMode ? 'text-amber-400 font-bold' : 'text-primary font-bold';
  const lyricClass = isNightMode ? 'text-neutral-200' : 'text-foreground/90';
  
  return lines.map((line, lineIndex) => {
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
          <span key={`chord-${lineIndex}-${partKey++}`} className={chordClass}>
            {match[1]}
          </span>
        );
        lastIndex = regex.lastIndex;
      }
      
      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }
      
      return (
        <div key={lineIndex} className="leading-tight">
          {parts}
        </div>
      );
    }
    
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
          <span key={`chord-${lineIndex}-${partKey++}`} className={chordClass}>
            {match[1]}
          </span>
        );
        lastIndex = regex.lastIndex;
      }
      
      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }
      
      return (
        <div key={lineIndex} className={`leading-tight ${chordClass}`}>
          {parts}
        </div>
      );
    }
    
    return (
      <div key={lineIndex} className={`leading-tight ${lyricClass}`}>
        {line || '\u00A0'}
      </div>
    );
  });
};

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28];

const FullscreenChordViewer = ({ chords, songName, onClose }: FullscreenChordViewerProps) => {
  const [transpose, setTranspose] = useState(0);
  const [fontSizeIndex, setFontSizeIndex] = useState(2);
  const [isNightMode, setIsNightMode] = useState(() => {
    return localStorage.getItem('chordViewer_nightMode') === 'true';
  });
  
  const originalKey = useMemo(() => detectOriginalKey(chords), [chords]);
  
  const transposedChords = useMemo(() => {
    return processChords(chords, transpose);
  }, [chords, transpose]);
  
  const currentKey = useMemo(() => {
    if (!originalKey) return null;
    return transposeChord(originalKey, transpose);
  }, [originalKey, transpose]);
  
  const fontSize = FONT_SIZES[fontSizeIndex];
  
  const handleFontUp = () => setFontSizeIndex(i => Math.min(i + 1, FONT_SIZES.length - 1));
  const handleFontDown = () => setFontSizeIndex(i => Math.max(i - 1, 0));
  const handleTransposeUp = () => setTranspose(t => t + 1);
  const handleTransposeDown = () => setTranspose(t => t - 1);
  const toggleNightMode = () => {
    setIsNightMode(prev => {
      const newValue = !prev;
      localStorage.setItem('chordViewer_nightMode', String(newValue));
      return newValue;
    });
  };
  
  return (
    <div className={`fixed inset-0 z-[100] flex flex-col transition-colors duration-300 ${
      isNightMode ? 'bg-neutral-950' : 'bg-background'
    }`}>
      {/* Header minimalista */}
      <div className={`flex items-center justify-between px-2 py-1.5 border-b shrink-0 transition-colors duration-300 ${
        isNightMode 
          ? 'border-neutral-800 bg-neutral-950/95' 
          : 'border-border/30 bg-background/95 backdrop-blur-sm'
      }`}>
        {/* Controles de Tom */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleTransposeDown}
            className={`h-8 w-8 flex items-center justify-center rounded transition-colors ${
              isNightMode 
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 active:bg-neutral-700' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted'
            }`}
          >
            <Minus className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-0.5 px-1 min-w-[48px] justify-center">
            <Music className={`h-3 w-3 ${isNightMode ? 'text-neutral-500' : 'text-muted-foreground'}`} />
            <span className={`text-xs font-bold ${isNightMode ? 'text-amber-400' : 'text-primary'}`}>
              {currentKey || '—'}
            </span>
            {transpose !== 0 && (
              <span className={`text-[10px] ${isNightMode ? 'text-neutral-500' : 'text-muted-foreground'}`}>
                {transpose > 0 ? '+' : ''}{transpose}
              </span>
            )}
          </div>
          <button
            onClick={handleTransposeUp}
            className={`h-8 w-8 flex items-center justify-center rounded transition-colors ${
              isNightMode 
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 active:bg-neutral-700' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted'
            }`}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        
        {/* Controles de Fonte */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={handleFontDown}
            disabled={fontSizeIndex === 0}
            className={`h-8 w-8 flex items-center justify-center rounded transition-colors disabled:opacity-30 ${
              isNightMode 
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 active:bg-neutral-700' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted'
            }`}
          >
            <Type className="h-3 w-3" />
          </button>
          <span className={`text-[10px] w-6 text-center ${isNightMode ? 'text-neutral-500' : 'text-muted-foreground'}`}>
            {fontSize}
          </span>
          <button
            onClick={handleFontUp}
            disabled={fontSizeIndex === FONT_SIZES.length - 1}
            className={`h-8 w-8 flex items-center justify-center rounded transition-colors disabled:opacity-30 ${
              isNightMode 
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 active:bg-neutral-700' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted'
            }`}
          >
            <Type className="h-4 w-4" />
          </button>
        </div>
        
        {/* Botão Modo Noturno + Fechar */}
        <div className="flex items-center gap-0.5">
          <button
            onClick={toggleNightMode}
            className={`h-8 w-8 flex items-center justify-center rounded transition-colors ${
              isNightMode 
                ? 'text-amber-400 hover:text-amber-300 hover:bg-neutral-800 active:bg-neutral-700' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted'
            }`}
            title={isNightMode ? 'Modo claro' : 'Modo noturno'}
          >
            {isNightMode ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            onClick={onClose}
            className={`h-8 w-8 flex items-center justify-center rounded transition-colors ${
              isNightMode 
                ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 active:bg-neutral-700' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted'
            }`}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {/* Conteúdo da Cifra */}
      <div className="flex-1 overflow-auto px-3 py-2">
        <pre 
          className="font-mono whitespace-pre-wrap break-words"
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.4 }}
        >
          {renderChordsHtml(transposedChords, isNightMode)}
        </pre>
      </div>
    </div>
  );
};

export default FullscreenChordViewer;

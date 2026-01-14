import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { X, Plus, Minus, Type, Music, Moon, Sun, Play, Pause, ChevronUp, ChevronDown, RefreshCw } from 'lucide-react';

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
  const chordClass = isNightMode ? 'text-amber-400 font-bold' : 'text-primary font-bold';
  const lyricClass = isNightMode ? 'text-neutral-200' : 'text-foreground/90';
  
  // Helper to render a single line with chord highlighting
  const renderLine = (line: string, lineIndex: number, keyPrefix: string = ''): JSX.Element => {
    // Check if line has ChordPro format [C], [G], etc.
    if (line.includes('[') && line.includes(']')) {
      const parts: (string | JSX.Element)[] = [];
      let lastIndex = 0;
      const regex = /\[([A-G][#b]?[m7dim+sus2469\/]*)\]/g;
      let match;
      let partKey = 0;
      
      while ((match = regex.exec(line)) !== null) {
        if (match.index > lastIndex) {
          parts.push(line.substring(lastIndex, match.index));
        }
        parts.push(
          <span key={`chord-${keyPrefix}${lineIndex}-${partKey++}`} className={chordClass}>
            {match[1]}
          </span>
        );
        lastIndex = regex.lastIndex;
      }
      
      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }
      
      return (
        <div key={`${keyPrefix}${lineIndex}`} className="leading-tight">
          {parts.length > 0 ? parts : '\u00A0'}
        </div>
      );
    }
    
    // Check if it's a chord line (traditional format)
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
          <span key={`chord-${keyPrefix}${lineIndex}-${partKey++}`} className={chordClass}>
            {match[1]}
          </span>
        );
        lastIndex = regex.lastIndex;
      }
      
      if (lastIndex < line.length) {
        parts.push(line.substring(lastIndex));
      }
      
      return (
        <div key={`${keyPrefix}${lineIndex}`} className={`leading-tight ${chordClass}`}>
          {parts}
        </div>
      );
    }
    
    return (
      <div key={`${keyPrefix}${lineIndex}`} className={`leading-tight ${lyricClass}`}>
        {line || '\u00A0'}
      </div>
    );
  };

  // Parse section markers: [REFRÃO]...[/REFRÃO] and [1]...[/1], [2]...[/2], etc.
  const sectionRegex = /\[(REFRÃO|REFRAO|\d+)\]([\s\S]*?)\[\/\1\]/gi;
  const sections: { type: string; content: string; start: number; end: number }[] = [];
  let match;
  
  while ((match = sectionRegex.exec(text)) !== null) {
    sections.push({
      type: match[1].toUpperCase(),
      content: match[2],
      start: match.index,
      end: sectionRegex.lastIndex
    });
  }

  // If no sections, render lines normally
  if (sections.length === 0) {
    return text.split('\n').map((line, idx) => renderLine(line, idx));
  }

  // Render with sections
  const result: JSX.Element[] = [];
  let lastEnd = 0;

  sections.forEach((section, sectionIdx) => {
    // Render content before this section
    if (section.start > lastEnd) {
      const beforeContent = text.substring(lastEnd, section.start).trim();
      if (beforeContent) {
        const beforeLines = beforeContent.split('\n');
        beforeLines.forEach((line, idx) => {
          result.push(renderLine(line, idx, `before-${sectionIdx}-`));
        });
        result.push(<div key={`spacer-before-${sectionIdx}`} className="h-2" />);
      }
    }

    const isRefrain = section.type === 'REFRÃO' || section.type === 'REFRAO';
    const verseNumber = !isRefrain ? parseInt(section.type) : null;
    const sectionLines = section.content.trim().split('\n');

    if (isRefrain) {
      // Render refrain section with visual badge
      result.push(
        <div 
          key={`refrain-${sectionIdx}`}
          className={`mb-4 rounded-lg p-3 ${
            isNightMode 
              ? 'bg-amber-900/30 border border-amber-700/50' 
              : 'bg-primary/10 border border-primary/30'
          }`}
        >
          <div className={`flex items-center gap-2 mb-2 ${
            isNightMode ? 'text-amber-400' : 'text-primary'
          }`}>
            <div className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-sm ${
              isNightMode 
                ? 'bg-amber-500 text-black' 
                : 'bg-primary text-primary-foreground'
            }`}>
              <RefreshCw className="w-4 h-4" />
            </div>
            <span className="font-bold text-base tracking-wide">REFRÃO</span>
          </div>
          <div className="pl-1">
            {sectionLines.map((line, idx) => renderLine(line, idx, `refrain-${sectionIdx}-`))}
          </div>
        </div>
      );
    } else if (verseNumber) {
      // Render numbered verse with visual badge
      result.push(
        <div key={`verse-${sectionIdx}`} className="mb-4">
          <div className="flex items-center gap-2 mb-2">
            <div className={`flex items-center justify-center w-7 h-7 rounded-full font-bold text-lg ${
              isNightMode 
                ? 'bg-amber-500 text-black' 
                : 'bg-primary text-primary-foreground'
            }`}>
              {verseNumber}
            </div>
          </div>
          <div className="pl-1">
            {sectionLines.map((line, idx) => renderLine(line, idx, `verse-${sectionIdx}-`))}
          </div>
        </div>
      );
    }

    lastEnd = section.end;
  });

  // Render any remaining content after last section
  if (lastEnd < text.length) {
    const afterContent = text.substring(lastEnd).trim();
    if (afterContent) {
      result.push(<div key="spacer-after" className="h-2" />);
      const afterLines = afterContent.split('\n');
      afterLines.forEach((line, idx) => {
        result.push(renderLine(line, idx, `after-`));
      });
    }
  }

  return result;
};

const FONT_SIZES = [12, 14, 16, 18, 20, 24, 28];
const SCROLL_SPEEDS = [
  { label: '0.5x', value: 0.3 },
  { label: '1x', value: 0.6 },
  { label: '1.5x', value: 1 },
  { label: '2x', value: 1.5 },
  { label: '3x', value: 2.5 },
];

const FullscreenChordViewer = ({ chords, songName, onClose }: FullscreenChordViewerProps) => {
  const [transpose, setTranspose] = useState(0);
  const [fontSizeIndex, setFontSizeIndex] = useState(2);
  const [isNightMode, setIsNightMode] = useState(() => {
    return localStorage.getItem('chordViewer_nightMode') === 'true';
  });
  const [isAutoScrolling, setIsAutoScrolling] = useState(false);
  const [scrollSpeedIndex, setScrollSpeedIndex] = useState(() => {
    const saved = localStorage.getItem('chordViewer_scrollSpeed');
    return saved ? parseInt(saved, 10) : 1; // Default 1x
  });
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  
  const originalKey = useMemo(() => detectOriginalKey(chords), [chords]);
  
  const transposedChords = useMemo(() => {
    return processChords(chords, transpose);
  }, [chords, transpose]);
  
  const currentKey = useMemo(() => {
    if (!originalKey) return null;
    return transposeChord(originalKey, transpose);
  }, [originalKey, transpose]);
  
  const fontSize = FONT_SIZES[fontSizeIndex];
  const scrollSpeed = SCROLL_SPEEDS[scrollSpeedIndex].value;
  
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
  
  const handleSpeedUp = () => {
    setScrollSpeedIndex(i => {
      const newIndex = Math.min(i + 1, SCROLL_SPEEDS.length - 1);
      localStorage.setItem('chordViewer_scrollSpeed', String(newIndex));
      return newIndex;
    });
  };
  
  const handleSpeedDown = () => {
    setScrollSpeedIndex(i => {
      const newIndex = Math.max(i - 1, 0);
      localStorage.setItem('chordViewer_scrollSpeed', String(newIndex));
      return newIndex;
    });
  };
  
  const autoScroll = useCallback((timestamp: number) => {
    if (!scrollContainerRef.current) return;
    
    if (lastTimeRef.current === 0) {
      lastTimeRef.current = timestamp;
    }
    
    const deltaTime = timestamp - lastTimeRef.current;
    lastTimeRef.current = timestamp;
    
    const container = scrollContainerRef.current;
    const maxScroll = container.scrollHeight - container.clientHeight;
    
    if (container.scrollTop < maxScroll) {
      container.scrollTop += scrollSpeed * (deltaTime / 16); // Normalize to ~60fps
      animationFrameRef.current = requestAnimationFrame(autoScroll);
    } else {
      setIsAutoScrolling(false);
    }
  }, [scrollSpeed]);
  
  useEffect(() => {
    if (isAutoScrolling) {
      lastTimeRef.current = 0;
      animationFrameRef.current = requestAnimationFrame(autoScroll);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    }
    
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isAutoScrolling, autoScroll]);
  
  // Stop auto-scroll on manual scroll
  const handleScroll = () => {
    if (isAutoScrolling && animationFrameRef.current) {
      // User manually scrolled, don't stop - let them adjust position
    }
  };
  
  const toggleAutoScroll = () => {
    setIsAutoScrolling(prev => !prev);
  };
  
  const buttonClass = (isNightMode: boolean) => `h-8 w-8 flex items-center justify-center rounded transition-colors ${
    isNightMode 
      ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800 active:bg-neutral-700' 
      : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 active:bg-muted'
  }`;
  
  return (
    <div className={`fixed inset-0 z-[100] flex flex-col transition-colors duration-300 ${
      isNightMode ? 'bg-neutral-950' : 'bg-background'
    }`}>
      {/* Header minimalista */}
      <div className={`flex items-center justify-between px-1.5 py-1 border-b shrink-0 transition-colors duration-300 ${
        isNightMode 
          ? 'border-neutral-800 bg-neutral-950/95' 
          : 'border-border/30 bg-background/95 backdrop-blur-sm'
      }`}>
        {/* Controles de Tom */}
        <div className="flex items-center gap-0">
          <button onClick={handleTransposeDown} className={buttonClass(isNightMode)}>
            <Minus className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-0.5 px-0.5 min-w-[40px] justify-center">
            <Music className={`h-3 w-3 ${isNightMode ? 'text-neutral-500' : 'text-muted-foreground'}`} />
            <span className={`text-xs font-bold ${isNightMode ? 'text-amber-400' : 'text-primary'}`}>
              {currentKey || '—'}
            </span>
          </div>
          <button onClick={handleTransposeUp} className={buttonClass(isNightMode)}>
            <Plus className="h-4 w-4" />
          </button>
        </div>
        
        {/* Auto-scroll */}
        <div className="flex items-center gap-0">
          <button 
            onClick={handleSpeedDown}
            disabled={scrollSpeedIndex === 0}
            className={`${buttonClass(isNightMode)} disabled:opacity-30`}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
          <button 
            onClick={toggleAutoScroll}
            className={`h-8 px-2 flex items-center justify-center gap-1 rounded transition-colors ${
              isAutoScrolling
                ? isNightMode 
                  ? 'text-green-400 bg-green-400/20' 
                  : 'text-green-600 bg-green-500/20'
                : isNightMode 
                  ? 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800' 
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            {isAutoScrolling ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            <span className={`text-[10px] font-medium ${isNightMode ? 'text-neutral-400' : 'text-muted-foreground'}`}>
              {SCROLL_SPEEDS[scrollSpeedIndex].label}
            </span>
          </button>
          <button 
            onClick={handleSpeedUp}
            disabled={scrollSpeedIndex === SCROLL_SPEEDS.length - 1}
            className={`${buttonClass(isNightMode)} disabled:opacity-30`}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
        </div>
        
        {/* Fonte + Modo Noturno + Fechar */}
        <div className="flex items-center gap-0">
          <button
            onClick={handleFontDown}
            disabled={fontSizeIndex === 0}
            className={`${buttonClass(isNightMode)} disabled:opacity-30`}
          >
            <Type className="h-3 w-3" />
          </button>
          <button
            onClick={handleFontUp}
            disabled={fontSizeIndex === FONT_SIZES.length - 1}
            className={`${buttonClass(isNightMode)} disabled:opacity-30`}
          >
            <Type className="h-4 w-4" />
          </button>
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
          <button onClick={onClose} className={buttonClass(isNightMode)}>
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>
      
      {/* Conteúdo da Cifra */}
      <div 
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto px-3 py-2"
      >
        <pre 
          className="font-mono whitespace-pre-wrap break-words"
          style={{ fontSize: `${fontSize}px`, lineHeight: 1.4 }}
        >
          {renderChordsHtml(transposedChords, isNightMode)}
        </pre>
        {/* Extra space at bottom for auto-scroll to reach end */}
        <div className="h-[50vh]" />
      </div>
    </div>
  );
};

export default FullscreenChordViewer;

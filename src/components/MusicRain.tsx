import { useEffect, useState } from 'react';
import { Music, Music2 } from 'lucide-react';

const colors = [
  'text-red-500',
  'text-orange-500',
  'text-yellow-500',
  'text-green-500',
  'text-blue-500',
  'text-indigo-500',
  'text-purple-500',
  'text-pink-500',
  'text-cyan-500',
  'text-lime-500',
  'text-rose-500',
  'text-amber-500',
];

const TrebleClef = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 48 48" className={className} style={style} fill="currentColor">
    <path d="M24 4c-2 0-4 1-4 3v8c0 2 2 4 4 4s4-2 4-4V7c0-2-2-3-4-3zm0 20c-4 0-8-2-8-6s4-6 8-6 8 2 8 6-4 6-8 6zm0 6c-6 0-10 4-10 10s4 10 10 10 10-4 10-10-4-10-10-10z" />
  </svg>
);

const BassClef = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 48 48" className={className} style={style} fill="currentColor">
    <circle cx="24" cy="20" r="4" />
    <circle cx="20" cy="14" r="2" />
    <circle cx="28" cy="14" r="2" />
    <path d="M24 8v24M20 30h8" strokeWidth="2" stroke="currentColor" fill="none" />
  </svg>
);

const AltoClef = ({ className, style }: { className?: string; style?: React.CSSProperties }) => (
  <svg viewBox="0 0 48 48" className={className} style={style} fill="currentColor">
    <path d="M24 8v32M20 14h8M20 22h8M20 30h8" strokeWidth="3" stroke="currentColor" fill="none" />
    <circle cx="24" cy="22" r="6" fill="currentColor" opacity="0.6" />
  </svg>
);

interface Note {
  id: number;
  left: string;
  color: string;
  duration: number;
  delay: number;
  size: number;
  clefType: 0 | 1 | 2 | 3;
}

interface MusicRainProps {
  onComplete?: () => void;
}

export const MusicRain = ({ onComplete }: MusicRainProps) => {
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    const noteCount = 60;
    const generatedNotes: Note[] = Array.from({ length: noteCount }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 4 + Math.random() * 2,
      delay: (i / noteCount) * 1.2,
      size: 28 + Math.random() * 28,
      clefType: (Math.floor(Math.random() * 4) as 0 | 1 | 2 | 3),
    }));

    setNotes(generatedNotes);

    const maxDuration = Math.max(...generatedNotes.map(n => n.duration + n.delay));
    const timer = setTimeout(() => {
      onComplete?.();
    }, (maxDuration + 1) * 1000);

    return () => clearTimeout(timer);
  }, [onComplete]);

  const renderClef = (clefType: number, color: string, size: number) => {
    const baseClass = `${color} animate-spin drop-shadow-lg`;
    const svgStyle = { width: `${size}px`, height: `${size}px` };
    
    switch (clefType) {
      case 0:
        return <TrebleClef className={baseClass} style={svgStyle} />;
      case 1:
        return <BassClef className={baseClass} style={svgStyle} />;
      case 2:
        return <AltoClef className={baseClass} style={svgStyle} />;
      default:
        return (
          <Music 
            className={baseClass}
            size={size}
            strokeWidth={1.5}
          />
        );
    }
  };

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
      {notes.map((note) => (
        <div
          key={note.id}
          className="absolute animate-fall"
          style={{
            left: note.left,
            top: '-50px',
            animation: `fall ${note.duration}s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${note.delay}s forwards`,
            opacity: 1,
          }}
        >
          {renderClef(note.clefType, note.color, note.size)}
        </div>
      ))}
    </div>
  );
};

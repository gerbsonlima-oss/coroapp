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

interface Note {
  id: number;
  left: string;
  color: string;
  duration: number;
  delay: number;
  size: number;
  isMusic2: boolean;
}

interface MusicRainProps {
  onComplete?: () => void;
}

export const MusicRain = ({ onComplete }: MusicRainProps) => {
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    const noteCount = 50;
    const generatedNotes: Note[] = Array.from({ length: noteCount }, (_, i) => ({
      id: i,
      left: `${Math.random() * 100}%`,
      color: colors[Math.floor(Math.random() * colors.length)],
      duration: 3.5 + Math.random() * 1.5,
      delay: Math.random() * 0.5,
      size: 24 + Math.random() * 24,
      isMusic2: Math.random() > 0.5,
    }));

    setNotes(generatedNotes);

    const maxDuration = Math.max(...generatedNotes.map(n => n.duration + n.delay));
    const timer = setTimeout(() => {
      onComplete?.();
    }, (maxDuration + 0.8) * 1000);

    return () => clearTimeout(timer);
  }, [onComplete]);

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
          {note.isMusic2 ? (
            <Music2 
              className={`${note.color} animate-spin drop-shadow-lg`}
              size={note.size}
              strokeWidth={1.5}
            />
          ) : (
            <Music 
              className={`${note.color} animate-spin drop-shadow-lg`}
              size={note.size}
              strokeWidth={1.5}
            />
          )}
        </div>
      ))}
    </div>
  );
};

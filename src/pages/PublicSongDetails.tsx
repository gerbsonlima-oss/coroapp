import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  Play, Pause, Music2, FileText, Volume2, VolumeX, 
  Link, Share2, SkipBack, SkipForward, Guitar, FileType, Loader2
} from 'lucide-react';
import { toast } from 'sonner';
import { Helmet } from 'react-helmet-async';
import { typeLabels } from '@/constants/songTypes';
import { naipeColors, NAIPE_ORDER, naipeLabels } from '@/constants/naipes';

interface Song {
  id: string;
  name: string;
  type: string;
  notes: string | null;
  sheet_music_url: string | null;
  sheet_music_pdf_url: string | null;
  lyrics: string | null;
  chords: string | null;
}

interface SongAudio {
  id: string;
  naipe: string;
  audio_url: string;
  name: string;
}

const PublicSongDetails = () => {
  const { id } = useParams<{ id: string }>();
  const [song, setSong] = useState<Song | null>(null);
  const [audios, setAudios] = useState<SongAudio[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentAudioIndex, setCurrentAudioIndex] = useState<number | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (id) fetchSong();
  }, [id]);

  const fetchSong = async () => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select('id, name, type, notes, sheet_music_url, sheet_music_pdf_url, lyrics, chords')
        .eq('id', id)
        .single();

      if (error) throw error;
      setSong(data);

      const { data: audiosData } = await supabase
        .from('song_audios')
        .select('id, naipe, audio_url, name')
        .eq('song_id', id)
        .order('created_at');

      setAudios(audiosData || []);
    } catch {
      toast.error('Música não encontrada');
    } finally {
      setLoading(false);
    }
  };

  const sortedAudios = useMemo(() => {
    return [...audios].sort((a, b) => {
      const indexA = NAIPE_ORDER.indexOf((a.naipe || '').toLowerCase());
      const indexB = NAIPE_ORDER.indexOf((b.naipe || '').toLowerCase());
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB);
    });
  }, [audios]);

  // Audio event listeners
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onLoadedMetadata = () => setDuration(audio.duration);
    const onEnded = () => {
      // Auto-play next
      if (currentAudioIndex !== null && currentAudioIndex < sortedAudios.length - 1) {
        playAudio(currentAudioIndex + 1);
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
    };
  }, [currentAudioIndex, sortedAudios.length]);

  const playAudio = async (index: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    const track = sortedAudios[index];
    if (!track) return;

    if (currentAudioIndex === index) {
      if (isPlaying) {
        audio.pause();
        setIsPlaying(false);
      } else {
        await audio.play();
        setIsPlaying(true);
      }
      return;
    }

    setCurrentAudioIndex(index);
    audio.src = track.audio_url;
    audio.load();
    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const handleSeek = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value[0];
    setCurrentTime(value[0]);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isMuted) {
      audio.volume = volume || 0.5;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = value[0];
    setVolume(value[0]);
    setIsMuted(value[0] === 0);
  };

  const playPrev = () => {
    if (currentAudioIndex !== null && currentAudioIndex > 0) {
      playAudio(currentAudioIndex - 1);
    }
  };

  const playNext = () => {
    if (currentAudioIndex !== null && currentAudioIndex < sortedAudios.length - 1) {
      playAudio(currentAudioIndex + 1);
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleCopyLink = () => {
    const url = `${window.location.origin}/s/${id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  const handleShareWhatsApp = () => {
    if (!song) return;
    const url = `${window.location.origin}/s/${id}`;
    const text = encodeURIComponent(`🎵 ${song.name}\n${typeLabels[song.type] || song.type}\n\n${url}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!song) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4 p-4">
        <Music2 className="h-16 w-16 text-muted-foreground/40" />
        <h1 className="text-xl font-semibold text-foreground">Música não encontrada</h1>
      </div>
    );
  }

  const currentTrack = currentAudioIndex !== null ? sortedAudios[currentAudioIndex] : null;
  const naipeLabel = (naipe: string) => naipeLabels[naipe?.toLowerCase()] || naipe;

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{song.name} - CoroApp</title>
        <meta name="description" content={`${typeLabels[song.type] || song.type} - ${song.name}`} />
      </Helmet>

      <audio ref={audioRef} preload="metadata" crossOrigin="anonymous" className="hidden" />

      {/* Hero header */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/20 via-primary/5 to-background border-b border-border/50">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 to-transparent" />
        <div className="container mx-auto relative z-10 px-4 py-8 md:py-12">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 md:h-20 md:w-20 items-center justify-center rounded-2xl bg-primary/15 backdrop-blur-sm border border-primary/20 shadow-lg">
              <Music2 className="h-8 w-8 md:h-10 md:w-10 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <Badge className="bg-primary/10 text-primary border-primary/30 mb-2 text-xs font-medium">
                {typeLabels[song.type] || song.type}
              </Badge>
              <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-foreground leading-tight">
                {song.name}
              </h1>
              {song.notes && (
                <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{song.notes}</p>
              )}
            </div>
          </div>

          {/* Share buttons */}
          <div className="flex gap-2 mt-5">
            <Button variant="outline" size="sm" onClick={handleCopyLink} className="gap-1.5">
              <Link className="h-3.5 w-3.5" />
              Copiar link
            </Button>
            <Button variant="outline" size="sm" onClick={handleShareWhatsApp} className="gap-1.5">
              <Share2 className="h-3.5 w-3.5" />
              WhatsApp
            </Button>
          </div>
        </div>
      </div>

      <main className="container mx-auto px-4 py-6 space-y-6 pb-40">
        {/* Audio tracks */}
        {sortedAudios.length > 0 && (
          <Card className="border-border/50 overflow-hidden">
            <div className="p-4 border-b border-border/30 bg-card/80">
              <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                <Music2 className="h-4 w-4" />
                Áudios por Naipe ({sortedAudios.length})
              </h2>
            </div>
            <div className="divide-y divide-border/30">
              {sortedAudios.map((audio, index) => {
                const isActive = currentAudioIndex === index;
                const naipeKey = (audio.naipe || '').toLowerCase();
                const colorClass = naipeColors[naipeKey] || 'bg-muted text-muted-foreground';

                return (
                  <button
                    key={audio.id}
                    onClick={() => playAudio(index)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-all hover:bg-primary/5 ${
                      isActive ? 'bg-primary/10' : ''
                    }`}
                  >
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full shrink-0 ${
                      isActive ? 'bg-primary text-primary-foreground shadow-md' : 'bg-muted/60'
                    }`}>
                      {isActive && isPlaying ? (
                        <Pause className="h-4 w-4" />
                      ) : (
                        <Play className="h-4 w-4 ml-0.5" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-foreground">
                        {naipeLabel(audio.naipe)}
                      </span>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${colorClass} border-0`}>
                      {naipeLabel(audio.naipe)}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Lyrics */}
        {song.lyrics && (
          <Card className="border-border/50 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <FileType className="h-4 w-4" />
              Letra
            </h2>
            <div className="rounded-lg bg-secondary/30 p-4 max-h-[500px] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed text-foreground">
                {song.lyrics}
              </pre>
            </div>
          </Card>
        )}

        {/* Sheet music link */}
        {(song.sheet_music_url || song.sheet_music_pdf_url) && (
          <Card className="border-border/50 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <FileText className="h-4 w-4" />
              Partitura
            </h2>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(song.sheet_music_pdf_url || song.sheet_music_url || '', '_blank')}
            >
              <FileText className="mr-2 h-4 w-4" />
              Abrir Partitura
            </Button>
          </Card>
        )}

        {/* Chords */}
        {song.chords && (
          <Card className="border-border/50 p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              <Guitar className="h-4 w-4" />
              Cifra
            </h2>
            <div className="rounded-lg bg-secondary/30 p-4 max-h-[500px] overflow-y-auto">
              <pre className="whitespace-pre-wrap text-sm font-mono leading-relaxed text-foreground">
                {song.chords}
              </pre>
            </div>
          </Card>
        )}
      </main>

      {/* Fixed bottom player */}
      {currentTrack && (
        <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl shadow-2xl safe-bottom">
          {/* Progress bar */}
          <div className="px-4 pt-3">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="w-full"
            />
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">{formatTime(currentTime)}</span>
              <span className="text-[10px] text-muted-foreground">{formatTime(duration)}</span>
            </div>
          </div>

          {/* Track info + controls */}
          <div className="flex items-center gap-3 px-4 pb-4 pt-1">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{song.name}</p>
              <p className="text-xs text-muted-foreground">{naipeLabel(currentTrack.naipe)}</p>
            </div>

            <div className="flex items-center gap-1">
              <Button size="icon" variant="ghost" onClick={playPrev} className="h-9 w-9"
                disabled={currentAudioIndex === 0}>
                <SkipBack className="h-4 w-4" />
              </Button>
              <Button size="icon" onClick={() => playAudio(currentAudioIndex!)} 
                className="h-11 w-11 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 shadow-md">
                {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 ml-0.5" />}
              </Button>
              <Button size="icon" variant="ghost" onClick={playNext} className="h-9 w-9"
                disabled={currentAudioIndex === sortedAudios.length - 1}>
                <SkipForward className="h-4 w-4" />
              </Button>
            </div>

            <div className="hidden sm:flex items-center gap-1 w-24">
              <Button size="icon" variant="ghost" onClick={toggleMute} className="h-8 w-8">
                {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </Button>
              <Slider
                value={[isMuted ? 0 : volume]}
                max={1}
                step={0.01}
                onValueChange={handleVolumeChange}
                className="w-16"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PublicSongDetails;

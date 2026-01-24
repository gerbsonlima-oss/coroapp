import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useTenantPath } from '@/contexts/TenantContext';
import { BottomNavigation } from '@/components/BottomNavigation';
import { ChevronLeft, Play, Pause, MoreVertical, Download, Plus, Edit, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { PlaylistPlayer } from '@/components/PlaylistPlayer';
import { usePlaylistPlayer, Track as PlaylistTrack } from '@/hooks/usePlaylistPlayer';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';

interface Song {
  id: string;
  name: string;
  type: string;
}

interface SongAudio {
  id: string;
  song_id: string;
  naipe: string;
  audio_url: string;
  name: string;
}

interface Track {
  id: string;
  songId: string;
  songName: string;
  naipe: string;
  audioUrl: string;
}

const mapToPlaylistTrack = (track: Track): PlaylistTrack => ({
  id: track.id,
  songId: track.songId,
  songName: track.songName,
  songType: '',
  naipe: track.naipe,
  url: track.audioUrl,
});

const typeLabels: Record<string, string> = {
  canto_entrada: 'Entrada',
  ato_penitencial: 'Ato Penitencial',
  gloria: 'Glória',
  salmo: 'Salmo',
  aclamacao: 'Aclamação',
  oferendas: 'Ofertório',
  santo: 'Santo',
  cordeiro: 'Cordeiro',
  comunhao: 'Comunhão',
  acao_gracas: 'Ação de Graças',
  final: 'Final',
  outro: 'Outro',
};

const typeGradients: Record<string, string> = {
  canto_entrada: 'from-blue-500 to-blue-700',
  ato_penitencial: 'from-purple-500 to-purple-700',
  gloria: 'from-amber-500 to-amber-700',
  salmo: 'from-green-500 to-green-700',
  aclamacao: 'from-yellow-500 to-yellow-700',
  oferendas: 'from-orange-500 to-orange-700',
  santo: 'from-red-500 to-red-700',
  cordeiro: 'from-pink-500 to-pink-700',
  comunhao: 'from-indigo-500 to-indigo-700',
  acao_gracas: 'from-teal-500 to-teal-700',
  final: 'from-cyan-500 to-cyan-700',
  entrada: 'from-blue-500 to-blue-700',
  perdao: 'from-purple-500 to-purple-700',
  ofertorio: 'from-orange-500 to-orange-700',
  outro: 'from-gray-500 to-gray-700',
};

const SongTypeDetails = () => {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useIsAdmin();
  const { buildPath } = useTenantPath();
  const [songs, setSongs] = useState<Song[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [loading, setLoading] = useState(true);
  const [songTypeName, setSongTypeName] = useState<string | null>(null);

  const playlistTracks = tracks.map(mapToPlaylistTrack);
  const {
    currentTrack,
    isPlaying,
    repeatMode,
    playTrack,
    playNext,
    playPrevious,
    toggleRepeat,
    togglePlay,
    setAudioElement,
  } = usePlaylistPlayer(playlistTracks);

  useEffect(() => {
    fetchSongsAndTracks();
    fetchSongTypeInfo();
  }, [type]);

  const fetchSongTypeInfo = async () => {
    if (!type) return;

    try {
      const { data, error } = await supabase
        .from('song_types')
        .select('name')
        .eq('slug', type)
        .maybeSingle();

      if (error) {
        console.error('Error fetching song type info:', error);
        return;
      }

      if (data) {
        setSongTypeName(data.name);
      }
    } catch (error) {
      console.error('Error fetching song type info:', error);
    }
  };

  const fetchSongsAndTracks = async () => {
    if (!type) return;

    try {
      // Buscar músicas do tipo
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('id, name, type')
        .eq('type', type)
        .order('name');

      if (songsError) throw songsError;
      setSongs(songsData || []);

      // Buscar todos os áudios das músicas deste tipo
      const songIds = (songsData || []).map(s => s.id);
      
      if (songIds.length > 0) {
        const { data: audiosData, error: audiosError } = await supabase
          .from('song_audios')
          .select('*')
          .in('song_id', songIds)
          .order('name');

        if (audiosError) throw audiosError;

        // Criar array de tracks
        const tracksArray: Track[] = [];
        (audiosData || []).forEach((audio: SongAudio) => {
          const song = songsData?.find(s => s.id === audio.song_id);
          if (song) {
            tracksArray.push({
              id: audio.id,
              songId: song.id,
              songName: song.name,
              naipe: audio.naipe,
              audioUrl: audio.audio_url,
            });
          }
        });

        setTracks(tracksArray);
      }
    } catch (error: any) {
      toast.error('Erro ao carregar músicas');
    } finally {
      setLoading(false);
    }
  };

  // Agrupar tracks por música
  const tracksBySong = tracks.reduce((acc, track) => {
    if (!acc[track.songId]) {
      acc[track.songId] = {
        songName: track.songName,
        tracks: []
      };
    }
    acc[track.songId].tracks.push(track);
    return acc;
  }, {} as Record<string, { songName: string; tracks: Track[] }>);

  const getNaipeLabel = (naipe: string) => {
    const labels: Record<string, string> = {
      'Soprano': 'Soprano',
      'Contralto': 'Contralto',
      'Tenor': 'Tenor',
      'Baixo': 'Baixo',
      'S': 'Soprano',
      'C': 'Contralto',
      'T': 'Tenor',
      'B': 'Baixo',
      'unissono': 'Música Original',
      'Unissono': 'Música Original',
    };
    const label = labels[naipe] || naipe;
    return label.charAt(0).toUpperCase() + label.slice(1).toLowerCase();
  };

  const handlePlayPause = () => {
    if (!currentTrack && playlistTracks.length > 0) {
      playTrack(0);
    } else {
      togglePlay();
    }
  };

  const handleTrackPlay = (track: Track) => {
    const index = tracks.findIndex(t => t.id === track.id);
    if (index >= 0) {
      playTrack(index);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#121212]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1DB954] border-t-transparent" />
      </div>
    );
  }

  if (!type) return null;

  return (
    <div className="min-h-screen bg-[#121212] text-white flex flex-col pb-32">
      {/* Header com gradiente */}
      <div className="relative">
        <div className={`h-64 bg-gradient-to-b ${typeGradients[type]} flex items-end`}>
          <div className="w-full px-4 pb-6">
            <button 
              onClick={() => navigate(buildPath('/songs'))}
              className="absolute top-4 left-4 p-2 rounded-full bg-black/40 text-white"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
            
            <h1 className="text-white text-2xl mb-2">{songTypeName ?? typeLabels[type] ?? type}</h1>
            <div className="flex items-center gap-2 text-sm text-white/80">
              <span>{songs.length} {songs.length === 1 ? 'música' : 'músicas'}</span>
              {tracks.length > 0 && (
                <>
                  <span>•</span>
                  <span>{tracks.length} {tracks.length === 1 ? 'áudio' : 'áudios'}</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Botões de ação */}
      <div className="px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={handlePlayPause}
            disabled={tracks.length === 0}
            className="w-14 h-14 rounded-full bg-[#1DB954] flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isPlaying ? (
              <Pause className="w-7 h-7 text-black" fill="black" />
            ) : (
              <Play className="w-7 h-7 text-black ml-1" fill="black" />
            )}
          </button>

          <button className="p-2 text-[#a7a7a7] hover:text-white">
            <Download className="w-6 h-6" />
          </button>
        </div>

        {user && (
          <Button
            onClick={() => navigate('/songs/new')}
            variant="ghost"
            className="text-[#a7a7a7] hover:text-white"
          >
            <Plus className="w-5 h-5 mr-2" />
            Adicionar
          </Button>
        )}
      </div>

      {/* Lista de músicas agrupadas */}
      <div className="flex-1 overflow-y-auto">
        {songs.length === 0 ? (
          <div className="px-4 py-20 text-center">
            <p className="text-[#a7a7a7] mb-4">Nenhuma música disponível nesta categoria</p>
            {user && (
              <Button
                onClick={() => navigate('/songs/new')}
                className="rounded-full bg-[#1DB954] text-black hover:bg-[#1ed760]"
              >
                <Plus className="w-5 h-5 mr-2" />
                Cadastrar Música
              </Button>
            )}
          </div>
        ) : (
          <Accordion type="multiple" className="mb-6 px-4">
            {songs.map((song) => {
              const songTracks = tracks.filter(t => t.songId === song.id);
              
              return (
                <AccordionItem key={song.id} value={song.id} className="border-b border-[#282828]">
                  {songTracks.length > 0 ? (
                    <>
                      <AccordionTrigger className="hover:bg-[#181818] px-2 py-3 hover:no-underline">
                        <div className="flex items-center justify-between w-full pr-2">
                          <h2 className="text-white text-base font-medium text-left">
                            {song.name}
                          </h2>
                          <span className="text-xs text-[#a7a7a7] mr-2">
                            {songTracks.length} {songTracks.length === 1 ? 'áudio' : 'áudios'}
                          </span>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="pb-0">
                      <div className="divide-y divide-[#282828]">
                        {songTracks.map((track) => {
                          const isCurrentTrack = currentTrack?.id === track.id;
                          
                          return (
                            <div
                              key={track.id}
                              onClick={() => handleTrackPlay(track)}
                              className={`px-2 py-3 flex items-center gap-3 active:bg-[#282828] ${
                                isCurrentTrack ? '' : 'cursor-pointer'
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <div className="flex-1 min-w-0">
                                  <p className={`truncate ${isCurrentTrack ? 'text-[#1DB954]' : 'text-[#a7a7a7]'} text-sm`}>
                                    {getNaipeLabel(track.naipe)}
                                  </p>
                                </div>
                              </div>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                    }}
                                    className="text-[#a7a7a7] p-2 hover:text-white"
                                  >
                                    <MoreVertical className="w-5 h-5" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="bg-[#282828] border-[#3e3e3e] text-white z-50">
                                  <DropdownMenuItem
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      try {
                                        const response = await fetch(track.audioUrl);
                                        const blob = await response.blob();
                                        const url = window.URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                         const fileName = `${songTypeName ?? typeLabels[type] ?? type} - ${track.songName} - ${track.naipe}.mp3`;
                                        a.download = fileName;
                                        document.body.appendChild(a);
                                        a.click();
                                        window.URL.revokeObjectURL(url);
                                        document.body.removeChild(a);
                                        toast.success('Download iniciado!');
                                      } catch (error) {
                                        toast.error('Erro ao baixar áudio');
                                      }
                                    }}
                                    className="focus:bg-[#3e3e3e] focus:text-white"
                                  >
                                    <Download className="mr-2 h-4 w-4" />
                                    Baixar áudio
                                  </DropdownMenuItem>
                                  {user && (
                                    <DropdownMenuItem 
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/songs/${track.songId}/edit`);
                                      }}
                                      className="focus:bg-[#3e3e3e] focus:text-white"
                                    >
                                      <Edit className="mr-2 h-4 w-4" />
                                      Editar música
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          );
                        })}
                      </div>
                    </AccordionContent>
                    </>
                  ) : (
                    // Música sem áudios - card clicável
                    <div
                      onClick={() => navigate(`/songs/${song.id}/edit`)}
                      className="hover:bg-[#181818] px-2 py-3 cursor-pointer flex items-center justify-between"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="flex-1 min-w-0">
                          <h2 className="text-white text-base font-medium">
                            {song.name}
                          </h2>
                          <p className="text-xs text-[#a7a7a7] mt-1">
                            Clique para adicionar áudios
                          </p>
                        </div>
                        <span className="text-xs text-[#a7a7a7] bg-[#282828] px-2 py-1 rounded-full">
                          Sem áudios
                        </span>
                      </div>
                      
                      {user && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                              }}
                              className="text-[#a7a7a7] p-2 hover:text-white ml-2"
                            >
                              <MoreVertical className="w-5 h-5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-[#282828] border-[#3e3e3e] text-white z-50">
                            <DropdownMenuItem 
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/songs/${song.id}/edit`);
                              }}
                              className="focus:bg-[#3e3e3e] focus:text-white"
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Adicionar áudios
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  )}
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>

      {/* Player com áudio */}
      {currentTrack && (
        <div className="fixed bottom-16 left-0 right-0 z-30 bg-[#282828] p-3">
          <PlaylistPlayer
            currentTrack={currentTrack}
            isPlaying={isPlaying}
            repeatMode={repeatMode}
            onPlayPause={togglePlay}
            onNext={playNext}
            onPrevious={playPrevious}
            onToggleRepeat={toggleRepeat}
            onTrackEnd={playNext}
            onSetAudioElement={setAudioElement}
            showDownloadButton={true}
          />
        </div>
      )}

      <BottomNavigation />
    </div>
  );
};

export default SongTypeDetails;

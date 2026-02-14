import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, useTenantPath } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Plus, Music, LogOut, Settings, Search, X, Sparkles, Sliders, Filter, ChevronDown, MoreVertical, Share2, FileText, Download, Eye, Pencil, Trash2, Guitar, Music2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { exportSongsPDF } from '@/utils/exportSongsPDF';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { InstallPWAButton } from '@/components/InstallPWAButton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { SongAudioInlinePlayer } from '@/components/SongAudioInlinePlayer';

interface SongTypeAlbum {
  type: string;
  name: string;
  count: number;
}

interface SongListItem {
  id: string;
  name: string;
  type: string;
  typeName: string;
  lyrics?: string | null;
  chords?: string | null;
  sheet_music_url?: string | null;
  sheet_music_pdf_url?: string | null;
  tenant_id?: string | null;
}

interface SongAudio {
  id: string;
  song_id: string;
  naipe: string;
  audio_url: string;
  name: string;
}

import { songTypeOrder, typeLabels, typeGradients } from '@/constants/songTypes';

const Songs = () => {
  const [songTypes, setSongTypes] = useState<SongTypeAlbum[]>([]);
  const [songs, setSongs] = useState<SongListItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupBy, setGroupBy] = useState<'tipo' | 'lista'>(() => {
    const saved = localStorage.getItem('songs_groupBy');
    return (saved === 'tipo' || saved === 'lista') ? saved : 'tipo';
  });
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [expandedSong, setExpandedSong] = useState<string | null>(null);
  const [songAudios, setSongAudios] = useState<Record<string, SongAudio[]>>({});
  const [loadingAudios, setLoadingAudios] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { tenantId, tenant, userTenants, userTenantIds, isMultiTenant } = useTenant();
  const { buildPath } = useTenantPath();
  const { isAdmin } = useIsAdmin();

  // Use all user tenant IDs for multi-tenant
  const queryTenantIds = isMultiTenant ? userTenantIds : (tenantId ? [tenantId] : []);

  useEffect(() => {
    localStorage.setItem('songs_groupBy', groupBy);
  }, [groupBy]);

  useEffect(() => {
    if (queryTenantIds.length > 0) {
      fetchSongTypes();
    }
  }, [user, queryTenantIds.join(',')]);

  const toggleGroup = (key: string) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const { tenantSlug } = useTenant();

  const handleExportPDF = async () => {
    if (songs.length === 0) {
      toast.error('Nenhuma música para exportar');
      return;
    }
    
    try {
      toast.info('Gerando catálogo em PDF...');
      await exportSongsPDF(songs, tenantSlug, tenant ? { name: tenant.name, logo_url: tenant.logo_url } : null);
      toast.success('Catálogo exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar PDF:', error);
      toast.error('Erro ao gerar relatório PDF');
    }
  };

  const handleShareViaWhatsApp = async (songId: string, songName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    try {
      // Fetch song details
      const { data: songData, error: songError } = await supabase
        .from('songs')
        .select('id, name, type, sheet_music_url, sheet_music_pdf_url')
        .eq('id', songId)
        .single();

      if (songError) throw songError;

      // Fetch song audios
      const { data: audiosData, error: audiosError } = await supabase
        .from('song_audios')
        .select('*')
        .eq('song_id', songId);

      if (audiosError) throw audiosError;

      // Build WhatsApp message
      let message = `🎵 *${songName}*\n\n`;

      // Add sheet music link
      if (songData?.sheet_music_pdf_url || songData?.sheet_music_url) {
        const sheetUrl = songData.sheet_music_pdf_url || songData.sheet_music_url;
        message += `📄 *Partitura:* ${sheetUrl}\n`;
      }

      // Add audio links
      if (audiosData && audiosData.length > 0) {
        message += `\n🎧 *Áudios:*\n`;
        audiosData.forEach((audio: any) => {
          message += `• ${audio.naipe}: ${audio.audio_url}\n`;
        });
      }

      message += `\nRepositório Litúrgico Digital 🙏`;

      // Open WhatsApp
      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
      
      toast.success('Abrindo WhatsApp com os arquivos!');
    } catch (error) {
      console.error('Error sharing via WhatsApp:', error);
      toast.error('Erro ao compartilhar música');
    }
  };

  const handleDeleteSong = async (songId: string, songName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!confirm(`Tem certeza que deseja excluir "${songName}"?`)) {
      return;
    }
    
    try {
      // Delete related song_audios first
      await supabase.from('song_audios').delete().eq('song_id', songId);
      
      // Delete related event_songs
      await supabase.from('event_songs').delete().eq('song_id', songId);
      
      // Delete the song
      const { error } = await supabase.from('songs').delete().eq('id', songId);
      
      if (error) throw error;
      
      setSongs(prev => prev.filter(s => s.id !== songId));
      toast.success('Música excluída com sucesso!');
    } catch (error) {
      console.error('Error deleting song:', error);
      toast.error('Erro ao excluir música');
    }
  };

  const fetchSongTypes = async () => {
    try {
      // Build the songs query based on multi-tenant or single tenant
      const songsQuery = supabase.from('songs')
        .select('id, name, type, lyrics, chords, sheet_music_url, sheet_music_pdf_url, tenant_id')
        .in('tenant_id', queryTenantIds);

      const [{ data: songTypesData, error: songTypesError }, { data: songsData, error: songsError }] =
        await Promise.all([
          supabase.from('song_types').select('id, slug, name, order_index').order('order_index'),
          songsQuery,
        ]);

      if (songTypesError) throw songTypesError;
      if (songsError) throw songsError;

      const typeCount = (songsData || []).reduce((acc: Record<string, number>, song) => {
        acc[song.type] = (acc[song.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const typeNameMap = new Map<string, string>();
      (songTypesData || []).forEach((type) => {
        typeNameMap.set(type.slug, type.name);
      });

      const albums: SongTypeAlbum[] = (songTypesData || []).map((type) => ({
        type: type.slug,
        name: type.name,
        count: typeCount[type.slug] || 0,
      }));

      const songsList: SongListItem[] = (songsData || []).map((song) => ({
        id: song.id,
        name: song.name,
        type: song.type,
        typeName: typeNameMap.get(song.type) || 'Outros',
        lyrics: song.lyrics,
        chords: song.chords,
        sheet_music_url: song.sheet_music_url,
        sheet_music_pdf_url: song.sheet_music_pdf_url,
        tenant_id: song.tenant_id,
      }));

      setSongTypes(albums);
      setSongs(songsList);
    } catch (error: unknown) {
      toast.error('Erro ao carregar biblioteca');
    } finally {
      setLoading(false);
    }
  };

  const handleExpandSong = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (expandedSong === songId) {
      setExpandedSong(null);
      return;
    }
    
    setExpandedSong(songId);
    
    // Load audios if not already loaded
    if (!songAudios[songId]) {
      setLoadingAudios(songId);
      try {
        const { data, error } = await supabase
          .from('song_audios')
          .select('*')
          .eq('song_id', songId)
          .order('naipe');
        
        if (error) throw error;
        
        setSongAudios(prev => ({
          ...prev,
          [songId]: data || []
        }));
      } catch (error) {
        console.error('Error loading audios:', error);
        toast.error('Erro ao carregar áudios');
      } finally {
        setLoadingAudios(null);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const filteredSongs = songs.filter(song => 
    song.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
    (selectedType === null || song.type === selectedType)
  );

  const renderSongRow = (song: SongListItem) => {
    const isExpanded = expandedSong === song.id;
    const audios = songAudios[song.id] || [];
    const isLoadingThisAudio = loadingAudios === song.id;
    const hasLyrics = !!song.lyrics;
    const hasChords = !!song.chords;
    const hasSheet = !!(song.sheet_music_pdf_url || song.sheet_music_url);

    return (
      <div key={song.id} className="transition-all">
        <div
          className={`flex items-center gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-primary/5 group ${isExpanded ? 'bg-primary/5' : ''}`}
          onClick={(e) => handleExpandSong(song.id, e)}
        >
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-primary/50 transition-transform ${isExpanded ? 'rotate-180' : 'rotate-0'}`} />
          <div className="flex-1 min-w-0 flex items-center gap-1.5">
            <p className="truncate text-[13px] font-medium text-foreground group-hover:text-primary transition-colors">
              {song.name}
            </p>
            {isMultiTenant && song.tenant_id && (
              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 shrink-0">
                {userTenants.find(ut => ut.id === song.tenant_id)?.name || ''}
              </Badge>
            )}
            <div className="flex items-center gap-0.5 ml-auto shrink-0">
              {hasLyrics && <FileText className="h-2.5 w-2.5 text-muted-foreground/40" />}
              {hasChords && <Guitar className="h-2.5 w-2.5 text-muted-foreground/40" />}
              {hasSheet && <Music2 className="h-2.5 w-2.5 text-muted-foreground/40" />}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0">
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border border-border">
              <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(buildPath(`/songs/${song.id}`)); }}>
                <Eye className="mr-2 h-3.5 w-3.5" /> Ver Detalhes
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(buildPath(`/songs/${song.id}/edit`)); }}>
                  <Pencil className="mr-2 h-3.5 w-3.5" /> Editar
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={(e) => handleShareViaWhatsApp(song.id, song.name, e as any)}>
                <Share2 className="mr-2 h-3.5 w-3.5" /> WhatsApp
              </DropdownMenuItem>
              {isAdmin && (
                <DropdownMenuItem onClick={(e) => handleDeleteSong(song.id, song.name, e)} className="text-destructive focus:text-destructive">
                  <Trash2 className="mr-2 h-3.5 w-3.5" /> Excluir
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {isExpanded && (
          <div className="px-2.5 pb-2 pt-1 bg-primary/3 border-t border-border/20">
            <div className="flex items-center gap-1.5 mb-2">
              {hasLyrics && (
                <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2"
                  onClick={(e) => { e.stopPropagation(); navigate(buildPath(`/songs/${song.id}?tab=lyrics`)); }}>
                  <FileText className="h-3 w-3" /> Letra
                </Button>
              )}
              {hasSheet && (
                <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2"
                  onClick={(e) => { e.stopPropagation(); navigate(buildPath(`/songs/${song.id}?tab=sheet`)); }}>
                  <Music2 className="h-3 w-3" /> Partitura
                </Button>
              )}
              {hasChords && (
                <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2"
                  onClick={(e) => { e.stopPropagation(); navigate(buildPath(`/songs/${song.id}?tab=chords`)); }}>
                  <Guitar className="h-3 w-3" /> Cifra
                </Button>
              )}
            </div>
            {isLoadingThisAudio ? (
              <div className="flex items-center justify-center py-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              </div>
            ) : audios.length > 0 ? (
              <div className="space-y-0.5">
                {audios.map((audio) => (
                  <SongAudioInlinePlayer key={audio.id} audioUrl={audio.audio_url} naipe={audio.naipe} name={audio.name} />
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground text-center py-2">Nenhum áudio</p>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSongsContent = () => {
    if (filteredSongs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Music className="h-8 w-8 text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">
            {searchQuery ? 'Nenhum resultado' : 'Nenhuma música no repertório'}
          </p>
        </div>
      );
    }

    if (groupBy === 'tipo') {
      return songTypes.map(type => {
        const typeGroupSongs = filteredSongs.filter(s => s.type === type.type).sort((a, b) => a.name.localeCompare(b.name));
        if (typeGroupSongs.length === 0) return null;

        const groupKey = `type:${type.type}`;
        const isCollapsed = Boolean(collapsedGroups[groupKey]);

        return (
          <div key={type.type}>
            <div className="rounded-md bg-card border border-primary/15 overflow-hidden">
              <div 
                className="px-2.5 py-2 bg-gradient-to-r from-primary/6 to-transparent flex items-center justify-between cursor-pointer hover:from-primary/10 transition-all"
                onClick={e => {
                  e.stopPropagation();
                  toggleGroup(groupKey);
                }}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-semibold text-primary">{type.name}</span>
                  <span className="text-[10px] text-muted-foreground">{typeGroupSongs.length}</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-primary/50 transition-transform shrink-0 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`} />
              </div>
              {!isCollapsed && (
                <div className="divide-y divide-border/30">
                  {typeGroupSongs.map((song) => renderSongRow(song))}
                </div>
              )}
            </div>
          </div>
        );
      }).filter(Boolean);
    }

    return (
      <div className="rounded-md bg-card border border-border/30 overflow-hidden divide-y divide-border/20">
        {filteredSongs
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((song) => renderSongRow(song))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 px-3 py-2">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between">
          <div className="flex items-center gap-2">
            <Music className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-bold mb-0">Repertório</h1>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleExportPDF} className="h-8 w-8 text-primary" title="Exportar PDF">
              <FileText className="h-4 w-4" />
            </Button>
            {isAdmin && (
              <>
                <Button variant="ghost" size="icon" onClick={() => navigate(buildPath('/songs/admin/types'))} className="h-8 w-8" title="Tipos">
                  <Settings className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>
        {/* Inline search + filters */}
        <div className="mx-auto max-w-[1280px] mt-1.5 flex gap-1.5">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input 
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 bg-secondary/50 border-primary/20 text-xs rounded-md" 
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowGroupModal(true)} className="h-8 px-2.5 text-xs gap-1 border-primary/20">
            <Sliders className="h-3 w-3" />
            Agrupar
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowFilterModal(true)} className="h-8 px-2.5 text-xs gap-1 border-primary/20">
            <Filter className="h-3 w-3" />
            {selectedType ? songTypes.find(t => t.type === selectedType)?.name || 'Filtro' : 'Filtrar'}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-2 py-2 md:px-4">
        <div className="space-y-1.5">
          {renderSongsContent()}
        </div>
      </main>

      {/* Floating Action Button */}
      {isAdmin && (
        <button
          onClick={() => navigate(buildPath('/songs/new'))}
          className="fixed bottom-24 right-4 z-20 h-14 w-14 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-glow hover:shadow-glow/50 transition-all active:scale-95 flex items-center justify-center text-white hover:scale-110 duration-200"
          title="Cadastrar Música"
        >
          <Plus className="h-6 w-6" />
        </button>
      )}

      {/* Filter Modal */}
      <Dialog open={showFilterModal} onOpenChange={setShowFilterModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Filtrar Músicas</DialogTitle>
            <DialogDescription>Selecione um tipo de música para filtrar</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <button
              onClick={() => {
                setSelectedType(null);
                setShowFilterModal(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-md transition-all ${
                selectedType === null
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-secondary text-foreground'
              }`}
            >
              Todos ({songs.length})
            </button>
            {songTypes.map((type) => {
              const count = songs.filter(s => s.type === type.type).length;
              if (count === 0) return null;
              return (
                <button
                  key={type.type}
                  onClick={() => {
                    setSelectedType(type.type);
                    setShowFilterModal(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-md transition-all ${
                    selectedType === type.type
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-secondary text-foreground'
                  }`}
                >
                  {type.name} ({count})
                </button>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>

      {/* Group Modal */}
      <Dialog open={showGroupModal} onOpenChange={setShowGroupModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agrupar Músicas</DialogTitle>
            <DialogDescription>Escolha como exibir as músicas</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <button
              onClick={() => {
                setGroupBy('tipo');
                setShowGroupModal(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-md transition-all ${
                groupBy === 'tipo'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-secondary text-foreground'
              }`}
            >
              Agrupar por Tipo
            </button>
            <button
              onClick={() => {
                setGroupBy('lista');
                setShowGroupModal(false);
              }}
              className={`w-full text-left px-3 py-2 rounded-md transition-all ${
                groupBy === 'lista'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-secondary text-foreground'
              }`}
            >
              Lista Simples
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <BottomNavigation />
    </div>
  );
};

export default Songs;
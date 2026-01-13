import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, useTenantPath } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { BottomNavigation } from '@/components/BottomNavigation';
import { Plus, Music, LogOut, Settings, Search, X, Sparkles, Sliders, Filter, ChevronDown, MoreVertical, Share2, FileText, Download, Eye, Pencil, Trash2 } from 'lucide-react';
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
}

// Ordem litúrgica dos cantos na Santa Missa
const songTypeOrder = [
  'canto_entrada',
  'ato_penitencial',
  'gloria',
  'salmo',
  'aclamacao',
  'oferendas',
  'santo',
  'cordeiro',
  'comunhao',
  'acao_gracas',
  'final',
  'outro',
];

const typeLabels: Record<string, string> = {
  canto_entrada: 'Canto de Entrada',
  ato_penitencial: 'Ato Penitencial',
  gloria: 'Glória',
  salmo: 'Salmo Responsorial',
  aclamacao: 'Aclamação ao Evangelho',
  oferendas: 'Canto das Oferendas',
  santo: 'Santo',
  cordeiro: 'Cordeiro de Deus',
  comunhao: 'Canto da Comunhão',
  acao_gracas: 'Canto de Ação de Graças',
  final: 'Canto Final',
  outro: 'Outros',
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
  outro: 'from-gray-500 to-gray-700',
};

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
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { tenantId, tenant } = useTenant();
  const { buildPath } = useTenantPath();
  const { isAdmin } = useIsAdmin();

  useEffect(() => {
    localStorage.setItem('songs_groupBy', groupBy);
  }, [groupBy]);

  useEffect(() => {
    if (tenantId) {
      fetchSongTypes();
    }
  }, [user, tenantId]);

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
      await exportSongsPDF(songs, tenantSlug, tenant?.name || null);
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
          const naipeName = audio.naipe === 'original' ? 'Música Completa' : audio.naipe;
          message += `• ${naipeName}: ${audio.audio_url}\n`;
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
      const [{ data: songTypesData, error: songTypesError }, { data: songsData, error: songsError }] =
        await Promise.all([
          // ✅ Tipos de música agora são globais
          supabase.from('song_types').select('id, slug, name, order_index').order('order_index'),
          supabase.from('songs').select('id, name, type').eq('tenant_id', tenantId),
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
      }));

      setSongTypes(albums);
      setSongs(songsList);
    } catch (error: any) {
      toast.error('Erro ao carregar biblioteca');
    } finally {
      setLoading(false);
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

  const renderSongsContent = () => {
    if (filteredSongs.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Music className="h-12 w-12 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium mb-1">Nenhuma música encontrada</p>
          <p className="text-xs text-muted-foreground">
            {searchQuery ? 'Tente outro termo de busca' : 'Comece a adicionar músicas ao repertório'}
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
            <div className="rounded-md bg-card border border-primary/20 overflow-hidden shadow-card hover:shadow-elevated transition-all">
              <div 
                className="px-3 py-3.5 bg-gradient-to-r from-primary/8 to-transparent flex items-center justify-between cursor-pointer hover:from-primary/12 transition-all"
                onClick={e => {
                  e.stopPropagation();
                  toggleGroup(groupKey);
                }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Badge className="bg-primary/20 text-primary border-primary/30">
                    {type.name}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-medium whitespace-nowrap">
                    {typeGroupSongs.length} {typeGroupSongs.length === 1 ? 'música' : 'músicas'}
                  </span>
                </div>
                <ChevronDown className={`h-5 w-5 text-primary/70 transform transition-transform shrink-0 ${isCollapsed ? 'rotate-0' : 'rotate-180'}`} />
              </div>
              {!isCollapsed && (
                <div className="divide-y divide-primary/10">
                  {typeGroupSongs.map((song) => (
                    <div 
                      key={song.id}
                      className={`flex items-center justify-between gap-3 px-3 py-3 rounded-md transition-all active:scale-95 hover:bg-primary/8 cursor-pointer group`}
                      onClick={() => navigate(buildPath(`/songs/${song.id}`)) }
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="h-6 w-6 flex items-center justify-center rounded transition-colors text-primary">
                          <Music className="h-5 w-5 shrink-0" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                              {song.name}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex-1">
                              {song.typeName}
                            </p>
                          </div>
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-popover border border-border">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(buildPath(`/songs/${song.id}`)); }}>
                            <Eye className="mr-2 h-4 w-4" /> Ver Detalhes
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(buildPath(`/songs/${song.id}/edit`)); }}>
                              <Pencil className="mr-2 h-4 w-4" /> Editar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={(e) => handleShareViaWhatsApp(song.id, song.name, e as any)}>
                            <Share2 className="mr-2 h-4 w-4" /> Compartilhar via WhatsApp
                          </DropdownMenuItem>
                          {isAdmin && (
                            <DropdownMenuItem 
                              onClick={(e) => handleDeleteSong(song.id, song.name, e)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="mr-2 h-4 w-4" /> Excluir
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }).filter(Boolean);
    }

    return (
      <div className="space-y-2">
        {filteredSongs
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((song) => (
            <div 
              key={song.id}
              className={`flex items-center justify-between gap-3 px-3 py-3 rounded-md transition-all active:scale-95 hover:bg-primary/8 border border-primary/10 cursor-pointer group`}
              onClick={() => navigate(buildPath(`/songs/${song.id}`)) }
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="h-6 w-6 flex items-center justify-center rounded transition-colors text-primary">
                  <Music className="h-5 w-5 shrink-0" />
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-bold text-sm text-foreground group-hover:text-primary transition-colors">
                      {song.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold flex-1">
                      {song.typeName}
                    </p>
                  </div>
                </div>
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-10 w-10 text-muted-foreground hover:text-foreground shrink-0"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-popover border border-border">
                  <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(buildPath(`/songs/${song.id}`)); }}>
                    <Eye className="mr-2 h-4 w-4" /> Ver Detalhes
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(buildPath(`/songs/${song.id}/edit`)); }}>
                      <Pencil className="mr-2 h-4 w-4" /> Editar
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={(e) => handleShareViaWhatsApp(song.id, song.name, e as any)}>
                    <Share2 className="mr-2 h-4 w-4" /> Compartilhar via WhatsApp
                  </DropdownMenuItem>
                  {isAdmin && (
                    <DropdownMenuItem 
                      onClick={(e) => handleDeleteSong(song.id, song.name, e)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Excluir
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background pb-40">
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border/50 shadow-subtle px-4 py-3 md:px-6 md:py-4">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
              <Music className="h-6 w-6 md:h-7 md:w-7 text-primary" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold">Repertório</h1>
          </div>
          <div className="flex items-center gap-1.5 md:gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={handleExportPDF}
              className="hover:bg-accent/80 text-primary"
              title="Exportar catálogo PDF"
            >
              <FileText className="h-5 w-5" />
            </Button>
            <InstallPWAButton size="icon" showText={false} />
            {isAdmin && (
              <>
                <Button 
                  onClick={() => navigate(buildPath('/songs/new'))}
                  className="hidden md:flex gradient-primary shadow-glow hover:shadow-glow/50 transition-all h-9 px-3 text-xs"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" />
                  Nova Música
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => navigate(buildPath('/songs/admin/types'))}
                  className="hover:bg-accent/80"
                  title="Gerenciar tipos de música"
                >
                  <Settings className="h-5 w-5" />
                </Button>
              </>
            )}
            {user && (
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={signOut}
                className="hover:bg-accent/80"
              >
                <LogOut className="h-5 w-5" />
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-3 py-3 md:px-6 md:py-6">
        <section className="space-y-6">
          {/* Search e Filtros */}
          <div className="space-y-2 border-b border-primary/15 bg-gradient-to-b from-primary/5 to-transparent px-0 pb-3">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Buscar música..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 w-full h-11 bg-secondary/50 border-primary/30 text-sm rounded-md shadow-subtle focus:shadow-glow focus:border-primary/60 transition-all" 
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowGroupModal(true)}
                className="flex-1 h-10 text-sm px-3 gap-2 border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all"
              >
                <Sliders className="h-4 w-4" />
                <span>Agrupar</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowFilterModal(true)}
                className="flex-1 h-10 text-sm px-3 gap-2 border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all"
              >
                <Filter className="h-4 w-4" />
                <span>Filtrar</span>
              </Button>
            </div>
          </div>

          {/* Songs List */}
          <div className="space-y-2.5">
            {renderSongsContent()}
          </div>
        </section>
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
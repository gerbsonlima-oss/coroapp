import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Users, Loader2, Music, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface ChairMember {
  id: string;
  name: string;
  photo_url: string | null;
  naipe: string | null;
  active: boolean;
}

interface EventMembersManagerProps {
  eventId: string;
  isAdmin?: boolean;
}

const naipeLabels: Record<string, string> = {
  soprano: 'Soprano',
  contralto: 'Contralto',
  tenor: 'Tenor',
  baixo: 'Baixo',
};

const naipeColors: Record<string, string> = {
  soprano: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  contralto: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  tenor: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  baixo: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
};

export function EventMembersManager({ eventId, isAdmin = false }: EventMembersManagerProps) {
  const { tenantId } = useTenant();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allMembers, setAllMembers] = useState<ChairMember[]>([]);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (open && tenantId) {
      fetchData();
    }
  }, [open, tenantId, eventId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch all active choir members
      const { data: members, error: membersError } = await supabase
        .from('choir_members')
        .select('id, name, photo_url, naipe, active')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .order('naipe')
        .order('name');

      if (membersError) throw membersError;

      // Fetch event members
      const { data: eventMembers, error: eventMembersError } = await supabase
        .from('event_members')
        .select('member_id')
        .eq('event_id', eventId);

      if (eventMembersError) throw eventMembersError;

      setAllMembers(members || []);
      setSelectedMembers(new Set(eventMembers?.map(em => em.member_id) || []));
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMember = (memberId: string) => {
    setSelectedMembers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(memberId)) {
        newSet.delete(memberId);
      } else {
        newSet.add(memberId);
      }
      return newSet;
    });
  };

  const handleSelectAll = (naipe: string) => {
    const naipeMembers = allMembers.filter(m => m.naipe === naipe);
    const allSelected = naipeMembers.every(m => selectedMembers.has(m.id));
    
    setSelectedMembers(prev => {
      const newSet = new Set(prev);
      naipeMembers.forEach(m => {
        if (allSelected) {
          newSet.delete(m.id);
        } else {
          newSet.add(m.id);
        }
      });
      return newSet;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Delete all current event members
      const { error: deleteError } = await supabase
        .from('event_members')
        .delete()
        .eq('event_id', eventId);

      if (deleteError) throw deleteError;

      // Insert new selections
      if (selectedMembers.size > 0) {
        const inserts = Array.from(selectedMembers).map(memberId => ({
          event_id: eventId,
          member_id: memberId,
        }));

        const { error: insertError } = await supabase
          .from('event_members')
          .insert(inserts);

        if (insertError) throw insertError;
      }

      toast.success(`${selectedMembers.size} coralistas associados ao evento!`);
      setOpen(false);
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredMembers = allMembers.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const groupedMembers = filteredMembers.reduce((acc, member) => {
    const naipe = member.naipe || 'sem_naipe';
    if (!acc[naipe]) acc[naipe] = [];
    acc[naipe].push(member);
    return acc;
  }, {} as Record<string, ChairMember[]>);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Users className="h-4 w-4" />
          Coralistas ({selectedMembers.size})
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Coralistas do Evento
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="mt-4 flex flex-col h-[calc(100vh-10rem)]">
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar coralista..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between mb-4 px-1">
              <span className="text-sm text-muted-foreground">
                {selectedMembers.size} de {allMembers.length} selecionados
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedMembers(new Set(allMembers.map(m => m.id)))}
              >
                Selecionar todos
              </Button>
            </div>

            {/* Members List */}
            <ScrollArea className="flex-1 -mx-6 px-6">
              <div className="space-y-6 pb-4">
                {Object.entries(groupedMembers).map(([naipe, members]) => (
                  <div key={naipe}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Music className="h-4 w-4 text-primary" />
                        <span className="font-medium">
                          {naipe === 'sem_naipe' ? 'Sem naipe' : naipeLabels[naipe]}
                        </span>
                        <Badge variant="secondary" className="h-5">
                          {members.filter(m => selectedMembers.has(m.id)).length}/{members.length}
                        </Badge>
                      </div>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSelectAll(naipe)}
                          className="h-7 text-xs"
                        >
                          {members.every(m => selectedMembers.has(m.id)) ? 'Desmarcar' : 'Marcar'} todos
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {members.map((member) => (
                        <div
                          key={member.id}
                          onClick={() => isAdmin && handleToggleMember(member.id)}
                          className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                            isAdmin ? 'cursor-pointer hover:bg-accent' : ''
                          } ${selectedMembers.has(member.id) ? 'bg-primary/5' : ''}`}
                        >
                          {isAdmin && (
                            <Checkbox
                              checked={selectedMembers.has(member.id)}
                              onCheckedChange={() => handleToggleMember(member.id)}
                            />
                          )}
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={member.photo_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 text-sm">{member.name}</span>
                          {member.naipe && (
                            <Badge className={`${naipeColors[member.naipe]} text-xs`}>
                              {naipeLabels[member.naipe]}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Save Button */}
            {isAdmin && (
              <div className="pt-4 border-t mt-auto">
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar Seleção
                </Button>
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

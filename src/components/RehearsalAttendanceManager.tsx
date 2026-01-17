import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ClipboardCheck, Loader2, Music, Download, MessageCircle, Users } from 'lucide-react';
import { toast } from 'sonner';

interface ChairMember {
  id: string;
  name: string;
  photo_url: string | null;
  naipe: string | null;
  phone: string | null;
}

interface AttendanceRecord {
  member_id: string;
  attended: boolean;
}

interface RehearsalAttendanceManagerProps {
  rehearsalId: string;
  eventId: string;
  isAdmin?: boolean;
  onUpdate?: () => void;
}

const naipeLabels: Record<string, string> = {
  soprano: 'Soprano',
  contralto: 'Contralto',
  tenor: 'Tenor',
  baixo: 'Baixo',
};

const naipeColors: Record<string, string> = {
  soprano: 'bg-pink-500/5 text-pink-600 dark:text-pink-400 border-pink-500/40',
  contralto: 'bg-yellow-500/5 text-yellow-600 dark:text-yellow-400 border-yellow-500/40',
  tenor: 'bg-green-500/5 text-green-600 dark:text-green-400 border-green-500/40',
  baixo: 'bg-blue-500/5 text-blue-600 dark:text-blue-400 border-blue-500/40',
};

export function RehearsalAttendanceManager({ 
  rehearsalId, 
  eventId, 
  isAdmin = false,
  onUpdate 
}: RehearsalAttendanceManagerProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [eventMembers, setEventMembers] = useState<ChairMember[]>([]);
  const [attendance, setAttendance] = useState<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open, rehearsalId, eventId]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch members associated with the event
      const { data: eventMembersData, error: emError } = await supabase
        .from('event_members')
        .select(`
          member_id,
          choir_members (
            id,
            name,
            photo_url,
            naipe,
            phone
          )
        `)
        .eq('event_id', eventId);

      if (emError) throw emError;

      const members = eventMembersData
        ?.map(em => em.choir_members as unknown as ChairMember)
        .filter(Boolean)
        .sort((a, b) => {
          if (a.naipe !== b.naipe) return (a.naipe || 'z').localeCompare(b.naipe || 'z');
          return a.name.localeCompare(b.name);
        }) || [];

      setEventMembers(members);

      // Fetch attendance records
      const { data: attendanceData, error: attError } = await supabase
        .from('rehearsal_attendance')
        .select('member_id, attended')
        .eq('rehearsal_id', rehearsalId)
        .not('member_id', 'is', null);

      if (attError) throw attError;

      const attendanceMap = new Map<string, boolean>();
      attendanceData?.forEach(a => {
        if (a.member_id) {
          attendanceMap.set(a.member_id, a.attended);
        }
      });
      setAttendance(attendanceMap);
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAttendance = async (memberId: string) => {
    if (!isAdmin) return;

    const currentValue = attendance.get(memberId) ?? false;
    const newValue = !currentValue;

    try {
      // Optimistic update
      setAttendance(prev => new Map(prev).set(memberId, newValue));

      // Check if record exists
      const { data: existing } = await supabase
        .from('rehearsal_attendance')
        .select('id')
        .eq('rehearsal_id', rehearsalId)
        .eq('member_id', memberId)
        .maybeSingle();

      if (existing) {
        // Update existing record
        const { error } = await supabase
          .from('rehearsal_attendance')
          .update({ attended: newValue })
          .eq('id', existing.id);

        if (error) throw error;
      } else {
        // Insert new record - need to include user_id since it's required
        const { data: { user } } = await supabase.auth.getUser();
        const { error } = await supabase
          .from('rehearsal_attendance')
          .insert({
            rehearsal_id: rehearsalId,
            user_id: user?.id || '',
            member_id: memberId,
            attended: newValue,
          });

        if (error) throw error;
      }

      onUpdate?.();
    } catch (error: any) {
      // Revert on error
      setAttendance(prev => new Map(prev).set(memberId, currentValue));
      toast.error('Erro ao atualizar presença: ' + error.message);
    }
  };

  const handleMarkAllPresent = async (naipe: string) => {
    const naipeMembers = eventMembers.filter(m => m.naipe === naipe);
    
    try {
      for (const member of naipeMembers) {
        if (!attendance.get(member.id)) {
          await handleToggleAttendance(member.id);
        }
      }
      toast.success(`Todos de ${naipeLabels[naipe]} marcados como presentes!`);
    } catch (error) {
      toast.error('Erro ao marcar presença em lote.');
    }
  };

  const handleDownloadAttendance = () => {
    const lines = ['Nome,Naipe,Presença'];
    eventMembers.forEach(member => {
      const status = attendance.get(member.id) ? 'Presente' : 'Ausente';
      lines.push(`"${member.name}",${naipeLabels[member.naipe || ''] || 'Sem naipe'},${status}`);
    });

    const csv = lines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `presenca-ensaio.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSendWhatsAppReminder = () => {
    const absentMembers = eventMembers.filter(m => !attendance.get(m.id) && m.phone);
    if (absentMembers.length === 0) {
      toast.info('Todos os coralistas com telefone estão presentes!');
      return;
    }

    const phones = absentMembers.map(m => m.phone?.replace(/\D/g, '')).join(',');
    toast.success(`${absentMembers.length} coralistas ausentes identificados.`);
  };

  const groupedMembers = eventMembers.reduce((acc, member) => {
    const naipe = member.naipe || 'sem_naipe';
    if (!acc[naipe]) acc[naipe] = [];
    acc[naipe].push(member);
    return acc;
  }, {} as Record<string, ChairMember[]>);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const presentCount = Array.from(attendance.values()).filter(Boolean).length;
  const totalCount = eventMembers.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <ClipboardCheck className="h-4 w-4" />
          Chamada ({presentCount}/{totalCount})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5" />
            Lista de Presença
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : eventMembers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              Nenhum coralista associado a este evento.
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Adicione coralistas ao evento primeiro.
            </p>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="flex items-center justify-between py-2 border-b">
              <div className="flex items-center gap-4">
                <span className="text-2xl font-bold text-primary">{presentCount}</span>
                <span className="text-muted-foreground">de {totalCount} presentes</span>
              </div>
              {isAdmin && (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={handleDownloadAttendance}>
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Progress Bar */}
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${totalCount > 0 ? (presentCount / totalCount) * 100 : 0}%` }}
              />
            </div>

            {/* Members List */}
            <ScrollArea className="h-[400px] -mx-6 px-6">
              <div className="space-y-6 py-4">
                {Object.entries(groupedMembers).map(([naipe, members]) => {
                  const naipePresent = members.filter(m => attendance.get(m.id)).length;
                  return (
                    <div key={naipe}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Music className="h-4 w-4 text-primary" />
                          <span className="font-medium">
                            {naipe === 'sem_naipe' ? 'Sem naipe' : naipeLabels[naipe]}
                          </span>
                          <Badge variant="secondary" className="h-5">
                            {naipePresent}/{members.length}
                          </Badge>
                        </div>
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleMarkAllPresent(naipe)}
                            className="h-7 text-xs"
                          >
                            Marcar todos
                          </Button>
                        )}
                      </div>
                      <div className="space-y-1">
                        {members.map((member) => (
                          <div
                            key={member.id}
                            onClick={() => isAdmin && handleToggleAttendance(member.id)}
                            className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                              isAdmin ? 'cursor-pointer hover:bg-accent' : ''
                            } ${attendance.get(member.id) ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50/50 dark:bg-red-900/10'}`}
                          >
                            <Checkbox
                              checked={attendance.get(member.id) ?? false}
                              onCheckedChange={() => isAdmin && handleToggleAttendance(member.id)}
                              disabled={!isAdmin}
                            />
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={member.photo_url || undefined} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                                {getInitials(member.name)}
                              </AvatarFallback>
                            </Avatar>
                            <span className="flex-1 text-sm">{member.name}</span>
                            <Badge 
                              variant={attendance.get(member.id) ? "default" : "outline"}
                              className={attendance.get(member.id) 
                                ? "bg-green-500 hover:bg-green-600" 
                                : "text-muted-foreground"}
                            >
                              {attendance.get(member.id) ? 'Presente' : 'Ausente'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

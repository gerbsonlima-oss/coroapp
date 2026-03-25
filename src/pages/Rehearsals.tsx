import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ArrowLeft, Calendar, Edit2, MapPin, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { useTenant, useTenantPath } from '@/contexts/TenantContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RehearsalAttendanceManager } from '@/components/RehearsalAttendanceManager';

interface EventOption {
  id: string;
  name: string;
  date: string;
}

interface Rehearsal {
  id: string;
  event_id: string | null;
  date: string;
  location: string | null;
  notes: string | null;
  events: Pick<EventOption, 'id' | 'name' | 'date'> | null;
}

interface AttendanceRow {
  rehearsal_id: string;
  attended: boolean;
}

const Rehearsals = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { buildPath } = useTenantPath();
  const { tenantId } = useTenant();
  const { isAdmin } = useIsAdmin();

  const [loading, setLoading] = useState(true);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [events, setEvents] = useState<EventOption[]>([]);
  const [attendanceByRehearsal, setAttendanceByRehearsal] = useState<Record<string, number>>({});
  const [eventName, setEventName] = useState('');

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRehearsal, setEditingRehearsal] = useState<Rehearsal | null>(null);
  const [formEventId, setFormEventId] = useState(eventId ?? '');
  const [formDate, setFormDate] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formNotes, setFormNotes] = useState('');

  useEffect(() => {
    if (!tenantId) return;
    fetchData();
  }, [tenantId, eventId]);

  const fetchData = async () => {
    if (!tenantId) return;

    setLoading(true);
    try {
      const [eventsResult, rehearsalsResult] = await Promise.all([
        supabase
          .from('events')
          .select('id, name, date')
          .eq('tenant_id', tenantId)
          .order('date', { ascending: false }),
        (() => {
          let query = supabase
            .from('rehearsals')
            .select(`
              id,
              event_id,
              date,
              location,
              notes,
              events (
                id,
                name,
                date
              )
            `)
            .eq('tenant_id', tenantId)
            .order('date', { ascending: false });

          if (eventId) {
            query = query.eq('event_id', eventId);
          }

          return query;
        })(),
      ]);

      if (eventsResult.error) throw eventsResult.error;
      if (rehearsalsResult.error) throw rehearsalsResult.error;

      const eventsData = (eventsResult.data || []) as EventOption[];
      const rehearsalsData = (rehearsalsResult.data || []) as Rehearsal[];

      setEvents(eventsData);
      setRehearsals(rehearsalsData);

      if (eventId) {
        const selectedEvent = eventsData.find((event) => event.id === eventId);
        setEventName(selectedEvent?.name || '');
      } else {
        setEventName('');
      }

      if (rehearsalsData.length > 0) {
        const rehearsalIds = rehearsalsData.map((rehearsal) => rehearsal.id);
        const { data: attendanceRows, error: attendanceError } = await supabase
          .from('rehearsal_attendance')
          .select('rehearsal_id, attended')
          .in('rehearsal_id', rehearsalIds)
          .eq('attended', true);

        if (attendanceError) throw attendanceError;

        const groupedAttendance = (attendanceRows || []).reduce<Record<string, number>>((acc, row) => {
          const attendance = row as AttendanceRow;
          acc[attendance.rehearsal_id] = (acc[attendance.rehearsal_id] || 0) + 1;
          return acc;
        }, {});

        setAttendanceByRehearsal(groupedAttendance);
      } else {
        setAttendanceByRehearsal({});
      }
    } catch (error: any) {
      toast.error(`Erro ao carregar ensaios: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingRehearsal(null);
    setFormEventId(eventId ?? '');
    setFormDate('');
    setFormLocation('');
    setFormNotes('');
  };

  const openEditDialog = (rehearsal: Rehearsal) => {
    setEditingRehearsal(rehearsal);
    setFormEventId(rehearsal.event_id || eventId || '');
    setFormDate(rehearsal.date);
    setFormLocation(rehearsal.location || '');
    setFormNotes(rehearsal.notes || '');
    setIsDialogOpen(true);
  };

  const handleCreateOrUpdate = async () => {
    if (!formEventId) {
      toast.error('Selecione um evento para vincular o ensaio.');
      return;
    }

    if (!formDate) {
      toast.error('Data e obrigatoria.');
      return;
    }

    try {
      if (editingRehearsal) {
        const { error } = await supabase
          .from('rehearsals')
          .update({
            event_id: formEventId,
            date: formDate,
            location: formLocation || null,
            notes: formNotes || null,
          })
          .eq('id', editingRehearsal.id);

        if (error) throw error;
        toast.success('Ensaio atualizado com sucesso.');
      } else {
        const { error } = await supabase
          .from('rehearsals')
          .insert({
            event_id: formEventId,
            tenant_id: tenantId,
            date: formDate,
            location: formLocation || null,
            notes: formNotes || null,
          });

        if (error) throw error;
        toast.success('Ensaio criado com sucesso.');
      }

      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error(`Erro ao salvar ensaio: ${error.message}`);
    }
  };

  const handleDelete = async (rehearsalId: string) => {
    if (!confirm('Deseja excluir este ensaio?')) return;

    try {
      const { error } = await supabase.from('rehearsals').delete().eq('id', rehearsalId);
      if (error) throw error;

      toast.success('Ensaio excluido.');
      fetchData();
    } catch (error: any) {
      toast.error(`Erro ao excluir ensaio: ${error.message}`);
    }
  };

  const orderedEvents = useMemo(
    () => [...events].sort((a, b) => b.date.localeCompare(a.date)),
    [events]
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex items-center gap-3 p-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(eventId ? buildPath(`/events/${eventId}`) : buildPath('/events'))}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>

          <div className="flex-1">
            <h1 className="text-lg font-semibold">Ensaios</h1>
            {eventName ? (
              <p className="text-sm text-muted-foreground">{eventName}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Agenda de ensaios e frequencia</p>
            )}
          </div>

          {isAdmin && (
            <Dialog
              open={isDialogOpen}
              onOpenChange={(open) => {
                setIsDialogOpen(open);
                if (!open) resetForm();
              }}
            >
              <DialogTrigger asChild>
                <Button size="icon" className="gradient-primary">
                  <Plus className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingRehearsal ? 'Editar Ensaio' : 'Novo Ensaio'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Evento *</Label>
                    <Select
                      value={formEventId}
                      onValueChange={setFormEventId}
                      disabled={!!eventId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o evento" />
                      </SelectTrigger>
                      <SelectContent>
                        {orderedEvents.map((event) => (
                          <SelectItem key={event.id} value={event.id}>
                            {event.name} - {format(new Date(event.date), 'dd/MM/yyyy')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Data *</Label>
                    <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
                  </div>

                  <div className="space-y-2">
                    <Label>Local</Label>
                    <Input
                      placeholder="Local do ensaio"
                      value={formLocation}
                      onChange={(e) => setFormLocation(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Observacoes</Label>
                    <Input
                      placeholder="Observacoes"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                    />
                  </div>

                  <Button onClick={handleCreateOrUpdate} className="w-full gradient-primary">
                    {editingRehearsal ? 'Salvar alteracoes' : 'Criar ensaio'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="space-y-3 p-4">
        {rehearsals.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground">
            <Calendar className="mx-auto mb-4 h-12 w-12 opacity-50" />
            <p>Nenhum ensaio cadastrado</p>
          </div>
        ) : (
          rehearsals.map((rehearsal) => {
            const linkedEventName = rehearsal.events?.name || 'Evento nao vinculado';
            const hasLinkedEvent = Boolean(rehearsal.event_id);
            const attendanceCount = attendanceByRehearsal[rehearsal.id] || 0;

            return (
              <Card key={rehearsal.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 font-medium text-foreground">
                      <Calendar className="h-4 w-4 text-primary" />
                      {format(new Date(rehearsal.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                    </div>

                    <p className={`mt-1 text-sm ${hasLinkedEvent ? 'text-muted-foreground' : 'text-destructive'}`}>
                      Evento: {linkedEventName}
                    </p>

                    {rehearsal.location && (
                      <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        {rehearsal.location}
                      </div>
                    )}

                    {rehearsal.notes && <p className="mt-2 text-sm text-muted-foreground">{rehearsal.notes}</p>}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {hasLinkedEvent ? (
                        <RehearsalAttendanceManager
                          rehearsalId={rehearsal.id}
                          eventId={rehearsal.event_id as string}
                          isAdmin={isAdmin}
                          onUpdate={fetchData}
                        />
                      ) : (
                        <Button variant="outline" size="sm" disabled>
                          Vincule um evento
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" className="gap-2">
                        <Users className="h-4 w-4" />
                        {attendanceCount} presentes
                      </Button>
                    </div>
                  </div>

                  {isAdmin && (
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(rehearsal)}>
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(rehearsal.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

export default Rehearsals;

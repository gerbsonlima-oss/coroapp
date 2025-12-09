import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Plus, Users, Trash2, Edit2, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface EventRegistration {
  id: string;
  event_id: string;
  user_id: string;
  created_at: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    naipe: string | null;
    phone: string | null;
  } | null;
}

interface Event {
  id: string;
  name: string;
  date: string;
  location: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  naipe: string | null;
  phone: string | null;
}

const naipeLabels: Record<string, string> = {
  soprano: 'Soprano',
  contralto: 'Contralto',
  tenor: 'Tenor',
  baixo: 'Baixo',
};

const EventRegistrations = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [event, setEvent] = useState<Event | null>(null);
  const [registrations, setRegistrations] = useState<EventRegistration[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    checkAdminStatus();
  }, [user]);

  useEffect(() => {
    if (eventId) {
      fetchData();
    }
  }, [eventId]);

  const checkAdminStatus = async () => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    setIsAdmin(!!data);
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      if (!eventId) return;

      const { data: eventData } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();
      if (eventData) setEvent(eventData);

      const { data: registrationsData, error: regError } = await supabase
        .from('event_registrations')
        .select('*, profiles(*)')
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

      if (regError && regError.code !== 'PGRST116') throw regError;
      setRegistrations((registrationsData || []) as EventRegistration[]);

      const { data: profilesData, error: profError } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name');
      if (profError) throw profError;
      setAllProfiles(profilesData || []);
    } catch (error: any) {
      if (error.code !== 'PGRST116') {
        toast.error('Erro ao carregar inscrições: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAddRegistrations = async () => {
    if (selectedUsers.size === 0) {
      toast.error('Selecione pelo menos um participante');
      return;
    }

    try {
      const registrationsToAdd = Array.from(selectedUsers).map((userId) => ({
        event_id: eventId,
        user_id: userId,
      }));

      const { error } = await supabase
        .from('event_registrations')
        .insert(registrationsToAdd);

      if (error) throw error;
      toast.success('Participantes inscritos com sucesso!');
      setSelectedUsers(new Set());
      setIsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error('Erro ao inscrever: ' + error.message);
    }
  };

  const handleRemoveRegistration = async (registrationId: string) => {
    if (!confirm('Deseja remover este participante?')) return;

    try {
      const { error } = await supabase
        .from('event_registrations')
        .delete()
        .eq('id', registrationId);

      if (error) throw error;
      toast.success('Participante removido!');
      fetchData();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const handleDownloadList = () => {
    const csv = [
      ['Nome', 'Email', 'Naipe', 'Telefone', 'Data de Inscrição'].join(','),
      ...registrations.map((reg) =>
        [
          reg.profile?.full_name || 'N/A',
          reg.profile?.email || 'N/A',
          naipeLabels[reg.profile?.naipe || ''] || reg.profile?.naipe || 'N/A',
          reg.profile?.phone || 'N/A',
          format(new Date(reg.created_at), 'dd/MM/yyyy', { locale: ptBR }),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inscritos-${event?.name || 'evento'}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('Lista exportada!');
  };

  const registeredUserIds = new Set(registrations.map((r) => r.profile?.id).filter(Boolean));
  const availableProfiles = allProfiles.filter(
    (p) => !registeredUserIds.has(p.id) && p.full_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
        <div className="flex items-center gap-3 p-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-lg font-semibold">Inscrições do Evento</h1>
            {event && <p className="text-sm text-muted-foreground">{event.name}</p>}
          </div>
          <Button variant="outline" size="icon" onClick={handleDownloadList}>
            <Download className="h-5 w-5" />
          </Button>
          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button size="icon" className="gradient-primary">
                  <Plus className="h-5 w-5" />
                </Button>
              </DialogTrigger>
              <DialogContent className="max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                  <DialogTitle>Adicionar Participantes</DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto space-y-4 pt-4">
                  <Input
                    placeholder="Buscar participante..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <div className="space-y-2">
                    {availableProfiles.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">
                        Nenhum participante disponível
                      </p>
                    ) : (
                      availableProfiles.map((profile) => (
                        <div
                          key={profile.id}
                          className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            const newSelected = new Set(selectedUsers);
                            if (newSelected.has(profile.id)) {
                              newSelected.delete(profile.id);
                            } else {
                              newSelected.add(profile.id);
                            }
                            setSelectedUsers(newSelected);
                          }}
                        >
                          <Checkbox checked={selectedUsers.has(profile.id)} />
                          <div className="flex-1">
                            <p className="font-medium text-sm">{profile.full_name}</p>
                            <p className="text-xs text-muted-foreground">{profile.email}</p>
                          </div>
                          {profile.naipe && (
                            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                              {naipeLabels[profile.naipe] || profile.naipe}
                            </span>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
                <Button onClick={handleAddRegistrations} className="w-full gradient-primary mt-4">
                  Inscrever {selectedUsers.size > 0 ? `(${selectedUsers.size})` : ''}
                </Button>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <Users className="h-4 w-4" />
          <span>{registrations.length} participante{registrations.length !== 1 ? 's' : ''}</span>
        </div>

        {registrations.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum participante inscrito</p>
          </div>
        ) : (
          registrations.map((registration) => (
            <Card key={registration.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium">{registration.profile?.full_name || 'N/A'}</p>
                  <p className="text-sm text-muted-foreground">{registration.profile?.email}</p>
                  {registration.profile?.naipe && (
                    <span className="inline-block mt-2 text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                      {naipeLabels[registration.profile.naipe] || registration.profile.naipe}
                    </span>
                  )}
                  {registration.profile?.phone && (
                    <p className="text-xs text-muted-foreground mt-2">{registration.profile.phone}</p>
                  )}
                  <p className="text-xs text-muted-foreground mt-1">
                    Inscrito em: {format(new Date(registration.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveRegistration(registration.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default EventRegistrations;

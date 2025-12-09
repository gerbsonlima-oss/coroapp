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
import { ArrowLeft, Plus, Calendar, MapPin, Users, Trash2, Edit2, Phone, MessageCircle, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Rehearsal {
  id: string;
  event_id: string | null;
  date: string;
  location: string | null;
  notes: string | null;
  created_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string;
  naipe: string | null;
  phone: string | null;
}

interface Attendance {
  id: string;
  rehearsal_id: string;
  user_id: string;
  attended: boolean;
}

const naipeLabels: Record<string, string> = {
  soprano: 'Soprano',
  contralto: 'Contralto',
  tenor: 'Tenor',
  baixo: 'Baixo',
};

const Rehearsals = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [attendance, setAttendance] = useState<Record<string, Attendance[]>>({});
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [eventName, setEventName] = useState('');
  
  // Form state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingRehearsal, setEditingRehearsal] = useState<Rehearsal | null>(null);
  const [formDate, setFormDate] = useState('');
  const [formLocation, setFormLocation] = useState('');
  const [formNotes, setFormNotes] = useState('');
  
  // Attendance dialog
  const [selectedRehearsal, setSelectedRehearsal] = useState<Rehearsal | null>(null);
  const [isAttendanceDialogOpen, setIsAttendanceDialogOpen] = useState(false);

  useEffect(() => {
    checkAdminStatus();
    fetchData();
  }, [eventId, user]);

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
      // Fetch event name if eventId is provided
      if (eventId) {
        const { data: eventData } = await supabase
          .from('events')
          .select('name')
          .eq('id', eventId)
          .single();
        if (eventData) setEventName(eventData.name);
      }

      // Fetch rehearsals
      let query = supabase.from('rehearsals').select('*').order('date', { ascending: false });
      if (eventId) {
        query = query.eq('event_id', eventId);
      }
      const { data: rehearsalsData, error: rehearsalsError } = await query;
      if (rehearsalsError) throw rehearsalsError;
      setRehearsals(rehearsalsData || []);

      // Fetch all profiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, email, naipe, phone')
        .order('full_name');
      if (profilesError) throw profilesError;
      setProfiles(profilesData || []);

      // Fetch attendance for all rehearsals
      if (rehearsalsData && rehearsalsData.length > 0) {
        const rehearsalIds = rehearsalsData.map(r => r.id);
        const { data: attendanceData, error: attendanceError } = await supabase
          .from('rehearsal_attendance')
          .select('*')
          .in('rehearsal_id', rehearsalIds);
        if (attendanceError) throw attendanceError;
        
        const attendanceByRehearsal: Record<string, Attendance[]> = {};
        (attendanceData || []).forEach(a => {
          if (!attendanceByRehearsal[a.rehearsal_id]) {
            attendanceByRehearsal[a.rehearsal_id] = [];
          }
          attendanceByRehearsal[a.rehearsal_id].push(a);
        });
        setAttendance(attendanceByRehearsal);
      }
    } catch (error: any) {
      toast.error('Erro ao carregar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateOrUpdate = async () => {
    if (!formDate) {
      toast.error('Data é obrigatória');
      return;
    }

    try {
      if (editingRehearsal) {
        const { error } = await supabase
          .from('rehearsals')
          .update({
            date: formDate,
            location: formLocation || null,
            notes: formNotes || null,
          })
          .eq('id', editingRehearsal.id);
        if (error) throw error;
        toast.success('Ensaio atualizado!');
      } else {
        const { error } = await supabase
          .from('rehearsals')
          .insert({
            event_id: eventId || null,
            date: formDate,
            location: formLocation || null,
            notes: formNotes || null,
          });
        if (error) throw error;
        toast.success('Ensaio criado!');
      }
      
      setIsDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deseja excluir este ensaio?')) return;
    
    try {
      const { error } = await supabase.from('rehearsals').delete().eq('id', id);
      if (error) throw error;
      toast.success('Ensaio excluído!');
      fetchData();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const handleToggleAttendance = async (rehearsalId: string, userId: string, currentAttended: boolean | null) => {
    try {
      const existingAttendance = attendance[rehearsalId]?.find(a => a.user_id === userId);
      
      if (existingAttendance) {
        const { error } = await supabase
          .from('rehearsal_attendance')
          .update({ attended: !currentAttended })
          .eq('id', existingAttendance.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('rehearsal_attendance')
          .insert({
            rehearsal_id: rehearsalId,
            user_id: userId,
            attended: true,
          });
        if (error) throw error;
      }
      
      fetchData();
    } catch (error: any) {
      toast.error('Erro: ' + error.message);
    }
  };

  const resetForm = () => {
    setEditingRehearsal(null);
    setFormDate('');
    setFormLocation('');
    setFormNotes('');
  };

  const openEditDialog = (rehearsal: Rehearsal) => {
    setEditingRehearsal(rehearsal);
    setFormDate(rehearsal.date);
    setFormLocation(rehearsal.location || '');
    setFormNotes(rehearsal.notes || '');
    setIsDialogOpen(true);
  };

  const openAttendanceDialog = (rehearsal: Rehearsal) => {
    setSelectedRehearsal(rehearsal);
    setIsAttendanceDialogOpen(true);
  };

  const getAttendanceCount = (rehearsalId: string) => {
    const rehearsalAttendance = attendance[rehearsalId] || [];
    return rehearsalAttendance.filter(a => a.attended).length;
  };

  const formatPhoneForWhatsApp = (phone: string) => {
    return phone.replace(/\D/g, '');
  };

  const handleSendWhatsAppToAll = () => {
    const phonesWithAttendance = profiles
      .filter(p => p.phone)
      .map(p => formatPhoneForWhatsApp(p.phone!));
    
    if (phonesWithAttendance.length === 0) {
      toast.error('Nenhum participante com telefone cadastrado');
      return;
    }

    const message = encodeURIComponent(`Olá! Mensagem do Coro da Diocese de Quixadá.`);
    window.open(`https://wa.me/55${phonesWithAttendance[0]}?text=${message}`, '_blank');
    
    toast.info(`${phonesWithAttendance.length} números disponíveis. Aberto o primeiro.`);
  };

  const handleDownloadAttendance = (rehearsalId: string) => {
    if (!selectedRehearsal) return;

    const rehearsalAttendance = attendance[rehearsalId] || [];
    const attendedProfiles = profiles.filter(p => isUserAttended(rehearsalId, p.id));
    const absentProfiles = profiles.filter(p => !isUserAttended(rehearsalId, p.id));

    const csv = [
      `LISTA DE PRESENÇA - ${format(new Date(selectedRehearsal.date), 'dd/MM/yyyy')}`,
      `Local: ${selectedRehearsal.location || 'Não especificado'}`,
      `Total de Presentes: ${attendedProfiles.length}`,
      `Total de Ausentes: ${absentProfiles.length}`,
      '',
      'PRESENTES',
      ['Nome', 'Email', 'Naipe'].join(','),
      ...attendedProfiles.map(p => [
        p.full_name || 'N/A',
        p.email,
        p.naipe || 'N/A'
      ].join(',')),
      '',
      'AUSENTES',
      ['Nome', 'Email', 'Naipe'].join(','),
      ...absentProfiles.map(p => [
        p.full_name || 'N/A',
        p.email,
        p.naipe || 'N/A'
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `presenca-${format(selectedRehearsal.date, 'dd-MM-yyyy')}.csv`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success('Lista exportada!');
  };

  const isUserAttended = (rehearsalId: string, userId: string) => {
    const rehearsalAttendance = attendance[rehearsalId] || [];
    const userAttendance = rehearsalAttendance.find(a => a.user_id === userId);
    return userAttendance?.attended || false;
  };

  const groupedProfiles = profiles.reduce((acc, profile) => {
    const naipe = profile.naipe || 'sem_naipe';
    if (!acc[naipe]) acc[naipe] = [];
    acc[naipe].push(profile);
    return acc;
  }, {} as Record<string, Profile[]>);

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
            <h1 className="text-lg font-semibold">Ensaios</h1>
            {eventName && <p className="text-sm text-muted-foreground">{eventName}</p>}
          </div>
          {isAdmin && (
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) resetForm();
            }}>
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
                    <Label>Data *</Label>
                    <Input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                    />
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
                    <Label>Observações</Label>
                    <Input
                      placeholder="Observações"
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                    />
                  </div>
                  <Button onClick={handleCreateOrUpdate} className="w-full gradient-primary">
                    {editingRehearsal ? 'Salvar' : 'Criar Ensaio'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <div className="p-4 space-y-3">
        {rehearsals.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum ensaio cadastrado</p>
          </div>
        ) : (
          rehearsals.map((rehearsal) => (
            <Card key={rehearsal.id} className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-foreground font-medium">
                    <Calendar className="h-4 w-4 text-primary" />
                    {format(new Date(rehearsal.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </div>
                  {rehearsal.location && (
                    <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {rehearsal.location}
                    </div>
                  )}
                  {rehearsal.notes && (
                    <p className="mt-2 text-sm text-muted-foreground">{rehearsal.notes}</p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 gap-2"
                    onClick={() => openAttendanceDialog(rehearsal)}
                  >
                    <Users className="h-4 w-4" />
                    {getAttendanceCount(rehearsal.id)} participantes
                  </Button>
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
          ))
        )}
      </div>

      {/* Attendance Dialog */}
      <Dialog open={isAttendanceDialogOpen} onOpenChange={setIsAttendanceDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <div>
                Lista de Presença
                {selectedRehearsal && (
                  <span className="block text-sm font-normal text-muted-foreground mt-1">
                    {format(new Date(selectedRehearsal.date), "dd/MM/yyyy")}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                {isAdmin && (
                  <>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={() => handleDownloadAttendance(selectedRehearsal!.id)}
                    >
                      <Download className="h-4 w-4" />
                      Baixar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2"
                      onClick={handleSendWhatsAppToAll}
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </Button>
                  </>
                )}
              </div>
            </DialogTitle>
          </DialogHeader>
          {selectedRehearsal && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-3 gap-2 p-2 bg-muted/50 rounded-lg">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-lg font-bold">{profiles.length}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Presentes</p>
                  <p className="text-lg font-bold text-green-600">{getAttendanceCount(selectedRehearsal.id)}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Ausentes</p>
                  <p className="text-lg font-bold text-red-600">{profiles.length - getAttendanceCount(selectedRehearsal.id)}</p>
                </div>
              </div>
              {Object.entries(groupedProfiles).map(([naipe, naipeProfiles]) => (
                <div key={naipe}>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">
                    {naipeLabels[naipe] || 'Sem Naipe'}
                  </h3>
                  <div className="space-y-2">
                    {naipeProfiles.map((profile) => {
                      const attended = isUserAttended(selectedRehearsal.id, profile.id);
                      return (
                        <div
                          key={profile.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                        >
                          {isAdmin ? (
                            <Checkbox
                              checked={attended}
                              onCheckedChange={() =>
                                handleToggleAttendance(selectedRehearsal.id, profile.id, attended)
                              }
                            />
                          ) : (
                            <div className={`w-3 h-3 rounded-full ${attended ? 'bg-green-500' : 'bg-muted'}`} />
                          )}
                          <div className="flex-1">
                            <p className="text-sm font-medium">{profile.full_name || profile.email}</p>
                            {profile.phone && (
                              <div className="flex items-center gap-2 mt-0.5">
                                <Phone className="h-3 w-3 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">{profile.phone}</span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5"
                                  onClick={() => window.open(`https://wa.me/55${formatPhoneForWhatsApp(profile.phone!)}`, '_blank')}
                                >
                                  <MessageCircle className="h-3 w-3 text-green-600" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
              {profiles.length === 0 && (
                <p className="text-center text-muted-foreground py-4">
                  Nenhum membro cadastrado
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Rehearsals;
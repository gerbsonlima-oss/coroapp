import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenant, useTenantPath } from '@/contexts/TenantContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Edit, Phone, Mail, Church, Calendar, Music, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format, parseISO, differenceInYears } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ChoirMember {
  id: string;
  full_name: string | null;
  email: string;
  birth_date: string | null;
  photo_url: string | null;
  parish: string | null;
  naipe: string | null;
  phone: string | null;
  active: boolean | null;
  created_at: string | null;
}

interface AttendanceStats {
  total: number;
  attended: number;
}

import { naipeLabels, naipeColors } from '@/constants/naipes';

export default function ChoirMemberDetails() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { tenantSlug } = useTenant();
  const { buildPath } = useTenantPath();
  const { isAdmin } = useIsAdmin();
  const [member, setMember] = useState<ChoirMember | null>(null);
  const [attendanceStats, setAttendanceStats] = useState<AttendanceStats>({ total: 0, attended: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchMember();
      fetchAttendanceStats();
    }
  }, [id]);

  const fetchMember = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, full_name, birth_date, photo_url, parish, naipe, phone, active, created_at')
        .eq('id', id)
        .single();

      if (error) throw error;
      setMember(data as ChoirMember);
    } catch (error: any) {
      toast.error('Erro ao carregar usuário: ' + error.message);
      navigate(buildPath('/choir-members'));
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceStats = async () => {
    try {
      const { data, error } = await supabase
        .from('rehearsal_attendance')
        .select('attended')
        .eq('member_id', id);

      if (error) throw error;
      
      const total = data?.length || 0;
      const attended = data?.filter(a => a.attended).length || 0;
      setAttendanceStats({ total, attended });
    } catch (error) {
      console.error('Error fetching attendance stats:', error);
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const calculateAge = (birthDate: string) => {
    return differenceInYears(new Date(), parseISO(birthDate));
  };

  const attendancePercentage = attendanceStats.total > 0 
    ? Math.round((attendanceStats.attended / attendanceStats.total) * 100) 
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Usuário não encontrado.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(buildPath('/choir-members'))}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-xl font-bold">Detalhes</h1>
          </div>
          {isAdmin && (
            <Button onClick={() => navigate(buildPath(`/choir-members/${id}/edit`))}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Profile Header */}
      <div className="p-6 flex flex-col items-center text-center border-b border-border">
        <Avatar className="h-28 w-28 border-4 border-background shadow-lg mb-4">
          <AvatarImage src={member.photo_url || undefined} alt={member.full_name || member.email} />
          <AvatarFallback className="bg-primary/10 text-primary text-3xl font-medium">
            {getInitials(member.full_name || member.email)}
          </AvatarFallback>
        </Avatar>
        <h2 className="text-2xl font-bold">{member.full_name || member.email}</h2>
        <div className="flex items-center gap-2 mt-2">
          {member.naipe && (
            <Badge variant="outline" className={naipeColors[member.naipe]}>
              <Music className="h-3 w-3 mr-1" />
              {naipeLabels[member.naipe]}
            </Badge>
          )}
          {!member.active && (
            <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Info Cards */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {member.birth_date && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Calendar className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">
                    {format(parseISO(member.birth_date), "d 'de' MMMM", { locale: ptBR })}
                  </p>
                  <p className="text-sm text-muted-foreground">{calculateAge(member.birth_date)} anos</p>
                </div>
              </div>
            )}
            {member.parish && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Church className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{member.parish}</p>
                  <p className="text-sm text-muted-foreground">Paróquia</p>
                </div>
              </div>
            )}
            {member.phone && (
              <a 
                href={`tel:${member.phone}`}
                className="flex items-center gap-3 hover:bg-accent rounded-lg -mx-2 px-2 py-1 transition-colors"
              >
                <div className="p-2 rounded-full bg-primary/10">
                  <Phone className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium">{member.phone}</p>
                  <p className="text-sm text-muted-foreground">Telefone</p>
                </div>
              </a>
            )}
            {member.email && (
              <a 
                href={`mailto:${member.email}`}
                className="flex items-center gap-3 hover:bg-accent rounded-lg -mx-2 px-2 py-1 transition-colors"
              >
                <div className="p-2 rounded-full bg-primary/10">
                  <Mail className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="font-medium truncate">{member.email}</p>
                  <p className="text-sm text-muted-foreground">E-mail</p>
                </div>
              </a>
            )}
          </CardContent>
        </Card>

        {/* Attendance Stats */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Frequência nos Ensaios</CardTitle>
          </CardHeader>
          <CardContent>
            {attendanceStats.total > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-4xl font-bold text-primary">{attendancePercentage}%</span>
                  <span className="text-muted-foreground">
                    {attendanceStats.attended} de {attendanceStats.total} ensaios
                  </span>
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${attendancePercentage}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-4">
                Nenhum registro de presença ainda.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Member Since */}
        <p className="text-center text-sm text-muted-foreground">
          Membro desde {format(parseISO(member.created_at), "MMMM 'de' yyyy", { locale: ptBR })}
        </p>
      </div>
    </div>
  );
}


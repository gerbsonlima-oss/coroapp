import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import { useIsAdmin } from '@/hooks/useIsAdmin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, Plus, Search, Users, Phone, Mail, Church, Music } from 'lucide-react';
import { toast } from 'sonner';

interface ChairMember {
  id: string;
  name: string;
  birth_date: string | null;
  photo_url: string | null;
  parish: string | null;
  naipe: string | null;
  phone: string | null;
  email: string | null;
  active: boolean;
}

const naipeLabels: Record<string, string> = {
  soprano: 'Soprano',
  contralto: 'Contralto',
  tenor: 'Tenor',
  baixo: 'Baixo',
};

const naipeColors: Record<string, string> = {
  soprano: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  contralto: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  tenor: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  baixo: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
};

export default function ChoirMembers() {
  const navigate = useNavigate();
  const { tenantId, tenantSlug } = useTenant();
  const { isAdmin } = useIsAdmin();
  const [members, setMembers] = useState<ChairMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterNaipe, setFilterNaipe] = useState<string>('all');

  useEffect(() => {
    if (tenantId) {
      fetchMembers();
    }
  }, [tenantId]);

  const fetchMembers = async () => {
    try {
      const { data, error } = await supabase
        .from('choir_members')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('name');

      if (error) throw error;
      setMembers(data || []);
    } catch (error: any) {
      toast.error('Erro ao carregar coralistas: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredMembers = members.filter((member) => {
    const matchesSearch = member.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      member.parish?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesNaipe = filterNaipe === 'all' || member.naipe === filterNaipe;
    return matchesSearch && matchesNaipe;
  });

  const groupedMembers = filteredMembers.reduce((acc, member) => {
    const naipe = member.naipe || 'sem_naipe';
    if (!acc[naipe]) acc[naipe] = [];
    acc[naipe].push(member);
    return acc;
  }, {} as Record<string, ChairMember[]>);

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const buildPath = (path: string) => {
    return tenantSlug ? `/${tenantSlug}${path}` : path;
  };

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-muted-foreground">Acesso restrito a administradores.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(buildPath('/'))}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold">Coralistas</h1>
              <p className="text-sm text-muted-foreground">{members.length} membros</p>
            </div>
          </div>
          <Button onClick={() => navigate(buildPath('/choir-members/new'))}>
            <Plus className="h-4 w-4 mr-2" />
            Novo
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou paróquia..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={filterNaipe} onValueChange={setFilterNaipe}>
          <SelectTrigger>
            <SelectValue placeholder="Filtrar por naipe" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os naipes</SelectItem>
            <SelectItem value="soprano">Soprano</SelectItem>
            <SelectItem value="contralto">Contralto</SelectItem>
            <SelectItem value="tenor">Tenor</SelectItem>
            <SelectItem value="baixo">Baixo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Members List */}
      <div className="px-4 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="text-center py-12">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchTerm || filterNaipe !== 'all'
                ? 'Nenhum coralista encontrado com esses filtros.'
                : 'Nenhum coralista cadastrado ainda.'}
            </p>
            {!searchTerm && filterNaipe === 'all' && (
              <Button
                variant="outline"
                className="mt-4"
                onClick={() => navigate(buildPath('/choir-members/new'))}
              >
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar primeiro coralista
              </Button>
            )}
          </div>
        ) : (
          Object.entries(groupedMembers).map(([naipe, naipeMembers]) => (
            <div key={naipe}>
              <div className="flex items-center gap-2 mb-3">
                <Music className="h-4 w-4 text-primary" />
                <h2 className="font-semibold text-lg">
                  {naipe === 'sem_naipe' ? 'Sem naipe definido' : naipeLabels[naipe] || naipe}
                </h2>
                <Badge variant="secondary">{naipeMembers.length}</Badge>
              </div>
              <div className="space-y-2">
                {naipeMembers.map((member) => (
                  <div
                    key={member.id}
                    onClick={() => navigate(buildPath(`/choir-members/${member.id}`))}
                    className="flex items-center gap-4 p-4 bg-card rounded-lg border border-border hover:border-primary/50 transition-colors cursor-pointer"
                  >
                    <Avatar className="h-14 w-14">
                      <AvatarImage src={member.photo_url || undefined} alt={member.name} />
                      <AvatarFallback className="bg-primary/10 text-primary font-medium">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium truncate">{member.name}</h3>
                        {!member.active && (
                          <Badge variant="outline" className="text-muted-foreground">Inativo</Badge>
                        )}
                      </div>
                      {member.parish && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <Church className="h-3 w-3" />
                          <span className="truncate">{member.parish}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1">
                        {member.phone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone className="h-3 w-3" />
                          </div>
                        )}
                        {member.email && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3" />
                          </div>
                        )}
                      </div>
                    </div>
                    {member.naipe && (
                      <Badge className={naipeColors[member.naipe]}>
                        {naipeLabels[member.naipe]}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

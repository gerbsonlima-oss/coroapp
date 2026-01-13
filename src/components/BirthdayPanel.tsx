import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Cake, PartyPopper, Sparkles } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BirthdayMember {
  id: string;
  name: string;
  birth_date: string;
  photo_url: string | null;
  naipe: string | null;
}

interface BirthdayPanelProps {
  tenantId: string;
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

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

export function BirthdayPanel({ tenantId }: BirthdayPanelProps) {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  const monthName = format(today, 'MMMM', { locale: ptBR });

  const { data: birthdayMembers = [] } = useQuery({
    queryKey: ['birthday-members', tenantId, currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('choir_members')
        .select('id, name, birth_date, photo_url, naipe')
        .eq('tenant_id', tenantId)
        .eq('active', true)
        .not('birth_date', 'is', null);

      if (error) throw error;

      // Filter members whose birthday is in the current month
      const monthBirthdays = (data || []).filter((member) => {
        if (!member.birth_date) return false;
        const birthMonth = new Date(member.birth_date).getMonth() + 1;
        return birthMonth === currentMonth;
      }) as BirthdayMember[];

      // Sort: today's birthdays first, then by day of month
      return monthBirthdays.sort((a, b) => {
        const dayA = new Date(a.birth_date).getDate();
        const dayB = new Date(b.birth_date).getDate();

        // Today's birthdays come first
        const isTodayA = dayA === currentDay;
        const isTodayB = dayB === currentDay;

        if (isTodayA && !isTodayB) return -1;
        if (isTodayB && !isTodayA) return 1;

        return dayA - dayB;
      });
    },
    enabled: !!tenantId,
  });

  if (birthdayMembers.length === 0) {
    return null;
  }

  const todayBirthdays = birthdayMembers.filter(
    (member) => new Date(member.birth_date).getDate() === currentDay
  );
  const otherBirthdays = birthdayMembers.filter(
    (member) => new Date(member.birth_date).getDate() !== currentDay
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Cake className="h-5 w-5 text-amber-500" />
        <h3 className="font-semibold text-lg capitalize">
          Aniversariantes de {monthName}
        </h3>
        <Badge variant="secondary" className="ml-auto">
          {birthdayMembers.length}
        </Badge>
      </div>

      {/* Today's Birthday Highlight */}
      {todayBirthdays.length > 0 && (
        <div className="space-y-3">
          {todayBirthdays.map((member) => (
            <Card
              key={member.id}
              className="overflow-hidden border-amber-300 dark:border-amber-700 bg-gradient-to-r from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/30 dark:via-yellow-900/20 dark:to-orange-900/20 shadow-lg"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <Avatar className="h-16 w-16 ring-4 ring-amber-300 dark:ring-amber-600 shadow-lg">
                      <AvatarImage
                        src={member.photo_url || undefined}
                        alt={member.name}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-amber-100 text-amber-700 text-lg font-bold dark:bg-amber-800 dark:text-amber-200">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -top-1 -right-1 bg-amber-500 rounded-full p-1 shadow-md">
                      <PartyPopper className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        Aniversário Hoje!
                      </span>
                    </div>
                    <h4 className="font-bold text-lg text-foreground truncate">
                      {member.name}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      {member.naipe && (
                        <Badge className={`text-xs ${naipeColors[member.naipe]}`}>
                          {naipeLabels[member.naipe]}
                        </Badge>
                      )}
                      <span className="text-sm text-amber-600 dark:text-amber-400 font-medium">
                        🎉 Parabéns!
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Other Birthdays This Month */}
      {otherBirthdays.length > 0 && (
        <div className="grid grid-cols-1 gap-2">
          {otherBirthdays.map((member) => {
            const birthDay = new Date(member.birth_date).getDate();
            return (
              <Card
                key={member.id}
                className="overflow-hidden border-0 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
                      <AvatarImage
                        src={member.photo_url || undefined}
                        alt={member.name}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">
                        {member.name}
                      </h4>
                      {member.naipe && (
                        <span className="text-xs text-muted-foreground">
                          {naipeLabels[member.naipe]}
                        </span>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-sm font-medium text-muted-foreground">
                        dia {birthDay}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

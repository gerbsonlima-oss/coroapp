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
  full_name: string | null;
  email: string;
  birth_date: string;
  photo_url: string | null;
  naipe: string | null;
}

interface BirthdayPanelProps {
  tenantId: string;
}

import { naipeLabels, naipeColors } from '@/constants/naipes';

const getInitials = (name: string) => {
  return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
};

// Balloon SVG component
const Balloon = ({ className, color, style }: { className?: string; color: string; style?: React.CSSProperties }) => (
  <svg
    viewBox="0 0 24 32"
    className={className}
    style={style}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <ellipse cx="12" cy="10" rx="9" ry="10" fill={color} />
    <ellipse cx="12" cy="10" rx="9" ry="10" fill="url(#shine)" fillOpacity="0.3" />
    <path d="M12 20L10 24L12 23L14 24L12 20Z" fill={color} />
    <path d="M12 24C12 24 11 28 12 32" stroke={color} strokeWidth="0.5" />
    <defs>
      <radialGradient id="shine" cx="0.3" cy="0.3" r="0.7">
        <stop offset="0%" stopColor="white" />
        <stop offset="100%" stopColor="transparent" />
      </radialGradient>
    </defs>
  </svg>
);

// Floating balloons decoration
const FloatingBalloons = () => (
  <div className="absolute -top-2 -right-2 flex gap-1 opacity-80">
    <Balloon className="w-6 h-8 animate-float" color="hsl(var(--primary))" />
    <Balloon className="w-5 h-7 animate-float" color="#f472b6" style={{ animationDelay: '0.2s' }} />
    <Balloon className="w-4 h-6 animate-float" color="#fbbf24" style={{ animationDelay: '0.4s' }} />
  </div>
);

// Small balloons for list items
const SmallBalloons = () => (
  <div className="flex gap-0.5">
    <Balloon className="w-3 h-4" color="#f472b6" />
    <Balloon className="w-3 h-4" color="#60a5fa" />
  </div>
);

export function BirthdayPanel({ tenantId }: BirthdayPanelProps) {
  const today = new Date();
  const currentMonth = today.getMonth() + 1;
  const currentDay = today.getDate();
  const monthName = format(today, 'MMMM', { locale: ptBR });

  const { data: birthdayMembers = [] } = useQuery({
    queryKey: ['birthday-members', tenantId, currentMonth],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, birth_date, photo_url, naipe')
        .eq('tenant_id', tenantId)
        .eq('approval_status', 'approved')
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
              className="relative overflow-hidden border-2 border-amber-400 dark:border-amber-600 bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-100 dark:from-amber-900/40 dark:via-yellow-900/30 dark:to-orange-900/30 shadow-xl"
            >
              <FloatingBalloons />
              
              {/* Confetti dots decoration */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="absolute w-2 h-2 rounded-full animate-pulse"
                    style={{
                      backgroundColor: ['#f472b6', '#fbbf24', '#60a5fa', '#34d399', '#a78bfa'][i % 5],
                      left: `${10 + (i * 8)}%`,
                      top: `${15 + (i % 3) * 25}%`,
                      animationDelay: `${i * 0.1}s`,
                      opacity: 0.6,
                    }}
                  />
                ))}
              </div>

              <CardContent className="p-5 relative z-10">
                <div className="flex items-center gap-4">
                  {/* Date badge - prominent display */}
                  <div className="flex flex-col items-center justify-center bg-gradient-to-b from-amber-500 to-orange-500 text-white rounded-xl p-3 min-w-[70px] shadow-lg">
                    <span className="text-xs font-medium uppercase tracking-wide opacity-90">
                      {format(new Date(member.birth_date), 'MMM', { locale: ptBR })}
                    </span>
                    <span className="text-3xl font-bold leading-none">
                      {new Date(member.birth_date).getDate()}
                    </span>
                    <span className="text-[10px] font-medium mt-1 bg-white/20 px-2 py-0.5 rounded-full">
                      HOJE!
                    </span>
                  </div>

                  {/* Avatar */}
                  <div className="relative">
                    <Avatar className="h-16 w-16 ring-4 ring-amber-300 dark:ring-amber-600 shadow-lg">
                      <AvatarImage
                        src={member.photo_url || undefined}
                        alt={member.full_name || member.email}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-amber-100 text-amber-700 text-lg font-bold dark:bg-amber-800 dark:text-amber-200">
                        {getInitials(member.full_name || member.email)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 bg-amber-500 rounded-full p-1.5 shadow-md">
                      <PartyPopper className="h-3.5 w-3.5 text-white" />
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
                        Aniversário Hoje!
                      </span>
                    </div>
                    <h4 className="font-bold text-lg text-foreground truncate">
                      {member.full_name || member.email}
                    </h4>
                    <div className="flex items-center gap-2 mt-1">
                      {member.naipe && (
                        <Badge variant="outline" className={`text-xs ${naipeColors[member.naipe]}`}>
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
                className="overflow-hidden border bg-card hover:bg-accent/50 transition-colors"
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    {/* Date badge - compact but visible */}
                    <div className="flex flex-col items-center justify-center bg-gradient-to-b from-primary/80 to-primary text-primary-foreground rounded-lg p-2 min-w-[48px] shadow-sm">
                      <span className="text-[10px] font-medium uppercase opacity-80">
                        {format(new Date(member.birth_date), 'MMM', { locale: ptBR })}
                      </span>
                      <span className="text-xl font-bold leading-none">
                        {birthDay}
                      </span>
                    </div>

                    {/* Avatar */}
                    <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
                      <AvatarImage
                        src={member.photo_url || undefined}
                        alt={member.full_name || member.email}
                        className="object-cover"
                      />
                      <AvatarFallback className="bg-primary/10 text-primary text-sm font-medium">
                        {getInitials(member.full_name || member.email)}
                      </AvatarFallback>
                    </Avatar>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm truncate">
                        {member.full_name || member.email}
                      </h4>
                      {member.naipe && (
                        <span className="text-xs text-muted-foreground">
                          {naipeLabels[member.naipe]}
                        </span>
                      )}
                    </div>

                    {/* Balloon decoration */}
                    <SmallBalloons />
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

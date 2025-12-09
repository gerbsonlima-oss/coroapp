import { useMemo } from 'react';
import { getLiturgicalDay, getNextLiturgicalDays, type LiturgicalDay } from '@/data/liturgicalCalendar';

export const useLiturgicalCalendar = (date: Date = new Date()) => {
  const today = useMemo(() => {
    const result = getLiturgicalDay(date);
    return result || null;
  }, [date]);
  
  const upcomingDays = useMemo(() => getNextLiturgicalDays(date, 7), [date]);

  return { today: today as LiturgicalDay | null, upcomingDays };
};

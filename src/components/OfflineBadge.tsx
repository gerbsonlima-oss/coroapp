import { CheckCircle2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface OfflineBadgeProps {
  className?: string;
  variant?: 'default' | 'small';
}

export const OfflineBadge = ({ className, variant = 'default' }: OfflineBadgeProps) => {
  if (variant === 'small') {
    return (
      <div className={cn("inline-flex items-center gap-1", className)}>
        <CheckCircle2 className="h-3 w-3 text-green-600" />
        <span className="text-[10px] text-green-600 font-medium">Offline</span>
      </div>
    );
  }

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "bg-green-50 text-green-700 border-green-300 hover:bg-green-100 flex items-center gap-1",
        className
      )}
    >
      <CheckCircle2 className="h-3 w-3" />
      Disponível offline
    </Badge>
  );
};
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InstallPWAButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
  showText?: boolean;
}

export const InstallPWAButton = ({ 
  variant = 'outline', 
  size = 'default',
  className,
  showText = true 
}: InstallPWAButtonProps) => {
  const { isInstallable, isInstalled, promptInstall } = usePWAInstall();

  if (isInstalled) {
    return null;
  }

  if (!isInstallable) {
    return null;
  }

  const handleInstall = async () => {
    const installed = await promptInstall();
    if (installed) {
      toast.success('App instalado com sucesso!');
    }
  };

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleInstall}
      className={cn(className)}
      title="Instalar app no celular"
    >
      <Download className="h-4 w-4" />
      {showText && size !== 'icon' && <span className="ml-2">Instalar App</span>}
    </Button>
  );
};

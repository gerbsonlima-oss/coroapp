import { useTenant } from '@/contexts/TenantContext';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, Check } from 'lucide-react';

interface TenantSwitcherProps {
  buttonClassName?: string;
  menuClassName?: string;
}

export function TenantSwitcher({ buttonClassName, menuClassName }: TenantSwitcherProps) {
  const { tenant, tenantSlug, userTenants, isMultiTenant, switchTenant, loading, availableTenants } = useTenant();
  const { isSuperAdmin } = useSuperAdmin();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading || !tenant) return null;

  const tenantsToShow = isSuperAdmin ? availableTenants : userTenants;
  const canSwitch = tenantsToShow.length > 1;

  // Single tenant: hide switcher entirely
  if (!canSwitch) return null;

  // Multiple tenants: show compact icon dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn("h-8 w-8 text-muted-foreground hover:text-foreground", buttonClassName)}
          aria-label="Trocar tenant"
          title="Trocar tenant"
        >
          <Building2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className={cn("min-w-[220px]", menuClassName)}>
        {tenantsToShow.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => {
              switchTenant(t.slug);
              const currentPath = location.pathname;
              const withoutSlug = tenantSlug && currentPath.startsWith(`/${tenantSlug}`)
                ? (currentPath.slice(tenantSlug.length + 1) || '/')
                : currentPath;
              navigate(`/${t.slug}${withoutSlug}${location.search}${location.hash}`);
            }}
            className="flex items-center justify-between"
          >
            <span className="truncate">{t.name}</span>
            {tenant.id === t.id && (
              <Check className="h-4 w-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

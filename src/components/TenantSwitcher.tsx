import { useTenant } from '@/contexts/TenantContext';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Building2, ChevronDown, Check } from 'lucide-react';

export function TenantSwitcher() {
  const { tenant, userTenants, isMultiTenant, switchTenant, loading, availableTenants } = useTenant();
  const { isSuperAdmin } = useSuperAdmin();

  // Show for any user with multiple tenants, or super admins
  const tenantsToShow = isSuperAdmin ? availableTenants : userTenants;
  
  if ((!isMultiTenant && !isSuperAdmin) || tenantsToShow.length <= 1 || loading) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center gap-2 max-w-[200px]">
          <Building2 className="h-4 w-4 shrink-0" />
          <span className="truncate hidden sm:inline">{tenant?.name || 'Selecionar'}</span>
          <ChevronDown className="h-3 w-3 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-[200px]">
        {tenantsToShow.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => switchTenant(t.slug)}
            className="flex items-center justify-between"
          >
            <span className="truncate">{t.name}</span>
            {tenant?.id === t.id && (
              <Check className="h-4 w-4 text-primary shrink-0" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

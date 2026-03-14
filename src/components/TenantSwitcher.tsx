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

  if (loading || !tenant) return null;

  const tenantsToShow = isSuperAdmin ? availableTenants : userTenants;
  const canSwitch = tenantsToShow.length > 1;

  // Single tenant: show as a static badge
  if (!canSwitch) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/50 px-4 py-2.5">
        <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium text-foreground truncate">{tenant.name}</span>
      </div>
    );
  }

  // Multiple tenants: show dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2 w-full justify-between rounded-xl h-11">
          <div className="flex items-center gap-2 min-w-0">
            <Building2 className="h-4 w-4 shrink-0" />
            <span className="truncate text-sm font-medium">{tenant.name}</span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
        {tenantsToShow.map((t) => (
          <DropdownMenuItem
            key={t.id}
            onClick={() => switchTenant(t.slug)}
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
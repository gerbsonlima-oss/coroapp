import { useState, useEffect } from 'react';
import { ArrowLeft, Download, Database, FileArchive, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useBackupExport } from '@/hooks/useBackupExport';
import { supabase } from '@/integrations/supabase/client';

interface Tenant {
  id: string;
  name: string;
  slug: string;
}

export default function AdminBackup() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: loadingSuperAdmin } = useSuperAdmin();
  const { exportBackup, isExporting, progress, error, reset } = useBackupExport();
  
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>('all');
  const [loadingTenants, setLoadingTenants] = useState(true);

  useEffect(() => {
    async function loadTenants() {
      const { data } = await supabase.from('tenants').select('id, name, slug').order('name');
      if (data) {
        setTenants(data);
      }
      setLoadingTenants(false);
    }
    loadTenants();
  }, []);

  const handleExport = async () => {
    const tenantId = selectedTenant === 'all' ? undefined : selectedTenant;
    await exportBackup(tenantId);
  };

  const getProgressPercentage = () => {
    if (!progress) return 0;
    if (progress.stage === 'fetching') return 10;
    if (progress.stage === 'downloading') {
      return 10 + (progress.current / progress.total) * 70;
    }
    if (progress.stage === 'zipping') return 90;
    if (progress.stage === 'complete') return 100;
    return 0;
  };

  if (loadingSuperAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Acesso negado. Apenas super administradores podem acessar esta página.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-2xl">
      <Button
        variant="ghost"
        onClick={() => navigate(-1)}
        className="mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Voltar
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-6 w-6" />
            Exportar Backup Completo
          </CardTitle>
          <CardDescription>
            Exporte todos os dados e arquivos do projeto para um arquivo ZIP.
            Útil para transferir dados ao fazer remix do projeto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Tenant Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Selecione o escopo do backup</label>
            <Select value={selectedTenant} onValueChange={setSelectedTenant} disabled={loadingTenants || isExporting}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tenants (backup completo)</SelectItem>
                {tenants.map((tenant) => (
                  <SelectItem key={tenant.id} value={tenant.id}>
                    {tenant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Info Box */}
          <Alert>
            <FileArchive className="h-4 w-4" />
            <AlertDescription>
              O backup inclui:
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>Todos os dados do banco (músicas, eventos, membros, etc.)</li>
                <li>Arquivos de áudio dos naipes</li>
                <li>Partituras (imagens e PDFs)</li>
                <li>Imagens de capa dos eventos</li>
                <li>Logos dos tenants</li>
                <li>Fotos dos membros do coral</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Progress */}
          {progress && (
            <div className="space-y-3">
            <div className="flex items-center gap-2">
                {progress.stage === 'complete' ? (
                  <CheckCircle className="h-5 w-5 text-primary" />
                ) : progress.stage === 'error' ? (
                  <AlertCircle className="h-5 w-5 text-destructive" />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin" />
                )}
                <span className="text-sm">{progress.message}</span>
              </div>
              <Progress value={getProgressPercentage()} />
            </div>
          )}

          {/* Error */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <Button 
              onClick={handleExport} 
              disabled={isExporting || loadingTenants}
              className="flex-1"
            >
              {isExporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Exportando...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2" />
                  Exportar Backup
                </>
              )}
            </Button>
            
            {progress?.stage === 'complete' && (
              <Button variant="outline" onClick={reset}>
                Novo Backup
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

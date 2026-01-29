import { useState, useRef } from 'react';
import { ArrowLeft, Upload, Database, Loader2, CheckCircle, AlertCircle, FileArchive } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useSuperAdmin } from '@/hooks/useSuperAdmin';
import { useBackupImport } from '@/hooks/useBackupImport';

export default function AdminRestore() {
  const navigate = useNavigate();
  const { isSuperAdmin, loading: loadingSuperAdmin } = useSuperAdmin();
  const { importBackup, isImporting, progress, error, result, reset } = useBackupImport();
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      reset();
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;
    await importBackup(selectedFile);
  };

  const getProgressPercentage = () => {
    if (!progress) return 0;
    if (progress.stage === 'reading') return 10;
    if (progress.stage === 'uploading') {
      return 10 + (progress.current / progress.total) * 70;
    }
    if (progress.stage === 'importing') return 90;
    if (progress.stage === 'complete') return 100;
    return 0;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
            Restaurar Backup
          </CardTitle>
          <CardDescription>
            Importe um arquivo de backup para restaurar dados e arquivos.
            Útil após fazer remix do projeto.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Arquivo de Backup</label>
            <div 
              className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center cursor-pointer hover:border-muted-foreground/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                onChange={handleFileChange}
                className="hidden"
                disabled={isImporting}
              />
              {selectedFile ? (
                <div className="flex items-center justify-center gap-2">
                  <FileArchive className="h-8 w-8 text-primary" />
                  <div className="text-left">
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {formatFileSize(selectedFile.size)}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                  <p className="text-muted-foreground">
                    Clique para selecionar ou arraste o arquivo ZIP
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Warning */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Atenção:</strong> A importação irá criar novos registros no banco de dados.
              Registros existentes com o mesmo slug (tenants) serão atualizados.
              <br /><br />
              Recomendamos usar esta funcionalidade em um projeto <strong>novo/vazio</strong> após fazer o remix.
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

          {/* Result */}
          {result && (
            <Alert variant={result.success ? 'default' : 'destructive'}>
              {result.success ? (
                <CheckCircle className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>
                {result.success ? (
                  <div>
                    <p className="font-medium mb-2">Importação concluída!</p>
                    <ul className="text-sm space-y-1">
                      <li>Tenants: {result.stats.tenants}</li>
                      <li>Tipos de música: {result.stats.songTypes}</li>
                      <li>Músicas: {result.stats.songs}</li>
                      <li>Áudios: {result.stats.songAudios}</li>
                      <li>Eventos: {result.stats.events}</li>
                      <li>Membros do coral: {result.stats.choirMembers}</li>
                      <li>Ensaios: {result.stats.rehearsals}</li>
                    </ul>
                    {result.stats.errors.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-destructive">
                          {result.stats.errors.length} erros
                        </summary>
                        <ul className="text-xs mt-1 space-y-1">
                          {result.stats.errors.slice(0, 10).map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                          {result.stats.errors.length > 10 && (
                            <li>... e mais {result.stats.errors.length - 10} erros</li>
                          )}
                        </ul>
                      </details>
                    )}
                  </div>
                ) : (
                  <p>Erro durante a importação. Verifique os logs para mais detalhes.</p>
                )}
              </AlertDescription>
            </Alert>
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
              onClick={handleImport} 
              disabled={isImporting || !selectedFile}
              className="flex-1"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Importando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importar Backup
                </>
              )}
            </Button>
            
            {(result || error) && (
              <Button 
                variant="outline" 
                onClick={() => {
                  reset();
                  setSelectedFile(null);
                  if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                  }
                }}
              >
                Nova Importação
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

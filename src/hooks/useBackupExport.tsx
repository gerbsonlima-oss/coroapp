import { useState, useCallback } from 'react';
import { 
  fetchBackupData, 
  createBackupZip, 
  downloadBlob, 
  generateBackupFilename,
  type ExportProgress 
} from '@/utils/backupExport';

export function useBackupExport() {
  const [isExporting, setIsExporting] = useState(false);
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exportBackup = useCallback(async (tenantId?: string) => {
    setIsExporting(true);
    setError(null);
    setProgress({
      stage: 'fetching',
      current: 0,
      total: 1,
      message: 'Buscando dados do banco...',
    });

    try {
      // Fetch data from edge function
      const { manifest, data } = await fetchBackupData(tenantId);

      // Create ZIP with files
      const zipBlob = await createBackupZip(manifest, data, setProgress);

      // Download ZIP
      const filename = generateBackupFilename(manifest.sourceTenantSlug);
      downloadBlob(zipBlob, filename);

      setProgress({
        stage: 'complete',
        current: 1,
        total: 1,
        message: 'Backup concluído com sucesso!',
      });

      return { success: true, manifest };

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao exportar backup';
      setError(errorMessage);
      setProgress({
        stage: 'error',
        current: 0,
        total: 1,
        message: errorMessage,
      });
      return { success: false, error: errorMessage };

    } finally {
      setIsExporting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setProgress(null);
    setError(null);
  }, []);

  return {
    exportBackup,
    isExporting,
    progress,
    error,
    reset,
  };
}

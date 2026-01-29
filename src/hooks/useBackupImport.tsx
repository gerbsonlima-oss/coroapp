import { useState, useCallback } from 'react';
import { 
  processBackupImport,
  type ImportProgress,
  type ImportResult,
} from '@/utils/backupImport';

export function useBackupImport() {
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  const importBackup = useCallback(async (file: File) => {
    setIsImporting(true);
    setError(null);
    setResult(null);

    try {
      const importResult = await processBackupImport(file, setProgress);
      setResult(importResult);
      return importResult;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao importar backup';
      setError(errorMessage);
      return { success: false, error: errorMessage };

    } finally {
      setIsImporting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setProgress(null);
    setError(null);
    setResult(null);
  }, []);

  return {
    importBackup,
    isImporting,
    progress,
    error,
    result,
    reset,
  };
}

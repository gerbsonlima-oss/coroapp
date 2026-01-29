import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';

export interface BackupManifest {
  version: string;
  exportedAt: string;
  sourceTenantId: string | null;
  sourceTenantSlug: string | null;
  stats: {
    tenants: number;
    songTypes: number;
    songs: number;
    songAudios: number;
    events: number;
    eventSongs: number;
    eventSongTypes: number;
    choirMembers: number;
    rehearsals: number;
    files: number;
  };
  files: string[];
}

export interface BackupData {
  tenants: any[];
  songTypes: any[];
  songs: any[];
  songAudios: any[];
  events: any[];
  eventSongs: any[];
  eventSongTypes: any[];
  choirMembers: any[];
  rehearsals: any[];
}

export interface ExportProgress {
  stage: 'fetching' | 'downloading' | 'zipping' | 'complete' | 'error';
  current: number;
  total: number;
  message: string;
}

export async function fetchBackupData(tenantId?: string): Promise<{ manifest: BackupManifest; data: BackupData }> {
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.access_token) {
    throw new Error('Não autenticado');
  }

  const response = await supabase.functions.invoke('export-full-backup', {
    body: tenantId ? { tenantId } : {},
  });

  if (response.error) {
    throw new Error(response.error.message || 'Erro ao exportar dados');
  }

  return response.data;
}

export async function downloadFile(url: string): Promise<Blob | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Failed to download: ${url}`);
      return null;
    }
    return await response.blob();
  } catch (error) {
    console.warn(`Error downloading ${url}:`, error);
    return null;
  }
}

export function getFilePathFromUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    // Extract path after /storage/v1/object/public/
    const match = urlObj.pathname.match(/\/storage\/v1\/object\/public\/(.+)/);
    if (match) {
      return match[1];
    }
    // Fallback: use the full path
    return urlObj.pathname.replace(/^\//, '');
  } catch {
    // If not a valid URL, return as is
    return url;
  }
}

export async function createBackupZip(
  manifest: BackupManifest,
  data: BackupData,
  onProgress?: (progress: ExportProgress) => void
): Promise<Blob> {
  const zip = new JSZip();

  // Add manifest
  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  // Add data files
  const dataFolder = zip.folder('data');
  if (dataFolder) {
    dataFolder.file('tenants.json', JSON.stringify(data.tenants, null, 2));
    dataFolder.file('song_types.json', JSON.stringify(data.songTypes, null, 2));
    dataFolder.file('songs.json', JSON.stringify(data.songs, null, 2));
    dataFolder.file('song_audios.json', JSON.stringify(data.songAudios, null, 2));
    dataFolder.file('events.json', JSON.stringify(data.events, null, 2));
    dataFolder.file('event_songs.json', JSON.stringify(data.eventSongs, null, 2));
    dataFolder.file('event_song_types.json', JSON.stringify(data.eventSongTypes, null, 2));
    dataFolder.file('choir_members.json', JSON.stringify(data.choirMembers, null, 2));
    dataFolder.file('rehearsals.json', JSON.stringify(data.rehearsals, null, 2));
  }

  // Download and add files
  const totalFiles = manifest.files.length;
  let downloadedCount = 0;

  for (const fileUrl of manifest.files) {
    onProgress?.({
      stage: 'downloading',
      current: downloadedCount,
      total: totalFiles,
      message: `Baixando arquivos: ${downloadedCount}/${totalFiles}`,
    });

    const blob = await downloadFile(fileUrl);
    if (blob) {
      const filePath = getFilePathFromUrl(fileUrl);
      zip.file(filePath, blob);
    }

    downloadedCount++;
  }

  onProgress?.({
    stage: 'zipping',
    current: 0,
    total: 1,
    message: 'Criando arquivo ZIP...',
  });

  const zipBlob = await zip.generateAsync({ 
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 },
  });

  onProgress?.({
    stage: 'complete',
    current: 1,
    total: 1,
    message: 'Backup concluído!',
  });

  return zipBlob;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateBackupFilename(tenantSlug?: string | null): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const slug = tenantSlug || 'full';
  return `backup-${slug}-${timestamp}.zip`;
}

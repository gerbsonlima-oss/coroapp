import JSZip from 'jszip';
import { supabase } from '@/integrations/supabase/client';
import type { BackupManifest, BackupData } from './backupExport';

export interface ImportProgress {
  stage: 'reading' | 'uploading' | 'importing' | 'complete' | 'error';
  current: number;
  total: number;
  message: string;
}

export interface ImportResult {
  success: boolean;
  stats: {
    tenants: number;
    songTypes: number;
    songs: number;
    songAudios: number;
    events: number;
    eventSongs: number;
    eventMembers: number;
    choirMembers: number;
    rehearsals: number;
    rehearsalAttendance: number;
    errors: string[];
  };
}

export async function readBackupZip(file: File): Promise<{ manifest: BackupManifest; data: BackupData; zip: JSZip }> {
  const zip = await JSZip.loadAsync(file);
  
  // Read manifest
  const manifestFile = zip.file('manifest.json');
  if (!manifestFile) {
    throw new Error('Arquivo de backup inválido: manifest.json não encontrado');
  }
  const manifestContent = await manifestFile.async('string');
  const manifest: BackupManifest = JSON.parse(manifestContent);

  // Read data files
  const dataFolder = zip.folder('data');
  if (!dataFolder) {
    throw new Error('Arquivo de backup inválido: pasta data não encontrada');
  }

  const readJsonFile = async (filename: string): Promise<any[]> => {
    const file = dataFolder.file(filename);
    if (!file) return [];
    const content = await file.async('string');
    return JSON.parse(content);
  };

  const data: BackupData = {
    tenants: await readJsonFile('tenants.json'),
    songTypes: await readJsonFile('song_types.json'),
    songs: await readJsonFile('songs.json'),
    songAudios: await readJsonFile('song_audios.json'),
    events: await readJsonFile('events.json'),
    eventSongs: await readJsonFile('event_songs.json'),
    eventMembers: await readJsonFile('event_members.json'),
    choirMembers: await readJsonFile('choir_members.json'),
    rehearsals: await readJsonFile('rehearsals.json'),
    rehearsalAttendance: await readJsonFile('rehearsal_attendance.json'),
  };

  return { manifest, data, zip };
}

export function generateIdMapping(data: BackupData): {
  tenants: Record<string, string>;
  songTypes: Record<string, string>;
  songs: Record<string, string>;
  events: Record<string, string>;
  choirMembers: Record<string, string>;
} {
  const mapping = {
    tenants: {} as Record<string, string>,
    songTypes: {} as Record<string, string>,
    songs: {} as Record<string, string>,
    events: {} as Record<string, string>,
    choirMembers: {} as Record<string, string>,
  };

  // Generate new UUIDs for each entity
  for (const tenant of data.tenants) {
    mapping.tenants[tenant.id] = crypto.randomUUID();
  }
  for (const songType of data.songTypes) {
    mapping.songTypes[songType.id] = crypto.randomUUID();
  }
  for (const song of data.songs) {
    mapping.songs[song.id] = crypto.randomUUID();
  }
  for (const event of data.events) {
    mapping.events[event.id] = crypto.randomUUID();
  }
  for (const member of data.choirMembers) {
    mapping.choirMembers[member.id] = crypto.randomUUID();
  }

  return mapping;
}

export async function uploadFilesToStorage(
  zip: JSZip,
  manifest: BackupManifest,
  onProgress?: (progress: ImportProgress) => void
): Promise<Record<string, string>> {
  const urlMapping: Record<string, string> = {};
  const totalFiles = manifest.files.length;
  let uploadedCount = 0;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    throw new Error('Não autenticado');
  }

  for (const originalUrl of manifest.files) {
    onProgress?.({
      stage: 'uploading',
      current: uploadedCount,
      total: totalFiles,
      message: `Enviando arquivos: ${uploadedCount}/${totalFiles}`,
    });

    try {
      // Extract bucket and path from URL
      const urlObj = new URL(originalUrl);
      const match = urlObj.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/);
      
      if (!match) {
        console.warn(`Could not parse URL: ${originalUrl}`);
        uploadedCount++;
        continue;
      }

      const [, bucket, path] = match;
      
      // Get file from ZIP
      const filePath = `${bucket}/${path}`;
      const zipFile = zip.file(filePath);
      
      if (!zipFile) {
        console.warn(`File not found in ZIP: ${filePath}`);
        uploadedCount++;
        continue;
      }

      const blob = await zipFile.async('blob');
      
      // Generate new unique filename
      const extension = path.split('.').pop() || '';
      const newFilename = `imported-${crypto.randomUUID()}.${extension}`;
      const newPath = path.replace(/[^/]+$/, newFilename);

      // Upload to storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(newPath, blob, {
          upsert: true,
        });

      if (uploadError) {
        console.error(`Upload error for ${filePath}:`, uploadError);
        uploadedCount++;
        continue;
      }

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(uploadData.path);

      urlMapping[originalUrl] = publicUrl;

    } catch (error) {
      console.error(`Error processing file ${originalUrl}:`, error);
    }

    uploadedCount++;
  }

  return urlMapping;
}

export async function importBackupData(
  data: BackupData,
  idMapping: ReturnType<typeof generateIdMapping>,
  urlMapping: Record<string, string>,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  onProgress?.({
    stage: 'importing',
    current: 0,
    total: 1,
    message: 'Importando dados para o banco...',
  });

  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.access_token) {
    throw new Error('Não autenticado');
  }

  const response = await supabase.functions.invoke('import-backup', {
    body: {
      ...data,
      idMapping,
      urlMapping,
    },
  });

  if (response.error) {
    throw new Error(response.error.message || 'Erro ao importar dados');
  }

  onProgress?.({
    stage: 'complete',
    current: 1,
    total: 1,
    message: 'Importação concluída!',
  });

  return response.data;
}

export async function processBackupImport(
  file: File,
  onProgress?: (progress: ImportProgress) => void
): Promise<ImportResult> {
  try {
    // Step 1: Read ZIP file
    onProgress?.({
      stage: 'reading',
      current: 0,
      total: 1,
      message: 'Lendo arquivo de backup...',
    });

    const { manifest, data, zip } = await readBackupZip(file);

    // Step 2: Generate ID mappings
    const idMapping = generateIdMapping(data);

    // Step 3: Upload files to storage
    const urlMapping = await uploadFilesToStorage(zip, manifest, onProgress);

    // Step 4: Import data to database
    const result = await importBackupData(data, idMapping, urlMapping, onProgress);

    return result;

  } catch (error) {
    onProgress?.({
      stage: 'error',
      current: 0,
      total: 1,
      message: error instanceof Error ? error.message : 'Erro desconhecido',
    });
    throw error;
  }
}

import { toast } from 'sonner';

interface TenantInfo {
  name: string;
  logo_url: string | null;
}

export async function dynamicExportPDF(event: any, songs: any, tenant?: TenantInfo | null) {
  try {
    const { exportEventPDF } = await import('./exportEventPDF');
    return await exportEventPDF(event, songs, tenant || undefined);
  } catch (error) {
    toast.error('Erro ao carregar exportador PDF');
    throw error;
  }
}

export async function dynamicExportZIP(eventName: string, playlist: any, naipe: string) {
  try {
    const { exportEventZIP } = await import('./exportEventZIP');
    return await exportEventZIP(eventName, playlist, naipe);
  } catch (error) {
    toast.error('Erro ao carregar exportador ZIP');
    throw error;
  }
}

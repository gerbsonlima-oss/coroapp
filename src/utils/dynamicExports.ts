import { toast } from 'sonner';

export async function dynamicExportPDF(params: any) {
  try {
    const { exportEventPDF } = await import('./exportEventPDF');
    return await exportEventPDF(params);
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

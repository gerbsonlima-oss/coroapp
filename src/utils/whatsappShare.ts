export interface ShareOptions {
  title: string;
  audioUrl?: string;
  sheetUrl?: string;
  message?: string;
  phone?: string;
}

export function shareToWhatsApp(options: ShareOptions): void {
  const {
    title,
    audioUrl,
    sheetUrl,
    message = '',
    phone = '',
  } = options;

  let text = `🎵 ${title}`;

  if (message) {
    text += `\n\n${message}`;
  }

  if (audioUrl) {
    text += `\n\n🔊 Áudio: ${audioUrl}`;
  }

  if (sheetUrl) {
    text += `\n\n📄 Partitura: ${sheetUrl}`;
  }

  const encodedText = encodeURIComponent(text);
  const phoneParam = phone ? `phone=${phone}&` : '';
  
  const whatsappUrl = `https://wa.me/?${phoneParam}text=${encodedText}`;
  window.open(whatsappUrl, '_blank');
}

export interface SendAudioToWhatsAppOptions {
  /**
   * When false, we will NOT fall back to wa.me link.
   * Useful when you explicitly want WhatsApp to receive an attached file.
   */
  fallbackToLink?: boolean;
}

export async function sendAudioToWhatsApp(
  audioUrl: string,
  songName: string,
  naipe?: string,
  sheetUrl?: string,
  options: SendAudioToWhatsAppOptions = {}
): Promise<void> {
  const { fallbackToLink = true } = options;

  let message = `🎵 ${songName}`;
  if (naipe) {
    message += ` (${naipe})`;
  }

  const files: File[] = [];
  let canShareWithFiles = false;

  try {
    // Try to download the audio as a Blob so we can attach it
    const audioBlob = await fetchWithTimeout(audioUrl, 15000);
    if (audioBlob) {
      const mimeType = audioBlob.type || 'audio/mpeg';
      const audioFile = new File(
        [audioBlob],
        `${songName} - ${naipe || 'original'}.mp3`,
        { type: mimeType }
      );
      files.push(audioFile);
      canShareWithFiles = true;
    }
  } catch (error) {
    console.warn('Erro ao carregar áudio:', error);
  }

  if (sheetUrl && canShareWithFiles) {
    try {
      const sheetBlob = await fetchWithTimeout(sheetUrl, 10000);
      if (sheetBlob) {
        const mimeType = sheetUrl.includes('.pdf') ? 'application/pdf' : 'image/jpeg';
        const extension = sheetUrl.includes('.pdf') ? 'pdf' : 'jpg';
        const sheetFile = new File(
          [sheetBlob],
          `${songName} - Partitura.${extension}`,
          { type: mimeType }
        );
        files.push(sheetFile);
      }
    } catch (error) {
      console.warn('Erro ao carregar partitura:', error);
    }
  }

  // Prefer file sharing (Share Sheet) whenever possible.
  // IMPORTANT: do not require navigator.canShare, because some browsers/devices
  // support navigator.share({ files }) but don't implement canShare.
  const hasShareApi = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  if (canShareWithFiles && hasShareApi) {
    try {
      if (typeof navigator.canShare === 'function' && !navigator.canShare({ files })) {
        throw new Error('Este navegador não suporta compartilhamento com arquivos');
      }

      await navigator.share({
        title: songName,
        text: message,
        files,
      });
      return;
    } catch (error) {
      console.warn('Compartilhamento com arquivo falhou:', error);
      if (!fallbackToLink) {
        throw error;
      }
    }
  } else if (!fallbackToLink) {
    throw new Error('Compartilhamento com arquivo indisponível neste dispositivo/navegador');
  }

  // Fallback (link)
  let fallbackMessage = message;
  if (audioUrl) {
    fallbackMessage += `\n\n🔊 Áudio: ${audioUrl}`;
  }
  if (sheetUrl) {
    fallbackMessage += `\n\n📄 Partitura: ${sheetUrl}`;
  }

  const encodedText = encodeURIComponent(fallbackMessage);
  const whatsappUrl = `https://wa.me/?text=${encodedText}`;
  window.open(whatsappUrl, '_blank');
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Blob | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      mode: 'cors',
      credentials: 'omit',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.blob();
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export function shareSheetToWhatsApp(
  sheetUrl: string,
  songName: string
): void {
  const message = `🎵 ${songName}\n\n📄 Partitura: ${sheetUrl}`;
  const encodedText = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/?text=${encodedText}`;
  window.open(whatsappUrl, '_blank');
}

export function shareCompleteToWhatsApp(
  songName: string,
  audioUrl?: string,
  sheetUrl?: string,
  naipe?: string
): void {
  let message = `🎵 ${songName}`;
  
  if (naipe) {
    message += ` (${naipe})`;
  }

  if (audioUrl) {
    message += `\n\n🔊 Áudio: ${audioUrl}`;
  }

  if (sheetUrl) {
    message += `\n\n📄 Partitura: ${sheetUrl}`;
  }

  const encodedText = encodeURIComponent(message);
  const whatsappUrl = `https://wa.me/?text=${encodedText}`;
  window.open(whatsappUrl, '_blank');
}

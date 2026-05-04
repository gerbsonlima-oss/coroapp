import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import QRCode from 'qrcode';
import liturgiaLogo from '@/assets/liturgia-plus-logo.png';
import { generateSongTypeLabelsWithNumerals } from './songTypeLabeling';

interface Event {
  id: string;
  name: string;
  date: string;
  location: string | null;
  cover_image_url: string | null;
  pdf_theme?: string | null;
  pdf_cover_url?: string | null;
  pdf_back_cover_url?: string | null;
}

interface Song {
  id: string;
  name: string;
  type: string;
  lyrics?: string | null;
}

interface TenantInfo {
  name: string;
  logo_url: string | null;
}

import { typeLabels as defaultTypeLabels } from '@/constants/songTypes';

const liturgicalOrder: Record<string, number> = {
  canto_entrada: 1,
  ato_penitencial: 2,
  gloria: 3,
  salmo: 4,
  aclamacao: 5,
  oferendas: 6,
  santo: 7,
  cordeiro: 8,
  comunhao: 9,
  acao_gracas: 10,
  final: 11,
  outro: 12,
};

// Detecta o formato correto para o jsPDF a partir de um dataURL
type JsPdfImageFormat = 'PNG' | 'JPEG';

const getJsPdfImageFormatFromDataUrl = (dataUrl: string): JsPdfImageFormat => {
  const match = /^data:image\/(png|jpe?g)/i.exec(dataUrl);
  if (!match) return 'JPEG';
  return match[1].toLowerCase() === 'png' ? 'PNG' : 'JPEG';
};

// Preferimos fetch->blob->dataURL para evitar canvas "tainted" em imagens externas
const fetchImageAsDataUrl = async (url: string, timeoutMs = 15000): Promise<string | null> => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(url, {
      signal: controller.signal,
      mode: 'cors',
      cache: 'no-store',
    });

    clearTimeout(timeout);

    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.type?.startsWith('image/')) return null;

    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn('Falha ao buscar imagem via fetch:', e);
    return null;
  }
};

const shouldUseBackendImageProxy = (url: string): boolean => {
  try {
    const u = new URL(url);
    return (
      u.protocol === 'https:' &&
      u.hostname.endsWith('supabase.co') &&
      u.pathname.startsWith('/storage/v1/object/public/')
    );
  } catch {
    return false;
  }
};

const fetchImageViaBackendProxy = async (url: string): Promise<string | null> => {
  try {
    const { data, error } = await supabase.functions.invoke('image-proxy', {
      body: { url },
    });

    if (error) throw error;
    return (data as any)?.dataUrl ?? null;
  } catch (e) {
    console.warn('Falha ao buscar imagem via backend:', e);
    return null;
  }
};

// Carrega imagem com múltiplos fallbacks
const loadImageRobust = async (url: string): Promise<string | null> => {
  if (!url) return null;

  // 1) Para URLs do Supabase Storage, usar proxy primeiro (evita CORS)
  if (shouldUseBackendImageProxy(url)) {
    const proxied = await fetchImageViaBackendProxy(url);
    if (proxied) return proxied;
  }

  // 2) Tentar fetch direto -> blob -> dataURL
  const fetched = await fetchImageAsDataUrl(url);
  if (fetched) return fetched;

  // 3) Fallback: <img> + canvas (requer CORS liberado no servidor)
  const canvasDataUrl = await new Promise<string | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    const timeout = setTimeout(() => {
      console.warn('Timeout ao carregar imagem:', url.substring(0, 60));
      resolve(null);
    }, 15000);

    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        console.warn('Erro ao converter imagem para dataURL:', e);
        resolve(null);
      }
    };

    img.onerror = (e) => {
      clearTimeout(timeout);
      console.warn('Erro ao carregar imagem:', url.substring(0, 60), e);
      resolve(null);
    };

    img.src = url;
  });

  if (canvasDataUrl) return canvasDataUrl;

  return null;
};

// Calcula dimensões da imagem a partir do base64
const getImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 100, height: 100 });
    img.src = dataUrl;
  });
};

// Cria versão circular da imagem para uso no PDF
const createCircularImage = async (dataUrl: string, size: number): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const outputSize = size * 4; // Higher resolution for better quality
        canvas.width = outputSize;
        canvas.height = outputSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        // Draw circular clip
        ctx.beginPath();
        ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // Draw image centered and covering the circle
        const imgSize = Math.min(img.width, img.height);
        const sx = (img.width - imgSize) / 2;
        const sy = (img.height - imgSize) / 2;
        ctx.drawImage(img, sx, sy, imgSize, imgSize, 0, 0, outputSize, outputSize);

        resolve(canvas.toDataURL('image/png'));
      } catch (e) {
        console.warn('Erro ao criar imagem circular:', e);
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
};


const loadTypeLabels = async (): Promise<Record<string, string>> => {
  try {
    const { data, error } = await supabase
      .from('song_types')
      .select('slug, name')
      .order('order_index');

    if (error) throw error;

    const labels: Record<string, string> = { ...defaultTypeLabels };
    (data || []).forEach((type) => {
      if (type.slug && type.name) {
        labels[type.slug] = type.name;
      }
    });

    return labels;
  } catch (error) {
    console.error('Erro ao carregar tipos de música para PDF:', error);
    return defaultTypeLabels;
  }
};

export const exportSongBookletPDF = async (
  event: Event, 
  songs: Song[], 
  tenant?: TenantInfo, 
  options?: { 
    fontSize?: number; 
    fontFamily?: 'times' | 'helvetica' | 'courier' | 'libre-baskerville';
    margin?: number;
    gutter?: number;
    theme?: string;
    coverDataUrl?: string | null;
    backCoverDataUrl?: string | null;
  }
) => {
  const baseFontSize = options?.fontSize || 11;
  const fontFamilyOption = options?.fontFamily || 'times';
  const userMargin = options?.margin || 18;
  const userGutter = options?.gutter || 12;
  const userTheme = options?.theme; // Theme override from dialog
  const customCoverDataUrl = options?.coverDataUrl || null;
  const customBackCoverDataUrl = options?.backCoverDataUrl || null;
  const useCustomCover = !!customCoverDataUrl;
  const typeLabels = await loadTypeLabels();
  
  const songsWithLyrics = songs
    .filter(song => song.lyrics && song.lyrics.trim())
    .sort((a, b) => {
      const orderA = liturgicalOrder[a.type] || 999;
      const orderB = liturgicalOrder[b.type] || 999;
      return orderA - orderB;
    });

  if (songsWithLyrics.length === 0) {
    throw new Error('Nenhuma música com letra cadastrada');
  }

  const pdf = new jsPDF('p', 'mm', 'a4');
  
  // Carrega fonte Libre Baskerville se selecionada
  let fontFamily: string = fontFamilyOption;
  if (fontFamilyOption === 'libre-baskerville') {
    try {
      // Fetch the fonts from Google Fonts CDN
      const fontUrlRegular = 'https://fonts.gstatic.com/s/librebaskerville/v16/kmKnZrc3Hgbbcjq75U4uslyuy4kn0pNeYRI4CN2V.ttf';
      const fontUrlItalic = 'https://fonts.gstatic.com/s/librebaskerville/v16/kmKhZrc3Hgbbcjq75U4uslyuy4kn0qNcaxYaDc2V2ro.ttf';
      const fontUrlBold = 'https://fonts.gstatic.com/s/librebaskerville/v16/kmKiZrc3Hgbbcjq75U4uslyuy4kn0qviTjYwI8Gcw6Oi.ttf';
      
      const [fontResponseRegular, fontResponseItalic, fontResponseBold] = await Promise.all([
        fetch(fontUrlRegular),
        fetch(fontUrlItalic),
        fetch(fontUrlBold)
      ]);
      
      const [fontBufferRegular, fontBufferItalic, fontBufferBold] = await Promise.all([
        fontResponseRegular.arrayBuffer(),
        fontResponseItalic.arrayBuffer(),
        fontResponseBold.arrayBuffer()
      ]);
      
      // Convert to base64
      const toBase64 = (buffer: ArrayBuffer) => btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      
      const fontBase64Regular = toBase64(fontBufferRegular);
      const fontBase64Italic = toBase64(fontBufferItalic);
      const fontBase64Bold = toBase64(fontBufferBold);
      
      pdf.addFileToVFS('LibreBaskerville-Regular.ttf', fontBase64Regular);
      pdf.addFileToVFS('LibreBaskerville-Italic.ttf', fontBase64Italic);
      pdf.addFileToVFS('LibreBaskerville-Bold.ttf', fontBase64Bold);
      
      pdf.addFont('LibreBaskerville-Regular.ttf', 'LibreBaskerville', 'normal');
      pdf.addFont('LibreBaskerville-Italic.ttf', 'LibreBaskerville', 'italic');
      pdf.addFont('LibreBaskerville-Bold.ttf', 'LibreBaskerville', 'bold');
      // Para bolditalic, usar a fonte bold
      pdf.addFont('LibreBaskerville-Bold.ttf', 'LibreBaskerville', 'bolditalic');
      
      fontFamily = 'LibreBaskerville';
      console.log('Fonte Libre Baskerville carregada com sucesso!');
    } catch (e) {
      console.warn('Erro ao carregar fonte Libre Baskerville, usando Times:', e);
      fontFamily = 'times';
    }
  }
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  // Sistema de temas - cores RGB
  const pdfThemes: Record<string, {
    primary: [number, number, number];
    accent: [number, number, number];
    dark: [number, number, number];
    light: [number, number, number];
  }> = {
    deep_blue_gold: {
      primary: [25, 55, 109],
      accent: [180, 140, 40],
      dark: [40, 40, 50],
      light: [245, 247, 250],
    },
    emerald_night: {
      primary: [6, 78, 59],
      accent: [134, 200, 150],
      dark: [20, 30, 25],
      light: [248, 250, 248],
    },
    violet_sunset: {
      primary: [88, 28, 135],
      accent: [200, 150, 180],
      dark: [35, 20, 45],
      light: [250, 248, 252],
    },
    graphite_copper: {
      primary: [50, 50, 60],
      accent: [180, 110, 60],
      dark: [30, 30, 35],
      light: [250, 250, 250],
    },
    crimson_noir: {
      primary: [127, 29, 29],
      accent: [180, 100, 100],
      dark: [40, 20, 25],
      light: [250, 248, 248],
    },
    sunrise_coral: {
      primary: [180, 80, 50],
      accent: [220, 140, 100],
      dark: [40, 25, 20],
      light: [252, 250, 248],
    },
    ocean_teal: {
      primary: [13, 120, 110],
      accent: [100, 180, 170],
      dark: [20, 35, 35],
      light: [248, 251, 250],
    },
    forest_sage: {
      primary: [40, 90, 60],
      accent: [120, 160, 110],
      dark: [25, 35, 30],
      light: [248, 250, 248],
    },
    midnight_purple: {
      primary: [70, 40, 120],
      accent: [150, 120, 180],
      dark: [35, 25, 45],
      light: [250, 248, 252],
    },
    wine_burgundy: {
      primary: [110, 30, 50],
      accent: [170, 100, 120],
      dark: [40, 20, 30],
      light: [252, 248, 250],
    },
  };

  // Use theme from options if provided, otherwise fall back to event theme
  const themeKey = userTheme || event.pdf_theme || 'deep_blue_gold';
  const theme = pdfThemes[themeKey] || pdfThemes.deep_blue_gold;

  const white: [number, number, number] = [255, 255, 255];
  const textDark: [number, number, number] = [30, 30, 38];
  const textMedium: [number, number, number] = [60, 60, 70];
  const textLight: [number, number, number] = [90, 90, 100];
  
  // Layout - medidas em mm (otimizado para impressão A4)
  // A4 = 210mm x 297mm
  const margin = userMargin; // Margem lateral configurável pelo usuário
  const gutter = userGutter; // Espaço entre colunas configurável pelo usuário
  const colWidth = (pageWidth - 2 * margin - gutter) / 2;
  const headerHeight = 52; // Otimizado para melhor equilíbrio visual
  const footerHeight = 8;
  const contentStart = headerHeight + 5; // Margem extra para não sobrepor
  const contentEnd = pageHeight - footerHeight - 8; // Limite inferior seguro
  
  // Limites rígidos para cada coluna (área delimitada)
  const col1LeftBound = margin;
  const col1RightBound = margin + colWidth;
  const col2LeftBound = margin + colWidth + gutter;
  const col2RightBound = pageWidth - margin;

  // Estado de paginação
  let currentPage = 1;
  let currentY = contentStart; // Posição Y atual na coluna ativa
  let currentCol = 1; // 1 = esquerda, 2 = direita

  // Pré-carregar imagens
  let logoDataUrl: string | null = null;
  let logoWidth = 0;
  let logoHeight = 0;
  
  let eventImageDataUrl: string | null = null;
  let eventImageWidth = 0;
  let eventImageHeight = 0;

  // Carregar logo do tenant e criar versão circular
  if (tenant?.logo_url) {
    console.log('Carregando logo do tenant:', tenant.logo_url.substring(0, 60));
    const rawLogoDataUrl = await loadImageRobust(tenant.logo_url);
    if (rawLogoDataUrl) {
      console.log('Logo carregado, criando versão circular...');
      logoHeight = 24; // altura/largura do logo circular
      logoWidth = logoHeight;
      // Criar versão circular do logo
      logoDataUrl = await createCircularImage(rawLogoDataUrl, logoHeight * 4);
      if (logoDataUrl) {
        console.log('Logo circular criado com sucesso!');
      } else {
        // Fallback para logo original se falhar
        logoDataUrl = rawLogoDataUrl;
        console.warn('Fallback para logo original (não circular)');
      }
    } else {
      console.warn('Não foi possível carregar o logo do tenant');
    }
  }

  // Carregar imagem do evento
  if (event.cover_image_url) {
    console.log('Carregando imagem do evento:', event.cover_image_url.substring(0, 60));
    eventImageDataUrl = await loadImageRobust(event.cover_image_url);
    if (eventImageDataUrl) {
      console.log('Imagem do evento carregada com sucesso!');
      const dims = await getImageDimensions(eventImageDataUrl);
      eventImageWidth = colWidth - 6;
      eventImageHeight = (dims.height / dims.width) * eventImageWidth;
      if (eventImageHeight > 70) {
        eventImageHeight = 70;
        eventImageWidth = (dims.width / dims.height) * eventImageHeight;
      }
    } else {
      console.warn('Não foi possível carregar a imagem do evento');
    }
  }

  const col1X = margin;
  const col2X = margin + colWidth + gutter;

  // Altura do conteúdo para páginas seguintes (sem header)
  const contentStartFirstPage = headerHeight + 5;
  const contentStartOtherPages = margin + 5; // Páginas seguintes começam mais acima

  // Função para obter onde o conteúdo começa na página atual
  const getContentStart = () => currentPage === 1 ? contentStartFirstPage : contentStartOtherPages;

  // ============================================
  // HEADER - Design limpo com fundo claro (APENAS PRIMEIRA PÁGINA)
  // ============================================
  const drawHeader = () => {
    // Header só aparece na primeira página
    // Criar cor esmaecida (muito clara) baseada no tema primário
    const lightBg: [number, number, number] = [
      Math.min(255, theme.primary[0] + Math.round((255 - theme.primary[0]) * 0.85)),
      Math.min(255, theme.primary[1] + Math.round((255 - theme.primary[1]) * 0.85)),
      Math.min(255, theme.primary[2] + Math.round((255 - theme.primary[2]) * 0.85)),
    ];
    
    // Background claro esmaecido
    pdf.setFillColor(...lightBg);
    pdf.rect(0, 0, pageWidth, headerHeight, 'F');

    // Linha inferior na cor primária para destaque sutil
    pdf.setFillColor(...theme.primary);
    pdf.rect(0, headerHeight - 1, pageWidth, 1, 'F');

    let textStartX = margin;
    const logoSize = 38; // Logo maior ocupando altura das 3 linhas

    // Calcular posições verticais com pouco espaçamento
    const topPadding = 8;
    const lineSpacing = 3; // Espaçamento pequeno entre linhas
    
    const line1Y = topPadding + 9; // Nome do tenant
    const line2Y = line1Y + 10 + lineSpacing; // Subsídio Litúrgico
    const line3Y = line2Y + 10 + lineSpacing; // Nome do evento

    // Logo do tenant - centralizada verticalmente com o texto
    if (logoDataUrl && logoWidth > 0) {
      try {
        // Calcular centro vertical baseado nas 3 linhas de texto
        const textBlockTop = topPadding;
        const textBlockBottom = line3Y + 2;
        const textBlockCenter = (textBlockTop + textBlockBottom) / 2;
        const logoY = textBlockCenter - (logoSize / 2);
        const logoX = margin;

        const logoFormat = getJsPdfImageFormatFromDataUrl(logoDataUrl);
        pdf.addImage(logoDataUrl, logoFormat, logoX, logoY, logoSize, logoSize);
        
        textStartX = margin + logoSize + 8;
      } catch (e) {
        console.warn('Erro ao inserir logo:', e);
        textStartX = margin;
      }
    }

    const maxTextWidth = pageWidth - textStartX - margin - 5;
    const centerX = textStartX + (maxTextWidth / 2);

    // Linha 1: Nome do Tenant - fonte customizada, tamanho 26
    const tenantName = tenant?.name || 'Coro Paroquial';
    pdf.setFont(fontFamily, 'bold');
    pdf.setFontSize(26);
    pdf.setTextColor(...theme.primary);
    pdf.text(tenantName.toUpperCase(), centerX, line1Y, { align: 'center' });

    // Linha 2: "Subsídio Litúrgico" - fonte customizada, tamanho 26
    pdf.setFont(fontFamily, 'italic');
    pdf.setFontSize(26);
    // Usar uma cor intermediária entre primary e accent para o subtítulo
    const subtitleColor: [number, number, number] = [
      Math.round((theme.primary[0] + theme.accent[0]) / 2),
      Math.round((theme.primary[1] + theme.accent[1]) / 2),
      Math.round((theme.primary[2] + theme.accent[2]) / 2),
    ];
    pdf.setTextColor(...subtitleColor);
    pdf.text('Subsídio Litúrgico', centerX, line2Y, { align: 'center' });

    // Linha 3: Nome do evento - fonte customizada, tamanho 22
    pdf.setFont(fontFamily, 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(...theme.primary);
    const eventLines = pdf.splitTextToSize(event.name, maxTextWidth);
    pdf.text(eventLines[0], centerX, line3Y, { align: 'center' });
    if (eventLines[1]) {
      pdf.setFontSize(18);
      pdf.text(eventLines[1], centerX, line3Y + 6, { align: 'center' });
    }
  };

  // ============================================
  // FOOTER - Limpo e profissional
  // ============================================
  const drawFooter = (pageNum: number, totalPages: number) => {
    const footY = pageHeight - 6;

    // Linha superior
    pdf.setDrawColor(...theme.light);
    pdf.setLineWidth(0.3);
    pdf.line(margin, footY - 3, pageWidth - margin, footY - 3);

    pdf.setFont(fontFamily, 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...textLight);

    if (tenant?.name) {
      pdf.text(tenant.name, margin, footY);
    }

    // Número da página com destaque
    pdf.setFont(fontFamily, 'bold');
    pdf.setTextColor(...theme.primary);
    const pageStr = `${pageNum} / ${totalPages}`;
    pdf.text(pageStr, pageWidth - margin, footY, { align: 'right' });
  };

  // Helper para adicionar imagem cobrindo a página inteira
  const addFullPageImage = (dataUrl: string) => {
    try {
      const fmt = getJsPdfImageFormatFromDataUrl(dataUrl);
      pdf.addImage(dataUrl, fmt, 0, 0, pageWidth, pageHeight);
    } catch (e) {
      console.warn('Erro ao inserir imagem de página inteira:', e);
    }
  };

  if (useCustomCover) {
    // Capa customizada: usa a primeira página inteira para a imagem da capa
    addFullPageImage(customCoverDataUrl!);
    // Próxima página inicia o conteúdo, sem header gerado
    pdf.addPage();
    currentPage++;
    currentCol = 1;
    currentY = getContentStart();
  } else {
    // Desenhar header da primeira página (capa gerada)
    drawHeader();
    currentY = getContentStart();

    // ============================================
    // IMAGEM DO EVENTO na primeira coluna
    // ============================================
    if (eventImageDataUrl && eventImageWidth > 0) {
      try {
        const imgX = col1X + (colWidth - eventImageWidth) / 2;
        const imgW = eventImageWidth;
        const imgH = eventImageHeight;
        const fadeSize = 4;

        const eventImgFormat = getJsPdfImageFormatFromDataUrl(eventImageDataUrl);
        pdf.addImage(eventImageDataUrl, eventImgFormat, imgX, currentY, imgW, imgH);

        const bgColor: [number, number, number] = [255, 255, 255];
        const steps = 8;

        for (let i = 0; i < steps; i++) {
          const alpha = 1 - (i / steps);
          pdf.setFillColor(255, 255, 255);
          pdf.setGState(new (pdf as any).GState({ opacity: alpha * 0.7 }));
          pdf.rect(imgX, currentY + (i * fadeSize / steps), imgW, fadeSize / steps, 'F');
        }
        for (let i = 0; i < steps; i++) {
          const alpha = i / steps;
          pdf.setGState(new (pdf as any).GState({ opacity: alpha * 0.7 }));
          pdf.rect(imgX, currentY + imgH - fadeSize + (i * fadeSize / steps), imgW, fadeSize / steps, 'F');
        }
        for (let i = 0; i < steps; i++) {
          const alpha = 1 - (i / steps);
          pdf.setGState(new (pdf as any).GState({ opacity: alpha * 0.7 }));
          pdf.rect(imgX + (i * fadeSize / steps), currentY, fadeSize / steps, imgH, 'F');
        }
        for (let i = 0; i < steps; i++) {
          const alpha = i / steps;
          pdf.setGState(new (pdf as any).GState({ opacity: alpha * 0.7 }));
          pdf.rect(imgX + imgW - fadeSize + (i * fadeSize / steps), currentY, fadeSize / steps, imgH, 'F');
        }

        pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

        currentY += imgH + 8;
      } catch (e) {
        console.warn('Erro ao inserir imagem do evento:', e);
      }
    }
  }

  // QR code será adicionado no final do documento

  // Função helper para obter os limites da coluna atual
  const getColumnBounds = () => {
    if (currentCol === 1) {
      return { left: col1LeftBound, right: col1RightBound };
    }
    return { left: col2LeftBound, right: col2RightBound };
  };
  
  // Margem interna de segurança dentro de cada coluna
  const internalPadding = 4;

  // ============================================
  // HELPER: Mudar para próxima coluna ou página
  // ============================================
  const advanceToNextColumn = (): void => {
    if (currentCol === 1) {
      // Ir para coluna direita
      currentCol = 2;
      currentY = getContentStart();
    } else {
      // Ir para nova página, coluna esquerda
      pdf.addPage();
      currentPage++;
      // Sem header nas páginas seguintes
      currentCol = 1;
      currentY = getContentStart();
    }
  };

  // ============================================
  // SEÇÃO DE MÚSICA - Design com background esmaecido
  // ============================================
  const drawSongSection = (num: number, label: string): void => {
    const bounds = getColumnBounds();
    const sectionWidth = bounds.right - bounds.left;

    // Verificar se precisa mudar de coluna/página
    if (currentY + 25 > contentEnd) {
      advanceToNextColumn();
    }

    const barHeight = 6;
    const badgeWidth = 7;

    // Background esmaecido (10% da cor primária)
    const lightBg: [number, number, number] = [
      Math.round(255 - (255 - theme.primary[0]) * 0.12),
      Math.round(255 - (255 - theme.primary[1]) * 0.12),
      Math.round(255 - (255 - theme.primary[2]) * 0.12),
    ];
    const currentBounds = getColumnBounds();
    pdf.setFillColor(...lightBg);
    pdf.rect(currentBounds.left + internalPadding, currentY, sectionWidth - internalPadding, barHeight, 'F');

    // Badge numérico (retângulo colorido sólido) - alinhado com internalPadding
    pdf.setFillColor(...theme.primary);
    pdf.rect(currentBounds.left + internalPadding, currentY, badgeWidth, barHeight, 'F');
    
    // Número centralizado no badge (branco, negrito)
    pdf.setTextColor(255, 255, 255);
    pdf.setFont(fontFamily, 'bold');
    pdf.setFontSize(10);
    const numText = String(num);
    const numW = pdf.getTextWidth(numText);
    pdf.text(numText, currentBounds.left + internalPadding + (badgeWidth - numW) / 2, currentY + 4.3);

    // Texto do tipo (negrito, cor primária, tamanho 12) - alinhado com internalPadding
    const labelText = label.toUpperCase();
    pdf.setTextColor(...theme.primary);
    pdf.setFont(fontFamily, 'bold');
    pdf.setFontSize(12);
    pdf.text(labelText, currentBounds.left + internalPadding + badgeWidth + 3, currentY + 4.3);

    // Mais espaço após a seção do tipo para separar do nome
    currentY += barHeight + 4;
  };

  // ============================================
  // ADICIONAR TEXTO COM FLUXO DE COLUNAS
  // ============================================
  // Tipo para estilos de fonte suportados pelo jsPDF
  type FontStyle = 'normal' | 'bold' | 'italic' | 'bolditalic';

  const addText = (
    text: string, 
    size: number, 
    style: FontStyle, 
    color: [number, number, number], 
    indent: number = 0,
    spaceBefore: number = 0
  ): void => {
    const lineHeight = size * 0.40; // Line height para evitar sobreposição vertical
    const bounds = getColumnBounds();
    const maxWidth = (bounds.right - bounds.left) - (2 * internalPadding) - indent;
    
    pdf.setFont(fontFamily, style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);

    const lines = pdf.splitTextToSize(text, maxWidth) as string[];

    // Verificar espaço ANTES de começar - se não cabe, muda de coluna
    if (currentY + spaceBefore + lineHeight > contentEnd) {
      advanceToNextColumn();
    }
    
    currentY += spaceBefore;

    for (const line of lines) {
      // Verificar se a linha cabe verticalmente, senão avança
      if (currentY + lineHeight > contentEnd) {
        advanceToNextColumn();
      }

      const bounds = getColumnBounds();
      const x = bounds.left + internalPadding + indent;
      pdf.text(line, x, currentY, { align: 'justify', maxWidth: maxWidth });
      currentY += lineHeight;
    }
  };

  // Line height otimizado para evitar sobreposição vertical
  const getLineHeight = (size: number) => size * 0.40;

  // Cor vermelha para marcadores
  const redColor: [number, number, number] = [180, 30, 30];

  // Parse formatting markers from text
  // Supports: <b>bold</b>, <i>italic</i>, <color:#hex>text</color>
  type FormattedSegment = {
    text: string;
    bold: boolean;
    italic: boolean;
    color: [number, number, number] | null;
  };

  // Convert hex color to RGB
  const hexToRgb = (hex: string): [number, number, number] => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (result) {
      return [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
      ];
    }
    return [0, 0, 0]; // Default to black
  };

  const parseFormattedText = (text: string): FormattedSegment[] => {
    const segments: FormattedSegment[] = [];
    
    // Process text character by character, tracking open tags
    let i = 0;
    let currentText = '';
    let isBold = false;
    let isItalic = false;
    let currentColor: [number, number, number] | null = null;
    
    while (i < text.length) {
      // Check for opening tags
      if (text.slice(i, i + 3) === '<b>') {
        // Save current segment if any
        if (currentText) {
          segments.push({ text: currentText, bold: isBold, italic: isItalic, color: currentColor });
          currentText = '';
        }
        isBold = true;
        i += 3;
        continue;
      }
      
      if (text.slice(i, i + 4) === '</b>') {
        if (currentText) {
          segments.push({ text: currentText, bold: isBold, italic: isItalic, color: currentColor });
          currentText = '';
        }
        isBold = false;
        i += 4;
        continue;
      }
      
      if (text.slice(i, i + 3) === '<i>') {
        if (currentText) {
          segments.push({ text: currentText, bold: isBold, italic: isItalic, color: currentColor });
          currentText = '';
        }
        isItalic = true;
        i += 3;
        continue;
      }
      
      if (text.slice(i, i + 4) === '</i>') {
        if (currentText) {
          segments.push({ text: currentText, bold: isBold, italic: isItalic, color: currentColor });
          currentText = '';
        }
        isItalic = false;
        i += 4;
        continue;
      }
      
      // Check for color tag: <color:#xxxxxx>
      const colorMatch = text.slice(i).match(/^<color:(#[a-fA-F0-9]{6})>/);
      if (colorMatch) {
        if (currentText) {
          segments.push({ text: currentText, bold: isBold, italic: isItalic, color: currentColor });
          currentText = '';
        }
        currentColor = hexToRgb(colorMatch[1]);
        i += colorMatch[0].length;
        continue;
      }
      
      if (text.slice(i, i + 8) === '</color>') {
        if (currentText) {
          segments.push({ text: currentText, bold: isBold, italic: isItalic, color: currentColor });
          currentText = '';
        }
        currentColor = null;
        i += 8;
        continue;
      }
      
      // Regular character
      currentText += text[i];
      i++;
    }
    
    // Add remaining text
    if (currentText) {
      segments.push({ text: currentText, bold: isBold, italic: isItalic, color: currentColor });
    }
    
    // If no segments, return original text
    if (segments.length === 0) {
      segments.push({ text, bold: false, italic: false, color: null });
    }
    
    return segments;
  };

  // Função para renderizar texto inline com formatação (bold, italic, color) e "/" em vermelho
  // IMPORTANTE: Esta função agora quebra linhas automaticamente ao atingir o limite da coluna
  const renderFormattedTextInline = (
    text: string,
    startX: number,
    y: number,
    size: number,
    baseStyle: FontStyle,
    baseColor: [number, number, number],
    indentForWrap: number = 0 // Indentação para linhas que quebram
  ): void => {
    const lineHeight = size * 0.40;
    const bounds = getColumnBounds();
    const maxX = bounds.right - internalPadding; // Limite rígido da coluna
    
    // Primeira, usar splitTextToSize para obter texto que cabe na largura disponível
    const availableWidth = maxX - startX;
    
    pdf.setFont(fontFamily, baseStyle);
    pdf.setFontSize(size);
    
    // Limpar tags de formatação para calcular quebra de linha
    const cleanText = text
      .replace(/<b>/g, '').replace(/<\/b>/g, '')
      .replace(/<i>/g, '').replace(/<\/i>/g, '')
      .replace(/<color:[^>]+>/g, '').replace(/<\/color>/g, '');
    
    const lines = pdf.splitTextToSize(cleanText, availableWidth) as string[];
    
    // Se o texto couber em uma linha, renderiza com formatação
    if (lines.length === 1) {
      renderFormattedSegment(text, startX, y, size, baseStyle, baseColor);
    } else {
      // Para múltiplas linhas, precisamos renderizar linha por linha
      // Recalcular com a largura total da coluna para linhas subsequentes
      const fullWidth = (bounds.right - bounds.left) - (2 * internalPadding) - indentForWrap;
      const allLines = pdf.splitTextToSize(cleanText, fullWidth) as string[];
      
      let currentLineY = y;
      for (let i = 0; i < allLines.length; i++) {
        if (currentLineY + lineHeight > contentEnd) {
          advanceToNextColumn();
          currentLineY = currentY;
        }
        
        const lineX = i === 0 ? startX : getColumnBounds().left + internalPadding + indentForWrap;
        
        // Renderizar a linha com formatação simples (sem tags no texto quebrado)
        renderTextWithRedSlashes(allLines[i], lineX, currentLineY, size, baseStyle, baseColor);
        
        if (i < allLines.length - 1) {
          currentLineY += lineHeight;
        }
      }
      // Atualizar currentY para a última linha renderizada
      currentY = currentLineY;
    }
  };
  
  // Renderiza um segmento de texto com formatação (usado para textos que cabem em uma linha)
  const renderFormattedSegment = (
    text: string,
    startX: number,
    y: number,
    size: number,
    baseStyle: FontStyle,
    baseColor: [number, number, number]
  ): void => {
    const hasFormatting = text.includes('<b>') || text.includes('<i>') || text.includes('<color:');
    
    if (!hasFormatting) {
      renderTextWithRedSlashes(text, startX, y, size, baseStyle, baseColor);
      return;
    }
    
    const segments = parseFormattedText(text);
    let currentX = startX;
    
    for (const segment of segments) {
      // Preservar bolditalic do baseStyle, ou aplicar formatação do segmento
      let segmentStyle: FontStyle = baseStyle;
      if (segment.bold && segment.italic) {
        segmentStyle = 'bolditalic';
      } else if (segment.bold) {
        segmentStyle = baseStyle === 'bolditalic' ? 'bolditalic' : 'bold';
      } else if (segment.italic) {
        segmentStyle = baseStyle === 'bolditalic' ? 'bolditalic' : 'italic';
      }
      const segmentColor = segment.color || baseColor;
      currentX = renderTextWithRedSlashes(segment.text, currentX, y, size, segmentStyle, segmentColor);
    }
  };
  
  // Renderiza texto com "/" em vermelho e retorna a posição X final
  const renderTextWithRedSlashes = (
    text: string,
    startX: number,
    y: number,
    size: number,
    style: FontStyle,
    color: [number, number, number]
  ): number => {
    let currentX = startX;
    
    if (text.includes('/')) {
      const parts = text.split('/');
      for (let i = 0; i < parts.length; i++) {
        if (parts[i]) {
          pdf.setFont(fontFamily, style);
          pdf.setFontSize(size);
          pdf.setTextColor(...color);
          pdf.text(parts[i], currentX, y);
          currentX += pdf.getTextWidth(parts[i]);
        }
        if (i < parts.length - 1) {
          pdf.setFont(fontFamily, style);
          pdf.setFontSize(size);
          pdf.setTextColor(180, 30, 30); // Vermelho
          pdf.text('/', currentX, y);
          currentX += pdf.getTextWidth('/');
        }
      }
    } else {
      pdf.setFont(fontFamily, style);
      pdf.setFontSize(size);
      pdf.setTextColor(...color);
      pdf.text(text, currentX, y);
      currentX += pdf.getTextWidth(text);
    }
    
    return currentX;
  };

  // Função para desenhar texto com formatação rica (bold, italic, color) e "/" em vermelho
  const addFormattedText = (
    text: string, 
    size: number, 
    baseStyle: FontStyle, 
    baseColor: [number, number, number], 
    indent: number = 0,
    spaceBefore: number = 0
  ): void => {
    const lineHeight = size * 0.40;
    const bounds = getColumnBounds();
    const maxWidth = (bounds.right - bounds.left) - (2 * internalPadding) - indent;
    const maxX = bounds.right - internalPadding; // Limite rígido da coluna
    
    // For lines with formatting markers, we need special handling
    const hasFormatting = text.includes('<b>') || text.includes('<i>') || text.includes('<color:');
    
    if (!hasFormatting) {
      // No custom formatting, use existing logic with slash coloring
      addTextWithRedSlashesSimple(text, size, baseStyle, baseColor, indent, spaceBefore);
      return;
    }
    
    // Parse formatted segments
    const segments = parseFormattedText(text);
    
    // Verificar espaço ANTES de começar
    if (currentY + spaceBefore + lineHeight > contentEnd) {
      advanceToNextColumn();
    }
    
    currentY += spaceBefore;
    
    // Render each segment with its formatting
    let currentBounds = getColumnBounds();
    let startX = currentBounds.left + internalPadding + indent;
    let currentX = startX;
    
    for (const segment of segments) {
      // Preservar bolditalic do baseStyle, ou aplicar formatação do segmento
      let segmentStyle: FontStyle = baseStyle;
      if (segment.bold && segment.italic) {
        segmentStyle = 'bolditalic';
      } else if (segment.bold) {
        segmentStyle = baseStyle === 'bolditalic' ? 'bolditalic' : 'bold';
      } else if (segment.italic) {
        segmentStyle = baseStyle === 'bolditalic' ? 'bolditalic' : 'italic';
      }
      const segmentColor = segment.color || baseColor;
      
      // Split segment text to handle line wrapping
      const words = segment.text.split(' ');
      
      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const wordWithSpace = i < words.length - 1 ? word + ' ' : word;
        
        pdf.setFont(fontFamily, segmentStyle);
        pdf.setFontSize(size);
        const wordWidth = pdf.getTextWidth(wordWithSpace);
        
        // Recalcular limites da coluna atual
        currentBounds = getColumnBounds();
        const currentMaxX = currentBounds.right - internalPadding;
        
        // Check if word fits on current line (limite rígido)
        if (currentX + wordWidth > currentMaxX) {
          currentY += lineHeight;
          
          // Verificar se precisa mudar de coluna
          if (currentY + lineHeight > contentEnd) {
            advanceToNextColumn();
          }
          
          // Recalcular posição X para nova linha/coluna
          currentBounds = getColumnBounds();
          startX = currentBounds.left + internalPadding + indent;
          currentX = startX;
        }
        
        // Handle slashes in red
        currentX = renderTextWithRedSlashes(wordWithSpace, currentX, currentY, size, segmentStyle, segmentColor);
      }
    }
    
    currentY += lineHeight;
  };

  // Simple version without formatting parsing (for performance)
  const addTextWithRedSlashesSimple = (
    text: string, 
    size: number, 
    style: FontStyle, 
    color: [number, number, number], 
    indent: number = 0,
    spaceBefore: number = 0
  ): void => {
    const lineHeight = size * 0.40;
    const bounds = getColumnBounds();
    const maxWidth = (bounds.right - bounds.left) - (2 * internalPadding) - indent;
    
    pdf.setFont(fontFamily, style);
    pdf.setFontSize(size);
    
    const lines = pdf.splitTextToSize(text, maxWidth) as string[];

    if (currentY + spaceBefore + lineHeight > contentEnd) {
      advanceToNextColumn();
    }
    
    currentY += spaceBefore;

    for (const line of lines) {
      if (currentY + lineHeight > contentEnd) {
        advanceToNextColumn();
      }

      const currentBounds = getColumnBounds();
      const x = currentBounds.left + internalPadding + indent;
      const currentMaxWidth = (currentBounds.right - currentBounds.left) - (2 * internalPadding) - indent;
      
      if (line.includes('/')) {
        const parts = line.split('/');
        let currentX = x;
        
        pdf.setFont(fontFamily, style);
        pdf.setFontSize(size);
        
        for (let i = 0; i < parts.length; i++) {
          if (parts[i]) {
            pdf.setFont(fontFamily, style);
            pdf.setFontSize(size);
            pdf.setTextColor(color[0], color[1], color[2]);
            pdf.text(parts[i], currentX, currentY);
            currentX += pdf.getTextWidth(parts[i]);
          }
          
          if (i < parts.length - 1) {
            pdf.setFont(fontFamily, style);
            pdf.setFontSize(size);
            pdf.setTextColor(180, 30, 30);
            pdf.text('/', currentX, currentY);
            currentX += pdf.getTextWidth('/');
          }
        }
        pdf.setTextColor(color[0], color[1], color[2]);
      } else {
        pdf.setFont(fontFamily, style);
        pdf.setFontSize(size);
        pdf.setTextColor(color[0], color[1], color[2]);
        // Texto justificado por padrão
        pdf.text(line, x, currentY, { align: 'justify', maxWidth: currentMaxWidth });
      }
      
      currentY += lineHeight;
    }
  };

  // Função para desenhar texto com "/" em vermelho (wrapper para compatibilidade)
  const addTextWithRedSlashes = (
    text: string, 
    size: number, 
    style: FontStyle, 
    color: [number, number, number], 
    indent: number = 0,
    spaceBefore: number = 0
  ): void => {
    addFormattedText(text, size, style, color, indent, spaceBefore);
  };

  // ============================================
  // PROCESSAR MÚSICAS
  // ============================================
  // Gerar labels com numerais romanos para tipos repetidos (ex: Comunhão I, Comunhão II)
  const songTypeLabelMap = generateSongTypeLabelsWithNumerals(songsWithLyrics, typeLabels);
  
  let songIndex = 0;
  for (const song of songsWithLyrics) {
    songIndex++;

    // Espaço entre seções (maior para separação visual)
    if (songIndex > 1) {
      currentY += 4;
    }

    // Usar label com numeral romano se houver múltiplas músicas do mesmo tipo
    const typeLabel = songTypeLabelMap[song.id] || typeLabels[song.type] || song.type || 'Música';
    drawSongSection(songIndex, typeLabel);

    // Nome da música removido - apenas o tipo é exibido
    // Espaço pequeno após a seção do tipo
    currentY += 1;
    
    // Line height for lyrics based on font size
    const lyricLineHeight = getLineHeight(baseFontSize);

    // Processar letra com suporte a tags [REFRÃO]...[/REFRÃO] e numeração de estrofes
    if (song.lyrics) {
      // Normalize only Windows line endings, keep structure intact
      const normalizedLyrics = song.lyrics.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      
      // ============================================
      // AGRUPAR LINHAS EM VERSOS (separados por linha em branco)
      // ============================================
      const allLines = normalizedLyrics.split('\n');
      const verses: { lines: string[]; isRefraoBlock: boolean }[] = [];
      let currentVerse: string[] = [];
      let inRefraoBlockMode = false;
      
      for (const line of allLines) {
        const trimmed = line.trim();
        
        // Detectar abertura de bloco de refrão [REFRÃO] sozinho na linha
        if (/^\[REFR[ÃA]O\]$/i.test(trimmed)) {
          // Salvar verso atual antes do refrão
          if (currentVerse.length > 0) {
            verses.push({ lines: currentVerse, isRefraoBlock: false });
            currentVerse = [];
          }
          inRefraoBlockMode = true;
          continue;
        }
        
        // Detectar [REFRÃO] no início da linha COM texto após (ex: "[REFRÃO] Tenho que gritar...")
        const refraoInlineMatch = /^\[REFR[ÃA]O\]\s*(.+)$/i.exec(trimmed);
        if (refraoInlineMatch) {
          // Salvar verso atual antes do refrão
          if (currentVerse.length > 0) {
            verses.push({ lines: currentVerse, isRefraoBlock: false });
            currentVerse = [];
          }
          // Iniciar novo bloco de refrão com o texto após a tag
          inRefraoBlockMode = true;
          currentVerse.push(refraoInlineMatch[1].trim());
          continue;
        }
        
        // Detectar fechamento de bloco de refrão [/REFRÃO]
        if (/^\[\/REFR[ÃA]O\]$/i.test(trimmed)) {
          if (currentVerse.length > 0) {
            verses.push({ lines: currentVerse, isRefraoBlock: true });
            currentVerse = [];
          }
          inRefraoBlockMode = false;
          continue;
        }
        
        // Linha em branco = fim do verso atual (e fecha refrão se estiver aberto)
        if (!trimmed) {
          if (currentVerse.length > 0) {
            verses.push({ lines: currentVerse, isRefraoBlock: inRefraoBlockMode });
            currentVerse = [];
          }
          // Linha em branco fecha o modo de refrão
          inRefraoBlockMode = false;
          continue;
        }
        
        currentVerse.push(trimmed);
      }
      
      // Adicionar último verso se existir
      if (currentVerse.length > 0) {
        verses.push({ lines: currentVerse, isRefraoBlock: inRefraoBlockMode });
      }
      
      // ============================================
      // PROCESSAR CADA VERSO
      // ============================================
      let isFirstRefraoVerse = true;
      
      for (let verseIdx = 0; verseIdx < verses.length; verseIdx++) {
        const verse = verses[verseIdx];
        const firstLine = verse.lines[0];
        
        // Espaço entre versos (exceto primeiro)
        if (verseIdx > 0) {
          currentY += 2;
        }
        
        // Verificar se é verso numerado (ex: "1. Texto...")
        const numberedVerseMatch = /^(\d+)\.\s*(.*)/.exec(firstLine);
        
        // Verificar se é linha com marcador de refrão legado (R:, REFRÃO:, etc)
        const isRefrainLineMarker = /^(R:|REFRÃO:|REFRAO:|REF:)/i.test(firstLine);
        
        // Verificar se tem marcador especial (PR:, TODOS:, etc)
        const hasSpecialMarker = /^(PR:|AS:|TODOS:|T:|C:|A:|L:)/i.test(firstLine);
        
        if (verse.isRefraoBlock) {
          // ============================================
          // BLOCO [REFRÃO]...[/REFRÃO]
          // ============================================
          const indent = 2;
          const markerWidth = 7; // Largura do "R: "
          const totalIndent = indent + markerWidth;
          
          for (let lineIdx = 0; lineIdx < verse.lines.length; lineIdx++) {
            const lineText = verse.lines[lineIdx];
            
            if (currentY + lyricLineHeight > contentEnd) {
              advanceToNextColumn();
            }
            
            const currentBounds = getColumnBounds();
            const x = currentBounds.left + internalPadding + indent;
            
            // "R:" apenas na primeira linha do primeiro verso de refrão
            if (isFirstRefraoVerse && lineIdx === 0) {
              pdf.setFont(fontFamily, 'bold');
              pdf.setFontSize(baseFontSize);
              pdf.setTextColor(...redColor);
              pdf.text('R:', x, currentY);
            }
            
            // Texto com formatação - passa indentação para quebras de linha (negrito)
            renderFormattedTextInline(lineText, x + markerWidth, currentY, baseFontSize, 'bold', textDark, totalIndent);
            
            currentY += lyricLineHeight;
          }
          
          isFirstRefraoVerse = false;
          
        } else if (isRefrainLineMarker) {
          // ============================================
          // MARCADOR LEGADO R:, REFRÃO:, etc
          // ============================================
          const indent = 2;
          const markerWidth = 7;
          const totalIndent = indent + markerWidth;
          
          for (let lineIdx = 0; lineIdx < verse.lines.length; lineIdx++) {
            let lineText = verse.lines[lineIdx];
            
            // Remover marcador apenas da primeira linha
            if (lineIdx === 0) {
              lineText = lineText.replace(/^(R:|REFRÃO:|REFRAO:|REF:)\s*/i, '');
            }
            
            if (currentY + lyricLineHeight > contentEnd) {
              advanceToNextColumn();
            }
            
            const currentBounds = getColumnBounds();
            const x = currentBounds.left + internalPadding + indent;
            
            // "R:" apenas na primeira linha
            if (lineIdx === 0) {
              pdf.setFont(fontFamily, 'bold');
              pdf.setFontSize(baseFontSize);
              pdf.setTextColor(...redColor);
              pdf.text('R:', x, currentY);
            }
            
            // Texto com formatação - passa indentação para quebras de linha (negrito)
            renderFormattedTextInline(lineText, x + markerWidth, currentY, baseFontSize, 'bold', textDark, totalIndent);
            
            currentY += lyricLineHeight;
          }
          
        } else if (numberedVerseMatch) {
          // ============================================
          // VERSO NUMERADO (1., 2., etc) - TODAS AS LINHAS COM MESMO RECUO
          // ============================================
          const verseNumber = numberedVerseMatch[1];
          const numMarkerWidth = 8; // Largura fixa para "N. "
          
          for (let lineIdx = 0; lineIdx < verse.lines.length; lineIdx++) {
            let lineText = verse.lines[lineIdx];
            
            // Remover número apenas da primeira linha
            if (lineIdx === 0) {
              lineText = numberedVerseMatch[2] || '';
            }
            
            if (currentY + lyricLineHeight > contentEnd) {
              advanceToNextColumn();
            }
            
            const currentBounds = getColumnBounds();
            const x = currentBounds.left + internalPadding;
            
            // Número em vermelho apenas na primeira linha
            if (lineIdx === 0) {
              pdf.setFont(fontFamily, 'bold');
              pdf.setFontSize(baseFontSize);
              pdf.setTextColor(...redColor);
              pdf.text(`${verseNumber}.`, x, currentY);
            }
            
            // Texto com formatação - passa indentação para quebras de linha
            renderFormattedTextInline(lineText, x + numMarkerWidth, currentY, baseFontSize, 'normal', textDark, numMarkerWidth);
            
            currentY += lyricLineHeight;
          }
          
        } else if (hasSpecialMarker) {
          // ============================================
          // MARCADORES ESPECIAIS (PR:, TODOS:, etc)
          // ============================================
          for (const lineText of verse.lines) {
            addTextWithRedSlashes(lineText, baseFontSize, 'bold', textMedium, 0, 0);
          }
          
        } else {
          // ============================================
          // VERSO NORMAL (sem numeração)
          // ============================================
          for (const lineText of verse.lines) {
            addTextWithRedSlashes(lineText, baseFontSize, 'normal', textDark, 0, 0);
          }
        }
      }
    }
    currentY += 1.5;
  }

  // ============================================
  // QR CODE - No final da última página
  // ============================================
  try {
    const qrSize = 28;
    const qrSpaceNeeded = qrSize + 12; // QR + texto abaixo
    
    // Verificar se cabe na página atual, senão criar nova página
    if (currentY + qrSpaceNeeded > contentEnd - 5) {
      advanceToNextColumn();
    }
    
    const audioPageUrl = `${window.location.origin}/e/${event.id}`;
    // Converter RGB para HEX para o QRCode
    const toHex = (r: number, g: number, b: number) => 
      '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
    const qrDarkColor = toHex(theme.primary[0], theme.primary[1], theme.primary[2]);
    
    const qrDataUrl = await QRCode.toDataURL(audioPageUrl, { 
      margin: 1, 
      scale: 6,
      color: {
        dark: qrDarkColor,
        light: '#ffffff'
      }
    });
    
    // Centralizar o QR code na coluna atual
    const qrColX = currentCol === 1 ? col1X : col2X;
    const qrX = qrColX + (colWidth - qrSize) / 2;
    
    // Desenhar QR code
    pdf.addImage(qrDataUrl, 'PNG', qrX, currentY, qrSize, qrSize);
    
    // Texto abaixo do QR
    pdf.setFont(fontFamily, 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(...textLight);
    const qrLabel = 'Escaneie para ouvir os áudios';
    const labelWidth = pdf.getTextWidth(qrLabel);
    pdf.text(qrLabel, qrColX + (colWidth - labelWidth) / 2, currentY + qrSize + 4);
  } catch (e) {
    console.warn('Erro ao gerar QR code:', e);
  }

  // ============================================
  // CONTRACAPA (se enviada)
  // ============================================
  if (customBackCoverDataUrl) {
    pdf.addPage();
    addFullPageImage(customBackCoverDataUrl);
  }

  // ============================================
  // ADICIONAR FOOTERS EM TODAS AS PÁGINAS (exceto capa/contracapa customizadas)
  // ============================================
  const totalPages = pdf.getNumberOfPages();
  const skipFirst = useCustomCover;
  const skipLast = !!customBackCoverDataUrl;
  for (let i = 1; i <= totalPages; i++) {
    if (skipFirst && i === 1) continue;
    if (skipLast && i === totalPages) continue;
    pdf.setPage(i);
    drawFooter(i, totalPages);
  }

  // ============================================
  // SALVAR PDF
  // ============================================
  const fileName = `Folheto_Cantos_${event.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
  pdf.save(fileName);
};

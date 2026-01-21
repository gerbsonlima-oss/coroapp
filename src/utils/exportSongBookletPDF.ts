import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import QRCode from 'qrcode';
import liturgiaLogo from '@/assets/liturgia-plus-logo.png';

interface Event {
  id: string;
  name: string;
  date: string;
  location: string | null;
  cover_image_url: string | null;
  pdf_theme?: string | null;
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

const defaultTypeLabels: Record<string, string> = {
  canto_entrada: 'Canto de Entrada',
  ato_penitencial: 'Ato Penitencial',
  gloria: 'Glória',
  salmo: 'Salmo Responsorial',
  aclamacao: 'Aclamação ao Evangelho',
  oferendas: 'Canto das Oferendas',
  santo: 'Santo',
  cordeiro: 'Cordeiro de Deus',
  comunhao: 'Canto da Comunhão',
  acao_gracas: 'Ação de Graças',
  final: 'Canto Final',
  outro: 'Outro',
};

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
  options?: { fontSize?: number; fontFamily?: 'times' | 'helvetica' | 'courier' }
) => {
  const baseFontSize = options?.fontSize || 11;
  const fontFamily = options?.fontFamily || 'times';
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

  const themeKey = event.pdf_theme || 'deep_blue_gold';
  const theme = pdfThemes[themeKey] || pdfThemes.deep_blue_gold;

  const white: [number, number, number] = [255, 255, 255];
  const textDark: [number, number, number] = [30, 30, 38];
  const textMedium: [number, number, number] = [60, 60, 70];
  const textLight: [number, number, number] = [90, 90, 100];
  
  // Layout - medidas em mm (otimizado para impressão)
  const margin = 10;
  const gutter = 6;
  const colWidth = (pageWidth - 2 * margin - gutter) / 2;
  const headerHeight = 52; // Otimizado para melhor equilíbrio visual
  const footerHeight = 8;
  const contentStart = headerHeight + 5; // Margem extra para não sobrepor
  const contentEnd = pageHeight - footerHeight - 3;

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

    // Linha 1: Nome do Tenant - fonte Times, tamanho 26
    const tenantName = tenant?.name || 'Coro Paroquial';
    pdf.setFont('times', 'bold');
    pdf.setFontSize(26);
    pdf.setTextColor(...theme.primary);
    pdf.text(tenantName.toUpperCase(), centerX, line1Y, { align: 'center' });

    // Linha 2: "Subsídio Litúrgico" - fonte Times, tamanho 26
    pdf.setFont('times', 'italic');
    pdf.setFontSize(26);
    // Usar uma cor intermediária entre primary e accent para o subtítulo
    const subtitleColor: [number, number, number] = [
      Math.round((theme.primary[0] + theme.accent[0]) / 2),
      Math.round((theme.primary[1] + theme.accent[1]) / 2),
      Math.round((theme.primary[2] + theme.accent[2]) / 2),
    ];
    pdf.setTextColor(...subtitleColor);
    pdf.text('Subsídio Litúrgico', centerX, line2Y, { align: 'center' });

    // Linha 3: Nome do evento - fonte Times, tamanho 22
    pdf.setFont('times', 'bold');
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

    pdf.setFont('times', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...textLight);

    if (tenant?.name) {
      pdf.text(tenant.name, margin, footY);
    }

    // Número da página com destaque
    pdf.setFont('times', 'bold');
    pdf.setTextColor(...theme.primary);
    const pageStr = `${pageNum} / ${totalPages}`;
    pdf.text(pageStr, pageWidth - margin, footY, { align: 'right' });
  };

  // Desenhar header da primeira página
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
      const fadeSize = 4; // Tamanho do gradiente de esmaecimento

      // Desenhar a imagem primeiro
      const eventImgFormat = getJsPdfImageFormatFromDataUrl(eventImageDataUrl);
      pdf.addImage(eventImageDataUrl, eventImgFormat, imgX, currentY, imgW, imgH);

      // Criar efeito de bordas esmaecidas com gradiente para branco
      const bgColor: [number, number, number] = [255, 255, 255];
      const steps = 8;

      // Gradiente superior
      for (let i = 0; i < steps; i++) {
        const alpha = 1 - (i / steps);
        const r = Math.round(bgColor[0] * alpha + 255 * (1 - alpha));
        const g = Math.round(bgColor[1] * alpha + 255 * (1 - alpha));
        const b = Math.round(bgColor[2] * alpha + 255 * (1 - alpha));
        pdf.setFillColor(255, 255, 255);
        pdf.setGState(new (pdf as any).GState({ opacity: alpha * 0.7 }));
        pdf.rect(imgX, currentY + (i * fadeSize / steps), imgW, fadeSize / steps, 'F');
      }

      // Gradiente inferior
      for (let i = 0; i < steps; i++) {
        const alpha = i / steps;
        pdf.setGState(new (pdf as any).GState({ opacity: alpha * 0.7 }));
        pdf.rect(imgX, currentY + imgH - fadeSize + (i * fadeSize / steps), imgW, fadeSize / steps, 'F');
      }

      // Gradiente esquerdo
      for (let i = 0; i < steps; i++) {
        const alpha = 1 - (i / steps);
        pdf.setGState(new (pdf as any).GState({ opacity: alpha * 0.7 }));
        pdf.rect(imgX + (i * fadeSize / steps), currentY, fadeSize / steps, imgH, 'F');
      }

      // Gradiente direito
      for (let i = 0; i < steps; i++) {
        const alpha = i / steps;
        pdf.setGState(new (pdf as any).GState({ opacity: alpha * 0.7 }));
        pdf.rect(imgX + imgW - fadeSize + (i * fadeSize / steps), currentY, fadeSize / steps, imgH, 'F');
      }

      // Resetar opacidade
      pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

      currentY += imgH + 8;
    } catch (e) {
      console.warn('Erro ao inserir imagem do evento:', e);
    }
  }

  // ============================================
  // QR CODE para página de áudios
  // ============================================
  try {
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
    
    const qrSize = 28;
    const qrX = col1X + (colWidth - qrSize) / 2;
    
    // Desenhar QR code
    pdf.addImage(qrDataUrl, 'PNG', qrX, currentY, qrSize, qrSize);
    
    // Texto abaixo do QR
    pdf.setFont('times', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(...textLight);
    const qrLabel = 'Escaneie para ouvir os áudios';
    const labelWidth = pdf.getTextWidth(qrLabel);
    pdf.text(qrLabel, col1X + (colWidth - labelWidth) / 2, currentY + qrSize + 4);
    
    currentY += qrSize + 10;
  } catch (e) {
    console.warn('Erro ao gerar QR code:', e);
  }

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
    const x = currentCol === 1 ? col1X : col2X;

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
    pdf.setFillColor(...lightBg);
    pdf.rect(currentCol === 1 ? col1X : col2X, currentY, colWidth, barHeight, 'F');

    // Badge numérico (retângulo colorido sólido)
    pdf.setFillColor(...theme.primary);
    pdf.rect(currentCol === 1 ? col1X : col2X, currentY, badgeWidth, barHeight, 'F');
    
    // Número centralizado no badge (branco, negrito)
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(10);
    const numText = String(num);
    const numW = pdf.getTextWidth(numText);
    pdf.text(numText, (currentCol === 1 ? col1X : col2X) + (badgeWidth - numW) / 2, currentY + 4.3);

    // Texto do tipo (negrito, cor primária, tamanho 12)
    const labelText = label.toUpperCase();
    pdf.setTextColor(...theme.primary);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(12);
    pdf.text(labelText, (currentCol === 1 ? col1X : col2X) + badgeWidth + 3, currentY + 4.3);

    // Mais espaço após a seção do tipo para separar do nome
    currentY += barHeight + 4;
  };

  // ============================================
  // ADICIONAR TEXTO COM FLUXO DE COLUNAS
  // ============================================
  const addText = (
    text: string, 
    size: number, 
    style: 'normal' | 'bold' | 'italic', 
    color: [number, number, number], 
    indent: number = 0,
    spaceBefore: number = 0
  ): void => {
    currentY += spaceBefore;
    // Minimal line height for space optimization
    const lineHeight = size * 0.35;
    const maxWidth = colWidth - 4;
    
    pdf.setFont(fontFamily, style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);

    const lines = pdf.splitTextToSize(text, maxWidth) as string[];

    for (const line of lines) {
      if (currentY + lineHeight > contentEnd) {
        advanceToNextColumn();
      }

      // No indent - optimized for space
      const x = (currentCol === 1 ? col1X : col2X) + 1.5;
      pdf.text(line, x, currentY, { align: 'justify', maxWidth: maxWidth });
      currentY += lineHeight;
    }
  };

  // Minimal line height for space optimization
  const getLineHeight = (size: number) => size * 0.35;

  // Cor vermelha para marcadores
  const redColor: [number, number, number] = [180, 30, 30];

  // Função para desenhar texto com "/" em vermelho
  const addTextWithRedSlashes = (
    text: string, 
    size: number, 
    style: 'normal' | 'bold' | 'italic', 
    color: [number, number, number], 
    indent: number = 0,
    spaceBefore: number = 0
  ): void => {
    currentY += spaceBefore;
    // Minimal line height for space optimization
    const lineHeight = size * 0.35;
    const maxWidth = colWidth - 4;
    
    const lines = pdf.splitTextToSize(text, maxWidth) as string[];

    for (const line of lines) {
      if (currentY + lineHeight > contentEnd) {
        advanceToNextColumn();
      }

      // No indent - optimized for space
      const x = (currentCol === 1 ? col1X : col2X) + 1.5;
      
      // Check if line contains "/" - render with red slashes
      if (line.includes('/')) {
        // Split by "/" and draw each part
        const parts = line.split('/');
        let currentX = x;
        
        for (let i = 0; i < parts.length; i++) {
          // Draw text part
          if (parts[i]) {
            pdf.setFont(fontFamily, style);
            pdf.setFontSize(size);
            pdf.setTextColor(...color);
            pdf.text(parts[i], currentX, currentY);
            currentX += pdf.getTextWidth(parts[i]);
          }
          
          // Draw "/" in red (except after last part)
          if (i < parts.length - 1) {
            pdf.setTextColor(...redColor);
            pdf.text('/', currentX, currentY);
            currentX += pdf.getTextWidth('/');
          }
        }
      } else {
        // All text justified for lines without slashes
        pdf.setFont(fontFamily, style);
        pdf.setFontSize(size);
        pdf.setTextColor(...color);
        pdf.text(line, x, currentY, { align: 'justify', maxWidth: maxWidth });
      }
      
      currentY += lineHeight;
    }
  };

  // ============================================
  // PROCESSAR MÚSICAS
  // ============================================
  let songIndex = 0;
  for (const song of songsWithLyrics) {
    songIndex++;

    // Espaço entre seções (maior para separação visual)
    if (songIndex > 1) {
      currentY += 4;
    }

    const typeLabel = typeLabels[song.type] || song.type || 'Música';
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
      
      const allLines = normalizedLyrics.split('\n');
      let insideRefraoBlock = false;
      let isFirstLineOfRefrao = false;
      let prevEmpty = false;
      
      // Process each line individually to preserve structure
      for (const line of allLines) {
        const trimmed = line.trim();
        
        // Detectar abertura de bloco de refrão [REFRÃO]
        if (/^\[REFR[ÃA]O\]$/i.test(trimmed)) {
          insideRefraoBlock = true;
          isFirstLineOfRefrao = true;
          continue;
        }
        
        // Detectar fechamento de bloco de refrão [/REFRÃO]
        if (/^\[\/REFR[ÃA]O\]$/i.test(trimmed)) {
          insideRefraoBlock = false;
          isFirstLineOfRefrao = false;
          currentY += 2;
          continue;
        }
        
        if (!trimmed) {
          if (!prevEmpty) {
            currentY += 2;
          }
          prevEmpty = true;
          continue;
        }
        prevEmpty = false;

        const hasMarker = /^(PR:|AS:|TODOS:|T:|C:|A:|L:)/i.test(trimmed);
        const isRefrainLineMarker = /^(R:|REFRÃO:|REFRAO:|REF:)/i.test(trimmed);
        const isNumberedVerse = /^(\d+)\.\s*(.*)/.exec(trimmed);

        // Linha com marcador de refrão legado (R:, REFRÃO:, etc)
        if (isRefrainLineMarker) {
          const textAfterMarker = trimmed.replace(/^(R:|REFRÃO:|REFRAO:|REF:)\s*/i, '');
          const indent = 2;
          const markerWidth = 7; // Largura fixa para "R: "
          const maxTextWidth = colWidth - 4 - indent - markerWidth;
          const lines = pdf.splitTextToSize(textAfterMarker, maxTextWidth) as string[];
          
          for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            if (currentY + 4 > contentEnd) {
              advanceToNextColumn();
            }
            
            const x = (currentCol === 1 ? col1X : col2X) + 1.5 + indent;
            
            // "R:" apenas na primeira linha
            if (lineIdx === 0) {
              pdf.setFont(fontFamily, 'bold');
              pdf.setFontSize(baseFontSize);
              pdf.setTextColor(...redColor);
              pdf.text('R:', x, currentY);
            }
            
            // Texto em preto negrito justificado
            pdf.setFont(fontFamily, 'bold');
            pdf.setFontSize(baseFontSize);
            pdf.setTextColor(...textDark);
            const textMaxWidth = colWidth - 4 - indent - markerWidth;
            pdf.text(lines[lineIdx], x + markerWidth, currentY, { align: 'justify', maxWidth: textMaxWidth });
            
            currentY += lyricLineHeight;
          }
          continue;
        }

        // Estrofe numerada: número em vermelho, resto normal
        if (isNumberedVerse) {
          const verseNumber = isNumberedVerse[1];
          const verseText = isNumberedVerse[2];
          const numMarkerWidth = 8; // Largura fixa para "N. "
          const maxTextWidth = colWidth - 4 - numMarkerWidth;
          const lines = verseText ? pdf.splitTextToSize(verseText, maxTextWidth) as string[] : [];
          
          // Primeira linha com número
          if (currentY + 4 > contentEnd) {
            advanceToNextColumn();
          }
          
          const x = (currentCol === 1 ? col1X : col2X) + 1.5;
          
          // Número em vermelho
          pdf.setFont(fontFamily, 'bold');
          pdf.setFontSize(baseFontSize);
          pdf.setTextColor(...redColor);
          pdf.text(`${verseNumber}.`, x, currentY);
          
          // Texto da primeira linha justificado
          if (lines.length > 0) {
            pdf.setFont(fontFamily, 'normal');
            pdf.setFontSize(baseFontSize);
            pdf.setTextColor(...textDark);
            pdf.text(lines[0], x + numMarkerWidth, currentY, { align: 'justify', maxWidth: maxTextWidth });
          }
          currentY += lyricLineHeight;
          
          // Linhas adicionais (continuação)
          for (let lineIdx = 1; lineIdx < lines.length; lineIdx++) {
            if (currentY + lyricLineHeight > contentEnd) {
              advanceToNextColumn();
            }
            const contX = (currentCol === 1 ? col1X : col2X) + 1.5 + numMarkerWidth;
            pdf.setFont(fontFamily, 'normal');
            pdf.setFontSize(baseFontSize);
            pdf.setTextColor(...textDark);
            pdf.text(lines[lineIdx], contX, currentY, { align: 'justify', maxWidth: maxTextWidth });
            currentY += lyricLineHeight;
          }
          continue;
        }

        let style: 'normal' | 'bold' | 'italic' = 'normal';
        let color = textDark;
        let indent = 0;

        if (hasMarker) {
          style = 'bold';
          color = textMedium;
          addTextWithRedSlashes(trimmed, baseFontSize, style, color, indent, 0);
        } else if (insideRefraoBlock) {
          // Dentro do bloco [REFRÃO]...[/REFRÃO]: "R:" apenas na primeira linha, texto preto negrito
          indent = 2;
          const markerWidth = isFirstLineOfRefrao ? 7 : 0;
          const textIndent = 7; // Sempre indentar o texto para alinhar
          const maxTextWidth = colWidth - 4 - indent - textIndent;
          const lines = pdf.splitTextToSize(trimmed, maxTextWidth) as string[];
          
          for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            if (currentY + lyricLineHeight > contentEnd) {
              advanceToNextColumn();
            }
            
            const x = (currentCol === 1 ? col1X : col2X) + 1.5 + indent;
            
            // "R:" apenas na primeira linha do bloco
            if (isFirstLineOfRefrao && lineIdx === 0) {
              pdf.setFont(fontFamily, 'bold');
              pdf.setFontSize(baseFontSize);
              pdf.setTextColor(...redColor);
              pdf.text('R:', x, currentY);
            }
            
            // Texto em preto negrito justificado
            pdf.setFont(fontFamily, 'bold');
            pdf.setFontSize(baseFontSize);
            pdf.setTextColor(...textDark);
            pdf.text(lines[lineIdx], x + textIndent, currentY, { align: 'justify', maxWidth: maxTextWidth });
            
            currentY += lyricLineHeight;
          }
          
          isFirstLineOfRefrao = false; // Após a primeira linha, não mais
          continue;
        } else {
          addTextWithRedSlashes(trimmed, baseFontSize, style, color, indent, 0);
        }
      }
    }
    currentY += 1.5;
  }

  // ============================================
  // ADICIONAR FOOTERS EM TODAS AS PÁGINAS
  // ============================================
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    drawFooter(i, totalPages);
  }

  // ============================================
  // SALVAR PDF
  // ============================================
  const fileName = `Folheto_Cantos_${event.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
  pdf.save(fileName);
};

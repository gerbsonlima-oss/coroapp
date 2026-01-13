import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import coroLogo from '@/assets/coro-logo.png';

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

  // 1) Melhor caminho: fetch -> blob -> dataURL (evita problemas de CORS/canvas)
  const fetched = await fetchImageAsDataUrl(url);
  if (fetched) return fetched;

  // 2) Fallback: <img> + canvas (requer CORS liberado no servidor)
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

  // 3) Último fallback: buscar via backend (resolve CORS do Storage)
  if (shouldUseBackendImageProxy(url)) {
    const proxied = await fetchImageViaBackendProxy(url);
    if (proxied) return proxied;
  }

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

export const exportSongBookletPDF = async (event: Event, songs: Song[], tenant?: TenantInfo) => {
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
  const headerHeight = 32;
  const footerHeight = 8;
  const contentStart = headerHeight + 3;
  const contentEnd = pageHeight - footerHeight - 3;

  // Estado de paginação
  let currentPage = 1;
  let col1Y = contentStart;
  let col2Y = contentStart;
  let currentCol = 1;

  // Pré-carregar imagens
  let logoDataUrl: string | null = null;
  let logoWidth = 0;
  let logoHeight = 0;
  
  let eventImageDataUrl: string | null = null;
  let eventImageWidth = 0;
  let eventImageHeight = 0;

  // Carregar logo do tenant
  if (tenant?.logo_url) {
    console.log('Carregando logo do tenant:', tenant.logo_url.substring(0, 60));
    logoDataUrl = await loadImageRobust(tenant.logo_url);
    if (logoDataUrl) {
      console.log('Logo carregado com sucesso!');
      const dims = await getImageDimensions(logoDataUrl);
      logoHeight = 24; // altura maior para mais impacto
      logoWidth = logoHeight; // circular, então largura = altura
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

  // ============================================
  // HEADER - Design sóbrio e elegante para igreja
  // ============================================
  const drawHeader = (pageNum: number) => {
    // Background sólido na cor primária do tema (sóbrio e impactante)
    pdf.setFillColor(...theme.primary);
    pdf.rect(0, 0, pageWidth, headerHeight, 'F');

    // Sutil gradiente escurecendo para baixo (refinamento visual)
    const darkerPrimary: [number, number, number] = [
      Math.max(0, theme.primary[0] - 25),
      Math.max(0, theme.primary[1] - 25),
      Math.max(0, theme.primary[2] - 25),
    ];
    const gradSteps = 6;
    for (let i = 0; i < gradSteps; i++) {
      const ratio = i / gradSteps;
      const alpha = ratio * 0.3;
      const r = Math.round(theme.primary[0] - (theme.primary[0] - darkerPrimary[0]) * alpha);
      const g = Math.round(theme.primary[1] - (theme.primary[1] - darkerPrimary[1]) * alpha);
      const b = Math.round(theme.primary[2] - (theme.primary[2] - darkerPrimary[2]) * alpha);
      pdf.setFillColor(r, g, b);
      const stepHeight = headerHeight / gradSteps;
      pdf.rect(0, headerHeight - stepHeight * (i + 1), pageWidth, stepHeight + 0.5, 'F');
    }

    // Linha de destaque inferior dourada/accent sutil
    pdf.setFillColor(...theme.accent);
    pdf.rect(0, headerHeight - 1.5, pageWidth, 1.5, 'F');

    let textStartX = margin;

    // Logo do tenant (apenas página 1) - SEM destaque de cor, apenas logo normal
    if (pageNum === 1 && logoDataUrl && logoWidth > 0) {
      try {
        const logoY = (headerHeight - logoHeight) / 2;
        const logoX = margin;

        // Adicionar logo diretamente sem bordas coloridas
        const logoFormat = getJsPdfImageFormatFromDataUrl(logoDataUrl);
        pdf.addImage(logoDataUrl, logoFormat, logoX, logoY, logoWidth, logoHeight);
        
        textStartX = margin + logoWidth + 10;
      } catch (e) {
        console.warn('Erro ao inserir logo:', e);
        textStartX = margin;
      }
    }

    // Subtítulo "FOLHETO DE CANTOS" - fonte clássica elegante
    pdf.setFont('times', 'italic');
    pdf.setFontSize(11);
    pdf.setTextColor(...white);
    pdf.text('FOLHETO DE CANTOS', textStartX, 11);

    // Nome do evento - GRANDE, fonte serifada clássica
    pdf.setFont('times', 'bold');
    pdf.setFontSize(20);
    pdf.setTextColor(...white);
    const maxEventWidth = pageWidth - textStartX - margin - 50;
    const eventLines = pdf.splitTextToSize(event.name.toUpperCase(), maxEventWidth);
    pdf.text(eventLines[0], textStartX, 22);
    if (eventLines[1]) {
      pdf.setFontSize(14);
      pdf.text(eventLines[1], textStartX, 29);
    }

    // Data e local (canto direito) - destaque elegante
    const infoX = pageWidth - margin;
    
    // Data em destaque
    pdf.setFont('times', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(...white);
    const dateStr = format(new Date(event.date), "dd/MM/yyyy", { locale: ptBR });
    pdf.text(dateStr, infoX, 14, { align: 'right' });

    // Local em itálico elegante
    if (event.location) {
      pdf.setFont('times', 'italic');
      pdf.setFontSize(10);
      pdf.setTextColor(255, 255, 255);
      const locationLines = pdf.splitTextToSize(event.location, 50);
      pdf.text(locationLines[0], infoX, 22, { align: 'right' });
      if (locationLines[1]) {
        pdf.text(locationLines[1], infoX, 27, { align: 'right' });
      }
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

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...textLight);

    if (tenant?.name) {
      pdf.text(tenant.name, margin, footY);
    }

    // Número da página com destaque
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...theme.primary);
    const pageStr = `${pageNum} / ${totalPages}`;
    pdf.text(pageStr, pageWidth - margin, footY, { align: 'right' });
  };

  // Desenhar header da primeira página
  drawHeader(1);

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
      pdf.addImage(eventImageDataUrl, eventImgFormat, imgX, col1Y, imgW, imgH);

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
        pdf.rect(imgX, col1Y + (i * fadeSize / steps), imgW, fadeSize / steps, 'F');
      }

      // Gradiente inferior
      for (let i = 0; i < steps; i++) {
        const alpha = i / steps;
        pdf.setGState(new (pdf as any).GState({ opacity: alpha * 0.7 }));
        pdf.rect(imgX, col1Y + imgH - fadeSize + (i * fadeSize / steps), imgW, fadeSize / steps, 'F');
      }

      // Gradiente esquerdo
      for (let i = 0; i < steps; i++) {
        const alpha = 1 - (i / steps);
        pdf.setGState(new (pdf as any).GState({ opacity: alpha * 0.7 }));
        pdf.rect(imgX + (i * fadeSize / steps), col1Y, fadeSize / steps, imgH, 'F');
      }

      // Gradiente direito
      for (let i = 0; i < steps; i++) {
        const alpha = i / steps;
        pdf.setGState(new (pdf as any).GState({ opacity: alpha * 0.7 }));
        pdf.rect(imgX + imgW - fadeSize + (i * fadeSize / steps), col1Y, fadeSize / steps, imgH, 'F');
      }

      // Resetar opacidade
      pdf.setGState(new (pdf as any).GState({ opacity: 1 }));

      col1Y += imgH + 8;
    } catch (e) {
      console.warn('Erro ao inserir imagem do evento:', e);
    }
  }

  // ============================================
  // SEÇÃO DE MÚSICA - Design com background esmaecido
  // ============================================
  const drawSongSection = (num: number, label: string): void => {
    const x = currentCol === 1 ? col1X : col2X;
    let y = currentCol === 1 ? col1Y : col2Y;

    // Verificar se precisa mudar de coluna/página
    if (y + 25 > contentEnd) {
      if (currentCol === 1) {
        currentCol = 2;
        y = col2Y;
      } else {
        pdf.addPage();
        currentPage++;
        drawHeader(currentPage);
        currentCol = 1;
        col1Y = contentStart;
        col2Y = contentStart;
        y = col1Y;
      }
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
    pdf.rect(x, y, colWidth, barHeight, 'F');

    // Badge numérico (retângulo colorido sólido)
    pdf.setFillColor(...theme.primary);
    pdf.rect(x, y, badgeWidth, barHeight, 'F');
    
    // Número centralizado no badge (branco, negrito)
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    const numText = String(num);
    const numW = pdf.getTextWidth(numText);
    pdf.text(numText, x + (badgeWidth - numW) / 2, y + 4.3);

    // Texto do tipo (negrito, cor primária)
    const labelText = label.toUpperCase();
    pdf.setTextColor(...theme.primary);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.text(labelText, x + badgeWidth + 3, y + 4.3);

    // Mais espaço após a seção do tipo para separar do nome
    const newY = y + barHeight + 4;
    if (currentCol === 1) col1Y = newY;
    else col2Y = newY;
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
    let x = (currentCol === 1 ? col1X : col2X) + 1.5 + indent;
    let y = (currentCol === 1 ? col1Y : col2Y) + spaceBefore;
    const lineHeight = size * 0.40;
    const maxWidth = colWidth - 4 - indent;
    
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);

    const lines = pdf.splitTextToSize(text, maxWidth) as string[];

    for (const line of lines) {
      if (y + lineHeight > contentEnd) {
        if (currentCol === 1) {
          currentCol = 2;
          x = col2X + 1.5 + indent;
          y = col2Y;
        } else {
          pdf.addPage();
          currentPage++;
          drawHeader(currentPage);
          currentCol = 1;
          col1Y = contentStart;
          col2Y = contentStart;
          x = col1X + 1.5 + indent;
          y = col1Y;
        }
      }

      pdf.text(line, x, y);
      y += lineHeight;
    }

    if (currentCol === 1) col1Y = y;
    else col2Y = y;
  };

  // ============================================
  // PROCESSAR MÚSICAS
  // ============================================
  let songIndex = 0;
  for (const song of songsWithLyrics) {
    songIndex++;

    // Espaço entre seções (maior para separação visual)
    if (songIndex > 1) {
      if (currentCol === 1) col1Y += 4;
      else col2Y += 4;
    }

    const typeLabel = typeLabels[song.type] || song.type || 'Música';
    drawSongSection(songIndex, typeLabel);

    // Nome da música (destaque)
    // Nome da música (destaque) - fonte 11pt
    addText(song.name, 11, 'bold', theme.primary, 0, 1);

    // Espaço após nome (mais separação)
    if (currentCol === 1) col1Y += 2.5;
    else col2Y += 2.5;

    // Processar letra
    if (song.lyrics) {
      const lyricsLines = song.lyrics.split('\n');
      let isRefrain = false;
      let prevEmpty = false;

      for (const line of lyricsLines) {
        const trimmed = line.trim();
        
        if (!trimmed) {
          if (!prevEmpty) {
            if (currentCol === 1) col1Y += 2;
            else col2Y += 2;
          }
          prevEmpty = true;
          isRefrain = false;
          continue;
        }
        prevEmpty = false;

        const hasMarker = /^(PR:|AS:|TODOS:|T:|C:|A:|L:)/i.test(trimmed);
        const isRefrainLine = /^(R:|REFRÃO:|REFRAO:|REF:)/i.test(trimmed);

        if (isRefrainLine) {
          isRefrain = true;
          addText(trimmed, 11, 'bold', theme.primary, 0, 0.8);
          continue;
        }

        if (/^\d+\./.test(trimmed)) isRefrain = false;

        let style: 'normal' | 'bold' | 'italic' = 'normal';
        let color = textDark;
        let indent = 0;

        if (hasMarker) {
          style = 'bold';
          color = textMedium;
        } else if (isRefrain) {
          style = 'italic';
          color = textMedium;
          indent = 3;
        }

        addText(trimmed, 11, style, color, indent, 0);
      }
    }

    // Espaço após a música
    if (currentCol === 1) col1Y += 1.5;
    else col2Y += 1.5;
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

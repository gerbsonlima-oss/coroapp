import jsPDF from 'jspdf';
import { PDFDocument, rgb } from 'pdf-lib';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { generateSongTypeLabelsWithNumerals } from './songTypeLabeling';
import { parseDateOnlyLocal } from './dateParsing';

interface TenantInfo {
  name: string;
  logo_url: string | null;
}

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
  sheet_music_url: string | null;
  sheet_music_pdf_url?: string | null;
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

const loadImageViaProxy = async (url: string): Promise<HTMLImageElement> => {
  // For Supabase storage URLs, use the image-proxy edge function to bypass CORS
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const isSupabaseUrl = url.includes(supabaseUrl?.replace('https://', '') || '');
  
  let imageUrl = url;
  
  if (isSupabaseUrl && supabaseUrl) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/image-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.dataUrl) {
          imageUrl = data.dataUrl;
        }
      }
    } catch (error) {
      console.error('Erro ao usar proxy de imagem:', error);
    }
  }
  
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = imageUrl;
  });
};

const loadImage = loadImageViaProxy;

// Extrai cores predominantes de uma imagem para usar nos headers do PDF
const extractPaletteFromImage = (img: HTMLImageElement): {
  primary: [number, number, number];
  accent: [number, number, number];
  onPrimary: [number, number, number];
} | null => {
  try {
    const canvas = document.createElement('canvas');
    const size = 64;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;

    // Quantizar cores em buckets (4 bits por canal => 4096 buckets)
    const buckets = new Map<number, { r: number; g: number; b: number; count: number; sat: number }>();
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      if (a < 200) continue;
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      const sat = max === 0 ? 0 : (max - min) / max;
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
      const cur = buckets.get(key);
      if (cur) {
        cur.r += r; cur.g += g; cur.b += b; cur.count++; cur.sat = Math.max(cur.sat, sat);
      } else {
        buckets.set(key, { r, g, b, count: 1, sat });
      }
    }
    if (buckets.size === 0) return null;

    const arr = Array.from(buckets.values()).map(v => ({
      r: Math.round(v.r / v.count),
      g: Math.round(v.g / v.count),
      b: Math.round(v.b / v.count),
      count: v.count,
      sat: v.sat,
    }));

    // Pontuação: valoriza saturação e frequência, descarta cores muito claras/escuras
    const scored = arr
      .filter(c => {
        const lum = (c.r * 299 + c.g * 587 + c.b * 114) / 1000;
        return lum > 25 && lum < 230;
      })
      .map(c => ({ ...c, score: c.count * (0.3 + c.sat) }))
      .sort((a, b) => b.score - a.score);

    const pick = scored[0] || arr.sort((a, b) => b.count - a.count)[0];
    if (!pick) return null;

    // Escurece levemente para uso como cor primária do header
    const darken = (v: number, f: number) => Math.max(0, Math.min(255, Math.round(v * f)));
    const primary: [number, number, number] = [darken(pick.r, 0.75), darken(pick.g, 0.75), darken(pick.b, 0.75)];

    // Cor de destaque: segunda mais relevante, ou clareada
    const second = scored[1] || pick;
    const lighten = (v: number, f: number) => Math.max(0, Math.min(255, Math.round(v + (255 - v) * f)));
    const accent: [number, number, number] = [lighten(second.r, 0.35), lighten(second.g, 0.35), lighten(second.b, 0.35)];

    // Texto sobre primária: branco ou preto conforme luminância
    const lum = (primary[0] * 299 + primary[1] * 587 + primary[2] * 114) / 1000;
    const onPrimary: [number, number, number] = lum > 140 ? [30, 30, 30] : [255, 255, 255];

    return { primary, accent, onPrimary };
  } catch (e) {
    console.warn('Falha ao extrair paleta da imagem:', e);
    return null;
  }
};

const createCircularImageForPDF = async (img: HTMLImageElement, size: number): Promise<string | null> => {
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement('canvas');
      const outputSize = size * 4; // Higher resolution for quality
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext('2d');
      if (!ctx) return resolve(null);

      // Create circular clip
      ctx.beginPath();
      ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();

      // Draw image centered and cropped to square
      const imgSize = Math.min(img.width, img.height);
      const sx = (img.width - imgSize) / 2;
      const sy = (img.height - imgSize) / 2;
      ctx.drawImage(img, sx, sy, imgSize, imgSize, 0, 0, outputSize, outputSize);

      resolve(canvas.toDataURL('image/png'));
    } catch (e) {
      console.warn('Erro ao criar imagem circular:', e);
      resolve(null);
    }
  });
};

const fetchPdfAsArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);
  return response.arrayBuffer();
};

const loadTypeLabels = async (): Promise<Record<string, string>> => {
  try {
    // ✅ Tipos de música agora são globais
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

export const exportEventPDF = async (event: Event, songs: Song[], tenant?: TenantInfo) => {
  await exportWithPdfConcatenation(event, songs, tenant);
};

const exportWithPdfConcatenation = async (event: Event, songs: Song[], tenant?: TenantInfo) => {
  const finalPdf = await PDFDocument.create();
  const typeLabels = await loadTypeLabels();
  
  // Temas de cores modernos para o PDF
  const pdfThemes: Record<string, {
    primaryColor: [number, number, number];
    accentColor: [number, number, number];
    textColor: [number, number, number];
    whiteColor: [number, number, number];
    overlayColor: [number, number, number];
    indexTypeColor: [number, number, number]; // Cor sempre escura para tipos no índice
  }> = {
    deep_blue_gold: {
      primaryColor: [25, 55, 109], // Azul profundo elegante (padrão atual)
      accentColor: [218, 165, 32], // Dourado musical
      textColor: [51, 51, 51],
      whiteColor: [255, 255, 255],
      overlayColor: [0, 0, 0],
      indexTypeColor: [25, 55, 109], // Azul escuro
    },
    emerald_night: {
      primaryColor: [6, 78, 59], // Verde esmeralda escuro
      accentColor: [244, 244, 245], // Cinza quase branco
      textColor: [24, 24, 27],
      whiteColor: [250, 250, 250],
      overlayColor: [15, 23, 42],
      indexTypeColor: [6, 78, 59], // Verde escuro
    },
    violet_sunset: {
      primaryColor: [88, 28, 135], // Roxo profundo
      accentColor: [251, 113, 133], // Rosa moderno
      textColor: [30, 41, 59],
      whiteColor: [255, 255, 255],
      overlayColor: [15, 23, 42],
      indexTypeColor: [88, 28, 135], // Roxo escuro
    },
    graphite_copper: {
      primaryColor: [15, 23, 42], // Grafite
      accentColor: [249, 115, 22], // Laranja cobre
      textColor: [24, 24, 27], // Corrigido para escuro
      whiteColor: [248, 250, 252],
      overlayColor: [15, 23, 42],
      indexTypeColor: [180, 83, 9], // Laranja escuro
    },
    crimson_noir: {
      primaryColor: [127, 29, 29], // Vermelho escuro moderno
      accentColor: [248, 250, 252], // Quase branco para detalhes
      textColor: [24, 24, 27],
      whiteColor: [255, 255, 255],
      overlayColor: [15, 23, 42],
      indexTypeColor: [127, 29, 29], // Vermelho escuro
    },
    sunrise_coral: {
      primaryColor: [234, 88, 12], // Laranja queimado / coral
      accentColor: [251, 146, 60], // Coral dourado
      textColor: [17, 24, 39],
      whiteColor: [255, 255, 255],
      overlayColor: [15, 23, 42],
      indexTypeColor: [180, 83, 9], // Laranja escuro
    },
    ocean_teal: {
      primaryColor: [13, 148, 136], // Teal oceano
      accentColor: [45, 212, 191], // Turquesa claro
      textColor: [17, 24, 39],
      whiteColor: [255, 255, 255],
      overlayColor: [15, 23, 42],
      indexTypeColor: [15, 118, 110], // Teal escuro
    },
    forest_sage: {
      primaryColor: [22, 101, 52], // Verde floresta
      accentColor: [134, 239, 172], // Verde sage claro
      textColor: [20, 30, 26],
      whiteColor: [255, 255, 255],
      overlayColor: [15, 23, 42],
      indexTypeColor: [22, 101, 52], // Verde floresta
    },
    midnight_purple: {
      primaryColor: [76, 29, 149], // Roxo meia-noite
      accentColor: [192, 132, 252], // Lavanda
      textColor: [30, 20, 50],
      whiteColor: [255, 255, 255],
      overlayColor: [15, 10, 30],
      indexTypeColor: [76, 29, 149], // Roxo escuro
    },
    wine_burgundy: {
      primaryColor: [136, 19, 55], // Borgonha vinho
      accentColor: [251, 207, 232], // Rosa suave
      textColor: [40, 20, 30],
      whiteColor: [255, 255, 255],
      overlayColor: [30, 10, 20],
      indexTypeColor: [136, 19, 55], // Borgonha
    },
  };

  const themeKey = event.pdf_theme || 'deep_blue_gold';
  const theme = pdfThemes[themeKey] || pdfThemes.deep_blue_gold;

  const primaryColor = theme.primaryColor;
  const accentColor = theme.accentColor;
  const textColor = theme.textColor;
  const whiteColor = theme.whiteColor;
  const overlayColor = theme.overlayColor;
  const indexTypeColor = theme.indexTypeColor;
  
  // ============================================
  // PÁGINA 1: CAPA PROFISSIONAL (ou capa customizada)
  // ============================================
  const coverPdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = coverPdf.internal.pageSize.getWidth();
  const pageHeight = coverPdf.internal.pageSize.getHeight();
  const margin = 20;

  const useCustomCover = !!event.pdf_cover_url;

  if (useCustomCover) {
    try {
      const customCoverImg = await loadImage(event.pdf_cover_url!);
      coverPdf.addImage(customCoverImg, 'JPEG', 0, 0, pageWidth, pageHeight);
    } catch (error) {
      console.error('Erro ao carregar capa customizada:', error);
    }
  } else {
    // Fundo sólido com a cor do tema selecionado
    coverPdf.setFillColor(...primaryColor);
    coverPdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // ÁREA RESERVADA PARA LOGO: ocupa todo o centro disponível (15-165mm do topo)
  const logoAreaTop = 15;
  const logoAreaBottom = 165;
  const logoAreaHeight = logoAreaBottom - logoAreaTop;
  
  // Use tenant logo if available
  const logoUrl = tenant?.logo_url;
  if (logoUrl) {
    try {
      const logoImg = await loadImage(logoUrl);
      
      // Logo should be circular and smaller (max 60mm)
      const maxLogoSize = Math.min(60, logoAreaHeight, pageWidth - 40);
      const logoSize = maxLogoSize;
      
      // Create circular version of the logo
      const circularLogoDataUrl = await createCircularImageForPDF(logoImg, logoSize);
      
      if (circularLogoDataUrl) {
        const logoX = (pageWidth - logoSize) / 2;
        const logoY = logoAreaTop + (logoAreaHeight - logoSize) / 2;
        coverPdf.addImage(circularLogoDataUrl, 'PNG', logoX, logoY, logoSize, logoSize);
      } else {
        // Fallback to original image if circular conversion fails
        const maxLogoWidth = pageWidth - 20;
        const maxLogoHeight = logoAreaHeight;
        
        let logoWidth = maxLogoWidth;
        let logoHeight = (logoImg.height / logoImg.width) * logoWidth;
        
        if (logoHeight > maxLogoHeight) {
          logoHeight = maxLogoHeight;
          logoWidth = (logoImg.width / logoImg.height) * logoHeight;
        }
        
        const logoX = (pageWidth - logoWidth) / 2;
        const logoY = logoAreaTop + (logoAreaHeight - logoHeight) / 2;
        coverPdf.addImage(logoImg, 'PNG', logoX, logoY, logoWidth, logoHeight);
      }
    } catch (error) {
      console.error('Erro ao carregar logo:', error);
    }
  }

  // ÁREA RESERVADA PARA TÍTULO: 168-208mm do topo
  const titleAreaTop = 168;
  const titleAreaBottom = 208;
  const titleMaxWidth = pageWidth - 40;
  
  // Calcular tamanho de fonte dinâmico baseado no comprimento do título
  let fontSize = 48;
  coverPdf.setFont('times', 'bold'); // Fonte elegante tipo serif
  coverPdf.setFontSize(fontSize);
  
  let titleLines = coverPdf.splitTextToSize(event.name, titleMaxWidth);
  let estimatedHeight = titleLines.length * (fontSize * 0.35); // Estimativa de altura em mm
  
  // Reduzir fonte se necessário para caber na área
  while (estimatedHeight > (titleAreaBottom - titleAreaTop) && fontSize > 24) {
    fontSize -= 2;
    coverPdf.setFontSize(fontSize);
    titleLines = coverPdf.splitTextToSize(event.name, titleMaxWidth);
    estimatedHeight = titleLines.length * (fontSize * 0.35);
  }
  
  // Centralizar verticalmente na área do título
  let titleY = titleAreaTop + ((titleAreaBottom - titleAreaTop) - estimatedHeight) / 2 + (fontSize * 0.35);
  
  coverPdf.setTextColor(...whiteColor);
  titleLines.forEach((line: string) => {
    const titleWidth = coverPdf.getTextWidth(line);
    coverPdf.text(line, (pageWidth - titleWidth) / 2, titleY);
    titleY += fontSize * 0.4;
  });

  // Linha decorativa
  const decorativeLineY = titleAreaBottom + 5;
  coverPdf.setDrawColor(...accentColor);
  coverPdf.setLineWidth(0.5);
  coverPdf.line(40, decorativeLineY, pageWidth - 40, decorativeLineY);

  // Subtítulo
  coverPdf.setFontSize(20);
  coverPdf.setFont('times', 'italic');
  const subtitle = 'Livro de Cantos';
  const subtitleWidth = coverPdf.getTextWidth(subtitle);
  coverPdf.text(subtitle, (pageWidth - subtitleWidth) / 2, decorativeLineY + 10);

  // Data e local
  const footerY = decorativeLineY + 30;
  coverPdf.setFontSize(15);
  coverPdf.setFont('times', 'normal');
  const formattedDate = format(parseDateOnlyLocal(event.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const dateWidth = coverPdf.getTextWidth(formattedDate);
  coverPdf.text(formattedDate, (pageWidth - dateWidth) / 2, footerY);

  if (event.location) {
    const locationWidth = coverPdf.getTextWidth(event.location);
    coverPdf.text(event.location, (pageWidth - locationWidth) / 2, footerY + 10);
  }
  } // fim else (capa gerada)

  
  // Converter capa para PDF-lib
  const coverPdfBytes = coverPdf.output('arraybuffer');
  const coverPdfDoc = await PDFDocument.load(coverPdfBytes);
  const [coverPage] = await finalPdf.copyPages(coverPdfDoc, [0]);
  finalPdf.addPage(coverPage);

  // ============================================
  // PÁGINA 2: ÍNDICE
  // ============================================
  const indexPdf = new jsPDF('p', 'mm', 'a4');
  
  // Cabeçalho do índice usando o tema atual
  indexPdf.setFillColor(...primaryColor);
  indexPdf.rect(0, 0, pageWidth, 30, 'F');
  
  // Título "Índice"
  indexPdf.setFontSize(24);
  indexPdf.setTextColor(...whiteColor);
  indexPdf.setFont('helvetica', 'bold');
  const indexTitle = 'Índice';
  const indexTitleWidth = indexPdf.getTextWidth(indexTitle);
  indexPdf.text(indexTitle, (pageWidth - indexTitleWidth) / 2, 20);

  


  // Linha decorativa abaixo do cabeçalho, usando a cor de destaque do tema
  indexPdf.setDrawColor(...accentColor);
  indexPdf.setLineWidth(0.5);
  indexPdf.line(margin, 32, pageWidth - margin, 32);

  // Remover músicas duplicadas preservando a ordem do evento
  const indexSongs: Song[] = [];
  songs.forEach((song) => {
    if ((song.sheet_music_pdf_url || song.sheet_music_url) && !indexSongs.find((s) => s.id === song.id)) {
      indexSongs.push(song);
    }
  });
  
  // Gerar labels com numerais romanos para tipos repetidos (ex: Comunhão I, Comunhão II)
  const songTypeLabelMap = generateSongTypeLabelsWithNumerals(songs, typeLabels);
  
  // Adicionar índice em ordem de execução, com label de tipo
  let indexY = 45;
  indexPdf.setFont('helvetica', 'normal');
  indexPdf.setFontSize(11);

  indexSongs.forEach((song, index) => {
    if (indexY > pageHeight - 20) {
      indexPdf.addPage();
      indexY = 20;
    }

    const numberText = `${index + 1}.`;
    // Usar label com numeral romano se houver múltiplas músicas do mesmo tipo
    const typeLabel = songTypeLabelMap[song.id] || typeLabels[song.type] || song.type || 'Outro';
    const typeText = `(${typeLabel})`;

    // Número + nome da música (lado esquerdo)
    indexPdf.setTextColor(...textColor);
    indexPdf.text(numberText, margin, indexY);
    const nameX = margin + indexPdf.getTextWidth(numberText) + 2;
    const maxNameWidth = pageWidth - margin * 2 - indexPdf.getTextWidth(typeText) - 6;
    const nameLines = indexPdf.splitTextToSize(song.name, maxNameWidth) as string[];
    indexPdf.text(nameLines, nameX, indexY);

    // Label de tipo alinhada à direita, usando cor escura para legibilidade
    indexPdf.setTextColor(...indexTypeColor);
    const typeWidth = indexPdf.getTextWidth(typeText);
    indexPdf.text(typeText, pageWidth - margin - typeWidth, indexY);

    // Avança a linha com base na quantidade de linhas do nome
    indexY += 6 * nameLines.length;
  });

  // Observação para ouvir os áudios no app com QR Code, logo abaixo do índice
  try {
    const pathFirstSegment = window.location.pathname.split('/').filter(Boolean)[0] || '';
    const globalPrefixes = new Set(['auth', 'e']);
    const appRoots = new Set([
      'events',
      'songs',
      'admin',
      'rehearsals',
      'liturgy',
      'audio-to-sheet',
      'choir-members',
      'pending-approval',
      'public',
    ]);
    const currentSlug =
      pathFirstSegment && !globalPrefixes.has(pathFirstSegment) && !appRoots.has(pathFirstSegment)
        ? pathFirstSegment
        : (localStorage.getItem('selected_tenant_slug') || '');
    const eventUrl = currentSlug
      ? `${window.location.origin}/${currentSlug}/public/events/${event.id}`
      : `${window.location.origin}/public/events/${event.id}`;
    const qrDataUrl = await QRCode.toDataURL(eventUrl, { margin: 1, scale: 6 });

    // Garante que texto + QR caibam na página atual; se não couberem, continua na próxima
    if (indexY > pageHeight - 40) {
      indexPdf.addPage();
      indexY = 20;
    }

    const noteText = "Para ouvir os áudios deste evento no app 'Coro Diocesano Quixadá', basta ler o QR Code abaixo no seu celular.";
    indexPdf.setFont('helvetica', 'normal');
    indexPdf.setFontSize(9);
    indexPdf.setTextColor(...textColor);

    const qrSize = 24; // um pouco menor para ficar discreto
    const qrX = pageWidth - margin - qrSize;
    const qrY = indexY;

    const textMaxWidth = pageWidth - margin * 3 - qrSize;
    const textLines = indexPdf.splitTextToSize(noteText, textMaxWidth) as string[];

    // Texto explicativo à esquerda e QR à direita, na mesma altura
    indexPdf.text(textLines, margin, qrY + 4);
    indexPdf.addImage(qrDataUrl, 'PNG', qrX, qrY, qrSize, qrSize);

    // Atualiza o índice Y para depois do bloco de observação
    indexY = Math.max(indexY + qrSize + 6, qrY + 10);
  } catch (error) {
    console.error('Erro ao gerar QR Code e observação no índice do PDF:', error);
  }

  // Converter índice para PDF-lib
  const indexPdfBytes = indexPdf.output('arraybuffer');
  const indexPdfDoc = await PDFDocument.load(indexPdfBytes);
  const indexPages = await finalPdf.copyPages(indexPdfDoc, indexPdfDoc.getPageIndices());
  indexPages.forEach(page => finalPdf.addPage(page));

  // ============================================
  // CONCATENAR PDFs DAS PARTITURAS
  // ============================================
  for (const song of indexSongs) {
    const type = song.type || 'outro';
    
    if (song.sheet_music_pdf_url) {
      try {
        // Carregar PDF original
        const pdfBytes = await fetchPdfAsArrayBuffer(song.sheet_music_pdf_url);
        const songPdf = await PDFDocument.load(pdfBytes);
        
        // Copiar cada página individualmente e adicionar cabeçalho
        const pageCount = songPdf.getPageCount();
        for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
          const [copiedPage] = await finalPdf.copyPages(songPdf, [pageIndex]);
          
          // Adicionar faixa de cabeçalho no topo da primeira página do tipo
          if (pageIndex === 0) {
            const { width, height } = copiedPage.getSize();
            const headerHeight = 35;
            
            // Desenhar faixa de cabeçalho usando a cor primária do tema
            copiedPage.drawRectangle({
              x: 0,
              y: height - headerHeight,
              width: width,
              height: headerHeight,
              color: rgb(primaryColor[0] / 255, primaryColor[1] / 255, primaryColor[2] / 255),
            });
            
            // Adicionar texto do tipo litúrgico usando a cor clara do tema
            const headerLabel = (typeLabels[type] || type).toUpperCase();
            copiedPage.drawText(headerLabel, {
              x: width / 2 - (headerLabel.length * 4),
              y: height - headerHeight / 2 - 4,
              size: 14,
              color: rgb(whiteColor[0] / 255, whiteColor[1] / 255, whiteColor[2] / 255),
            });
          }
          
          finalPdf.addPage(copiedPage);
        }
      } catch (error) {
        console.error(`Erro ao adicionar PDF de ${song.name}:`, error);
      }
    } else if (song.sheet_music_url) {
      // Fallback: criar PDF a partir da imagem
      try {
        const img = await loadImage(song.sheet_music_url);
        const tempPdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = tempPdf.internal.pageSize.getWidth() - 40;
        const imgHeight = (img.height / img.width) * imgWidth;
        tempPdf.addImage(img, 'JPEG', 20, 20, imgWidth, imgHeight);
        
        const tempPdfBytes = tempPdf.output('arraybuffer');
        const tempPdfDoc = await PDFDocument.load(tempPdfBytes);
        const [copiedPage] = await finalPdf.copyPages(tempPdfDoc, [0]);
        finalPdf.addPage(copiedPage);
      } catch (error) {
        console.error(`Erro ao adicionar imagem de ${song.name}:`, error);
      }
    }
  }


  // ============================================
  // CONTRACAPA (opcional)
  // ============================================
  let hasBackCover = false;
  if (event.pdf_back_cover_url) {
    try {
      const backPdf = new jsPDF('p', 'mm', 'a4');
      const bw = backPdf.internal.pageSize.getWidth();
      const bh = backPdf.internal.pageSize.getHeight();
      const backImg = await loadImage(event.pdf_back_cover_url);
      backPdf.addImage(backImg, 'JPEG', 0, 0, bw, bh);
      const backBytes = backPdf.output('arraybuffer');
      const backDoc = await PDFDocument.load(backBytes);
      const [backPage] = await finalPdf.copyPages(backDoc, [0]);
      finalPdf.addPage(backPage);
      hasBackCover = true;
    } catch (error) {
      console.error('Erro ao adicionar contracapa customizada:', error);
    }
  }

  // Adicionar numeração de páginas (exceto capa e contracapa)
  const pages = finalPdf.getPages();
  const totalPages = pages.length;
  const numberedTotal = totalPages - 1 - (hasBackCover ? 1 : 0);

  pages.forEach((page, index) => {
    if (index === 0) return; // não numerar a capa
    if (hasBackCover && index === totalPages - 1) return; // não numerar contracapa

    const { width } = page.getSize();
    const fontSize = 10;
    const text = `${index} / ${numberedTotal}`;

    page.drawText(text, {
      x: width / 2 - text.length * fontSize * 0.25,
      y: 20,
      size: fontSize,
      color: rgb(textColor[0] / 255, textColor[1] / 255, textColor[2] / 255),
    });
  });

  // Salvar PDF final
  const pdfBytes = await finalPdf.save();
  const blob = new Blob([pdfBytes as unknown as BlobPart], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const fileName = `Partituras_${event.name.replace(/[^a-z0-9]/gi, '_')}_${format(parseDateOnlyLocal(event.date), 'yyyy-MM-dd')}.pdf`;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const exportWithImages = async (event: Event, songs: Song[]) => {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;

  // Cores
  const primaryColor: [number, number, number] = [184, 134, 11];
  const accentColor: [number, number, number] = [205, 133, 63];
  const textColor: [number, number, number] = [51, 51, 51];
  const whiteColor: [number, number, number] = [255, 255, 255];
  const overlayColor: [number, number, number] = [0, 0, 0];

  // ============================================
  // PÁGINA 1: CAPA
  // ============================================
  if (event.cover_image_url) {
    try {
      const coverImg = await loadImage(event.cover_image_url);
      pdf.addImage(coverImg, 'JPEG', 0, 0, pageWidth, pageHeight);
      
      // Apply overlay using GState for transparency
      const gState = new (pdf as any).GState({ opacity: 0.6 });
      pdf.setGState(gState);
      pdf.setFillColor(...overlayColor);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      
      // Reset to full opacity
      const gStateOpaque = new (pdf as any).GState({ opacity: 1 });
      pdf.setGState(gStateOpaque);
    } catch (error) {
      console.error('Erro ao carregar imagem de capa:', error);
      pdf.setFillColor(...primaryColor);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    }
  } else {
    pdf.setFillColor(...primaryColor);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  }

  // Logo removed - not used in this fallback function

  pdf.setFontSize(48);
  pdf.setTextColor(...whiteColor);
  pdf.setFont('helvetica', 'bold');
  const titleLines = pdf.splitTextToSize(event.name, pageWidth - 40);
  let titleY = 120;
  titleLines.forEach((line: string) => {
    const titleWidth = pdf.getTextWidth(line);
    pdf.text(line, (pageWidth - titleWidth) / 2, titleY);
    titleY += 16;
  });

  pdf.setDrawColor(...accentColor);
  pdf.setLineWidth(0.5);
  pdf.line(40, titleY + 5, pageWidth - 40, titleY + 5);

  pdf.setFontSize(22);
  pdf.setFont('helvetica', 'italic');
  const subtitle = 'Partituras - Roteiro Litúrgico';
  const subtitleWidth = pdf.getTextWidth(subtitle);
  pdf.text(subtitle, (pageWidth - subtitleWidth) / 2, titleY + 20);

  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'normal');
  const formattedDate = format(parseDateOnlyLocal(event.date), "dd 'de' MMMM, yyyy", { locale: ptBR });
  const dateWidth = pdf.getTextWidth(formattedDate);
  pdf.text(formattedDate, (pageWidth - dateWidth) / 2, titleY + 35);

  if (event.location) {
    const locationWidth = pdf.getTextWidth(event.location);
    pdf.text(event.location, (pageWidth - locationWidth) / 2, titleY + 48);
  }

  // Brasão removed - not used in this fallback function

  // ============================================
  // PARTITURAS ORGANIZADAS POR TIPO LITÚRGICO
  // ============================================
  const sortedSongs = [...songs].filter(song => song.sheet_music_url).sort((a, b) => {
    const orderA = liturgicalOrder[a.type] ?? 999;
    const orderB = liturgicalOrder[b.type] ?? 999;
    return orderA - orderB;
  });

  const songsByType: Record<string, Song[]> = {};
  sortedSongs.forEach(song => {
    if (!songsByType[song.type]) {
      songsByType[song.type] = [];
    }
    songsByType[song.type].push(song);
  });

  const sortedTypes = Object.keys(songsByType).sort((a, b) => {
    const orderA = liturgicalOrder[a] ?? 999;
    const orderB = liturgicalOrder[b] ?? 999;
    return orderA - orderB;
  });

  const addTypeHeader = (type: string, yPos: number): number => {
    pdf.setFillColor(...primaryColor);
    pdf.rect(margin, yPos - 10, pageWidth - (2 * margin), 16, 'F');
    
    pdf.setFontSize(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(...whiteColor);
    const headerLabel = type.replace(/_/g, ' ').toUpperCase();
    pdf.text(headerLabel, margin + 5, yPos + 2);
    
    return yPos + 14;
  };

  for (const type of sortedTypes) {
    const typeSongs = songsByType[type];
    const songsWithSheets = typeSongs.filter(song => song.sheet_music_url);
    
    if (songsWithSheets.length === 0) continue;
    
    const preparedSongs: Array<{ song: Song; img: HTMLImageElement }> = [];
    for (const song of songsWithSheets) {
      try {
        const img = await loadImage(song.sheet_music_url!);
        preparedSongs.push({ song, img });
      } catch (error) {
        console.error(`Erro ao carregar partitura de ${song.name}:`, error);
      }
    }
    
    if (preparedSongs.length === 0) continue;
    
    let pageCreated = false;
    let yPosition = margin + 5;

    for (const { song, img } of preparedSongs) {
      try {
        let imgWidth = pageWidth - (2 * margin);
        let imgHeight = (img.height / img.width) * imgWidth;
        
        const songTitleHeight = 10;
        const spacing = 12;
        
        if (!pageCreated) {
          pdf.addPage();
          yPosition = margin + 5;
          yPosition = addTypeHeader(type, yPosition);
          yPosition += 5;
          pageCreated = true;
          
          const maxHeight = pageHeight - yPosition - margin - songTitleHeight - spacing;
          if (imgHeight > maxHeight) {
            const ratio = maxHeight / imgHeight;
            imgHeight = maxHeight;
            imgWidth = imgWidth * ratio;
          }
        } else {
          const totalHeight = songTitleHeight + imgHeight + spacing;
          const availableSpace = pageHeight - yPosition - margin;

          if (totalHeight > availableSpace) {
            pdf.addPage();
            yPosition = margin + 5;
            yPosition = addTypeHeader(type, yPosition);
            yPosition += 5;
            
            const maxHeight = pageHeight - yPosition - margin - songTitleHeight - spacing;
            if (imgHeight > maxHeight) {
              const ratio = maxHeight / imgHeight;
              imgHeight = maxHeight;
              imgWidth = imgWidth * ratio;
            }
          }
        }

        pdf.setFontSize(14);
        pdf.setFont('helvetica', 'bold');
        pdf.setTextColor(...textColor);
        pdf.text(song.name, margin, yPosition);
        yPosition += songTitleHeight;

        pdf.addImage(img, 'JPEG', margin, yPosition, imgWidth, imgHeight);
        yPosition += imgHeight + spacing;
      } catch (error) {
        console.error(`Erro ao adicionar partitura de ${song.name}:`, error);
      }
    }
  }

  // ============================================
  // RODAPÉ EM TODAS AS PÁGINAS
  // ============================================
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    
    if (i === 1) {
      pdf.setTextColor(...whiteColor);
    } else {
      pdf.setTextColor(150, 150, 150);
    }
    
    const footerText = `${event.name} • ${format(parseDateOnlyLocal(event.date), "dd/MM/yyyy")}`;
    const footerWidth = pdf.getTextWidth(footerText);
    pdf.text(footerText, (pageWidth - footerWidth) / 2, pageHeight - 10);
    
    if (i > 1) {
      pdf.text(`${i - 1}`, pageWidth - margin, pageHeight - 10);
    }
  }

  const fileName = `Partituras_${event.name.replace(/[^a-z0-9]/gi, '_')}_${format(parseDateOnlyLocal(event.date), 'yyyy-MM-dd')}.pdf`;
  pdf.save(fileName);
};

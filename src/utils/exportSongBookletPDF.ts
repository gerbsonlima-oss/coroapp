import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

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

// Carrega imagem com múltiplos fallbacks para contornar CORS
const loadImageRobust = async (url: string): Promise<string | null> => {
  if (!url) return null;
  
  // Método 1: Canvas com crossOrigin (funciona para maioria dos casos)
  const canvasResult = await new Promise<string | null>((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    const timeout = setTimeout(() => {
      console.warn('Timeout ao carregar imagem via canvas:', url);
      img.src = '';
      resolve(null);
    }, 5000);
    
    img.onload = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const dataUrl = canvas.toDataURL('image/png');
          console.log('Imagem carregada via canvas:', url.substring(0, 50));
          resolve(dataUrl);
        } else {
          resolve(null);
        }
      } catch (e) {
        console.warn('Erro ao converter imagem para canvas:', e);
        resolve(null);
      }
    };
    
    img.onerror = () => {
      clearTimeout(timeout);
      console.warn('Erro canvas ao carregar imagem:', url.substring(0, 50));
      resolve(null);
    };
    
    img.src = url;
  });
  
  if (canvasResult) return canvasResult;
  
  // Método 2: Fetch direto (funciona para Supabase Storage público)
  try {
    console.log('Tentando fetch direto:', url.substring(0, 50));
    const response = await fetch(url);
    if (!response.ok) {
      console.warn('Fetch falhou com status:', response.status);
      return null;
    }
    const blob = await response.blob();
    return await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        console.log('Imagem carregada via fetch:', url.substring(0, 50));
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        console.warn('FileReader erro');
        resolve(null);
      };
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Erro ao carregar imagem via fetch:', url.substring(0, 50), error);
    return null;
  }
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
  const textDark: [number, number, number] = [35, 35, 45];
  const textLight: [number, number, number] = [100, 100, 110];
  
  // Layout - medidas em mm
  const margin = 12;
  const gutter = 8;
  const colWidth = (pageWidth - 2 * margin - gutter) / 2;
  const headerHeight = 28;
  const footerHeight = 10;
  const contentStart = headerHeight + 4;
  const contentEnd = pageHeight - footerHeight - 2;

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
      logoHeight = 18; // altura fixa
      logoWidth = (dims.width / dims.height) * logoHeight;
      if (logoWidth > 35) {
        logoWidth = 35;
        logoHeight = (dims.height / dims.width) * logoWidth;
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

  // ============================================
  // HEADER - Design profissional para impressão
  // ============================================
  const drawHeader = (pageNum: number) => {
    // Fundo branco limpo
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, headerHeight, 'F');

    // Borda superior colorida (elegante)
    pdf.setFillColor(...theme.primary);
    pdf.rect(0, 0, pageWidth, 3, 'F');

    let textStartX = margin;

    // Logo do tenant (apenas página 1)
    if (pageNum === 1 && logoDataUrl && logoWidth > 0) {
      try {
        const logoY = 6;
        pdf.addImage(logoDataUrl, 'PNG', margin, logoY, logoWidth, logoHeight);
        textStartX = margin + logoWidth + 6;
      } catch (e) {
        console.warn('Erro ao inserir logo:', e);
        textStartX = margin;
      }
    }

    // Título principal
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(...theme.primary);
    pdf.text('FOLHETO DE CANTOS', textStartX, 12);

    // Subtítulo
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...textLight);
    pdf.text('celebração litúrgica', textStartX, 16.5);

    // Nome do evento
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.setTextColor(...textDark);
    const maxEventWidth = pageWidth - textStartX - margin - 45;
    const eventLines = pdf.splitTextToSize(event.name, maxEventWidth);
    pdf.text(eventLines[0], textStartX, 22);

    // Data e local (direita) - apenas página 1
    if (pageNum === 1) {
      const infoX = pageWidth - margin;
      
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9);
      pdf.setTextColor(...theme.primary);
      const dateStr = format(new Date(event.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
      pdf.text(dateStr, infoX, 12, { align: 'right' });

      if (event.location) {
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(...textLight);
        const locationLines = pdf.splitTextToSize(event.location, 50);
        pdf.text(locationLines[0], infoX, 17, { align: 'right' });
      }
    }

    // Linha inferior do header
    pdf.setDrawColor(...theme.accent);
    pdf.setLineWidth(0.5);
    pdf.line(margin, headerHeight - 1, pageWidth - margin, headerHeight - 1);
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
      
      // Borda elegante com cantos arredondados (simulado)
      pdf.setFillColor(...theme.light);
      pdf.roundedRect(imgX - 2, col1Y - 2, eventImageWidth + 4, eventImageHeight + 4, 2, 2, 'F');
      
      pdf.setDrawColor(...theme.accent);
      pdf.setLineWidth(0.8);
      pdf.roundedRect(imgX - 1, col1Y - 1, eventImageWidth + 2, eventImageHeight + 2, 1.5, 1.5, 'S');
      
      pdf.addImage(eventImageDataUrl, 'JPEG', imgX, col1Y, eventImageWidth, eventImageHeight);
      col1Y += eventImageHeight + 8;
    } catch (e) {
      console.warn('Erro ao inserir imagem do evento:', e);
    }
  }

  // ============================================
  // SEÇÃO DE MÚSICA - Design com badge numérico
  // ============================================
  const drawSongSection = (num: number, label: string): void => {
    const x = currentCol === 1 ? col1X : col2X;
    let y = currentCol === 1 ? col1Y : col2Y;

    // Verificar se precisa mudar de coluna/página
    if (y + 30 > contentEnd) {
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

    const badgeSize = 6;
    const barHeight = 6;

    // Badge numérico (quadrado colorido)
    pdf.setFillColor(...theme.primary);
    pdf.roundedRect(x, y, badgeSize, badgeSize, 1, 1, 'F');
    
    // Número centralizado no badge
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    const numText = String(num);
    const numW = pdf.getTextWidth(numText);
    pdf.text(numText, x + (badgeSize - numW) / 2, y + 4.3);

    // Barra colorida com texto do tipo
    const labelText = label.toUpperCase();
    pdf.setFontSize(8);
    const labelWidth = pdf.getTextWidth(labelText) + 6;
    
    pdf.setFillColor(...theme.primary);
    pdf.roundedRect(x + badgeSize + 1, y, labelWidth, barHeight, 1, 1, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.text(labelText, x + badgeSize + 4, y + 4.2);

    const newY = y + barHeight + 3;
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
    let x = (currentCol === 1 ? col1X : col2X) + 2 + indent;
    let y = (currentCol === 1 ? col1Y : col2Y) + spaceBefore;
    const lineHeight = size * 0.42;
    const maxWidth = colWidth - 4 - indent;
    
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);

    const lines = pdf.splitTextToSize(text, maxWidth) as string[];

    for (const line of lines) {
      if (y + lineHeight > contentEnd) {
        if (currentCol === 1) {
          currentCol = 2;
          x = col2X + 2 + indent;
          y = col2Y;
        } else {
          pdf.addPage();
          currentPage++;
          drawHeader(currentPage);
          currentCol = 1;
          col1Y = contentStart;
          col2Y = contentStart;
          x = col1X + 2 + indent;
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

    // Espaço entre seções
    if (songIndex > 1) {
      if (currentCol === 1) col1Y += 5;
      else col2Y += 5;
    }

    const typeLabel = typeLabels[song.type] || song.type || 'Música';
    drawSongSection(songIndex, typeLabel);

    // Nome da música (destaque)
    addText(song.name, 10.5, 'bold', theme.primary, 0, 1);

    // Linha separadora sutil
    const lineX = currentCol === 1 ? col1X : col2X;
    const lineY = currentCol === 1 ? col1Y : col2Y;
    pdf.setDrawColor(...theme.accent);
    pdf.setLineWidth(0.3);
    pdf.line(lineX + 2, lineY, lineX + 25, lineY);

    if (currentCol === 1) col1Y += 2;
    else col2Y += 2;

    // Processar letra
    if (song.lyrics) {
      const lyricsLines = song.lyrics.split('\n');
      let isRefrain = false;
      let prevEmpty = false;

      for (const line of lyricsLines) {
        const trimmed = line.trim();
        
        if (!trimmed) {
          if (!prevEmpty) {
            if (currentCol === 1) col1Y += 2.5;
            else col2Y += 2.5;
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
          addText(trimmed, 9, 'bold', theme.primary, 0, 1);
          continue;
        }

        if (/^\d+\./.test(trimmed)) isRefrain = false;

        let style: 'normal' | 'bold' | 'italic' = 'normal';
        let color = textDark;
        let indent = 0;

        if (hasMarker) {
          style = 'bold';
          color = theme.primary;
        } else if (isRefrain) {
          style = 'italic';
          color = textLight;
          indent = 4;
        }

        addText(trimmed, 9, style, color, indent, 0);
      }
    }

    // Espaço após a música
    if (currentCol === 1) col1Y += 2;
    else col2Y += 2;
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

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

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
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
  
  // Theme system - matching event configuration
  const pdfThemes: Record<string, {
    primary: [number, number, number];
    accent: [number, number, number];
    dark: [number, number, number];
    light: [number, number, number];
  }> = {
    deep_blue_gold: {
      primary: [25, 55, 109],
      accent: [218, 165, 32],
      dark: [40, 40, 50],
      light: [248, 250, 253],
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
  const textLight: [number, number, number] = [90, 90, 100];
  
  // Layout settings
  const margin = 12;
  const gutter = 10;
  const colWidth = (pageWidth - 2 * margin - gutter) / 2;
  const headerHeight = 42;
  const footerHeight = 12;
  const contentStart = headerHeight + 5;
  const contentEnd = pageHeight - footerHeight;

  // State
  let currentPage = 1;
  let col1Y = contentStart;
  let col2Y = contentStart;
  let currentCol = 1;

  // ============================================
  // HELPER: Clean, minimal header with logo
  // ============================================
  const drawHeader = async (pageNum: number) => {
    // Clean white background
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, headerHeight, 'F');

    // Top colored border (subtle)
    pdf.setFillColor(...theme.primary);
    pdf.rect(0, 0, pageWidth, 2.5, 'F');

    let logoEndX = margin;

    // Logo (left side)
    if (tenant?.logo_url && pageNum === 1) {
      try {
        const logoImg = await loadImage(tenant.logo_url);
        const logoHeight = 24;
        const logoAspect = logoImg.width / logoImg.height;
        const logoWidth = logoHeight * logoAspect;
        
        pdf.addImage(logoImg, 'PNG', margin, 8, logoWidth, logoHeight);
        logoEndX = margin + logoWidth + 8;
      } catch (error) {
        console.error('Logo error:', error);
      }
    }

    // Clean typography
    pdf.setTextColor(...theme.primary);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(20);
    pdf.text('FOLHETO DE CANTOS', logoEndX, 16);

    // Minimal subtitle
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...textLight);
    pdf.text('celebração litúrgica', logoEndX, 21);

    // Event title (clean)
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(...textDark);
    const eventLines = pdf.splitTextToSize(event.name.toUpperCase(), pageWidth - logoEndX - margin * 2);
    pdf.text(eventLines[0], logoEndX, 30);

    // Right side info
    if (pageNum === 1) {
      const infoX = pageWidth - margin;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(...textLight);
      
      const dateStr = format(new Date(event.date), 'dd/MM/yyyy', { locale: ptBR });
      pdf.text(dateStr, infoX, 14, { align: 'right' });

      if (event.location) {
        pdf.text(event.location, infoX, 19, { align: 'right' });
      }
    }

    // Subtle bottom line
    pdf.setDrawColor(...theme.primary);
    pdf.setLineWidth(0.3);
    pdf.line(margin, headerHeight - 1, pageWidth - margin, headerHeight - 1);
  };

  // ============================================
  // HELPER: Clean footer
  // ============================================
  const drawFooter = (pageNum: number, totalPages: number) => {
    const footY = pageHeight - 5;

    // Subtle top line
    pdf.setDrawColor(...theme.accent);
    pdf.setLineWidth(0.3);
    pdf.line(margin, footY - 6, pageWidth - margin, footY - 6);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...textLight);

    if (tenant?.name) {
      pdf.text(tenant.name, margin, footY);
    }

    // Page number
    pdf.setFont('helvetica', 'bold');
    const pageStr = `${pageNum}/${totalPages}`;
    const pageWidth_text = pdf.getTextWidth(pageStr);
    pdf.text(pageStr, pageWidth - margin - pageWidth_text, footY);
  };

  await drawHeader(1);

  const col1X = margin;
  const col2X = margin + colWidth + gutter;

  // ============================================
  // Featured image in first column
  // ============================================
  if (event.cover_image_url) {
    try {
      const img = await loadImage(event.cover_image_url);
      
      const imgWidth = colWidth - 4;
      const maxHeight = 90;
      
      let imgHeight = (img.height / img.width) * imgWidth;
      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
      }
      
      const imgX = col1X + (colWidth - imgWidth) / 2;
      
      // Minimal frame
      pdf.setDrawColor(...theme.accent);
      pdf.setLineWidth(0.5);
      pdf.rect(imgX - 1, col1Y - 1, imgWidth + 2, imgHeight + 2);
      
      pdf.addImage(img, 'JPEG', imgX, col1Y, imgWidth, imgHeight);
      col1Y += imgHeight + 8;
    } catch (e) {
      console.error('Image error:', e);
    }
  }

  // ============================================
  // HELPER: Clean song section
  // ============================================
  const drawSongSection = (num: number, label: string) => {
    const x = currentCol === 1 ? col1X : col2X;
    let y = currentCol === 1 ? col1Y : col2Y;

    if (y + 35 > contentEnd) {
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

    // Clean minimal design
    pdf.setFillColor(...theme.light);
    pdf.rect(x, y, colWidth, 6.5);

    // Left accent bar
    pdf.setFillColor(...theme.primary);
    pdf.rect(x, y, 1.5, 6.5, 'F');

    // Number circle
    pdf.setFillColor(...theme.accent);
    pdf.circle(x + 6, y + 3.25, 2.2, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    const numText = String(num);
    const numW = pdf.getTextWidth(numText);
    pdf.text(numText, x + 6 - (numW / 2), y + 3.6);

    // Label
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...theme.primary);
    pdf.text(label.toUpperCase(), x + 10, y + 3.8);

    const newY = y + 8.5;
    if (currentCol === 1) col1Y = newY;
    else col2Y = newY;
  };

  // ============================================
  // HELPER: Add text with flow
  // ============================================
  const addText = (text: string, size: number, style: 'normal' | 'bold' | 'italic', color: [number, number, number], spaceBefore = 0) => {
    const x = currentCol === 1 ? col1X : col2X;
    let y = (currentCol === 1 ? col1Y : col2Y) + spaceBefore;
    const lineHeight = size * 0.38;
    
    pdf.setFont('helvetica', style);
    pdf.setFontSize(size);
    pdf.setTextColor(...color);

    const lines = pdf.splitTextToSize(text, colWidth - 3) as string[];

    for (const line of lines) {
      if (y + lineHeight > contentEnd) {
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

      pdf.text(line, x + 2, y);
      y += lineHeight;
    }

    if (currentCol === 1) col1Y = y;
    else col2Y = y;
  };

  // ============================================
  // Process songs
  // ============================================
  let songIndex = 0;
  for (const song of songsWithLyrics) {
    songIndex++;

    if (songIndex > 1) {
      if (currentCol === 1) col1Y += 4;
      else col2Y += 4;
    }

    const typeLabel = typeLabels[song.type] || song.type || 'Música';
    drawSongSection(songIndex, typeLabel);

    // Song title
    addText(song.name, 10, 'bold', theme.primary, 1.5);

    // Minimal separator
    const lineX = currentCol === 1 ? col1X : col2X;
    const lineY = currentCol === 1 ? col1Y : col2Y;
    pdf.setDrawColor(...theme.accent);
    pdf.setLineWidth(0.2);
    pdf.line(lineX + 2, lineY - 0.3, lineX + colWidth - 2, lineY - 0.3);

    if (currentCol === 1) col1Y += 1;
    else col2Y += 1;

    // Lyrics
    if (song.lyrics) {
      const lyricsLines = song.lyrics.split('\n');
      let isRefrain = false;
      let prevEmpty = false;

      for (const line of lyricsLines) {
        const trimmed = line.trim();
        
        if (!trimmed) {
          if (!prevEmpty) {
            if (currentCol === 1) col1Y += 1.5;
            else col2Y += 1.5;
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
          addText(trimmed, 8.5, 'bold', textDark, 0.8);
          continue;
        }

        if (/^\d+\./.test(trimmed)) isRefrain = false;

        let style: 'normal' | 'bold' | 'italic' = 'normal';
        let color = textDark;

        if (hasMarker) {
          style = 'bold';
          color = theme.primary;
        } else if (isRefrain) {
          style = 'italic';
          color = textLight;
        }

        pdf.setFont('helvetica', style);
        pdf.setFontSize(8.8);
        pdf.setTextColor(...color);

        const x = (currentCol === 1 ? col1X : col2X) + 2;
        let y = (currentCol === 1 ? col1Y : col2Y);

        const textLines = pdf.splitTextToSize(trimmed, colWidth - 4) as string[];
        const lineHeight = 8.8 * 0.38;

        for (const textLine of textLines) {
          if (y + lineHeight > contentEnd) {
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
          pdf.text(textLine, x, y);
          y += lineHeight;
        }

        if (currentCol === 1) col1Y = y;
        else col2Y = y;
      }
    }

    if (currentCol === 1) col1Y += 2;
    else col2Y += 2;
  }

  // ============================================
  // Add footers
  // ============================================
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    drawFooter(i, totalPages);
  }

  // ============================================
  // Save
  // ============================================
  const fileName = `Folheto_Cantos_${event.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
  pdf.save(fileName);
};

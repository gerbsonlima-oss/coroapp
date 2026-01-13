import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

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

// Theme system - matching exportEventPDF themes
const pdfThemes: Record<string, {
  primaryColor: [number, number, number];
  accentColor: [number, number, number];
  textColor: [number, number, number];
  textLightColor: [number, number, number];
  whiteColor: [number, number, number];
}> = {
  deep_blue_gold: {
    primaryColor: [25, 55, 109],
    accentColor: [218, 165, 32],
    textColor: [51, 51, 51],
    textLightColor: [100, 100, 100],
    whiteColor: [255, 255, 255],
  },
  emerald_night: {
    primaryColor: [6, 78, 59],
    accentColor: [134, 239, 172],
    textColor: [24, 24, 27],
    textLightColor: [80, 80, 85],
    whiteColor: [250, 250, 250],
  },
  violet_sunset: {
    primaryColor: [88, 28, 135],
    accentColor: [251, 113, 133],
    textColor: [30, 41, 59],
    textLightColor: [100, 100, 115],
    whiteColor: [255, 255, 255],
  },
  graphite_copper: {
    primaryColor: [15, 23, 42],
    accentColor: [249, 115, 22],
    textColor: [24, 24, 27],
    textLightColor: [75, 75, 80],
    whiteColor: [248, 250, 252],
  },
  crimson_noir: {
    primaryColor: [127, 29, 29],
    accentColor: [248, 250, 252],
    textColor: [24, 24, 27],
    textLightColor: [80, 80, 85],
    whiteColor: [255, 255, 255],
  },
  sunrise_coral: {
    primaryColor: [220, 100, 75],
    accentColor: [251, 146, 60],
    textColor: [17, 24, 39],
    textLightColor: [90, 90, 95],
    whiteColor: [255, 255, 255],
  },
  ocean_teal: {
    primaryColor: [13, 148, 136],
    accentColor: [45, 212, 191],
    textColor: [17, 24, 39],
    textLightColor: [80, 90, 90],
    whiteColor: [255, 255, 255],
  },
  forest_sage: {
    primaryColor: [22, 101, 52],
    accentColor: [134, 239, 172],
    textColor: [20, 30, 26],
    textLightColor: [70, 85, 75],
    whiteColor: [255, 255, 255],
  },
  midnight_purple: {
    primaryColor: [76, 29, 149],
    accentColor: [192, 132, 252],
    textColor: [30, 20, 50],
    textLightColor: [90, 80, 110],
    whiteColor: [255, 255, 255],
  },
  wine_burgundy: {
    primaryColor: [136, 19, 55],
    accentColor: [251, 207, 232],
    textColor: [40, 20, 30],
    textLightColor: [100, 70, 80],
    whiteColor: [255, 255, 255],
  },
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
  
  // Get theme colors based on event's pdf_theme
  const themeKey = event.pdf_theme || 'deep_blue_gold';
  const theme = pdfThemes[themeKey] || pdfThemes.deep_blue_gold;
  
  // Filter songs that have lyrics and sort by liturgical order
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
  const pageWidth = pdf.internal.pageSize.getWidth(); // 210mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 297mm
  
  // Layout settings - matching reference image
  const margin = 10;
  const columnGap = 8;
  const columnWidth = (pageWidth - 2 * margin - columnGap) / 2; // ~91mm each
  const headerHeight = 22;
  const footerHeight = 8;
  const contentStartY = headerHeight + 5;
  const contentEndY = pageHeight - footerHeight - 3;

  // ============================================
  // HELPER: Draw header with theme color
  // ============================================
  const drawHeader = async (pageNum: number) => {
    // Solid background with primary color
    pdf.setFillColor(...theme.primaryColor);
    pdf.rect(0, 0, pageWidth, headerHeight, 'F');

    // Accent line at bottom of header
    pdf.setDrawColor(...theme.accentColor);
    pdf.setLineWidth(0.8);
    pdf.line(margin, headerHeight - 1, pageWidth - margin, headerHeight - 1);

    let textStartX = margin;

    // Add tenant logo if available
    if (tenant?.logo_url) {
      try {
        const logoImg = await loadImage(tenant.logo_url);
        const maxLogoHeight = 16;
        const logoAspect = logoImg.width / logoImg.height;
        const logoHeight = maxLogoHeight;
        const logoWidth = logoHeight * logoAspect;
        
        const logoY = (headerHeight - logoHeight) / 2;
        pdf.addImage(logoImg, 'PNG', margin, logoY, logoWidth, logoHeight);
        textStartX = margin + logoWidth + 6;
      } catch (error) {
        console.error('Erro ao carregar logo do tenant:', error);
      }
    }

    // Title and event info
    pdf.setTextColor(...theme.whiteColor);
    
    // Main title
    pdf.setFont('times', 'bold');
    pdf.setFontSize(14);
    pdf.text('FOLHETO DE CANTOS', textStartX, 10);

    // Event name
    pdf.setFont('times', 'normal');
    pdf.setFontSize(11);
    const availableWidth = pageWidth - textStartX - margin;
    const eventNameLines = pdf.splitTextToSize(event.name, availableWidth);
    pdf.text(eventNameLines[0], textStartX, 16);

    // Location (if available, on right side)
    if (event.location && pageNum === 1) {
      pdf.setFontSize(8);
      pdf.setTextColor(220, 220, 230);
      const locationText = event.location;
      const locationWidth = pdf.getTextWidth(locationText);
      pdf.text(locationText, pageWidth - margin - locationWidth, 16);
    }
  };

  // ============================================
  // HELPER: Draw footer
  // ============================================
  const drawFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 5;
    
    // Accent line above footer
    pdf.setDrawColor(...theme.accentColor);
    pdf.setLineWidth(0.3);
    pdf.line(margin, footerY - 3, pageWidth - margin, footerY - 3);

    pdf.setFont('times', 'normal');
    pdf.setFontSize(7);
    pdf.setTextColor(...theme.textLightColor);

    // Tenant name on the left
    if (tenant?.name) {
      pdf.text(tenant.name, margin, footerY);
    }

    // Page number on the right
    const pageText = `${pageNum}/${totalPages}`;
    const pageTextWidth = pdf.getTextWidth(pageText);
    pdf.text(pageText, pageWidth - margin - pageTextWidth, footerY);
  };

  // ============================================
  // INITIAL SETUP - First page
  // ============================================
  await drawHeader(1);

  // Column tracking
  const col1X = margin;
  const col2X = margin + columnWidth + columnGap;
  let col1Y = contentStartY;
  let col2Y = contentStartY;
  let currentColumn = 1;
  let pageNum = 1;

  // ============================================
  // HELPER: Draw section header with BADGE + BAR (reference style)
  // ============================================
  const drawSectionHeader = (sectionNumber: number, typeLabel: string): void => {
    const badgeSize = 6; // Square badge for number
    const barHeight = 6;
    const x = currentColumn === 1 ? col1X : col2X;
    let y = currentColumn === 1 ? col1Y : col2Y;
    
    // Check if we need to switch column or page
    if (y + barHeight + 15 > contentEndY) {
      if (currentColumn === 1) {
        currentColumn = 2;
        y = col2Y;
      } else {
        pdf.addPage();
        pageNum++;
        drawHeader(pageNum);
        currentColumn = 1;
        col1Y = contentStartY;
        col2Y = contentStartY;
        y = col1Y;
      }
    }
    
    // Calculate text width for the label bar
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    const labelText = typeLabel.toUpperCase();
    const labelWidth = pdf.getTextWidth(labelText) + 6; // padding
    
    // Draw number badge (square with number)
    pdf.setFillColor(...theme.primaryColor);
    pdf.roundedRect(x, y, badgeSize, badgeSize, 1, 1, 'F');
    
    // Number in badge (centered)
    pdf.setTextColor(...theme.whiteColor);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    const numText = String(sectionNumber);
    const numWidth = pdf.getTextWidth(numText);
    pdf.text(numText, x + (badgeSize - numWidth) / 2, y + 4.3);
    
    // Draw label bar (adjacent to badge)
    const barX = x + badgeSize + 1.5;
    const barWidth = Math.min(labelWidth, columnWidth - badgeSize - 4);
    pdf.setFillColor(...theme.primaryColor);
    pdf.roundedRect(barX, y, barWidth, barHeight, 1, 1, 'F');
    
    // Label text in bar
    pdf.setTextColor(...theme.whiteColor);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(9);
    pdf.text(labelText, barX + 3, y + 4.2);
    
    // Update column Y position
    const newY = y + barHeight + 2;
    if (currentColumn === 1) {
      col1Y = newY;
    } else {
      col2Y = newY;
    }
  };

  // ============================================
  // HELPER: Add content to column with proper flow
  // ============================================
  const addContent = (
    lines: string[],
    fontSize: number,
    fontStyle: 'normal' | 'bold' | 'italic',
    color: [number, number, number],
    spaceBefore: number = 0,
    indent: number = 0
  ): void => {
    pdf.setFont('times', fontStyle);
    pdf.setFontSize(fontSize);
    pdf.setTextColor(...color);
    
    const lineHeight = fontSize * 0.4;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const x = (currentColumn === 1 ? col1X : col2X) + indent;
      let y = currentColumn === 1 ? col1Y : col2Y;
      
      // Add space before first line only
      if (i === 0) {
        y += spaceBefore;
      }
      
      // Check if we need to switch column or page
      if (y + lineHeight > contentEndY) {
        if (currentColumn === 1) {
          currentColumn = 2;
          y = col2Y + (i === 0 ? spaceBefore : 0);
        } else {
          // New page
          pdf.addPage();
          pageNum++;
          drawHeader(pageNum);
          currentColumn = 1;
          col1Y = contentStartY;
          col2Y = contentStartY;
          y = col1Y + (i === 0 ? spaceBefore : 0);
        }
      }
      
      const currentX = (currentColumn === 1 ? col1X : col2X) + indent;
      pdf.text(line, currentX, y);
      
      const newY = y + lineHeight;
      if (currentColumn === 1) {
        col1Y = newY;
      } else {
        col2Y = newY;
      }
    }
  };

  // ============================================
  // PROCESS SONGS
  // ============================================
  let songIndex = 0;
  
  for (const song of songsWithLyrics) {
    songIndex++;
    
    // Add space before section (except first)
    if (songIndex > 1) {
      if (currentColumn === 1) {
        col1Y += 5; // 5mm between sections
      } else {
        col2Y += 5;
      }
    }
    
    // Type header with badge + bar style (numbered)
    const typeLabel = typeLabels[song.type] || song.type || 'Outro';
    drawSectionHeader(songIndex, typeLabel);
    
    // Song name (bold, 11pt)
    pdf.setFont('times', 'bold');
    pdf.setFontSize(11);
    const nameLines = pdf.splitTextToSize(song.name, columnWidth - 4) as string[];
    addContent(nameLines, 11, 'bold', theme.textColor, 1.5);
    
    // Lyrics
    if (song.lyrics) {
      const lyricsLines = song.lyrics.split('\n');
      let isRefrain = false;
      let previousWasEmpty = false;
      
      for (const line of lyricsLines) {
        const trimmedLine = line.trim();
        
        // Handle empty lines (add spacing between stanzas)
        if (!trimmedLine) {
          if (!previousWasEmpty) {
            if (currentColumn === 1) {
              col1Y += 2.5; // 2.5mm between stanzas
            } else {
              col2Y += 2.5;
            }
          }
          previousWasEmpty = true;
          isRefrain = false;
          continue;
        }
        previousWasEmpty = false;
        
        // Detect refrain markers
        const lowerLine = trimmedLine.toLowerCase();
        if (lowerLine.startsWith('r:') || 
            lowerLine.startsWith('refrão:') ||
            lowerLine.startsWith('refrao:') ||
            lowerLine.startsWith('||:') ||
            lowerLine === 'refrão' ||
            lowerLine === 'refrao') {
          isRefrain = true;
        }
        
        // Detect numbered stanzas (reset refrain)
        if (/^\d+\./.test(trimmedLine)) {
          isRefrain = false;
        }
        
        // Format and add line
        const fontStyle = isRefrain ? 'italic' : 'normal';
        const indent = isRefrain ? 5 : 0; // 5mm indent for refrains
        const color: [number, number, number] = isRefrain ? theme.textLightColor : theme.textColor;
        
        pdf.setFont('times', fontStyle);
        pdf.setFontSize(10);
        const formattedLines = pdf.splitTextToSize(trimmedLine, columnWidth - 4 - indent) as string[];
        addContent(formattedLines, 10, fontStyle, color, 0, indent);
      }
    }
  }

  // ============================================
  // ADD FOOTERS TO ALL PAGES
  // ============================================
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    drawFooter(i, totalPages);
  }

  // ============================================
  // SAVE PDF
  // ============================================
  const fileName = `Folheto de Cantos - ${event.name}.pdf`;
  pdf.save(fileName);
};

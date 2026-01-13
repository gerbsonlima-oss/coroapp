import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

interface Event {
  id: string;
  name: string;
  date: string;
  location: string | null;
  cover_image_url: string | null;
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

// Color system - Deep Blue & Gold theme
const COLORS = {
  primary: { r: 25, g: 55, b: 109 },         // #19376D - Deep blue
  primaryLight: { r: 45, g: 85, b: 149 },    // Lighter blue for gradient
  gold: { r: 218, g: 165, b: 32 },           // #DAA520 - Gold accent
  text: { r: 51, g: 51, b: 51 },             // #333333
  textLight: { r: 100, g: 100, b: 100 },     // #646464
  white: { r: 255, g: 255, b: 255 },         // #FFFFFF
  background: { r: 250, g: 250, b: 252 },    // #FAFAFC - Subtle off-white
};

const toRGB = (color: { r: number; g: number; b: number }): [number, number, number] => {
  return [color.r, color.g, color.b];
};

export const exportSongBookletPDF = async (event: Event, songs: Song[], tenant?: TenantInfo) => {
  const typeLabels = await loadTypeLabels();
  
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
  const margin = 12;
  const columnGap = 8;
  const columnWidth = (pageWidth - 2 * margin - columnGap) / 2;
  const headerHeight = 45;
  const footerHeight = 12;
  const contentStartY = headerHeight + 8;
  const contentEndY = pageHeight - footerHeight;

  // ============================================
  // HELPER: Draw gradient header
  // ============================================
  const drawHeader = async (pageNum: number) => {
    // Background gradient simulation (multiple rectangles)
    const gradientSteps = 20;
    const stepHeight = headerHeight / gradientSteps;
    
    for (let i = 0; i < gradientSteps; i++) {
      const ratio = i / gradientSteps;
      const r = Math.round(COLORS.primary.r + (COLORS.primaryLight.r - COLORS.primary.r) * ratio * 0.3);
      const g = Math.round(COLORS.primary.g + (COLORS.primaryLight.g - COLORS.primary.g) * ratio * 0.3);
      const b = Math.round(COLORS.primary.b + (COLORS.primaryLight.b - COLORS.primary.b) * ratio * 0.3);
      pdf.setFillColor(r, g, b);
      pdf.rect(0, i * stepHeight, pageWidth, stepHeight + 0.5, 'F');
    }

    // Decorative gold line at bottom of header
    pdf.setDrawColor(...toRGB(COLORS.gold));
    pdf.setLineWidth(1);
    pdf.line(margin, headerHeight - 2, pageWidth - margin, headerHeight - 2);

    let logoEndX = margin;

    // Add tenant logo if available (only on first page)
    if (pageNum === 1 && tenant?.logo_url) {
      try {
        const logoImg = await loadImage(tenant.logo_url);
        const maxLogoWidth = 35;
        const maxLogoHeight = 30;
        const logoAspect = logoImg.width / logoImg.height;
        
        let logoWidth = maxLogoWidth;
        let logoHeight = logoWidth / logoAspect;
        
        if (logoHeight > maxLogoHeight) {
          logoHeight = maxLogoHeight;
          logoWidth = logoHeight * logoAspect;
        }
        
        const logoY = (headerHeight - logoHeight) / 2 - 2;
        pdf.addImage(logoImg, 'PNG', margin, logoY, logoWidth, logoHeight);
        logoEndX = margin + logoWidth + 8;
      } catch (error) {
        console.error('Erro ao carregar logo do tenant:', error);
      }
    }

    // Title section
    const textStartX = logoEndX;
    const availableWidth = pageWidth - textStartX - margin;

    // Main title
    pdf.setFont('times', 'bold');
    pdf.setFontSize(22);
    pdf.setTextColor(...toRGB(COLORS.white));
    const title = 'Folheto de Cantos';
    pdf.text(title, textStartX, 18);

    // Event name
    pdf.setFont('times', 'normal');
    pdf.setFontSize(13);
    const eventNameLines = pdf.splitTextToSize(event.name, availableWidth);
    pdf.text(eventNameLines[0], textStartX, 28);

    // Location if available
    if (event.location) {
      pdf.setFontSize(10);
      pdf.setTextColor(230, 230, 240);
      const locationText = `📍 ${event.location}`;
      pdf.text(locationText, textStartX, 36);
    }
  };

  // ============================================
  // HELPER: Draw footer
  // ============================================
  const drawFooter = (pageNum: number, totalPages: number) => {
    const footerY = pageHeight - 8;
    
    // Subtle line above footer
    pdf.setDrawColor(200, 200, 210);
    pdf.setLineWidth(0.3);
    pdf.line(margin, footerY - 4, pageWidth - margin, footerY - 4);

    pdf.setFont('times', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...toRGB(COLORS.textLight));

    // Tenant name on the left
    if (tenant?.name) {
      pdf.text(tenant.name, margin, footerY);
    }

    // Page number on the right
    const pageText = `Página ${pageNum} de ${totalPages}`;
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
  // EVENT IMAGE (First column, first page)
  // ============================================
  if (event.cover_image_url) {
    try {
      const img = await loadImage(event.cover_image_url);
      const maxImgHeight = 70;
      const imgAspect = img.width / img.height;
      
      let imgWidth = columnWidth - 4;
      let imgHeight = imgWidth / imgAspect;
      
      if (imgHeight > maxImgHeight) {
        imgHeight = maxImgHeight;
        imgWidth = imgHeight * imgAspect;
      }
      
      const imgX = col1X + (columnWidth - imgWidth) / 2;
      
      // Draw shadow effect
      pdf.setFillColor(180, 180, 190);
      pdf.roundedRect(imgX + 2, col1Y + 2, imgWidth, imgHeight, 3, 3, 'F');
      
      // Draw image with rounded corners simulation (white border)
      pdf.setFillColor(...toRGB(COLORS.white));
      pdf.roundedRect(imgX - 1, col1Y - 1, imgWidth + 2, imgHeight + 2, 3, 3, 'F');
      
      // Add the actual image
      pdf.addImage(img, 'JPEG', imgX, col1Y, imgWidth, imgHeight);
      
      // Draw border
      pdf.setDrawColor(...toRGB(COLORS.gold));
      pdf.setLineWidth(0.5);
      pdf.roundedRect(imgX, col1Y, imgWidth, imgHeight, 2, 2, 'S');
      
      col1Y += imgHeight + 12;
    } catch (error) {
      console.error('Erro ao carregar imagem do evento:', error);
    }
  }

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
    
    const lineHeight = fontSize * 0.38;
    
    for (const line of lines) {
      const x = (currentColumn === 1 ? col1X : col2X) + indent;
      let y = currentColumn === 1 ? col1Y : col2Y;
      
      // Add space before first line only
      if (line === lines[0]) {
        y += spaceBefore;
      }
      
      // Check if we need to switch column or page
      if (y + lineHeight > contentEndY) {
        if (currentColumn === 1) {
          currentColumn = 2;
          y = col2Y + spaceBefore;
        } else {
          // New page
          pdf.addPage();
          pageNum++;
          drawHeader(pageNum);
          currentColumn = 1;
          col1Y = contentStartY;
          col2Y = contentStartY;
          y = col1Y + spaceBefore;
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
    
    // Calculate space needed for song header
    const spaceBefore = songIndex > 1 ? 8 : 2;
    
    // Section separator line
    const separatorY = (currentColumn === 1 ? col1Y : col2Y) + spaceBefore - 2;
    const separatorX = currentColumn === 1 ? col1X : col2X;
    
    if (songIndex > 1 && separatorY < contentEndY - 5) {
      pdf.setDrawColor(...toRGB(COLORS.gold));
      pdf.setLineWidth(0.3);
      pdf.line(separatorX, separatorY, separatorX + columnWidth * 0.3, separatorY);
    }
    
    // Type header (numbered, uppercase)
    const typeLabel = typeLabels[song.type] || song.type || 'Outro';
    const typeHeader = `${songIndex}. ${typeLabel.toUpperCase()}`;
    
    pdf.setFont('times', 'bold');
    pdf.setFontSize(10);
    const headerLines = pdf.splitTextToSize(typeHeader, columnWidth - 2) as string[];
    addContent(headerLines, 10, 'bold', toRGB(COLORS.primary), spaceBefore);
    
    // Song name
    pdf.setFont('times', 'bold');
    pdf.setFontSize(11);
    const nameLines = pdf.splitTextToSize(song.name, columnWidth - 2) as string[];
    addContent(nameLines, 11, 'bold', toRGB(COLORS.text), 2);
    
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
              col1Y += 2;
            } else {
              col2Y += 2;
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
        const indent = isRefrain ? 3 : 0;
        const color = isRefrain ? toRGB(COLORS.textLight) : toRGB(COLORS.text);
        
        pdf.setFont('times', fontStyle);
        pdf.setFontSize(9);
        const formattedLines = pdf.splitTextToSize(trimmedLine, columnWidth - 4 - indent) as string[];
        addContent(formattedLines, 9, fontStyle, color, 0, indent);
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

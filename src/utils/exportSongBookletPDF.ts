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

export const exportSongBookletPDF = async (event: Event, songs: Song[]) => {
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
  const margin = 15;
  const columnGap = 8;
  const columnWidth = (pageWidth - 2 * margin - columnGap) / 2;
  
  // Colors
  const primaryColor: [number, number, number] = [25, 55, 109]; // Deep blue
  const textColor: [number, number, number] = [51, 51, 51];
  const whiteColor: [number, number, number] = [255, 255, 255];

  // ============================================
  // HEADER (CENTERED, FULL WIDTH)
  // ============================================
  let currentY = margin;
  
  // Title "Folheto de Cantos"
  pdf.setFillColor(...primaryColor);
  pdf.rect(0, 0, pageWidth, 40, 'F');
  
  pdf.setFont('times', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(...whiteColor);
  const title = 'Folheto de Cantos';
  const titleWidth = pdf.getTextWidth(title);
  pdf.text(title, (pageWidth - titleWidth) / 2, 18);
  
  // Event name
  pdf.setFont('times', 'normal');
  pdf.setFontSize(14);
  const eventNameWidth = pdf.getTextWidth(event.name);
  pdf.text(event.name, (pageWidth - eventNameWidth) / 2, 30);
  
  currentY = 50;
  
  // Decorative line
  pdf.setDrawColor(...primaryColor);
  pdf.setLineWidth(0.5);
  pdf.line(margin, currentY - 5, pageWidth - margin, currentY - 5);

  // ============================================
  // BODY (TWO COLUMNS)
  // ============================================
  
  // Column tracking
  const col1X = margin;
  const col2X = margin + columnWidth + columnGap;
  let col1Y = currentY;
  let col2Y = currentY;
  let currentColumn = 1; // 1 = left, 2 = right
  
  // Track if image has been added to first column
  let imageAdded = false;
  const imageHeight = 60; // Height reserved for image

  // Add event image to first column if available
  if (event.cover_image_url) {
    try {
      const img = await loadImage(event.cover_image_url);
      const imgWidth = columnWidth;
      const imgHeight = (img.height / img.width) * imgWidth;
      const finalHeight = Math.min(imgHeight, imageHeight);
      const finalWidth = (finalHeight / imgHeight) * imgWidth;
      
      pdf.addImage(img, 'JPEG', col1X + (columnWidth - finalWidth) / 2, col1Y, finalWidth, finalHeight);
      col1Y += finalHeight + 10;
      imageAdded = true;
    } catch (error) {
      console.error('Erro ao carregar imagem do evento:', error);
    }
  }

  // Helper function to add text to current column
  const addToColumn = (
    text: string,
    fontSize: number,
    fontStyle: 'normal' | 'bold' | 'italic',
    isTypeHeader: boolean = false,
    addSpaceBefore: number = 0
  ): boolean => {
    pdf.setFont('times', fontStyle);
    pdf.setFontSize(fontSize);
    
    const x = currentColumn === 1 ? col1X : col2X;
    let y = currentColumn === 1 ? col1Y : col2Y;
    
    // Add space before if requested
    y += addSpaceBefore;
    
    // Split text to fit column width
    const lines = pdf.splitTextToSize(text, columnWidth - 2) as string[];
    const lineHeight = fontSize * 0.35;
    const totalHeight = lines.length * lineHeight;
    
    // Check if we need a new page or switch columns
    if (y + totalHeight > pageHeight - margin) {
      if (currentColumn === 1) {
        // Switch to column 2
        currentColumn = 2;
        y = currentY;
      } else {
        // New page
        pdf.addPage();
        col1Y = margin;
        col2Y = margin;
        currentColumn = 1;
        y = margin;
      }
    }
    
    // Set color based on type
    if (isTypeHeader) {
      pdf.setTextColor(...primaryColor);
    } else {
      pdf.setTextColor(...textColor);
    }
    
    // Draw text
    const newX = currentColumn === 1 ? col1X : col2X;
    lines.forEach((line: string) => {
      pdf.text(line, newX, y);
      y += lineHeight;
    });
    
    // Update column Y position
    if (currentColumn === 1) {
      col1Y = y + 2;
    } else {
      col2Y = y + 2;
    }
    
    return true;
  };

  // Process each song
  let songIndex = 0;
  for (const song of songsWithLyrics) {
    songIndex++;
    
    // Type header
    const typeLabel = typeLabels[song.type] || song.type || 'Outro';
    const typeHeader = `${songIndex}. ${typeLabel.toUpperCase()}`;
    addToColumn(typeHeader, 11, 'bold', true, songIndex > 1 ? 6 : 0);
    
    // Song name
    addToColumn(song.name, 10, 'bold', false, 2);
    
    // Lyrics
    if (song.lyrics) {
      const lyricsLines = song.lyrics.split('\n');
      let isRefrain = false;
      
      for (const line of lyricsLines) {
        const trimmedLine = line.trim();
        
        // Skip empty lines but add small space
        if (!trimmedLine) {
          if (currentColumn === 1) {
            col1Y += 2;
          } else {
            col2Y += 2;
          }
          continue;
        }
        
        // Detect refrain (lines starting with R: or Refrão:)
        if (trimmedLine.toLowerCase().startsWith('r:') || 
            trimmedLine.toLowerCase().startsWith('refrão:') ||
            trimmedLine.toLowerCase().startsWith('refrao:')) {
          isRefrain = true;
        }
        
        // Add lyrics line
        const fontStyle = isRefrain ? 'italic' : 'normal';
        addToColumn(trimmedLine, 9, fontStyle as 'normal' | 'bold' | 'italic', false, 0);
        
        // Reset refrain after empty line or end
        if (trimmedLine === '') {
          isRefrain = false;
        }
      }
    }
  }

  // Add page numbers
  const pageCount = pdf.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);
    pdf.setFont('times', 'normal');
    pdf.setFontSize(9);
    pdf.setTextColor(...textColor);
    const pageText = `Página ${i}`;
    const pageTextWidth = pdf.getTextWidth(pageText);
    pdf.text(pageText, pageWidth - margin - pageTextWidth, pageHeight - 10);
  }

  // Save PDF
  const fileName = `Folheto de Cantos - ${event.name}.pdf`;
  pdf.save(fileName);
};

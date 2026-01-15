import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import QRCode from 'qrcode';

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
  chords?: string | null;
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

type JsPdfImageFormat = 'PNG' | 'JPEG';

const getJsPdfImageFormatFromDataUrl = (dataUrl: string): JsPdfImageFormat => {
  const match = /^data:image\/(png|jpe?g)/i.exec(dataUrl);
  if (!match) return 'JPEG';
  return match[1].toLowerCase() === 'png' ? 'PNG' : 'JPEG';
};

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

const loadImageRobust = async (url: string): Promise<string | null> => {
  if (!url) return null;

  const fetched = await fetchImageAsDataUrl(url);
  if (fetched) return fetched;

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

  if (shouldUseBackendImageProxy(url)) {
    const proxied = await fetchImageViaBackendProxy(url);
    if (proxied) return proxied;
  }

  return null;
};

const getImageDimensions = (dataUrl: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.width, height: img.height });
    img.onerror = () => resolve({ width: 100, height: 100 });
    img.src = dataUrl;
  });
};

const createCircularImage = async (dataUrl: string, size: number): Promise<string | null> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const outputSize = size * 4;
        canvas.width = outputSize;
        canvas.height = outputSize;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);

        ctx.beginPath();
        ctx.arc(outputSize / 2, outputSize / 2, outputSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

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

// Chord detection patterns
const CHORD_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const isChordLine = (line: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) return false;
  
  // Check if it's primarily chords (traditional format)
  const chordPattern = /^[\s]*([A-G][#b]?[m7dim+sus2469\/]*)[\s]*$/;
  const words = trimmed.split(/\s+/);
  const chordWords = words.filter(w => /^[A-G][#b]?[m7dim+sus2469\/]*$/.test(w));
  
  // If more than half the words are chords, it's a chord line
  return chordWords.length > 0 && chordWords.length >= words.length / 2;
};

export const exportChordBookletPDF = async (event: Event, songs: Song[], tenant?: TenantInfo) => {
  const typeLabels = await loadTypeLabels();
  
  const songsWithChords = songs
    .filter(song => song.chords && song.chords.trim())
    .sort((a, b) => {
      const orderA = liturgicalOrder[a.type] || 999;
      const orderB = liturgicalOrder[b.type] || 999;
      return orderA - orderB;
    });

  if (songsWithChords.length === 0) {
    throw new Error('Nenhuma música com cifra cadastrada');
  }

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  // Theme system - RGB colors
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

  const textDark: [number, number, number] = [30, 30, 38];
  const textMedium: [number, number, number] = [60, 60, 70];
  const textLight: [number, number, number] = [90, 90, 100];
  const chordColor: [number, number, number] = theme.primary;
  
  // Layout - measurements in mm (SINGLE COLUMN for chord booklet)
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  const headerHeight = 52;
  const footerHeight = 8;
  const contentEnd = pageHeight - footerHeight - 3;

  // Pagination state
  let currentPage = 1;
  let currentY = headerHeight + 5;

  // Pre-load images (logo only, no event image for chord booklet)
  let logoDataUrl: string | null = null;
  let logoWidth = 0;
  let logoHeight = 0;

  // Load tenant logo and create circular version
  if (tenant?.logo_url) {
    const rawLogoDataUrl = await loadImageRobust(tenant.logo_url);
    if (rawLogoDataUrl) {
      logoHeight = 24;
      logoWidth = logoHeight;
      logoDataUrl = await createCircularImage(rawLogoDataUrl, logoHeight * 4);
      if (!logoDataUrl) {
        logoDataUrl = rawLogoDataUrl;
      }
    }
  }

  const colX = margin;

  const contentStartFirstPage = headerHeight + 5;
  const contentStartOtherPages = margin + 5;

  const getContentStart = () => currentPage === 1 ? contentStartFirstPage : contentStartOtherPages;

  // ============================================
  // HEADER - Same as song booklet
  // ============================================
  const drawHeader = () => {
    const lightBg: [number, number, number] = [
      Math.min(255, theme.primary[0] + Math.round((255 - theme.primary[0]) * 0.85)),
      Math.min(255, theme.primary[1] + Math.round((255 - theme.primary[1]) * 0.85)),
      Math.min(255, theme.primary[2] + Math.round((255 - theme.primary[2]) * 0.85)),
    ];
    
    pdf.setFillColor(...lightBg);
    pdf.rect(0, 0, pageWidth, headerHeight, 'F');

    pdf.setFillColor(...theme.primary);
    pdf.rect(0, headerHeight - 1, pageWidth, 1, 'F');

    let textStartX = margin;
    const logoSize = 38;

    const topPadding = 8;
    const lineSpacing = 3;
    
    const line1Y = topPadding + 9;
    const line2Y = line1Y + 10 + lineSpacing;
    const line3Y = line2Y + 10 + lineSpacing;

    if (logoDataUrl && logoWidth > 0) {
      try {
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

    const tenantName = tenant?.name || 'Coro Paroquial';
    pdf.setFont('times', 'bold');
    pdf.setFontSize(26);
    pdf.setTextColor(...theme.primary);
    pdf.text(tenantName.toUpperCase(), centerX, line1Y, { align: 'center' });

    // Changed to "Cifras" instead of "Subsídio Litúrgico"
    pdf.setFont('times', 'italic');
    pdf.setFontSize(26);
    const subtitleColor: [number, number, number] = [
      Math.round((theme.primary[0] + theme.accent[0]) / 2),
      Math.round((theme.primary[1] + theme.accent[1]) / 2),
      Math.round((theme.primary[2] + theme.accent[2]) / 2),
    ];
    pdf.setTextColor(...subtitleColor);
    pdf.text('Cifras', centerX, line2Y, { align: 'center' });

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
  // FOOTER
  // ============================================
  const drawFooter = (pageNum: number, totalPages: number) => {
    const footY = pageHeight - 6;

    pdf.setDrawColor(...theme.light);
    pdf.setLineWidth(0.3);
    pdf.line(margin, footY - 3, pageWidth - margin, footY - 3);

    pdf.setFont('times', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(...textLight);

    if (tenant?.name) {
      pdf.text(tenant.name, margin, footY);
    }

    pdf.setFont('times', 'bold');
    pdf.setTextColor(...theme.primary);
    const pageStr = `${pageNum} / ${totalPages}`;
    pdf.text(pageStr, pageWidth - margin, footY, { align: 'right' });
  };

  // Draw header on first page
  drawHeader();
  currentY = getContentStart();

  // ============================================
  // QR CODE (no event image for chord booklet)
  // ============================================
  try {
    const audioPageUrl = `${window.location.origin}/e/${event.id}`;
    const qrDataUrl = await QRCode.toDataURL(audioPageUrl, { 
      margin: 1, 
      scale: 6,
      color: {
        dark: `rgb(${theme.primary[0]}, ${theme.primary[1]}, ${theme.primary[2]})`,
        light: '#ffffff'
      }
    });
    
    const qrSize = 28;
    const qrX = colX + (contentWidth - qrSize) / 2;
    
    pdf.addImage(qrDataUrl, 'PNG', qrX, currentY, qrSize, qrSize);
    
    pdf.setFont('courier', 'italic');
    pdf.setFontSize(8);
    pdf.setTextColor(...textLight);
    const qrLabel = 'Escaneie para ouvir os áudios';
    const labelWidth = pdf.getTextWidth(qrLabel);
    pdf.text(qrLabel, colX + (contentWidth - labelWidth) / 2, currentY + qrSize + 4);
    
    currentY += qrSize + 10;
  } catch (e) {
    console.warn('Erro ao gerar QR code:', e);
  }

  // ============================================
  // HELPER: Move to next page (single column)
  // ============================================
  const advanceToNextPage = (): void => {
    pdf.addPage();
    currentPage++;
    currentY = getContentStart();
  };

  // ============================================
  // SONG SECTION - Same design (single column)
  // ============================================
  const drawSongSection = (num: number, label: string): void => {
    if (currentY + 25 > contentEnd) {
      advanceToNextPage();
    }

    const barHeight = 7;
    const badgeWidth = 8;

    const lightBg: [number, number, number] = [
      Math.round(255 - (255 - theme.primary[0]) * 0.12),
      Math.round(255 - (255 - theme.primary[1]) * 0.12),
      Math.round(255 - (255 - theme.primary[2]) * 0.12),
    ];
    pdf.setFillColor(...lightBg);
    pdf.rect(colX, currentY, contentWidth, barHeight, 'F');

    pdf.setFillColor(...theme.primary);
    pdf.rect(colX, currentY, badgeWidth, barHeight, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(12);
    const numText = String(num);
    const numW = pdf.getTextWidth(numText);
    pdf.text(numText, colX + (badgeWidth - numW) / 2, currentY + 5);

    const labelText = label.toUpperCase();
    pdf.setTextColor(...theme.primary);
    pdf.setFont('times', 'bold');
    pdf.setFontSize(14);
    pdf.text(labelText, colX + badgeWidth + 3, currentY + 5);

    currentY += barHeight + 5;
  };

  // ============================================
  // ADD TEXT WITH CHORD HIGHLIGHTING (font size 14)
  // ============================================
  const addChordLine = (
    line: string, 
    isChord: boolean,
    indent: number = 0
  ): void => {
    const lineHeight = 5.5;
    const maxWidth = contentWidth - 4 - indent;
    
    if (currentY + lineHeight > contentEnd) {
      advanceToNextPage();
    }

    const x = colX + 2 + indent;

    if (isChord) {
      // Chord line - highlight chords in primary color
      pdf.setFont('courier', 'bold');
      pdf.setFontSize(12);
      pdf.setTextColor(...chordColor);
      
      const lines = pdf.splitTextToSize(line, maxWidth) as string[];
      for (const l of lines) {
        if (currentY + lineHeight > contentEnd) {
          advanceToNextPage();
        }
        pdf.text(l, x, currentY);
        currentY += lineHeight;
      }
    } else {
      // Lyric line - monospaced font
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(14);
      pdf.setTextColor(...textDark);
      
      const lines = pdf.splitTextToSize(line, maxWidth) as string[];
      for (const l of lines) {
        if (currentY + lineHeight > contentEnd) {
          advanceToNextPage();
        }
        pdf.text(l, x, currentY);
        currentY += lineHeight;
      }
    }
  };

  // Process ChordPro format: [C]Lyric text[G] -> show chords above lyrics
  const processChordProLine = (line: string, indent: number = 0): void => {
    const lineHeight = 5.5;
    const maxWidth = contentWidth - 4 - indent;
    const x = colX + 2 + indent;
    
    // Extract chords and their positions
    const chordRegex = /\[([A-G][#b]?[m7dim+sus2469\/]*)\]/g;
    const chords: { chord: string; position: number }[] = [];
    let match;
    let cleanLine = line;
    let offset = 0;
    
    while ((match = chordRegex.exec(line)) !== null) {
      chords.push({
        chord: match[1],
        position: match.index - offset
      });
      offset += match[0].length;
    }
    
    cleanLine = line.replace(chordRegex, '');
    
    if (chords.length === 0) {
      // No chords, just print the line
      addChordLine(cleanLine, false, indent);
      return;
    }
    
    // Check if we need to go to next page
    if (currentY + lineHeight * 2 > contentEnd) {
      advanceToNextPage();
    }
    
    // Build chord line with proper spacing
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(12);
    
    let chordLine = '';
    let lastPos = 0;
    
    for (const c of chords) {
      const spaces = Math.max(0, c.position - lastPos);
      chordLine += ' '.repeat(spaces) + c.chord;
      lastPos = c.position + c.chord.length;
    }
    
    // Print chord line
    pdf.setTextColor(...chordColor);
    const chordLines = pdf.splitTextToSize(chordLine, maxWidth) as string[];
    for (const l of chordLines) {
      if (currentY + lineHeight > contentEnd) {
        advanceToNextPage();
      }
      pdf.text(l, x, currentY);
      currentY += lineHeight;
    }
    
    // Print lyric line - monospaced font
    if (cleanLine.trim()) {
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(14);
      pdf.setTextColor(...textDark);
      
      const lyricLines = pdf.splitTextToSize(cleanLine, maxWidth) as string[];
      for (const l of lyricLines) {
        if (currentY + lineHeight > contentEnd) {
          advanceToNextPage();
        }
        pdf.text(l, x, currentY);
        currentY += lineHeight;
      }
    }
  };

  // Refrain marker color
  const redColor: [number, number, number] = [180, 30, 30];

  // ============================================
  // PROCESS SONGS
  // ============================================
  let songIndex = 0;
  for (const song of songsWithChords) {
    songIndex++;

    if (songIndex > 1) {
      currentY += 6;
    }

    const typeLabel = typeLabels[song.type] || song.type || 'Música';
    drawSongSection(songIndex, typeLabel);

    // Song name - monospaced font
    if (currentY + 7 > contentEnd) {
      advanceToNextPage();
    }
    
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(16);
    pdf.setTextColor(...theme.primary);
    const x = colX + 2;
    const maxWidth = contentWidth - 4;
    const nameLines = pdf.splitTextToSize(song.name, maxWidth) as string[];
    for (const l of nameLines) {
      pdf.text(l, x, currentY);
      currentY += 6;
    }

    currentY += 3;

    // Process chords
    if (song.chords) {
      const chordsLines = song.chords.split('\n');
      let insideRefraoBlock = false;
      let isFirstLineOfRefrao = false;
      let insideVerseBlock = false;
      let verseNumber = '';
      let prevEmpty = false;

      for (const line of chordsLines) {
        const trimmed = line.trim();
        
        // Detect [REFRÃO] opening
        if (/^\[REFR[ÃA]O\]$/i.test(trimmed)) {
          insideRefraoBlock = true;
          isFirstLineOfRefrao = true;
          
          // Draw refrain badge
          if (currentY + 7 > contentEnd) {
            advanceToNextPage();
          }
          
          const badgeX = colX + 2;
          pdf.setFont('courier', 'bold');
          pdf.setFontSize(12);
          pdf.setTextColor(...redColor);
          pdf.text('R:', badgeX, currentY);
          currentY += 5;
          
          continue;
        }
        
        // Detect [/REFRÃO] closing
        if (/^\[\/REFR[ÃA]O\]$/i.test(trimmed)) {
          insideRefraoBlock = false;
          isFirstLineOfRefrao = false;
          currentY += 2;
          continue;
        }
        
        // Detect numbered verse opening [1], [2], etc.
        const verseOpenMatch = /^\[(\d+)\]$/i.exec(trimmed);
        if (verseOpenMatch) {
          insideVerseBlock = true;
          verseNumber = verseOpenMatch[1];
          
          // Draw verse number badge
          if (currentY + 7 > contentEnd) {
            advanceToNextPage();
          }
          
          const badgeX = colX + 2;
          pdf.setFont('courier', 'bold');
          pdf.setFontSize(12);
          pdf.setTextColor(...redColor);
          pdf.text(`${verseNumber}.`, badgeX, currentY);
          currentY += 5;
          
          continue;
        }
        
        // Detect numbered verse closing [/1], [/2], etc.
        if (/^\[\/\d+\]$/i.test(trimmed)) {
          insideVerseBlock = false;
          verseNumber = '';
          currentY += 3;
          continue;
        }
        
        if (!trimmed) {
          if (!prevEmpty) {
            currentY += 3;
          }
          prevEmpty = true;
          continue;
        }
        prevEmpty = false;

        const indent = (insideRefraoBlock || insideVerseBlock) ? 4 : 0;

        // Check if line has ChordPro format
        if (line.includes('[') && line.includes(']') && /\[[A-G]/.test(line)) {
          processChordProLine(line, indent);
        } else {
          // Traditional format - check if it's a chord line or lyric line
          const isChord = isChordLine(line);
          addChordLine(line, isChord, indent);
        }
        
        isFirstLineOfRefrao = false;
      }
    }

    currentY += 1.5;
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
  const fileName = `Cifras_${event.name.replace(/[^a-z0-9]/gi, '_')}.pdf`;
  pdf.save(fileName);
};

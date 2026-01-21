import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '@/integrations/supabase/client';
import QRCode from 'qrcode';

// Interfaces para o PDF
interface PDFEvent {
  id: string;
  name: string;
  date: string;
  location?: string | null;
  notes?: string | null;
  pdf_theme: string;
  cover_image_url?: string | null;
}

interface PDFSong {
  id: string;
  name: string;
  lyrics?: string | null;
  chords?: string | null;
  type: string;
}

interface PDFTenantInfo {
  id?: string;
  name: string;
  logo_url?: string | null;
}

// Ordem litúrgica padrão
const liturgicalOrder: Record<string, number> = {
  'entrada': 1,
  'ato_penitencial': 2,
  'gloria': 3,
  'salmo': 4,
  'aclamacao': 5,
  'ofertorio': 6,
  'santo': 7,
  'paz': 8,
  'cordeiro': 9,
  'comunhao': 10,
  'acao_gracas': 11,
  'final': 12,
  'ladainha': 13,
  'mariana': 14,
  'outra': 15,
};

// Labels padrão para tipos
const defaultTypeLabels: Record<string, string> = {
  'entrada': 'Entrada',
  'ato_penitencial': 'Ato Penitencial',
  'gloria': 'Glória',
  'salmo': 'Salmo Responsorial',
  'aclamacao': 'Aclamação',
  'ofertorio': 'Ofertório',
  'santo': 'Santo',
  'paz': 'Paz',
  'cordeiro': 'Cordeiro',
  'comunhao': 'Comunhão',
  'acao_gracas': 'Ação de Graças',
  'final': 'Final',
  'ladainha': 'Ladainha',
  'mariana': 'Mariana',
  'outra': 'Outra',
};

// Sistema de temas
const pdfThemes: Record<string, {
  primary: string;
  accent: string;
  dark: string;
  light: string;
  primaryRgb: [number, number, number];
  accentRgb: [number, number, number];
}> = {
  deep_blue_gold: {
    primary: '#19376D',
    accent: '#B48C28',
    dark: '#282832',
    light: '#F5F7FA',
    primaryRgb: [25, 55, 109],
    accentRgb: [180, 140, 40],
  },
  emerald_night: {
    primary: '#064E3B',
    accent: '#86C896',
    dark: '#141E19',
    light: '#F8FAF8',
    primaryRgb: [6, 78, 59],
    accentRgb: [134, 200, 150],
  },
  violet_sunset: {
    primary: '#581C87',
    accent: '#C896B4',
    dark: '#23142D',
    light: '#FAF8FC',
    primaryRgb: [88, 28, 135],
    accentRgb: [200, 150, 180],
  },
  wine_burgundy: {
    primary: '#7F1D1D',
    accent: '#D4A574',
    dark: '#2D1414',
    light: '#FDF8F6',
    primaryRgb: [127, 29, 29],
    accentRgb: [212, 165, 116],
  },
  ocean_teal: {
    primary: '#0F766E',
    accent: '#99D4CF',
    dark: '#0D1B1A',
    light: '#F0FDFA',
    primaryRgb: [15, 118, 110],
    accentRgb: [153, 212, 207],
  },
};

// Carregar imagem robustamente
const loadImageRobust = async (url: string): Promise<string | null> => {
  if (!url) return null;

  // Tentar via proxy primeiro para URLs do Supabase
  if (url.includes('supabase')) {
    try {
      const proxyUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/image-proxy`;
      const response = await fetch(proxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.dataUrl) {
          return data.dataUrl;
        }
      }
    } catch (e) {
      console.warn('Proxy falhou, tentando diretamente:', e);
    }
  }

  // Tentar carregar diretamente via Image
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    const timeout = setTimeout(() => resolve(null), 10000);

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
        resolve(null);
      }
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(null);
    };

    img.src = url;
  });
};

// Carregar labels de tipos do banco
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
    console.error('Erro ao carregar tipos:', error);
    return defaultTypeLabels;
  }
};

// Processar texto com tags de formatação para HTML
const processLyricsToHTML = (lyrics: string, theme: typeof pdfThemes['deep_blue_gold']): string => {
  // Normalizar quebras de linha
  let text = lyrics.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Processar tags de formatação customizadas
  text = text
    .replace(/<b>/g, '<strong>')
    .replace(/<\/b>/g, '</strong>')
    .replace(/<i>/g, '<em>')
    .replace(/<\/i>/g, '</em>')
    .replace(/<color:(#[0-9a-fA-F]{6})>/g, '<span style="color:$1">')
    .replace(/<\/color>/g, '</span>');
  
  // Colorir barras (/) em vermelho
  text = text.replace(/\//g, '<span style="color:#B41E1E">/</span>');
  
  // Processar blocos de refrão [REFRÃO]...[/REFRÃO]
  text = text.replace(/\[REFR[ÃA]O\]/gi, '<div class="refrao-block">');
  text = text.replace(/\[\/REFR[ÃA]O\]/gi, '</div>');
  
  // Processar marcadores legados R:, REFRÃO:, etc
  text = text.replace(/^(R:|REFRÃO:|REFRAO:|REF:)\s*/gim, '<span class="refrao-marker">R:</span> ');
  
  // Processar versos numerados (1. 2. 3. etc)
  text = text.replace(/^(\d+)\.\s+/gm, '<span class="verse-number">$1.</span> ');
  
  // Processar marcadores especiais (PR:, TODOS:, etc)
  text = text.replace(/^(PR:|AS:|TODOS:|T:|C:|A:|L:)\s*/gim, '<span class="special-marker">$1</span> ');
  
  // Converter quebras de linha para <br>
  // Dupla quebra = novo parágrafo
  text = text.split('\n\n').map(para => 
    `<p class="lyric-paragraph">${para.split('\n').join('<br>')}</p>`
  ).join('');
  
  return text;
};

// Criar HTML do folheto completo
const createBookletHTML = async (
  event: PDFEvent,
  songs: PDFSong[],
  tenant: PDFTenantInfo | undefined,
  theme: typeof pdfThemes['deep_blue_gold'],
  typeLabels: Record<string, string>,
  options: { fontSize: number; fontFamily: string },
  logoDataUrl: string | null,
  qrCodeDataUrl: string | null
): Promise<HTMLDivElement> => {
  const container = document.createElement('div');
  container.id = 'pdf-booklet-container';
  
  const fontFamilyCSS = options.fontFamily === 'times' 
    ? '"Times New Roman", Times, serif' 
    : options.fontFamily === 'courier' 
      ? '"Courier New", Courier, monospace' 
      : 'Helvetica, Arial, sans-serif';

  // Calcular cor clara do background baseada no tema
  const lightBg = `rgb(${Math.min(255, theme.primaryRgb[0] + Math.round((255 - theme.primaryRgb[0]) * 0.88))}, 
                       ${Math.min(255, theme.primaryRgb[1] + Math.round((255 - theme.primaryRgb[1]) * 0.88))}, 
                       ${Math.min(255, theme.primaryRgb[2] + Math.round((255 - theme.primaryRgb[2]) * 0.88))})`;
  
  container.innerHTML = `
    <style>
      #pdf-booklet-container {
        width: 210mm;
        min-height: 297mm;
        background: white;
        font-family: ${fontFamilyCSS};
        font-size: ${options.fontSize}pt;
        line-height: 1.3;
        color: #282832;
        box-sizing: border-box;
      }
      
      .header {
        background: ${lightBg};
        padding: 8mm 12mm;
        border-bottom: 1mm solid ${theme.primary};
        display: flex;
        align-items: center;
        gap: 8mm;
      }
      
      .header-logo {
        width: 38mm;
        height: 38mm;
        border-radius: 50%;
        object-fit: cover;
        flex-shrink: 0;
      }
      
      .header-text {
        flex: 1;
        text-align: center;
      }
      
      .header-tenant {
        font-size: 22pt;
        font-weight: bold;
        color: ${theme.primary};
        text-transform: uppercase;
        margin: 0 0 2mm 0;
      }
      
      .header-subtitle {
        font-size: 20pt;
        font-style: italic;
        color: ${theme.accent};
        margin: 0 0 2mm 0;
      }
      
      .header-event {
        font-size: 16pt;
        font-weight: bold;
        color: ${theme.primary};
        margin: 0;
      }
      
      .content {
        padding: 5mm 12mm;
        column-count: 2;
        column-gap: 8mm;
        column-fill: auto;
      }
      
      .song-section {
        break-inside: avoid-column;
        margin-bottom: 4mm;
        page-break-inside: avoid;
      }
      
      .song-type-header {
        background: ${theme.primary};
        color: white;
        padding: 1.5mm 3mm;
        font-size: ${options.fontSize + 1}pt;
        font-weight: bold;
        margin-bottom: 2mm;
        border-radius: 1mm;
        display: inline-block;
      }
      
      .song-type-number {
        background: ${theme.accent};
        color: ${theme.dark};
        padding: 0.5mm 2mm;
        border-radius: 1mm;
        margin-right: 2mm;
        font-size: ${options.fontSize}pt;
      }
      
      .lyric-paragraph {
        margin: 0 0 2mm 0;
        text-align: justify;
        hyphens: auto;
      }
      
      .refrao-block {
        margin-left: 3mm;
        font-weight: bold;
        border-left: 0.5mm solid ${theme.accent};
        padding-left: 2mm;
      }
      
      .refrao-marker {
        color: #B41E1E;
        font-weight: bold;
      }
      
      .verse-number {
        color: ${theme.primary};
        font-weight: bold;
      }
      
      .special-marker {
        color: ${theme.accent};
        font-weight: bold;
      }
      
      .qr-section {
        text-align: center;
        margin-top: 5mm;
        break-inside: avoid;
      }
      
      .qr-code {
        width: 25mm;
        height: 25mm;
      }
      
      .qr-label {
        font-size: 8pt;
        color: #666;
        margin-top: 1mm;
      }
      
      .footer {
        text-align: center;
        padding: 2mm;
        font-size: 8pt;
        color: #888;
        border-top: 0.3mm solid #ddd;
      }
    </style>
    
    <div class="header">
      ${logoDataUrl ? `<img src="${logoDataUrl}" class="header-logo" alt="Logo">` : ''}
      <div class="header-text">
        <p class="header-tenant">${tenant?.name || 'Coro Paroquial'}</p>
        <p class="header-subtitle">Subsídio Litúrgico</p>
        <p class="header-event">${event.name}</p>
      </div>
    </div>
    
    <div class="content">
      ${songs.map((song, index) => {
        const typeLabel = typeLabels[song.type] || song.type || 'Música';
        const lyricsHTML = song.lyrics ? processLyricsToHTML(song.lyrics, theme) : '';
        
        return `
          <div class="song-section">
            <div class="song-type-header">
              <span class="song-type-number">${index + 1}</span>
              ${typeLabel}
            </div>
            <div class="song-lyrics">
              ${lyricsHTML}
            </div>
          </div>
        `;
      }).join('')}
      
      ${qrCodeDataUrl ? `
        <div class="qr-section">
          <img src="${qrCodeDataUrl}" class="qr-code" alt="QR Code">
          <p class="qr-label">Acesse os áudios</p>
        </div>
      ` : ''}
    </div>
  `;
  
  return container;
};

// Função principal de exportação
export const exportSongBookletPDF = async (
  event: PDFEvent, 
  songs: PDFSong[], 
  tenant?: PDFTenantInfo, 
  options?: { fontSize?: number; fontFamily?: 'times' | 'helvetica' | 'courier' }
) => {
  const baseFontSize = options?.fontSize || 11;
  const fontFamily = options?.fontFamily || 'times';
  const typeLabels = await loadTypeLabels();
  
  // Filtrar e ordenar músicas
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

  // Selecionar tema
  const themeName = event.pdf_theme || 'deep_blue_gold';
  const theme = pdfThemes[themeName] || pdfThemes['deep_blue_gold'];

  // Carregar logo do tenant
  let logoDataUrl: string | null = null;
  if (tenant?.logo_url) {
    logoDataUrl = await loadImageRobust(tenant.logo_url);
  }

  // Gerar QR Code
  let qrCodeDataUrl: string | null = null;
  try {
    const audioPageUrl = `${window.location.origin}/events/${event.id}/audios`;
    qrCodeDataUrl = await QRCode.toDataURL(audioPageUrl, {
      width: 200,
      margin: 1,
      color: {
        dark: theme.primary,
        light: '#FFFFFF',
      },
    });
  } catch (e) {
    console.warn('Erro ao gerar QR Code:', e);
  }

  // Criar HTML do folheto
  const htmlContainer = await createBookletHTML(
    event,
    songsWithLyrics,
    tenant,
    theme,
    typeLabels,
    { fontSize: baseFontSize, fontFamily },
    logoDataUrl,
    qrCodeDataUrl
  );

  // Adicionar ao DOM temporariamente (invisível) para renderização
  htmlContainer.style.position = 'absolute';
  htmlContainer.style.left = '-9999px';
  htmlContainer.style.top = '0';
  document.body.appendChild(htmlContainer);

  try {
    // Renderizar com html2canvas
    const canvas = await html2canvas(htmlContainer, {
      scale: 2, // Alta resolução
      useCORS: true,
      logging: false,
      backgroundColor: '#FFFFFF',
      width: 794, // A4 width em pixels a 96dpi
      windowWidth: 794,
    });

    // Criar PDF
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * pageWidth) / canvas.width;
    
    // Se o conteúdo é maior que uma página, dividir em múltiplas páginas
    let yOffset = 0;
    let pageNum = 1;
    
    while (yOffset < imgHeight) {
      if (pageNum > 1) {
        pdf.addPage();
      }
      
      // Calcular a porção do canvas para esta página
      const remainingHeight = imgHeight - yOffset;
      const pageContentHeight = Math.min(pageHeight, remainingHeight);
      
      // Criar um canvas temporário para a porção atual
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = Math.ceil((pageContentHeight / imgWidth) * canvas.width);
      
      const ctx = pageCanvas.getContext('2d');
      if (ctx) {
        const sourceY = Math.ceil((yOffset / imgHeight) * canvas.height);
        const sourceHeight = Math.ceil((pageContentHeight / imgHeight) * canvas.height);
        
        ctx.drawImage(
          canvas,
          0, sourceY, canvas.width, sourceHeight,
          0, 0, pageCanvas.width, pageCanvas.height
        );
        
        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        pdf.addImage(pageImgData, 'JPEG', 0, 0, pageWidth, pageContentHeight);
      }
      
      yOffset += pageHeight;
      pageNum++;
    }

    // Adicionar número de páginas
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 3, { align: 'center' });
    }

    // Salvar PDF
    const fileName = `Letras_${event.name.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    pdf.save(fileName);
    
  } finally {
    // Remover elemento do DOM
    document.body.removeChild(htmlContainer);
  }
};

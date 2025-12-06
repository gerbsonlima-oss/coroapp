import jsPDF from 'jspdf';
import { PDFDocument, rgb } from 'pdf-lib';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import QRCode from 'qrcode';
import coroLogo from '@/assets/coro-logo.png';
import dioceseBrasao from '@/assets/diocese-brasao.png';
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
  sheet_music_url: string | null;
  sheet_music_pdf_url?: string | null;
}

const defaultTypeLabels: Record<string, string> = {
  canto_entrada: 'Canto de Entrada',
  ato_penitencial: 'Ato Penitencial (Kyrie)',
  gloria: 'Glória',
  salmo: 'Salmo Responsorial',
  aclamacao: 'Aclamação ao Evangelho (Aleluia)',
  oferendas: 'Canto das Oferendas (Ofertório)',
  santo: 'Santo',
  cordeiro: 'Cordeiro de Deus',
  comunhao: 'Canto da Comunhão',
  acao_gracas: 'Canto de Ação de Graças',
  final: 'Canto Final (ou de Envio)',
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

const fetchPdfAsArrayBuffer = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch PDF: ${response.statusText}`);
  return response.arrayBuffer();
};

const loadTypeLabels = async (): Promise<Record<string, string>> => {
  try {
    const { data, error } = await supabase
      .from('song_types')
      .select('slug, name');

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

export const exportEventPDF = async (event: Event, songs: Song[]) => {
  await exportWithPdfConcatenation(event, songs);
};

const exportWithPdfConcatenation = async (event: Event, songs: Song[]) => {
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
  // PÁGINA 1: CAPA PROFISSIONAL
  // ============================================

  
  // ============================================
  // PÁGINA 1: CAPA PROFISSIONAL
  // ============================================
  const coverPdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = coverPdf.internal.pageSize.getWidth();
  const pageHeight = coverPdf.internal.pageSize.getHeight();
  const margin = 20;

  // Imagem de fundo da capa (se disponível)
  if (event.cover_image_url) {
    try {
      const coverImg = await loadImage(event.cover_image_url);
      coverPdf.addImage(coverImg, 'JPEG', 0, 0, pageWidth, pageHeight);
      
      coverPdf.setFillColor(...overlayColor);
      coverPdf.setGState({ opacity: 0.6 } as any);
      coverPdf.rect(0, 0, pageWidth, pageHeight, 'F');
      coverPdf.setGState({ opacity: 1 } as any);
    } catch (error) {
      console.error('Erro ao carregar imagem de capa:', error);
      coverPdf.setFillColor(...primaryColor);
      coverPdf.rect(0, 0, pageWidth, pageHeight, 'F');
    }
  } else {
    // Fundo azul sólido
    coverPdf.setFillColor(...primaryColor);
    coverPdf.rect(0, 0, pageWidth, pageHeight, 'F');
  }

  // ÁREA RESERVADA PARA LOGO: ocupa todo o centro disponível (15-165mm do topo)
  const logoAreaTop = 15;
  const logoAreaBottom = 165;
  const logoAreaHeight = logoAreaBottom - logoAreaTop;
  
  try {
    const logoImg = await loadImage(coroLogo);
    const maxLogoWidth = pageWidth - 20; // Praticamente a largura total da página (190mm)
    const maxLogoHeight = logoAreaHeight;
    
    // Calcular dimensões mantendo proporção
    let logoWidth = maxLogoWidth;
    let logoHeight = (logoImg.height / logoImg.width) * logoWidth;
    
    // Se altura exceder área, redimensionar pela altura
    if (logoHeight > maxLogoHeight) {
      logoHeight = maxLogoHeight;
      logoWidth = (logoImg.width / logoImg.height) * logoHeight;
    }
    
    const logoX = (pageWidth - logoWidth) / 2;
    const logoY = logoAreaTop + (logoAreaHeight - logoHeight) / 2;
    coverPdf.addImage(logoImg, 'PNG', logoX, logoY, logoWidth, logoHeight);
  } catch (error) {
    console.error('Erro ao carregar logo:', error);
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
    titleY += fontSize * 0.35;
  });

  // Linha decorativa (logo abaixo da área do título)
  const decorativeLineY = titleAreaBottom + 2;
  coverPdf.setDrawColor(...accentColor);
  coverPdf.setLineWidth(0.5);
  coverPdf.line(40, decorativeLineY, pageWidth - 40, decorativeLineY);

  // Subtítulo
  coverPdf.setFontSize(20);
  coverPdf.setFont('times', 'italic');
  const subtitle = 'Partituras - Roteiro Litúrgico';
  const subtitleWidth = coverPdf.getTextWidth(subtitle);
  coverPdf.text(subtitle, (pageWidth - subtitleWidth) / 2, decorativeLineY + 10);

  // Data e Local no rodapé da página
  const footerY = pageHeight - 30;
  coverPdf.setFontSize(15);
  coverPdf.setFont('times', 'normal');
  const formattedDate = format(new Date(event.date), "dd 'de' MMMM, yyyy", { locale: ptBR });
  const dateWidth = coverPdf.getTextWidth(formattedDate);
  coverPdf.text(formattedDate, (pageWidth - dateWidth) / 2, footerY);

  if (event.location) {
    const locationWidth = coverPdf.getTextWidth(event.location);
    coverPdf.text(event.location, (pageWidth - locationWidth) / 2, footerY + 10);
  }

  
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

  // Estrutura por tipo continua sendo usada para a concatenação das partituras
  const songsByType: Record<string, Song[]> = {};
  indexSongs.forEach((song) => {
    const type = song.type || 'outro';
    if (!songsByType[type]) {
      songsByType[type] = [];
    }
    songsByType[type].push(song);
  });

  const sortedTypes = Object.keys(songsByType).sort((a, b) => {
    const orderA = liturgicalOrder[a] ?? 999;
    const orderB = liturgicalOrder[b] ?? 999;
    return orderA - orderB;
  });
  
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
    const typeLabel = typeLabels[song.type] || song.type || 'Outro';
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
    const eventUrl = `${window.location.origin}/public/events/${event.id}`;
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
  for (const type of sortedTypes) {
    const typeSongs = songsByType[type];
    
    for (const song of typeSongs) {
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
  }

  // Adicionar numeração de páginas (exceto capa)
  const pages = finalPdf.getPages();
  const totalPages = pages.length;

  pages.forEach((page, index) => {
    if (index === 0) return; // não numerar a capa

    const { width } = page.getSize();
    const fontSize = 10;
    const text = `${index} / ${totalPages - 1}`;

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
  const fileName = `Partituras_${event.name.replace(/[^a-z0-9]/gi, '_')}_${format(new Date(event.date), 'yyyy-MM-dd')}.pdf`;
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
      
      pdf.setFillColor(...overlayColor);
      pdf.setGState({ opacity: 0.6 } as any);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
      pdf.setGState({ opacity: 1 } as any);
    } catch (error) {
      console.error('Erro ao carregar imagem de capa:', error);
      pdf.setFillColor(...primaryColor);
      pdf.rect(0, 0, pageWidth, pageHeight, 'F');
    }
  } else {
    pdf.setFillColor(...primaryColor);
    pdf.rect(0, 0, pageWidth, pageHeight, 'F');
  }

  try {
    const logoImg = await loadImage(coroLogo);
    const logoWidth = 60;
    const logoHeight = (logoImg.height / logoImg.width) * logoWidth;
    const logoX = (pageWidth - logoWidth) / 2;
    pdf.addImage(logoImg, 'PNG', logoX, 30, logoWidth, logoHeight);
  } catch (error) {
    console.error('Erro ao carregar logo:', error);
  }

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
  const formattedDate = format(new Date(event.date), "dd 'de' MMMM, yyyy", { locale: ptBR });
  const dateWidth = pdf.getTextWidth(formattedDate);
  pdf.text(formattedDate, (pageWidth - dateWidth) / 2, titleY + 35);

  if (event.location) {
    const locationWidth = pdf.getTextWidth(event.location);
    pdf.text(event.location, (pageWidth - locationWidth) / 2, titleY + 48);
  }

  try {
    const brasaoImg = await loadImage(dioceseBrasao);
    const brasaoWidth = 50;
    const brasaoHeight = (brasaoImg.height / brasaoImg.width) * brasaoWidth;
    const brasaoX = (pageWidth - brasaoWidth) / 2;
    pdf.addImage(brasaoImg, 'PNG', brasaoX, pageHeight - 60, brasaoWidth, brasaoHeight);
  } catch (error) {
    console.error('Erro ao carregar brasão:', error);
  }

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
    
    const footerText = `${event.name} • ${format(new Date(event.date), "dd/MM/yyyy")}`;
    const footerWidth = pdf.getTextWidth(footerText);
    pdf.text(footerText, (pageWidth - footerWidth) / 2, pageHeight - 10);
    
    if (i > 1) {
      pdf.text(`${i - 1}`, pageWidth - margin, pageHeight - 10);
    }
  }

  const fileName = `Partituras_${event.name.replace(/[^a-z0-9]/gi, '_')}_${format(new Date(event.date), 'yyyy-MM-dd')}.pdf`;
  pdf.save(fileName);
};
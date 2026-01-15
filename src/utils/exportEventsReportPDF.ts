import jsPDF from 'jspdf';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import liturgiaLogo from '@/assets/liturgia-plus-logo.png';
import { supabase } from '@/integrations/supabase/client';

interface EventWithSongs {
  id: string;
  name: string;
  date: string;
  location: string | null;
  songs: Array<{
    id: string;
    name: string;
    type: string;
    typeName: string;
  }>;
}

const loadImage = (url: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
};

const fetchTypeLabels = async (): Promise<Record<string, string>> => {
  const { data } = await supabase
    .from('song_types')
    .select('slug, name');
  
  const labels: Record<string, string> = {};
  if (data) {
    data.forEach(type => {
      labels[type.slug] = type.name;
    });
  }
  return labels;
};

const fetchEventsForMonth = async (tenantId: string, yearMonth: string): Promise<EventWithSongs[]> => {
  const [year, month] = yearMonth.split('-').map(Number);
  const startDate = startOfMonth(new Date(year, month - 1));
  const endDate = endOfMonth(new Date(year, month - 1));

  const { data: eventsData, error: eventsError } = await supabase
    .from('events')
    .select('id, name, date, location')
    .eq('tenant_id', tenantId)
    .gte('date', format(startDate, 'yyyy-MM-dd'))
    .lte('date', format(endDate, 'yyyy-MM-dd'))
    .order('date', { ascending: true });

  if (eventsError) throw eventsError;

  const eventsWithSongs: EventWithSongs[] = [];

  for (const event of eventsData || []) {
    const { data: songsData } = await supabase
      .from('event_songs')
      .select('id, songs(id, name, type)')
      .eq('event_id', event.id)
      .order('order_index', { ascending: true });

    const songs = songsData?.map(es => ({
      id: es.songs?.id || '',
      name: es.songs?.name || '',
      type: es.songs?.type || '',
      typeName: ''
    })).filter(s => s.id) || [];

    eventsWithSongs.push({
      ...event,
      songs
    });
  }

  return eventsWithSongs;
};

export const exportEventsReportPDF = async (
  tenantId: string,
  tenantSlug: string | null,
  tenantName: string | null,
  selectedMonth: string
) => {
  const events = await fetchEventsForMonth(tenantId, selectedMonth);
  const typeLabels = await fetchTypeLabels();
  
  if (events.length === 0) {
    throw new Error('Nenhum evento encontrado para este mês');
  }

  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;

  // Cores
  const primaryColor: [number, number, number] = [25, 55, 109];
  const accentColor: [number, number, number] = [218, 165, 32];
  const textColor: [number, number, number] = [51, 51, 51];
  const whiteColor: [number, number, number] = [255, 255, 255];
  const overlayColor: [number, number, number] = [0, 0, 0];

  const [year, month] = selectedMonth.split('-').map(Number);
  const monthLabel = format(new Date(year, month - 1), 'MMMM yyyy', { locale: ptBR });
  const monthLabelCapitalized = monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1);

  // ============================================
  // PÁGINA 1: CAPA PROFISSIONAL
  // ============================================
  
  // Fundo primário sólido
  pdf.setFillColor(...primaryColor);
  pdf.rect(0, 0, pageWidth, pageHeight, 'F');

  // ÁREA RESERVADA PARA LOGO: ocupa o centro superior
  const logoAreaTop = 15;
  const logoAreaBottom = 165;
  const logoAreaHeight = logoAreaBottom - logoAreaTop;
  
  try {
    const logoImg = await loadImage(liturgiaLogo);
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
    pdf.addImage(logoImg, 'PNG', logoX, logoY, logoWidth, logoHeight);
  } catch (error) {
    console.error('Erro ao carregar logo:', error);
  }

  // ÁREA RESERVADA PARA TÍTULO
  const titleAreaTop = 168;
  const titleAreaBottom = 208;
  const titleMaxWidth = pageWidth - 40;
  
  // Título principal
  let fontSize = 42;
  pdf.setFont('times', 'bold');
  pdf.setFontSize(fontSize);
  pdf.setTextColor(...whiteColor);
  
  const title = 'Planejamento Litúrgico';
  const titleWidth = pdf.getTextWidth(title);
  const titleY = titleAreaTop + 15;
  pdf.text(title, (pageWidth - titleWidth) / 2, titleY);

  // Linha decorativa
  const decorativeLineY = titleY + 8;
  pdf.setDrawColor(...accentColor);
  pdf.setLineWidth(0.5);
  pdf.line(40, decorativeLineY, pageWidth - 40, decorativeLineY);

  // Subtítulo (mês/ano)
  pdf.setFontSize(28);
  pdf.setFont('times', 'italic');
  const subtitleWidth = pdf.getTextWidth(monthLabelCapitalized);
  pdf.text(monthLabelCapitalized, (pageWidth - subtitleWidth) / 2, decorativeLineY + 15);

  // Informações do rodapé da capa
  const footerY = pageHeight - 30;
  pdf.setFontSize(14);
  pdf.setFont('times', 'normal');
  
  if (tenantName) {
    const tenantWidth = pdf.getTextWidth(tenantName);
    pdf.text(tenantName, (pageWidth - tenantWidth) / 2, footerY);
  }

  // Estatísticas
  const totalSongs = events.reduce((acc, e) => acc + e.songs.length, 0);
  const statsText = `${events.length} evento${events.length !== 1 ? 's' : ''} • ${totalSongs} música${totalSongs !== 1 ? 's' : ''}`;
  pdf.setFontSize(12);
  pdf.setTextColor(200, 200, 220);
  const statsWidth = pdf.getTextWidth(statsText);
  pdf.text(statsText, (pageWidth - statsWidth) / 2, footerY + 10);

  // ============================================
  // PÁGINA 2+: LISTA DE EVENTOS
  // ============================================
  pdf.addPage();

  // Cabeçalho da página de conteúdo
  pdf.setFillColor(...primaryColor);
  pdf.rect(0, 0, pageWidth, 30, 'F');
  
  pdf.setFontSize(18);
  pdf.setTextColor(...whiteColor);
  pdf.setFont('helvetica', 'bold');
  const headerTitle = `Planejamento Litúrgico - ${monthLabelCapitalized}`;
  const headerTitleWidth = pdf.getTextWidth(headerTitle);
  pdf.text(headerTitle, (pageWidth - headerTitleWidth) / 2, 20);

  // Linha decorativa abaixo do cabeçalho
  pdf.setDrawColor(...accentColor);
  pdf.setLineWidth(0.5);
  pdf.line(margin, 32, pageWidth - margin, 32);

  let y = 45;
  const rowHeight = 8;

  events.forEach((event, eventIndex) => {
    // Verificar se precisa de nova página
    const estimatedHeight = 25 + (event.songs.length * rowHeight);
    if (y + estimatedHeight > pageHeight - 25) {
      pdf.addPage();
      y = 25;
    }

    // Cabeçalho do Evento - Faixa Colorida
    pdf.setFillColor(248, 249, 252);
    pdf.rect(margin, y - 8, pageWidth - (margin * 2), 16, 'F');
    
    // Borda lateral esquerda colorida para destaque
    pdf.setFillColor(...primaryColor);
    pdf.rect(margin, y - 8, 2, 16, 'F');
    
    // Nome do evento
    pdf.setFontSize(12);
    pdf.setTextColor(...primaryColor);
    pdf.setFont('helvetica', 'bold');
    const eventNameTruncated = event.name.length > 45 ? event.name.substring(0, 42) + '...' : event.name;
    pdf.text(eventNameTruncated, margin + 6, y - 1);
    
    // Data e Local
    pdf.setFontSize(9);
    pdf.setTextColor(100, 100, 100);
    pdf.setFont('helvetica', 'normal');
    const eventDate = format(new Date(event.date), "dd 'de' MMMM", { locale: ptBR });
    const eventInfo = event.location ? `${eventDate} • ${event.location}` : eventDate;
    pdf.text(eventInfo, margin + 6, y + 5);

    // Contador de músicas
    pdf.setFontSize(8);
    pdf.setTextColor(...primaryColor);
    const songsCount = `${event.songs.length} ${event.songs.length === 1 ? 'música' : 'músicas'}`;
    pdf.text(songsCount, pageWidth - margin - 5, y + 2, { align: 'right' });

    // Link para o evento no app
    const baseUrl = window.location.origin;
    const eventUrl = tenantSlug 
      ? `${baseUrl}/${tenantSlug}/events/${event.id}`
      : `${baseUrl}/events/${event.id}`;
    pdf.link(margin, y - 8, pageWidth - (margin * 2), 16, { url: eventUrl });

    y += 14;

    // Lista de músicas do evento
    event.songs.forEach((song) => {
      // Nova página se necessário
      if (y > pageHeight - 20) {
        pdf.addPage();
        y = 25;
      }

      pdf.setFontSize(9);
      pdf.setTextColor(...textColor);
      pdf.setFont('helvetica', 'normal');
      
      // Tipo da música
      const typeLabel = typeLabels[song.type] || song.type || 'Outro';
      const shortType = typeLabel.length > 12 ? typeLabel.substring(0, 10) + '..' : typeLabel;
      
      pdf.setTextColor(120, 120, 120);
      pdf.setFontSize(7);
      pdf.text(shortType.toUpperCase(), margin + 6, y);
      
      // Nome da música
      pdf.setTextColor(...textColor);
      pdf.setFontSize(9);
      const songNameTruncated = song.name.length > 55 ? song.name.substring(0, 52) + '...' : song.name;
      pdf.text(songNameTruncated, margin + 35, y);

      // Botão "VER"
      const btnText = 'VER';
      const btnWidth = 12;
      pdf.setFillColor(245, 247, 250);
      pdf.roundedRect(pageWidth - margin - btnWidth - 3, y - 4, btnWidth + 3, 6, 1, 1, 'F');
      
      pdf.setTextColor(...primaryColor);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(6);
      pdf.text(btnText, pageWidth - margin - (btnWidth / 2) - 1.5, y - 0.5, { align: 'center' });

      // Link para a música
      const songUrl = tenantSlug 
        ? `${baseUrl}/${tenantSlug}/songs/${song.id}`
        : `${baseUrl}/songs/${song.id}`;
      pdf.link(margin, y - 5, pageWidth - (margin * 2), rowHeight, { url: songUrl });

      y += rowHeight;
    });

    // Se não tem músicas
    if (event.songs.length === 0) {
      pdf.setFontSize(8);
      pdf.setTextColor(150, 150, 150);
      pdf.setFont('helvetica', 'italic');
      pdf.text('Nenhuma música cadastrada', margin + 6, y);
      y += rowHeight;
    }

    // Linha separadora entre eventos
    if (eventIndex < events.length - 1) {
      y += 4;
      pdf.setDrawColor(230, 230, 230);
      pdf.setLineWidth(0.2);
      pdf.line(margin, y, pageWidth - margin, y);
      y += 8;
    }
  });

  // Rodapé com numeração (a partir da página 2)
  const totalPages = pdf.getNumberOfPages();
  for (let i = 2; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Página ${i - 1} de ${totalPages - 1}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  const monthFileName = format(new Date(year, month - 1), 'MMMM_yyyy', { locale: ptBR });
  const fileName = `Planejamento_Liturgico_${monthFileName}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  pdf.save(fileName);
};

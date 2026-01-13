import jsPDF from 'jspdf';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import coroLogo from '@/assets/coro-logo.png';
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

  // ============================================
  // CABEÇALHO EDITORIAL
  // ============================================
  pdf.setFillColor(...primaryColor);
  pdf.rect(0, 0, pageWidth, 55, 'F');

  try {
    const logoImg = await loadImage(coroLogo);
    const logoHeight = 35;
    const logoWidth = (logoImg.width / logoImg.height) * logoHeight;
    pdf.addImage(logoImg, 'PNG', margin, 10, logoWidth, logoHeight);
  } catch (error) {
    console.error('Erro ao carregar logo no PDF:', error);
  }

  // Título e Mês
  pdf.setTextColor(...whiteColor);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(26);
  pdf.text('Relatório de Eventos', pageWidth - margin, 22, { align: 'right' });
  
  const monthLabel = format(new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1), 'MMMM yyyy', { locale: ptBR });
  pdf.setFontSize(16);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(200, 200, 220);
  pdf.text(monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1), pageWidth - margin, 30, { align: 'right' });

  if (tenantName) {
    pdf.setFontSize(12);
    pdf.text(tenantName, pageWidth - margin, 38, { align: 'right' });
  }

  // Linha decorativa no header
  pdf.setDrawColor(255, 255, 255);
  pdf.setLineWidth(0.3);
  pdf.line(pageWidth - 100, 42, pageWidth - margin, 42);

  pdf.setFontSize(8);
  pdf.setTextColor(180, 180, 200);
  const dateStr = `Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
  pdf.text(dateStr, pageWidth - margin, 48, { align: 'right' });

  // ============================================
  // LISTA DE EVENTOS
  // ============================================
  let y = 65;
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
    const eventNameMaxWidth = pageWidth - (margin * 2) - 60;
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
    event.songs.forEach((song, songIndex) => {
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
      const songNameMaxWidth = pageWidth - (margin * 2) - 40;
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

  // Rodapé com numeração
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  const monthFileName = format(new Date(parseInt(selectedMonth.split('-')[0]), parseInt(selectedMonth.split('-')[1]) - 1), 'MMMM_yyyy', { locale: ptBR });
  const fileName = `Relatorio_Eventos_${monthFileName}_${format(new Date(), 'yyyyMMdd')}.pdf`;
  pdf.save(fileName);
};

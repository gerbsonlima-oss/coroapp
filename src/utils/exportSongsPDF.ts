import jsPDF from 'jspdf';
import { format } from 'date-fns';
import coroLogo from '@/assets/coro-logo.png';

interface Song {
  id: string;
  name: string;
  type: string;
  typeName: string;
}

// Ordem litúrgica dos cantos
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

export const exportSongsPDF = async (songs: Song[], tenantSlug: string | null, tenantName: string | null) => {
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

  // Título e Organização
  pdf.setTextColor(...whiteColor);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(26);
  pdf.text('Catálogo de Músicas', pageWidth - margin, 22, { align: 'right' });
  
  if (tenantName) {
    pdf.setFontSize(16);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(200, 200, 220);
    pdf.text(tenantName, pageWidth - margin, 30, { align: 'right' });
  }

  // Linha decorativa no header
  pdf.setDrawColor(255, 255, 255, 0.2);
  pdf.setLineWidth(0.3);
  pdf.line(pageWidth - 80, 34, pageWidth - margin, 34);

  pdf.setFontSize(8);
  pdf.setTextColor(180, 180, 200);
  const dateStr = `Gerado em ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
  pdf.text(dateStr, pageWidth - margin, 39, { align: 'right' });

  // ============================================
  // LISTA DE MÚSICAS (ESTILO CARDS)
  // ============================================
  let y = 65;
  const rowHeight = 12;

  // Agrupar músicas por tipo
  const songsByType: Record<string, { name: string; songs: Song[] }> = {};
  songs.forEach(song => {
    if (!songsByType[song.type]) {
      songsByType[song.type] = {
        name: song.typeName,
        songs: []
      };
    }
    songsByType[song.type].songs.push(song);
  });

  // Ordenar tipos conforme configuração litúrgica
  const sortedTypeSlugs = Object.keys(songsByType).sort((a, b) => {
    const orderA = liturgicalOrder[a] || 999;
    const orderB = liturgicalOrder[b] || 999;
    return orderA - orderB;
  });

  sortedTypeSlugs.forEach((slug) => {
    const group = songsByType[slug];
    const typeName = group.name;
    const typeSongs = group.songs.sort((a, b) => a.name.localeCompare(b.name));

    // Verificar se precisa de nova página para o cabeçalho do grupo
    if (y > pageHeight - 30) {
      pdf.addPage();
      y = 20;
    }

    // Cabeçalho do Grupo (Tipo de Música) - Faixa Colorida
    pdf.setFillColor(248, 249, 252);
    pdf.rect(margin, y - 8, pageWidth - (margin * 2), 12, 'F');
    
    // Borda lateral esquerda colorida para destaque
    pdf.setFillColor(...primaryColor);
    pdf.rect(margin, y - 8, 2, 12, 'F');
    
    pdf.setFontSize(11);
    pdf.setTextColor(...primaryColor);
    pdf.setFont('helvetica', 'bold');
    pdf.text(typeName.toUpperCase(), margin + 5, y);
    
    pdf.setFontSize(9);
    pdf.setTextColor(150, 150, 150);
    const countText = `${typeSongs.length} ${typeSongs.length === 1 ? 'música' : 'músicas'}`;
    pdf.text(countText, pageWidth - margin - 5, y, { align: 'right' });

    y += 12;

    typeSongs.forEach((song, index) => {
      // Nova página se necessário
      if (y > pageHeight - 25) {
        pdf.addPage();
        y = 30;
      }

      // Estilo da linha
      pdf.setFontSize(10);
      pdf.setTextColor(...textColor);
      pdf.setFont('helvetica', 'normal');
      
      const baseUrl = window.location.origin;
      const songUrl = tenantSlug 
        ? `${baseUrl}/${tenantSlug}/songs/${song.id}`
        : `${baseUrl}/songs/${song.id}`;
      
      // Nome da música (Destaque)
      const nameMaxWidth = pageWidth - (margin * 2) - 45;
      const truncatedName = song.name.length > 75 ? song.name.substring(0, 72) + '...' : song.name;
      pdf.text(truncatedName, margin + 8, y);

      // Botão "VER NO APP" (Estilizado como botão sutil)
      const btnText = 'VER NO APP';
      const btnWidth = 25;
      pdf.setFillColor(245, 247, 250);
      pdf.roundedRect(pageWidth - margin - btnWidth - 5, y - 5, btnWidth + 5, 8, 1, 1, 'F');
      
      pdf.setTextColor(...primaryColor);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7);
      pdf.text(btnText, pageWidth - margin - (btnWidth / 2) - 2.5, y + 0.5, { align: 'center' });
      
      // Área clicável em toda a linha
      pdf.link(margin, y - 6, pageWidth - (margin * 2), rowHeight, { url: songUrl });

      y += 10;
      
      // Linha separadora discreta
      pdf.setDrawColor(245, 245, 245);
      pdf.setLineWidth(0.1);
      pdf.line(margin + 8, y - 2, pageWidth - margin - 5, y - 2);
    });

    y += 4; // Espaço entre grupos
  });

  // Rodapé com numeração
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`Página ${i} de ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: 'center' });
  }

  const fileName = `Catalogo_Musicas_${format(new Date(), 'yyyyMMdd')}.pdf`;
  pdf.save(fileName);
};
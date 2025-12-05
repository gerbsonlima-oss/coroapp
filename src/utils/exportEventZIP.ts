import JSZip from 'jszip';
import { toast } from 'sonner';

interface Track {
  id: string;
  songId: string;
  songName: string;
  songType: string;
  naipe: string;
  url: string;
}

const typeLabels: Record<string, string> = {
  canto_entrada: 'Canto de Entrada',
  ato_penitencial: 'Ato Penitencial',
  gloria: 'Glória',
  salmo: 'Salmo Responsorial',
  aclamacao: 'Aclamação ao Evangelho',
  oferendas: 'Canto das Oferendas',
  santo: 'Santo',
  cordeiro: 'Cordeiro de Deus',
  comunhao: 'Canto da Comunhão',
  acao_gracas: 'Canto de Ação de Graças',
  final: 'Canto Final',
  outro: 'Outro',
};

export async function exportEventZIP(
  eventName: string,
  tracks: Track[],
  selectedNaipe: string
) {
  try {
    const zip = new JSZip();
    
    // Grupo de tracks por tipo
    const tracksByType: Record<string, Track[]> = {};
    tracks.forEach(track => {
      if (!tracksByType[track.songType]) {
        tracksByType[track.songType] = [];
      }
      tracksByType[track.songType].push(track);
    });

    // Ordem litúrgica
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

    // Ordenar tipos
    const sortedTypes = Object.keys(tracksByType).sort((a, b) => {
      const orderA = liturgicalOrder[a] ?? 999;
      const orderB = liturgicalOrder[b] ?? 999;
      return orderA - orderB;
    });

    let sequentialNumber = 1;

    // Processar cada tipo em ordem
    for (const type of sortedTypes) {
      const typeTracks = tracksByType[type];
      
      for (const track of typeTracks) {
        try {
          // Baixar o áudio
          const response = await fetch(track.url);
          if (!response.ok) {
            console.error(`Erro ao baixar ${track.url}`);
            continue;
          }
          
          const blob = await response.blob();
          
          // Formatar o nome do arquivo
          const typeLabel = typeLabels[track.songType] || track.songType;
          const naipeCapitalized = track.naipe.charAt(0).toUpperCase() + track.naipe.slice(1);
          const paddedNumber = String(sequentialNumber).padStart(2, '0');
          
          // Nome: "01 Canto de Entrada - Nós somos as pedras vivas - Tenor"
          const fileName = `${paddedNumber} ${typeLabel} - ${track.songName} - ${naipeCapitalized}.mp3`;
          
          // Adicionar ao ZIP
          zip.file(fileName, blob);
          
          sequentialNumber++;
        } catch (error) {
          console.error(`Erro ao processar track ${track.id}:`, error);
        }
      }
    }

    // Nome do ZIP: "Nome do evento - Filtro aplicado (nome do naipe ou todos)"
    const filterLabel = selectedNaipe === 'all' 
      ? 'Todos' 
      : selectedNaipe.charAt(0).toUpperCase() + selectedNaipe.slice(1);
    const zipFileName = `${eventName} - ${filterLabel}.zip`;

    // Gerar e baixar o ZIP
    const content = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(content);
    const link = document.createElement('a');
    link.href = url;
    link.download = zipFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(`ZIP exportado com ${sequentialNumber - 1} áudios!`);
  } catch (error) {
    console.error('Erro ao exportar ZIP:', error);
    toast.error('Erro ao exportar ZIP');
  }
}

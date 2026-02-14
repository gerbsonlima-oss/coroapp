import JSZip from 'jszip';
import { toast } from 'sonner';
import { generateSongTypeLabelsWithNumerals } from './songTypeLabeling';

interface Track {
  id: string;
  songId: string;
  songName: string;
  songType: string;
  naipe: string;
  url: string;
}

import { typeLabels } from '@/constants/songTypes';

export async function exportEventZIP(
  eventName: string,
  tracks: Track[],
  selectedNaipe: string
) {
  try {
    const zip = new JSZip();
    
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

    // Ordenar tracks por ordem litúrgica mantendo a ordem original dentro de cada tipo
    const sortedTracks = [...tracks].sort((a, b) => {
      const orderA = liturgicalOrder[a.songType] ?? 999;
      const orderB = liturgicalOrder[b.songType] ?? 999;
      return orderA - orderB;
    });

    // Gerar labels com numerais romanos para tipos repetidos (ex: Comunhão I, Comunhão II)
    // Precisamos criar um array de "songs" a partir das tracks únicas por songId
    const uniqueSongsMap = new Map<string, { id: string; type: string }>();
    sortedTracks.forEach(track => {
      if (!uniqueSongsMap.has(track.songId)) {
        uniqueSongsMap.set(track.songId, { id: track.songId, type: track.songType });
      }
    });
    const uniqueSongs = Array.from(uniqueSongsMap.values());
    const songTypeLabelMap = generateSongTypeLabelsWithNumerals(uniqueSongs, typeLabels);

    let sequentialNumber = 1;

    // Processar cada track em ordem
    for (const track of sortedTracks) {
      try {
        // Baixar o áudio
        const response = await fetch(track.url);
        if (!response.ok) {
          console.error(`Erro ao baixar ${track.url}`);
          continue;
        }
        
        const blob = await response.blob();
        
        // Formatar o nome do arquivo com numeral romano se aplicável
        const typeLabel = songTypeLabelMap[track.songId] || typeLabels[track.songType] || track.songType;
        const naipeCapitalized = track.naipe.charAt(0).toUpperCase() + track.naipe.slice(1);
        const paddedNumber = String(sequentialNumber).padStart(2, '0');
        
        // Nome: "01 Comunhão I - Nós somos as pedras vivas - Tenor"
        const fileName = `${paddedNumber} ${typeLabel} - ${track.songName} - ${naipeCapitalized}.mp3`;
        
        // Adicionar ao ZIP
        zip.file(fileName, blob);
        
        sequentialNumber++;
      } catch (error) {
        console.error(`Erro ao processar track ${track.id}:`, error);
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

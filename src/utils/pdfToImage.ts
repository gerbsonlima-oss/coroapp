import * as pdfjsLib from 'pdfjs-dist';

// Cria um Worker dedicado do PDF.js (compatível com Vite)
const pdfWorker = new Worker(
  new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
  { type: 'module' }
);
// Usa o worker dedicado em vez do fake worker
// @ts-ignore - tipos de pdfjs podem não expor workerPort
(pdfjsLib as any).GlobalWorkerOptions.workerPort = pdfWorker;

export interface ConvertedPage {
  pageNumber: number;
  blob: Blob;
  dataUrl: string;
}

export const convertPdfToImages = async (
  file: File,
  onProgress?: (current: number, total: number) => void
): Promise<ConvertedPage[]> => {
  try {
    // Carrega o PDF
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const totalPages = pdf.numPages;
    const convertedPages: ConvertedPage[] = [];
    
    // Converte cada página
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      
      // Define escala para boa qualidade (2x = 144 DPI)
      const scale = 2;
      const viewport = page.getViewport({ scale });
      
      // Cria canvas
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) {
        throw new Error('Não foi possível criar contexto do canvas');
      }
      
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      
      // Renderiza a página no canvas
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
      };
      
      await page.render(renderContext as any).promise;
      
      // Converte canvas para blob
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Falha ao converter canvas para blob'));
          }
        }, 'image/jpeg', 0.92);
      });
      
      // Cria data URL para preview
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      
      convertedPages.push({
        pageNumber: pageNum,
        blob,
        dataUrl,
      });
      
      // Callback de progresso
      if (onProgress) {
        onProgress(pageNum, totalPages);
      }
    }
    
    return convertedPages;
  } catch (error) {
    console.error('Erro ao converter PDF:', error);
    throw new Error('Falha ao converter PDF para imagens');
  }
};

export const createCombinedImage = async (pages: ConvertedPage[]): Promise<Blob> => {
  if (pages.length === 0) {
    throw new Error('Nenhuma página para combinar');
  }
  
  // Carrega todas as imagens
  const images = await Promise.all(
    pages.map(page => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = page.dataUrl;
      });
    })
  );
  
  // Calcula dimensões do canvas combinado
  const maxWidth = Math.max(...images.map(img => img.width));
  const totalHeight = images.reduce((sum, img) => sum + img.height, 0);
  
  // Cria canvas combinado
  const canvas = document.createElement('canvas');
  canvas.width = maxWidth;
  canvas.height = totalHeight;
  
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Não foi possível criar contexto do canvas');
  }
  
  // Desenha todas as páginas verticalmente
  let currentY = 0;
  for (const img of images) {
    context.drawImage(img, 0, currentY);
    currentY += img.height;
  }
  
  // Converte para blob
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Falha ao criar imagem combinada'));
      }
    }, 'image/jpeg', 0.92);
  });
};

import { PDFDocument } from 'pdf-lib';

interface PDFCompressionOptions {
  removeMetadata?: boolean;
  removeImages?: boolean;
}

export async function compressPDF(
  file: File,
  options: PDFCompressionOptions = {}
): Promise<File> {
  const {
    removeMetadata = true,
    removeImages = false,
  } = options;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    if (removeMetadata) {
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('');
      pdfDoc.setCreator('');
    }

    const pages = pdfDoc.getPages();
    
    if (removeImages) {
      for (const page of pages) {
        const resources = page.node.Resources;
        if (resources && resources.XObject) {
          const xObjects = resources.XObject.asDictionary();
          const keys = xObjects.keys();
          
          for (const key of keys) {
            xObjects.set(key, undefined);
          }
        }
      }
    }

    const compressedPdfBytes = await pdfDoc.save({
      useObjectStreams: true,
    });

    const originalSize = file.size;
    const compressedSize = compressedPdfBytes.length;
    const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

    console.log(
      `PDF compressed: ${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedSize / 1024 / 1024).toFixed(2)}MB (${compressionRatio}% reduction)`
    );

    const compressedBlob = new Blob([compressedPdfBytes], { type: 'application/pdf' });
    const compressedFile = new File(
      [compressedBlob],
      file.name,
      { type: 'application/pdf' }
    );

    return compressedFile;
  } catch (error) {
    console.error('Erro ao comprimir PDF:', error);
    throw new Error('Erro ao comprimir PDF');
  }
}

export function getPDFCompressionInfo(
  originalSize: number,
  compressedSize: number
): {
  originalSizeMB: string;
  compressedSizeMB: string;
  compressionRatio: string;
} {
  const originalMB = (originalSize / 1024 / 1024).toFixed(2);
  const compressedMB = (compressedSize / 1024 / 1024).toFixed(2);
  const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

  return {
    originalSizeMB: originalMB,
    compressedMB: compressedMB,
    compressionRatio: ratio,
  };
}

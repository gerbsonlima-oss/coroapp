interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
}

const DEFAULT_MAX_WIDTH = 1920;
const DEFAULT_MAX_HEIGHT = 1080;
const DEFAULT_QUALITY = 0.8;

export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<File> {
  const maxWidth = options.maxWidth || DEFAULT_MAX_WIDTH;
  const maxHeight = options.maxHeight || DEFAULT_MAX_HEIGHT;
  const quality = options.quality || DEFAULT_QUALITY;

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Erro ao obter contexto do canvas'));
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);

          canvas.toBlob(
            (blob) => {
              if (!blob) {
                reject(new Error('Erro ao comprimir imagem'));
                return;
              }

              const originalSize = file.size;
              const compressedSize = blob.size;
              const compressionRatio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

              console.log(
                `Image compressed: ${(originalSize / 1024).toFixed(2)}KB → ${(compressedSize / 1024).toFixed(2)}KB (${compressionRatio}% reduction)`
              );

              const extension = file.name.split('.').pop() || 'jpg';
              const compressedFile = new File(
                [blob],
                file.name.replace(/\.[^.]+$/, `.${extension}`),
                { type: blob.type }
              );

              resolve(compressedFile);
            },
            getMimeType(file.type),
            quality
          );
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        reject(new Error('Erro ao carregar imagem'));
      };

      img.src = e.target?.result as string;
    };

    reader.onerror = () => {
      reject(new Error('Erro ao ler arquivo de imagem'));
    };

    reader.readAsDataURL(file);
  });
}

function getMimeType(originalType: string): string {
  if (originalType.includes('webp')) return 'image/webp';
  if (originalType.includes('png')) return 'image/png';
  if (originalType.includes('gif')) return 'image/gif';
  return 'image/jpeg';
}

export function getImageCompressionInfo(
  originalSize: number,
  compressedSize: number
): {
  originalSizeKB: string;
  compressedSizeKB: string;
  compressionRatio: string;
} {
  const originalKB = (originalSize / 1024).toFixed(2);
  const compressedKB = (compressedSize / 1024).toFixed(2);
  const ratio = ((1 - compressedSize / originalSize) * 100).toFixed(1);

  return {
    originalSizeKB: originalKB,
    compressedSizeKB: compressedKB,
    compressionRatio: ratio,
  };
}

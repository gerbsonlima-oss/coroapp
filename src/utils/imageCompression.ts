interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
}

const DEFAULT_MAX_WIDTH = 800;
const DEFAULT_MAX_HEIGHT = 800;
const DEFAULT_QUALITY = 0.8;

export async function compressImage(
  file: File,
  options: ImageCompressionOptions = {}
): Promise<File> {
  const maxWidth = options.maxWidth || DEFAULT_MAX_WIDTH;
  const maxHeight = options.maxHeight || DEFAULT_MAX_HEIGHT;
  const quality = options.quality || DEFAULT_QUALITY;
  const format = options.format || 'webp';

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      const img = new Image();

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let { width, height } = img;

          // Calculate new dimensions maintaining aspect ratio
          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }

          canvas.width = width;
          canvas.height = height;

          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Erro ao obter contexto do canvas'));
            return;
          }

          // Use better image smoothing for resizing
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, width, height);

          const mimeType = getMimeType(format);
          
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

              const extension = format === 'webp' ? 'webp' : format === 'png' ? 'png' : 'jpg';
              const newFileName = file.name.replace(/\.[^.]+$/, `.${extension}`);
              
              const compressedFile = new File(
                [blob],
                newFileName,
                { type: mimeType }
              );

              resolve(compressedFile);
            },
            mimeType,
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

function getMimeType(format: string): string {
  if (format === 'webp') return 'image/webp';
  if (format === 'png') return 'image/png';
  return 'image/jpeg';
}

/**
 * Compresses an image specifically for event covers
 * Uses WebP format and smaller dimensions for optimal performance
 */
export async function compressEventCoverImage(file: File): Promise<File> {
  return compressImage(file, {
    maxWidth: 400,
    maxHeight: 400,
    quality: 0.75,
    format: 'webp',
  });
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

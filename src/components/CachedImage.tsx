import { useState, useEffect } from 'react';
import { useAudioCache } from '@/hooks/useAudioCache';
import { Music } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string | null;
  alt: string;
  fallback?: React.ReactNode;
  containerClassName?: string;
}

export const CachedImage = ({ 
  src, 
  alt, 
  className, 
  fallback,
  containerClassName,
  ...props 
}: CachedImageProps) => {
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const { getCachedUrl } = useAudioCache();

  useEffect(() => {
    let isMounted = true;

    const loadImage = async () => {
      if (!src) {
        setError(true);
        return;
      }

      try {
        const url = await getCachedUrl(src);
        if (isMounted) {
          setImageSrc(url);
        }
      } catch (e) {
        console.error('Error loading cached image:', e);
        if (isMounted) {
          setError(true);
        }
      }
    };

    loadImage();

    return () => {
      isMounted = false;
    };
  }, [src]);

  if (error || !src) {
    return (
      <div className={cn("flex items-center justify-center bg-muted", containerClassName)}>
        {fallback || <Music className="h-1/2 w-1/2 text-muted-foreground/50" />}
      </div>
    );
  }

  if (!imageSrc) {
    return (
      <div className={cn("animate-pulse bg-muted", containerClassName)} />
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={() => setError(true)}
      {...props}
    />
  );
};

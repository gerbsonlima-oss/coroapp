import { useState, useRef, useCallback } from 'react';
import ReactCrop, { Crop, PixelCrop, centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Loader2, RotateCcw, ZoomIn, ZoomOut } from 'lucide-react';
import { Slider } from '@/components/ui/slider';

interface ImageCropperProps {
  open: boolean;
  onClose: () => void;
  imageSrc: string;
  onCropComplete: (croppedBlob: Blob) => void;
  aspectRatio?: number;
}

function centerAspectCrop(
  mediaWidth: number,
  mediaHeight: number,
  aspect: number,
) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

export function ImageCropper({ 
  open, 
  onClose, 
  imageSrc, 
  onCropComplete, 
  aspectRatio = 1 
}: ImageCropperProps) {
  const [crop, setCrop] = useState<Crop>();
  const [completedCrop, setCompletedCrop] = useState<PixelCrop>();
  const [scale, setScale] = useState(1);
  const [rotate, setRotate] = useState(0);
  const [loading, setLoading] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  const onImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, aspectRatio));
  }, [aspectRatio]);

  const getCroppedImg = async (): Promise<Blob | null> => {
    const image = imgRef.current;
    if (!image || !completedCrop) return null;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const outputSize = 400; // Output size for profile photo
    canvas.width = outputSize;
    canvas.height = outputSize;

    ctx.imageSmoothingQuality = 'high';

    const cropX = completedCrop.x * scaleX;
    const cropY = completedCrop.y * scaleY;
    const cropWidth = completedCrop.width * scaleX;
    const cropHeight = completedCrop.height * scaleY;

    // Save context state
    ctx.save();

    // Move to center
    ctx.translate(outputSize / 2, outputSize / 2);
    ctx.rotate((rotate * Math.PI) / 180);
    ctx.scale(scale, scale);
    ctx.translate(-outputSize / 2, -outputSize / 2);

    ctx.drawImage(
      image,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      outputSize,
      outputSize
    );

    ctx.restore();

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => resolve(blob),
        'image/webp',
        0.9
      );
    });
  };

  const handleConfirm = async () => {
    setLoading(true);
    try {
      const croppedBlob = await getCroppedImg();
      if (croppedBlob) {
        onCropComplete(croppedBlob);
        onClose();
      }
    } catch (error) {
      console.error('Error cropping image:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setScale(1);
    setRotate(0);
    if (imgRef.current) {
      const { width, height } = imgRef.current;
      setCrop(centerAspectCrop(width, height, aspectRatio));
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Ajustar foto</DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col gap-4">
          {/* Crop Area */}
          <div className="relative flex items-center justify-center bg-muted rounded-lg overflow-hidden min-h-[250px] max-h-[350px]">
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={aspectRatio}
              circularCrop
              className="max-h-full"
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop"
                style={{
                  transform: `scale(${scale}) rotate(${rotate}deg)`,
                  maxHeight: '300px',
                  objectFit: 'contain'
                }}
                onLoad={onImageLoad}
              />
            </ReactCrop>
          </div>

          {/* Controls */}
          <div className="space-y-4">
            {/* Zoom */}
            <div className="flex items-center gap-3">
              <ZoomOut className="h-4 w-4 text-muted-foreground shrink-0" />
              <Slider
                value={[scale]}
                onValueChange={([value]) => setScale(value)}
                min={0.5}
                max={2}
                step={0.1}
                className="flex-1"
              />
              <ZoomIn className="h-4 w-4 text-muted-foreground shrink-0" />
            </div>

            {/* Rotate */}
            <div className="flex items-center gap-3">
              <RotateCcw className="h-4 w-4 text-muted-foreground shrink-0" />
              <Slider
                value={[rotate]}
                onValueChange={([value]) => setRotate(value)}
                min={-180}
                max={180}
                step={1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground w-10 text-right">{rotate}°</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-row gap-2 sm:gap-2">
          <Button variant="outline" onClick={handleReset} className="flex-1">
            Resetar
          </Button>
          <Button onClick={handleConfirm} disabled={loading} className="flex-1">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

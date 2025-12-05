import { useEffect, useState } from 'react';
import logoImage from '@/assets/coro-logo.png';

export const SplashScreen = () => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
    }, 2600);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden animate-fade-out bg-gradient-to-br from-[#0a1628] via-[#1a2642] to-[#0f1e3a]"
      style={{ animationDuration: '900ms', animationDelay: '1.4s' }}
    >
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary rounded-full blur-[120px] animate-pulse" />
        <div
          className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary-glow rounded-full blur-[120px] animate-pulse"
          style={{ animationDelay: '1s' }}
        />
      </div>
      
      {/* Animated Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_80%_50%_at_50%_50%,black,transparent)]" />
      
      {/* Logo + Title */}
      <div
        className="relative flex flex-col items-center gap-4 animate-scale-in"
        style={{ animationDuration: '700ms', animationDelay: '0.4s' }}
      >
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-3xl animate-pulse" />
          <img
            src={logoImage}
            alt="Coro Diocesano de Quixadá"
            className="relative w-52 h-52 md:w-64 md:h-64 object-contain drop-shadow-2xl"
          />
        </div>
        <div className="mt-4 text-center space-y-1.5">
          <p className="text-base md:text-lg font-semibold tracking-[0.22em] uppercase text-foreground">
            Coro Diocesano de Quixadá
          </p>
          <p className="text-xs md:text-sm text-muted-foreground tracking-[0.18em] uppercase">
            Repertório Litúrgico
          </p>
        </div>
      </div>
    </div>
  );
};

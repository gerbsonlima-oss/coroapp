import { useEffect, useState } from 'react';
import logoImage from '@/assets/coro-logo.png';

export const SplashScreen = () => {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShow(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-gradient-to-br from-[#0a1628] via-[#1a2642] to-[#0f1e3a]"
      style={{
        animation: 'fadeOut 600ms ease-out 2.2s forwards'
      }}
    >
      <style>{`
        @keyframes fadeOut {
          from { opacity: 1; }
          to { opacity: 0; visibility: hidden; }
        }
        
        @keyframes slideInDown {
          from {
            opacity: 0;
            transform: translateY(-30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes rotateInSlow {
          from {
            opacity: 0;
            transform: scale(0.8) rotate(-10deg);
          }
          to {
            opacity: 1;
            transform: scale(1) rotate(0deg);
          }
        }
        
        @keyframes pulse-ring {
          0% {
            box-shadow: 0 0 0 0 rgba(120, 119, 198, 0.7);
          }
          50% {
            box-shadow: 0 0 0 30px rgba(120, 119, 198, 0);
          }
          100% {
            box-shadow: 0 0 0 60px rgba(120, 119, 198, 0);
          }
        }
        
        @keyframes slideInUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-primary rounded-full blur-[100px] animate-pulse" />
        <div
          className="absolute bottom-1/3 right-1/4 w-72 h-72 bg-primary/50 rounded-full blur-[100px] animate-pulse"
          style={{ animationDelay: '1s' }}
        />
      </div>

      {/* Animated Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_85%_60%_at_50%_50%,black,transparent)]" />

      {/* Logo + Title */}
      <div className="relative flex flex-col items-center gap-8 z-10">
        {/* Logo Circle Container */}
        <div
          className="relative flex items-center justify-center"
          style={{
            animation: 'rotateInSlow 800ms cubic-bezier(0.34, 1.56, 0.64, 1) 0.2s both'
          }}
        >
          {/* Animated Ring */}
          <div
            className="absolute w-48 h-48 md:w-56 md:h-56 rounded-full border-2 border-primary/30"
            style={{
              animation: 'pulse-ring 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}
          />

          {/* Circle Background */}
          <div className="absolute w-48 h-48 md:w-56 md:h-56 rounded-full bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-sm border border-primary/20" />

          {/* Logo Image */}
          <img
            src={logoImage}
            alt="Coro Diocesano de Quixadá"
            className="relative w-40 h-40 md:w-48 md:h-48 object-contain drop-shadow-[0_10px_30px_rgba(120,119,198,0.3)]"
          />
        </div>

        {/* Text Section */}
        <div
          className="text-center space-y-3"
          style={{
            animation: 'slideInUp 800ms cubic-bezier(0.34, 1.56, 0.64, 1) 0.4s both'
          }}
        >
          <h1
            className="text-2xl md:text-3xl font-light tracking-wider text-foreground"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: '0.15em',
              fontWeight: 300
            }}
          >
            Coro Diocesano
          </h1>
          <p
            className="text-xl md:text-2xl font-light text-primary/90"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              letterSpacing: '0.12em',
              fontWeight: 300
            }}
          >
            de Quixadá
          </p>
          <div className="h-px w-12 mx-auto bg-gradient-to-r from-transparent via-primary/40 to-transparent mt-4" />
          <p
            className="text-xs md:text-sm text-muted-foreground/80 tracking-widest uppercase mt-4"
            style={{
              letterSpacing: '0.2em',
              fontWeight: 400
            }}
          >
            Repertório Litúrgico
          </p>
        </div>
      </div>
    </div>
  );
};

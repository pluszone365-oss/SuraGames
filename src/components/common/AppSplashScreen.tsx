import React, { useEffect, useState } from 'react';
import { Sparkles, Gamepad2 } from 'lucide-react';

interface AppSplashScreenProps {
  onFinish: () => void;
  minDurationMs?: number;
}

export const AppSplashScreen: React.FC<AppSplashScreenProps> = ({
  onFinish,
  minDurationMs = 1800
}) => {
  const [fadingOut, setFadingOut] = useState(false);
  const [imgSrc, setImgSrc] = useState('/app-logo-transparent.png');
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadingOut(true);
      const finishTimer = setTimeout(() => {
        onFinish();
      }, 500);
      return () => clearTimeout(finishTimer);
    }, minDurationMs);

    return () => clearTimeout(timer);
  }, [minDurationMs, onFinish]);

  const handleSkip = () => {
    setFadingOut(true);
    setTimeout(() => {
      onFinish();
    }, 250);
  };

  const handleImgError = () => {
    if (imgSrc === '/app-logo-transparent.png') {
      setImgSrc('/app-logo.jpg');
    } else if (imgSrc === '/app-logo.jpg') {
      setImgSrc('/pwa-512.png');
    } else if (imgSrc === '/pwa-512.png') {
      setImgSrc('/apple-touch-icon.png');
    } else {
      setImgError(true);
    }
  };

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-[9999] bg-[#070B14] flex flex-col items-center justify-center select-none cursor-pointer transition-opacity duration-500 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Background Neon Ambient Glows */}
      <div className="absolute top-1/3 -left-20 w-80 h-80 bg-[#00D4AA]/15 rounded-full blur-[100px] pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/3 -right-20 w-80 h-80 bg-[#3B82F6]/15 rounded-full blur-[100px] pointer-events-none animate-pulse delay-700" />

      {/* Main Fullscreen Brand Logo Container */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 animate-in zoom-in-95 duration-500">
        
        {/* Clean Logo Frame - Seamless dark background with zero edge artifacts */}
        <div className="relative mb-6 group">
          {/* Subtle ambient halo behind logo */}
          <div className="absolute -inset-1.5 bg-gradient-to-tr from-[#00D4AA]/25 via-blue-500/20 to-purple-600/25 rounded-3xl blur-md opacity-75 group-hover:opacity-100 transition-opacity" />
          
          <div className="relative w-28 h-28 sm:w-36 sm:h-36 rounded-3xl overflow-hidden shadow-2xl flex items-center justify-center bg-[#070B14] ring-1 ring-white/10">
            {!imgError ? (
              <img
                src={imgSrc}
                alt="Plus Game Zone Logo"
                onError={handleImgError}
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain select-none pointer-events-none"
              />
            ) : (
              <div className="w-full h-full bg-[#0A0E1A] flex flex-col items-center justify-center text-[#00D4AA]">
                <Gamepad2 className="w-14 h-14" />
                <span className="text-xs font-black tracking-widest mt-1 text-amber-400">PLUS ZONE</span>
              </div>
            )}
          </div>
        </div>

        {/* Brand Title */}
        <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-center justify-center gap-2">
          <span>Plus Game Zone</span>
          <Sparkles className="w-5 h-5 text-[#00D4AA] animate-bounce" />
        </h1>

        {/* Subtitle & Branch Identification */}
        <p className="text-xs sm:text-sm font-medium text-slate-400 mt-1 max-w-xs">
          Financial ERP & Entertainment Operations Hub
        </p>

        {/* Loading / Progress Indicator */}
        <div className="mt-8 flex flex-col items-center gap-2">
          <div className="w-36 h-1 bg-slate-800 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-[#00D4AA] to-[#3B82F6] rounded-full animate-[pulse_1s_ease-in-out_infinite]" />
          </div>
          <span className="text-[10px] font-mono uppercase tracking-widest text-[#00D4AA]/70">
            Initializing Session...
          </span>
        </div>
      </div>

      {/* Tap anywhere hint */}
      <div className="absolute bottom-6 text-[10px] text-slate-500 font-mono tracking-wider">
        TAP ANYWHERE TO CONTINUE
      </div>
    </div>
  );
};

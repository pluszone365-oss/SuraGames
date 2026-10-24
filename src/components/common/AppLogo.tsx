import React, { useState } from 'react';
import { Gamepad2, Sparkles, X, Maximize2 } from 'lucide-react';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
  subtitle?: string;
  clickable?: boolean;
  onClick?: (e: React.MouseEvent) => void;
}

export const AppLogo: React.FC<AppLogoProps> = ({
  size = 'md',
  className = '',
  showText = false,
  subtitle,
  clickable = true,
  onClick
}) => {
  const [imgError, setImgError] = useState(false);
  const [imgSrc, setImgSrc] = useState('/app-logo-transparent.png');

  const sizeClasses = {
    sm: 'w-8 h-8 rounded-[22%] text-xs',
    md: 'w-10 h-10 rounded-[22%] text-sm',
    lg: 'w-12 h-12 rounded-[24%] text-base',
    xl: 'w-16 h-16 rounded-[24%] text-xl'
  }[size];

  const handleImageError = () => {
    if (imgSrc === '/app-logo-transparent.png') {
      setImgSrc('/app-logo.jpg');
    } else if (imgSrc === '/app-logo.jpg') {
      setImgSrc('/pwa-192.png');
    } else if (imgSrc === '/pwa-192.png') {
      setImgSrc('/apple-touch-icon.png');
    } else {
      setImgError(true);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
    }
  };

  const logoIcon = (
    <div
      onClick={handleClick}
      className={`relative overflow-hidden shrink-0 flex items-center justify-center bg-[#070B14] ring-1 ring-white/10 ${sizeClasses} ${className} ${clickable ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform group' : ''}`}
    >
      {!imgError ? (
        <img
          src={imgSrc}
          alt="Plus Game Zone Logo"
          onError={handleImageError}
          referrerPolicy="no-referrer"
          className="w-full h-full object-contain select-none pointer-events-none"
        />
      ) : (
        <div className="w-full h-full bg-slate-900 flex items-center justify-center text-[#00D4AA] relative">
          <Gamepad2 className="w-1/2 h-1/2 text-[#00D4AA]" />
          <span className="absolute bottom-0.5 right-0.5 text-[8px] font-black text-amber-400 bg-black/80 px-1 rounded">PGZ</span>
        </div>
      )}
    </div>
  );

  return (
    <>
      {!showText ? (
        logoIcon
      ) : (
        <div onClick={handleClick} className={`flex items-center gap-3 select-none ${clickable ? 'cursor-pointer' : ''}`}>
          {logoIcon}
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 dark:text-[#F0F4FF] leading-tight flex items-center gap-1.5">
              <span>Plus Game Zone</span>
              <Sparkles className="w-3.5 h-3.5 text-[#00D4AA]" />
            </h1>
            {subtitle && (
              <p className="text-[11px] text-slate-500 dark:text-[#8899BB] mt-0.5">{subtitle}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
};


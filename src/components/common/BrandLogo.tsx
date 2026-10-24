import React, { useState } from 'react';
import { WalletType } from '../../types';
import { Vault, Wallet as WalletIcon, CreditCard, Landmark, Banknote } from 'lucide-react';

export interface BrandLogoProps {
  type: WalletType;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  customColor?: string;
  customLogoUrl?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  type,
  size = 'md',
  className = '',
  customColor,
  customLogoUrl
}) => {
  const [imgError, setImgError] = useState(false);

  // Precision sizing matrix tailored for mobile, tablet, and desktop viewports
  // With clean, crisp, consistent pure white backdrop (#FFFFFF)
  const sizeClasses = {
    xs: 'w-5 h-5 rounded-md p-0.5 text-[10px]',
    sm: 'w-8 h-8 rounded-lg p-1 text-xs',
    md: 'w-10 h-10 rounded-xl p-1.5 text-sm',
    lg: 'w-12 h-12 rounded-xl p-1.5 text-base',
    xl: 'w-16 h-16 rounded-2xl p-2 text-xl'
  }[size];

  // Base container class for all logos: crisp, pure white background, subtle clean border, no competing background colors
  const baseWhiteBadgeClass = `flex items-center justify-center shrink-0 overflow-hidden relative aspect-square bg-white border border-slate-200/90 shadow-sm ${sizeClasses} ${className}`;

  // If a custom logo URL is provided and valid, display it inside the clean white card
  if (customLogoUrl && !imgError) {
    return (
      <div
        title={`${type} Custom Logo`}
        className={baseWhiteBadgeClass}
      >
        <img
          src={customLogoUrl}
          alt="Custom Wallet Logo"
          className="w-full h-full object-contain"
          onError={() => setImgError(true)}
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  switch (type) {
    case 'CBE_BANK':
      return (
        <div
          title="Commercial Bank of Ethiopia (CBE)"
          className={baseWhiteBadgeClass}
        >
          <img
            src="/cbe-logo.svg"
            alt="Commercial Bank of Ethiopia (CBE) Coin"
            className="w-full h-full object-contain select-none"
            loading="eager"
            onError={() => setImgError(true)}
          />
        </div>
      );

    case 'TELEBIRR':
      return (
        <div
          title="Telebirr Mobile Money (Ethio Telecom)"
          className={baseWhiteBadgeClass}
        >
          <img
            src="/telebirr-logo.svg"
            alt="Telebirr Official Blue Logo"
            className="w-full h-full object-contain select-none"
            loading="eager"
            onError={() => setImgError(true)}
          />
        </div>
      );

    case 'EBIRR':
      return (
        <div
          title="eBirr Electronic Payment Gateway"
          className={baseWhiteBadgeClass}
        >
          <img
            src="/ebirr-logo.svg"
            alt="eBirr Official Green Emblem"
            className="w-full h-full object-contain select-none"
            loading="eager"
            onError={() => setImgError(true)}
          />
        </div>
      );

    case 'CASH':
      return (
        <div
          title="Physical Cash Vault (ETB)"
          className={baseWhiteBadgeClass}
        >
          <Banknote className="w-full h-full p-0.5 text-emerald-600 stroke-[2.2]" />
        </div>
      );

    case 'SAVINGS':
      return (
        <div
          title="Savings Vault"
          className={baseWhiteBadgeClass}
        >
          <Vault className="w-full h-full p-0.5 text-blue-600" />
        </div>
      );

    case 'CREDIT_LINE':
      return (
        <div
          title="Credit Facility"
          className={baseWhiteBadgeClass}
        >
          <CreditCard className="w-full h-full p-0.5 text-purple-600" />
        </div>
      );

    case 'LOAN':
      return (
        <div
          title="Loan Account"
          className={baseWhiteBadgeClass}
        >
          <Landmark className="w-full h-full p-0.5 text-pink-600" />
        </div>
      );

    default:
      return (
        <div
          title="Wallet"
          className={baseWhiteBadgeClass}
        >
          <WalletIcon className="w-full h-full p-0.5 text-cyan-600" />
        </div>
      );
  }
};

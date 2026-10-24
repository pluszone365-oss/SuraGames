import React from 'react';

interface PwaCapabilitiesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSimulateShareTarget?: (smsText: string) => void;
  onSimulateFileImport?: () => void;
  onSimulateNote?: () => void;
}

export const PwaCapabilitiesModal: React.FC<PwaCapabilitiesModalProps> = () => {
  // PWA and Service Worker capabilities inspector modal hidden from UI
  return null;
};

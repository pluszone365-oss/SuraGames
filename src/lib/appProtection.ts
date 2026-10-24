/**
 * Plus Zone Finance - App Copy & Security Protection Layer
 * Protects financial UI, proprietary ledger templates, and app layouts from unauthorized copying,
 * text scraping, right-click context menu, and inspector shortcuts while preserving normal input/textarea usability.
 */

export function initAppProtection(): () => void {
  if (typeof window === 'undefined') return () => {};

  // 1. Block Context Menu (Right-Click) except on Input/Textarea fields
  const handleContextMenu = (e: MouseEvent) => {
    const target = e.target as HTMLElement | null;
    if (target) {
      const tagName = target.tagName.toUpperCase();
      const isEditable = target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA';
      if (!isEditable) {
        e.preventDefault();
      }
    }
  };

  // 2. Block Copy / Cut / Drag events on non-input elements
  const handleCopyCut = (e: ClipboardEvent) => {
    const target = e.target as HTMLElement | null;
    if (target) {
      const tagName = target.tagName.toUpperCase();
      const isEditable = target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA';
      if (!isEditable) {
        e.preventDefault();
      }
    }
  };

  // 3. Block Dragging of images, cards, and UI elements
  const handleDragStart = (e: DragEvent) => {
    const target = e.target as HTMLElement | null;
    if (target) {
      const tagName = target.tagName.toUpperCase();
      if (tagName === 'IMG' || tagName === 'SVG' || !target.isContentEditable) {
        e.preventDefault();
      }
    }
  };

  // 4. Block Keyboard Shortcuts (F12, View Source, Save, Print, Inspector, Copy non-input)
  const handleKeyDown = (e: KeyboardEvent) => {
    const target = e.target as HTMLElement | null;
    const tagName = target ? target.tagName.toUpperCase() : '';
    const isEditable = !!target && (target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA');

    const isCmdOrCtrl = e.ctrlKey || e.metaKey;
    const key = e.key.toLowerCase();

    // Block DevTools shortcuts (F12, Ctrl+Shift+I, Ctrl+Shift+J, Ctrl+Shift+C)
    if (
      e.key === 'F12' ||
      (isCmdOrCtrl && e.shiftKey && (key === 'i' || key === 'j' || key === 'c'))
    ) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Block View Source (Ctrl+U)
    if (isCmdOrCtrl && key === 'u') {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Block Save Webpage (Ctrl+S) and Print (Ctrl+P)
    if (isCmdOrCtrl && (key === 's' || key === 'p')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }

    // Block Copy (Ctrl+C) and Cut (Ctrl+X) when NOT inside input or textarea
    if (isCmdOrCtrl && !isEditable && (key === 'c' || key === 'x' || key === 'a')) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  };

  // Attach event listeners
  document.addEventListener('contextmenu', handleContextMenu, { capture: true });
  document.addEventListener('copy', handleCopyCut, { capture: true });
  document.addEventListener('cut', handleCopyCut, { capture: true });
  document.addEventListener('dragstart', handleDragStart, { capture: true });
  document.addEventListener('keydown', handleKeyDown, { capture: true });

  // Add protective CSS classes dynamically to body
  document.body.classList.add('app-protected');

  return () => {
    document.removeEventListener('contextmenu', handleContextMenu, { capture: true });
    document.removeEventListener('copy', handleCopyCut, { capture: true });
    document.removeEventListener('cut', handleCopyCut, { capture: true });
    document.removeEventListener('dragstart', handleDragStart, { capture: true });
    document.removeEventListener('keydown', handleKeyDown, { capture: true });
  };
}

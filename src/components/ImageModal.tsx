import React, { useEffect } from 'react';
import { X, ExternalLink, Gift, ZoomIn } from 'lucide-react';
import { GiftItem } from '../types';

interface ImageModalProps {
  gift: GiftItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export const ImageModal: React.FC<ImageModalProps> = ({ gift, isOpen, onClose }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !gift || !gift.imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-stone-950/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative max-w-4xl max-h-[92vh] w-full rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col border border-stone-800/40"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header bar */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-stone-100 bg-stone-50/90 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-4">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600 text-white shadow-xs shrink-0">
              <Gift className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-stone-900 truncate">
                {gift.title}
              </h3>
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="font-semibold text-rose-700">Pour {gift.recipient}</span>
                {gift.price > 0 && (
                  <>
                    <span>·</span>
                    <span className="font-bold text-stone-900 tabular-nums">
                      {gift.price.toFixed(2).replace('.00', '')} €
                    </span>
                  </>
                )}
                {gift.storeName && (
                  <>
                    <span>·</span>
                    <span>{gift.storeName}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {gift.url && (
              <a
                href={gift.url.startsWith('http') ? gift.url : `https://${gift.url}`}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-200 text-xs font-semibold text-stone-700 hover:bg-stone-50 shadow-2xs transition-colors"
              >
                <span>Voir la boutique</span>
                <ExternalLink className="h-3.5 w-3.5 text-stone-500" />
              </a>
            )}
            <button
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 hover:text-stone-900 hover:bg-stone-200/60 transition-colors"
              title="Fermer (Échap)"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Enlarged image viewport */}
        <div className="relative flex-1 bg-stone-950 flex items-center justify-center p-2 sm:p-4 overflow-hidden min-h-[300px] max-h-[75vh]">
          <img
            src={gift.imageUrl}
            alt={gift.title}
            className="max-h-full max-w-full object-contain rounded-lg shadow-lg select-none"
            referrerPolicy="no-referrer"
          />
        </div>

        {/* Bottom details & quick actions */}
        <div className="px-4 sm:px-6 py-2.5 bg-white border-t border-stone-100 flex items-center justify-between gap-3 text-xs text-stone-500 shrink-0">
          <p className="line-clamp-1 italic">
            {gift.description || gift.category}
          </p>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-[11px] text-stone-400">Cliquez hors de l'image pour fermer</span>
          </div>
        </div>
      </div>
    </div>
  );
};

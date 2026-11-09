import React, { useState } from 'react';
import { X, Trash2, AlertTriangle } from 'lucide-react';
import { GiftItem } from '../types';

interface DeleteModalProps {
  gift: GiftItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmDelete: (id: string) => Promise<void>;
}

export const DeleteModal: React.FC<DeleteModalProps> = ({
  gift,
  isOpen,
  onClose,
  onConfirmDelete,
}) => {
  const [isDeleting, setIsDeleting] = useState(false);

  if (!isOpen || !gift) return null;

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      await onConfirmDelete(gift.id);
      onClose();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-red-50/60">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-white shadow-xs">
              <Trash2 className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-serif text-lg font-bold text-red-950">
                Supprimer définitivement
              </h2>
              <p className="text-xs text-red-700/80">Liste de {gift.recipient}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Gift details */}
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center gap-3">
            {gift.imageUrl && (
              <img
                src={gift.imageUrl}
                alt={gift.title}
                className="h-12 w-12 rounded-lg object-cover border border-stone-200 shrink-0"
                referrerPolicy="no-referrer"
              />
            )}
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-stone-900 truncate">{gift.title}</h4>
              <div className="text-[11px] text-stone-500 tabular-nums">
                {gift.price > 0 ? `${gift.price} €` : 'Prix libre'} {gift.storeName ? `· ${gift.storeName}` : ''}
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-50/70 border border-red-200/70 text-xs text-red-900 leading-relaxed">
            <AlertTriangle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />
            <p>
              Êtes-vous certain de vouloir supprimer définitivement cette idée de cadeau ? 
              Elle sera retirée de la liste de <strong>{gift.recipient}</strong> et effacée de la base de données.
            </p>
          </div>

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-semibold shadow-md transition-all active:scale-98 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Trash2 className="h-4 w-4" />
              <span>{isDeleting ? 'Suppression...' : 'Supprimer définitivement'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

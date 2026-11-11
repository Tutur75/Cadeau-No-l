import React, { useState } from 'react';
import { X, Gift } from 'lucide-react';
import { GiftItem, FAMILY_MEMBERS } from '../types';
import confetti from 'canvas-confetti';

interface ReserveModalProps {
  gift: GiftItem | null;
  isOpen: boolean;
  onClose: () => void;
  onConfirmReserve: (giftId: string, name: string, note?: string) => Promise<void>;
}

export const ReserveModal: React.FC<ReserveModalProps> = ({
  gift,
  isOpen,
  onClose,
  onConfirmReserve,
}) => {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (isOpen) {
      setName('');
      setNote('');
    }
  }, [isOpen, gift]);

  if (!isOpen || !gift) return null;

  const profile = FAMILY_MEMBERS[gift.recipient];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSubmitting(true);
    try {
      await onConfirmReserve(gift.id, name.trim(), note.trim());

      try {
        confetti({
          particleCount: 50,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#047857', '#b91c1c', '#f59e0b', '#ffffff'],
        });
      } catch {
        // ignore
      }

      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-gradient-to-r from-stone-50 to-white">
          <div className="flex items-center gap-2.5">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-xs"
              style={{ backgroundColor: profile.accentColor }}
            >
              <Gift className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-serif text-lg font-bold text-stone-900">
                Offrir ce cadeau
              </h2>
              <p className="text-xs font-semibold text-stone-600">
                Pour <span className={profile.fontColorClass}>{gift.recipient}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Gift Recap */}
        <div className="p-4 mx-6 mt-4 rounded-xl bg-stone-50 border border-stone-200/80 flex items-center gap-3">
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

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 pt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Votre prénom (ex : Maman, Arthur, Audrey, etc.) *
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Indiquez qui offre ce cadeau"
              className="w-full px-3 py-2 text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1">
              Message ou note secrète pour la famille (optionnel)
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ex : Déjà commandé, arrive sous 3 jours ! Emballé dans du papier doré."
              className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-600 resize-none"
            />
          </div>

          {gift.recipient === 'Zoé' ? (
            <div className="p-3 rounded-lg bg-pink-50/80 border border-pink-200 text-[11px] text-pink-950 leading-relaxed">
              🎁 <strong>Liste de Zoé :</strong> Le mode secret n'est pas actif pour Zoé. Votre prénom sera visible directement sur sa liste pour savoir qui offre ce cadeau !
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-purple-50/80 border border-purple-200 text-[11px] text-purple-950 leading-relaxed">
              🤫 <strong>Mode Secret actif pour <span className={profile.fontColorClass}>{gift.recipient}</span> :</strong> La réservation reste une surprise sur la liste publique pour préserver la magie sous le sapin !
            </div>
          )}

          <div className="pt-2 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitting}
              className={`px-5 py-2.5 rounded-xl ${profile.buttonCardClass} text-xs sm:text-sm font-semibold shadow-md transition-all active:scale-98 disabled:opacity-50`}
            >
              {submitting ? 'Validation...' : 'Confirmer la réservation 🎁'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

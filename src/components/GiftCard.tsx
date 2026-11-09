import React, { useState } from 'react';
import { ExternalLink, Check, Gift, Heart, MoreVertical, Trash2, Edit3 } from 'lucide-react';
import { GiftItem, FamilyMember, FAMILY_MEMBERS } from '../types';

interface GiftCardProps {
  gift: GiftItem;
  surpriseMode: boolean;
  viewer: FamilyMember | 'all';
  isAdmin: boolean;
  onOpenReserveModal: (gift: GiftItem) => void;
  onUnreserve: (id: string) => void;
  onEdit: (gift: GiftItem) => void;
  onDelete: (id: string) => void;
}

export const GiftCard: React.FC<GiftCardProps> = ({
  gift,
  surpriseMode,
  viewer,
  isAdmin,
  onOpenReserveModal,
  onUnreserve,
  onEdit,
  onDelete,
}) => {
  const [imageError, setImageError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const profile = FAMILY_MEMBERS[gift.recipient];

  // If surprise mode is on AND the viewer is the recipient of the gift,
  // hide who reserved it and what note they left!
  const isRecipientViewingSurprise = surpriseMode && viewer === gift.recipient;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl bg-white border border-stone-200/90 shadow-xs hover:shadow-md transition-all duration-200">
      
      {/* Visual media container (Lead with imagery) */}
      <div className="relative aspect-4/3 w-full overflow-hidden bg-stone-100">
        {!imageError && gift.imageUrl ? (
          <img
            src={gift.imageUrl}
            alt={gift.title}
            onError={() => setImageError(true)}
            referrerPolicy="no-referrer"
            className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-102"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-stone-100 via-rose-50/40 to-stone-200 p-6 text-center">
            <Gift className="h-10 w-10 text-rose-800/40 mb-2" />
            <span className="text-xs font-medium text-stone-500">{gift.category}</span>
          </div>
        )}

        {/* Recipient Marker: Displays just "Audrey", "Arthur", or "Zoé" */}
        <div className="absolute top-3 left-3 z-10">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/95 backdrop-blur-md shadow-xs text-xs font-semibold text-stone-800 border border-stone-200/60">
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: profile.accentColor }}
            />
            <span>{gift.recipient}</span>
          </span>
        </div>

        {/* Priority Marker */}
        {gift.priority === 'Coup de cœur' && (
          <div className="absolute top-3 right-3 z-10">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-rose-600 text-white shadow-xs text-xs font-medium">
              <Heart className="h-3 w-3 fill-current" />
              <span>Coup de cœur</span>
            </span>
          </div>
        )}

        {/* Kebab menu (ONLY visible in Administration Mode) */}
        {isAdmin && (
          <div className="absolute bottom-3 right-3 z-10">
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/95 backdrop-blur-md text-stone-700 hover:text-stone-950 shadow-xs border border-stone-200/80 transition-colors"
                title="Modifier ou supprimer ce cadeau (Admin)"
              >
                <MoreVertical className="h-4 w-4" />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 bottom-full mb-1 w-36 rounded-lg bg-white border border-stone-200 shadow-xl py-1 z-20 text-xs"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(gift);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-stone-700 hover:bg-stone-50 text-left font-medium"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-stone-500" />
                    <span>Modifier</span>
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(gift.id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 text-left font-medium"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500" />
                    <span>Supprimer</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content Area */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        
        {/* Unboxed Metadata (Zero-pill discipline with separators) */}
        <div className="flex items-center gap-1.5 text-xs text-stone-500 mb-2">
          <span>{gift.category}</span>
          {gift.storeName && (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-stone-700">{gift.storeName}</span>
            </>
          )}
          {gift.isSecretIdea && (
            <>
              <span aria-hidden="true">·</span>
              <span className="text-purple-600 font-medium">Idée secrète</span>
            </>
          )}
        </div>

        {/* Title */}
        <h3 className="text-base font-semibold text-stone-900 group-hover:text-red-900 transition-colors line-clamp-2 leading-snug mb-1.5">
          {gift.title}
        </h3>

        {/* Description / Notes */}
        {gift.description && (
          <p className="text-xs text-stone-600 line-clamp-2 mb-3 leading-relaxed">
            {gift.description}
          </p>
        )}

        {/* Price & External Link Row */}
        <div className="mt-auto pt-3 border-t border-stone-100 flex items-baseline justify-between gap-2">
          <div className="text-lg font-bold text-stone-950 tabular-nums">
            {gift.price > 0 ? `${gift.price.toFixed(2).replace('.00', '')} €` : 'Prix libre'}
          </div>

          {gift.url && (
            <a
              href={gift.url.startsWith('http') ? gift.url : `https://${gift.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-700 hover:text-red-700 transition-colors bg-stone-50 hover:bg-stone-100 px-2.5 py-1 rounded-md border border-stone-200/80 shadow-2xs"
              title="Ouvrir le site marchand dans une fenêtre dédiée"
            >
              <span>{gift.storeName ? `Voir sur ${gift.storeName}` : 'Voir la boutique'}</span>
              <ExternalLink className="h-3.5 w-3.5 text-stone-500" />
            </a>
          )}
        </div>

        {/* Reservation State Box (Available for both Visitors and Admins!) */}
        <div className="mt-4 pt-3 border-t border-stone-100">
          {gift.isReserved ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200/80 p-3 text-xs text-emerald-950">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-1.5 font-semibold text-emerald-900">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  {isRecipientViewingSurprise ? (
                    <span>Déjà réservé pour Noël (Surprise !)</span>
                  ) : (
                    <span>Réservé par {gift.reservedBy || 'Un proche'}</span>
                  )}
                </div>

                {/* Unreserve action */}
                {(isAdmin || !isRecipientViewingSurprise) && (
                  <button
                    onClick={() => onUnreserve(gift.id)}
                    className="text-[11px] text-emerald-700 hover:text-emerald-900 underline underline-offset-2 shrink-0"
                    title="Libérer ce cadeau"
                  >
                    Libérer
                  </button>
                )}
              </div>

              {!isRecipientViewingSurprise && gift.reservationNote && (
                <p className="mt-1.5 text-[11px] text-emerald-800/90 italic">
                  « {gift.reservationNote} »
                </p>
              )}
            </div>
          ) : (
            <div>
              {/* Prominent single RESERVER button for visitors and family */}
              <button
                onClick={() => onOpenReserveModal(gift)}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white text-xs font-bold tracking-wide shadow-xs transition-all active:scale-98"
              >
                <Gift className="h-4 w-4" />
                <span>RÉSERVER</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </article>
  );
};

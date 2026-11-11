import React, { useState } from 'react';
import { ExternalLink, Check, Gift, Heart, MoreVertical, Trash2, Edit3, ZoomIn } from 'lucide-react';
import { GiftItem, FAMILY_MEMBERS } from '../types';

interface GiftCardProps {
  gift: GiftItem;
  isAdmin: boolean;
  onOpenReserveModal: (gift: GiftItem) => void;
  onUnreserve: (id: string) => void;
  onEdit: (gift: GiftItem) => void;
  onDelete: (id: string) => void;
  onZoomImage?: (gift: GiftItem) => void;
}

export const GiftCard: React.FC<GiftCardProps> = ({
  gift,
  isAdmin,
  onOpenReserveModal,
  onUnreserve,
  onEdit,
  onDelete,
  onZoomImage,
}) => {
  const [imageError, setImageError] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const profile = FAMILY_MEMBERS[gift.recipient];

  // Mode secret : actif par défaut pour Audrey et Arthur, et JAMAIS actif pour Zoé
  const isSecretRecipient = gift.recipient === 'Audrey' || gift.recipient === 'Arthur';
  const isSecretActive = !isAdmin && isSecretRecipient;

  const hasValidImage = !imageError && Boolean(gift.imageUrl);

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-xl bg-white border border-stone-200/90 shadow-2xs hover:shadow-md transition-all duration-200">
      
      {/* Visual media container - compact 16:10 ratio with zoom capability */}
      <div className="relative aspect-16/10 w-full overflow-hidden bg-stone-100">
        {hasValidImage ? (
          <div
            onClick={() => onZoomImage?.(gift)}
            className="h-full w-full cursor-zoom-in relative"
            title="Cliquez pour agrandir la photo du cadeau"
          >
            <img
              src={gift.imageUrl}
              alt={gift.title}
              onError={() => setImageError(true)}
              referrerPolicy="no-referrer"
              className="h-full w-full object-cover object-center transition-transform duration-300 group-hover:scale-104"
            />
            {/* Zoom indicator on hover */}
            <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] font-medium text-white shadow-xs">
                <ZoomIn className="h-3 w-3" />
                <span>Zoomer</span>
              </span>
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-stone-100 via-rose-50/40 to-stone-200 p-4 text-center">
            <Gift className="h-8 w-8 text-rose-800/40 mb-1" />
            <span className="text-[11px] font-medium text-stone-500">{gift.category}</span>
          </div>
        )}

        {/* Recipient Marker: Displays just "Audrey", "Arthur", or "Zoé" with designated colors */}
        <div className="absolute top-2.5 left-2.5 z-10 pointer-events-none">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md backdrop-blur-md shadow-xs text-[11px] font-bold border ${profile.badgeClass}`}>
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: profile.accentColor }}
            />
            <span className={profile.fontColorClass}>{gift.recipient}</span>
          </span>
        </div>

        {/* Priority Marker: Visible for all 3 levels (Coup de cœur, Très souhaité, Souhaité) */}
        <div className="absolute top-2.5 right-2.5 z-10 pointer-events-none">
          {gift.priority === 'Coup de cœur' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-600 text-white shadow-xs text-[10px] font-bold">
              <Heart className="h-2.5 w-2.5 fill-current" />
              <span>Coup de cœur</span>
            </span>
          )}
          {gift.priority === 'Très souhaité' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500 text-white shadow-xs text-[10px] font-bold">
              <span>⭐ Très souhaité</span>
            </span>
          )}
          {(gift.priority === 'Souhaité' || !gift.priority) && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-900/85 backdrop-blur-xs text-stone-100 shadow-xs text-[10px] font-medium border border-white/20">
              <span>🎁 Souhaité</span>
            </span>
          )}
        </div>

        {/* Kebab menu (ONLY visible in Administration Mode) */}
        {isAdmin && (
          <div className="absolute bottom-2 right-2 z-10">
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/95 backdrop-blur-md text-stone-700 hover:text-stone-950 shadow-xs border border-stone-200/80 transition-colors"
                title="Modifier ou supprimer ce cadeau (Admin)"
              >
                <MoreVertical className="h-3.5 w-3.5" />
              </button>

              {menuOpen && (
                <div
                  className="absolute right-0 bottom-full mb-1 w-32 rounded-lg bg-white border border-stone-200 shadow-xl py-1 z-20 text-xs"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onEdit(gift);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-stone-700 hover:bg-stone-50 text-left font-medium"
                  >
                    <Edit3 className="h-3 w-3 text-stone-500" />
                    <span>Modifier</span>
                  </button>
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      onDelete(gift.id);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-red-600 hover:bg-red-50 text-left font-medium"
                  >
                    <Trash2 className="h-3 w-3 text-red-500" />
                    <span>Supprimer</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Content Area - concise and neat */}
      <div className="flex flex-1 flex-col p-3.5 sm:p-4">
        
        {/* Unboxed Metadata: Category, Store, and Priority tag */}
        <div className="flex items-center justify-between gap-1.5 text-[11px] mb-1.5">
          <div className="flex items-center gap-1 text-stone-500 truncate min-w-0">
            <span className="truncate">{gift.category}</span>
            {gift.storeName && (
              <>
                <span aria-hidden="true" className="text-stone-300">·</span>
                <span className="font-medium text-stone-700 truncate">{gift.storeName}</span>
              </>
            )}
          </div>

          <div className="shrink-0">
            {gift.priority === 'Coup de cœur' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <Heart className="h-2.5 w-2.5 fill-current text-rose-600" />
                <span>Coup de cœur</span>
              </span>
            )}
            {gift.priority === 'Très souhaité' && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                <span>⭐ Très souhaité</span>
              </span>
            )}
            {(gift.priority === 'Souhaité' || !gift.priority) && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-stone-100 text-stone-600 border border-stone-200">
                <span>🎁 Souhaité</span>
              </span>
            )}
          </div>
        </div>

        {/* Title */}
        <h3 className="text-sm sm:text-[15px] font-semibold text-stone-900 group-hover:text-red-900 transition-colors line-clamp-2 leading-snug mb-1">
          {gift.title}
        </h3>

        {/* Description / Notes */}
        {gift.description && (
          <p className="text-xs text-stone-600 line-clamp-2 mb-2 leading-relaxed">
            {gift.description}
          </p>
        )}

        {/* Price & External Link Row */}
        <div className="mt-auto pt-2 border-t border-stone-100 flex items-baseline justify-between gap-1.5">
          <div className="text-base sm:text-lg font-bold text-stone-950 tabular-nums">
            {gift.price > 0 ? `${gift.price.toFixed(2).replace('.00', '')} €` : 'Prix libre'}
          </div>

          {gift.url && (
            <a
              href={gift.url.startsWith('http') ? gift.url : `https://${gift.url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-700 hover:text-red-700 transition-colors bg-stone-50 hover:bg-stone-100 px-2 py-0.5 rounded border border-stone-200/80 shadow-2xs shrink-0"
              title="Ouvrir le site marchand dans une fenêtre dédiée"
            >
              <span className="max-w-[100px] truncate">{gift.storeName || 'Boutique'}</span>
              <ExternalLink className="h-3 w-3 text-stone-500 shrink-0" />
            </a>
          )}
        </div>

        {/* Reservation State Box */}
        <div className="mt-2.5 pt-2 border-t border-stone-100">
          {gift.isReserved ? (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200/80 p-2.5 text-xs text-emerald-950">
              <div className="flex items-start justify-between gap-1.5">
                <div className="flex flex-wrap items-center gap-1 font-semibold text-emerald-900 leading-tight">
                  <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                  {isSecretActive ? (
                    <span>Déjà réservé pour Noël (Surprise !)</span>
                  ) : (
                    <>
                      <span>Réservé par {gift.reservedBy || 'Un proche'}</span>
                      {isAdmin && isSecretRecipient && (
                        <span className="text-[9px] font-normal text-amber-800 bg-amber-100/90 px-1 py-0.2 rounded border border-amber-200">
                          Secret pour {gift.recipient}
                        </span>
                      )}
                    </>
                  )}
                </div>

                {/* Unreserve action */}
                {(isAdmin || !isSecretRecipient) && (
                  <button
                    onClick={() => onUnreserve(gift.id)}
                    className="text-[10px] text-emerald-700 hover:text-emerald-900 underline underline-offset-2 shrink-0"
                    title="Libérer ce cadeau"
                  >
                    Libérer
                  </button>
                )}
              </div>

              {!isSecretActive && gift.reservationNote && (
                <p className="mt-1 text-[10px] text-emerald-800/90 italic line-clamp-2">
                  « {gift.reservationNote} »
                </p>
              )}
            </div>
          ) : (
            <div>
              {/* Prominent recipient-themed RESERVER button */}
              <button
                onClick={() => onOpenReserveModal(gift)}
                className={`w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg ${profile.buttonCardClass} text-xs font-bold tracking-wide shadow-xs transition-all active:scale-98`}
              >
                <Gift className="h-3.5 w-3.5" />
                <span>RÉSERVER</span>
              </button>
            </div>
          )}
        </div>

      </div>
    </article>
  );
};

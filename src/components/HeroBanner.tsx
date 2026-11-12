import React from 'react';
import { Gift, CheckCircle2, ArrowRight } from 'lucide-react';
import { FamilyMember, GiftItem, FAMILY_MEMBERS } from '../types';
import { MEMBER_AVATARS } from '../assets/avatars';
import heroFestiveImg from '../assets/images/hero_christmas_festive_1794241165301.jpg';

interface HeroBannerProps {
  gifts: GiftItem[];
  selectedRecipient: FamilyMember | 'all';
  onSelectRecipient: (recipient: FamilyMember | 'all') => void;
  onOpenAddModal: () => void;
  isAdmin: boolean;
  onOpenAdminModal: () => void;
}

export const HeroBanner: React.FC<HeroBannerProps> = ({
  gifts,
  selectedRecipient,
  onSelectRecipient,
  onOpenAddModal,
  isAdmin,
}) => {
  const totalCount = gifts.length;
  const reservedCount = gifts.filter(g => g.isReserved).length;

  const getMemberStats = (name: FamilyMember) => {
    const list = gifts.filter(g => g.recipient === name);
    const reserved = list.filter(g => g.isReserved).length;
    return { total: list.length, reserved };
  };

  const handleScrollToGifts = () => {
    const el = document.getElementById('wishlist-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-950 via-rose-900 to-stone-900 text-white shadow-xl mb-8">
      {/* Background imagery with measured contrast scrim */}
      <div className="absolute inset-0 z-0 opacity-40 mix-blend-overlay">
        <img
          src={heroFestiveImg}
          alt="Ambiance festive de Noël"
          className="h-full w-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-red-950/90 via-red-950/70 to-transparent z-1" />

      {/* Decorative golden sparkle glow */}
      <div className="absolute -top-24 -right-24 h-96 w-96 rounded-full bg-amber-400/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 px-6 py-8 sm:px-10 sm:py-12 lg:px-12">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
          
          {/* Left: Festive Headline & Narrative */}
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-xs px-3.5 py-1 text-xs font-semibold text-amber-200 border border-white/15">
              <span>🎄 Listes de Noël 2026</span>
            </div>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-white leading-tight text-balance">
              Les souhaits de Noël d'Audrey, Arthur &amp; Zoé
            </h1>

            {/* Quick Actions */}
            <div className="pt-2 flex flex-wrap items-center gap-3">
              {isAdmin ? (
                <button
                  onClick={onOpenAddModal}
                  className="inline-flex items-center gap-2 rounded-xl bg-amber-400 hover:bg-amber-300 px-5 py-2.5 text-xs sm:text-sm font-semibold text-stone-950 transition-all shadow-md active:scale-95"
                >
                  <Gift className="h-4 w-4" />
                  <span>Ajouter un cadeau par lien web</span>
                </button>
              ) : (
                <button
                  onClick={handleScrollToGifts}
                  className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white transition-all shadow-md active:scale-95"
                >
                  <Gift className="h-4 w-4" />
                  <span>Réserver un cadeau</span>
                </button>
              )}

              <button
                onClick={() => onSelectRecipient('all')}
                className="inline-flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/20 px-4 py-2.5 text-xs sm:text-sm font-medium text-white transition-all backdrop-blur-md border border-white/15"
              >
                <span>Voir toutes les idées</span>
                <ArrowRight className="h-4 w-4 text-rose-200" />
              </button>
            </div>
          </div>

          {/* Right: Interactive Family Member Selector Cards */}
          <div className="flex flex-col gap-2.5 shrink-0 lg:max-w-md">
            <div className="grid grid-cols-3 sm:grid-cols-3 gap-3">
              {(['Audrey', 'Arthur', 'Zoé'] as FamilyMember[]).map((name) => {
                const profile = FAMILY_MEMBERS[name];
                const stats = getMemberStats(name);
                const isSelected = selectedRecipient === name;

                const memberColors = {
                  Audrey: {
                    avatar: 'bg-purple-600 text-white',
                    ring: 'ring-2 ring-purple-400',
                    activeText: 'text-purple-900',
                    hoverBg: 'hover:bg-purple-950/30',
                  },
                  Arthur: {
                    avatar: 'bg-blue-600 text-white',
                    ring: 'ring-2 ring-blue-400',
                    activeText: 'text-blue-900',
                    hoverBg: 'hover:bg-blue-950/30',
                  },
                  Zoé: {
                    avatar: 'bg-pink-500 text-white',
                    ring: 'ring-2 ring-pink-400',
                    activeText: 'text-pink-900',
                    hoverBg: 'hover:bg-pink-950/30',
                  },
                }[name];

                return (
                  <button
                    key={name}
                    onClick={() => onSelectRecipient(isSelected ? 'all' : name)}
                    className={`group relative flex flex-col items-center p-3.5 sm:p-4 rounded-xl text-center transition-all duration-200 backdrop-blur-md border ${
                      isSelected
                        ? `bg-white ${memberColors.ring} shadow-lg scale-[1.03] border-white`
                        : `bg-white/10 ${memberColors.hoverBg} text-white border-white/10 hover:border-white/20`
                    }`}
                  >
                    <div
                      className={`relative flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-full shadow-md mb-2 transition-transform group-hover:scale-105 overflow-hidden ring-2 ${
                        isSelected
                          ? memberColors.ring + ' ring-offset-2 ring-offset-white'
                          : 'ring-white/40'
                      }`}
                    >
                      <img
                        src={MEMBER_AVATARS[name]}
                        alt={name}
                        className="h-full w-full object-cover object-top"
                      />
                    </div>

                    <span className={`text-sm sm:text-base font-bold leading-tight ${isSelected ? memberColors.activeText : 'text-white'}`}>
                      {name}
                    </span>

                    <span className={`text-[11px] mt-1 tabular-nums ${isSelected ? 'text-stone-600' : 'text-rose-200/80'}`}>
                      {stats.total} {stats.total > 1 ? 'idées' : 'idée'}
                    </span>

                    {stats.reserved > 0 && (
                      <span className={`text-[10px] font-medium mt-0.5 ${isSelected ? 'text-emerald-700' : 'text-emerald-300'}`}>
                        {stats.reserved} {stats.reserved > 1 ? 'réservés' : 'réservé'}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Bottom 2-column KPI Strip */}
        <div className="mt-8 pt-6 border-t border-white/15 grid grid-cols-2 gap-4 text-xs max-w-md">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/10 text-rose-200">
              <Gift className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold text-white text-sm tabular-nums">{totalCount} souhaits</div>
              <div className="text-rose-200/70 text-[11px]">Sur les 3 listes</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-white/10 text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div>
              <div className="font-semibold text-white text-sm tabular-nums">{reservedCount} réservés</div>
              <div className="text-rose-200/70 text-[11px]">{Math.round((reservedCount / (totalCount || 1)) * 100)}% de la hotte prête</div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};

import React from 'react';
import { Gift, Sparkles, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { FamilyMember } from '../types';

interface NavbarProps {
  currentTab: FamilyMember | 'all';
  onSelectTab: (tab: FamilyMember | 'all') => void;
  onOpenAddModal: () => void;
  onOpenGitHubModal: () => void;
  surpriseMode: boolean;
  onToggleSurpriseMode: () => void;
  viewer: FamilyMember | 'all';
  onChangeViewer: (viewer: FamilyMember | 'all') => void;
  isAdmin: boolean;
  onOpenAdminModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  onOpenAddModal,
  surpriseMode,
  onToggleSurpriseMode,
  isAdmin,
  onOpenAdminModal,
}) => {
  return (
    <header className="sticky top-0 z-40 border-b border-rose-100 bg-white/95 backdrop-blur-md shadow-xs">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
        
        {/* Zone 1: Brand Wordmark (Single text element) */}
        <button
          onClick={() => onSelectTab('all')}
          className="group flex items-center gap-2.5 text-left text-rose-950 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-rose-700 text-white shadow-xs">
            <Gift className="h-5 w-5" />
          </span>
          <span className="font-serif text-xl font-bold tracking-tight text-red-950">
            Listes de Noël
          </span>
        </button>

        {/* Zone 2: Navigation Links (single-line, concise) */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium">
          <button
            onClick={() => onSelectTab('all')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              currentTab === 'all'
                ? 'text-red-700 font-semibold border-b-2 border-red-600 pb-1'
                : 'text-stone-600 hover:text-red-800'
            }`}
          >
            Toutes les listes
          </button>
          <button
            onClick={() => onSelectTab('Audrey')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              currentTab === 'Audrey'
                ? 'text-rose-700 font-semibold border-b-2 border-rose-600 pb-1'
                : 'text-stone-600 hover:text-rose-700'
            }`}
          >
            Audrey
          </button>
          <button
            onClick={() => onSelectTab('Arthur')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              currentTab === 'Arthur'
                ? 'text-emerald-700 font-semibold border-b-2 border-emerald-600 pb-1'
                : 'text-stone-600 hover:text-emerald-700'
            }`}
          >
            Arthur
          </button>
          <button
            onClick={() => onSelectTab('Zoé')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              currentTab === 'Zoé'
                ? 'text-amber-700 font-semibold border-b-2 border-amber-600 pb-1'
                : 'text-stone-600 hover:text-amber-700'
            }`}
          >
            Zoé
          </button>
        </nav>

        {/* Zone 3: Primary Action & Utilities */}
        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          
          {/* Surprise Mode toggle */}
          <button
            onClick={onToggleSurpriseMode}
            title={surpriseMode ? "Mode Surprise actif (les réservations sont masquées pour préserver le mystère)" : "Mode Secret (voir qui a réservé quoi)"}
            className={`hidden sm:flex items-center gap-1.5 h-9 px-2.5 rounded-lg border text-xs font-medium transition-all ${
              surpriseMode
                ? 'border-purple-200 bg-purple-50 text-purple-700 shadow-xs'
                : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50'
            }`}
          >
            {surpriseMode ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            <span className="whitespace-nowrap hidden lg:inline">{surpriseMode ? "Mode Surprise" : "Mode Secret"}</span>
          </button>

          {/* Admin / Visitor Lock Switcher */}
          <button
            onClick={onOpenAdminModal}
            title={isAdmin ? "Mode administration actif (cliquer pour gérer/verrouiller)" : "Se connecter en administration pour modifier les listes"}
            className={`flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium transition-all shadow-xs whitespace-nowrap ${
              isAdmin
                ? 'border-amber-300 bg-amber-50 text-amber-900 font-semibold'
                : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            {isAdmin ? (
              <>
                <Unlock className="h-3.5 w-3.5 text-amber-600" />
                <span>Admin Actif</span>
              </>
            ) : (
              <>
                <Lock className="h-3.5 w-3.5 text-stone-400" />
                <span className="hidden sm:inline">Admin</span>
              </>
            )}
          </button>

          {/* Admin-only Primary CTA: Add Gift */}
          {isAdmin ? (
            <button
              onClick={onOpenAddModal}
              className="flex items-center gap-2 h-9 px-4 rounded-lg bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-xs font-semibold text-white shadow-sm hover:from-red-700 hover:to-rose-800 transition-all active:scale-[0.98] whitespace-nowrap"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Ajouter une idée</span>
            </button>
          ) : (
            <span className="hidden xl:inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-stone-500 bg-stone-100 rounded-lg">
              Mode Visiteur
            </span>
          )}

        </div>
      </div>
    </header>
  );
};

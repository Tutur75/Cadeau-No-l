/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Gift, Plus, Sparkles, Database, GitBranch, Lock, Unlock, ShieldCheck, LogOut, Layers, Tag } from 'lucide-react';
import { GiftItem, FamilyMember, FilterState, CATEGORIES } from './types';
import {
  fetchGifts,
  createGift,
  updateGift,
  deleteGift,
  reserveGift,
  unreserveGift,
  subscribeToGifts,
  saveGiftsToCache,
} from './services/api';
import { Navbar } from './components/Navbar';
import { HeroBanner } from './components/HeroBanner';
import { FilterBar } from './components/FilterBar';
import { GiftCard } from './components/GiftCard';
import { AddGiftModal } from './components/AddGiftModal';
import { ReserveModal } from './components/ReserveModal';
import { GitHubModal } from './components/GitHubModal';
import { AdminModal } from './components/AdminModal';
import { DeleteModal } from './components/DeleteModal';
import { SnowEffect } from './components/SnowEffect';
import { ImageModal } from './components/ImageModal';

const ADMIN_CODE_KEY = 'milirose_admin_code_v2';
const ADMIN_SESSION_KEY = 'milirose_is_admin_v2';
const DEFAULT_ADMIN_CODE = 'Zoé2019';

// Category icons / badges
const CATEGORY_EMOJIS: Record<string, string> = {
  'Poupées': '🪆',
  'Maison & Décoration': '🏡',
  'High-Tech & Audio': '🎧',
  'Mode & Accessoires': '🧣',
  'Sport & Outdoor': '🎿',
  'Jeux & Loisirs': '🎲',
  'Livres & Culture': '📚',
  'Beauté & Bien-être': '✨',
  'Gastronomie': '☕',
};

// Helper to guarantee unique gifts by id across real-time sync and local states
function deduplicateGifts(items: GiftItem[]): GiftItem[] {
  const seen = new Set<string>();
  const unique: GiftItem[] = [];
  for (const item of items) {
    if (item && item.id && !seen.has(item.id)) {
      seen.add(item.id);
      unique.push(item);
    }
  }
  return unique;
}

export default function App() {
  const [gifts, setGifts] = useState<GiftItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Administration state
  const [isAdmin, setIsAdmin] = useState<boolean>(() => {
    return localStorage.getItem(ADMIN_SESSION_KEY) === 'true';
  });
  const [adminCode, setAdminCode] = useState<string>(() => {
    return localStorage.getItem(ADMIN_CODE_KEY) || DEFAULT_ADMIN_CODE;
  });
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);

  // View & Filter states
  const [selectedRecipient, setSelectedRecipient] = useState<FamilyMember | 'all'>('all');
  const [groupByCategory, setGroupByCategory] = useState(true);

  const [filter, setFilter] = useState<FilterState>({
    search: '',
    recipient: 'all',
    category: 'Toutes les catégories',
    status: 'all',
    priceRange: 'all',
    sortBy: 'priority',
  });

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingGift, setEditingGift] = useState<GiftItem | null>(null);

  const [isReserveModalOpen, setIsReserveModalOpen] = useState(false);
  const [reservingGift, setReservingGift] = useState<GiftItem | null>(null);

  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingGift, setDeletingGift] = useState<GiftItem | null>(null);

  const [isGitHubModalOpen, setIsGitHubModalOpen] = useState(false);

  // Zoom lightbox state for photos
  const [zoomedGift, setZoomedGift] = useState<GiftItem | null>(null);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Initial data load
  const loadGifts = async () => {
    setIsLoading(true);
    try {
      const data = await fetchGifts();
      setGifts(deduplicateGifts(data));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadGifts();

    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeToGifts(
        (realtimeGifts) => {
          if (realtimeGifts && realtimeGifts.length > 0) {
            setGifts(deduplicateGifts(realtimeGifts));
            saveGiftsToCache(realtimeGifts);
            setIsLoading(false);
          }
        },
        (error) => {
          console.warn('Firestore real-time sync connection notice:', error);
        }
      );
    } catch {
      // ignore
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  // Admin authentication handlers: accepts "Zoé2019" or "Zoe2019"
  const handleAdminLogin = (enteredCode: string): boolean => {
    const normalize = (s: string) =>
      s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

    const matches =
      enteredCode.trim() === adminCode.trim() ||
      enteredCode.trim() === 'Zoé2019' ||
      enteredCode.trim() === 'Zoe2019' ||
      normalize(enteredCode) === 'ZOE2019' ||
      normalize(enteredCode) === normalize(adminCode);

    if (matches) {
      setIsAdmin(true);
      localStorage.setItem(ADMIN_SESSION_KEY, 'true');
      showToast('👑 Mode administration déverrouillé !');
      return true;
    }
    return false;
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    localStorage.removeItem(ADMIN_SESSION_KEY);
    showToast('🔒 Vous êtes maintenant en mode visiteur (lecture seule).');
  };

  const handleChangeAdminCode = (oldPin: string, newPin: string): boolean => {
    const normalize = (s: string) =>
      s.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();

    if (
      normalize(oldPin) === normalize(adminCode) ||
      oldPin.trim() === 'Zoé2019' ||
      oldPin.trim() === 'Zoe2019'
    ) {
      setAdminCode(newPin.trim());
      localStorage.setItem(ADMIN_CODE_KEY, newPin.trim());
      return true;
    }
    return false;
  };

  // Synchronize filter recipient with selected recipient
  const handleSelectTab = (tab: FamilyMember | 'all') => {
    setSelectedRecipient(tab);
    setFilter(prev => ({ ...prev, recipient: tab }));
  };

  const handleUpdateFilter = (updates: Partial<FilterState>) => {
    setFilter(prev => {
      const next = { ...prev, ...updates };
      if (updates.recipient !== undefined) {
        setSelectedRecipient(updates.recipient);
      }
      return next;
    });
  };

  const handleResetFilter = () => {
    setFilter({
      search: '',
      recipient: 'all',
      category: 'Toutes les catégories',
      status: 'all',
      priceRange: 'all',
      sortBy: 'priority',
    });
    setSelectedRecipient('all');
  };

  // CRUD Handlers
  const handleSaveGift = async (giftData: Partial<GiftItem>) => {
    if (!isAdmin) {
      showToast('⚠️ Vous devez être en mode administrateur pour modifier la liste.');
      setIsAdminModalOpen(true);
      return;
    }

    if (editingGift) {
      const updated = await updateGift(editingGift.id, giftData);
      setGifts(prev => deduplicateGifts(prev.map(g => (g.id === updated.id ? updated : g))));
      showToast(`✨ « ${updated.title} » a été mis à jour.`);
    } else {
      const created = await createGift(giftData);
      setGifts(prev => {
        if (prev.some(g => g.id === created.id)) {
          return prev;
        }
        return deduplicateGifts([created, ...prev]);
      });
      showToast(`🎁 « ${created.title} » a été ajouté à la liste de ${created.recipient} !`);
    }
    setEditingGift(null);
  };

  const promptDeleteGift = (id: string) => {
    if (!isAdmin) {
      showToast('⚠️ Action réservée aux administrateurs.');
      setIsAdminModalOpen(true);
      return;
    }

    const item = gifts.find(g => g.id === id);
    if (!item) return;

    setDeletingGift(item);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (id: string) => {
    const item = gifts.find(g => g.id === id);
    await deleteGift(id);
    setGifts(prev => prev.filter(g => g.id !== id));
    showToast(`🗑️ « ${item?.title || 'Cadeau'} » a été définitivement supprimé.`);
    setIsDeleteModalOpen(false);
    setDeletingGift(null);
  };

  // Reservations are OPEN to ALL Visitors and Family members
  const handleReserve = async (giftId: string, name: string, note?: string) => {
    const updated = await reserveGift(giftId, name, note);
    setGifts(prev => prev.map(g => (g.id === updated.id ? updated : g)));
    showToast(`🎄 Merci ${name} ! Le cadeau est réservé dans la hotte.`);
  };

  const handleUnreserve = async (giftId: string) => {
    const item = gifts.find(g => g.id === giftId);
    if (!item) return;

    if (confirm(`Voulez-vous libérer la réservation pour « ${item.title} » ?`)) {
      const updated = await unreserveGift(giftId);
      setGifts(prev => prev.map(g => (g.id === updated.id ? updated : g)));
      showToast(`Le cadeau est de nouveau disponible pour tous.`);
    }
  };

  // Filtered and sorted gifts
  const filteredGifts = useMemo(() => {
    const uniqueGifts = deduplicateGifts(gifts);
    return uniqueGifts.filter(gift => {
      // Recipient filter
      if (filter.recipient !== 'all' && gift.recipient !== filter.recipient) {
        return false;
      }

      // Category filter
      if (filter.category !== 'Toutes les catégories' && gift.category !== filter.category) {
        return false;
      }

      // Status filter
      if (filter.status === 'available' && gift.isReserved) return false;
      if (filter.status === 'reserved' && !gift.isReserved) return false;
      if (filter.status === 'favorites' && gift.priority !== 'Coup de cœur') return false;

      // Price filter
      if (filter.priceRange === 'under30' && (gift.price >= 30 || gift.price === 0)) return false;
      if (filter.priceRange === '30to75' && (gift.price < 30 || gift.price > 75)) return false;
      if (filter.priceRange === 'over75' && gift.price <= 75) return false;

      // Search keyword
      if (filter.search.trim()) {
        const q = filter.search.toLowerCase();
        const matchesTitle = gift.title.toLowerCase().includes(q);
        const matchesDesc = gift.description?.toLowerCase().includes(q);
        const matchesStore = gift.storeName?.toLowerCase().includes(q);
        const matchesCategory = gift.category.toLowerCase().includes(q);
        const matchesPerson = gift.recipient.toLowerCase().includes(q);
        if (!matchesTitle && !matchesDesc && !matchesStore && !matchesCategory && !matchesPerson) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (filter.sortBy === 'priority') {
        const priorityOrder: Record<string, number> = {
          'Coup de cœur': 3,
          'Très souhaité': 2,
          'Souhaité': 1,
        };
        const pA = priorityOrder[a.priority] || 0;
        const pB = priorityOrder[b.priority] || 0;
        return pB - pA;
      }
      if (filter.sortBy === 'price-asc') {
        return (a.price || 0) - (b.price || 0);
      }
      if (filter.sortBy === 'price-desc') {
        return (b.price || 0) - (a.price || 0);
      }
      return 0;
    });
  }, [gifts, filter]);

  // Group gifts by category when classification mode is enabled
  const groupedCategories = useMemo(() => {
    const groups: { category: string; gifts: GiftItem[] }[] = [];
    const map = new Map<string, GiftItem[]>();

    filteredGifts.forEach(gift => {
      const cat = gift.category || 'Autres souhaits';
      if (!map.has(cat)) {
        map.set(cat, []);
      }
      const existingInGroup = map.get(cat)!;
      if (!existingInGroup.some(g => g.id === gift.id)) {
        existingInGroup.push(gift);
      }
    });

    map.forEach((items, category) => {
      groups.push({ category, gifts: items });
    });

    return groups;
  }, [filteredGifts]);

  return (
    <div className="min-h-screen bg-[#faf7f5] text-stone-900 flex flex-col font-sans selection:bg-rose-100 selection:text-rose-900 relative">
      {/* Continuous Snow Falling Effect */}
      <SnowEffect enabled={true} />

      {/* Navigation Header */}
      <Navbar
        currentTab={selectedRecipient}
        onSelectTab={handleSelectTab}
        onOpenAddModal={() => {
          setEditingGift(null);
          setIsAddModalOpen(true);
        }}
        isAdmin={isAdmin}
        onOpenAdminModal={() => setIsAdminModalOpen(true)}
      />

      {/* Admin Status Bar indicator (discreet bar when logged in) */}
      {isAdmin && (
        <div className="bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 text-stone-950 px-4 py-2 shadow-xs text-xs font-medium">
          <div className="mx-auto max-w-7xl flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 font-semibold">
              <ShieldCheck className="h-4 w-4" />
              <span>Mode Administration déverrouillé : vous pouvez ajouter, modifier et supprimer des cadeaux.</span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={() => {
                  setEditingGift(null);
                  setIsAddModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-stone-950 text-white text-xs font-semibold hover:bg-stone-900 transition-colors shadow-xs"
              >
                <Plus className="h-3 w-3" />
                <span>Nouveau cadeau</span>
              </button>
              <button
                onClick={handleAdminLogout}
                className="inline-flex items-center gap-1 text-xs text-stone-900 hover:text-white underline underline-offset-2 transition-colors"
              >
                <LogOut className="h-3 w-3" />
                <span>Verrouiller</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-6 relative z-10">
        
        {/* Hero Section */}
        <HeroBanner
          gifts={gifts}
          selectedRecipient={selectedRecipient}
          onSelectRecipient={handleSelectTab}
          onOpenAddModal={() => {
            setEditingGift(null);
            setIsAddModalOpen(true);
          }}
          isAdmin={isAdmin}
          onOpenAdminModal={() => setIsAdminModalOpen(true)}
        />

        {/* Filters and Controls */}
        <div id="wishlist-section">
          <FilterBar
            filter={filter}
            onChangeFilter={handleUpdateFilter}
            onResetFilter={handleResetFilter}
            totalFilteredCount={filteredGifts.length}
            groupByCategory={groupByCategory}
            onToggleGroupByCategory={() => setGroupByCategory(!groupByCategory)}
          />
        </div>

        {/* Content Section: Wishlist Grid */}
        {isLoading ? (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <Gift className="h-10 w-10 text-rose-800 animate-bounce mb-3" />
            <p className="text-sm font-medium text-stone-600">Chargement des listes de cadeaux...</p>
          </div>
        ) : filteredGifts.length > 0 ? (
          groupByCategory ? (
            /* Grouped by Category View */
            <div className="space-y-10">
              {groupedCategories.map(group => (
                <section key={group.category} className="space-y-4">
                  
                  {/* Category Header */}
                  <div className="flex items-center justify-between border-b border-stone-200 pb-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="text-xl" aria-hidden="true">
                        {CATEGORY_EMOJIS[group.category] || '🎁'}
                      </span>
                      <h2 className="font-serif text-lg sm:text-xl font-bold text-stone-900">
                        {group.category}
                      </h2>
                    </div>
                    <span className="text-xs font-semibold text-stone-500 tabular-nums bg-stone-100 px-2.5 py-1 rounded-md">
                      {group.gifts.length} {group.gifts.length > 1 ? 'idées' : 'idée'}
                    </span>
                  </div>

                  {/* Cards Grid: Concise 4-columns layout */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
                    {group.gifts.map(gift => (
                      <GiftCard
                        key={gift.id}
                        gift={gift}
                        isAdmin={isAdmin}
                        onOpenReserveModal={item => {
                          setReservingGift(item);
                          setIsReserveModalOpen(true);
                        }}
                        onUnreserve={handleUnreserve}
                        onEdit={item => {
                          setEditingGift(item);
                          setIsAddModalOpen(true);
                        }}
                        onDelete={promptDeleteGift}
                        onZoomImage={setZoomedGift}
                      />
                    ))}
                  </div>

                </section>
              ))}
            </div>
          ) : (
            /* Flat Grid View: Concise 4-columns layout */
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {filteredGifts.map(gift => (
                <GiftCard
                  key={gift.id}
                  gift={gift}
                  isAdmin={isAdmin}
                  onOpenReserveModal={item => {
                    setReservingGift(item);
                    setIsReserveModalOpen(true);
                  }}
                  onUnreserve={handleUnreserve}
                  onEdit={item => {
                    setEditingGift(item);
                    setIsAddModalOpen(true);
                  }}
                  onDelete={promptDeleteGift}
                  onZoomImage={setZoomedGift}
                />
              ))}
            </div>
          )
        ) : (
          /* Empty state */
          <div className="rounded-2xl border-2 border-dashed border-stone-200 bg-white/60 p-12 text-center max-w-md mx-auto my-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-700 mb-4 shadow-xs">
              <Gift className="h-7 w-7" />
            </div>
            <h3 className="font-serif text-lg font-bold text-stone-900 mb-1">
              Aucun cadeau ne correspond à vos filtres
            </h3>
            <p className="text-xs text-stone-500 mb-5 leading-relaxed">
              {isAdmin
                ? "Vous pouvez ajouter une nouvelle idée de cadeau avec le lien d'un magasin."
                : "Les cadeaux disponibles apparaîtront ici. Essayez de réinitialiser vos critères de recherche."}
            </p>
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleResetFilter}
                className="px-4 py-2 rounded-lg border border-stone-200 bg-white text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-colors"
              >
                Réinitialiser les filtres
              </button>
              {isAdmin && (
                <button
                  onClick={() => {
                    setEditingGift(null);
                    setIsAddModalOpen(true);
                  }}
                  className="px-4 py-2 rounded-lg bg-stone-900 text-white text-xs font-semibold hover:bg-stone-800 transition-colors"
                >
                  + Ajouter une idée
                </button>
              )}
            </div>
          </div>
        )}

      </main>

      {/* Holiday Footer */}
      <footer className="mt-16 border-t border-rose-100/80 bg-white py-8 text-xs text-stone-500 relative z-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-serif font-bold text-stone-800 text-sm">
              Listes de Noël 2026 · Audrey, Arthur &amp; Zoé
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* Status indicator */}
            <button
              onClick={() => setIsAdminModalOpen(true)}
              className="flex items-center gap-1.5 text-stone-600 hover:text-stone-950 transition-colors"
            >
              {isAdmin ? (
                <>
                  <Unlock className="h-3.5 w-3.5 text-amber-600" />
                  <span className="font-medium text-amber-900">Administration active</span>
                </>
              ) : (
                <>
                  <Lock className="h-3.5 w-3.5 text-stone-400" />
                  <span>Mode Visiteur (Accès Admin)</span>
                </>
              )}
            </button>

            <span>·</span>

            <button
              onClick={() => setIsGitHubModalOpen(true)}
              className="flex items-center gap-1.5 text-stone-600 hover:text-stone-950 transition-colors"
              title="Gérer les sauvegardes, exports et la base Firebase"
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <Database className="h-3.5 w-3.5 text-amber-600" />
              <span>Firebase Firestore</span>
            </button>

            <span>·</span>

            <button
              onClick={() => setIsGitHubModalOpen(true)}
              className="flex items-center gap-1.5 text-stone-600 hover:text-stone-950 transition-colors"
            >
              <GitBranch className="h-3.5 w-3.5" />
              <span>GitHub</span>
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AdminModal
        isOpen={isAdminModalOpen}
        onClose={() => setIsAdminModalOpen(false)}
        isAdmin={isAdmin}
        onLogin={handleAdminLogin}
        onLogout={handleAdminLogout}
        onChangeCode={handleChangeAdminCode}
      />

      <AddGiftModal
        isOpen={isAddModalOpen}
        onClose={() => {
          setIsAddModalOpen(false);
          setEditingGift(null);
        }}
        onAddGift={handleSaveGift}
        defaultRecipient={selectedRecipient === 'all' ? 'Audrey' : selectedRecipient}
        initialEditGift={editingGift}
        onDeleteGift={promptDeleteGift}
      />

      <DeleteModal
        isOpen={isDeleteModalOpen}
        gift={deletingGift}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setDeletingGift(null);
        }}
        onConfirmDelete={handleConfirmDelete}
      />

      <ReserveModal
        isOpen={isReserveModalOpen}
        gift={reservingGift}
        onClose={() => {
          setIsReserveModalOpen(false);
          setReservingGift(null);
        }}
        onConfirmReserve={handleReserve}
      />

      <GitHubModal
        isOpen={isGitHubModalOpen}
        onClose={() => setIsGitHubModalOpen(false)}
        gifts={gifts}
        onDataReload={loadGifts}
      />

      {/* Enlarged Photo Lightbox Modal */}
      <ImageModal
        isOpen={Boolean(zoomedGift)}
        gift={zoomedGift}
        onClose={() => setZoomedGift(null)}
      />

      {/* Toast popup */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-stone-950 px-4 py-3 text-xs font-semibold text-white shadow-2xl animate-fade-in border border-stone-800">
          <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

    </div>
  );
}

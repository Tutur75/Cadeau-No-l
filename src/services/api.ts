import { GiftItem } from '../types';
import defaultWishlist from '../../data/wishlist.json';
import {
  getGiftsFromFirestore,
  saveGiftToFirestore,
  updateGiftInFirestore,
  deleteGiftFromFirestore,
  subscribeToGifts,
} from './firebase';

const STORAGE_KEY = 'milirose_christmas_gifts_v1';

export { subscribeToGifts };

export async function fetchGifts(): Promise<GiftItem[]> {
  // 1. Try Firebase Firestore
  try {
    const firestoreGifts = await getGiftsFromFirestore();
    if (firestoreGifts && firestoreGifts.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(firestoreGifts));
      return firestoreGifts;
    }

    // If Firestore is empty on initial load, seed with bundled wishlist
    const bundledData = defaultWishlist as GiftItem[];
    if (bundledData.length > 0) {
      for (const item of bundledData) {
        saveGiftToFirestore(item).catch(() => {});
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bundledData));
      return bundledData;
    }
  } catch (err) {
    console.warn('Firestore fetch failed, checking server/cache fallback:', err);
  }

  // 2. Server API fallback (when running with Express backend)
  try {
    const res = await fetch('/api/gifts');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (err) {
    console.warn('API fetch failed, falling back to local storage cache:', err);
  }

  // 3. LocalStorage fallback
  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }

  // 4. Ultimate bundled fallback (guarantees gifts are always visible even completely offline)
  return (defaultWishlist as GiftItem[]) || [];
}

export async function createGift(giftData: Partial<GiftItem>): Promise<GiftItem> {
  const newItem: GiftItem = {
    id: `gift-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    recipient: giftData.recipient || 'Audrey',
    title: giftData.title || 'Idée cadeau',
    description: giftData.description || '',
    price: typeof giftData.price === 'number' ? giftData.price : Number(giftData.price) || 0,
    category: giftData.category || 'Maison & Décoration',
    priority: giftData.priority || 'Très souhaité',
    storeName: giftData.storeName || '',
    url: giftData.url || '',
    imageUrl: giftData.imageUrl || '',
    isReserved: false,
    reservedBy: null,
    reservedAt: null,
    reservationNote: null,
    isSecretIdea: (giftData.recipient === 'Zoé') ? false : true,
    addedBy: giftData.addedBy || giftData.recipient || 'Audrey',
    contributions: [],
  };

  // Primary: Save in Firestore
  try {
    await saveGiftToFirestore(newItem);
  } catch (err) {
    console.warn('Failed saving to Firestore directly, trying backend:', err);
  }

  // Backup: sync to backend server DB
  fetch('/api/gifts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newItem),
  }).catch(() => {});

  // Update localStorage
  const cached: GiftItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const filtered = cached.filter(g => g.id !== newItem.id);
  filtered.unshift(newItem);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

  return newItem;
}

export async function updateGift(id: string, updates: Partial<GiftItem>): Promise<GiftItem> {
  // Primary: Update in Firestore
  try {
    await updateGiftInFirestore(id, updates);
  } catch (err) {
    console.warn('Failed updating in Firestore, trying backend:', err);
  }

  // Backup: sync to backend server DB
  fetch(`/api/gifts/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  }).catch(() => {});

  // Update local cache
  const cached: GiftItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const index = cached.findIndex(g => g.id === id);
  if (index !== -1) {
    cached[index] = { ...cached[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    return cached[index];
  }

  return { id, ...updates } as GiftItem;
}

export async function deleteGift(id: string): Promise<boolean> {
  // Primary: Delete in Firestore
  try {
    await deleteGiftFromFirestore(id);
  } catch (err) {
    console.warn('Failed deleting in Firestore, trying backend:', err);
  }

  // Backup: sync to backend server DB
  fetch(`/api/gifts/${id}`, { method: 'DELETE' }).catch(() => {});

  // Update local cache
  const cached: GiftItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const filtered = cached.filter(g => g.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

  return true;
}

export async function reserveGift(id: string, reservedBy: string, reservationNote?: string): Promise<GiftItem> {
  const updates: Partial<GiftItem> = {
    isReserved: true,
    reservedBy: reservedBy.trim(),
    reservedAt: new Date().toISOString(),
    reservationNote: reservationNote ? reservationNote.trim() : null,
  };

  return updateGift(id, updates);
}

export async function unreserveGift(id: string): Promise<GiftItem> {
  const updates: Partial<GiftItem> = {
    isReserved: false,
    reservedBy: null,
    reservedAt: null,
    reservationNote: null,
  };

  return updateGift(id, updates);
}

export async function contributeGift(id: string, name: string, amount: number): Promise<GiftItem> {
  return updateGift(id, {
    isReserved: true,
    reservedBy: name,
    reservedAt: new Date().toISOString(),
  });
}

export async function scrapeLink(url: string) {
  const res = await fetch('/api/scrape-link', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Erreur lors de l\'analyse du lien');
  }
  return await res.json();
}

export async function getAiSuggestions(person: string, interests?: string, budgetRange?: string) {
  const res = await fetch('/api/ai-suggest-gifts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ person, interests, budgetRange }),
  });
  if (!res.ok) {
    throw new Error('Erreur lors de la récupération des idées');
  }
  return await res.json();
}

export async function importGifts(gifts: GiftItem[]) {
  // Sync to Firestore
  for (const gift of gifts) {
    await saveGiftToFirestore(gift).catch(() => {});
  }

  const res = await fetch('/api/import-database', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ gifts }),
  });
  if (!res.ok) {
    throw new Error('Erreur lors de l\'import');
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(gifts));
  return await res.json();
}

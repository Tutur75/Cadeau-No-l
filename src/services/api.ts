import { GiftItem } from '../types';

const STORAGE_KEY = 'milirose_christmas_gifts_v1';

export async function fetchGifts(): Promise<GiftItem[]> {
  try {
    const res = await fetch('/api/gifts');
    if (res.ok) {
      const data = await res.json();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return data;
    }
  } catch (err) {
    console.warn('API fetch failed, falling back to local storage cache:', err);
  }

  const cached = localStorage.getItem(STORAGE_KEY);
  if (cached) {
    try {
      return JSON.parse(cached);
    } catch {
      // ignore
    }
  }
  return [];
}

export async function createGift(giftData: Partial<GiftItem>): Promise<GiftItem> {
  try {
    const res = await fetch('/api/gifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(giftData),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to create gift via API:', err);
  }

  // Local fallback
  const cached: GiftItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const newItem: GiftItem = {
    id: `local-${Date.now()}`,
    recipient: giftData.recipient || 'Audrey',
    title: giftData.title || 'Idée cadeau',
    description: giftData.description || '',
    price: giftData.price || 0,
    category: giftData.category || 'Maison & Décoration',
    priority: giftData.priority || 'Très souhaité',
    storeName: giftData.storeName || '',
    url: giftData.url || '',
    imageUrl: giftData.imageUrl || '',
    isReserved: false,
    reservedBy: null,
    reservedAt: null,
    reservationNote: null,
    isSecretIdea: giftData.isSecretIdea || false,
    addedBy: giftData.addedBy || 'Audrey',
    contributions: [],
  };
  cached.unshift(newItem);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
  return newItem;
}

export async function updateGift(id: string, updates: Partial<GiftItem>): Promise<GiftItem> {
  try {
    const res = await fetch(`/api/gifts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to update gift via API:', err);
  }

  const cached: GiftItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const index = cached.findIndex(g => g.id === id);
  if (index !== -1) {
    cached[index] = { ...cached[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    return cached[index];
  }
  throw new Error('Cadeau non trouvé');
}

export async function deleteGift(id: string): Promise<boolean> {
  // Always update localStorage cache
  const cached: GiftItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const filtered = cached.filter(g => g.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));

  try {
    const res = await fetch(`/api/gifts/${id}`, { method: 'DELETE' });
    if (res.ok) {
      return true;
    }
  } catch (err) {
    console.error('Failed to delete gift via API:', err);
  }

  return true;
}

export async function reserveGift(id: string, reservedBy: string, reservationNote?: string): Promise<GiftItem> {
  try {
    const res = await fetch(`/api/gifts/${id}/reserve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reservedBy, reservationNote }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to reserve gift via API:', err);
  }

  return updateGift(id, {
    isReserved: true,
    reservedBy,
    reservedAt: new Date().toISOString(),
    reservationNote: reservationNote || null,
  });
}

export async function unreserveGift(id: string): Promise<GiftItem> {
  try {
    const res = await fetch(`/api/gifts/${id}/unreserve`, { method: 'POST' });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to unreserve gift via API:', err);
  }

  return updateGift(id, {
    isReserved: false,
    reservedBy: null,
    reservedAt: null,
    reservationNote: null,
  });
}

export async function contributeGift(id: string, name: string, amount: number): Promise<GiftItem> {
  try {
    const res = await fetch(`/api/gifts/${id}/contribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, amount }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.error('Failed to contribute via API:', err);
  }

  const cached: GiftItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  const item = cached.find(g => g.id === id);
  if (item) {
    if (!item.contributions) item.contributions = [];
    item.contributions.push({ name, amount, date: new Date().toISOString() });
    const total = item.contributions.reduce((s, c) => s + c.amount, 0);
    if (total >= item.price && !item.isReserved) {
      item.isReserved = true;
      item.reservedBy = 'Cagnotte commune';
      item.reservedAt = new Date().toISOString();
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    return item;
  }
  throw new Error('Cadeau non trouvé');
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

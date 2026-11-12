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

// Smart curated fallback images when website blocks image direct scraping
function getSmartFallbackImage(title: string, category: string): string {
  const t = (title || '').toLowerCase();
  if (t.includes('liseuse') || t.includes('kindle') || t.includes('livre') || t.includes('roman') || t.includes('bd') || t.includes('manga') || t.includes('book')) {
    return 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80';
  }
  if (t.includes('casque') || t.includes('audio') || t.includes('écouteur') || t.includes('airpods') || t.includes('enceinte')) {
    return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80';
  }
  if (t.includes('photo') || t.includes('appareil') || t.includes('instax') || t.includes('polaroid') || t.includes('camera')) {
    return 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?auto=format&fit=crop&w=800&q=80';
  }
  if (t.includes('pull') || t.includes('écharpe') || t.includes('cachemire') || t.includes('laine') || t.includes('veste') || t.includes('manteau') || t.includes('sac')) {
    return 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=800&q=80';
  }
  if (t.includes('thé') || t.includes('tisane') || t.includes('infusion') || t.includes('mug') || t.includes('bougie') || t.includes('diffuseur')) {
    return 'https://images.unsplash.com/photo-1576092768241-dec231879fc3?auto=format&fit=crop&w=800&q=80';
  }
  if (t.includes('café') || t.includes('moulin') || t.includes('espresso') || t.includes('tasse')) {
    return 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=800&q=80';
  }
  if (t.includes('jeu') || t.includes('lego') || t.includes('société') || t.includes('puzzle') || t.includes('jouet')) {
    return 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=800&q=80';
  }
  if (t.includes('parfum') || t.includes('soin') || t.includes('crème') || t.includes('beauté') || t.includes('maquillage')) {
    return 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80';
  }
  if (t.includes('sport') || t.includes('ski') || t.includes('vélo') || t.includes('velo') || t.includes('randonnée') || t.includes('camping') || t.includes('fitness') || t.includes('running') || t.includes('escalade') || t.includes('outdoor')) {
    return 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80';
  }
  if (t.includes('poupée') || t.includes('poupee') || t.includes('barbie') || t.includes('peluche') || t.includes('doll') || t.includes('doudou') || t.includes('poupon') || t.includes('corolle')) {
    return 'https://images.unsplash.com/photo-1558877385-81a1c7e67d72?auto=format&fit=crop&w=800&q=80';
  }

  switch (category) {
    case 'Poupées':
      return 'https://images.unsplash.com/photo-1558877385-81a1c7e67d72?auto=format&fit=crop&w=800&q=80';
    case 'Sport & Outdoor':
      return 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80';
    case 'High-Tech & Audio':
      return 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=800&q=80';
    case 'Mode & Accessoires':
      return 'https://images.unsplash.com/photo-1576566588028-4147f3842f27?auto=format&fit=crop&w=800&q=80';
    case 'Livres & Culture':
      return 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80';
    case 'Jeux & Loisirs':
      return 'https://images.unsplash.com/photo-1610890716171-6b1bb98ffd09?auto=format&fit=crop&w=800&q=80';
    case 'Beauté & Bien-être':
      return 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&w=800&q=80';
    default:
      return 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=800&q=80';
  }
}

// Helper to merge lists of gifts by id, preserving custom additions and latest updates
function mergeGiftLists(...lists: (GiftItem[] | null | undefined)[]): GiftItem[] {
  const map = new Map<string, GiftItem>();
  for (const list of lists) {
    if (Array.isArray(list)) {
      for (const item of list) {
        if (item && item.id) {
          const existing = map.get(item.id);
          if (!existing) {
            map.set(item.id, item);
          } else {
            // Merge with preference to reservations or newer updates
            map.set(item.id, {
              ...existing,
              ...item,
              isReserved: Boolean(item.isReserved || existing.isReserved),
              reservedBy: item.reservedBy || existing.reservedBy,
              reservationNote: item.reservationNote || existing.reservationNote,
            });
          }
        }
      }
    }
  }
  return Array.from(map.values());
}

// Safe localStorage helper that gracefully handles browser storage quotas without throwing
function safeSetLocalStorage(key: string, data: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn('Browser localStorage quota exceeded, attempting sanitized cache:', err);
    try {
      if (Array.isArray(data)) {
        // Strip heavy base64 data URLs (> 20KB) in local storage cache so it stays well under the 5MB browser limit
        const sanitized = data.map((item) => {
          if (
            item &&
            typeof item.imageUrl === 'string' &&
            item.imageUrl.startsWith('data:image/') &&
            item.imageUrl.length > 20000
          ) {
            return { ...item, imageUrl: '' };
          }
          return item;
        });
        localStorage.setItem(key, JSON.stringify(sanitized));
      }
    } catch {
      // If still exceeding or storage is disabled, fail silently without disrupting application flow
    }
  }
}

export function saveGiftsToCache(gifts: GiftItem[]): void {
  safeSetLocalStorage(STORAGE_KEY, gifts);
}

export async function fetchGifts(): Promise<GiftItem[]> {
  // Read local storage cache first
  let cachedGifts: GiftItem[] = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        cachedGifts = parsed;
      }
    }
  } catch {
    // ignore
  }

  // 1. Try Firebase Firestore
  let firestoreGifts: GiftItem[] | null = null;
  try {
    firestoreGifts = await getGiftsFromFirestore();
  } catch (err: any) {
    console.warn('Firestore fetch notice (quota or offline), proceeding with fallback:', err);
  }

  if (firestoreGifts && firestoreGifts.length > 0) {
    const merged = mergeGiftLists(cachedGifts, firestoreGifts);
    safeSetLocalStorage(STORAGE_KEY, merged);
    return merged;
  }

  // If local storage already has user gifts, preserve them
  if (cachedGifts.length > 0) {
    return cachedGifts;
  }

  // 2. Server API fallback (Express backend)
  try {
    const res = await fetch('/api/gifts');
    if (res.ok) {
      const serverGifts = await res.json();
      if (Array.isArray(serverGifts) && serverGifts.length > 0) {
        const merged = mergeGiftLists(cachedGifts, serverGifts);
        safeSetLocalStorage(STORAGE_KEY, merged);
        return merged;
      }
    }
  } catch (err) {
    console.warn('Backend /api/gifts fetch failed, checking local storage cache:', err);
  }

  // 3. LocalStorage fallback: Never erase user gifts if local storage has them
  if (cachedGifts.length > 0) {
    return cachedGifts;
  }

  // 4. Bundled fallback (only on very first clean install)
  const fallback = (defaultWishlist as GiftItem[]) || [];
  safeSetLocalStorage(STORAGE_KEY, fallback);
  return fallback;
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

  // 1. Immediately store in localStorage so UI is instantaneous and resilient
  try {
    const cached: GiftItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const filtered = cached.filter(g => g.id !== newItem.id);
    filtered.unshift(newItem);
    safeSetLocalStorage(STORAGE_KEY, filtered);
  } catch {
    // ignore
  }

  // 2. Primary: Save in Firestore
  try {
    await saveGiftToFirestore(newItem);
  } catch (err) {
    console.warn('Failed saving to Firestore directly (quota or offline), saving to backup:', err);
  }

  // 3. Backup: sync to backend server DB
  fetch('/api/gifts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newItem),
  }).catch(() => {});

  return newItem;
}

export async function updateGift(id: string, updates: Partial<GiftItem>): Promise<GiftItem> {
  // Update local cache immediately
  let updatedItem: GiftItem | null = null;
  try {
    const cached: GiftItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const index = cached.findIndex(g => g.id === id);
    if (index !== -1) {
      cached[index] = { ...cached[index], ...updates };
      updatedItem = cached[index];
      safeSetLocalStorage(STORAGE_KEY, cached);
    }
  } catch {
    // ignore
  }

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

  return updatedItem || ({ id, ...updates } as GiftItem);
}

export async function deleteGift(id: string): Promise<boolean> {
  // Update local cache immediately
  try {
    const cached: GiftItem[] = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const filtered = cached.filter(g => g.id !== id);
    safeSetLocalStorage(STORAGE_KEY, filtered);
  } catch {
    // ignore
  }

  // Primary: Delete in Firestore
  try {
    await deleteGiftFromFirestore(id);
  } catch (err) {
    console.warn('Failed deleting in Firestore, trying backend:', err);
  }

  // Backup: sync to backend server DB
  fetch(`/api/gifts/${id}`, { method: 'DELETE' }).catch(() => {});

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

export async function contributeGift(id: string, name: string, _amount: number): Promise<GiftItem> {
  return updateGift(id, {
    isReserved: true,
    reservedBy: name,
    reservedAt: new Date().toISOString(),
  });
}

// Client-side parser fallback when backend /api/scrape-link is unreachable (e.g. GitHub Pages static deployment)
function parseLinkClientSide(urlStr: string) {
  try {
    const cleanUrl = urlStr.startsWith('http') ? urlStr : `https://${urlStr}`;
    const parsed = new URL(cleanUrl);
    const domain = parsed.hostname.replace(/^www\./, '');

    const STORE_NAMES: Record<string, string> = {
      'amazon.fr': 'Amazon',
      'amazon.com': 'Amazon',
      'fnac.com': 'Fnac',
      'cultura.com': 'Cultura',
      'decathlon.fr': 'Decathlon',
      'sephora.fr': 'Sephora',
      'zara.com': 'Zara',
      'boulanger.com': 'Boulanger',
      'darty.com': 'Darty',
      'ikea.com': 'IKEA',
      'natureetdecouvertes.com': 'Nature & Découvertes',
      'rougier-ple.fr': 'Rougier & Plé',
      'philibertnet.com': 'Philibert',
      'etsy.com': 'Etsy',
      'king-jouet.com': 'King Jouet',
      'joueclub.fr': 'JouéClub',
      'oxybul.com': 'Oxybul',
      'laredoute.fr': 'La Redoute',
      'vertbaudet.fr': 'Vertbaudet',
      'apple.com': 'Apple',
      'corolle.com': 'Corolle',
      'playmobil.com': 'Playmobil',
      'lego.com': 'LEGO',
    };
    const siteName = STORE_NAMES[domain] || (domain.split('.')[0] ? domain.split('.')[0].toUpperCase() : domain);

    // Amazon ASIN check
    const asinMatch = cleanUrl.match(/(?:\/dp\/|\/product\/|\/gp\/product\/|\/d\/)([A-Z0-9]{10})/i) ||
                     cleanUrl.match(/\/([A-Z0-9]{10})(?:[/?#]|$)/i);
    const asin = asinMatch ? asinMatch[1] : null;

    // Segment extraction for title
    const pathSegments = parsed.pathname.split('/').filter(Boolean);
    const descriptiveSegments = pathSegments.filter(
      seg => !['dp', 'gp', 'product', 'd', 'p', 'item', 'ref', 'buy', 'fr'].includes(seg.toLowerCase()) &&
             !/^[A-Z0-9]{10}$/i.test(seg) &&
             !/^[a-z]?[0-9]+$/i.test(seg) &&
             seg.length > 2
    );
    const bestSegment = descriptiveSegments[0] || pathSegments[pathSegments.length - 1] || '';
    let title = decodeURIComponent(bestSegment)
      .replace(/[-_]/g, ' ')
      .replace(/\.(html|php|aspx|htm)$/i, '')
      .replace(/\b(dp|p|product|item|ref|gp|buy)\b/gi, '')
      .trim();

    if (title.length > 3 && !/^[A-Z0-9]{10}$/i.test(title)) {
      title = title.charAt(0).toUpperCase() + title.slice(1);
    } else {
      title = `Article ${siteName}`;
    }

    // Auto-categorize
    let category = 'Maison & Décoration';
    const lower = `${title} ${parsed.pathname}`.toLowerCase();
    if (lower.includes('poupée') || lower.includes('poupee') || lower.includes('barbie') || lower.includes('peluche') || lower.includes('doll') || lower.includes('doudou') || lower.includes('poupon') || lower.includes('corolle')) {
      category = 'Poupées';
    } else if (lower.includes('sport') || lower.includes('ski') || lower.includes('velo') || lower.includes('vélo') || lower.includes('rando') || lower.includes('randonnee') || lower.includes('randonnée') || lower.includes('camping') || lower.includes('fitness') || lower.includes('running') || lower.includes('escalade') || lower.includes('outdoor') || lower.includes('decathlon')) {
      category = 'Sport & Outdoor';
    } else if (lower.includes('livre') || lower.includes('roman') || lower.includes('bd') || lower.includes('manga') || lower.includes('book') || lower.includes('auteur')) {
      category = 'Livres & Culture';
    } else if (lower.includes('pull') || lower.includes('veste') || lower.includes('chaussure') || lower.includes('echarpe') || lower.includes('mode') || lower.includes('sac') || lower.includes('robe') || lower.includes('manteau')) {
      category = 'Mode & Accessoires';
    } else if (lower.includes('casque') || lower.includes('audio') || lower.includes('ecouteur') || lower.includes('enceinte') || lower.includes('tech') || lower.includes('console') || lower.includes('liseuse') || lower.includes('apple') || lower.includes('airpods')) {
      category = 'High-Tech & Audio';
    } else if (lower.includes('jeu') || lower.includes('jouet') || lower.includes('lego') || lower.includes('puzzle') || lower.includes('societe') || lower.includes('peinture') || lower.includes('atelier')) {
      category = 'Jeux & Loisirs';
    } else if (lower.includes('parfum') || lower.includes('creme') || lower.includes('soin') || lower.includes('beaute') || lower.includes('maquillage')) {
      category = 'Beauté & Bien-être';
    }

    let imageUrl = '';
    if (asin) {
      imageUrl = `https://images-na.ssl-images-amazon.com/images/P/${asin.toUpperCase()}.01.LZZZZZZZ.jpg`;
    } else {
      imageUrl = getSmartFallbackImage(title, category);
    }

    return {
      title,
      description: '',
      imageUrl,
      price: 0,
      domain,
      siteName,
      category,
      url: parsed.href,
    };
  } catch {
    return {
      title: 'Nouvelle idée cadeau',
      description: '',
      imageUrl: 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=800&q=80',
      price: 0,
      domain: '',
      siteName: '',
      category: 'Maison & Décoration',
      url: urlStr,
    };
  }
}

export async function scrapeLink(url: string) {
  try {
    const res = await fetch('/api/scrape-link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data && (data.title || data.imageUrl || data.siteName)) {
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend scrape endpoint unavailable, falling back to client-side extraction:', err);
  }

  // Client-side parser fallback guarantees it NEVER fails or throws a blocking error
  return parseLinkClientSide(url);
}

export async function getAiSuggestions(person: string, interests?: string, budgetRange?: string) {
  try {
    const res = await fetch('/api/ai-suggest-gifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person, interests, budgetRange }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch {
    // fallback
  }

  // Offline suggestions fallback
  return {
    gifts: [
      {
        title: `Kit dégustation thés d'hiver & miel pour ${person || 'les fêtes'}`,
        description: "Sélection festive aux épices chaudes et sablés artisanaux.",
        price: 32,
        category: "Maison & Décoration",
        storeName: "Palais des Thés",
        priority: "Très souhaité",
      },
      {
        title: "Écharpe chaude tissée en laine recyclée",
        description: "Ultra douce avec franges délicates, parfaite pour l'hiver.",
        price: 55,
        category: "Mode & Accessoires",
        storeName: "Boutique d'Hiver",
        priority: "Coup de cœur",
      },
      {
        title: "Jeu d'ambiance et énigmes de Noël",
        description: "Parties rapides et conviviales pour toute la famille au coin du sapin.",
        price: 24.90,
        category: "Jeux & Loisirs",
        storeName: "Philibert",
        priority: "Souhaité",
      }
    ]
  };
}

export async function importGifts(gifts: GiftItem[]) {
  // Save to localStorage immediately
  safeSetLocalStorage(STORAGE_KEY, gifts);

  // Sync to Firestore
  for (const gift of gifts) {
    await saveGiftToFirestore(gift).catch(() => {});
  }

  try {
    await fetch('/api/import-database', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gifts }),
    });
  } catch {
    // ignore
  }

  return { success: true, count: gifts.length };
}

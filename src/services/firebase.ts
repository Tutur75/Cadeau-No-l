import { initializeApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDocFromServer,
  setDoc,
  deleteDoc,
  onSnapshot,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { GiftItem } from '../types';

// Initialize Firebase App & Firestore with custom databaseId
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: true,
      tenantId: null,
      providerInfo: [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test initial connection as required by Firestore integration guidelines
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firebase client is offline or configuration pending.');
    }
    return false;
  }
}

// Immediately trigger connection test
testFirestoreConnection();

const GIFTS_COLLECTION = 'gifts';

// Format Firestore doc data into GiftItem
function sanitizeGiftData(docId: string, raw: any): GiftItem {
  return {
    id: docId,
    recipient: raw.recipient || 'Audrey',
    title: raw.title || 'Idée cadeau',
    description: raw.description || '',
    price: typeof raw.price === 'number' ? raw.price : Number(raw.price) || 0,
    category: raw.category || 'Maison & Décoration',
    priority: raw.priority || 'Très souhaité',
    storeName: raw.storeName || '',
    url: raw.url || '',
    imageUrl: raw.imageUrl || '',
    isReserved: Boolean(raw.isReserved),
    reservedBy: raw.reservedBy || null,
    reservedAt: raw.reservedAt || null,
    reservationNote: raw.reservationNote || null,
    isSecretIdea: Boolean(raw.isSecretIdea),
    addedBy: raw.addedBy || raw.recipient || 'Audrey',
    contributions: Array.isArray(raw.contributions) ? raw.contributions : [],
  };
}

/**
 * Fetch all gifts from Firestore collection
 */
export async function getGiftsFromFirestore(): Promise<GiftItem[]> {
  try {
    const querySnapshot = await getDocs(collection(db, GIFTS_COLLECTION));
    const items: GiftItem[] = [];
    const seen = new Set<string>();
    querySnapshot.forEach((d) => {
      if (!seen.has(d.id)) {
        seen.add(d.id);
        items.push(sanitizeGiftData(d.id, d.data()));
      }
    });
    return items;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, GIFTS_COLLECTION);
  }
}

/**
 * Save or create a gift document in Firestore
 */
export async function saveGiftToFirestore(gift: GiftItem): Promise<GiftItem> {
  const docRef = doc(db, GIFTS_COLLECTION, gift.id);
  const payload = {
    id: gift.id,
    recipient: gift.recipient,
    title: gift.title.slice(0, 200),
    description: (gift.description || '').slice(0, 2000),
    price: Number(gift.price) || 0,
    category: (gift.category || 'Maison & Décoration').slice(0, 100),
    priority: gift.priority,
    storeName: (gift.storeName || '').slice(0, 100),
    url: (gift.url || '').slice(0, 2000),
    imageUrl: (gift.imageUrl || '').slice(0, 500000),
    isReserved: Boolean(gift.isReserved),
    reservedBy: gift.reservedBy ? gift.reservedBy.slice(0, 100) : null,
    reservedAt: gift.reservedAt || null,
    reservationNote: gift.reservationNote ? gift.reservationNote.slice(0, 1000) : null,
    isSecretIdea: Boolean(gift.isSecretIdea),
    addedBy: (gift.addedBy || gift.recipient).slice(0, 100),
    createdAt: new Date().toISOString(),
  };

  try {
    await setDoc(docRef, payload, { merge: true });
    return gift;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${GIFTS_COLLECTION}/${gift.id}`);
  }
}

/**
 * Update partial gift fields in Firestore
 */
export async function updateGiftInFirestore(id: string, updates: Partial<GiftItem>): Promise<void> {
  const docRef = doc(db, GIFTS_COLLECTION, id);
  const payload: any = {};

  if (updates.title !== undefined) payload.title = updates.title.slice(0, 200);
  if (updates.description !== undefined) payload.description = updates.description.slice(0, 2000);
  if (updates.price !== undefined) payload.price = Number(updates.price) || 0;
  if (updates.category !== undefined) payload.category = updates.category.slice(0, 100);
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.recipient !== undefined) payload.recipient = updates.recipient;
  if (updates.storeName !== undefined) payload.storeName = updates.storeName.slice(0, 100);
  if (updates.url !== undefined) payload.url = updates.url.slice(0, 2000);
  if (updates.imageUrl !== undefined) payload.imageUrl = updates.imageUrl.slice(0, 500000);
  if (updates.isReserved !== undefined) payload.isReserved = Boolean(updates.isReserved);
  if (updates.reservedBy !== undefined) payload.reservedBy = updates.reservedBy ? updates.reservedBy.slice(0, 100) : null;
  if (updates.reservedAt !== undefined) payload.reservedAt = updates.reservedAt;
  if (updates.reservationNote !== undefined) payload.reservationNote = updates.reservationNote ? updates.reservationNote.slice(0, 1000) : null;
  if (updates.isSecretIdea !== undefined) payload.isSecretIdea = Boolean(updates.isSecretIdea);
  if (updates.addedBy !== undefined) payload.addedBy = updates.addedBy.slice(0, 100);

  try {
    await setDoc(docRef, payload, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${GIFTS_COLLECTION}/${id}`);
  }
}

/**
 * Delete a gift document in Firestore
 */
export async function deleteGiftFromFirestore(id: string): Promise<void> {
  const docRef = doc(db, GIFTS_COLLECTION, id);
  try {
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${GIFTS_COLLECTION}/${id}`);
  }
}

/**
 * Subscribe to real-time updates from Firestore
 */
export function subscribeToGifts(
  onData: (gifts: GiftItem[]) => void,
  onError?: (error: unknown) => void
): () => void {
  const unsubscribe = onSnapshot(
    collection(db, GIFTS_COLLECTION),
    (snapshot) => {
      const items: GiftItem[] = [];
      const seen = new Set<string>();
      snapshot.forEach((d) => {
        if (!seen.has(d.id)) {
          seen.add(d.id);
          items.push(sanitizeGiftData(d.id, d.data()));
        }
      });
      onData(items);
    },
    (error) => {
      if (onError) {
        onError(error);
      }
      handleFirestoreError(error, OperationType.GET, GIFTS_COLLECTION);
    }
  );

  return unsubscribe;
}

/**
 * Seed Firestore with initial gifts if collection is empty
 */
export async function seedFirestoreIfEmpty(initialItems: GiftItem[]): Promise<GiftItem[]> {
  try {
    const existing = await getGiftsFromFirestore();
    if (existing.length > 0) {
      return existing;
    }

    console.log('Seeding Firestore with initial wishlist items...');
    for (const item of initialItems) {
      await saveGiftToFirestore(item);
    }
    return initialItems;
  } catch (err) {
    console.warn('Could not auto-seed Firestore:', err);
    return initialItems;
  }
}

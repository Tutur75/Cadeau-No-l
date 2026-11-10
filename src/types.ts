export type FamilyMember = 'Audrey' | 'Arthur' | 'Zoé';

export interface Contribution {
  name: string;
  amount: number;
  date: string;
}

export interface GiftItem {
  id: string;
  recipient: FamilyMember;
  title: string;
  description: string;
  price: number;
  category: string;
  priority: 'Coup de cœur' | 'Très souhaité' | 'Souhaité';
  storeName: string;
  url: string;
  imageUrl: string;
  isReserved: boolean;
  reservedBy: string | null;
  reservedAt: string | null;
  reservationNote: string | null;
  isSecretIdea?: boolean;
  addedBy: string;
  contributions: Contribution[];
}

export type StatusFilter = 'all' | 'available' | 'reserved' | 'favorites';
export type PriceFilter = 'all' | 'under30' | '30to75' | 'over75';
export type SortOption = 'priority' | 'price-asc' | 'price-desc' | 'recent';

export interface FilterState {
  search: string;
  recipient: FamilyMember | 'all';
  category: string;
  status: StatusFilter;
  priceRange: PriceFilter;
  sortBy: SortOption;
}

export interface MemberProfile {
  name: FamilyMember;
  avatarText: string;
  accentColor: string;
  bgLight: string;
  badgeClass: string;
  tagline: string;
}

export const FAMILY_MEMBERS: Record<FamilyMember, MemberProfile> = {
  Audrey: {
    name: 'Audrey',
    avatarText: 'AU',
    accentColor: '#b91c1c', // deep festive red
    bgLight: 'bg-rose-50 border-rose-200 text-rose-900',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
    tagline: 'Cocooning, littérature, thés & élégance',
  },
  Arthur: {
    name: 'Arthur',
    avatarText: 'AR',
    accentColor: '#047857', // pine green
    bgLight: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    tagline: 'High-tech audio, café de spécialité & jeux',
  },
  Zoé: {
    name: 'Zoé',
    avatarText: 'ZO',
    accentColor: '#d97706', // warm amber gold
    bgLight: 'bg-amber-50 border-amber-200 text-amber-900',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200',
    tagline: 'Créativité, photo instantanée, déco & BD',
  },
};

export const CATEGORIES = [
  'Toutes les catégories',
  'Maison & Décoration',
  'High-Tech & Audio',
  'Mode & Accessoires',
  'Sport & Outdoor',
  'Jeux & Loisirs',
  'Livres & Culture',
  'Beauté & Bien-être',
];

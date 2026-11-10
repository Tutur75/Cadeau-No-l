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
  fontColorClass: string;
  buttonActiveClass: string;
  buttonCardClass: string;
  tagline: string;
}

export const FAMILY_MEMBERS: Record<FamilyMember, MemberProfile> = {
  Audrey: {
    name: 'Audrey',
    avatarText: 'AU',
    accentColor: '#9333ea', // Violet
    bgLight: 'bg-purple-50 border-purple-200 text-purple-900',
    badgeClass: 'bg-purple-100 text-purple-800 border-purple-200',
    fontColorClass: 'text-purple-700',
    buttonActiveClass: 'bg-purple-600 hover:bg-purple-700 text-white',
    buttonCardClass: 'bg-gradient-to-r from-purple-600 to-violet-700 hover:from-purple-700 hover:to-violet-800 text-white',
    tagline: 'Cocooning, littérature, thés & élégance',
  },
  Arthur: {
    name: 'Arthur',
    avatarText: 'AR',
    accentColor: '#2563eb', // Bleu
    bgLight: 'bg-blue-50 border-blue-200 text-blue-900',
    badgeClass: 'bg-blue-100 text-blue-800 border-blue-200',
    fontColorClass: 'text-blue-700',
    buttonActiveClass: 'bg-blue-600 hover:bg-blue-700 text-white',
    buttonCardClass: 'bg-gradient-to-r from-blue-600 to-sky-700 hover:from-blue-700 hover:to-sky-800 text-white',
    tagline: 'High-tech audio, café de spécialité & jeux',
  },
  Zoé: {
    name: 'Zoé',
    avatarText: 'ZO',
    accentColor: '#ec4899', // Rose
    bgLight: 'bg-pink-50 border-pink-200 text-pink-900',
    badgeClass: 'bg-pink-100 text-pink-800 border-pink-200',
    fontColorClass: 'text-pink-600',
    buttonActiveClass: 'bg-pink-500 hover:bg-pink-600 text-white',
    buttonCardClass: 'bg-gradient-to-r from-pink-500 to-rose-600 hover:from-pink-600 hover:to-rose-700 text-white',
    tagline: 'Poupées, créativité, photo instantanée, déco & BD',
  },
};

export const CATEGORIES = [
  'Toutes les catégories',
  'Poupées',
  'Maison & Décoration',
  'High-Tech & Audio',
  'Mode & Accessoires',
  'Sport & Outdoor',
  'Jeux & Loisirs',
  'Livres & Culture',
  'Beauté & Bien-être',
];

import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: '10mb' }));

// Database file setup
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'wishlist.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface Contribution {
  name: string;
  amount: number;
  date: string;
}

export interface GiftItem {
  id: string;
  recipient: 'Audrey' | 'Arthur' | 'Zoé';
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

// Helpers for reading and writing local database
function readDatabase(): GiftItem[] {
  try {
    if (fs.existsSync(DB_FILE)) {
      const content = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.error('Error reading local database:', err);
  }
  return [];
}

function writeDatabase(items: GiftItem[]): boolean {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(items, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving to local database:', err);
    return false;
  }
}

// Initialize Gemini SDK if API key is provided
let aiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  aiClient = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Decode common HTML entities in scraped strings and URLs
function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&euro;|&#8364;|&#x20AC;/gi, '€')
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\\u002F/gi, '/')
    .replace(/\\\//g, '/');
}

// Check if a scraped title is actually a bot-block / Cloudflare / 404 / generic site page
function isBlockedPageTitle(title: string): boolean {
  const t = (title || '').trim().toLowerCase();
  if (!t) return true;
  const blockedPatterns = [
    'just a moment',
    'attention required',
    'access denied',
    'robot check',
    'are you a robot',
    'captcha',
    'cloudflare',
    '403 forbidden',
    '404 not found',
    'page non trouvée',
    'page introuvable',
    'un instant',
    'vérification',
    'security check',
    'le spécialiste du jeu de société',
    'amazon.fr',
    'amazon.com',
    'fnac.com',
  ];
  return blockedPatterns.some((p) => t === p || (t.includes(p) && t.length < 60));
}

// Helper to extract and normalize numeric prices from strings or numbers
function parsePrice(raw: any): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') return raw > 0 && raw < 100000 ? Math.round(raw * 100) / 100 : null;
  const decoded = decodeHtmlEntities(String(raw))
    .replace(/[\u00A0\u202F\u2009]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Handle "49 € 99" or "49€99"
  const mEuroSplit = decoded.match(/([0-9]{1,5})\s*€\s*([0-9]{2})/);
  if (mEuroSplit) {
    const val = parseFloat(`${mEuroSplit[1]}.${mEuroSplit[2]}`);
    if (!isNaN(val) && val > 0 && val < 100000) return val;
  }

  // Handle "1 299,99 €", "1299.99 EUR", "49 €", "€ 49,90"
  const mCurrencyAfter = decoded.match(/([0-9]{1,3}(?:[\s.][0-9]{3})+|[0-9]{1,5})(?:[.,]([0-9]{1,2}))?\s*(?:€|EUR)/i);
  if (mCurrencyAfter) {
    const intPart = mCurrencyAfter[1].replace(/[\s.]/g, '');
    const decPart = mCurrencyAfter[2] ? mCurrencyAfter[2].padEnd(2, '0') : '00';
    const val = parseFloat(`${intPart}.${decPart}`);
    if (!isNaN(val) && val > 0 && val < 100000) return val;
  }

  const mCurrencyBefore = decoded.match(/(?:€|EUR)\s*([0-9]{1,3}(?:[\s.][0-9]{3})+|[0-9]{1,5})(?:[.,]([0-9]{1,2}))?/i);
  if (mCurrencyBefore) {
    const intPart = mCurrencyBefore[1].replace(/[\s.]/g, '');
    const decPart = mCurrencyBefore[2] ? mCurrencyBefore[2].padEnd(2, '0') : '00';
    const val = parseFloat(`${intPart}.${decPart}`);
    if (!isNaN(val) && val > 0 && val < 100000) return val;
  }

  // Handle plain numeric string like "49.99" or "49,99" or "1299.00"
  const mPlain = decoded.match(/^([0-9]+)(?:[.,]([0-9]{1,2}))?$/);
  if (mPlain) {
    const val = parseFloat(`${mPlain[1]}.${mPlain[2] || '0'}`);
    if (!isNaN(val) && val > 0 && val < 100000) return Math.round(val * 100) / 100;
  }
  return null;
}

// Recursively locate Product entity inside JSON-LD (supports root objects, @graph, mainEntity, and arrays)
function extractProductFromLdJson(data: any): any {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = extractProductFromLdJson(item);
      if (found) return found;
    }
  } else if (typeof data === 'object') {
    const type = data['@type'];
    const isProduct =
      type === 'Product' ||
      type === 'ProductGroup' ||
      (Array.isArray(type) && (type.includes('Product') || type.includes('ProductGroup'))) ||
      type === 'IndividualProduct' ||
      type === 'Book';
    if (isProduct) return data;
    if (data['@graph']) return extractProductFromLdJson(data['@graph']);
    if (data.mainEntity) return extractProductFromLdJson(data.mainEntity);
  }
  return null;
}

// Extract image URL from a JSON-LD Product object
function extractImageFromProduct(prod: any): string | null {
  const candidates = [prod.image, prod.thumbnailUrl];
  for (const img of candidates) {
    if (!img) continue;
    if (typeof img === 'string') return img;
    if (Array.isArray(img)) {
      for (const item of img) {
        if (typeof item === 'string' && item.trim()) return item;
        if (item && typeof item === 'object') {
          const url = item.url || item.contentUrl || item.thumbnailUrl;
          if (url) return url;
        }
      }
    }
    if (typeof img === 'object') {
      const url = img.url || img.contentUrl || img.thumbnailUrl;
      if (url) return url;
    }
  }
  if (Array.isArray(prod.hasVariant)) {
    for (const v of prod.hasVariant) {
      const found = extractImageFromProduct(v);
      if (found) return found;
    }
  }
  return null;
}

// Extract price from a JSON-LD Product object
function extractPriceFromProduct(prod: any): number | null {
  if (prod.offers) {
    const offersList = Array.isArray(prod.offers)
      ? prod.offers
      : (prod.offers.offers && Array.isArray(prod.offers.offers) ? prod.offers.offers : [prod.offers]);

    for (const offer of offersList) {
      if (!offer) continue;
      const spec = Array.isArray(offer.priceSpecification)
        ? offer.priceSpecification[0]
        : offer.priceSpecification;
      const rawPrice =
        offer.price ??
        offer.lowPrice ??
        offer.highPrice ??
        spec?.price ??
        spec?.minPrice;
      const parsed = parsePrice(rawPrice);
      if (parsed) return parsed;
    }
  }
  if (Array.isArray(prod.hasVariant)) {
    for (const v of prod.hasVariant) {
      const parsed = extractPriceFromProduct(v);
      if (parsed) return parsed;
    }
  }
  return null;
}

// Extract Amazon ASIN from any URL format
function extractAmazonAsin(urlStr: string): string | null {
  const match = urlStr.match(/(?:\/dp\/|\/product\/|\/gp\/product\/|\/d\/)([A-Z0-9]{10})/i) ||
                urlStr.match(/\/([A-Z0-9]{10})(?:[/?#]|$)/i);
  return match ? match[1] : null;
}

// Beautiful, curated fallback images when website blocks direct image retrieval
function getSmartFallbackImage(title: string, category: string): string {
  const t = title.toLowerCase();
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

  if (t.includes('poupée') || t.includes('poupee') || t.includes('barbie') || t.includes('peluche') || t.includes('doll') || t.includes('doudou') || t.includes('poupon')) {
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

// Normalize and resolve a candidate image URL against the page URL
function normalizeImageUrl(rawUrl: string, originalUrl: string): string {
  if (!rawUrl) return '';
  let url = decodeHtmlEntities(rawUrl).trim();
  if (!url || url.startsWith('data:')) return '';
  const lower = url.toLowerCase();
  if (
    lower.includes('1x1') ||
    lower.includes('blank.gif') ||
    lower.includes('pixel') ||
    lower.includes('spacer') ||
    lower.includes('spinner') ||
    lower.includes('logo') ||
    lower.includes('social_banner') ||
    lower.includes('favicon') ||
    lower.includes('placeholder') ||
    lower.includes('no-image') ||
    lower.includes('sprite')
  ) {
    return '';
  }
  // Handle srcset format ("https://... 1x, https://... 2x")
  if (url.includes(',') && url.includes('http')) {
    url = url.split(',')[0].trim().split(/\s+/)[0];
  } else if (url.includes(' ') && url.startsWith('http')) {
    url = url.split(/\s+/)[0];
  }
  try {
    if (url.startsWith('//')) {
      return `https:${url}`;
    }
    if (!url.startsWith('http')) {
      const parsed = new URL(originalUrl);
      return new URL(url, parsed.origin).href;
    }
    return url;
  } catch {
    return '';
  }
}

// Comprehensive multi-layer scraper from raw HTML
async function extractMetadataFromHtml(html: string, originalUrl: string) {
  const getMeta = (propNames: string[]): string | null => {
    for (const name of propNames) {
      // Match double-quoted and single-quoted content separately so apostrophes inside French titles don't truncate
      const patterns = [
        new RegExp(`<meta\\s+[^>]*(?:property|name|itemprop)=["']${name}["'][^>]*content="([^"]*)"`, 'is'),
        new RegExp(`<meta\\s+[^>]*(?:property|name|itemprop)=["']${name}["'][^>]*content='([^']*)'`, 'is'),
        new RegExp(`<meta\\s+[^>]*content="([^"]*)"[^>]*?(?:property|name|itemprop)=["']${name}["']`, 'is'),
        new RegExp(`<meta\\s+[^>]*content='([^']*)'[^>]*?(?:property|name|itemprop)=["']${name}["']`, 'is'),
      ];
      for (const regex of patterns) {
        const m = html.match(regex);
        if (m && m[1] && m[1].trim()) return decodeHtmlEntities(m[1].trim());
      }
    }
    return null;
  };

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  let title = getMeta(['og:title', 'twitter:title']) || (titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : '');
  // Clean store suffixes
  title = title.replace(/\s*[-–|•:]\s*(Amazon\.fr|Amazon|Fnac|Fnac\.com|Sephora|Zara|Boulanger|Decathlon|Apple|Darty|Cdiscount|Cultura|IKEA|Nature & Découvertes).*$/i, '').trim();
  if (isBlockedPageTitle(title)) {
    title = '';
  }

  const description = getMeta(['og:description', 'twitter:description', 'description']) || '';
  const siteName = getMeta(['og:site_name', 'twitter:site']) || '';

  const imageCandidates: string[] = [];
  const addImageCandidate = (raw: string | null | undefined) => {
    if (!raw) return;
    const norm = normalizeImageUrl(raw, originalUrl);
    if (norm && !imageCandidates.includes(norm)) {
      imageCandidates.push(norm);
    }
  };

  addImageCandidate(getMeta(['og:image:secure_url', 'og:image:url', 'og:image', 'twitter:image', 'twitter:image:src', 'image']));

  // Extract Price from Meta Tags
  let price: number | null = null;
  const rawMetaPrice = getMeta(['product:price:amount', 'og:price:amount', 'price:amount', 'price', 'twitter:data1']);
  if (rawMetaPrice) {
    price = parsePrice(rawMetaPrice);
  }

  // Look for JSON-LD schema (handling arrays, objects, and @graph)
  try {
    const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const m of jsonLdMatches) {
      try {
        const data = JSON.parse(m[1].trim());
        const product = extractProductFromLdJson(data);
        if (product) {
          if (!title && product.name && !isBlockedPageTitle(product.name)) {
            title = decodeHtmlEntities(String(product.name));
          }
          const ldImg = extractImageFromProduct(product);
          if (ldImg) addImageCandidate(ldImg);
          if (!price) {
            const ldPrice = extractPriceFromProduct(product);
            if (ldPrice) price = ldPrice;
          }
        }
      } catch {
        // ignore JSON-LD parse errors
      }
    }
  } catch {
    // ignore
  }

  // Extract Price from Microdata (<span itemprop="price" ...> or data-price)
  if (!price) {
    const itempropContentMatch = html.match(/<(?:span|meta|div)[^>]*itemprop=["']price["'][^>]*content=["']([^"']*)["']/i) ||
                                 html.match(/<(?:span|meta|div)[^>]*content=["']([^"']*)["'][^>]*itemprop=["']price["']/i);
    if (itempropContentMatch?.[1]) {
      price = parsePrice(itempropContentMatch[1]);
    }
  }
  if (!price) {
    const itempropTextMatch = html.match(/<[^>]*itemprop=["']price["'][^>]*>([\s\S]{1,120}?)<\/(?:span|div|p|strong)>/i);
    if (itempropTextMatch?.[1]) {
      const cleaned = itempropTextMatch[1].replace(/<sup[^>]*>([0-9]{2})<\/sup>/gi, ',$1').replace(/<[^>]+>/g, ' ');
      price = parsePrice(cleaned);
    }
  }
  if (!price) {
    const dataPriceMatch = html.match(/\bdata-(?:product-)?price=["']([0-9.,]+)["']/i);
    if (dataPriceMatch?.[1]) {
      price = parsePrice(dataPriceMatch[1]);
    }
  }

  // Extract Price from Amazon selectors
  if (!price) {
    const amazonOffscreen = html.match(/<span[^>]*class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)<\/span>/i);
    if (amazonOffscreen?.[1]) {
      price = parsePrice(amazonOffscreen[1]);
    }
  }
  if (!price) {
    const amazonWhole = html.match(/<span[^>]*class=["'][^"']*a-price-whole[^"']*["'][^>]*>([0-9\s\u00A0\u202F]+)(?:<span[^>]*class=["']a-price-decimal["'][^>]*>[.,]<\/span>)?<\/span>/i);
    const amazonFraction = html.match(/<span[^>]*class=["'][^"']*a-price-fraction[^"']*["'][^>]*>([0-9]{2})<\/span>/i);
    if (amazonWhole?.[1]) {
      const whole = amazonWhole[1].replace(/[^0-9]/g, '');
      const fraction = amazonFraction?.[1] ? amazonFraction[1] : '00';
      if (whole) price = parseFloat(`${whole}.${fraction}`);
    }
  }

  // Extract Price from Generic E-Commerce Class Selectors (supporting nested <sup> or <span>)
  if (!price) {
    const genericPriceMatch =
      html.match(/<(?:span|div|p|strong)[^>]*class=["'][^"']*(?:product-price|current-price|price-current|price__regular|price-item--regular|sales-price|price-now|new-price|f-pricebox-price|final-price|offer-price)[^"']*["'][^>]*>([\s\S]{1,160}?)<\/(?:span|div|p|strong)>/i) ||
      html.match(/<(?:span|div|p|strong)[^>]*class=["'][^"']*\bprice\b[^"']*["'][^>]*>([\s\S]{1,160}?)<\/(?:span|div|p|strong)>/i);
    if (genericPriceMatch?.[1]) {
      const cleaned = genericPriceMatch[1].replace(/<sup[^>]*>([0-9]{2})<\/sup>/gi, ',$1').replace(/<[^>]+>/g, ' ');
      price = parsePrice(cleaned);
    }
  }

  // Extract Price from embedded script JSON (__NEXT_DATA__, Shopify, PrestaShop, Amazon twister, etc.)
  if (!price) {
    const jsonPricePatterns = [
      /"priceAmount"\s*:\s*([0-9]+(?:\.[0-9]{1,2})?)/i,
      /"(?:currentPrice|salePrice|sellingPrice|finalPrice|unitPrice|offerPrice)"\s*:\s*"?([0-9]+(?:[.,][0-9]{1,2})?)"?/i,
      /"price"\s*:\s*\{\s*"amount"\s*:\s*"?([0-9]+(?:[.,][0-9]{1,2})?)"?/i,
      /"priceCurrency"\s*:\s*"EUR"[^}]{0,120}"price"\s*:\s*"?([0-9]+(?:[.,][0-9]{1,2})?)"?/i,
      /"price"\s*:\s*"?([0-9]+(?:[.,][0-9]{1,2})?)"?[^}]{0,120}"priceCurrency"\s*:\s*"EUR"/i,
    ];
    for (const pat of jsonPricePatterns) {
      const m = html.match(pat);
      if (m?.[1]) {
        const parsed = parsePrice(m[1]);
        if (parsed) {
          price = parsed;
          break;
        }
      }
    }
  }

  // Extract Image candidates from <link>, Amazon attributes, <img> tags & embedded JSON
  const linkImg = html.match(/<link\s+[^>]*rel=["']image_src["'][^>]*href=["']([^"']*)["']/i) ||
                  html.match(/<link\s+[^>]*href=["']([^"']*)["'][^>]*rel=["']image_src["']/i) ||
                  html.match(/<link\s+[^>]*rel=["']preload["'][^>]*as=["']image["'][^>]*href=["']([^"']*)["']/i);
  if (linkImg?.[1]) addImageCandidate(linkImg[1]);

  const oldHires = html.match(/data-old-hires=["']([^"']+)["']/i);
  if (oldHires?.[1]) addImageCandidate(oldHires[1]);

  const landingImg = html.match(/id=["'](?:landingImage|imgBlkFront)["'][^>]*?(?:src|data-old-hires)=["']([^"']*)["']/i);
  if (landingImg?.[1]) addImageCandidate(landingImg[1]);

  const dynamicImg = html.match(/data-a-dynamic-image=["'](\{[^"']+\})["']/i);
  if (dynamicImg?.[1]) {
    try {
      const dynObj = JSON.parse(decodeHtmlEntities(dynamicImg[1]));
      const keys = Object.keys(dynObj);
      if (keys.length > 0) addImageCandidate(keys[0]);
    } catch {
      // ignore
    }
  }

  const itempropImg = html.match(/<img\s+[^>]*itemprop=["']image["'][^>]*?(?:data-src|src)=["']([^"']*)["']/i);
  if (itempropImg?.[1]) addImageCandidate(itempropImg[1]);

  const productClassImg = html.match(/<img\s+[^>]*class=["'][^"']*(?:product-image|main-image|primary-image|detail-image|gallery-image|pdp-image|f-product-visual)[^"']*["'][^>]*?(?:data-zoom-image|data-large_image|data-src|data-lazy-src|src)=["']([^"']*)["']/i);
  if (productClassImg?.[1]) addImageCandidate(productClassImg[1]);

  // Embedded JSON main product image
  const jsonImgMatch = html.match(/"(?:mainImage|heroImage|hiRes|largeImage|featured_image)"\s*:\s*"((?:https?:|\/\/)[^"\\]+)"/i);
  if (jsonImgMatch?.[1]) addImageCandidate(jsonImgMatch[1]);

  return {
    title,
    description,
    imageUrl: imageCandidates[0] || '',
    imageCandidates,
    price,
    siteName,
  };
}

// ---------------- LOCAL DATABASE API ---------------- //

// GET all gifts
app.get('/api/gifts', (_req: Request, res: Response) => {
  const items = readDatabase();
  res.json(items);
});

// POST new gift
app.post('/api/gifts', (req: Request, res: Response) => {
  const items = readDatabase();
  const giftId = req.body.id || `gift-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  // If item already exists, update and return it
  const existingIndex = items.findIndex(g => g.id === giftId);
  if (existingIndex !== -1) {
    items[existingIndex] = { ...items[existingIndex], ...req.body, id: giftId };
    writeDatabase(items);
    return res.json(items[existingIndex]);
  }

  const newItem: GiftItem = {
    id: giftId,
    recipient: req.body.recipient || 'Audrey',
    title: req.body.title || 'Nouvelle idée cadeau',
    description: req.body.description || '',
    price: Number(req.body.price) || 0,
    category: req.body.category || 'Maison & Décoration',
    priority: req.body.priority || 'Très souhaité',
    storeName: req.body.storeName || '',
    url: req.body.url || '',
    imageUrl: req.body.imageUrl || '',
    isReserved: false,
    reservedBy: null,
    reservedAt: null,
    reservationNote: null,
    isSecretIdea: (req.body.recipient === 'Zoé') ? false : true,
    addedBy: req.body.addedBy || req.body.recipient || 'Audrey',
    contributions: [],
  };

  items.unshift(newItem);
  writeDatabase(items);
  res.status(201).json(newItem);
});

// PUT update gift
app.put('/api/gifts/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const items = readDatabase();
  const index = items.findIndex(g => g.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Cadeau non trouvé' });
  }

  items[index] = {
    ...items[index],
    ...req.body,
    id: items[index].id, // preserve ID
  };

  writeDatabase(items);
  res.json(items[index]);
});

// DELETE gift
app.delete('/api/gifts/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const items = readDatabase();
  const filtered = items.filter(g => g.id !== id);

  if (filtered.length === items.length) {
    return res.status(404).json({ error: 'Cadeau non trouvé' });
  }

  writeDatabase(filtered);
  res.json({ success: true, id });
});

// POST reserve gift
app.post('/api/gifts/:id/reserve', (req: Request, res: Response) => {
  const { id } = req.params;
  const { reservedBy, reservationNote } = req.body;

  if (!reservedBy || typeof reservedBy !== 'string') {
    return res.status(400).json({ error: 'Le prénom du réservataire est requis' });
  }

  const items = readDatabase();
  const item = items.find(g => g.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Cadeau non trouvé' });
  }

  item.isReserved = true;
  item.reservedBy = reservedBy.trim();
  item.reservedAt = new Date().toISOString();
  item.reservationNote = reservationNote ? reservationNote.trim() : null;

  writeDatabase(items);
  res.json(item);
});

// POST cancel reservation
app.post('/api/gifts/:id/unreserve', (req: Request, res: Response) => {
  const { id } = req.params;
  const items = readDatabase();
  const item = items.find(g => g.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Cadeau non trouvé' });
  }

  item.isReserved = false;
  item.reservedBy = null;
  item.reservedAt = null;
  item.reservationNote = null;

  writeDatabase(items);
  res.json(item);
});

// POST contribute to gift kitty / cagnotte
app.post('/api/gifts/:id/contribute', (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, amount } = req.body;

  const parsedAmount = Number(amount);
  if (!name || isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Prénom et montant valide requis' });
  }

  const items = readDatabase();
  const item = items.find(g => g.id === id);
  if (!item) {
    return res.status(404).json({ error: 'Cadeau non trouvé' });
  }

  if (!item.contributions) item.contributions = [];
  item.contributions.push({
    name: name.trim(),
    amount: parsedAmount,
    date: new Date().toISOString(),
  });

  // If contributions reach or exceed price, auto-mark reserved
  const totalContributions = item.contributions.reduce((acc, c) => acc + c.amount, 0);
  if (totalContributions >= item.price && !item.isReserved) {
    item.isReserved = true;
    item.reservedBy = 'Cagnotte commune';
    item.reservedAt = new Date().toISOString();
  }

  writeDatabase(items);
  res.json(item);
});

// POST reset database
app.post('/api/reset-database', (_req: Request, res: Response) => {
  const initialDataPath = path.join(DATA_DIR, 'wishlist.json');
  if (fs.existsSync(initialDataPath)) {
    // Already in place
    const items = readDatabase();
    return res.json(items);
  }
  return res.json([]);
});

// Export database JSON
app.get('/api/export-database', (_req: Request, res: Response) => {
  const items = readDatabase();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="listes-noel-famille.json"');
  res.send(JSON.stringify(items, null, 2));
});

// Export full project as ZIP archive
app.get('/api/export-project-zip', async (_req: Request, res: Response) => {
  try {
    const zipPath = path.join('/tmp', `listes-noel-famille-${Date.now()}.zip`);
    const { execSync } = await import('child_process');
    const pythonCode = `import zipfile, os
with zipfile.ZipFile('${zipPath}', 'w', zipfile.ZIP_DEFLATED) as zipf:
    for root, dirs, files in os.walk('.'):
        dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'dist', '.cache']]
        for file in files:
            if file.startswith('.env') and file != '.env.example':
                continue
            filepath = os.path.join(root, file)
            arcname = os.path.relpath(filepath, '.')
            zipf.write(filepath, arcname)
`;
    execSync(`python3 -c "${pythonCode.replace(/"/g, '\\"')}"`, { cwd: __dirname });

    res.download(zipPath, 'listes-noel-famille-projet.zip', () => {
      try {
        if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);
      } catch {
        // ignore
      }
    });
  } catch (err) {
    console.error('Error creating project zip:', err);
    res.status(500).json({ error: 'Impossible de générer l archive ZIP' });
  }
});

// Import database
app.post('/api/import-database', (req: Request, res: Response) => {
  const { gifts } = req.body;
  if (!Array.isArray(gifts)) {
    return res.status(400).json({ error: 'Format JSON invalide (tableau attendu)' });
  }
  writeDatabase(gifts);
  res.json({ success: true, count: gifts.length });
});

// ---------------- EXTERNAL LINK SCRAPING, IMAGE PROXY & AI ---------------- //

// Guard against SSRF when fetching external image URLs
function isAllowedExternalUrl(urlStr: string): boolean {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
      host.endsWith('.local') ||
      host.endsWith('.internal')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Verify that an image URL resolves to a real image (> 1.5KB, avoiding 1x1 pixels or HTML error pages)
async function validateImageCandidate(imageUrl: string, refererUrl?: string): Promise<boolean> {
  if (!isAllowedExternalUrl(imageUrl)) return false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        ...(refererUrl ? { Referer: new URL(refererUrl).origin } : {}),
      },
    });
    clearTimeout(timeoutId);
    if (!res.ok) return false;
    const contentType = (res.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) return false;
    const buf = await res.arrayBuffer();
    // Reject 1x1 tracking pixels and empty Amazon spacer GIFs
    return buf.byteLength > 1500;
  } catch {
    return false;
  }
}

// CORS-safe same-origin image proxy so the browser can compress external product photos onto <canvas>
app.get('/api/proxy-image', async (req: Request, res: Response) => {
  try {
    const rawUrl = String(req.query.url || '');
    if (!rawUrl || !isAllowedExternalUrl(rawUrl)) {
      return res.status(400).json({ error: 'URL image invalide' });
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(rawUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8',
        'Referer': new URL(rawUrl).origin,
      },
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return res.status(404).json({ error: 'Image inaccessible' });
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return res.status(415).json({ error: 'Le lien ne pointe pas vers une image' });
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength < 500 || arrayBuffer.byteLength > 15 * 1024 * 1024) {
      return res.status(422).json({ error: 'Taille image invalide' });
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.send(Buffer.from(arrayBuffer));
  } catch {
    res.status(502).json({ error: 'Impossible de charger l\'image' });
  }
});

// Use Gemini with URL Context + Google Search Grounding when direct HTML scraping is blocked or missing price/image
async function discoverProductWithGemini(targetUrl: string): Promise<{
  title?: string;
  price?: number;
  description?: string;
  imageUrl?: string;
  storeName?: string;
  category?: string;
} | null> {
  if (!aiClient || !process.env.GEMINI_API_KEY) return null;

  try {
    const prompt = `Analyse cette page produit e-commerce et recherche ses informations exactes : ${targetUrl}

Extrais les informations suivantes du produit exact vendu sur cette URL :
- title : nom complet et exact du produit (en français si possible, sans le nom du site)
- price : prix actuel TTC en euros (nombre décimal ex: 49.99, ou 0 si vraiment introuvable)
- description : courte description fidèle du produit en 1 phrase en français
- storeName : nom de la boutique / enseigne (ex: Fnac, Amazon, Decathlon, Zara, Cultura...)
- category : exactement une parmi ["Poupées", "Mode & Accessoires", "High-Tech & Audio", "Maison & Décoration", "Jeux & Loisirs", "Livres & Culture", "Sport & Outdoor", "Beauté & Bien-être"]
- imageUrl : URL directe (https://...) vers la photo principale du produit si trouvée, sinon ""

Réponds UNIQUEMENT avec un objet JSON valide (sans texte ni explication autour) :
{"title":"...","price":0,"description":"...","storeName":"...","category":"...","imageUrl":"..."}`;

    const response = await aiClient.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools: [{ urlContext: {} }, { googleSearch: {} }],
      },
    });

    const text = (response.text || '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      title: typeof parsed.title === 'string' ? parsed.title.trim() : undefined,
      price: parsePrice(parsed.price) ?? undefined,
      description: typeof parsed.description === 'string' ? parsed.description.trim() : undefined,
      imageUrl: typeof parsed.imageUrl === 'string' ? parsed.imageUrl.trim() : undefined,
      storeName: typeof parsed.storeName === 'string' ? parsed.storeName.trim() : undefined,
      category: typeof parsed.category === 'string' ? parsed.category.trim() : undefined,
    };
  } catch (err) {
    console.warn('Gemini link discovery fallback failed:', err);
    return null;
  }
}

app.post('/api/scrape-link', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL requise' });
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
    } catch {
      return res.status(400).json({ error: 'Format d\'URL invalide' });
    }

    if (!isAllowedExternalUrl(parsedUrl.href)) {
      return res.status(400).json({ error: 'URL non autorisée' });
    }

    const domain = parsedUrl.hostname.replace(/^www\./, '');
    let title = '';
    let description = '';
    let imageUrl = '';
    let imageCandidates: string[] = [];
    let price: number | null = null;
    let siteName = domain;

    // Extract Amazon ASIN if present
    const amazonAsin = extractAmazonAsin(parsedUrl.href);

    // Map common domains to friendly store names
    const STORE_NAMES: Record<string, string> = {
      'amazon.fr': 'Amazon',
      'amazon.com': 'Amazon',
      'amzn.eu': 'Amazon',
      'amzn.to': 'Amazon',
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

    if (STORE_NAMES[domain]) {
      siteName = STORE_NAMES[domain];
    }

    // 1. Shopify .json fast-path if applicable (/products/<handle>)
    if (parsedUrl.pathname.includes('/products/')) {
      try {
        const cleanPath = parsedUrl.pathname.replace(/\/$/, '').split('.json')[0];
        const shopifyRes = await fetch(`${parsedUrl.origin}${cleanPath}.json`, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(4000),
        });
        if (shopifyRes.ok) {
          const shopifyJson: any = await shopifyRes.json();
          const prod = shopifyJson?.product;
          if (prod) {
            if (prod.title) title = String(prod.title).trim();
            if (prod.body_html) description = String(prod.body_html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
            if (prod.variants?.[0]?.price) price = parsePrice(prod.variants[0].price);
            if (prod.images?.[0]?.src) imageCandidates.push(String(prod.images[0].src));
            if (prod.image?.src) imageCandidates.push(String(prod.image.src));
          }
        }
      } catch {
        // ignore Shopify check
      }
    }

    // 2. Direct HTML scrape with realistic browser headers
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const response = await fetch(parsedUrl.href, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
          'Cache-Control': 'no-cache',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Upgrade-Insecure-Requests': '1',
        },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const html = await response.text();
        const extracted = await extractMetadataFromHtml(html, response.url || parsedUrl.href);
        if (!title && extracted.title) title = extracted.title;
        if (!description && extracted.description) description = extracted.description;
        if (!price && extracted.price) price = extracted.price;
        if (extracted.siteName && !STORE_NAMES[domain]) siteName = extracted.siteName;
        for (const c of extracted.imageCandidates) {
          if (!imageCandidates.includes(c)) imageCandidates.push(c);
        }
      }
    } catch (scrapeErr) {
      console.warn('Direct scrape fetch failed or timed out:', scrapeErr);
    }

    // 3. Add Amazon ASIN CDN image candidate if Amazon URL
    if (amazonAsin) {
      imageCandidates.push(`https://images-na.ssl-images-amazon.com/images/P/${amazonAsin.toUpperCase()}.01._SCLZZZZZZZ_.jpg`);
      imageCandidates.push(`https://images-na.ssl-images-amazon.com/images/P/${amazonAsin.toUpperCase()}.01.LZZZZZZZ.jpg`);
    }

    // 4. Validate scraped image candidates before accepting one
    for (const candidate of imageCandidates.slice(0, 4)) {
      const ok = await validateImageCandidate(candidate, parsedUrl.href);
      if (ok) {
        imageUrl = candidate;
        break;
      }
    }

    // 5. Gemini URL Context + Google Search Grounding fallback whenever title, price, or real image is missing
    let geminiCategory = '';
    if (!title || !price || !imageUrl) {
      const geminiData = await discoverProductWithGemini(parsedUrl.href);
      if (geminiData) {
        if (!title && geminiData.title && !isBlockedPageTitle(geminiData.title)) {
          title = geminiData.title;
        }
        if (!price && geminiData.price && geminiData.price > 0) {
          price = geminiData.price;
        }
        if (!description && geminiData.description) {
          description = geminiData.description;
        }
        if (geminiData.storeName && (!siteName || siteName === domain)) {
          siteName = geminiData.storeName;
        }
        if (geminiData.category) {
          geminiCategory = geminiData.category;
        }
        if (!imageUrl && geminiData.imageUrl) {
          const normGeminiImg = normalizeImageUrl(geminiData.imageUrl, parsedUrl.href);
          if (normGeminiImg && (await validateImageCandidate(normGeminiImg, parsedUrl.href))) {
            imageUrl = normGeminiImg;
          }
        }
      }
    }

    // 6. Fallback extraction from URL slug if title is still missing or is just an ASIN / ID
    const isJustAsin = title && amazonAsin && title.trim().toUpperCase() === amazonAsin.toUpperCase();
    if (!title || isJustAsin) {
      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
      const descriptiveSegments = pathSegments.filter(
        seg => !['dp', 'gp', 'product', 'products', 'd', 'p', 'item', 'ref', 'buy', 'fr', 'a'].includes(seg.toLowerCase()) &&
               !/^[A-Z0-9]{10}$/i.test(seg) &&
               !/^[a-z]?[0-9]+$/i.test(seg) &&
               seg.length > 2
      );

      const bestSegment = descriptiveSegments[0] || pathSegments[pathSegments.length - 1] || '';
      const cleanSlug = decodeURIComponent(bestSegment)
        .replace(/[-_]/g, ' ')
        .replace(/\.(html|php|aspx|htm)$/i, '')
        .replace(/\b(dp|p|product|item|ref|gp|buy)\b/gi, '')
        .trim();

      if (cleanSlug.length > 3 && !/^[A-Z0-9]{10}$/i.test(cleanSlug)) {
        title = cleanSlug.charAt(0).toUpperCase() + cleanSlug.slice(1);
      } else {
        title = `Article ${siteName}`;
      }
    }

    // 7. Zero-key Product Image Search fallback if site blocked direct scraping and no valid image yet
    if (!imageUrl && title && !title.startsWith('Article ')) {
      try {
        const shortTitle = title.split(/\s+/).filter(w => w.length > 1).slice(0, 5).join(' ');
        const q = encodeURIComponent(`${shortTitle} ${siteName !== domain ? siteName : ''}`.trim());
        const imgSearchRes = await fetch(`https://www.bing.com/images/search?q=${q}&first=1&cc=FR`, {
          signal: AbortSignal.timeout(4500),
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Accept-Language': 'fr-FR,fr;q=0.9',
          },
        });
        if (imgSearchRes.ok) {
          const searchHtml = await imgSearchRes.text();
          const murlMatches = Array.from(searchHtml.matchAll(/murl&quot;:&quot;(https?:\/\/[^&]+)/gi));
          for (const m of murlMatches.slice(0, 4)) {
            const candidate = normalizeImageUrl(m[1], parsedUrl.href);
            if (candidate && (await validateImageCandidate(candidate))) {
              imageUrl = candidate;
              break;
            }
          }
        }
      } catch {
        // ignore image search fallback errors
      }
    }

    // Auto-categorize
    let category = geminiCategory || 'Maison & Décoration';
    if (!geminiCategory) {
      const lower = `${title} ${description} ${parsedUrl.pathname}`.toLowerCase();
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
    }

    // If still no valid product image, use smart curated fallback image for that category/keyword
    if (!imageUrl) {
      imageUrl = getSmartFallbackImage(title, category);
    }

    return res.json({
      title,
      description: description.slice(0, 250),
      imageUrl,
      price: price || 0,
      domain,
      siteName,
      category,
      url: parsedUrl.href,
      success: true,
    });
  } catch (error: any) {
    console.error('Scrape error:', error);
    try {
      const rawUrl = String(req.body?.url || '');
      const cleanUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
      const urlObj = new URL(cleanUrl);
      const domain = urlObj.hostname.replace(/^www\./, '');
      return res.json({
        title: `Article ${domain}`,
        description: '',
        imageUrl: getSmartFallbackImage('cadeau', 'Maison & Décoration'),
        price: 0,
        domain,
        siteName: domain,
        category: 'Maison & Décoration',
        url: urlObj.href,
        success: true,
      });
    } catch {
      return res.json({
        title: 'Nouvelle idée cadeau',
        description: '',
        imageUrl: 'https://images.unsplash.com/photo-1513201099705-a9746e1e201f?auto=format&fit=crop&w=800&q=80',
        price: 0,
        domain: '',
        siteName: '',
        category: 'Maison & Décoration',
        url: String(req.body?.url || ''),
        success: true,
      });
    }
  }
});

// AI Gift Suggestions endpoint
app.post('/api/ai-suggest-gifts', async (req: Request, res: Response) => {
  try {
    const { person, interests, budgetRange } = req.body;

    if (aiClient && process.env.GEMINI_API_KEY) {
      try {
        const prompt = `Génère 3 idées de cadeaux de Noël concrètes et merveilleuses pour ${person || 'un membre de la famille'}.
Goûts/Thème: ${interests || 'Fêtes de fin d\'année, moments conviviaux'}
Budget souhaité: ${budgetRange || 'entre 25€ et 100€'}.
Réponds EXCLUSIVEMENT avec un JSON strict contenant un tableau d'objets:
[
  {
    "title": "Nom précis de l'objet",
    "description": "Courte description chaleureuse en français (1 phrase)",
    "price": 45,
    "category": "Maison & Décoration" | "High-Tech & Audio" | "Mode & Accessoires" | "Sport & Outdoor" | "Jeux & Loisirs" | "Livres & Culture" | "Beauté & Bien-être",
    "storeName": "Enseigne (ex: Nature & Découvertes, Fnac, etc.)",
    "priority": "Coup de cœur" | "Très souhaité" | "Souhaité"
  }
]`;

        const response = await aiClient.models.generateContent({
          model: 'gemini-4-hydrogen',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
          },
        });

        const text = response.text;
        if (text) {
          const parsed = JSON.parse(text);
          const gifts = Array.isArray(parsed) ? parsed : (parsed.gifts || parsed.ideas || []);
          if (gifts.length > 0) {
            return res.json({ gifts });
          }
        }
      } catch (geminiError) {
        console.warn('Gemini suggestion fallback:', geminiError);
      }
    }

    return res.json({
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
    });
  } catch (error: any) {
    console.error('AI suggestions error:', error);
    return res.status(500).json({ error: 'Erreur lors de la génération d\'idées' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    // Serve a WebSocket-free @vite/client shim so browsers never attempt failing wss:// HMR connections
    app.get('/@vite/client', (_req, res) => {
      res.type('application/javascript').send(`
const sheetsMap = new Map();
export function updateStyle(id, content) {
  let style = sheetsMap.get(id);
  if (!style) {
    style = document.createElement('style');
    style.setAttribute('type', 'text/css');
    style.setAttribute('data-vite-dev-id', id);
    style.textContent = content;
    document.head.appendChild(style);
    sheetsMap.set(id, style);
  } else if (style.textContent !== content) {
    style.textContent = content;
  }
}
export function removeStyle(id) {
  const style = sheetsMap.get(id);
  if (style) {
    style.remove();
    sheetsMap.delete(id);
  }
}
export function createHotContext() {
  return {
    data: {},
    accept() {},
    dispose() {},
    prune() {},
    invalidate() {},
    on() {},
    off() {},
    send() {},
  };
}
export function injectQuery(id) {
  return id;
}
export class ErrorOverlay extends HTMLElement {}
`);
    });

    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🎄 Serveur Listes de Noël démarré sur http://localhost:${PORT}`);
  });
}

startServer();

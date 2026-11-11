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
  aiClient = new GoogleGenAI({});
}

// Helper to extract and normalize numeric prices from strings or numbers
function parsePrice(raw: any): number | null {
  if (raw === undefined || raw === null || raw === '') return null;
  if (typeof raw === 'number') return raw > 0 ? raw : null;
  const str = String(raw).trim().replace(/\s+/g, ' ');

  // Match e.g. "49,99 €", "49.99€", "€ 49.99", "49€99", "49,99"
  const m1 = str.match(/([0-9]{1,5})\s*€\s*([0-9]{2})/);
  if (m1) return parseFloat(`${m1[1]}.${m1[2]}`);

  const m2 = str.match(/([0-9]{1,5}(?:[.,][0-9]{2})?)\s*(?:€|EUR)/i) ||
             str.match(/(?:€|EUR)\s*([0-9]{1,5}(?:[.,][0-9]{2})?)/i);
  if (m2) {
    const val = parseFloat(m2[1].replace(',', '.'));
    if (!isNaN(val) && val > 0) return val;
  }

  const m3 = str.match(/^[0-9]+(?:[.,][0-9]{1,2})?$/);
  if (m3) {
    const val = parseFloat(m3[0].replace(',', '.'));
    if (!isNaN(val) && val > 0) return val;
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
      (Array.isArray(type) && type.includes('Product')) ||
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
  if (!prod.image) return null;
  if (typeof prod.image === 'string') return prod.image;
  if (Array.isArray(prod.image)) {
    const first = prod.image[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object') return first.url || first.contentUrl || null;
  }
  if (typeof prod.image === 'object') {
    return prod.image.url || prod.image.contentUrl || null;
  }
  return null;
}

// Extract price from a JSON-LD Product object
function extractPriceFromProduct(prod: any): number | null {
  if (!prod.offers) return null;
  const offersList = Array.isArray(prod.offers)
    ? prod.offers
    : (prod.offers.offers && Array.isArray(prod.offers.offers) ? prod.offers.offers : [prod.offers]);

  for (const offer of offersList) {
    if (!offer) continue;
    const rawPrice = offer.price ?? offer.lowPrice ?? offer.highPrice ?? offer.priceSpecification?.price;
    const parsed = parsePrice(rawPrice);
    if (parsed) return parsed;
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

// Comprehensive multi-layer scraper from raw HTML
async function extractMetadataFromHtml(html: string, originalUrl: string) {
  const getMeta = (propNames: string[]): string | null => {
    for (const name of propNames) {
      // 1. name/property/itemprop before content
      const m1 = html.match(new RegExp(`<meta\\s+[^>]*(?:property|name|itemprop)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'is'));
      if (m1 && m1[1] && m1[1].trim()) return m1[1].trim();

      // 2. content before name/property/itemprop
      const m2 = html.match(new RegExp(`<meta\\s+[^>]*content=["']([^"']*)["'][^>]*?(?:property|name|itemprop)=["']${name}["']`, 'is'));
      if (m2 && m2[1] && m2[1].trim()) return m2[1].trim();
    }
    return null;
  };

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  let title = getMeta(['og:title', 'twitter:title']) || (titleMatch ? titleMatch[1].trim() : '');
  // Clean store suffixes
  title = title.replace(/\s*[-–|•]\s*(Amazon\.fr|Fnac|Sephora|Zara|Boulanger|Decathlon|Apple|Darty|Cdiscount|Cultura|IKEA).*$/i, '').trim();

  const description = getMeta(['og:description', 'twitter:description', 'description']) || '';
  let imageUrl = getMeta(['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src', 'image']) || '';
  const siteName = getMeta(['og:site_name', 'twitter:site']) || '';

  // Extract Price from Meta Tags
  let price: number | null = null;
  const rawMetaPrice = getMeta(['product:price:amount', 'og:price:amount', 'price', 'twitter:data1']);
  if (rawMetaPrice) {
    price = parsePrice(rawMetaPrice);
  }

  // Extract Price from Microdata (<span itemprop="price" ...>)
  if (!price) {
    const itempropContentMatch = html.match(/<(?:span|meta)[^>]*itemprop=["']price["'][^>]*content=["']([^"']*)["']/i);
    if (itempropContentMatch && itempropContentMatch[1]) {
      price = parsePrice(itempropContentMatch[1]);
    }
  }
  if (!price) {
    const itempropTextMatch = html.match(/<span[^>]*itemprop=["']price["'][^>]*>([^<]+)<\/span>/i);
    if (itempropTextMatch && itempropTextMatch[1]) {
      price = parsePrice(itempropTextMatch[1]);
    }
  }

  // Extract Price from Amazon selectors
  if (!price) {
    const amazonOffscreen = html.match(/<span[^>]*class=["'][^"']*a-offscreen[^"']*["'][^>]*>([^<]+)<\/span>/i);
    if (amazonOffscreen && amazonOffscreen[1]) {
      price = parsePrice(amazonOffscreen[1]);
    }
  }
  if (!price) {
    const amazonWhole = html.match(/<span[^>]*class=["'][^"']*a-price-whole[^"']*["'][^>]*>([0-9\s\u00A0]+)<\/span>/i);
    const amazonFraction = html.match(/<span[^>]*class=["'][^"']*a-price-fraction[^"']*["'][^>]*>([0-9]{2})<\/span>/i);
    if (amazonWhole && amazonWhole[1]) {
      const whole = amazonWhole[1].replace(/[^0-9]/g, '');
      const fraction = amazonFraction && amazonFraction[1] ? amazonFraction[1] : '00';
      price = parseFloat(`${whole}.${fraction}`);
    }
  }

  // Extract Price from Generic E-Commerce Class Selectors
  if (!price) {
    const genericPriceMatch =
      html.match(/<(?:span|div|p)[^>]*class=["'][^"']*(?:product-price|current-price|price-current|price__regular|price-item--regular|sales-price|price-now|new-price)[^"']*["'][^>]*>([^<]+)<\/(?:span|div|p)>/i) ||
      html.match(/<(?:span|div|p)[^>]*class=["'][^"']*\bprice\b[^"']*["'][^>]*>([^<]+)<\/(?:span|div|p)>/i);
    if (genericPriceMatch && genericPriceMatch[1]) {
      price = parsePrice(genericPriceMatch[1]);
    }
  }

  // Look for JSON-LD schema (handling arrays, objects, and @graph)
  try {
    const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const m of jsonLdMatches) {
      try {
        const data = JSON.parse(m[1].trim());
        const product = extractProductFromLdJson(data);
        if (product) {
          if (!title && product.name) title = product.name;
          if (!imageUrl) {
            const ldImg = extractImageFromProduct(product);
            if (ldImg) imageUrl = ldImg;
          }
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

  // Extract Image from <link rel="image_src">
  if (!imageUrl) {
    const linkImg = html.match(/<link\s+[^>]*rel=["']image_src["'][^>]*href=["']([^"']*)["']/i) ||
                    html.match(/<link\s+[^>]*href=["']([^"']*)["'][^>]*rel=["']image_src["']/i);
    if (linkImg && linkImg[1]) {
      imageUrl = linkImg[1].trim();
    }
  }

  // Extract Image from Amazon high-res attributes
  if (!imageUrl) {
    const oldHires = html.match(/data-old-hires=["']([^"']+)["']/i);
    if (oldHires && oldHires[1]) {
      imageUrl = oldHires[1].trim();
    }
  }
  if (!imageUrl) {
    const landingImg = html.match(/id=["']landingImage["'][^>]*src=["']([^"']*)["']/i);
    if (landingImg && landingImg[1]) {
      imageUrl = landingImg[1].trim();
    }
  }
  if (!imageUrl) {
    const dynamicImg = html.match(/data-a-dynamic-image=["'](\{[^"']+\})["']/i);
    if (dynamicImg && dynamicImg[1]) {
      try {
        const dynObj = JSON.parse(dynamicImg[1]);
        const keys = Object.keys(dynObj);
        if (keys.length > 0) imageUrl = keys[0];
      } catch {
        // ignore
      }
    }
  }

  // Extract Image from HTML Microdata or prominent product image tags
  if (!imageUrl) {
    const itempropImg = html.match(/<img\s+[^>]*itemprop=["']image["'][^>]*src=["']([^"']*)["']/i);
    if (itempropImg && itempropImg[1]) {
      imageUrl = itempropImg[1].trim();
    }
  }
  if (!imageUrl) {
    const productClassImg = html.match(/<img\s+[^>]*class=["'][^"']*(?:product-image|main-image|primary-image|detail-image)[^"']*["'][^>]*src=["']([^"']*)["']/i);
    if (productClassImg && productClassImg[1]) {
      imageUrl = productClassImg[1].trim();
    }
  }

  // Filter out tracking pixels / tiny icons
  if (imageUrl && (imageUrl.includes('1x1') || imageUrl.includes('blank.gif') || imageUrl.includes('pixel') || imageUrl.includes('spacer'))) {
    imageUrl = '';
  }

  // Normalize relative image URLs
  if (imageUrl && !imageUrl.startsWith('http')) {
    try {
      if (imageUrl.startsWith('//')) {
        imageUrl = `https:${imageUrl}`;
      } else {
        const parsed = new URL(originalUrl);
        imageUrl = new URL(imageUrl, parsed.origin).href;
      }
    } catch {
      // ignore
    }
  }

  return { title, description, imageUrl, price, siteName };
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

// ---------------- EXTERNAL LINK SCRAPING & AI ---------------- //

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

    const domain = parsedUrl.hostname.replace(/^www\./, '');
    let title = '';
    let description = '';
    let imageUrl = '';
    let price: number | null = null;
    let siteName = domain;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(parsedUrl.href, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
        },
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const html = await response.text();
        const extracted = await extractMetadataFromHtml(html, parsedUrl.href);
        title = extracted.title;
        description = extracted.description;
        imageUrl = extracted.imageUrl;
        price = extracted.price;
        if (extracted.siteName) siteName = extracted.siteName;
      }
    } catch (scrapeErr) {
      console.warn('Direct scrape failed or timed out:', scrapeErr);
    }

    // Fallback extraction from URL slug
    if (!title) {
      const pathSegments = parsedUrl.pathname.split('/').filter(Boolean);
      const lastSegment = pathSegments[pathSegments.length - 1] || '';
      const cleanSlug = decodeURIComponent(lastSegment)
        .replace(/[-_]/g, ' ')
        .replace(/\.(html|php|aspx|htm)$/i, '')
        .replace(/\b(dp|p|product|item|ref|gp|buy)\b/gi, '')
        .trim();

      if (cleanSlug.length > 3) {
        title = cleanSlug.charAt(0).toUpperCase() + cleanSlug.slice(1);
      } else {
        title = `Article sur ${domain}`;
      }
    }

    // Auto-categorize
    let category = 'Maison & Décoration';
    const lower = `${title} ${description} ${parsedUrl.pathname}`.toLowerCase();
    if (lower.includes('poupée') || lower.includes('poupee') || lower.includes('barbie') || lower.includes('peluche') || lower.includes('doll') || lower.includes('doudou') || lower.includes('poupon')) {
      category = 'Poupées';
    } else if (lower.includes('livre') || lower.includes('roman') || lower.includes('bd') || lower.includes('manga') || lower.includes('book')) {
      category = 'Livres & Culture';
    } else if (lower.includes('pull') || lower.includes('veste') || lower.includes('chaussure') || lower.includes('echarpe') || lower.includes('mode') || lower.includes('sac') || lower.includes('robe')) {
      category = 'Mode & Accessoires';
    } else if (lower.includes('casque') || lower.includes('audio') || lower.includes('ecouteur') || lower.includes('enceinte') || lower.includes('tech') || lower.includes('console') || lower.includes('liseuse')) {
      category = 'High-Tech & Audio';
    } else if (lower.includes('jeu') || lower.includes('jouet') || lower.includes('lego') || lower.includes('puzzle') || lower.includes('societe') || lower.includes('peinture') || lower.includes('atelier')) {
      category = 'Jeux & Loisirs';
    } else if (lower.includes('sport') || lower.includes('ski') || lower.includes('velo') || lower.includes('vélo') || lower.includes('rando') || lower.includes('randonnee') || lower.includes('randonnée') || lower.includes('camping') || lower.includes('fitness') || lower.includes('running') || lower.includes('escalade') || lower.includes('outdoor')) {
      category = 'Sport & Outdoor';
    } else if (lower.includes('parfum') || lower.includes('creme') || lower.includes('soin') || lower.includes('beaute') || lower.includes('maquillage')) {
      category = 'Beauté & Bien-être';
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
    });
  } catch (error: any) {
    console.error('Scrape error:', error);
    return res.status(500).json({ error: 'Impossible d\'analyser le lien' });
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
          model: 'gemini-2.5-flash',
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
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

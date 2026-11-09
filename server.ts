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

// Scrape link metadata helper
async function extractMetadataFromHtml(html: string, originalUrl: string) {
  const getMeta = (propNames: string[]): string | null => {
    for (const name of propNames) {
      const match =
        html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]+content=["']([^"']*)["']`, 'i')) ||
        html.match(new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${name}["']`, 'i'));
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return null;
  };

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  let title = getMeta(['og:title', 'twitter:title']) || (titleMatch ? titleMatch[1].trim() : '');
  // Clean store suffixes like " | Amazon.fr", " - Fnac", etc.
  title = title.replace(/\s*[-–|•]\s*(Amazon\.fr|Fnac|Sephora|Zara|Boulanger|Decathlon|Apple|Darty|Cdiscount).*$/i, '').trim();

  const description = getMeta(['og:description', 'twitter:description', 'description']) || '';
  let imageUrl = getMeta(['og:image', 'twitter:image', 'image']) || '';
  const siteName = getMeta(['og:site_name', 'twitter:site']) || '';

  // Extract Price
  let price: number | null = null;
  const priceMeta = getMeta(['og:price:amount', 'product:price:amount', 'price']);
  if (priceMeta) {
    const parsed = parseFloat(priceMeta.replace(',', '.'));
    if (!isNaN(parsed) && parsed > 0) {
      price = parsed;
    }
  }

  // Look for JSON-LD schema
  try {
    const jsonLdMatches = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const m of jsonLdMatches) {
      try {
        const data = JSON.parse(m[1].trim());
        const product = Array.isArray(data) ? data.find(d => d['@type'] === 'Product') : (data['@type'] === 'Product' ? data : null);
        if (product) {
          if (!title && product.name) title = product.name;
          if (!imageUrl && product.image) {
            imageUrl = Array.isArray(product.image) ? product.image[0] : (typeof product.image === 'string' ? product.image : product.image.url || '');
          }
          if (!price && product.offers) {
            const offer = Array.isArray(product.offers) ? product.offers[0] : product.offers;
            if (offer && offer.price) {
              const p = parseFloat(String(offer.price).replace(',', '.'));
              if (!isNaN(p)) price = p;
            }
          }
        }
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }

  // Normalize image URL relative paths
  if (imageUrl && !imageUrl.startsWith('http')) {
    try {
      const parsed = new URL(originalUrl);
      imageUrl = new URL(imageUrl, parsed.origin).href;
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
  const newItem: GiftItem = {
    id: `gift-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
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
    isSecretIdea: Boolean(req.body.isSecretIdea),
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
    if (lower.includes('livre') || lower.includes('roman') || lower.includes('bd') || lower.includes('manga') || lower.includes('book')) {
      category = 'Livres & Culture';
    } else if (lower.includes('pull') || lower.includes('veste') || lower.includes('chaussure') || lower.includes('echarpe') || lower.includes('mode') || lower.includes('sac') || lower.includes('robe')) {
      category = 'Mode & Accessoires';
    } else if (lower.includes('casque') || lower.includes('audio') || lower.includes('ecouteur') || lower.includes('enceinte') || lower.includes('tech') || lower.includes('console') || lower.includes('liseuse')) {
      category = 'High-Tech & Audio';
    } else if (lower.includes('jeu') || lower.includes('jouet') || lower.includes('lego') || lower.includes('puzzle') || lower.includes('societe') || lower.includes('peinture') || lower.includes('atelier')) {
      category = 'Jeux & Loisirs';
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
    "category": "Maison & Décoration" | "High-Tech & Audio" | "Mode & Accessoires" | "Jeux & Loisirs" | "Livres & Culture" | "Beauté & Bien-être",
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

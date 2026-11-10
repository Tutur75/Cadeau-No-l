import React, { useState } from 'react';
import { X, Link2, Sparkles, Plus, Image as ImageIcon, Loader2, Upload, Trash2, ExternalLink } from 'lucide-react';
import { FamilyMember, GiftItem, CATEGORIES } from '../types';
import { scrapeLink, getAiSuggestions } from '../services/api';
import confetti from 'canvas-confetti';

interface AddGiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddGift: (giftData: Partial<GiftItem>) => Promise<void>;
  defaultRecipient?: FamilyMember;
  initialEditGift?: GiftItem | null;
  onDeleteGift?: (id: string) => void;
}

export const AddGiftModal: React.FC<AddGiftModalProps> = ({
  isOpen,
  onClose,
  onAddGift,
  defaultRecipient = 'Audrey',
  initialEditGift = null,
  onDeleteGift,
}) => {
  const [activeTab, setActiveTab] = useState<'url' | 'manual' | 'ideas'>('url');
  
  // Form fields
  const [urlInput, setUrlInput] = useState('');
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  
  const [recipient, setRecipient] = useState<FamilyMember>(defaultRecipient);
  const [title, setTitle] = useState('');
  const [price, setPrice] = useState<number | string>('');
  const [storeName, setStoreName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[1]);
  const [priority, setPriority] = useState<'Coup de cœur' | 'Très souhaité' | 'Souhaité'>('Très souhaité');
  const [imageUrl, setImageUrl] = useState('');
  const [description, setDescription] = useState('');

  // Suggestions state
  const [ideas, setIdeas] = useState<any[]>([]);
  const [isLoadingIdeas, setIsLoadingIdeas] = useState(false);

  // Populate form if in edit mode
  React.useEffect(() => {
    if (initialEditGift) {
      setActiveTab('manual');
      setRecipient(initialEditGift.recipient);
      setTitle(initialEditGift.title);
      setPrice(initialEditGift.price);
      setStoreName(initialEditGift.storeName || '');
      setCategory(initialEditGift.category);
      setPriority(initialEditGift.priority);
      setImageUrl(initialEditGift.imageUrl || '');
      setDescription(initialEditGift.description || '');
      setUrlInput(initialEditGift.url || '');
    } else {
      setRecipient(defaultRecipient);
      setTitle('');
      setPrice('');
      setStoreName('');
      setCategory(CATEGORIES[1]);
      setPriority('Très souhaité');
      setImageUrl('');
      setDescription('');
      setUrlInput('');
      setScrapeError('');
    }
  }, [initialEditGift, defaultRecipient, isOpen]);

  if (!isOpen) return null;

  // Handle URL scraping
  const handleScrape = async () => {
    if (!urlInput.trim()) {
      setScrapeError('Veuillez entrer une adresse URL');
      return;
    }
    setIsScraping(true);
    setScrapeError('');

    try {
      const data = await scrapeLink(urlInput.trim());
      if (data.title) setTitle(data.title);
      if (data.price !== undefined && data.price !== null && data.price !== '') {
        setPrice(data.price);
      }
      if (data.siteName) setStoreName(data.siteName);
      if (data.imageUrl) setImageUrl(data.imageUrl);
      if (data.description) setDescription(data.description);
      if (data.category) setCategory(data.category);
    } catch (err: any) {
      setScrapeError(err.message || 'Impossible d\'analyser le lien, veuillez remplir les détails ci-dessous.');
    } finally {
      setIsScraping(false);
    }
  };

  // Handle photo file import
  const handlePhotoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 6 * 1024 * 1024) {
      alert("L'image sélectionnée est trop lourde (maximum 6 Mo).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        setImageUrl(event.target.result);
      }
    };
    reader.readAsDataURL(file);
  };

  // Load AI ideas
  const handleLoadIdeas = async (targetPerson: FamilyMember) => {
    setIsLoadingIdeas(true);
    try {
      const data = await getAiSuggestions(targetPerson);
      setIdeas(data.gifts || []);
    } catch {
      // fallback
    } finally {
      setIsLoadingIdeas(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await onAddGift({
      recipient,
      title: title.trim(),
      price: Number(price) || 0,
      storeName: storeName.trim(),
      category,
      priority,
      imageUrl: imageUrl.trim(),
      description: description.trim(),
      url: urlInput.trim(),
      addedBy: recipient,
    });

    try {
      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#b91c1c', '#047857', '#d97706', '#ffffff'],
      });
    } catch {
      // ignore
    }

    onClose();
  };

  const selectIdea = (idea: any) => {
    setTitle(idea.title);
    setPrice(idea.price || 0);
    setDescription(idea.description || '');
    setCategory(idea.category || 'Maison & Décoration');
    setPriority(idea.priority || 'Très souhaité');
    if (idea.storeName) setStoreName(idea.storeName);
    if (idea.imageUrl) setImageUrl(idea.imageUrl);
    if (idea.link) setUrlInput(idea.link);
    setActiveTab('manual');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-gradient-to-r from-red-50/50 to-amber-50/30">
          <div>
            <h2 className="font-serif text-xl font-bold text-stone-900">
              {initialEditGift ? 'Modifier le cadeau' : 'Ajouter un cadeau à la liste'}
            </h2>
            <p className="text-xs text-stone-500">
              Inspiré de Milirose avec lien boutique dédié et import de photos
            </p>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tab switcher */}
        {!initialEditGift && (
          <div className="flex border-b border-stone-200 px-6 bg-stone-50/70">
            <button
              onClick={() => setActiveTab('url')}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'url'
                  ? 'border-red-600 text-red-700 bg-white'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Link2 className="h-3.5 w-3.5" />
              <span>Par lien web automatique</span>
            </button>

            <button
              onClick={() => setActiveTab('manual')}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'manual'
                  ? 'border-red-600 text-red-700 bg-white'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Saisie manuelle</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('ideas');
                if (ideas.length === 0) handleLoadIdeas(recipient);
              }}
              className={`flex items-center gap-2 py-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === 'ideas'
                  ? 'border-amber-500 text-amber-700 bg-white'
                  : 'border-transparent text-stone-500 hover:text-stone-800'
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Inspirations cadeaux</span>
            </button>
          </div>
        )}

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          
          {/* Target Recipient Selector */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              Destinataire du souhait :
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['Audrey', 'Arthur', 'Zoé'] as FamilyMember[]).map((name) => (
                <button
                  type="button"
                  key={name}
                  onClick={() => {
                    setRecipient(name);
                    if (activeTab === 'ideas') handleLoadIdeas(name);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-semibold border transition-all ${
                    recipient === name
                      ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                      : 'border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  <span>{name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* TAB 1: Auto Link Scraping */}
          {activeTab === 'url' && (
            <div className="rounded-xl bg-rose-50/50 border border-rose-100 p-4 space-y-3">
              <label className="block text-xs font-semibold text-rose-950">
                Collez l'adresse du site marchand (Fnac, Amazon, Zara, Nature &amp; Découvertes, etc.)
              </label>

              <div className="flex gap-2">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://www.fnac.com/livre-ou-article..."
                  className="flex-1 px-3.5 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
                <button
                  type="button"
                  onClick={handleScrape}
                  disabled={isScraping}
                  className="px-4 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition-colors disabled:opacity-50"
                >
                  {isScraping ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>Extraction...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                      <span>Analyser le lien</span>
                    </>
                  )}
                </button>
              </div>

              {scrapeError && (
                <p className="text-xs text-rose-600 leading-relaxed">{scrapeError}</p>
              )}

              {title && (
                <div className="mt-2 p-3 bg-white rounded-lg border border-rose-200 flex items-center gap-3">
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={title}
                      className="h-12 w-12 rounded object-cover border border-stone-200 shrink-0"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="h-12 w-12 rounded bg-stone-100 flex items-center justify-center shrink-0">
                      <ImageIcon className="h-5 w-5 text-stone-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-bold text-stone-900 truncate">{title}</div>
                    <div className="text-[11px] text-stone-500">
                      {price ? `${price} €` : 'Prix libre'} {storeName ? `· ${storeName}` : ''}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Inspirations & Ideas */}
          {activeTab === 'ideas' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-stone-600">
                  Idées cadeaux suggérées pour <strong>{recipient}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => handleLoadIdeas(recipient)}
                  disabled={isLoadingIdeas}
                  className="text-xs text-red-700 hover:underline flex items-center gap-1"
                >
                  {isLoadingIdeas && <Loader2 className="h-3 w-3 animate-spin" />}
                  <span>Recharger des suggestions</span>
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {ideas.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => selectIdea(item)}
                    className="p-3 rounded-lg border border-stone-200 bg-stone-50/70 hover:bg-stone-100/90 cursor-pointer transition-colors flex items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <div className="text-xs font-bold text-stone-900">{item.title}</div>
                      <div className="text-[11px] text-stone-600">{item.description}</div>
                      <div className="text-[11px] text-stone-500 mt-0.5">
                        {item.price} € · {item.storeName || item.category}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="shrink-0 p-1.5 rounded bg-white text-stone-700 hover:bg-stone-900 hover:text-white transition-colors"
                      title="Utiliser cette idée"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Detailed fields (Available for both creation and editing) */}
          <div className="space-y-3 pt-2">
            
            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Nom de l'article / Titre du cadeau *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex : Pull en cachemire écru, Jeu de société, Liseuse..."
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>

            {/* Price & Store Name */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Prix indicatif (€)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Ex : 49.90"
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 tabular-nums"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Enseigne / Nom de la boutique
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  placeholder="Ex : Fnac, Nature & Découvertes, Zara..."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>
            </div>

            {/* NEW EXPLICIT FIELD: Lien boutique (site marchand externe) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-stone-500" />
                  <span>Lien boutique (site marchand externe)</span>
                </label>

                {urlInput.trim() && (
                  <a
                    href={urlInput.startsWith('http') ? urlInput : `https://${urlInput}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-red-700 hover:underline"
                    title="Ouvre le lien dans une nouvelle fenêtre dédiée"
                  >
                    <span>Tester le lien</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              <div className="relative">
                <input
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://www.site-marchand.com/produit..."
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                />
              </div>
              <p className="mt-1 text-[11px] text-stone-400">
                Ce lien s'ouvrira dans une fenêtre dédiée lorsque les proches cliqueront dessus.
              </p>
            </div>

            {/* Category & Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Catégorie
                </label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                >
                  {CATEGORIES.filter(c => c !== 'Toutes les catégories').map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1">
                  Priorité du souhait
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                >
                  <option value="Coup de cœur">❤️ Coup de cœur</option>
                  <option value="Très souhaité">⭐ Très souhaité</option>
                  <option value="Souhaité">🎁 Souhaité</option>
                </select>
              </div>
            </div>

            {/* PHOTO FIELD WITH PHOTO IMPORT BUTTON */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Photo du cadeau (Import de photo ou URL)
              </label>

              {/* Photo preview and file upload button */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-semibold cursor-pointer transition-colors border border-stone-200 shadow-xs">
                    <Upload className="h-3.5 w-3.5 text-stone-600" />
                    <span>Importer une photo depuis l'appareil</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoFileUpload}
                      className="hidden"
                    />
                  </label>

                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Retirer la photo</span>
                    </button>
                  )}
                </div>

                {/* Optional manual URL or preview */}
                <div className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    placeholder="Ou collez l'URL d'une image web (https://...)"
                    className="flex-1 px-3 py-1.5 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                  {imageUrl && (
                    <img
                      src={imageUrl}
                      alt="Aperçu du cadeau"
                      className="h-10 w-10 rounded-lg object-cover border border-stone-200 shrink-0 shadow-xs"
                      referrerPolicy="no-referrer"
                    />
                  )}
                </div>
              </div>
            </div>

            {/* Remarks / Details */}
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1">
                Remarques (taille, couleur, détails, édition)
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex : Taille M, coloris beige avoine de préférence, avec ticket cadeau si possible."
                className="w-full px-3 py-2 text-xs sm:text-sm bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 resize-none"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-stone-200 flex items-center justify-between gap-3">
            {initialEditGift && onDeleteGift ? (
              <button
                type="button"
                onClick={() => {
                  const id = initialEditGift.id;
                  onClose();
                  onDeleteGift(id);
                }}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 flex items-center gap-1.5 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
                <span>Supprimer ce cadeau</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-700 text-white text-xs sm:text-sm font-semibold shadow-md hover:from-red-700 hover:to-rose-800 transition-all active:scale-98"
              >
                {initialEditGift ? 'Enregistrer les modifications' : 'Ajouter à la liste de Noël'}
              </button>
            </div>
          </div>

        </form>

      </div>
    </div>
  );
};

import React, { useState } from 'react';
import { X, GitBranch, Database, Download, Upload, Check, Copy, Archive, FolderArchive } from 'lucide-react';
import { GiftItem } from '../types';
import { importGifts } from '../services/api';

interface GitHubModalProps {
  isOpen: boolean;
  onClose: () => void;
  gifts: GiftItem[];
  onDataReload: () => void;
}

export const GitHubModal: React.FC<GitHubModalProps> = ({
  isOpen,
  onClose,
  gifts,
  onDataReload,
}) => {
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState('');
  const [downloadingZip, setDownloadingZip] = useState(false);

  if (!isOpen) return null;

  const downloadJson = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(gifts, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `listes-de-noel-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const downloadZip = () => {
    setDownloadingZip(true);
    window.location.href = '/api/export-project-zip';
    setTimeout(() => setDownloadingZip(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (Array.isArray(parsed)) {
          await importGifts(parsed);
          setImportMessage(`✓ ${parsed.length} cadeaux importés avec succès !`);
          onDataReload();
        } else {
          setImportMessage('Erreur : Le fichier doit contenir un tableau de souhaits.');
        }
      } catch {
        setImportMessage('Erreur : Fichier JSON corrompu ou invalide.');
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
  };

  const gitCommandSnippet = `# 1. Ajoutez l'adresse de votre dépôt GitHub personnel :
git remote add origin https://github.com/VOTRE_PSEUDO/listes-noel-famille.git

# 2. Définissez la branche principale sur main :
git branch -M main

# 3. Poussez l'ensemble du projet (code, photos et base de données) :
git push -u origin main`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(gitCommandSnippet);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-stone-900 text-white shadow-xs">
              <GitBranch className="h-4 w-4" />
            </span>
            <div>
              <h2 className="font-serif text-lg font-bold text-stone-900">
                Sauvegarde &amp; Export GitHub
              </h2>
              <p className="text-xs text-stone-500">Exporter en ZIP, télécharger les données ou lier à GitHub</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          
          {/* OPTION 1: Export complet en ZIP */}
          <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50/50 to-amber-50/30 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderArchive className="h-4 w-4 text-red-700" />
                <h3 className="text-sm font-bold text-stone-900">
                  Option 1 : Télécharger tout le projet en archive ZIP
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-red-700 bg-red-100 px-2 py-0.5 rounded-full">
                Le plus simple
              </span>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Téléchargez immédiatement une archive <strong>.zip</strong> complète contenant tous les fichiers du projet (code source React, serveur Express, configuration Tailwind, images et base de données locale).
            </p>

            <button
              onClick={downloadZip}
              disabled={downloadingZip}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 text-white text-xs sm:text-sm font-semibold shadow-sm transition-all active:scale-98 disabled:opacity-50"
            >
              <Archive className="h-4 w-4" />
              <span>{downloadingZip ? 'Préparation du zip...' : 'Télécharger le projet complet (.zip)'}</span>
            </button>
          </div>

          {/* OPTION 2: Liaison directe à votre compte GitHub */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <GitBranch className="h-4 w-4 text-stone-900" />
                <h3 className="text-sm font-bold text-stone-900">
                  Option 2 : Lier à votre propre dépôt GitHub
                </h3>
              </div>
              <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Git configuré (branche main)
              </span>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Le projet dispose déjà d'un historique Git initialisé et commité. Pour lier le projet à votre compte GitHub personnel :
            </p>

            <ol className="text-xs text-stone-600 space-y-1 list-decimal list-inside pl-1">
              <li>Créez un nouveau dépôt sur votre compte GitHub (ex : <code>listes-noel-famille</code>).</li>
              <li>Lancez ces commandes dans le terminal :</li>
            </ol>

            <div className="relative rounded-xl bg-stone-950 text-stone-200 p-4 font-mono text-xs overflow-x-auto shadow-inner">
              <pre>{gitCommandSnippet}</pre>
              <button
                onClick={copyToClipboard}
                className="absolute top-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-sans transition-colors"
              >
                {copiedCmd ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-400" />
                    <span>Copié !</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copier</span>
                  </>
                )}
              </button>
            </div>

            <p className="text-[11px] text-stone-500 italic">
              💡 Vous pouvez également nous donner l'URL de votre dépôt GitHub et votre token si vous souhaitez que nous poussions directement pour vous.
            </p>
          </div>

          {/* OPTION 3: Sauvegarde des données JSON uniquement */}
          <div className="rounded-xl border border-stone-200 bg-stone-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-stone-700" />
                <h4 className="text-xs font-bold text-stone-900">
                  Option 3 : Sauvegarde de la base de données ({gifts.length} cadeaux)
                </h4>
              </div>
            </div>

            <p className="text-xs text-stone-600 leading-relaxed">
              Téléchargez uniquement le fichier de données JSON pour faire une copie de sécurité de vos listes ou restaurer une liste précédente.
            </p>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={downloadJson}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 text-xs font-semibold text-stone-800 shadow-xs transition-colors"
              >
                <Download className="h-3.5 w-3.5 text-stone-600" />
                <span>Télécharger les données (.json)</span>
              </button>

              <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-stone-200 hover:bg-stone-50 text-xs font-semibold text-stone-800 shadow-xs transition-colors cursor-pointer">
                <Upload className="h-3.5 w-3.5 text-stone-600" />
                <span>{importing ? 'Import en cours...' : 'Restaurer un fichier JSON'}</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {importMessage && (
              <p className="text-xs font-medium text-emerald-700">{importMessage}</p>
            )}
          </div>

        </div>

        <div className="px-6 py-4 border-t border-stone-100 bg-stone-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold transition-colors"
          >
            Fermer
          </button>
        </div>

      </div>
    </div>
  );
};

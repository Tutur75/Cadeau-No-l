import React, { useState } from 'react';
import { X, Lock, KeyRound, Check, ShieldCheck, AlertCircle, LogOut } from 'lucide-react';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  onLogin: (code: string) => boolean;
  onLogout: () => void;
  onChangeCode: (oldCode: string, newCode: string) => boolean;
}

export const AdminModal: React.FC<AdminModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
  onLogin,
  onLogout,
  onChangeCode,
}) => {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Mode change PIN
  const [isChangingPin, setIsChangingPin] = useState(false);
  const [oldCode, setOldCode] = useState('');
  const [newCode, setNewCode] = useState('');

  React.useEffect(() => {
    if (isOpen) {
      setCode('');
      setError('');
      setSuccess('');
      setIsChangingPin(false);
      setOldCode('');
      setNewCode('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const ok = onLogin(code.trim());
    if (ok) {
      onClose();
    } else {
      setError('Code administrateur incorrect. Veuillez réessayer.');
    }
  };

  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (newCode.trim().length < 4) {
      setError('Le nouveau code doit contenir au moins 4 caractères.');
      return;
    }

    const ok = onChangeCode(oldCode.trim(), newCode.trim());
    if (ok) {
      setSuccess('Code administrateur modifié avec succès !');
      setIsChangingPin(false);
      setOldCode('');
      setNewCode('');
    } else {
      setError('Ancien code incorrect.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-950/60 backdrop-blur-xs">
      <div className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl border border-stone-200 overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 bg-stone-50">
          <div className="flex items-center gap-2.5">
            <span className={`flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-xs ${
              isAdmin ? 'bg-amber-600' : 'bg-stone-900'
            }`}>
              {isAdmin ? <ShieldCheck className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
            </span>
            <div>
              <h2 className="font-serif text-lg font-bold text-stone-900">
                {isAdmin ? 'Espace Administration Actif' : 'Connexion Administrateur'}
              </h2>
              <p className="text-xs text-stone-500">
                {isAdmin ? 'Gestion des listes de souhaits' : 'Réservé aux gestionnaires des listes'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          
          {isAdmin ? (
            /* Already logged in as Admin */
            <div className="space-y-4">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-xs text-emerald-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-emerald-950">
                  <Check className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Vous êtes connecté en tant qu'administrateur</span>
                </div>
                <p className="text-emerald-800/90 leading-relaxed">
                  Vous avez l'accès complet pour ajouter des cadeaux, modifier les détails, supprimer des souhaits et gérer la base de données.
                </p>
              </div>

              {!isChangingPin ? (
                <div className="space-y-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsChangingPin(true)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-stone-200 bg-white hover:bg-stone-50 text-stone-700 text-xs font-semibold transition-colors"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-stone-500" />
                    <span>Modifier le code administrateur</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onLogout();
                      onClose();
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5" />
                    <span>Repasser en mode visiteur (lecture seule)</span>
                  </button>
                </div>
              ) : (
                /* Form to change code */
                <form onSubmit={handleChangePinSubmit} className="space-y-3 pt-2">
                  <h4 className="text-xs font-bold text-stone-900">Nouveau code admin</h4>
                  <div>
                    <label className="block text-xs text-stone-600 mb-1">Code actuel</label>
                    <input
                      type="password"
                      required
                      value={oldCode}
                      onChange={(e) => setOldCode(e.target.value)}
                      placeholder="Code actuel"
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-stone-600 mb-1">Nouveau code</label>
                    <input
                      type="text"
                      required
                      value={newCode}
                      onChange={(e) => setNewCode(e.target.value)}
                      placeholder="Ex : NOEL2026, SAPIN, etc."
                      className="w-full px-3 py-2 text-xs bg-white border border-stone-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                    />
                  </div>

                  {error && <p className="text-xs text-red-600">{error}</p>}
                  {success && <p className="text-xs text-emerald-600">{success}</p>}

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsChangingPin(false)}
                      className="flex-1 py-2 text-xs text-stone-600 hover:bg-stone-100 rounded-lg"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg"
                    >
                      Enregistrer
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* Visitor Login Form */
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                  Entrez le code administrateur
                </label>
                <div className="relative">
                  <input
                    type="password"
                    autoFocus
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    placeholder="Code admin"
                    className="w-full px-3.5 py-2.5 text-sm bg-stone-50 border border-stone-300 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-medium text-stone-600 hover:text-stone-900 transition-colors"
                >
                  Continuer en visiteur
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold shadow-xs transition-colors"
                >
                  Déverrouiller l'administration
                </button>
              </div>
            </form>
          )}

        </div>

      </div>
    </div>
  );
};

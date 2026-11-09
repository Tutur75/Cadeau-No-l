import React from 'react';
import { Search, Heart, CheckCircle2, RotateCcw, LayoutGrid, FolderTree } from 'lucide-react';
import { FilterState, CATEGORIES, PriceFilter, SortOption } from '../types';

interface FilterBarProps {
  filter: FilterState;
  onChangeFilter: (updates: Partial<FilterState>) => void;
  onResetFilter: () => void;
  totalFilteredCount: number;
  groupByCategory: boolean;
  onToggleGroupByCategory: () => void;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filter,
  onChangeFilter,
  onResetFilter,
  totalFilteredCount,
  groupByCategory,
  onToggleGroupByCategory,
}) => {
  const isFiltered =
    filter.search !== '' ||
    filter.recipient !== 'all' ||
    filter.category !== 'Toutes les catégories' ||
    filter.status !== 'all' ||
    filter.priceRange !== 'all';

  return (
    <div className="bg-white rounded-xl border border-stone-200/80 p-4 shadow-xs space-y-3.5 mb-6">
      
      {/* First Row: Search, Category dropdown, and Sort */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-stone-400" />
          <input
            type="text"
            value={filter.search}
            onChange={(e) => onChangeFilter({ search: e.target.value })}
            placeholder="Rechercher une idée, une boutique, un livre, un vêtement..."
            className="w-full pl-9 pr-4 py-2 text-sm bg-stone-50 border border-stone-200 rounded-lg text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-colors"
          />
          {filter.search && (
            <button
              onClick={() => onChangeFilter({ search: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-stone-400 hover:text-stone-700"
            >
              Effacer
            </button>
          )}
        </div>

        {/* View toggle & Category/Sort Controls */}
        <div className="shrink-0 flex items-center gap-2">
          
          {/* Classification toggle button */}
          <button
            type="button"
            onClick={onToggleGroupByCategory}
            title={groupByCategory ? "Afficher en grille continue" : "Classer les cadeaux par catégories"}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-all shadow-xs whitespace-nowrap ${
              groupByCategory
                ? 'border-red-600 bg-red-50 text-red-800'
                : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'
            }`}
          >
            {groupByCategory ? (
              <>
                <FolderTree className="h-3.5 w-3.5 text-red-600" />
                <span>Par catégories</span>
              </>
            ) : (
              <>
                <LayoutGrid className="h-3.5 w-3.5 text-stone-500" />
                <span>Grille simple</span>
              </>
            )}
          </button>

          {/* Category selector */}
          <select
            value={filter.category}
            onChange={(e) => onChangeFilter({ category: e.target.value })}
            className="text-xs sm:text-sm bg-white border border-stone-200 rounded-lg px-3 py-2 text-stone-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          {/* Sort selector */}
          <select
            value={filter.sortBy}
            onChange={(e) => onChangeFilter({ sortBy: e.target.value as SortOption })}
            className="text-xs sm:text-sm bg-white border border-stone-200 rounded-lg px-3 py-2 text-stone-700 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
          >
            <option value="priority">Priorité</option>
            <option value="price-asc">Prix croissant</option>
            <option value="price-desc">Prix décroissant</option>
            <option value="recent">Derniers ajouts</option>
          </select>
        </div>
      </div>

      {/* Second Row: Interactive Status Filters & Price Segmented Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-stone-100">
        
        {/* Status segmented controls */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-stone-100/80 rounded-lg">
          <button
            onClick={() => onChangeFilter({ status: 'all' })}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              filter.status === 'all'
                ? 'bg-white text-stone-900 shadow-xs'
                : 'text-stone-600 hover:text-stone-900'
            }`}
          >
            Tous les statuts
          </button>
          <button
            onClick={() => onChangeFilter({ status: 'available' })}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 whitespace-nowrap ${
              filter.status === 'available'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-stone-600 hover:text-emerald-700'
            }`}
          >
            <span>Disponibles</span>
          </button>
          <button
            onClick={() => onChangeFilter({ status: 'reserved' })}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 whitespace-nowrap ${
              filter.status === 'reserved'
                ? 'bg-rose-700 text-white shadow-xs'
                : 'text-stone-600 hover:text-rose-700'
            }`}
          >
            <CheckCircle2 className="h-3 w-3" />
            <span>Déjà réservés</span>
          </button>
          <button
            onClick={() => onChangeFilter({ status: 'favorites' })}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors flex items-center gap-1 whitespace-nowrap ${
              filter.status === 'favorites'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-stone-600 hover:text-amber-700'
            }`}
          >
            <Heart className="h-3 w-3 fill-current" />
            <span>Coups de cœur</span>
          </button>
        </div>

        {/* Price filter segmented */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-stone-400 font-medium mr-1 hidden sm:inline">Budget :</span>
          {(
            [
              { id: 'all', label: 'Tous prix' },
              { id: 'under30', label: '< 30 €' },
              { id: '30to75', label: '30 - 75 €' },
              { id: 'over75', label: '> 75 €' },
            ] as Array<{ id: PriceFilter; label: string }>
          ).map((p) => (
            <button
              key={p.id}
              onClick={() => onChangeFilter({ priceRange: p.id })}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                filter.priceRange === p.id
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {p.label}
            </button>
          ))}

          {isFiltered && (
            <button
              onClick={onResetFilter}
              className="ml-2 flex items-center gap-1 text-xs text-rose-600 hover:text-rose-800 transition-colors"
              title="Réinitialiser les filtres"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Effacer</span>
            </button>
          )}
        </div>

      </div>

      {/* Quiet result counter */}
      <div className="flex items-center justify-between text-xs text-stone-500 pt-1">
        <span>
          {totalFilteredCount} {totalFilteredCount > 1 ? 'cadeaux trouvés' : 'cadeau trouvé'}
          {filter.recipient !== 'all' ? ` pour ${filter.recipient}` : ' dans toute la famille'}
        </span>
        {groupByCategory && (
          <span className="text-[11px] text-stone-400">Classés par type de catégorie</span>
        )}
      </div>
    </div>
  );
};

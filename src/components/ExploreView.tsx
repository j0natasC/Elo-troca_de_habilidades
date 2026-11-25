import React from 'react';
import { IonIcon } from '@ionic/react';
import { closeOutline, locationOutline, searchOutline, star } from 'ionicons/icons';
import { UserAvatar } from './UserAvatar';
import type { CategoryItem, CategorySlug, CreatorSpotlight } from '../shared/types';

interface ExploreViewProps {
  categories: CategoryItem[];
  spotlights: CreatorSpotlight[];
  selectedCategory: CategorySlug | 'all';
  selectedMode: 'all' | 'Presencial' | 'Remoto';
  onlyRealUsers: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onCategoryChange: (cat: CategorySlug | 'all') => void;
  onModeChange: (mode: 'all' | 'Presencial' | 'Remoto') => void;
  onOnlyRealUsersChange: (onlyReal: boolean) => void;
  onSelectCreator: (creator: CreatorSpotlight) => void;
}

export const ExploreView: React.FC<ExploreViewProps> = ({
  categories,
  spotlights,
  selectedCategory,
  selectedMode,
  onlyRealUsers,
  searchQuery,
  onSearchChange,
  onCategoryChange,
  onModeChange,
  onOnlyRealUsersChange,
  onSelectCreator,
}) => {
  return (
    <div className="space-y-5 pb-6">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Explorar habilidades
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Pesquise por categoria, localização ou modalidade de atendimento na ELO+.
        </p>
      </div>

      {/* Search bar */}
      <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl px-4 h-12 shadow-sm focus-within:border-[#1B3C59] dark:focus-within:border-[#51A644]">
        <IonIcon icon={searchOutline} className="text-slate-400 text-lg mr-3 shrink-0" />
        <label htmlFor="explore-search" className="sr-only">
          Buscar talentos, habilidades ou bairros
        </label>
        <input
          id="explore-search"
          type="search"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Buscar por habilidade, bairro (ex.: Santo Amaro) ou serviço..."
          className="w-full bg-transparent text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Limpar busca"
            className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-600"
          >
            <IonIcon icon={closeOutline} />
          </button>
        )}
      </div>

      {/* Modality & Origin filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
            Atendimento:
          </span>
          {(['all', 'Presencial', 'Remoto'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onModeChange(m)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors ${
                selectedMode === m
                  ? 'bg-[#1B3C59] text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
              }`}
            >
              {m === 'all' ? 'Todos' : m}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => onOnlyRealUsersChange(!onlyRealUsers)}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-colors border ${
            onlyRealUsers
              ? 'bg-[#51A644] text-white border-[#51A644]'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          {onlyRealUsers ? 'Mostrando membros reais' : 'Somente membros reais'}
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => onCategoryChange('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
            selectedCategory === 'all'
              ? 'bg-[#1B3C59] text-white'
              : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
          }`}
        >
          Todas
        </button>
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onCategoryChange(cat.id)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              selectedCategory === cat.id
                ? 'bg-[#51A644] text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* Results */}
      {spotlights.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center">
          <p className="font-display font-semibold text-slate-800 dark:text-slate-200">
            Nenhum prestador encontrado para esse filtro.
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Tente limpar a busca ou alterar a modalidade de atendimento.
          </p>
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              onCategoryChange('all');
              onModeChange('all');
            }}
            className="mt-4 px-4 py-2 rounded-xl bg-[#1B3C59] text-white text-xs font-semibold"
          >
            Mostrar todos
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {spotlights.map((creator) => (
            <button
              key={creator.id}
              type="button"
              onClick={() => onSelectCreator(creator)}
              className="text-left rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-3.5"
            >
              <div className="flex items-center gap-3.5">
                <UserAvatar
                  src={creator.avatarUrl}
                  name={creator.fullName}
                  className="w-14 h-14 rounded-2xl shrink-0"
                  textClassName="text-base"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <h3 className="font-display font-bold text-base text-slate-900 dark:text-white truncate">
                        {creator.displayName}
                      </h3>
                      <span
                        className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold shrink-0 ${
                          creator.isDemo
                            ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                            : 'bg-[#51A644]/15 text-[#3e8533] dark:text-[#85BF4B]'
                        }`}
                      >
                        {creator.isDemo ? 'Exemplo' : 'Real'}
                      </span>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-500 tabular-nums shrink-0">
                      <IonIcon icon={star} className="text-xs" />
                      {creator.rating.toFixed(1)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {creator.roleTitle} · {creator.mode}
                  </p>
                  <p className="text-[11px] text-slate-400 inline-flex items-center gap-1 mt-0.5 truncate max-w-full">
                    <IonIcon icon={locationOutline} className="shrink-0" />
                    {creator.location} ({creator.distanceKm} km)
                  </p>
                </div>
              </div>

              <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                {creator.bio || 'Membro da comunidade ELO+ aberto a trocas de habilidades.'}
              </p>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-xs">
                <p className="text-slate-700 dark:text-slate-200 truncate">
                  <span className="font-semibold">Oferece:</span>{' '}
                  {creator.skills.length > 0 ? creator.skills.join(' · ') : 'A combinar'}
                </p>
                <p className="text-[#51A644] dark:text-[#85BF4B] truncate">
                  <span className="font-semibold">Busca em troca:</span>{' '}
                  {creator.desiredSkills.length > 0
                    ? creator.desiredSkills.join(' · ')
                    : 'Aberto a propostas'}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

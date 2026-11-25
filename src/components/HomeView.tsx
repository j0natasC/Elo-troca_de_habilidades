import React from 'react';
import { IonIcon } from '@ionic/react';
import {
  locationOutline,
  notificationsOutline,
  star,
  starOutline,
  swapHorizontalOutline,
} from 'ionicons/icons';
import { CategoryIconTile } from './CategoryIconTile';
import { UserAvatar } from './UserAvatar';
import type {
  CategoryItem,
  CategorySlug,
  CreatorSpotlight,
  ExchangeProposal,
  UserProfile,
} from '../shared/types';

interface HomeViewProps {
  user: UserProfile;
  categories: CategoryItem[];
  spotlights: CreatorSpotlight[];
  exchanges: ExchangeProposal[];
  unreadNotificationsCount: number;
  onlyRealUsers: boolean;
  onOnlyRealUsersChange: (onlyReal: boolean) => void;
  onOpenProfile: () => void;
  onOpenExchanges: () => void;
  onOpenNotifications: () => void;
  onSelectCategory: (categoryId: CategorySlug) => void;
  onSelectCreator: (creator: CreatorSpotlight) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  categories,
  spotlights,
  exchanges,
  unreadNotificationsCount,
  onlyRealUsers,
  onOnlyRealUsersChange,
  onOpenProfile,
  onOpenExchanges,
  onOpenNotifications,
  onSelectCategory,
  onSelectCreator,
}) => {
  const visibleSpotlights = onlyRealUsers ? spotlights.filter((c) => !c.isDemo) : spotlights;
  const activeExchangesCount = exchanges.filter((e) =>
    ['PENDENTE', 'CONTRAPROPOSTA', 'CONFIRMADA'].includes(e.status),
  ).length;

  const renderStars = (rating: number) => {
    const filled = Math.round(rating);
    return (
      <div className="flex items-center gap-1 mt-1.5" aria-label={`Avaliação ${rating} de 5`}>
        {[1, 2, 3, 4, 5].map((n) => (
          <IonIcon
            key={n}
            icon={n <= filled ? star : starOutline}
            className={`text-xs ${n <= filled ? 'text-amber-300' : 'text-white/80'}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-8 pb-6">
      {/* Header Bem-Vindo */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Bem-Vindo
          </h1>
          <p className="text-base text-slate-500 dark:text-slate-400 mt-0.5">
            {user.fullName}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onOpenNotifications}
            aria-label="Abrir notificações"
            className="relative w-12 h-12 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 shadow-sm"
          >
            <IonIcon icon={notificationsOutline} className="text-xl" />
            {unreadNotificationsCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-[#51A644] text-white text-[11px] font-bold flex items-center justify-center tabular-nums">
                {unreadNotificationsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={onOpenProfile}
            aria-label={`Abrir perfil de ${user.displayName}`}
            className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl overflow-hidden shadow-md ring-2 ring-white dark:ring-slate-800 hover:scale-[1.03] transition-transform shrink-0"
          >
            <UserAvatar
              src={user.avatarUrl}
              name={user.fullName}
              className="w-full h-full rounded-2xl"
              textClassName="text-lg"
            />
          </button>
        </div>
      </div>

      {/* Quick Collaborative Exchange Summary */}
      <button
        type="button"
        onClick={onOpenExchanges}
        className="w-full text-left rounded-2xl bg-[#1B3C59] text-white p-4 sm:p-5 flex items-center justify-between gap-4 shadow-sm hover:bg-[#153048] transition-colors"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-[#51A644] text-white flex items-center justify-center shrink-0">
            <IonIcon icon={swapHorizontalOutline} className="text-xl" />
          </div>
          <div className="min-w-0">
            <p className="font-display font-bold text-sm sm:text-base">
              Suas trocas e agendamentos na ELO+
            </p>
            <p className="text-xs text-slate-200 truncate">
              {activeExchangesCount > 0
                ? `${activeExchangesCount} negociação(ões) em andamento · Toque para acompanhar`
                : 'Proponha sua primeira troca de habilidade sem usar dinheiro'}
            </p>
          </div>
        </div>
        <span className="text-xs font-semibold text-[#85BF4B] whitespace-nowrap shrink-0">
          Ver trocas
        </span>
      </button>

      {/* Destaques do dia */}
      <section aria-labelledby="destaques-heading">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2
              id="destaques-heading"
              className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white"
            >
              Destaques do dia
            </h2>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {visibleSpotlights.length} prestadores disponíveis
            </span>
          </div>

          <div className="flex items-center gap-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => onOnlyRealUsersChange(false)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                !onlyRealUsers
                  ? 'bg-[#1B3C59] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => onOnlyRealUsersChange(true)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                onlyRealUsers
                  ? 'bg-[#51A644] text-white'
                  : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Membros reais
            </button>
          </div>
        </div>

        {visibleSpotlights.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-7 text-center space-y-2">
            <p className="font-medium text-sm text-slate-800 dark:text-slate-200">
              Nenhum outro membro real conectado visível no momento.
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Assim que outra pessoa entrar com o Google na ELO+, ela aparecerá aqui em tempo real.
            </p>
            <button
              type="button"
              onClick={() => onOnlyRealUsersChange(false)}
              className="mt-2 px-3.5 py-1.5 rounded-xl bg-[#1B3C59] text-white text-xs font-semibold"
            >
              Incluir perfis de exemplo
            </button>
          </div>
        ) : (
          <div className="flex lg:grid lg:grid-cols-2 xl:grid-cols-3 gap-4 overflow-x-auto pb-2 snap-x snap-mandatory lg:overflow-visible">
            {visibleSpotlights.map((creator) => (
              <button
                key={creator.id}
                type="button"
                onClick={() => onSelectCreator(creator)}
                className="group text-left shrink-0 w-[85vw] sm:w-[340px] lg:w-auto h-44 rounded-3xl overflow-hidden relative shadow-md hover:shadow-lg transition-all snap-start bg-slate-900 focus-visible:outline-2 focus-visible:outline-[#1B3C59]"
              >
                <div className="absolute inset-0 grid grid-cols-12">
                  <div className="col-span-7 relative bg-gradient-to-br from-[#1B3C59] via-[#224b6e] to-[#51A644]">
                    {creator.coverUrl && (
                      <img
                        src={creator.coverUrl}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/45 to-transparent" />
                  </div>
                  <div className="col-span-5 relative bg-slate-200 dark:bg-slate-800">
                    {creator.avatarUrl ? (
                      <img
                        src={creator.avatarUrl}
                        alt={creator.displayName}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <UserAvatar
                        src=""
                        name={creator.fullName}
                        className="w-full h-full rounded-none"
                        textClassName="text-2xl"
                      />
                    )}
                  </div>
                </div>

                <div className="relative z-10 h-full flex flex-col justify-center px-5 max-w-[66%]">
                  <span
                    className={`self-start mb-1.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tracking-wide ${
                      creator.isDemo
                        ? 'bg-black/55 text-slate-200'
                        : 'bg-[#51A644] text-white'
                    }`}
                  >
                    {creator.isDemo ? 'Exemplo' : 'Membro real'}
                  </span>
                  <span className="font-display text-xl font-bold text-white leading-tight truncate">
                    {creator.displayName}
                  </span>
                  <span className="text-sm text-slate-200 mt-0.5 truncate">
                    {creator.roleTitle}
                  </span>
                  <span className="text-[11px] text-slate-300 mt-1 inline-flex items-center gap-1 truncate">
                    <IonIcon icon={locationOutline} className="shrink-0" />
                    {creator.mode}
                  </span>
                  {renderStars(creator.rating)}
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* Categorias */}
      <section aria-labelledby="categorias-heading">
        <div className="flex items-baseline justify-between mb-4">
          <h2
            id="categorias-heading"
            className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white"
          >
            Categorias
          </h2>
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Toque para explorar
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSelectCategory(cat.id)}
              className="flex flex-col items-center justify-center p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all text-center min-h-[144px]"
            >
              <CategoryIconTile iconKey={cat.iconKey} size="md" />
              <span className="mt-3 font-medium text-sm text-slate-800 dark:text-slate-100 whitespace-nowrap">
                {cat.name}
              </span>
              <span className="mt-0.5 text-xs text-slate-400 tabular-nums">
                {cat.creatorCount} membros
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
};

import React, { useState } from 'react';
import { IonIcon, IonModal } from '@ionic/react';
import {
  calendarOutline,
  checkmarkCircleOutline,
  closeCircleOutline,
  closeOutline,
  locationOutline,
  star,
  swapHorizontalOutline,
} from 'ionicons/icons';
import { UserAvatar } from './UserAvatar';
import type { ExchangeProposal, ExchangeStatus, UserProfile } from '../shared/types';

interface ExchangesViewProps {
  user: UserProfile;
  exchanges: ExchangeProposal[];
  onRespond: (
    id: string,
    payload: {
      action: 'accept' | 'decline' | 'counter' | 'complete';
      scheduledDate?: string;
      location?: string;
      offeredSkill?: string;
      notes?: string;
    },
  ) => Promise<void>;
  onReview: (id: string, payload: { rating: number; comment: string }) => Promise<void>;
}

const STATUS_LABEL: Record<ExchangeStatus, string> = {
  PENDENTE: 'Aguardando resposta',
  CONTRAPROPOSTA: 'Contraproposta enviada',
  CONFIRMADA: 'Agendamento confirmado',
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDA: 'Troca concluída',
  CANCELADA: 'Cancelada',
};

const STATUS_COLOR: Record<ExchangeStatus, string> = {
  PENDENTE: 'text-amber-700 dark:text-amber-300',
  CONTRAPROPOSTA: 'text-blue-700 dark:text-blue-300',
  CONFIRMADA: 'text-[#51A644] dark:text-[#85BF4B]',
  EM_ANDAMENTO: 'text-indigo-700 dark:text-indigo-300',
  CONCLUIDA: 'text-emerald-700 dark:text-emerald-300',
  CANCELADA: 'text-red-600 dark:text-red-400',
};

export const ExchangesView: React.FC<ExchangesViewProps> = ({
  user,
  exchanges,
  onRespond,
  onReview,
}) => {
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all');
  const [counterTarget, setCounterTarget] = useState<ExchangeProposal | null>(null);
  const [counterDate, setCounterDate] = useState('');
  const [counterLocation, setCounterLocation] = useState('');
  const [counterSkill, setCounterSkill] = useState('');
  const [counterNotes, setCounterNotes] = useState('');

  const [reviewTarget, setReviewTarget] = useState<ExchangeProposal | null>(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');
  const [busy, setBusy] = useState(false);

  const visibleExchanges = exchanges.filter((ex) => {
    if (filter === 'active') {
      return ['PENDENTE', 'CONTRAPROPOSTA', 'CONFIRMADA', 'EM_ANDAMENTO'].includes(ex.status);
    }
    if (filter === 'done') {
      return ['CONCLUIDA', 'CANCELADA'].includes(ex.status);
    }
    return true;
  });

  const openCounterModal = (ex: ExchangeProposal) => {
    setCounterTarget(ex);
    setCounterDate(ex.scheduledDate);
    setCounterLocation(ex.location);
    setCounterSkill(ex.offeredSkill);
    setCounterNotes(ex.notes);
  };

  const handleCounterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!counterTarget) return;
    setBusy(true);
    try {
      await onRespond(counterTarget.id, {
        action: 'counter',
        scheduledDate: counterDate,
        location: counterLocation,
        offeredSkill: counterSkill,
        notes: counterNotes,
      });
      setCounterTarget(null);
    } finally {
      setBusy(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewTarget) return;
    setBusy(true);
    try {
      await onReview(reviewTarget.id, { rating: reviewRating, comment: reviewComment });
      setReviewTarget(null);
      setReviewComment('');
      setReviewRating(5);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6 pb-8">
      <div>
        <h1 className="font-display text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white">
          Trocas e Agendamentos
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Negocie habilidades, envie contrapropostas de data/local e avalie cada colaboração na ELO+.
        </p>
      </div>

      {/* Filter buttons */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {[
          { id: 'all', label: 'Todas' },
          { id: 'active', label: 'Em negociação e confirmadas' },
          { id: 'done', label: 'Concluídas e canceladas' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilter(tab.id as typeof filter)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 transition-colors ${
              filter === tab.id
                ? 'bg-[#1B3C59] text-white'
                : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {visibleExchanges.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-10 text-center">
          <p className="font-display font-semibold text-slate-800 dark:text-slate-200">
            Nenhuma troca encontrada neste filtro.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Acesse Explorar ou Início para propor uma troca de habilidades sem dinheiro.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {visibleExchanges.map((ex) => {
            const isProposer = ex.proposerId === user.id;
            const counterpartName = isProposer ? ex.receiverName : ex.proposerName;
            const counterpartAvatar = isProposer ? ex.receiverAvatarUrl : ex.proposerAvatarUrl;
            const alreadyReviewed = ex.reviews.some((r) => r.reviewerId === user.id);

            return (
              <div
                key={ex.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 p-5 shadow-sm flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <UserAvatar
                        src={counterpartAvatar}
                        name={counterpartName}
                        className="w-12 h-12 rounded-full shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-display font-bold text-base text-slate-900 dark:text-white truncate">
                          {counterpartName}
                        </p>
                        <p className={`text-xs font-semibold ${STATUS_COLOR[ex.status]}`}>
                          {STATUS_LABEL[ex.status]}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400 shrink-0">
                      {ex.mode}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 text-xs space-y-1.5">
                    <p className="font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2 flex-wrap">
                      <span>{ex.offeredSkill}</span>
                      <IonIcon icon={swapHorizontalOutline} className="text-[#51A644]" />
                      <span>{ex.requestedSkill}</span>
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <IonIcon icon={calendarOutline} className="shrink-0" />
                      <span className="tabular-nums">
                        {new Date(ex.scheduledDate).toLocaleString('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </span>
                    </p>
                    <p className="text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                      <IonIcon icon={locationOutline} className="shrink-0" />
                      <span>{ex.location}</span>
                    </p>
                    {ex.notes && (
                      <p className="text-slate-500 dark:text-slate-400 pt-1">{ex.notes}</p>
                    )}
                  </div>

                  {ex.reviews.length > 0 && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 border-t border-slate-100 dark:border-slate-800 pt-2.5">
                      {ex.reviews.map((rev, i) => (
                        <p key={i} className="flex items-center gap-1.5">
                          <IonIcon icon={star} className="text-amber-400 shrink-0" />
                          <span className="font-semibold">{rev.rating}/5</span>
                          <span>— {rev.comment}</span>
                        </p>
                      ))}
                    </div>
                  )}
                </div>

                {/* Action buttons according to negotiation state */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  {(ex.status === 'PENDENTE' || ex.status === 'CONTRAPROPOSTA') &&
                    (ex.receiverId.startsWith('creator-') || ex.lastUpdatedBy !== user.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onRespond(ex.id, { action: 'accept' })}
                          className="px-3.5 py-2 rounded-xl bg-[#51A644] hover:bg-[#448e39] text-white text-xs font-semibold flex items-center gap-1"
                        >
                          <IonIcon icon={checkmarkCircleOutline} />
                          <span>Aceitar</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openCounterModal(ex)}
                          className="px-3.5 py-2 rounded-xl bg-[#1B3C59] hover:bg-[#142d44] text-white text-xs font-semibold"
                        >
                          Contraproposta
                        </button>
                        <button
                          type="button"
                          onClick={() => onRespond(ex.id, { action: 'decline' })}
                          className="px-3.5 py-2 rounded-xl border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-1"
                        >
                          <IonIcon icon={closeCircleOutline} />
                          <span>Recusar</span>
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between w-full gap-2">
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          Aguardando resposta de {counterpartName}
                        </span>
                        <button
                          type="button"
                          onClick={() => onRespond(ex.id, { action: 'decline' })}
                          className="px-3.5 py-2 rounded-xl border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-xs font-semibold flex items-center gap-1"
                        >
                          <IonIcon icon={closeCircleOutline} />
                          <span>Cancelar proposta</span>
                        </button>
                      </div>
                    ))}

                  {ex.status === 'CONFIRMADA' && (
                    <>
                      <button
                        type="button"
                        onClick={() => onRespond(ex.id, { action: 'complete' })}
                        className="px-3.5 py-2 rounded-xl bg-[#1B3C59] text-white text-xs font-semibold"
                      >
                        Marcar como concluída
                      </button>
                      <button
                        type="button"
                        onClick={() => openCounterModal(ex)}
                        className="px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold"
                      >
                        Reagendar
                      </button>
                      <button
                        type="button"
                        onClick={() => onRespond(ex.id, { action: 'decline' })}
                        className="px-3.5 py-2 rounded-xl text-red-600 dark:text-red-400 text-xs font-semibold"
                      >
                        Cancelar
                      </button>
                    </>
                  )}

                  {ex.status === 'CONCLUIDA' && !alreadyReviewed && (
                    <button
                      type="button"
                      onClick={() => setReviewTarget(ex)}
                      className="px-3.5 py-2 rounded-xl bg-[#F2AE2E] text-slate-950 text-xs font-bold flex items-center gap-1"
                    >
                      <IonIcon icon={star} />
                      <span>Avaliar troca</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Counter-proposal Modal */}
      <IonModal isOpen={Boolean(counterTarget)} onDidDismiss={() => setCounterTarget(null)}>
        <div className="p-6 bg-white dark:bg-slate-900 min-h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Enviar contraproposta
            </h2>
            <button
              type="button"
              onClick={() => setCounterTarget(null)}
              aria-label="Fechar contraproposta"
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500"
            >
              <IonIcon icon={closeOutline} className="text-xl" />
            </button>
          </div>

          <form onSubmit={handleCounterSubmit} className="space-y-4 max-w-md mx-auto">
            <div>
              <label htmlFor="cp-skill" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Habilidade oferecida na contraproposta
              </label>
              <input
                id="cp-skill"
                type="text"
                value={counterSkill}
                onChange={(e) => setCounterSkill(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="cp-date" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Nova data e horário
              </label>
              <input
                id="cp-date"
                type="datetime-local"
                value={counterDate}
                onChange={(e) => setCounterDate(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="cp-location" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Novo local ou link remoto
              </label>
              <input
                id="cp-location"
                type="text"
                value={counterLocation}
                onChange={(e) => setCounterLocation(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="cp-notes" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Observações
              </label>
              <textarea
                id="cp-notes"
                rows={3}
                value={counterNotes}
                onChange={(e) => setCounterNotes(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-xl bg-[#1B3C59] text-white font-semibold text-sm"
            >
              Enviar contraproposta
            </button>
          </form>
        </div>
      </IonModal>

      {/* Review Modal */}
      <IonModal isOpen={Boolean(reviewTarget)} onDidDismiss={() => setReviewTarget(null)}>
        <div className="p-6 bg-white dark:bg-slate-900 min-h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Avaliar troca de habilidade
            </h2>
            <button
              type="button"
              onClick={() => setReviewTarget(null)}
              aria-label="Fechar avaliação"
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500"
            >
              <IonIcon icon={closeOutline} className="text-xl" />
            </button>
          </div>

          <form onSubmit={handleReviewSubmit} className="space-y-4 max-w-md mx-auto">
            <div>
              <label htmlFor="rev-stars" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Pontuação (1 a 5)
              </label>
              <select
                id="rev-stars"
                value={reviewRating}
                onChange={(e) => setReviewRating(Number(e.target.value))}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              >
                <option value={5}>5 — Excelente</option>
                <option value={4}>4 — Ótimo</option>
                <option value={3}>3 — Bom</option>
                <option value={2}>2 — Regular</option>
                <option value={1}>1 — Ruim</option>
              </select>
            </div>

            <div>
              <label htmlFor="rev-comment" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Comentário sobre pontualidade, comunicação e domínio
              </label>
              <textarea
                id="rev-comment"
                rows={3}
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="Conte como foi a experiência de troca..."
                className="w-full p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-xl bg-[#51A644] text-white font-semibold text-sm"
            >
              Enviar avaliação
            </button>
          </form>
        </div>
      </IonModal>
    </div>
  );
};

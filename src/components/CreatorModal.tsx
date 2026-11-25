import React, { useEffect, useRef, useState } from 'react';
import { IonIcon, IonModal } from '@ionic/react';
import {
  calendarOutline,
  chatbubbleEllipsesOutline,
  closeOutline,
  locationOutline,
  star,
  swapHorizontalOutline,
} from 'ionicons/icons';
import { UserAvatar } from './UserAvatar';
import type { CreatorSpotlight, UserProfile } from '../shared/types';
import { validateExchangeProposal } from '../shared/validation';

interface CreatorModalProps {
  creator: CreatorSpotlight | null;
  currentUser: UserProfile;
  initialProposeOpen?: boolean;
  onClose: () => void;
  onStartChat: (creator: CreatorSpotlight) => void;
  onProposeExchange: (payload: {
    receiverId: string;
    offeredSkill: string;
    requestedSkill: string;
    mode: 'Presencial' | 'Remoto';
    scheduledDate: string;
    location: string;
    notes: string;
  }) => Promise<void>;
}

export const CreatorModal: React.FC<CreatorModalProps> = ({
  creator,
  currentUser,
  initialProposeOpen = false,
  onClose,
  onStartChat,
  onProposeExchange,
}) => {
  const [proposeOpen, setProposeOpen] = useState(initialProposeOpen);
  const [offeredSkill, setOfferedSkill] = useState(currentUser.skills[0]?.name ?? '');
  const [requestedSkill, setRequestedSkill] = useState('');
  const [mode, setMode] = useState<'Presencial' | 'Remoto'>('Presencial');
  const [scheduledDate, setScheduledDate] = useState('2026-12-03T14:00');
  const [location, setLocation] = useState('Fatec Zona Sul — São Paulo, SP');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const proposeFormRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (!creator) {
      setProposeOpen(false);
      setErrorMsg(null);
      return;
    }
    setProposeOpen(Boolean(initialProposeOpen));
    setOfferedSkill(currentUser.skills[0]?.name ?? '');
    setRequestedSkill(creator.skills[0] ?? creator.roleTitle);
    setMode(creator.mode === 'Remoto' ? 'Remoto' : 'Presencial');
    setLocation(
      creator.mode === 'Remoto'
        ? 'Videochamada online (link combinado via chat)'
        : creator.location,
    );
    setNotes('');
    setErrorMsg(null);
  }, [creator, currentUser.skills, initialProposeOpen]);

  useEffect(() => {
    if (proposeOpen && proposeFormRef.current) {
      proposeFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [proposeOpen]);

  const handleSubmitProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!creator) return;
    setErrorMsg(null);

    const check = validateExchangeProposal({
      offeredSkill,
      requestedSkill,
      scheduledDate,
      location,
      userSkillCount: currentUser.skills.length,
    });
    if (!check.valid) {
      setErrorMsg(check.error || 'Verifique os campos da proposta.');
      return;
    }

    setSubmitting(true);
    try {
      await onProposeExchange({
        receiverId: creator.id,
        offeredSkill,
        requestedSkill,
        mode,
        scheduledDate,
        location,
        notes,
      });
      setProposeOpen(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível enviar a proposta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <IonModal isOpen={Boolean(creator)} onDidDismiss={onClose}>
      {creator && (
        <div className="bg-white dark:bg-slate-900 min-h-full flex flex-col">
          <div className="relative h-44 shrink-0 bg-gradient-to-br from-[#1B3C59] via-[#274e70] to-[#51A644]">
            {creator.coverUrl && (
              <img
                src={creator.coverUrl}
                alt={creator.displayName}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar detalhes"
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70"
            >
              <IonIcon icon={closeOutline} className="text-xl" />
            </button>
          </div>

          <div className="px-6 pb-6 relative z-10 flex-1 overflow-y-auto">
            <div className="flex items-start gap-4">
              <UserAvatar
                src={creator.avatarUrl}
                name={creator.fullName}
                className="w-24 h-24 -mt-12 rounded-full border-4 border-white dark:border-slate-900 shadow-md shrink-0"
                textClassName="text-2xl"
              />
              <div className="pt-3 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                    {creator.displayName}
                  </h2>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                      creator.isDemo
                        ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                        : 'bg-[#51A644]/15 text-[#3e8533] dark:text-[#85BF4B]'
                    }`}
                  >
                    {creator.isDemo ? 'Perfil de exemplo' : 'Membro conectado'}
                  </span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300 mt-0.5">
                  {creator.roleTitle} ·{' '}
                  <span className="inline-flex items-center gap-1 text-amber-500 font-semibold tabular-nums">
                    <IonIcon icon={star} className="text-xs" />
                    {creator.rating.toFixed(1)}
                  </span>
                </p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1">
                <IonIcon icon={locationOutline} />
                {creator.location} ({creator.distanceKm} km)
              </span>
              <span>·</span>
              <span>Modalidade: {creator.mode}</span>
            </div>

            {proposeOpen && (
              <form
                ref={proposeFormRef}
                onSubmit={handleSubmitProposal}
                className="mt-5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-[#51A644]/35 space-y-3.5 shadow-sm"
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                    <IonIcon icon={calendarOutline} className="text-[#51A644]" />
                    <span>Agendar troca de habilidade</span>
                  </h3>
                  <button
                    type="button"
                    onClick={() => setProposeOpen(false)}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    Cancelar
                  </button>
                </div>

                {errorMsg && (
                  <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 p-2.5 rounded-xl">
                    {errorMsg}
                  </p>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="ex-offered"
                      className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                    >
                      O que você oferece em troca
                    </label>
                    <select
                      id="ex-offered"
                      value={offeredSkill}
                      onChange={(e) => setOfferedSkill(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    >
                      {currentUser.skills.map((s) => (
                        <option key={s.id} value={s.name}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="ex-requested"
                      className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                    >
                      Serviço que você precisa
                    </label>
                    <select
                      id="ex-requested"
                      value={requestedSkill}
                      onChange={(e) => setRequestedSkill(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    >
                      {creator.skills.map((skill) => (
                        <option key={skill} value={skill}>
                          {skill}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="ex-mode"
                      className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                    >
                      Modalidade
                    </label>
                    <select
                      id="ex-mode"
                      value={mode}
                      onChange={(e) => setMode(e.target.value as 'Presencial' | 'Remoto')}
                      className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    >
                      <option value="Presencial">Presencial</option>
                      <option value="Remoto">Remoto</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="ex-date"
                      className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                    >
                      Data e horário
                    </label>
                    <input
                      id="ex-date"
                      type="datetime-local"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="ex-location"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                  >
                    {mode === 'Presencial' ? 'Local do encontro' : 'Plataforma / Link remoto'}
                  </label>
                  <input
                    id="ex-location"
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Ex.: Fatec Zona Sul ou Google Meet"
                    className="w-full h-10 px-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label
                    htmlFor="ex-notes"
                    className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1"
                  >
                    Condições e detalhes da troca
                  </label>
                  <textarea
                    id="ex-notes"
                    rows={2}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Explique o escopo combinado sem envolver pagamentos financeiros..."
                    className="w-full p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 rounded-xl bg-[#51A644] hover:bg-[#448e39] text-white font-semibold text-xs"
                >
                  {submitting ? 'Enviando proposta...' : 'Confirmar proposta de troca'}
                </button>
              </form>
            )}

            <p className="mt-4 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              {creator.bio}
            </p>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/70 dark:border-slate-800">
                <h3 className="font-display text-xs font-bold text-slate-900 dark:text-white mb-1">
                  Habilidades oferecidas
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                  {creator.skills.length > 0 ? creator.skills.join(' · ') : 'A combinar'}
                </p>
              </div>
              <div className="p-3.5 rounded-2xl bg-[#85BF4B]/10 border border-[#51A644]/25">
                <h3 className="font-display text-xs font-bold text-slate-900 dark:text-white mb-1">
                  Aceita receber em troca
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                  {creator.desiredSkills.length > 0
                    ? creator.desiredSkills.join(' · ')
                    : 'Aberto a propostas de troca'}
                </p>
              </div>
            </div>

            {!proposeOpen && creator.featuredWorks.length > 0 && (
              <div className="mt-6 space-y-3">
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Trabalhos em destaque
                </h3>
                {creator.featuredWorks.map((work) => (
                  <div
                    key={work.id}
                    className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60"
                  >
                    <div className="relative h-36">
                      <img
                        src={work.imageUrl}
                        alt={work.title}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent flex flex-col justify-end p-4 text-white">
                        <p className="font-display font-bold text-base">{work.title}</p>
                        <p className="text-xs text-slate-200">{work.category}</p>
                      </div>
                    </div>
                    <p className="p-3.5 text-xs text-slate-600 dark:text-slate-300">
                      {work.description}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setProposeOpen(true)}
              className="h-12 rounded-xl bg-[#51A644] hover:bg-[#448e39] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm"
            >
              <IonIcon icon={swapHorizontalOutline} className="text-lg" />
              <span>Propor troca</span>
            </button>
            <button
              type="button"
              onClick={() => onStartChat(creator)}
              className="h-12 rounded-xl bg-[#1B3C59] hover:bg-[#142d44] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm"
            >
              <IonIcon icon={chatbubbleEllipsesOutline} className="text-lg" />
              <span>Enviar mensagem</span>
            </button>
          </div>
        </div>
      )}
    </IonModal>
  );
};

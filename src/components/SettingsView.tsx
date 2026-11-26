import React, { useState } from 'react';
import { IonAlert, IonIcon, IonModal, IonToggle } from '@ionic/react';
import {
  arrowBackOutline,
  closeCircleOutline,
  closeOutline,
  helpCircleOutline,
  lockClosedOutline,
  logOutOutline,
  notificationsOutline,
  optionsOutline,
  personCircleOutline,
} from 'ionicons/icons';
import { api } from '../services/api';
import { UserAvatar } from './UserAvatar';
import type { SupportTicketPayload, UserProfile, UserSettings } from '../shared/types';

type ActiveSubModal = 'general' | 'profile-details' | 'notifications' | 'privacy' | 'help' | null;

interface SettingsViewProps {
  user: UserProfile;
  onBack: () => void;
  onUserUpdated: (user: UserProfile) => void;
  onLogout: () => void;
  onAccountDeleted: () => void;
  onToast: (message: string, color?: 'success' | 'danger' | 'primary') => void;
  onUpdateSettingsOverride?: (partial: Partial<UserSettings>) => Promise<{ user: UserProfile }>;
  onUpdateProfileOverride?: (payload: {
    fullName: string;
    email: string;
    age: number;
    locationLabel: string;
    headline: string;
    bio: string;
  }) => Promise<{ user: UserProfile }>;
  onSubmitSupportOverride?: (
    payload: SupportTicketPayload,
  ) => Promise<{ message: string; ticketId: string }>;
  onDeleteAccountOverride?: () => Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  user,
  onBack,
  onUserUpdated,
  onLogout,
  onAccountDeleted,
  onToast,
  onUpdateSettingsOverride,
  onUpdateProfileOverride,
  onSubmitSupportOverride,
  onDeleteAccountOverride,
}) => {
  const [modal, setModal] = useState<ActiveSubModal>(null);
  const [deleteAlertOpen, setDeleteAlertOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [age, setAge] = useState(user.age >= 13 ? String(user.age) : '');
  const [locationLabel, setLocationLabel] = useState(user.locationLabel);
  const [headline, setHeadline] = useState(user.headline);
  const [bio, setBio] = useState(user.bio);

  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');

  const handleUpdateSetting = async (partial: Partial<UserSettings>) => {
    try {
      const res = onUpdateSettingsOverride
        ? await onUpdateSettingsOverride(partial)
        : await api.updateSettings(partial);
      onUserUpdated(res.user);
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao salvar configuração.', 'danger');
    }
  };

  const handleSaveProfileDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        fullName,
        email,
        age: Number(age),
        locationLabel,
        headline,
        bio,
      };
      const res = onUpdateProfileOverride
        ? await onUpdateProfileOverride(payload)
        : await api.updateProfile(payload);
      onUserUpdated(res.user);
      setModal(null);
      onToast('Detalhes do perfil atualizados!', 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao atualizar perfil.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleSendSupport = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { subject: supportSubject, message: supportMessage };
      const res = onSubmitSupportOverride
        ? await onSubmitSupportOverride(payload)
        : await api.submitSupportTicket(payload);
      setSupportSubject('');
      setSupportMessage('');
      setModal(null);
      onToast(res.message, 'success');
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao enviar dúvida.', 'danger');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      if (onDeleteAccountOverride) {
        await onDeleteAccountOverride();
      } else {
        await api.deleteAccount();
      }
      onAccountDeleted();
    } catch (err) {
      onToast(err instanceof Error ? err.message : 'Erro ao deletar conta.', 'danger');
    }
  };

  return (
    <div className="space-y-6 pb-8 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          aria-label="Voltar"
          className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-800 dark:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800"
        >
          <IonIcon icon={arrowBackOutline} className="text-2xl" />
        </button>
        <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
          Configuração
        </h1>
        <div className="w-11" aria-hidden="true" />
      </div>

      <div className="flex flex-col items-center text-center">
        <UserAvatar
          src={user.avatarUrl}
          name={user.fullName}
          className="w-24 h-24 rounded-full shadow-md ring-4 ring-white dark:ring-slate-800"
          textClassName="text-2xl"
        />
        <h2 className="mt-3 font-display text-2xl font-semibold text-slate-900 dark:text-white">
          {user.displayName}
        </h2>
        <p className="text-sm underline text-slate-600 dark:text-slate-400">
          {user.email}
        </p>
      </div>

      <div className="space-y-3">
        <button
          type="button"
          onClick={() => setModal('general')}
          className="w-full text-left flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-[#1B3C59]/40 transition-colors"
        >
          <IonIcon icon={optionsOutline} className="text-2xl text-slate-700 dark:text-slate-200 shrink-0" />
          <div>
            <p className="font-display font-bold text-base text-slate-900 dark:text-white">
              Geral
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Linguagem, Dark Mode e raio de proximidade ({user.settings.maxDistanceKm} km)
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => {
            setFullName(user.fullName);
            setEmail(user.email);
            setAge(String(user.age));
            setLocationLabel(user.locationLabel);
            setHeadline(user.headline);
            setBio(user.bio);
            setModal('profile-details');
          }}
          className="w-full text-left flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-[#1B3C59]/40 transition-colors"
        >
          <IonIcon icon={personCircleOutline} className="text-2xl text-slate-700 dark:text-slate-200 shrink-0" />
          <div>
            <p className="font-display font-bold text-base text-slate-900 dark:text-white">
              Detalhes do Perfil
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Informações cadastrais, localização e apresentação pessoal
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setModal('notifications')}
          className="w-full text-left flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-[#1B3C59]/40 transition-colors"
        >
          <IonIcon icon={notificationsOutline} className="text-2xl text-slate-700 dark:text-slate-200 shrink-0" />
          <div>
            <p className="font-display font-bold text-base text-slate-900 dark:text-white">
              Notificações
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Propostas de troca, mensagens e lembretes de agendamento
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setModal('privacy')}
          className="w-full text-left flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-[#1B3C59]/40 transition-colors"
        >
          <IonIcon icon={lockClosedOutline} className="text-2xl text-slate-700 dark:text-slate-200 shrink-0" />
          <div>
            <p className="font-display font-bold text-base text-slate-900 dark:text-white">
              Privacidade
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Escolha como quer usar nossa aplicação (LGPD)
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setModal('help')}
          className="w-full text-left flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm hover:border-[#1B3C59]/40 transition-colors"
        >
          <IonIcon icon={helpCircleOutline} className="text-2xl text-slate-700 dark:text-slate-200 shrink-0" />
          <div>
            <p className="font-display font-bold text-base text-slate-900 dark:text-white">
              Ajuda
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Centro de ajuda ELO+: fale conosco
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setDeleteAlertOpen(true)}
          className="w-full text-left flex items-center gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border-2 border-red-400 dark:border-red-500 shadow-sm hover:bg-red-50/60 dark:hover:bg-red-950/30 transition-colors"
        >
          <IonIcon icon={closeCircleOutline} className="text-2xl text-red-500 shrink-0" />
          <div>
            <p className="font-display font-bold text-base text-red-500">
              Deletar conta permanente
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              CUIDADO! Esta ação é irreversível.
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 h-12 rounded-2xl bg-slate-200/70 dark:bg-slate-800 text-slate-800 dark:text-slate-100 font-semibold text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
        >
          <IonIcon icon={logOutOutline} className="text-lg" />
          <span>Sair da conta</span>
        </button>
      </div>

      {/* Geral Modal */}
      <IonModal isOpen={modal === 'general'} onDidDismiss={() => setModal(null)}>
        <div className="p-6 bg-white dark:bg-slate-900 min-h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">Geral</h2>
            <button
              type="button"
              onClick={() => setModal(null)}
              aria-label="Fechar Geral"
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500"
            >
              <IonIcon icon={closeOutline} className="text-xl" />
            </button>
          </div>

          <div className="space-y-5 max-w-md mx-auto">
            <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">Dark Mode</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Ativar tema escuro para maior conforto visual
                </p>
              </div>
              <IonToggle
                aria-label="Ativar Dark Mode"
                checked={user.settings.darkMode}
                onIonChange={(e) => handleUpdateSetting({ darkMode: e.detail.checked })}
              />
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="settings-distance"
                  className="font-semibold text-sm text-slate-900 dark:text-white"
                >
                  Raio máximo de proximidade
                </label>
                <span className="text-xs font-mono font-semibold text-[#51A644] tabular-nums">
                  {user.settings.maxDistanceKm} km
                </span>
              </div>
              <input
                id="settings-distance"
                type="range"
                min={5}
                max={100}
                step={5}
                value={user.settings.maxDistanceKm}
                onChange={(e) => handleUpdateSetting({ maxDistanceKm: Number(e.target.value) })}
                className="w-full accent-[#51A644]"
              />
            </div>

            <div className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <label
                htmlFor="settings-lang"
                className="block font-semibold text-sm text-slate-900 dark:text-white mb-2"
              >
                Idioma do aplicativo
              </label>
              <select
                id="settings-lang"
                value={user.settings.language}
                onChange={(e) =>
                  handleUpdateSetting({ language: e.target.value as 'pt-BR' | 'en-US' })
                }
                className="w-full h-11 px-3 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              >
                <option value="pt-BR">Português (Brasil)</option>
                <option value="en-US">English (US)</option>
              </select>
            </div>
          </div>
        </div>
      </IonModal>

      {/* Detalhes do Perfil Modal */}
      <IonModal isOpen={modal === 'profile-details'} onDidDismiss={() => setModal(null)}>
        <div className="p-6 bg-white dark:bg-slate-900 min-h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Detalhes do Perfil
            </h2>
            <button
              type="button"
              onClick={() => setModal(null)}
              aria-label="Fechar Detalhes do Perfil"
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500"
            >
              <IonIcon icon={closeOutline} className="text-xl" />
            </button>
          </div>

          <form onSubmit={handleSaveProfileDetails} className="space-y-4 max-w-md mx-auto">
            <div>
              <label htmlFor="det-fullname" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Nome completo
              </label>
              <input
                id="det-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="det-email" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                E-mail
              </label>
              <input
                id="det-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="det-age" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Idade
                </label>
                <input
                  id="det-age"
                  type="number"
                  min={13}
                  max={120}
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label htmlFor="det-location" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                  Bairro / Cidade
                </label>
                <input
                  id="det-location"
                  type="text"
                  value={locationLabel}
                  onChange={(e) => setLocationLabel(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label htmlFor="det-headline" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Título profissional
              </label>
              <input
                id="det-headline"
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="det-bio" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Biografia
              </label>
              <textarea
                id="det-bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full h-12 rounded-xl bg-[#1B3C59] text-white font-semibold text-sm"
            >
              Salvar alterações
            </button>
          </form>
        </div>
      </IonModal>

      {/* Notificações Modal */}
      <IonModal isOpen={modal === 'notifications'} onDidDismiss={() => setModal(null)}>
        <div className="p-6 bg-white dark:bg-slate-900 min-h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Notificações
            </h2>
            <button
              type="button"
              onClick={() => setModal(null)}
              aria-label="Fechar Notificações"
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500"
            >
              <IonIcon icon={closeOutline} className="text-xl" />
            </button>
          </div>

          <div className="space-y-4 max-w-md mx-auto">
            <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">Propostas de troca</p>
                <p className="text-xs text-slate-500">Avisar ao receber proposta ou contraproposta</p>
              </div>
              <IonToggle
                aria-label="Notificações de propostas"
                checked={user.settings.notificationsProposals}
                onIonChange={(e) =>
                  handleUpdateSetting({ notificationsProposals: e.detail.checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">Lembretes de agendamento</p>
                <p className="text-xs text-slate-500">Alertas próximos ao dia e local combinados</p>
              </div>
              <IonToggle
                aria-label="Lembretes de agendamento"
                checked={user.settings.notificationsReminders}
                onIonChange={(e) =>
                  handleUpdateSetting({ notificationsReminders: e.detail.checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">Novas mensagens no chat</p>
                <p className="text-xs text-slate-500">Avisar quando um participante enviar mensagem</p>
              </div>
              <IonToggle
                aria-label="Notificações de novas mensagens"
                checked={user.settings.notificationsMessages}
                onIonChange={(e) =>
                  handleUpdateSetting({ notificationsMessages: e.detail.checked })
                }
              />
            </div>
          </div>
        </div>
      </IonModal>

      {/* Privacidade Modal */}
      <IonModal isOpen={modal === 'privacy'} onDidDismiss={() => setModal(null)}>
        <div className="p-6 bg-white dark:bg-slate-900 min-h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Privacidade
            </h2>
            <button
              type="button"
              onClick={() => setModal(null)}
              aria-label="Fechar Privacidade"
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500"
            >
              <IonIcon icon={closeOutline} className="text-xl" />
            </button>
          </div>

          <div className="space-y-4 max-w-md mx-auto">
            <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">Perfil público</p>
                <p className="text-xs text-slate-500">Aparecer nas buscas e categorias da ELO+</p>
              </div>
              <IonToggle
                aria-label="Perfil público"
                checked={user.settings.privacyPublicProfile}
                onIonChange={(e) =>
                  handleUpdateSetting({ privacyPublicProfile: e.detail.checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">Exibir e-mail no perfil</p>
                <p className="text-xs text-slate-500">Permitir visualização do seu endereço</p>
              </div>
              <IonToggle
                aria-label="Exibir e-mail no perfil"
                checked={user.settings.privacyShowEmail}
                onIonChange={(e) =>
                  handleUpdateSetting({ privacyShowEmail: e.detail.checked })
                }
              />
            </div>

            <div className="flex items-center justify-between p-4 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div>
                <p className="font-semibold text-sm text-slate-900 dark:text-white">Receber mensagens diretas</p>
                <p className="text-xs text-slate-500">Outros membros podem iniciar negociação via chat</p>
              </div>
              <IonToggle
                aria-label="Receber mensagens diretas"
                checked={user.settings.privacyAllowMessages}
                onIonChange={(e) =>
                  handleUpdateSetting({ privacyAllowMessages: e.detail.checked })
                }
              />
            </div>
          </div>
        </div>
      </IonModal>

      {/* Ajuda Modal */}
      <IonModal isOpen={modal === 'help'} onDidDismiss={() => setModal(null)}>
        <div className="p-6 bg-white dark:bg-slate-900 min-h-full overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Centro de ajuda ELO+
            </h2>
            <button
              type="button"
              onClick={() => setModal(null)}
              aria-label="Fechar Ajuda"
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500"
            >
              <IonIcon icon={closeOutline} className="text-xl" />
            </button>
          </div>

          <form onSubmit={handleSendSupport} className="space-y-4 max-w-md mx-auto">
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p className="font-semibold text-slate-900 dark:text-white">Sobre a plataforma ELO+</p>
              <p>· Projeto de Análise e Desenvolvimento de Sistemas — Fatec Zona Sul (2026).</p>
              <p>· Trocas são 100% colaborativas: ofereça uma habilidade em permuta pelo serviço desejado.</p>
            </div>

            <div>
              <label htmlFor="help-subject" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Assunto
              </label>
              <input
                id="help-subject"
                type="text"
                value={supportSubject}
                onChange={(e) => setSupportSubject(e.target.value)}
                placeholder="Ex.: Dúvida sobre agendamento de troca"
                className="w-full h-11 px-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="help-msg" className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Mensagem
              </label>
              <textarea
                id="help-msg"
                rows={4}
                value={supportMessage}
                onChange={(e) => setSupportMessage(e.target.value)}
                placeholder="Conte como podemos ajudar você..."
                className="w-full p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white"
              />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full h-12 rounded-xl bg-[#1B3C59] text-white font-semibold text-sm"
            >
              Enviar mensagem ao suporte
            </button>
          </form>
        </div>
      </IonModal>

      <IonAlert
        isOpen={deleteAlertOpen}
        onDidDismiss={() => setDeleteAlertOpen(false)}
        header="Deletar conta permanente"
        message="Tem certeza? Todos os seus dados, habilidades, trocas e conversas serão removidos permanentemente."
        buttons={[
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Deletar definitivamente',
            role: 'destructive',
            handler: () => {
              void handleDeleteAccount();
            },
          },
        ]}
      />
    </div>
  );
};

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  IonApp,
  IonContent,
  IonIcon,
  IonLabel,
  IonModal,
  IonSpinner,
  IonTabBar,
  IonTabButton,
  IonToast,
  setupIonicReact,
} from '@ionic/react';
import {
  chatbubblesOutline,
  closeOutline,
  homeOutline,
  personCircleOutline,
  searchOutline,
  settingsOutline,
  swapHorizontalOutline,
} from 'ionicons/icons';
import { onAuthStateChanged } from 'firebase/auth';
import { AuthViews } from './components/AuthViews';
import { ComumLogo } from './components/ComumLogo';
import { CreatorModal } from './components/CreatorModal';
import { ExchangesView } from './components/ExchangesView';
import { ExploreView } from './components/ExploreView';
import { HomeView } from './components/HomeView';
import { MessagesView } from './components/MessagesView';
import { ProfileView } from './components/ProfileView';
import { SettingsView } from './components/SettingsView';
import { UserAvatar } from './components/UserAvatar';
import { auth, hasFirebaseConfig } from './firebase';
import { api, setAuthToken } from './services/api';
import {
  ensureFirebaseUserProfile,
  firebaseRuntime,
  getFirebaseCategories,
  signOutFirebase,
  subscribeToFirebaseSession,
} from './services/firebaseRuntime';
import { isDemoEntityId } from './shared/firebaseContracts';
import { SEED_CATEGORIES } from './shared/seedData';
import { filterCreatorsByCategoryAndQuery } from './shared/validation';
import type {
  AttendanceMode,
  AuthResponse,
  CategoryItem,
  CategorySlug,
  ConversationThread,
  CreatorSpotlight,
  ExchangeProposal,
  NotificationItem,
  SkillItem,
  UserProfile,
} from './shared/types';

setupIonicReact({ mode: 'ios' });

type AppTab = 'home' | 'exchanges' | 'explore' | 'messages' | 'profile' | 'settings';

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [sessionMode, setSessionMode] = useState<'local' | 'firebase'>('local');
  const sessionModeRef = useRef<'local' | 'firebase'>('local');
  const userRef = useRef<UserProfile | null>(null);
  const firebaseUnsubRef = useRef<(() => void) | null>(null);

  const [booting, setBooting] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  });
  const [activeTab, setActiveTab] = useState<AppTab>('home');

  const [categories, setCategories] = useState<CategoryItem[]>(SEED_CATEGORIES);
  const [spotlights, setSpotlights] = useState<CreatorSpotlight[]>([]);
  const [conversations, setConversations] = useState<ConversationThread[]>([]);
  const [demoConversations, setDemoConversations] = useState<ConversationThread[]>([]);
  const [exchanges, setExchanges] = useState<ExchangeProposal[]>([]);
  const [demoExchanges, setDemoExchanges] = useState<ExchangeProposal[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const [activeParticipantId, setActiveParticipantId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<CategorySlug | 'all'>('all');
  const [selectedMode, setSelectedMode] = useState<'all' | 'Presencial' | 'Remoto'>('all');
  const [onlyRealUsers, setOnlyRealUsers] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCreator, setSelectedCreator] = useState<CreatorSpotlight | null>(null);
  const [creatorModalPropose, setCreatorModalPropose] = useState(false);

  const [toastState, setToastState] = useState<{
    open: boolean;
    message: string;
    color: 'success' | 'danger' | 'primary';
  }>({ open: false, message: '', color: 'primary' });

  const showToast = useCallback(
    (message: string, color: 'success' | 'danger' | 'primary' = 'primary') => {
      setToastState({ open: true, message, color });
    },
    [],
  );

  useEffect(() => {
    sessionModeRef.current = sessionMode;
  }, [sessionMode]);

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    const isDark = Boolean(user?.settings.darkMode);
    document.documentElement.classList.toggle('dark', isDark);
  }, [user?.settings.darkMode]);

  const mergeConversationsPreservingDrafts = useCallback(
    (incoming: ConversationThread[], prev: ConversationThread[]) => {
      const pendingDrafts = prev.filter(
        (c) =>
          c.id.startsWith('temp-') &&
          !incoming.some((remote) => remote.participantId === c.participantId),
      );
      return pendingDrafts.length > 0 ? [...pendingDrafts, ...incoming] : incoming;
    },
    [],
  );

  const loadAppData = useCallback(
    async (silent = false) => {
      try {
        const [discoverRes, convRes, exRes, notifRes] = await Promise.all([
          api.discover(),
          api.getConversations(),
          api.getExchanges(),
          api.getNotifications(),
        ]);
        setCategories(discoverRes.categories);
        setSpotlights(discoverRes.spotlights);
        setConversations((prev) => mergeConversationsPreservingDrafts(convRes.conversations, prev));
        setExchanges(exRes.exchanges);
        setNotifications(notifRes.notifications);
      } catch (err) {
        if (!silent) {
          showToast(err instanceof Error ? err.message : 'Erro ao carregar dados.', 'danger');
        }
      }
    },
    [mergeConversationsPreservingDrafts, showToast],
  );

  useEffect(() => {
    if (!user || sessionMode !== 'local') return;
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void loadAppData(true);
      }
    }, 3500);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [user, sessionMode, loadAppData]);

  // Attach real-time Firestore subscriptions whenever signed into Firebase
  useEffect(() => {
    if (!user || sessionMode !== 'firebase') {
      if (firebaseUnsubRef.current) {
        firebaseUnsubRef.current();
        firebaseUnsubRef.current = null;
      }
      return;
    }

    const unsub = subscribeToFirebaseSession(user.id, {
      onSpotlights: (nextSpotlights) => {
        setSpotlights(nextSpotlights);
        setCategories(getFirebaseCategories(nextSpotlights));
      },
      onConversations: (nextConvs) => {
        setConversations((prev) => mergeConversationsPreservingDrafts(nextConvs, prev));
      },
      onExchanges: (nextExchanges) => {
        setExchanges(nextExchanges);
      },
      onNotifications: (nextNotifications) => {
        setNotifications(nextNotifications);
      },
      onError: (msg) => {
        showToast(msg, 'danger');
      },
    });
    firebaseUnsubRef.current = unsub;

    return () => {
      unsub();
      if (firebaseUnsubRef.current === unsub) {
        firebaseUnsubRef.current = null;
      }
    };
  }, [user?.id, sessionMode, mergeConversationsPreservingDrafts, showToast]);

  // Restore existing Firebase Google session on reload
  useEffect(() => {
    if (!hasFirebaseConfig) return;
    const isAutostart =
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('autostart') === '1';
    if (isAutostart) return;

    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser || !fbUser.emailVerified) return;
      if (sessionModeRef.current === 'local' && userRef.current) return;
      try {
        const profile = await ensureFirebaseUserProfile(fbUser);
        setSessionMode('firebase');
        setUser(profile);
      } catch {
        // Ignore silent restore error; user can sign in from AuthViews
      }
    });
    return () => unsub();
  }, []);

  const handleAuthenticated = useCallback(
    async (authRes: AuthResponse, mode: 'firebase' | 'local' = 'local') => {
      setSessionMode(mode);
      setDemoConversations([]);
      setDemoExchanges([]);
      setAuthToken(authRes.token);
      setUser(authRes.user);
      setActiveTab('home');
      if (mode === 'local') {
        await loadAppData();
      }
    },
    [loadAppData],
  );

  useEffect(() => {
    if (!booting) return;
    let active = true;
    (async () => {
      try {
        const res = await api.login('juan.silva@gmail.com', 'Comum@123');
        if (active) {
          await handleAuthenticated(res, 'local');
        }
      } catch {
        // Fallback to login screen
      } finally {
        if (active) setBooting(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [booting, handleAuthenticated]);

  const combinedConversations = useMemo(() => {
    if (sessionMode !== 'firebase' || demoConversations.length === 0) {
      return conversations;
    }
    const existingIds = new Set(conversations.map((c) => c.participantId));
    const merged = [
      ...conversations,
      ...demoConversations.filter((dc) => !existingIds.has(dc.participantId)),
    ];
    return merged.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [conversations, demoConversations, sessionMode]);

  const combinedExchanges = useMemo(() => {
    if (sessionMode !== 'firebase' || demoExchanges.length === 0) {
      return exchanges;
    }
    return [...exchanges, ...demoExchanges].sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );
  }, [exchanges, demoExchanges, sessionMode]);

  const filteredSpotlights = useMemo(
    () =>
      filterCreatorsByCategoryAndQuery(
        spotlights,
        selectedCategory,
        searchQuery,
        selectedMode,
        user?.settings.maxDistanceKm,
        onlyRealUsers,
      ),
    [spotlights, selectedCategory, searchQuery, selectedMode, user?.settings.maxDistanceKm, onlyRealUsers],
  );

  const totalUnread = useMemo(
    () => combinedConversations.reduce((sum, c) => sum + c.unreadCount, 0),
    [combinedConversations],
  );

  const unreadNotificationsCount = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications],
  );

  const handleLogout = async () => {
    if (firebaseUnsubRef.current) {
      firebaseUnsubRef.current();
      firebaseUnsubRef.current = null;
    }
    if (sessionMode === 'firebase') {
      try {
        await signOutFirebase();
      } catch {
        // Ignore signOut cleanup errors
      }
    }
    setAuthToken(null);
    setSessionMode('local');
    setUser(null);
    setSpotlights([]);
    setConversations([]);
    setDemoConversations([]);
    setExchanges([]);
    setDemoExchanges([]);
    setNotifications([]);
    setActiveParticipantId(null);
    document.documentElement.classList.remove('dark');
    showToast('Sessão encerrada.', 'primary');
  };

  const handleAccountDeleted = () => {
    if (firebaseUnsubRef.current) {
      firebaseUnsubRef.current();
      firebaseUnsubRef.current = null;
    }
    setAuthToken(null);
    setSessionMode('local');
    setUser(null);
    setSpotlights([]);
    setConversations([]);
    setDemoConversations([]);
    setExchanges([]);
    setDemoExchanges([]);
    setNotifications([]);
    setActiveParticipantId(null);
    document.documentElement.classList.remove('dark');
    showToast('Conta excluída permanentemente.', 'primary');
  };

  const handleSelectCategoryFromHome = (categoryId: CategorySlug) => {
    setSelectedCategory(categoryId);
    setSearchQuery('');
    setActiveTab('explore');
  };

  const handleStartChatWithCreator = async (creator: CreatorSpotlight) => {
    setSelectedCreator(null);
    setCreatorModalPropose(false);
    const existing = combinedConversations.find((c) => c.participantId === creator.id);
    if (!existing) {
      const draftThread: ConversationThread = {
        id: `temp-${creator.id}`,
        participantId: creator.id,
        participantName: creator.displayName,
        participantRole: `${creator.roleTitle} · ${creator.mode}`,
        participantAvatarUrl: creator.avatarUrl,
        unreadCount: 0,
        updatedAt: new Date().toISOString(),
        messages: [],
      };
      if (sessionMode === 'firebase' && isDemoEntityId(creator.id)) {
        setDemoConversations((prev) => [draftThread, ...prev]);
      } else {
        setConversations((prev) => [draftThread, ...prev]);
      }
    }
    setActiveParticipantId(creator.id);
    setActiveTab('messages');
  };

  const handleProposeExchangeFromChat = (thread: ConversationThread) => {
    const matched = spotlights.find((s) => s.id === thread.participantId);
    const fallbackCreator: CreatorSpotlight = matched ?? {
      id: thread.participantId,
      displayName: thread.participantName,
      fullName: thread.participantName,
      roleTitle: thread.participantRole.split(' · ')[0] || 'Membro ELO+',
      categoryId: 'programacao',
      location: 'Comunidade ELO+',
      distanceKm: 2,
      mode: 'Presencial e Remoto',
      rating: 5,
      avatarUrl: thread.participantAvatarUrl,
      coverUrl: '',
      bio: 'Membro em conversa direta com você na rede ELO+.',
      skills: ['Colaboração ELO+'],
      desiredSkills: [],
      featuredWorks: [],
      isDemo: isDemoEntityId(thread.participantId),
    };
    setCreatorModalPropose(true);
    setSelectedCreator(fallbackCreator);
  };

  const handleProposeExchange = async (payload: {
    receiverId: string;
    offeredSkill: string;
    requestedSkill: string;
    mode: 'Presencial' | 'Remoto';
    scheduledDate: string;
    location: string;
    notes: string;
  }) => {
    if (sessionMode === 'firebase' && user) {
      if (isDemoEntityId(payload.receiverId)) {
        const target = spotlights.find((s) => s.id === payload.receiverId);
        const now = new Date().toISOString();
        const demoEx: ExchangeProposal = {
          id: `demo-ex-${Date.now()}`,
          proposerId: user.id,
          proposerName: user.displayName,
          proposerAvatarUrl: user.avatarUrl,
          receiverId: payload.receiverId,
          receiverName: target?.displayName ?? 'Membro Exemplo',
          receiverAvatarUrl: target?.avatarUrl ?? '',
          offeredSkill: payload.offeredSkill,
          requestedSkill: payload.requestedSkill,
          mode: payload.mode,
          scheduledDate: payload.scheduledDate,
          location: payload.location,
          notes: payload.notes,
          status: 'PENDENTE',
          lastUpdatedBy: user.id,
          reviews: [],
          createdAt: now,
          updatedAt: now,
        };
        setDemoExchanges((prev) => [demoEx, ...prev]);
        setSelectedCreator(null);
        setCreatorModalPropose(false);
        setActiveTab('exchanges');
        showToast('Proposta de demonstração registrada!', 'success');
        return;
      }

      await firebaseRuntime.createExchange(user, payload);
      setSelectedCreator(null);
      setCreatorModalPropose(false);
      setActiveTab('exchanges');
      showToast('Proposta de troca enviada em tempo real!', 'success');
      return;
    }

    const res = await api.createExchange(payload);
    setExchanges(res.exchanges);
    setNotifications(res.notifications);
    setSelectedCreator(null);
    setCreatorModalPropose(false);
    setActiveTab('exchanges');
    showToast('Proposta de troca enviada com sucesso!', 'success');
  };

  const handleRespondExchange = async (
    id: string,
    payload: {
      action: 'accept' | 'decline' | 'counter' | 'complete';
      scheduledDate?: string;
      location?: string;
      offeredSkill?: string;
      notes?: string;
    },
  ) => {
    if (sessionMode === 'firebase' && user) {
      if (id.startsWith('demo-ex-')) {
        const nextStatus =
          payload.action === 'accept'
            ? 'CONFIRMADA'
            : payload.action === 'decline'
              ? 'CANCELADA'
              : payload.action === 'complete'
                ? 'CONCLUIDA'
                : 'CONTRAPROPOSTA';
        setDemoExchanges((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  status: nextStatus,
                  scheduledDate: payload.scheduledDate ?? item.scheduledDate,
                  location: payload.location ?? item.location,
                  offeredSkill: payload.offeredSkill ?? item.offeredSkill,
                  notes: payload.notes ?? item.notes,
                  lastUpdatedBy: user.id,
                  updatedAt: new Date().toISOString(),
                }
              : item,
          ),
        );
        showToast('Status da troca atualizado!', 'success');
        return;
      }
      await firebaseRuntime.respondExchange(user, id, payload);
      showToast('Status da troca atualizado em tempo real!', 'success');
      return;
    }

    const res = await api.respondExchange(id, payload);
    setExchanges(res.exchanges);
    setNotifications(res.notifications);
    showToast('Status da troca atualizado!', 'success');
  };

  const handleReviewExchange = async (
    id: string,
    payload: { rating: number; comment: string },
  ) => {
    if (sessionMode === 'firebase' && user) {
      if (id.startsWith('demo-ex-')) {
        setDemoExchanges((prev) =>
          prev.map((item) =>
            item.id === id
              ? {
                  ...item,
                  reviews: [
                    ...item.reviews,
                    {
                      reviewerId: user.id,
                      reviewerName: user.displayName,
                      rating: payload.rating,
                      comment: payload.comment,
                      createdAt: new Date().toISOString(),
                    },
                  ],
                }
              : item,
          ),
        );
        showToast('Avaliação registrada na ELO+!', 'success');
        return;
      }
      await firebaseRuntime.reviewExchange(user, id, payload);
      showToast('Avaliação registrada na ELO+!', 'success');
      return;
    }

    const res = await api.reviewExchange(id, payload);
    setExchanges(res.exchanges);
    showToast('Avaliação registrada na ELO+!', 'success');
  };

  const handleOpenNotifications = async () => {
    setNotificationsOpen(true);
    if (unreadNotificationsCount > 0) {
      try {
        if (sessionMode === 'firebase' && user) {
          await firebaseRuntime.markNotificationsRead(user.id);
        } else {
          const res = await api.markNotificationsRead();
          setNotifications(res.notifications);
        }
      } catch {
        // Ignore silent read failure
      }
    }
  };

  const handleSendMessage = async (participantId: string, text: string) => {
    if (sessionMode === 'firebase' && user) {
      if (isDemoEntityId(participantId)) {
        const now = new Date().toISOString();
        setDemoConversations((prev) =>
          prev.map((c) =>
            c.participantId === participantId
              ? {
                  ...c,
                  updatedAt: now,
                  messages: [
                    ...c.messages,
                    {
                      id: `demo-msg-${Date.now()}`,
                      senderId: user.id,
                      senderName: user.displayName,
                      text,
                      sentAt: now,
                    },
                  ],
                }
              : c,
          ),
        );
        return;
      }

      const partnerThread = combinedConversations.find((c) => c.participantId === participantId);
      await firebaseRuntime.sendMessage(
        user,
        participantId,
        text,
        partnerThread
          ? {
              name: partnerThread.participantName,
              role: partnerThread.participantRole,
              avatarUrl: partnerThread.participantAvatarUrl,
            }
          : undefined,
      );
      return;
    }

    const res = await api.sendMessage(participantId, text);
    setConversations(res.conversations);
  };

  const handleMarkConversationRead = useCallback(
    async (participantId: string) => {
      if (sessionMode === 'firebase' && user) {
        if (isDemoEntityId(participantId)) {
          setDemoConversations((prev) =>
            prev.map((c) => (c.participantId === participantId ? { ...c, unreadCount: 0 } : c)),
          );
          return;
        }
        await firebaseRuntime.markConversationRead(user.id, participantId);
        return;
      }

      setConversations((prev) =>
        prev.map((c) => (c.participantId === participantId ? { ...c, unreadCount: 0 } : c)),
      );
      try {
        const res = await api.markConversationRead(participantId);
        setConversations((prev) => mergeConversationsPreservingDrafts(res.conversations, prev));
      } catch {
        // Ignore transient read-sync errors
      }
    },
    [mergeConversationsPreservingDrafts, sessionMode, user],
  );

  const handleUpdateProfileInfo = async (payload: {
    fullName: string;
    headline: string;
    locationLabel: string;
    bio: string;
  }) => {
    try {
      if (sessionMode === 'firebase' && user) {
        const updated = await firebaseRuntime.updateProfile(user, payload);
        setUser(updated);
      } else {
        const res = await api.updateProfile(payload);
        setUser(res.user);
      }
      showToast('Informações do perfil atualizadas!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar perfil.', 'danger');
    }
  };

  const handleAddSkill = async (payload: {
    name: string;
    categoryId: CategorySlug;
    level: SkillItem['level'];
    mode: AttendanceMode;
    description: string;
  }) => {
    try {
      if (sessionMode === 'firebase' && user) {
        const updated = await firebaseRuntime.addSkill(user, payload);
        setUser(updated);
      } else {
        const res = await api.addSkill(payload);
        setUser(res.user);
      }
      showToast('Habilidade adicionada!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao adicionar habilidade.', 'danger');
    }
  };

  const handleRemoveSkill = async (skillId: string) => {
    if (sessionMode === 'firebase' && user) {
      const updated = await firebaseRuntime.removeSkill(user, skillId);
      setUser(updated);
    } else {
      const res = await api.removeSkill(skillId);
      setUser(res.user);
    }
    showToast('Habilidade removida.', 'primary');
  };

  const handleUpdateDesiredSkills = async (desiredSkills: string[]) => {
    if (sessionMode === 'firebase' && user) {
      const updated = await firebaseRuntime.updateProfile(user, { desiredSkills });
      setUser(updated);
    } else {
      const res = await api.updateProfile({ desiredSkills });
      setUser(res.user);
    }
    showToast('Lista de interesses atualizada!', 'success');
  };

  const handleUpdateProfilePhotos = async (payload: { avatarUrl?: string; coverUrl?: string }) => {
    try {
      if (sessionMode === 'firebase' && user) {
        const updated = await firebaseRuntime.updateProfile(user, payload);
        setUser(updated);
      } else {
        const res = await api.updateProfile(payload);
        setUser(res.user);
      }
      const removed = payload.avatarUrl === '' || payload.coverUrl === '';
      showToast(removed ? 'Foto removida do perfil.' : 'Foto do perfil atualizada!', 'success');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao atualizar foto.', 'danger');
    }
  };

  const handleAddWork = async (payload: {
    title: string;
    category: string;
    description: string;
  }) => {
    if (sessionMode === 'firebase' && user) {
      const updated = await firebaseRuntime.addFeaturedWork(user, payload);
      setUser(updated);
    } else {
      const res = await api.addFeaturedWork(payload);
      setUser(res.user);
    }
    showToast('Trabalho publicado no seu perfil!', 'success');
  };

  const navItems: { id: AppTab; label: string; shortLabel: string; icon: string }[] = [
    { id: 'home', label: 'Início', shortLabel: 'Início', icon: homeOutline },
    { id: 'exchanges', label: 'Trocas', shortLabel: 'Trocas', icon: swapHorizontalOutline },
    { id: 'explore', label: 'Explorar', shortLabel: 'Explorar', icon: searchOutline },
    { id: 'messages', label: 'Mensagens', shortLabel: 'Chat', icon: chatbubblesOutline },
    { id: 'profile', label: 'Perfil', shortLabel: 'Perfil', icon: personCircleOutline },
    { id: 'settings', label: 'Configuração', shortLabel: 'Ajustes', icon: settingsOutline },
  ];

  const pendingExchangesCount = useMemo(
    () => combinedExchanges.filter((e) => e.status === 'PENDENTE').length,
    [combinedExchanges],
  );

  if (booting) {
    return (
      <IonApp>
        <div className="h-full min-h-[100dvh] flex flex-col items-center justify-center bg-[#F7F8FA] dark:bg-slate-950 gap-4">
          <ComumLogo size="md" showWordmark />
          <IonSpinner name="crescent" color="primary" />
        </div>
      </IonApp>
    );
  }

  if (!user) {
    return (
      <IonApp>
        <IonContent fullscreen>
          <AuthViews onAuthenticated={handleAuthenticated} onToast={showToast} />
        </IonContent>
        <IonToast
          isOpen={toastState.open}
          message={toastState.message}
          color={toastState.color}
          duration={2600}
          position="top"
          onDidDismiss={() => setToastState((s) => ({ ...s, open: false }))}
        />
      </IonApp>
    );
  }

  return (
    <IonApp>
      <div className="h-full min-h-0 flex bg-[#F7F8FA] dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        {/* Desktop Navigation Rail */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:justify-between bg-white dark:bg-slate-900 border-r border-slate-200/80 dark:border-slate-800 p-5 shrink-0">
          <div>
            <div className="px-2 pb-6 border-b border-slate-100 dark:border-slate-800">
              <ComumLogo size="sm" showWordmark className="!items-start" />
            </div>

            <nav aria-label="Navegação principal" className="mt-6 space-y-1.5">
              {navItems.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                      isActive
                        ? 'bg-[#1B3C59] text-white shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <IonIcon icon={item.icon} className="text-xl" />
                      <span>{item.label}</span>
                    </span>
                    {item.id === 'messages' && totalUnread > 0 && (
                      <span className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md bg-[#51A644] text-white">
                        {totalUnread}
                      </span>
                    )}
                    {item.id === 'exchanges' && pendingExchangesCount > 0 && (
                      <span className="text-xs font-bold tabular-nums px-1.5 py-0.5 rounded-md bg-[#F2AE2E] text-slate-950">
                        {pendingExchangesCount}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className="flex items-center gap-3 p-2.5 rounded-2xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
          >
            <UserAvatar
              src={user.avatarUrl}
              name={user.fullName}
              className="w-10 h-10 rounded-full shrink-0"
            />
            <div className="min-w-0">
              <p className="font-display font-bold text-sm text-slate-900 dark:text-white truncate">
                {user.displayName}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {user.email}
              </p>
            </div>
          </button>
        </aside>

        {/* Main Scrollable Content Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full min-h-0 relative">
          <IonContent className="flex-1 min-h-0 h-full">
            <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-10 pt-6 pb-28 lg:pb-10">
              {activeTab === 'home' && (
                <HomeView
                  user={user}
                  categories={categories}
                  spotlights={spotlights}
                  exchanges={combinedExchanges}
                  unreadNotificationsCount={unreadNotificationsCount}
                  onlyRealUsers={onlyRealUsers}
                  onOnlyRealUsersChange={setOnlyRealUsers}
                  onOpenProfile={() => setActiveTab('profile')}
                  onOpenExchanges={() => setActiveTab('exchanges')}
                  onOpenNotifications={handleOpenNotifications}
                  onSelectCategory={handleSelectCategoryFromHome}
                  onSelectCreator={(c) => {
                    setCreatorModalPropose(false);
                    setSelectedCreator(c);
                  }}
                />
              )}

              {activeTab === 'exchanges' && (
                <ExchangesView
                  user={user}
                  exchanges={combinedExchanges}
                  onRespond={handleRespondExchange}
                  onReview={handleReviewExchange}
                />
              )}

              {activeTab === 'explore' && (
                <ExploreView
                  categories={categories}
                  spotlights={filteredSpotlights}
                  selectedCategory={selectedCategory}
                  selectedMode={selectedMode}
                  onlyRealUsers={onlyRealUsers}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onCategoryChange={setSelectedCategory}
                  onModeChange={setSelectedMode}
                  onOnlyRealUsersChange={setOnlyRealUsers}
                  onSelectCreator={(c) => {
                    setCreatorModalPropose(false);
                    setSelectedCreator(c);
                  }}
                />
              )}

              {activeTab === 'messages' && (
                <MessagesView
                  user={user}
                  conversations={combinedConversations}
                  activeParticipantId={activeParticipantId}
                  onSelectConversation={setActiveParticipantId}
                  onMarkConversationRead={handleMarkConversationRead}
                  onSendMessage={handleSendMessage}
                  onProposeExchangeFromChat={handleProposeExchangeFromChat}
                />
              )}

              {activeTab === 'profile' && (
                <ProfileView
                  user={user}
                  categories={categories}
                  onBack={() => setActiveTab('home')}
                  onOpenSettings={() => setActiveTab('settings')}
                  onUpdateProfileInfo={handleUpdateProfileInfo}
                  onAddSkill={handleAddSkill}
                  onRemoveSkill={handleRemoveSkill}
                  onUpdateDesiredSkills={handleUpdateDesiredSkills}
                  onUpdatePhotos={handleUpdateProfilePhotos}
                  onAddWork={handleAddWork}
                />
              )}

              {activeTab === 'settings' && (
                <SettingsView
                  user={user}
                  onBack={() => setActiveTab('home')}
                  onUserUpdated={setUser}
                  onLogout={() => void handleLogout()}
                  onAccountDeleted={handleAccountDeleted}
                  onToast={showToast}
                  onUpdateSettingsOverride={
                    sessionMode === 'firebase'
                      ? async (partial) => ({
                          user: await firebaseRuntime.updateSettings(user, partial),
                        })
                      : undefined
                  }
                  onUpdateProfileOverride={
                    sessionMode === 'firebase'
                      ? async (payload) => ({
                          user: await firebaseRuntime.updateProfile(user, payload),
                        })
                      : undefined
                  }
                  onSubmitSupportOverride={
                    sessionMode === 'firebase'
                      ? async (payload) => {
                          const ticketId = await firebaseRuntime.submitSupportTicket(user.id, payload);
                          return {
                            message: 'Sua dúvida foi enviada para a equipe ELO+.',
                            ticketId,
                          };
                        }
                      : undefined
                  }
                  onDeleteAccountOverride={
                    sessionMode === 'firebase'
                      ? async () => {
                          if (firebaseUnsubRef.current) {
                            firebaseUnsubRef.current();
                            firebaseUnsubRef.current = null;
                          }
                          await firebaseRuntime.deleteAccount(user.id);
                        }
                      : undefined
                  }
                />
              )}
            </main>
          </IonContent>

          {/* Mobile Bottom Ionic Tab Bar — pinned safely above browser chrome */}
          <div className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-t border-slate-200/80 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]">
            <IonTabBar aria-label="Navegação inferior" className="elo-mobile-tab-bar">
              {navItems.map((item) => {
                const badgeCount =
                  item.id === 'messages'
                    ? totalUnread
                    : item.id === 'exchanges'
                      ? pendingExchangesCount
                      : 0;
                return (
                  <IonTabButton
                    key={item.id}
                    tab={item.id}
                    selected={activeTab === item.id}
                    onClick={() => setActiveTab(item.id)}
                    aria-label={item.label}
                  >
                    <div className="relative flex flex-col items-center justify-center">
                      <IonIcon icon={item.icon} />
                      {badgeCount > 0 && (
                        <span
                          aria-hidden="true"
                          className={`absolute -top-1 -right-2.5 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold leading-4 text-center ${
                            item.id === 'messages'
                              ? 'bg-[#51A644] text-white'
                              : 'bg-[#F2AE2E] text-slate-950'
                          }`}
                        >
                          {badgeCount}
                        </span>
                      )}
                    </div>
                    <IonLabel>{item.shortLabel}</IonLabel>
                  </IonTabButton>
                );
              })}
            </IonTabBar>
          </div>
        </div>
      </div>

      <CreatorModal
        creator={selectedCreator}
        currentUser={user}
        initialProposeOpen={creatorModalPropose}
        onClose={() => {
          setSelectedCreator(null);
          setCreatorModalPropose(false);
        }}
        onStartChat={handleStartChatWithCreator}
        onProposeExchange={handleProposeExchange}
      />

      {/* Notifications Modal */}
      <IonModal isOpen={notificationsOpen} onDidDismiss={() => setNotificationsOpen(false)}>
        <div className="p-6 bg-white dark:bg-slate-900 min-h-full">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white">
              Notificações ELO+
            </h2>
            <button
              type="button"
              onClick={() => setNotificationsOpen(false)}
              aria-label="Fechar notificações"
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-500"
            >
              <IonIcon icon={closeOutline} className="text-xl" />
            </button>
          </div>

          {notifications.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">
              Você ainda não possui notificações.
            </p>
          ) : (
            <div className="space-y-3 max-w-lg mx-auto">
              {notifications.map((item) => (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-800"
                >
                  <p className="font-display font-bold text-sm text-slate-900 dark:text-white">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {item.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </IonModal>

      <IonToast
        isOpen={toastState.open}
        message={toastState.message}
        color={toastState.color}
        duration={2600}
        position="top"
        onDidDismiss={() => setToastState((s) => ({ ...s, open: false }))}
      />
    </IonApp>
  );
}

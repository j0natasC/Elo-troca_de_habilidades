import {
  createUserWithEmailAndPassword,
  deleteUser,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  serverTimestamp,
  Timestamp,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, googleProvider, handleFirestoreError, OperationType } from '../firebase';
import { SEED_CATEGORIES, SEED_SPOTLIGHTS } from '../shared/seedData';
import {
  BLUEPRINT_LIMITS,
  canonicalChatId,
  clampArray,
  clampMediaDataUrl,
  sanitizeId,
  sortedUidPair,
  truncateText,
} from '../shared/firebaseContracts';
import { buildDiscoverSpotlights } from '../shared/userDirectory';
import { extractFirstName, validateEmail } from '../shared/validation';
import type {
  AttendanceMode,
  AuthResponse,
  CategoryItem,
  CategorySlug,
  ChatMessage,
  ConversationThread,
  CreatorSpotlight,
  ExchangeProposal,
  ExchangeReview,
  ExchangeStatus,
  FeaturedWork,
  NotificationItem,
  SkillItem,
  SupportTicketPayload,
  UserProfile,
  UserSettings,
} from '../shared/types';

const DEFAULT_SETTINGS: UserSettings = {
  language: 'pt-BR',
  darkMode: false,
  maxDistanceKm: 25,
  notificationsEmail: true,
  notificationsPush: true,
  notificationsMessages: true,
  notificationsProposals: true,
  notificationsReminders: true,
  privacyPublicProfile: true,
  privacyShowEmail: false,
  privacyAllowMessages: true,
};

function toIsoString(value: unknown): string {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return new Date().toISOString();
}

function buildRoleLabel(headline: string, skills: SkillItem[]): string {
  const cleanHeadline = headline.trim();
  const mode = skills[0]?.mode || 'Presencial e Remoto';
  if (cleanHeadline) return truncateText(`${cleanHeadline} · ${mode}`, BLUEPRINT_LIMITS.HEADLINE_MAX);
  return truncateText(`Membro ELO+ · ${mode}`, BLUEPRINT_LIMITS.HEADLINE_MAX);
}

export function extractFirebaseUserMessage(err: unknown, fallback: string): string {
  const raw = err instanceof Error ? err.message : String(err ?? '');
  if (!raw) return fallback;

  let inner = raw;
  if (raw.trim().startsWith('{')) {
    try {
      const parsed = JSON.parse(raw) as { error?: string };
      if (parsed?.error) inner = parsed.error;
    } catch {
      // Keep raw message if JSON parsing fails
    }
  }

  const lower = inner.toLowerCase();
  if (lower.includes('quota exceeded')) {
    return 'Limite diário gratuito do banco de dados atingido. Tente novamente mais tarde.';
  }
  if (lower.includes('permission') || lower.includes('insufficient permissions')) {
    return 'Permissão negada ao gravar no Firestore. Verifique se você está autenticado e se as regras foram publicadas.';
  }
  if (lower.includes('offline') || lower.includes('network')) {
    return 'Sem conexão com a nuvem no momento. Verifique sua internet e tente novamente.';
  }
  return inner || fallback;
}

function publicAndPrivateToUserProfile(
  uid: string,
  pubData: Record<string, unknown>,
  privData?: Record<string, unknown>,
  fallbackEmail = '',
): UserProfile {
  const rawSettings = (privData?.settings as Partial<UserSettings> | undefined) ?? {};
  const settings: UserSettings = {
    ...DEFAULT_SETTINGS,
    ...rawSettings,
    privacyPublicProfile:
      typeof pubData.privacyPublicProfile === 'boolean'
        ? pubData.privacyPublicProfile
        : (rawSettings.privacyPublicProfile ?? true),
    privacyAllowMessages:
      typeof pubData.privacyAllowMessages === 'boolean'
        ? pubData.privacyAllowMessages
        : (rawSettings.privacyAllowMessages ?? true),
  };

  return {
    id: uid,
    displayName: String(pubData.displayName || 'Membro'),
    fullName: String(pubData.fullName || 'Membro ELO+'),
    email: String(privData?.email || fallbackEmail || ''),
    age: typeof privData?.age === 'number' ? privData.age : 18,
    headline: String(pubData.headline || ''),
    bio: String(pubData.bio || ''),
    locationLabel: String(pubData.locationLabel || 'Brasil'),
    avatarUrl: String(pubData.avatarUrl || ''),
    coverUrl: String(pubData.coverUrl || ''),
    rating: typeof pubData.rating === 'number' ? pubData.rating : 5,
    skills: Array.isArray(pubData.skills) ? (pubData.skills as SkillItem[]) : [],
    desiredSkills: Array.isArray(pubData.desiredSkills) ? (pubData.desiredSkills as string[]) : [],
    featuredWorks: Array.isArray(pubData.featuredWorks)
      ? (pubData.featuredWorks as FeaturedWork[])
      : [],
    settings,
    isDemo: Boolean(pubData.isDemo),
    createdAt: toIsoString(pubData.createdAt),
  };
}

function normalizeUserForPublicDoc(user: UserProfile) {
  return {
    uid: user.id,
    displayName: truncateText(user.displayName || extractFirstName(user.fullName), BLUEPRINT_LIMITS.DISPLAY_NAME_MAX) || 'Membro',
    fullName: truncateText(user.fullName, BLUEPRINT_LIMITS.FULL_NAME_MAX) || 'Membro ELO+',
    headline: truncateText(user.headline, BLUEPRINT_LIMITS.HEADLINE_MAX),
    bio: truncateText(user.bio, BLUEPRINT_LIMITS.BIO_MAX),
    locationLabel: truncateText(user.locationLabel, BLUEPRINT_LIMITS.LOCATION_MAX),
    avatarUrl: truncateText(user.avatarUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
    coverUrl: truncateText(user.coverUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
    rating: Math.max(0, Math.min(5, Number(user.rating) || 5)),
    skills: clampArray(user.skills).map((s) => ({
      id: sanitizeId(s.id),
      name: truncateText(s.name, BLUEPRINT_LIMITS.SKILL_NAME_MAX),
      categoryId: s.categoryId,
      level: s.level,
      mode: s.mode || 'Presencial e Remoto',
      description: truncateText(s.description || '', BLUEPRINT_LIMITS.BIO_MAX),
    })),
    desiredSkills: clampArray(
      user.desiredSkills
        .map((s) => truncateText(s, BLUEPRINT_LIMITS.SKILL_NAME_MAX))
        .filter(Boolean),
    ),
    featuredWorks: clampArray(user.featuredWorks).map((w) => ({
      id: sanitizeId(w.id),
      title: truncateText(w.title, BLUEPRINT_LIMITS.WORK_TITLE_MAX),
      authorName: truncateText(w.authorName, BLUEPRINT_LIMITS.FULL_NAME_MAX),
      category: truncateText(w.category, BLUEPRINT_LIMITS.SKILL_NAME_MAX),
      rating: Math.max(1, Math.min(5, Number(w.rating) || 5)),
      maxRating: 5,
      imageUrl: truncateText(w.imageUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
      description: truncateText(w.description, BLUEPRINT_LIMITS.BIO_MAX),
      createdAt: w.createdAt || new Date().toISOString(),
    })),
    privacyPublicProfile: Boolean(user.settings.privacyPublicProfile),
    privacyAllowMessages: Boolean(user.settings.privacyAllowMessages),
  };
}

const inFlightProfileSync = new Map<string, Promise<UserProfile>>();

export async function ensureFirebaseUserProfile(
  fbUser: FirebaseUser,
  displayNameOverride?: string,
): Promise<UserProfile> {
  const existingPromise = inFlightProfileSync.get(fbUser.uid);
  if (existingPromise) {
    return existingPromise;
  }

  const task = ensureFirebaseUserProfileInternal(fbUser, displayNameOverride).finally(() => {
    inFlightProfileSync.delete(fbUser.uid);
  });
  inFlightProfileSync.set(fbUser.uid, task);
  return task;
}

async function ensureFirebaseUserProfileInternal(
  fbUser: FirebaseUser,
  displayNameOverride?: string,
): Promise<UserProfile> {
  const uid = fbUser.uid;
  const pubRef = doc(db, 'publicProfiles', uid);
  const privRef = doc(db, 'users', uid);

  let pubSnap;
  let privSnap;
  try {
    [pubSnap, privSnap] = await Promise.all([getDoc(pubRef), getDoc(privRef)]);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `publicProfiles/${uid}`);
  }

  if (pubSnap.exists() && privSnap.exists()) {
    return publicAndPrivateToUserProfile(
      uid,
      pubSnap.data() as Record<string, unknown>,
      privSnap.data() as Record<string, unknown>,
      fbUser.email || '',
    );
  }

  const rawName = (displayNameOverride || fbUser.displayName || '').trim();
  const safeName = rawName.length >= 2 ? rawName : `${rawName || 'Membro'} ELO+`.trim();
  const fullName = truncateText(safeName, BLUEPRINT_LIMITS.FULL_NAME_MAX);
  const displayName = truncateText(extractFirstName(fullName), BLUEPRINT_LIMITS.DISPLAY_NAME_MAX) || 'Membro';
  const email = truncateText(fbUser.email || '', BLUEPRINT_LIMITS.EMAIL_MAX) || `${uid}@eloplus.local`;

  const batch = writeBatch(db);
  if (!pubSnap.exists()) {
    batch.set(pubRef, {
      uid,
      displayName,
      fullName,
      headline: '',
      bio: '',
      locationLabel: 'Brasil',
      avatarUrl: '',
      coverUrl: '',
      rating: 5,
      skills: [],
      desiredSkills: [],
      featuredWorks: [],
      privacyPublicProfile: true,
      privacyAllowMessages: true,
      isDemo: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  if (!privSnap.exists()) {
    batch.set(privRef, {
      uid,
      email,
      age: 18,
      settings: DEFAULT_SETTINGS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const welcomeId = sanitizeId(`welcome_${uid}`);
  const welcomeNotifRef = doc(db, 'users', uid, 'notifications', welcomeId);
  batch.set(welcomeNotifRef, {
    id: welcomeId,
    recipientId: uid,
    senderId: uid,
    title: 'Bem-vindo à rede ELO+ em tempo real!',
    content: 'Converse ao vivo com outros participantes conectados e proponha trocas de habilidades.',
    type: 'PROPOSTA_TROCA',
    read: false,
    createdAt: serverTimestamp(),
  });

  try {
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `users/${uid}`);
  }

  const [freshPub, freshPriv] = await Promise.all([getDoc(pubRef), getDoc(privRef)]);
  return publicAndPrivateToUserProfile(
    uid,
    (freshPub.data() || {}) as Record<string, unknown>,
    (freshPriv.data() || {}) as Record<string, unknown>,
    email,
  );
}

export async function signInWithGoogleFirebase(): Promise<AuthResponse> {
  googleProvider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, googleProvider);
  const user = await ensureFirebaseUserProfile(cred.user);
  const token = await cred.user.getIdToken();
  return { token, user };
}

export async function registerWithEmailFirebase(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const cleanName = payload.name.trim();
  const cleanEmail = payload.email.trim().toLowerCase();
  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, payload.password);
  if (cleanName) {
    await updateProfile(cred.user, { displayName: cleanName });
  }
  const user = await ensureFirebaseUserProfile(cred.user, cleanName);
  const token = await cred.user.getIdToken();
  return { token, user };
}

export async function loginWithEmailFirebase(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const cred = await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password);
  const user = await ensureFirebaseUserProfile(cred.user);
  const token = await cred.user.getIdToken();
  return { token, user };
}

export async function sendPasswordResetFirebase(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim().toLowerCase());
}

export async function signOutFirebase(): Promise<void> {
  await signOut(auth);
}

export function getFirebaseCategories(spotlights: CreatorSpotlight[]): CategoryItem[] {
  return SEED_CATEGORIES.map((cat) => ({
    ...cat,
    creatorCount:
      cat.creatorCount +
      spotlights.filter((s) => !s.isDemo && s.categoryId === cat.id).length,
  }));
}

export interface RealtimeSubscriptionsCallbacks {
  onSpotlights: (spotlights: CreatorSpotlight[]) => void;
  onConversations: (conversations: ConversationThread[]) => void;
  onExchanges: (exchanges: ExchangeProposal[]) => void;
  onNotifications: (notifications: NotificationItem[]) => void;
  onError?: (message: string) => void;
}

export function subscribeToFirebaseSession(
  uid: string,
  callbacks: RealtimeSubscriptionsCallbacks,
): () => void {
  const unsubs: Array<() => void> = [];
  let lastReportedKey = '';
  const reportSnapshotError = (error: unknown, op: OperationType, path: string) => {
    try {
      handleFirestoreError(error, op, path);
    } catch (wrapped) {
      const text = wrapped instanceof Error ? wrapped.message : String(error);
      const scope = path.includes('/messages')
        ? 'mensagens'
        : path.startsWith('chats')
          ? 'conversas'
          : path.startsWith('publicProfiles')
            ? 'perfis'
            : path.includes('/reviews') || path.startsWith('exchanges')
              ? 'trocas'
              : path.includes('/notifications')
                ? 'notificações'
                : 'dados';
      const dedupeKey = `${scope}:${text.includes('Quota exceeded') ? 'quota' : 'sync'}`;
      if (lastReportedKey === dedupeKey) return;
      lastReportedKey = dedupeKey;
      callbacks.onError?.(
        text.includes('Quota exceeded')
          ? 'Limite diário gratuito do Firestore atingido.'
          : `Erro de sincronização em tempo real com o Firebase (${scope}).`,
      );
    }
  };

  // 1. Public profiles listener
  const profilesQ = query(
    collection(db, 'publicProfiles'),
    where('privacyPublicProfile', '==', true),
    limit(50),
  );
  unsubs.push(
    onSnapshot(
      profilesQ,
      (snap) => {
        const realUsers = snap.docs.map((d) =>
          publicAndPrivateToUserProfile(d.id, d.data() as Record<string, unknown>),
        );
        callbacks.onSpotlights(buildDiscoverSpotlights(realUsers, SEED_SPOTLIGHTS, uid));
      },
      (error) => reportSnapshotError(error, OperationType.LIST, 'publicProfiles'),
    ),
  );

  // 2. Chats & real-time messages subcollection listeners
  const chatDocsA = new Map<string, Record<string, unknown>>();
  const chatDocsB = new Map<string, Record<string, unknown>>();
  const messagesByChat = new Map<string, ChatMessage[]>();
  const messageUnsubs = new Map<string, () => void>();

  const emitChats = () => {
    const merged = new Map<string, Record<string, unknown>>();
    chatDocsA.forEach((v, k) => merged.set(k, v));
    chatDocsB.forEach((v, k) => merged.set(k, v));

    const threads: ConversationThread[] = Array.from(merged.entries()).map(([chatId, data]) => {
      const isA = data.participantA === uid;
      const partnerId = isA ? String(data.participantB) : String(data.participantA);
      const partnerName = isA ? String(data.participantBName) : String(data.participantAName);
      const partnerRole = isA ? String(data.participantBRole) : String(data.participantARole);
      const partnerAvatar = isA
        ? String(data.participantBAvatarUrl || '')
        : String(data.participantAAvatarUrl || '');
      const unreadCount = isA ? Number(data.unreadA || 0) : Number(data.unreadB || 0);
      const updatedAt = toIsoString(data.updatedAt);

      return {
        id: chatId,
        participantId: partnerId,
        participantName: partnerName,
        participantRole: partnerRole,
        participantAvatarUrl: partnerAvatar,
        unreadCount,
        updatedAt,
        messages: messagesByChat.get(chatId) ?? [],
      };
    });

    threads.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    callbacks.onConversations(threads);
  };

  const syncMessageListeners = () => {
    const activeIds = new Set<string>([...chatDocsA.keys(), ...chatDocsB.keys()]);

    for (const [chatId, unsub] of messageUnsubs.entries()) {
      if (!activeIds.has(chatId)) {
        unsub();
        messageUnsubs.delete(chatId);
        messagesByChat.delete(chatId);
      }
    }

    for (const chatId of activeIds) {
      if (messageUnsubs.has(chatId)) continue;
      const msgQ = query(
        collection(db, 'chats', chatId, 'messages'),
        where('participants', 'array-contains', uid),
        limit(150),
      );
      const unsub = onSnapshot(
        msgQ,
        (msgSnap) => {
          const msgs: ChatMessage[] = msgSnap.docs
            .map((m) => {
              const d = m.data();
              return {
                id: String(d.id || m.id),
                senderId: String(d.senderId || ''),
                senderName: String(d.senderName || ''),
                text: String(d.text || ''),
                sentAt: toIsoString(d.sentAt),
              };
            })
            .sort((a, b) => new Date(a.sentAt).getTime() - new Date(b.sentAt).getTime());
          messagesByChat.set(chatId, msgs);
          emitChats();
        },
        (error) => reportSnapshotError(error, OperationType.LIST, `chats/${chatId}/messages`),
      );
      messageUnsubs.set(chatId, unsub);
    }

    emitChats();
  };

  unsubs.push(
    onSnapshot(
      query(collection(db, 'chats'), where('participantA', '==', uid), limit(40)),
      (snap) => {
        chatDocsA.clear();
        snap.docs.forEach((d) => chatDocsA.set(d.id, d.data() as Record<string, unknown>));
        syncMessageListeners();
      },
      (error) => reportSnapshotError(error, OperationType.LIST, 'chats'),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'chats'), where('participantB', '==', uid), limit(40)),
      (snap) => {
        chatDocsB.clear();
        snap.docs.forEach((d) => chatDocsB.set(d.id, d.data() as Record<string, unknown>));
        syncMessageListeners();
      },
      (error) => reportSnapshotError(error, OperationType.LIST, 'chats'),
    ),
  );

  // 3. Exchanges listener
  const exDocsA = new Map<string, Record<string, unknown>>();
  const exDocsB = new Map<string, Record<string, unknown>>();
  const reviewsByExchange = new Map<string, ExchangeReview[]>();
  const reviewUnsubs = new Map<string, () => void>();

  const emitExchanges = () => {
    const merged = new Map<string, Record<string, unknown>>();
    exDocsA.forEach((v, k) => merged.set(k, v));
    exDocsB.forEach((v, k) => merged.set(k, v));

    const list: ExchangeProposal[] = Array.from(merged.entries()).map(([id, d]) => ({
      id,
      proposerId: String(d.proposerId || ''),
      proposerName: String(d.proposerName || ''),
      proposerAvatarUrl: String(d.proposerAvatarUrl || ''),
      receiverId: String(d.receiverId || ''),
      receiverName: String(d.receiverName || ''),
      receiverAvatarUrl: String(d.receiverAvatarUrl || ''),
      offeredSkill: String(d.offeredSkill || ''),
      requestedSkill: String(d.requestedSkill || ''),
      mode: d.mode === 'Remoto' ? 'Remoto' : 'Presencial',
      scheduledDate: String(d.scheduledDate || ''),
      location: String(d.location || ''),
      notes: String(d.notes || ''),
      status: String(d.status || 'PENDENTE') as ExchangeStatus,
      lastUpdatedBy: String(d.lastUpdatedBy || ''),
      reviews: reviewsByExchange.get(id) ?? [],
      createdAt: toIsoString(d.createdAt),
      updatedAt: toIsoString(d.updatedAt),
    }));

    list.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
    callbacks.onExchanges(list);
  };

  const syncReviewListeners = () => {
    const merged = new Map<string, Record<string, unknown>>();
    exDocsA.forEach((v, k) => merged.set(k, v));
    exDocsB.forEach((v, k) => merged.set(k, v));

    for (const [exId, unsub] of reviewUnsubs.entries()) {
      if (!merged.has(exId)) {
        unsub();
        reviewUnsubs.delete(exId);
        reviewsByExchange.delete(exId);
      }
    }

    for (const [exId, data] of merged.entries()) {
      if (data.status === 'CONCLUIDA' && !reviewUnsubs.has(exId)) {
        const revQ = query(
          collection(db, 'exchanges', exId, 'reviews'),
          where('exchangeParticipants', 'array-contains', uid),
        );
        const unsub = onSnapshot(
          revQ,
          (revSnap) => {
            const revs: ExchangeReview[] = revSnap.docs.map((r) => {
              const rd = r.data();
              return {
                reviewerId: String(rd.reviewerId || r.id),
                reviewerName: String(rd.reviewerName || ''),
                rating: Number(rd.rating || 5),
                comment: String(rd.comment || ''),
                createdAt: toIsoString(rd.createdAt),
              };
            });
            reviewsByExchange.set(exId, revs);
            emitExchanges();
          },
          (error) => reportSnapshotError(error, OperationType.LIST, `exchanges/${exId}/reviews`),
        );
        reviewUnsubs.set(exId, unsub);
      }
    }

    emitExchanges();
  };

  unsubs.push(
    onSnapshot(
      query(collection(db, 'exchanges'), where('proposerId', '==', uid), limit(40)),
      (snap) => {
        exDocsA.clear();
        snap.docs.forEach((d) => exDocsA.set(d.id, d.data() as Record<string, unknown>));
        syncReviewListeners();
      },
      (error) => reportSnapshotError(error, OperationType.LIST, 'exchanges'),
    ),
  );

  unsubs.push(
    onSnapshot(
      query(collection(db, 'exchanges'), where('receiverId', '==', uid), limit(40)),
      (snap) => {
        exDocsB.clear();
        snap.docs.forEach((d) => exDocsB.set(d.id, d.data() as Record<string, unknown>));
        syncReviewListeners();
      },
      (error) => reportSnapshotError(error, OperationType.LIST, 'exchanges'),
    ),
  );

  // 4. Notifications listener
  const notifQ = query(
    collection(db, 'users', uid, 'notifications'),
    where('recipientId', '==', uid),
    limit(40),
  );
  unsubs.push(
    onSnapshot(
      notifQ,
      (snap) => {
        const items: NotificationItem[] = snap.docs
          .map((d) => {
            const n = d.data();
            return {
              id: String(n.id || d.id),
              title: String(n.title || ''),
              content: String(n.content || ''),
              type: (n.type || 'PROPOSTA_TROCA') as NotificationItem['type'],
              read: Boolean(n.read),
              createdAt: toIsoString(n.createdAt),
            };
          })
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        callbacks.onNotifications(items);
      },
      (error) => reportSnapshotError(error, OperationType.LIST, `users/${uid}/notifications`),
    ),
  );

  return () => {
    unsubs.forEach((fn) => fn());
    messageUnsubs.forEach((fn) => fn());
    reviewUnsubs.forEach((fn) => fn());
  };
}

export const firebaseRuntime = {
  async updateProfile(
    user: UserProfile,
    payload: {
      fullName?: string;
      displayName?: string;
      email?: string;
      age?: number;
      headline?: string;
      bio?: string;
      locationLabel?: string;
      desiredSkills?: string[];
      avatarUrl?: string;
      coverUrl?: string;
    },
  ): Promise<UserProfile> {
    if (payload.email !== undefined) {
      const check = validateEmail(payload.email);
      if (!check.valid) throw new Error(check.error || 'E-mail inválido.');
    }

    const nextFullName =
      payload.fullName !== undefined ? payload.fullName.trim() || user.fullName : user.fullName;
    const nextUser: UserProfile = {
      ...user,
      fullName: nextFullName,
      displayName:
        payload.displayName !== undefined
          ? payload.displayName.trim() || extractFirstName(nextFullName)
          : payload.fullName !== undefined
            ? extractFirstName(nextFullName)
            : user.displayName,
      email: payload.email !== undefined ? payload.email.trim().toLowerCase() : user.email,
      age:
        payload.age !== undefined && Number.isFinite(payload.age)
          ? Math.max(13, Math.min(120, Math.round(payload.age)))
          : user.age,
      headline: payload.headline !== undefined ? payload.headline.trim() : user.headline,
      bio: payload.bio !== undefined ? payload.bio.trim() : user.bio,
      locationLabel:
        payload.locationLabel !== undefined ? payload.locationLabel.trim() : user.locationLabel,
      desiredSkills:
        payload.desiredSkills !== undefined ? payload.desiredSkills : user.desiredSkills,
      avatarUrl:
        payload.avatarUrl !== undefined ? clampMediaDataUrl(payload.avatarUrl) : user.avatarUrl,
      coverUrl:
        payload.coverUrl !== undefined ? clampMediaDataUrl(payload.coverUrl) : user.coverUrl,
    };

    const pubPayload = normalizeUserForPublicDoc(nextUser);
    const batch = writeBatch(db);
    batch.update(doc(db, 'publicProfiles', user.id), {
      displayName: pubPayload.displayName,
      fullName: pubPayload.fullName,
      headline: pubPayload.headline,
      bio: pubPayload.bio,
      locationLabel: pubPayload.locationLabel,
      avatarUrl: pubPayload.avatarUrl,
      coverUrl: pubPayload.coverUrl,
      rating: pubPayload.rating,
      skills: pubPayload.skills,
      desiredSkills: pubPayload.desiredSkills,
      featuredWorks: pubPayload.featuredWorks,
      privacyPublicProfile: pubPayload.privacyPublicProfile,
      privacyAllowMessages: pubPayload.privacyAllowMessages,
      updatedAt: serverTimestamp(),
    });

    if (payload.email !== undefined || payload.age !== undefined) {
      batch.update(doc(db, 'users', user.id), {
        email: truncateText(nextUser.email, BLUEPRINT_LIMITS.EMAIL_MAX),
        age: nextUser.age,
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `publicProfiles/${user.id}`);
    }

    return nextUser;
  },

  async addSkill(
    user: UserProfile,
    payload: {
      name: string;
      categoryId: CategorySlug;
      level: SkillItem['level'];
      mode?: AttendanceMode;
      description?: string;
    },
  ): Promise<UserProfile> {
    if (!payload.name?.trim()) {
      throw new Error('Informe o nome da habilidade.');
    }
    if (user.skills.length >= BLUEPRINT_LIMITS.MAX_ARRAY_ITEMS) {
      throw new Error('Limite máximo de 12 habilidades cadastradas atingido.');
    }
    const newSkill: SkillItem = {
      id: sanitizeId(`sk_${Date.now()}`),
      name: truncateText(payload.name, BLUEPRINT_LIMITS.SKILL_NAME_MAX),
      categoryId: payload.categoryId || 'programacao',
      level: payload.level || 'Intermediário',
      mode: payload.mode || 'Presencial e Remoto',
      description: truncateText(payload.description || '', BLUEPRINT_LIMITS.BIO_MAX),
    };
    const nextUser: UserProfile = {
      ...user,
      skills: [...user.skills, newSkill],
    };
    const pubPayload = normalizeUserForPublicDoc(nextUser);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'publicProfiles', user.id), {
        skills: pubPayload.skills,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `publicProfiles/${user.id}`);
    }
    return nextUser;
  },

  async removeSkill(user: UserProfile, skillId: string): Promise<UserProfile> {
    const nextUser: UserProfile = {
      ...user,
      skills: user.skills.filter((s) => s.id !== skillId),
    };
    const pubPayload = normalizeUserForPublicDoc(nextUser);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'publicProfiles', user.id), {
        skills: pubPayload.skills,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `publicProfiles/${user.id}`);
    }
    return nextUser;
  },

  async addFeaturedWork(
    user: UserProfile,
    payload: { title: string; category: string; description: string },
  ): Promise<UserProfile> {
    if (payload.title.trim().length < 3) {
      throw new Error('Título do trabalho deve ter ao menos 3 caracteres.');
    }
    if (user.featuredWorks.length >= BLUEPRINT_LIMITS.MAX_ARRAY_ITEMS) {
      throw new Error('Limite máximo de 12 trabalhos em destaque atingido.');
    }
    const newWork: FeaturedWork = {
      id: sanitizeId(`fw_${Date.now()}`),
      title: truncateText(payload.title, BLUEPRINT_LIMITS.WORK_TITLE_MAX),
      authorName: truncateText(user.fullName, BLUEPRINT_LIMITS.FULL_NAME_MAX),
      category: truncateText(payload.category || 'Colaboração', BLUEPRINT_LIMITS.SKILL_NAME_MAX),
      rating: 5,
      maxRating: 5,
      imageUrl: '',
      description: truncateText(payload.description, BLUEPRINT_LIMITS.BIO_MAX),
      createdAt: new Date().toISOString(),
    };
    const nextUser: UserProfile = {
      ...user,
      featuredWorks: [newWork, ...user.featuredWorks],
    };
    const pubPayload = normalizeUserForPublicDoc(nextUser);
    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'publicProfiles', user.id), {
        featuredWorks: pubPayload.featuredWorks,
        updatedAt: serverTimestamp(),
      });
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `publicProfiles/${user.id}`);
    }
    return nextUser;
  },

  async updateSettings(user: UserProfile, partial: Partial<UserSettings>): Promise<UserProfile> {
    const nextSettings: UserSettings = {
      ...DEFAULT_SETTINGS,
      ...user.settings,
      ...partial,
    };
    const nextUser: UserProfile = {
      ...user,
      settings: nextSettings,
    };

    const batch = writeBatch(db);
    batch.update(doc(db, 'users', user.id), {
      settings: nextSettings,
      updatedAt: serverTimestamp(),
    });
    if (
      partial.privacyPublicProfile !== undefined ||
      partial.privacyAllowMessages !== undefined
    ) {
      batch.update(doc(db, 'publicProfiles', user.id), {
        privacyPublicProfile: Boolean(nextSettings.privacyPublicProfile),
        privacyAllowMessages: Boolean(nextSettings.privacyAllowMessages),
        updatedAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
    }
    return nextUser;
  },

  async sendMessage(
    user: UserProfile,
    participantId: string,
    text: string,
    partnerFallback?: { name: string; role: string; avatarUrl: string },
  ): Promise<void> {
    const cleanText = truncateText(text, BLUEPRINT_LIMITS.CHAT_TEXT_MAX);
    if (!cleanText) throw new Error('Escreva uma mensagem antes de enviar.');

    const safeMyId = sanitizeId(user.id);
    const safePartnerId = sanitizeId(participantId);
    if (safeMyId === safePartnerId) {
      throw new Error('Você não pode enviar mensagens para si mesmo.');
    }

    const [participantA, participantB] = sortedUidPair(safeMyId, safePartnerId);
    const chatId = canonicalChatId(participantA, participantB);
    const chatRef = doc(db, 'chats', chatId);
    const partnerRef = doc(db, 'publicProfiles', safePartnerId);

    let chatSnap;
    try {
      chatSnap = await getDoc(chatRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `chats/${chatId}`);
    }

    let partnerSnap = null;
    try {
      partnerSnap = await getDoc(partnerRef);
    } catch (error) {
      if (!chatSnap.exists()) {
        handleFirestoreError(error, OperationType.GET, `publicProfiles/${safePartnerId}`);
      }
    }

    if (!chatSnap.exists() && (!partnerSnap || !partnerSnap.exists())) {
      throw new Error('Perfil de destino não encontrado na nuvem.');
    }

    const partnerData = partnerSnap?.exists()
      ? (partnerSnap.data() as Record<string, unknown>)
      : null;

    if (partnerData && partnerData.privacyAllowMessages === false) {
      throw new Error('Este participante desativou o recebimento de novas mensagens.');
    }

    const prevData = chatSnap.exists() ? (chatSnap.data() as Record<string, unknown>) : null;
    const isSenderA = participantA === safeMyId;

    const existingPartnerName = prevData
      ? String(isSenderA ? prevData.participantBName : prevData.participantAName)
      : '';
    const existingPartnerRole = prevData
      ? String(isSenderA ? prevData.participantBRole : prevData.participantARole)
      : '';
    const existingPartnerAvatar = prevData
      ? String(isSenderA ? prevData.participantBAvatarUrl : prevData.participantAAvatarUrl)
      : '';

    const partnerName =
      truncateText(
        String(partnerData?.displayName ?? ''),
        BLUEPRINT_LIMITS.FULL_NAME_MAX,
      ) ||
      truncateText(existingPartnerName, BLUEPRINT_LIMITS.FULL_NAME_MAX) ||
      truncateText(partnerFallback?.name ?? '', BLUEPRINT_LIMITS.FULL_NAME_MAX) ||
      'Membro';

    const partnerSkills = Array.isArray(partnerData?.skills)
      ? (partnerData!.skills as SkillItem[])
      : [];
    const partnerRole = partnerData
      ? buildRoleLabel(String(partnerData.headline || ''), partnerSkills)
      : truncateText(
          existingPartnerRole || partnerFallback?.role || 'Membro ELO+',
          BLUEPRINT_LIMITS.HEADLINE_MAX,
        );
    const partnerAvatarUrl = truncateText(
      String(partnerData?.avatarUrl ?? existingPartnerAvatar ?? partnerFallback?.avatarUrl ?? ''),
      BLUEPRINT_LIMITS.MEDIA_URL_MAX,
    );

    const myName = truncateText(user.displayName, BLUEPRINT_LIMITS.FULL_NAME_MAX) || 'Membro';
    const myRole = buildRoleLabel(user.headline, user.skills);
    const myAvatarUrl = truncateText(user.avatarUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX);

    const prevUnreadA = Number(prevData?.unreadA || 0);
    const prevUnreadB = Number(prevData?.unreadB || 0);

    const batch = writeBatch(db);
    if (!chatSnap.exists()) {
      batch.set(chatRef, {
        participantA,
        participantB,
        participantAName: isSenderA ? myName : partnerName,
        participantARole: isSenderA ? myRole : partnerRole,
        participantAAvatarUrl: isSenderA ? myAvatarUrl : partnerAvatarUrl,
        participantBName: isSenderA ? partnerName : myName,
        participantBRole: isSenderA ? partnerRole : myRole,
        participantBAvatarUrl: isSenderA ? partnerAvatarUrl : myAvatarUrl,
        unreadA: isSenderA ? 0 : 1,
        unreadB: isSenderA ? 1 : 0,
        lastMessageText: cleanText,
        lastSenderId: safeMyId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      batch.update(chatRef, {
        participantAName: isSenderA ? myName : partnerName,
        participantARole: isSenderA ? myRole : partnerRole,
        participantAAvatarUrl: isSenderA ? myAvatarUrl : partnerAvatarUrl,
        participantBName: isSenderA ? partnerName : myName,
        participantBRole: isSenderA ? partnerRole : myRole,
        participantBAvatarUrl: isSenderA ? partnerAvatarUrl : myAvatarUrl,
        unreadA: isSenderA ? 0 : Math.min(9999, prevUnreadA + 1),
        unreadB: isSenderA ? Math.min(9999, prevUnreadB + 1) : 0,
        lastMessageText: cleanText,
        lastSenderId: safeMyId,
        updatedAt: serverTimestamp(),
      });
    }

    const msgId = sanitizeId(`msg_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
    batch.set(doc(db, 'chats', chatId, 'messages', msgId), {
      id: msgId,
      senderId: safeMyId,
      senderName: myName,
      participants: [participantA, participantB],
      text: cleanText,
      sentAt: serverTimestamp(),
    });

    if (partnerSnap?.exists()) {
      const notifId = sanitizeId(`notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
      batch.set(doc(db, 'users', safePartnerId, 'notifications', notifId), {
        id: notifId,
        recipientId: safePartnerId,
        senderId: safeMyId,
        title: truncateText(`Nova mensagem de ${myName}`, BLUEPRINT_LIMITS.NOTIF_TITLE_MAX),
        content: truncateText(cleanText, BLUEPRINT_LIMITS.NOTIF_CONTENT_MAX),
        type: 'MENSAGEM_CHAT',
        read: false,
        createdAt: serverTimestamp(),
      });
    }

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `chats/${chatId}/messages/${msgId}`);
    }
  },

  async markConversationRead(userId: string, participantId: string): Promise<void> {
    const [participantA, participantB] = sortedUidPair(userId, participantId);
    const chatId = canonicalChatId(participantA, participantB);
    const chatRef = doc(db, 'chats', chatId);
    let snap;
    try {
      snap = await getDoc(chatRef);
    } catch {
      return;
    }
    if (!snap.exists()) return;
    const data = snap.data() as Record<string, unknown>;
    const isA = data.participantA === userId;
    const myUnread = isA ? Number(data.unreadA || 0) : Number(data.unreadB || 0);
    if (myUnread === 0) return;

    const batch = writeBatch(db);
    batch.update(chatRef, {
      unreadA: isA ? 0 : Number(data.unreadA || 0),
      unreadB: isA ? Number(data.unreadB || 0) : 0,
      updatedAt: serverTimestamp(),
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}`);
    }
  },

  async createExchange(
    user: UserProfile,
    payload: {
      receiverId: string;
      offeredSkill: string;
      requestedSkill: string;
      mode: 'Presencial' | 'Remoto';
      scheduledDate: string;
      location: string;
      notes: string;
    },
  ): Promise<void> {
    if (user.skills.length < 1) {
      throw new Error('Cadastre pelo menos uma habilidade no seu perfil antes de propor uma troca.');
    }

    const partnerRef = doc(db, 'publicProfiles', payload.receiverId);
    let partnerSnap;
    try {
      partnerSnap = await getDoc(partnerRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `publicProfiles/${payload.receiverId}`);
    }
    if (!partnerSnap.exists()) {
      throw new Error('Participante não encontrado na nuvem.');
    }
    const partnerData = partnerSnap.data() as Record<string, unknown>;

    const exId = sanitizeId(`ex_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    const notifId = sanitizeId(`notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);

    const batch = writeBatch(db);
    batch.set(doc(db, 'exchanges', exId), {
      id: exId,
      proposerId: user.id,
      proposerName: truncateText(user.displayName, BLUEPRINT_LIMITS.FULL_NAME_MAX) || 'Membro',
      proposerAvatarUrl: truncateText(user.avatarUrl, BLUEPRINT_LIMITS.MEDIA_URL_MAX),
      receiverId: payload.receiverId,
      receiverName: truncateText(String(partnerData.displayName || 'Membro'), BLUEPRINT_LIMITS.FULL_NAME_MAX),
      receiverAvatarUrl: truncateText(String(partnerData.avatarUrl || ''), BLUEPRINT_LIMITS.MEDIA_URL_MAX),
      offeredSkill: truncateText(payload.offeredSkill, BLUEPRINT_LIMITS.EXCHANGE_SKILL_MAX),
      requestedSkill: truncateText(payload.requestedSkill, BLUEPRINT_LIMITS.EXCHANGE_SKILL_MAX),
      mode: payload.mode === 'Remoto' ? 'Remoto' : 'Presencial',
      scheduledDate: truncateText(payload.scheduledDate, BLUEPRINT_LIMITS.EXCHANGE_DATE_MAX),
      location: truncateText(payload.location, BLUEPRINT_LIMITS.EXCHANGE_LOCATION_MAX),
      notes: truncateText(payload.notes || '', BLUEPRINT_LIMITS.EXCHANGE_NOTES_MAX),
      status: 'PENDENTE',
      lastUpdatedBy: user.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'users', payload.receiverId, 'notifications', notifId), {
      id: notifId,
      recipientId: payload.receiverId,
      senderId: user.id,
      title: truncateText(`Nova proposta de ${user.displayName}`, BLUEPRINT_LIMITS.NOTIF_TITLE_MAX),
      content: truncateText(
        `${user.displayName} propôs trocar ${payload.offeredSkill} por ${payload.requestedSkill}.`,
        BLUEPRINT_LIMITS.NOTIF_CONTENT_MAX,
      ),
      type: 'PROPOSTA_TROCA',
      read: false,
      createdAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `exchanges/${exId}`);
    }
  },

  async respondExchange(
    user: UserProfile,
    exchangeId: string,
    payload: {
      action: 'accept' | 'decline' | 'counter' | 'complete';
      scheduledDate?: string;
      location?: string;
      offeredSkill?: string;
      notes?: string;
    },
  ): Promise<void> {
    const exRef = doc(db, 'exchanges', exchangeId);
    let snap;
    try {
      snap = await getDoc(exRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `exchanges/${exchangeId}`);
    }
    if (!snap.exists()) throw new Error('Proposta de troca não encontrada.');
    const ex = snap.data() as Record<string, unknown>;
    const partnerId = ex.proposerId === user.id ? String(ex.receiverId) : String(ex.proposerId);

    const batch = writeBatch(db);
    let notifTitle = 'Atualização na troca';
    let notifContent = `${user.displayName} atualizou o status da troca.`;
    let notifType: NotificationItem['type'] = 'AGENDAMENTO';

    if (payload.action === 'accept') {
      batch.update(exRef, {
        status: 'CONFIRMADA',
        lastUpdatedBy: user.id,
        updatedAt: serverTimestamp(),
      });
      notifTitle = 'Troca confirmada!';
      notifContent = `${user.displayName} aceitou e confirmou o agendamento.`;
    } else if (payload.action === 'decline') {
      batch.update(exRef, {
        status: 'CANCELADA',
        lastUpdatedBy: user.id,
        updatedAt: serverTimestamp(),
      });
      notifTitle = 'Proposta cancelada';
      notifContent = `${user.displayName} encerrou a negociação desta troca.`;
      notifType = 'PROPOSTA_TROCA';
    } else if (payload.action === 'complete') {
      batch.update(exRef, {
        status: 'CONCLUIDA',
        lastUpdatedBy: user.id,
        updatedAt: serverTimestamp(),
      });
      notifTitle = 'Troca concluída!';
      notifContent = `${user.displayName} marcou a troca como concluída. Deixe sua avaliação!`;
      notifType = 'AVALIACAO';
    } else {
      batch.update(exRef, {
        status: 'CONTRAPROPOSTA',
        scheduledDate: truncateText(
          payload.scheduledDate || String(ex.scheduledDate || ''),
          BLUEPRINT_LIMITS.EXCHANGE_DATE_MAX,
        ),
        location: truncateText(
          payload.location || String(ex.location || ''),
          BLUEPRINT_LIMITS.EXCHANGE_LOCATION_MAX,
        ),
        offeredSkill: truncateText(
          payload.offeredSkill || String(ex.offeredSkill || ''),
          BLUEPRINT_LIMITS.EXCHANGE_SKILL_MAX,
        ),
        notes: truncateText(
          payload.notes !== undefined ? payload.notes : String(ex.notes || ''),
          BLUEPRINT_LIMITS.EXCHANGE_NOTES_MAX,
        ),
        lastUpdatedBy: user.id,
        updatedAt: serverTimestamp(),
      });
      notifTitle = 'Nova contraproposta recebida';
      notifContent = `${user.displayName} sugeriu novos detalhes de data ou local.`;
      notifType = 'PROPOSTA_TROCA';
    }

    const notifId = sanitizeId(`notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    batch.set(doc(db, 'users', partnerId, 'notifications', notifId), {
      id: notifId,
      recipientId: partnerId,
      senderId: user.id,
      title: truncateText(notifTitle, BLUEPRINT_LIMITS.NOTIF_TITLE_MAX),
      content: truncateText(notifContent, BLUEPRINT_LIMITS.NOTIF_CONTENT_MAX),
      type: notifType,
      read: false,
      createdAt: serverTimestamp(),
    });

    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `exchanges/${exchangeId}`);
    }
  },

  async reviewExchange(
    user: UserProfile,
    exchangeId: string,
    payload: { rating: number; comment: string },
  ): Promise<void> {
    const exRef = doc(db, 'exchanges', exchangeId);
    let snap;
    try {
      snap = await getDoc(exRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `exchanges/${exchangeId}`);
    }
    if (!snap.exists()) throw new Error('Troca não encontrada.');
    const ex = snap.data() as Record<string, unknown>;
    const participants = [String(ex.proposerId), String(ex.receiverId)];

    const revRef = doc(db, 'exchanges', exchangeId, 'reviews', user.id);
    const batch = writeBatch(db);
    batch.set(revRef, {
      reviewerId: user.id,
      reviewerName: truncateText(user.displayName, BLUEPRINT_LIMITS.FULL_NAME_MAX),
      exchangeParticipants: participants,
      rating: Math.max(1, Math.min(5, Math.round(Number(payload.rating) || 5))),
      comment: truncateText(payload.comment || '', BLUEPRINT_LIMITS.REVIEW_COMMENT_MAX),
      createdAt: serverTimestamp(),
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `exchanges/${exchangeId}/reviews/${user.id}`);
    }
  },

  async markNotificationsRead(userId: string): Promise<void> {
    const q = query(
      collection(db, 'users', userId, 'notifications'),
      where('recipientId', '==', userId),
      limit(40),
    );
    let snap;
    try {
      snap = await getDocs(q);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `users/${userId}/notifications`);
    }
    const unread = snap.docs.filter((d) => d.data().read === false);
    if (unread.length === 0) return;

    const batch = writeBatch(db);
    unread.forEach((d) => batch.update(d.ref, { read: true }));
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/notifications`);
    }
  },

  async submitSupportTicket(userId: string, payload: SupportTicketPayload): Promise<string> {
    const subject = truncateText(payload.subject, BLUEPRINT_LIMITS.SUPPORT_SUBJECT_MAX);
    const message = truncateText(payload.message, BLUEPRINT_LIMITS.SUPPORT_MESSAGE_MAX);
    if (subject.length < 3) throw new Error('Informe um assunto válido.');
    if (message.length < 5) throw new Error('Descreva sua dúvida com pelo menos 5 caracteres.');

    const ticketId = sanitizeId(`tkt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    const batch = writeBatch(db);
    batch.set(doc(db, 'supportTickets', ticketId), {
      id: ticketId,
      userId,
      subject,
      message,
      createdAt: serverTimestamp(),
    });
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `supportTickets/${ticketId}`);
    }
    return ticketId;
  },

  async deleteAccount(userId: string): Promise<void> {
    const batch = writeBatch(db);
    batch.delete(doc(db, 'publicProfiles', userId));
    batch.delete(doc(db, 'users', userId));
    try {
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}`);
    }
    const current = auth.currentUser;
    if (current && current.uid === userId) {
      try {
        await deleteUser(current);
        return;
      } catch {
        // Fallback to signOut if Firebase requires recent login before deleteUser
      }
    }
    await signOut(auth);
  },
};

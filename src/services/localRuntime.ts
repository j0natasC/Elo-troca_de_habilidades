import {
  SEED_CATEGORIES,
  SEED_SPOTLIGHTS,
  createSeedConversationsList,
  createSeedDemoProfile,
  createSeedExchangesList,
  createSeedNotificationsList,
} from '../shared/seedData';
import type {
  AuthResponse,
  CategoryItem,
  CategorySlug,
  ConversationThread,
  CreatorSpotlight,
  DiscoverResponse,
  ExchangeProposal,
  ExchangeStatus,
  ForgotPasswordResponse,
  NotificationItem,
  SkillItem,
  SupportTicketPayload,
  UserProfile,
  UserSettings,
} from '../shared/types';
import { buildDiscoverSpotlights } from '../shared/userDirectory';
import { isDemoEntityId } from '../shared/firebaseContracts';
import {
  extractFirstName,
  filterCreatorsByCategoryAndQuery,
  maskEmailAddress,
  validateEmail,
  validateExchangeProposal,
  validateNewPassword,
  validateOtpCode,
  validateRegistration,
} from '../shared/validation';

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface StoredLocalUser extends UserProfile {
  passwordDigest: string;
}

interface LocalOtpChallenge {
  email: string;
  code: string;
  expiresAt: number;
  verified: boolean;
  attempts: number;
}

interface LocalDbState {
  users: StoredLocalUser[];
  spotlights: CreatorSpotlight[];
  categories: CategoryItem[];
  conversationsByUser: Record<string, ConversationThread[]>;
  exchangesByUser: Record<string, ExchangeProposal[]>;
  notificationsByUser: Record<string, NotificationItem[]>;
  otpChallenges: Record<string, LocalOtpChallenge>;
  supportTickets: Array<SupportTicketPayload & { id: string; userId: string; createdAt: string }>;
}

const STORAGE_KEY = 'eloplus_presentation_db_v1';

// Deterministic salted digest so passwords are never stored in plaintext inside localStorage.
function hashLocalPassword(email: string, password: string): string {
  const input = `eloplus::${email.trim().toLowerCase()}::${password}`;
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193) >>> 0;
    h2 = Math.imul(h2 ^ (code + i), 0x85ebca6b) >>> 0;
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`;
}

function makeId(prefix: string): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return `${prefix}-${globalThis.crypto.randomUUID().slice(0, 8)}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeAssetUrl(url: string): string {
  if (url.startsWith('/src/assets/')) {
    return `.${url}`;
  }
  return url;
}

function sanitizeLocalUser(user: StoredLocalUser): UserProfile {
  const { passwordDigest: _omit, ...publicUser } = user;
  return {
    ...publicUser,
    avatarUrl: normalizeAssetUrl(publicUser.avatarUrl),
    coverUrl: normalizeAssetUrl(publicUser.coverUrl),
    featuredWorks: publicUser.featuredWorks.map((w) => ({
      ...w,
      imageUrl: normalizeAssetUrl(w.imageUrl),
    })),
  };
}

function createSeedLocalDb(): LocalDbState {
  const baseUser = createSeedDemoProfile();
  const demoUser: StoredLocalUser = {
    ...baseUser,
    passwordDigest: hashLocalPassword(baseUser.email, 'Comum@123'),
  };

  return {
    users: [demoUser],
    spotlights: SEED_SPOTLIGHTS,
    categories: SEED_CATEGORIES,
    conversationsByUser: {
      [demoUser.id]: createSeedConversationsList(demoUser.id),
    },
    exchangesByUser: {
      [demoUser.id]: createSeedExchangesList(demoUser),
    },
    notificationsByUser: {
      [demoUser.id]: createSeedNotificationsList(),
    },
    otpChallenges: {},
    supportTickets: [],
  };
}

export function createLocalRuntime(storageOverride?: StorageLike) {
  let memoryFallback = new Map<string, string>();
  const getStorage = (): StorageLike => {
    if (storageOverride) return storageOverride;
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    return {
      getItem: (k) => memoryFallback.get(k) ?? null,
      setItem: (k, v) => {
        memoryFallback.set(k, v);
      },
    };
  };

  let activeToken: string | null = null;

  const loadDb = (): LocalDbState => {
    const store = getStorage();
    try {
      const raw = store.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as LocalDbState;
        parsed.spotlights = (parsed.spotlights ?? []).map((s) => ({
          ...s,
          isDemo: Boolean(s.isDemo || isDemoEntityId(s.id)),
        }));
        parsed.users = (parsed.users ?? []).map((u) => ({
          ...u,
          isDemo: Boolean(u.isDemo || isDemoEntityId(u.id)),
        }));
        return parsed;
      }
    } catch {
      // Recover cleanly with fresh seed data if storage is corrupted
    }
    const seeded = createSeedLocalDb();
    store.setItem(STORAGE_KEY, JSON.stringify(seeded));
    return seeded;
  };

  const saveDb = (db: LocalDbState): void => {
    getStorage().setItem(STORAGE_KEY, JSON.stringify(db));
  };

  const signLocalToken = (userId: string): string => `local.${userId}.${Date.now()}`;

  const requireActiveUser = (db: LocalDbState): StoredLocalUser => {
    if (!activeToken || !activeToken.startsWith('local.')) {
      throw new Error('Sessão não autenticada.');
    }
    const userId = activeToken.split('.')[1];
    const user = db.users.find((u) => u.id === userId);
    if (!user) {
      throw new Error('Conta não encontrada.');
    }
    return user;
  };

  const resolveOptionalUserId = (db: LocalDbState): string | undefined => {
    if (!activeToken || !activeToken.startsWith('local.')) {
      return undefined;
    }
    const userId = activeToken.split('.')[1];
    return db.users.some((u) => u.id === userId) ? userId : undefined;
  };

  const resolveUserRoleLabel = (u: StoredLocalUser): string => {
    const mode = u.skills[0]?.mode ?? 'Presencial e Remoto';
    const role = u.headline.trim() || u.skills[0]?.name || 'Membro ELO+';
    return `${role} · ${mode}`;
  };

  return {
    setToken(token: string | null): void {
      activeToken = token;
    },

    async login(email: string, password: string): Promise<AuthResponse> {
      const emailCheck = validateEmail(email);
      if (!emailCheck.valid) throw new Error(emailCheck.error);

      const db = loadDb();
      const normalized = email.trim().toLowerCase();
      const user = db.users.find((u) => u.email.toLowerCase() === normalized);
      if (!user || user.passwordDigest !== hashLocalPassword(normalized, password)) {
        throw new Error('E-mail ou senha incorretos.');
      }
      const token = signLocalToken(user.id);
      activeToken = token;
      return { token, user: sanitizeLocalUser(user) };
    },

    async register(payload: {
      name: string;
      email: string;
      password: string;
      confirmPassword: string;
      acceptedTerms: boolean;
    }): Promise<AuthResponse> {
      const check = validateRegistration(payload);
      if (!check.valid) throw new Error(check.error);

      const db = loadDb();
      const normalized = payload.email.trim().toLowerCase();
      if (db.users.some((u) => u.email.toLowerCase() === normalized)) {
        throw new Error('Este e-mail já está cadastrado.');
      }

      const fullName = payload.name.trim();
      const newUser: StoredLocalUser = {
        id: makeId('user'),
        displayName: extractFirstName(fullName),
        fullName,
        email: normalized,
        age: 0,
        headline: '',
        bio: '',
        locationLabel: '',
        avatarUrl: '',
        coverUrl: '',
        rating: 5,
        skills: [],
        desiredSkills: [],
        featuredWorks: [],
        settings: {
          language: 'pt-BR',
          darkMode: false,
          maxDistanceKm: 25,
          notificationsEmail: true,
          notificationsPush: true,
          notificationsMessages: true,
          notificationsProposals: true,
          notificationsReminders: true,
          privacyPublicProfile: true,
          privacyShowEmail: true,
          privacyAllowMessages: true,
        },
        createdAt: new Date().toISOString(),
        passwordDigest: hashLocalPassword(normalized, payload.password),
      };

      db.users.push(newUser);
      db.conversationsByUser[newUser.id] = [];
      db.exchangesByUser[newUser.id] = [];
      db.notificationsByUser[newUser.id] = [];
      saveDb(db);

      const token = signLocalToken(newUser.id);
      activeToken = token;
      return { token, user: sanitizeLocalUser(newUser), isNewUser: true };
    },

    async googleSignIn(email: string, name: string): Promise<AuthResponse> {
      const emailCheck = validateEmail(email || '');
      if (!emailCheck.valid) {
        throw new Error(emailCheck.error || 'Informe um e-mail Google válido.');
      }
      const normalized = email.trim().toLowerCase();
      const fullName = name.trim();
      if (fullName.length < 2) {
        throw new Error('Informe seu nome completo para conectar com o Google.');
      }

      const db = loadDb();
      let user = db.users.find((u) => u.email.toLowerCase() === normalized);
      let isNewUser = false;
      if (!user) {
        isNewUser = true;
        user = {
          id: makeId('user'),
          displayName: extractFirstName(fullName),
          fullName,
          email: normalized,
          age: 0,
          headline: '',
          bio: '',
          locationLabel: '',
          avatarUrl: '',
          coverUrl: '',
          rating: 5,
          skills: [],
          desiredSkills: [],
          featuredWorks: [],
          settings: {
            language: 'pt-BR',
            darkMode: false,
            maxDistanceKm: 25,
            notificationsEmail: true,
            notificationsPush: true,
            notificationsMessages: true,
            notificationsProposals: true,
            notificationsReminders: true,
            privacyPublicProfile: true,
            privacyShowEmail: true,
            privacyAllowMessages: true,
          },
          createdAt: new Date().toISOString(),
          passwordDigest: hashLocalPassword(normalized, makeId('gpass')),
        };
        db.users.push(user);
        db.conversationsByUser[user.id] = [];
        db.exchangesByUser[user.id] = [];
        db.notificationsByUser[user.id] = [];
        saveDb(db);
      }
      const token = signLocalToken(user.id);
      activeToken = token;
      return { token, user: sanitizeLocalUser(user), isNewUser };
    },

    async forgotPassword(identifier: string): Promise<ForgotPasswordResponse> {
      const trimmed = identifier.trim().toLowerCase();
      if (!trimmed) throw new Error('Informe seu nome ou e-mail cadastrado.');

      const db = loadDb();
      const user = db.users.find(
        (u) =>
          u.email.toLowerCase() === trimmed ||
          u.displayName.toLowerCase() === trimmed ||
          u.fullName.toLowerCase() === trimmed,
      );
      if (!user) throw new Error('Nenhuma conta encontrada com esse nome ou e-mail.');

      const code = String(1000 + Math.floor(Math.random() * 9000));
      db.otpChallenges[user.email.toLowerCase()] = {
        email: user.email.toLowerCase(),
        code,
        expiresAt: Date.now() + 10 * 60 * 1000,
        verified: false,
        attempts: 0,
      };
      saveDb(db);

      return {
        message: 'Código de validação enviado para o e-mail cadastrado.',
        emailMasked: maskEmailAddress(user.email),
        devPreviewCode: code,
      };
    },

    async verifyOtp(identifier: string, digits: string[]): Promise<{ verified: boolean; email: string }> {
      const otpCheck = validateOtpCode(digits);
      if (!otpCheck.valid) throw new Error(otpCheck.error);

      const db = loadDb();
      const trimmed = identifier.trim().toLowerCase();
      const user = db.users.find(
        (u) =>
          u.email.toLowerCase() === trimmed ||
          u.displayName.toLowerCase() === trimmed ||
          u.fullName.toLowerCase() === trimmed,
      );
      if (!user) throw new Error('Conta não encontrada.');

      const challenge = db.otpChallenges[user.email.toLowerCase()];
      if (!challenge || challenge.expiresAt < Date.now()) {
        throw new Error('Código expirado. Solicite um novo código.');
      }
      if (challenge.attempts >= 5) {
        throw new Error('Muitas tentativas. Solicite um novo código.');
      }

      const code = digits.map((d) => d.trim()).join('');
      if (code !== challenge.code) {
        challenge.attempts += 1;
        saveDb(db);
        throw new Error('Código inválido. Verifique os 4 dígitos.');
      }

      challenge.verified = true;
      saveDb(db);
      return { verified: true, email: user.email };
    },

    async resetPassword(
      identifier: string,
      password: string,
      confirmPassword: string,
    ): Promise<{ message: string }> {
      const check = validateNewPassword(password, confirmPassword);
      if (!check.valid) throw new Error(check.error);

      const db = loadDb();
      const trimmed = identifier.trim().toLowerCase();
      const user = db.users.find(
        (u) =>
          u.email.toLowerCase() === trimmed ||
          u.displayName.toLowerCase() === trimmed ||
          u.fullName.toLowerCase() === trimmed,
      );
      if (!user) throw new Error('Conta não encontrada.');

      const challenge = db.otpChallenges[user.email.toLowerCase()];
      if (!challenge || !challenge.verified || challenge.expiresAt < Date.now()) {
        throw new Error('Validação de identidade pendente ou expirada.');
      }

      user.passwordDigest = hashLocalPassword(user.email, password);
      delete db.otpChallenges[user.email.toLowerCase()];
      saveDb(db);
      return { message: 'Senha atualizada com sucesso.' };
    },

    async getMe(): Promise<{ user: UserProfile }> {
      const db = loadDb();
      const user = requireActiveUser(db);
      return { user: sanitizeLocalUser(user) };
    },

    async discover(
      q = '',
      category: CategorySlug | 'all' = 'all',
      mode: 'all' | 'Presencial' | 'Remoto' = 'all',
    ): Promise<DiscoverResponse> {
      const db = loadDb();
      const viewerId = resolveOptionalUserId(db);
      const directorySpotlights = buildDiscoverSpotlights(
        db.users.map(sanitizeLocalUser),
        db.spotlights,
        viewerId,
      );
      return {
        categories: db.categories,
        spotlights: filterCreatorsByCategoryAndQuery(directorySpotlights, category, q, mode),
      };
    },

    async updateProfile(payload: {
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
    }): Promise<{ user: UserProfile }> {
      const db = loadDb();
      const user = requireActiveUser(db);

      if (typeof payload.fullName === 'string' && payload.fullName.trim().length >= 2) {
        user.fullName = payload.fullName.trim();
        user.displayName =
          typeof payload.displayName === 'string' && payload.displayName.trim()
            ? payload.displayName.trim()
            : extractFirstName(user.fullName);
      }
      if (typeof payload.email === 'string' && validateEmail(payload.email).valid) {
        const normalized = payload.email.trim().toLowerCase();
        if (db.users.some((u) => u.id !== user.id && u.email.toLowerCase() === normalized)) {
          throw new Error('E-mail já utilizado por outra conta.');
        }
        user.email = normalized;
      }
      if (payload.age !== undefined) {
        const parsedAge = Number(payload.age);
        if (Number.isFinite(parsedAge) && parsedAge >= 13 && parsedAge <= 120) {
          user.age = Math.round(parsedAge);
        }
      }
      if (typeof payload.headline === 'string') {
        user.headline = payload.headline.trim().slice(0, 120);
      }
      if (typeof payload.bio === 'string') {
        user.bio = payload.bio.trim().slice(0, 500);
      }
      if (typeof payload.locationLabel === 'string') {
        user.locationLabel = payload.locationLabel.trim().slice(0, 100);
      }
      if (Array.isArray(payload.desiredSkills)) {
        user.desiredSkills = payload.desiredSkills
          .map((s) => String(s).trim())
          .filter(Boolean)
          .slice(0, 12);
      }
      if (typeof payload.avatarUrl === 'string') {
        user.avatarUrl = payload.avatarUrl.trim().slice(0, 500_000);
      }
      if (typeof payload.coverUrl === 'string') {
        user.coverUrl = payload.coverUrl.trim().slice(0, 500_000);
      }

      saveDb(db);
      return { user: sanitizeLocalUser(user) };
    },

    async addSkill(payload: {
      name: string;
      categoryId: CategorySlug;
      level: SkillItem['level'];
      mode?: SkillItem['mode'];
      description?: string;
    }): Promise<{ user: UserProfile }> {
      const trimmed = payload.name.trim();
      if (trimmed.length < 2) throw new Error('Informe o nome da habilidade.');

      const db = loadDb();
      const user = requireActiveUser(db);
      const duplicate = user.skills.some(
        (s) => s.name.toLowerCase() === trimmed.toLowerCase() && s.categoryId === payload.categoryId,
      );
      if (duplicate) {
        throw new Error('Você já possui essa habilidade nessa categoria.');
      }

      user.skills.push({
        id: makeId('sk'),
        name: trimmed.slice(0, 45),
        categoryId: payload.categoryId,
        level: payload.level,
        mode: payload.mode ?? 'Presencial e Remoto',
        description: (payload.description ?? '').trim().slice(0, 225),
      });
      saveDb(db);
      return { user: sanitizeLocalUser(user) };
    },

    async removeSkill(skillId: string): Promise<{ user: UserProfile }> {
      const db = loadDb();
      const user = requireActiveUser(db);
      user.skills = user.skills.filter((s) => s.id !== skillId);
      saveDb(db);
      return { user: sanitizeLocalUser(user) };
    },

    async addFeaturedWork(payload: {
      title: string;
      category: string;
      description: string;
    }): Promise<{ user: UserProfile }> {
      if (payload.title.trim().length < 3) {
        throw new Error('Informe um título para o trabalho.');
      }
      const db = loadDb();
      const user = requireActiveUser(db);
      const isVisual = ['Desenho', 'Ilustração', 'Música', 'Escrita'].includes(payload.category);
      user.featuredWorks.unshift({
        id: makeId('fw'),
        title: payload.title.trim().slice(0, 80),
        authorName: user.fullName,
        category: payload.category,
        rating: 5,
        maxRating: 5,
        imageUrl: isVisual
          ? './src/assets/images/work_design_1795444433532.jpg'
          : './src/assets/images/work_webdev_1795444434086.jpg',
        description: payload.description.trim().slice(0, 240) || 'Serviço colaborativo publicado na ELO+.',
        createdAt: new Date().toISOString(),
      });
      saveDb(db);
      return { user: sanitizeLocalUser(user) };
    },

    async getExchanges(): Promise<{ exchanges: ExchangeProposal[] }> {
      const db = loadDb();
      const user = requireActiveUser(db);
      return { exchanges: db.exchangesByUser[user.id] ?? [] };
    },

    async createExchange(payload: {
      receiverId: string;
      offeredSkill: string;
      requestedSkill: string;
      mode: 'Presencial' | 'Remoto';
      scheduledDate: string;
      location: string;
      notes: string;
    }): Promise<{
      exchange: ExchangeProposal;
      exchanges: ExchangeProposal[];
      notifications: NotificationItem[];
    }> {
      const db = loadDb();
      const user = requireActiveUser(db);
      const check = validateExchangeProposal({
        offeredSkill: payload.offeredSkill,
        requestedSkill: payload.requestedSkill,
        scheduledDate: payload.scheduledDate,
        location: payload.location,
        userSkillCount: user.skills.length,
      });
      if (!check.valid) throw new Error(check.error);

      if (payload.receiverId === user.id) {
        throw new Error('Você não pode propor uma troca para si mesmo.');
      }

      const recipientUser = db.users.find((u) => u.id === payload.receiverId);
      const creator = recipientUser ? undefined : db.spotlights.find((c) => c.id === payload.receiverId);
      if (!recipientUser && !creator) throw new Error('Prestador não encontrado.');

      const receiverName = recipientUser ? recipientUser.displayName : creator!.displayName;
      const receiverAvatarUrl = normalizeAssetUrl(
        recipientUser ? recipientUser.avatarUrl : creator!.avatarUrl,
      );

      const now = new Date().toISOString();
      const proposal: ExchangeProposal = {
        id: makeId('ex'),
        proposerId: user.id,
        proposerName: user.displayName,
        proposerAvatarUrl: normalizeAssetUrl(user.avatarUrl),
        receiverId: recipientUser ? recipientUser.id : creator!.id,
        receiverName,
        receiverAvatarUrl,
        offeredSkill: payload.offeredSkill.trim(),
        requestedSkill: payload.requestedSkill.trim(),
        mode: payload.mode === 'Remoto' ? 'Remoto' : 'Presencial',
        scheduledDate: payload.scheduledDate.trim(),
        location: payload.location.trim().slice(0, 160),
        notes: payload.notes.trim().slice(0, 320),
        status: 'PENDENTE',
        lastUpdatedBy: user.id,
        reviews: [],
        createdAt: now,
        updatedAt: now,
      };

      const userExchanges = db.exchangesByUser[user.id] ?? [];
      userExchanges.unshift(proposal);
      db.exchangesByUser[user.id] = userExchanges;

      const notifications = db.notificationsByUser[user.id] ?? [];
      notifications.unshift({
        id: makeId('notif'),
        title: 'Proposta de troca enviada',
        content: `Você propôs trocar "${proposal.offeredSkill}" por "${proposal.requestedSkill}" com ${receiverName}.`,
        type: 'PROPOSTA_TROCA',
        read: false,
        createdAt: now,
      });
      db.notificationsByUser[user.id] = notifications;

      if (recipientUser) {
        const recipientExchanges = db.exchangesByUser[recipientUser.id] ?? [];
        recipientExchanges.unshift({ ...proposal, reviews: [] });
        db.exchangesByUser[recipientUser.id] = recipientExchanges;

        if (recipientUser.settings.notificationsProposals !== false) {
          const recipientNotifs = db.notificationsByUser[recipientUser.id] ?? [];
          recipientNotifs.unshift({
            id: makeId('notif'),
            title: `Nova proposta de ${user.displayName}`,
            content: `${user.displayName} propôs trocar "${proposal.offeredSkill}" por "${proposal.requestedSkill}".`,
            type: 'PROPOSTA_TROCA',
            read: false,
            createdAt: now,
          });
          db.notificationsByUser[recipientUser.id] = recipientNotifs;
        }
      }

      saveDb(db);
      return { exchange: proposal, exchanges: userExchanges, notifications };
    },

    async respondExchange(
      id: string,
      payload: {
        action: 'accept' | 'decline' | 'counter' | 'complete';
        scheduledDate?: string;
        location?: string;
        offeredSkill?: string;
        notes?: string;
      },
    ): Promise<{
      exchange: ExchangeProposal;
      exchanges: ExchangeProposal[];
      notifications: NotificationItem[];
    }> {
      const db = loadDb();
      const user = requireActiveUser(db);
      const list = db.exchangesByUser[user.id] ?? [];
      const target = list.find((ex) => ex.id === id);
      if (!target) throw new Error('Proposta de troca não encontrada.');

      const statusMap: Record<string, ExchangeStatus> = {
        accept: 'CONFIRMADA',
        decline: 'CANCELADA',
        counter: 'CONTRAPROPOSTA',
        complete: 'CONCLUIDA',
      };
      const nextStatus = statusMap[payload.action];
      if (!nextStatus) throw new Error('Ação de negociação inválida.');

      target.status = nextStatus;
      target.lastUpdatedBy = user.id;
      target.updatedAt = new Date().toISOString();

      if (nextStatus === 'CONTRAPROPOSTA') {
        if (payload.scheduledDate?.trim()) target.scheduledDate = payload.scheduledDate.trim();
        if (payload.location?.trim()) target.location = payload.location.trim().slice(0, 160);
        if (payload.offeredSkill?.trim()) target.offeredSkill = payload.offeredSkill.trim();
        if (payload.notes?.trim()) target.notes = payload.notes.trim().slice(0, 320);
      }

      const notifTitle =
        nextStatus === 'CONFIRMADA'
          ? 'Troca confirmada!'
          : nextStatus === 'CONTRAPROPOSTA'
            ? 'Contraproposta registrada'
            : nextStatus === 'CONCLUIDA'
              ? 'Troca concluída — avalie a experiência'
              : 'Agendamento cancelado';

      const notifications = db.notificationsByUser[user.id] ?? [];
      notifications.unshift({
        id: makeId('notif'),
        title: notifTitle,
        content: `${target.offeredSkill} ↔ ${target.requestedSkill} (${target.location})`,
        type: 'AGENDAMENTO',
        read: false,
        createdAt: target.updatedAt,
      });
      db.notificationsByUser[user.id] = notifications;

      const counterpartId = target.proposerId === user.id ? target.receiverId : target.proposerId;
      const counterpartUser = db.users.find((u) => u.id === counterpartId);
      if (counterpartUser) {
        const counterpartList = db.exchangesByUser[counterpartUser.id] ?? [];
        const mirror = counterpartList.find((ex) => ex.id === id);
        if (mirror) {
          mirror.status = target.status;
          mirror.lastUpdatedBy = target.lastUpdatedBy;
          mirror.updatedAt = target.updatedAt;
          mirror.scheduledDate = target.scheduledDate;
          mirror.location = target.location;
          mirror.offeredSkill = target.offeredSkill;
          mirror.notes = target.notes;
        } else {
          counterpartList.unshift({ ...target, reviews: [...target.reviews] });
          db.exchangesByUser[counterpartUser.id] = counterpartList;
        }

        if (counterpartUser.settings.notificationsProposals !== false) {
          const counterpartNotifs = db.notificationsByUser[counterpartUser.id] ?? [];
          counterpartNotifs.unshift({
            id: makeId('notif'),
            title: `${notifTitle} (${user.displayName})`,
            content: `${target.offeredSkill} ↔ ${target.requestedSkill} (${target.location})`,
            type: 'AGENDAMENTO',
            read: false,
            createdAt: target.updatedAt,
          });
          db.notificationsByUser[counterpartUser.id] = counterpartNotifs;
        }
      }

      saveDb(db);
      return { exchange: target, exchanges: list, notifications };
    },

    async reviewExchange(
      id: string,
      payload: { rating: number; comment: string },
    ): Promise<{ exchange: ExchangeProposal; exchanges: ExchangeProposal[] }> {
      const db = loadDb();
      const user = requireActiveUser(db);
      const list = db.exchangesByUser[user.id] ?? [];
      const target = list.find((ex) => ex.id === id);
      if (!target) throw new Error('Troca não encontrada.');

      target.status = 'CONCLUIDA';
      const reviewEntry = {
        reviewerId: user.id,
        reviewerName: user.displayName,
        rating: Math.min(5, Math.max(1, Number(payload.rating) || 5)),
        comment: payload.comment.trim().slice(0, 255) || 'Excelente colaboração na ELO+!',
        createdAt: new Date().toISOString(),
      };
      target.reviews.push(reviewEntry);

      const counterpartId = target.proposerId === user.id ? target.receiverId : target.proposerId;
      const counterpartUser = db.users.find((u) => u.id === counterpartId);
      if (counterpartUser) {
        const counterpartList = db.exchangesByUser[counterpartUser.id] ?? [];
        const mirror = counterpartList.find((ex) => ex.id === id);
        if (mirror) {
          mirror.status = 'CONCLUIDA';
          mirror.reviews.push(reviewEntry);
        }
        const receivedRatings = counterpartList.flatMap((ex) =>
          ex.reviews.filter((r) => r.reviewerId !== counterpartUser.id).map((r) => r.rating),
        );
        if (receivedRatings.length > 0) {
          const avg = receivedRatings.reduce((sum, n) => sum + n, 0) / receivedRatings.length;
          counterpartUser.rating = Number(avg.toFixed(1));
        }
      }

      saveDb(db);
      return { exchange: target, exchanges: list };
    },

    async getNotifications(): Promise<{ notifications: NotificationItem[] }> {
      const db = loadDb();
      const user = requireActiveUser(db);
      return { notifications: db.notificationsByUser[user.id] ?? [] };
    },

    async markNotificationsRead(): Promise<{ notifications: NotificationItem[] }> {
      const db = loadDb();
      const user = requireActiveUser(db);
      const list = db.notificationsByUser[user.id] ?? [];
      for (const item of list) item.read = true;
      saveDb(db);
      return { notifications: list };
    },

    async updateSettings(updates: Partial<UserSettings>): Promise<{ user: UserProfile }> {
      const db = loadDb();
      const user = requireActiveUser(db);
      user.settings = {
        ...user.settings,
        ...(updates.language === 'pt-BR' || updates.language === 'en-US'
          ? { language: updates.language }
          : {}),
        ...(typeof updates.darkMode === 'boolean' ? { darkMode: updates.darkMode } : {}),
        ...(typeof updates.maxDistanceKm === 'number' &&
        updates.maxDistanceKm >= 1 &&
        updates.maxDistanceKm <= 200
          ? { maxDistanceKm: Math.round(updates.maxDistanceKm) }
          : {}),
        ...(typeof updates.notificationsEmail === 'boolean'
          ? { notificationsEmail: updates.notificationsEmail }
          : {}),
        ...(typeof updates.notificationsPush === 'boolean'
          ? { notificationsPush: updates.notificationsPush }
          : {}),
        ...(typeof updates.notificationsMessages === 'boolean'
          ? { notificationsMessages: updates.notificationsMessages }
          : {}),
        ...(typeof updates.notificationsProposals === 'boolean'
          ? { notificationsProposals: updates.notificationsProposals }
          : {}),
        ...(typeof updates.notificationsReminders === 'boolean'
          ? { notificationsReminders: updates.notificationsReminders }
          : {}),
        ...(typeof updates.privacyPublicProfile === 'boolean'
          ? { privacyPublicProfile: updates.privacyPublicProfile }
          : {}),
        ...(typeof updates.privacyShowEmail === 'boolean'
          ? { privacyShowEmail: updates.privacyShowEmail }
          : {}),
        ...(typeof updates.privacyAllowMessages === 'boolean'
          ? { privacyAllowMessages: updates.privacyAllowMessages }
          : {}),
      };
      saveDb(db);
      return { user: sanitizeLocalUser(user) };
    },

    async submitSupportTicket(
      payload: SupportTicketPayload,
    ): Promise<{ message: string; ticketId: string }> {
      if (payload.subject.trim().length < 3 || payload.message.trim().length < 5) {
        throw new Error('Preencha o assunto e a descrição da dúvida.');
      }
      const db = loadDb();
      const user = requireActiveUser(db);
      const ticketId = makeId('tkt');
      db.supportTickets.push({
        id: ticketId,
        userId: user.id,
        subject: payload.subject.trim().slice(0, 120),
        message: payload.message.trim().slice(0, 1000),
        createdAt: new Date().toISOString(),
      });
      saveDb(db);
      return {
        message: 'Solicitação enviada com sucesso! Nossa equipe ELO+ responderá em breve.',
        ticketId,
      };
    },

    async deleteAccount(): Promise<{ deleted: boolean }> {
      const db = loadDb();
      const user = requireActiveUser(db);
      db.users = db.users.filter((u) => u.id !== user.id);
      delete db.conversationsByUser[user.id];
      delete db.exchangesByUser[user.id];
      delete db.notificationsByUser[user.id];
      saveDb(db);
      activeToken = null;
      return { deleted: true };
    },

    async getConversations(): Promise<{ conversations: ConversationThread[] }> {
      const db = loadDb();
      const user = requireActiveUser(db);
      return { conversations: db.conversationsByUser[user.id] ?? [] };
    },

    async sendMessage(
      participantId: string,
      text: string,
    ): Promise<{ conversation: ConversationThread; conversations: ConversationThread[] }> {
      const trimmed = text.trim();
      if (!trimmed) throw new Error('Digite uma mensagem antes de enviar.');

      const db = loadDb();
      const user = requireActiveUser(db);
      if (participantId === user.id) {
        throw new Error('Você não pode enviar mensagens para si mesmo.');
      }

      const recipientUser = db.users.find((u) => u.id === participantId);
      const creator = recipientUser ? undefined : db.spotlights.find((s) => s.id === participantId);
      if (!recipientUser && !creator) {
        throw new Error('Participante não encontrado.');
      }

      if (recipientUser && recipientUser.settings.privacyAllowMessages === false) {
        throw new Error('Este usuário desativou o recebimento de mensagens.');
      }

      const participantName = recipientUser ? recipientUser.displayName : creator!.displayName;
      const participantRole = recipientUser
        ? resolveUserRoleLabel(recipientUser)
        : `${creator!.roleTitle} · ${creator!.mode}`;
      const participantAvatar = normalizeAssetUrl(
        recipientUser ? recipientUser.avatarUrl : creator!.avatarUrl,
      );

      const now = new Date().toISOString();
      const message = {
        id: makeId('msg'),
        senderId: user.id,
        senderName: user.displayName,
        text: trimmed.slice(0, 600),
        sentAt: now,
      };

      const senderList = db.conversationsByUser[user.id] ?? [];
      let senderThread = senderList.find((c) => c.participantId === participantId);
      if (!senderThread) {
        senderThread = {
          id: makeId('conv'),
          participantId,
          participantName,
          participantRole,
          participantAvatarUrl: participantAvatar,
          unreadCount: 0,
          updatedAt: now,
          messages: [],
        };
        senderList.unshift(senderThread);
      } else {
        senderThread.participantName = participantName;
        senderThread.participantRole = participantRole;
        senderThread.participantAvatarUrl = participantAvatar;
      }
      senderThread.messages.push(message);
      senderThread.unreadCount = 0;
      senderThread.updatedAt = now;
      db.conversationsByUser[user.id] = [
        senderThread,
        ...senderList.filter((c) => c.participantId !== participantId),
      ];

      if (recipientUser) {
        const recipientList = db.conversationsByUser[recipientUser.id] ?? [];
        const senderRole = resolveUserRoleLabel(user);
        const senderAvatar = normalizeAssetUrl(user.avatarUrl);
        let recipientThread = recipientList.find((c) => c.participantId === user.id);
        if (!recipientThread) {
          recipientThread = {
            id: makeId('conv'),
            participantId: user.id,
            participantName: user.displayName,
            participantRole: senderRole,
            participantAvatarUrl: senderAvatar,
            unreadCount: 0,
            updatedAt: now,
            messages: [],
          };
          recipientList.unshift(recipientThread);
        } else {
          recipientThread.participantName = user.displayName;
          recipientThread.participantRole = senderRole;
          recipientThread.participantAvatarUrl = senderAvatar;
        }
        recipientThread.messages.push({ ...message });
        recipientThread.unreadCount = (recipientThread.unreadCount || 0) + 1;
        recipientThread.updatedAt = now;
        db.conversationsByUser[recipientUser.id] = [
          recipientThread,
          ...recipientList.filter((c) => c.participantId !== user.id),
        ];

        if (recipientUser.settings.notificationsMessages !== false) {
          const recipientNotifs = db.notificationsByUser[recipientUser.id] ?? [];
          recipientNotifs.unshift({
            id: makeId('notif'),
            title: `Nova mensagem de ${user.displayName}`,
            content: trimmed.slice(0, 120),
            type: 'MENSAGEM_CHAT',
            read: false,
            createdAt: now,
          });
          db.notificationsByUser[recipientUser.id] = recipientNotifs;
        }
      }

      saveDb(db);
      return { conversation: senderThread, conversations: db.conversationsByUser[user.id] };
    },

    async markConversationRead(
      participantId: string,
    ): Promise<{ conversations: ConversationThread[] }> {
      const db = loadDb();
      const user = requireActiveUser(db);
      const list = db.conversationsByUser[user.id] ?? [];
      const thread = list.find((c) => c.participantId === participantId);
      if (thread && thread.unreadCount > 0) {
        thread.unreadCount = 0;
        saveDb(db);
      }
      return { conversations: list };
    },
  };
}

export const localRuntime = createLocalRuntime();

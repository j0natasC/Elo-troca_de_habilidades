import express from 'express';
import path from 'node:path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import {
  generateFourDigitOtp,
  hashOtp,
  hashPassword,
  signAuthToken,
  verifyAuthToken,
  verifyPassword,
} from './server/auth';
import {
  createNewId,
  createSeedConversations,
  createSeedExchanges,
  createSeedNotifications,
  loadDatabase,
  sanitizeUser,
  saveDatabase,
  type StoredUser,
} from './server/store';
import { buildDiscoverSpotlights } from './src/shared/userDirectory';
import {
  extractFirstName,
  filterCreatorsByCategoryAndQuery,
  maskEmailAddress,
  validateEmail,
  validateExchangeProposal,
  validateNewPassword,
  validateOtpCode,
  validateRegistration,
} from './src/shared/validation';
import type {
  CategorySlug,
  ConversationThread,
  ExchangeProposal,
  ExchangeStatus,
  SkillItem,
  UserSettings,
} from './src/shared/types';

dotenv.config();

const PORT = Number(process.env.PORT || 3000);

interface AuthedRequest extends express.Request {
  authUser?: StoredUser;
}

function requireAuth(
  req: AuthedRequest,
  res: express.Response,
  next: express.NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sessão não autenticada.' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifyAuthToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Token inválido ou expirado.' });
    return;
  }

  const db = loadDatabase();
  const user = db.users.find((u) => u.id === payload.userId);
  if (!user) {
    res.status(401).json({ error: 'Conta não encontrada.' });
    return;
  }

  req.authUser = user;
  next();
}

function resolveOptionalViewerId(req: express.Request): string | undefined {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return undefined;
  const payload = verifyAuthToken(header.slice('Bearer '.length).trim());
  return payload?.userId;
}

function resolveUserRoleLabel(user: StoredUser): string {
  const mode = user.skills[0]?.mode ?? 'Presencial e Remoto';
  const role = user.headline.trim() || user.skills[0]?.name || 'Membro ELO+';
  return `${role} · ${mode}`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'UP',
      service: 'eloplus-api',
      timestamp: new Date().toISOString(),
    });
  });

  // POST /api/auth/register
  app.post('/api/auth/register', (req, res) => {
    const { name = '', email = '', password = '', confirmPassword = '', acceptedTerms = false } =
      req.body ?? {};

    const check = validateRegistration({
      name: String(name),
      email: String(email),
      password: String(password),
      confirmPassword: String(confirmPassword),
      acceptedTerms: Boolean(acceptedTerms),
    });

    if (!check.valid) {
      res.status(400).json({ error: check.error });
      return;
    }

    const db = loadDatabase();
    const normalizedEmail = String(email).trim().toLowerCase();
    const exists = db.users.some((u) => u.email.toLowerCase() === normalizedEmail);
    if (exists) {
      res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
      return;
    }

    const fullName = String(name).trim();
    const newUser: StoredUser = {
      id: createNewId('user'),
      displayName: extractFirstName(fullName),
      fullName,
      email: normalizedEmail,
      age: 18,
      headline: 'Novo membro da rede ELO+',
      bio: '',
      locationLabel: '',
      avatarUrl: '',
      coverUrl: '',
      rating: 5,
      passwordHash: hashPassword(String(password)),
      skills: [
        {
          id: createNewId('sk'),
          name: 'Programação',
          categoryId: 'programacao',
          level: 'Intermediário',
          mode: 'Presencial e Remoto',
        },
      ],
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
    };

    db.users.push(newUser);
    db.conversationsByUser[newUser.id] = [];
    db.exchangesByUser[newUser.id] = [];
    db.notificationsByUser[newUser.id] = [];
    saveDatabase(db);

    const token = signAuthToken(newUser.id, newUser.email);
    res.status(201).json({ token, user: sanitizeUser(newUser) });
  });

  // POST /api/auth/login
  app.post('/api/auth/login', (req, res) => {
    const { email = '', password = '' } = req.body ?? {};
    const emailCheck = validateEmail(String(email));
    if (!emailCheck.valid) {
      res.status(400).json({ error: emailCheck.error });
      return;
    }

    const db = loadDatabase();
    const normalizedEmail = String(email).trim().toLowerCase();
    const user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    if (!user || !verifyPassword(String(password), user.passwordHash)) {
      res.status(401).json({ error: 'E-mail ou senha incorretos.' });
      return;
    }

    const token = signAuthToken(user.id, user.email);
    res.json({ token, user: sanitizeUser(user) });
  });

  // POST /api/auth/google
  app.post('/api/auth/google', (req, res) => {
    const { email = '', name = '' } = req.body ?? {};
    const emailCheck = validateEmail(String(email));
    if (!emailCheck.valid) {
      res.status(400).json({ error: emailCheck.error || 'Informe um e-mail Google válido.' });
      return;
    }
    const fullName = String(name).trim();
    if (fullName.length < 2) {
      res.status(400).json({ error: 'Informe seu nome completo para conectar com o Google.' });
      return;
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const db = loadDatabase();
    let user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!user) {
      user = {
        id: createNewId('user'),
        displayName: extractFirstName(fullName),
        fullName,
        email: normalizedEmail,
        age: 18,
        headline: 'Membro verificado via Google · ELO+',
        bio: '',
        locationLabel: '',
        avatarUrl: '',
        coverUrl: '',
        rating: 5,
        passwordHash: hashPassword(createNewId('gpass')),
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
      };
      db.users.push(user);
      db.conversationsByUser[user.id] = [];
      db.exchangesByUser[user.id] = [];
      db.notificationsByUser[user.id] = [];
      saveDatabase(db);
    }

    const token = signAuthToken(user.id, user.email);
    res.json({ token, user: sanitizeUser(user) });
  });

  // POST /api/auth/forgot-password
  app.post('/api/auth/forgot-password', (req, res) => {
    const { identifier = '' } = req.body ?? {};
    const trimmed = String(identifier).trim();
    if (!trimmed) {
      res.status(400).json({ error: 'Informe seu nome ou e-mail cadastrado.' });
      return;
    }

    const db = loadDatabase();
    const user = db.users.find(
      (u) =>
        u.email.toLowerCase() === trimmed.toLowerCase() ||
        u.displayName.toLowerCase() === trimmed.toLowerCase() ||
        u.fullName.toLowerCase() === trimmed.toLowerCase(),
    );

    if (!user) {
      res.status(404).json({ error: 'Nenhuma conta encontrada com esse nome ou e-mail.' });
      return;
    }

    const code = generateFourDigitOtp();
    db.otpChallenges[user.email.toLowerCase()] = {
      email: user.email.toLowerCase(),
      codeHash: hashOtp(code),
      expiresAt: Date.now() + 10 * 60 * 1000,
      verified: false,
      attempts: 0,
    };
    saveDatabase(db);

    res.json({
      message: 'Código de validação enviado para o e-mail cadastrado.',
      emailMasked: maskEmailAddress(user.email),
      devPreviewCode: process.env.NODE_ENV === 'production' ? undefined : code,
    });
  });

  // POST /api/auth/verify-otp
  app.post('/api/auth/verify-otp', (req, res) => {
    const { identifier = '', digits = [] } = req.body ?? {};
    const otpCheck = validateOtpCode(Array.isArray(digits) ? digits.map(String) : []);
    if (!otpCheck.valid) {
      res.status(400).json({ error: otpCheck.error });
      return;
    }

    const db = loadDatabase();
    const trimmed = String(identifier).trim().toLowerCase();
    const user = db.users.find(
      (u) =>
        u.email.toLowerCase() === trimmed ||
        u.displayName.toLowerCase() === trimmed ||
        u.fullName.toLowerCase() === trimmed,
    );
    if (!user) {
      res.status(404).json({ error: 'Conta não encontrada.' });
      return;
    }

    const challenge = db.otpChallenges[user.email.toLowerCase()];
    if (!challenge || challenge.expiresAt < Date.now()) {
      res.status(400).json({ error: 'Código expirado. Solicite um novo código.' });
      return;
    }

    if (challenge.attempts >= 5) {
      res.status(429).json({ error: 'Muitas tentativas. Solicite um novo código.' });
      return;
    }

    const submittedCode = (digits as string[]).map((d) => String(d).trim()).join('');
    if (hashOtp(submittedCode) !== challenge.codeHash) {
      challenge.attempts += 1;
      saveDatabase(db);
      res.status(400).json({ error: 'Código inválido. Verifique os 4 dígitos.' });
      return;
    }

    challenge.verified = true;
    saveDatabase(db);
    res.json({ verified: true, email: user.email });
  });

  // POST /api/auth/reset-password
  app.post('/api/auth/reset-password', (req, res) => {
    const { identifier = '', password = '', confirmPassword = '' } = req.body ?? {};
    const passCheck = validateNewPassword(String(password), String(confirmPassword));
    if (!passCheck.valid) {
      res.status(400).json({ error: passCheck.error });
      return;
    }

    const db = loadDatabase();
    const trimmed = String(identifier).trim().toLowerCase();
    const user = db.users.find(
      (u) =>
        u.email.toLowerCase() === trimmed ||
        u.displayName.toLowerCase() === trimmed ||
        u.fullName.toLowerCase() === trimmed,
    );
    if (!user) {
      res.status(404).json({ error: 'Conta não encontrada.' });
      return;
    }

    const challenge = db.otpChallenges[user.email.toLowerCase()];
    if (!challenge || !challenge.verified || challenge.expiresAt < Date.now()) {
      res.status(403).json({ error: 'Validação de identidade pendente ou expirada.' });
      return;
    }

    user.passwordHash = hashPassword(String(password));
    delete db.otpChallenges[user.email.toLowerCase()];
    saveDatabase(db);

    res.json({ message: 'Senha atualizada com sucesso.' });
  });

  // GET /api/auth/me
  app.get('/api/auth/me', requireAuth, (req: AuthedRequest, res) => {
    res.json({ user: sanitizeUser(req.authUser!) });
  });

  // GET /api/discover
  app.get('/api/discover', (req, res) => {
    const q = String(req.query.q ?? '');
    const category = (String(req.query.category ?? 'all') || 'all') as CategorySlug | 'all';
    const mode = (String(req.query.mode ?? 'all') || 'all') as 'all' | 'Presencial' | 'Remoto';
    const viewerId = resolveOptionalViewerId(req);
    const db = loadDatabase();

    const directorySpotlights = buildDiscoverSpotlights(
      db.users.map(sanitizeUser),
      db.spotlights,
      viewerId,
    );
    const spotlights = filterCreatorsByCategoryAndQuery(directorySpotlights, category, q, mode);
    res.json({
      categories: db.categories,
      spotlights,
    });
  });

  // PUT /api/profile
  app.put('/api/profile', requireAuth, (req: AuthedRequest, res) => {
    const {
      fullName,
      displayName,
      email,
      age,
      headline,
      bio,
      locationLabel,
      desiredSkills,
      avatarUrl,
      coverUrl,
    } = req.body ?? {};
    const db = loadDatabase();
    const user = db.users.find((u) => u.id === req.authUser!.id);
    if (!user) {
      res.status(404).json({ error: 'Usuário não encontrado.' });
      return;
    }

    if (typeof fullName === 'string' && fullName.trim().length >= 2) {
      user.fullName = fullName.trim();
      user.displayName =
        typeof displayName === 'string' && displayName.trim()
          ? displayName.trim()
          : extractFirstName(user.fullName);
    }
    if (typeof email === 'string' && validateEmail(email).valid) {
      const normalized = email.trim().toLowerCase();
      const conflict = db.users.some(
        (u) => u.id !== user.id && u.email.toLowerCase() === normalized,
      );
      if (conflict) {
        res.status(409).json({ error: 'E-mail já utilizado por outra conta.' });
        return;
      }
      user.email = normalized;
    }
    if (age !== undefined) {
      const parsedAge = Number(age);
      if (Number.isFinite(parsedAge) && parsedAge >= 13 && parsedAge <= 120) {
        user.age = Math.round(parsedAge);
      }
    }
    if (typeof headline === 'string') {
      user.headline = headline.trim().slice(0, 120);
    }
    if (typeof bio === 'string') {
      user.bio = bio.trim().slice(0, 500);
    }
    if (typeof locationLabel === 'string') {
      user.locationLabel = locationLabel.trim().slice(0, 100);
    }
    if (Array.isArray(desiredSkills)) {
      user.desiredSkills = desiredSkills
        .map((s) => String(s).trim())
        .filter(Boolean)
        .slice(0, 12);
    }
    if (typeof avatarUrl === 'string') {
      user.avatarUrl = avatarUrl.trim().slice(0, 500_000);
    }
    if (typeof coverUrl === 'string') {
      user.coverUrl = coverUrl.trim().slice(0, 500_000);
    }

    saveDatabase(db);
    res.json({ user: sanitizeUser(user) });
  });

  // POST /api/profile/skills
  app.post('/api/profile/skills', requireAuth, (req: AuthedRequest, res) => {
    const {
      name = '',
      categoryId = 'programacao',
      level = 'Intermediário',
      mode = 'Presencial e Remoto',
      description = '',
    } = req.body ?? {};
    const trimmed = String(name).trim();
    if (trimmed.length < 2) {
      res.status(400).json({ error: 'Informe o nome da habilidade.' });
      return;
    }

    const db = loadDatabase();
    const user = db.users.find((u) => u.id === req.authUser!.id)!;
    // RN-AGE-02: Evitar duplicidade de título e categoria
    const duplicate = user.skills.some(
      (s) => s.name.toLowerCase() === trimmed.toLowerCase() && s.categoryId === categoryId,
    );
    if (duplicate) {
      res.status(409).json({ error: 'Você já possui essa habilidade nessa categoria.' });
      return;
    }

    const newSkill: SkillItem = {
      id: createNewId('sk'),
      name: trimmed.slice(0, 45),
      categoryId: categoryId as CategorySlug,
      level: level as SkillItem['level'],
      mode: mode as SkillItem['mode'],
      description: String(description).trim().slice(0, 225),
    };

    user.skills.push(newSkill);
    saveDatabase(db);
    res.status(201).json({ user: sanitizeUser(user) });
  });

  // DELETE /api/profile/skills/:skillId
  app.delete('/api/profile/skills/:skillId', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const user = db.users.find((u) => u.id === req.authUser!.id)!;
    user.skills = user.skills.filter((s) => s.id !== req.params.skillId);
    saveDatabase(db);
    res.json({ user: sanitizeUser(user) });
  });

  // POST /api/profile/works
  app.post('/api/profile/works', requireAuth, (req: AuthedRequest, res) => {
    const { title = '', category = 'Programação', description = '' } = req.body ?? {};
    if (String(title).trim().length < 3) {
      res.status(400).json({ error: 'Informe um título para o trabalho.' });
      return;
    }

    const db = loadDatabase();
    const user = db.users.find((u) => u.id === req.authUser!.id)!;
    const isVisual = ['Desenho', 'Ilustração', 'Música', 'Escrita'].includes(String(category));
    user.featuredWorks.unshift({
      id: createNewId('fw'),
      title: String(title).trim().slice(0, 80),
      authorName: user.fullName,
      category: String(category),
      rating: 5,
      maxRating: 5,
      imageUrl: isVisual
        ? './src/assets/images/work_design_1795444433532.jpg'
        : './src/assets/images/work_webdev_1795444434086.jpg',
      description: String(description).trim().slice(0, 240) || 'Serviço colaborativo publicado na ELO+.',
      createdAt: new Date().toISOString(),
    });
    saveDatabase(db);
    res.status(201).json({ user: sanitizeUser(user) });
  });

  // GET /api/exchanges
  app.get('/api/exchanges', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const list = db.exchangesByUser[req.authUser!.id] ?? [];
    res.json({ exchanges: list });
  });

  // POST /api/exchanges (Propor troca com data, local, modalidade e habilidade ofertada)
  app.post('/api/exchanges', requireAuth, (req: AuthedRequest, res) => {
    const {
      receiverId = '',
      offeredSkill = '',
      requestedSkill = '',
      mode = 'Presencial',
      scheduledDate = '',
      location = '',
      notes = '',
    } = req.body ?? {};

    const db = loadDatabase();
    const user = req.authUser!;
    const check = validateExchangeProposal({
      offeredSkill: String(offeredSkill),
      requestedSkill: String(requestedSkill),
      scheduledDate: String(scheduledDate),
      location: String(location),
      userSkillCount: user.skills.length,
    });
    if (!check.valid) {
      res.status(400).json({ error: check.error });
      return;
    }

    if (String(receiverId) === user.id) {
      res.status(400).json({ error: 'Você não pode propor uma troca para si mesmo.' });
      return;
    }

    const recipientUser = db.users.find((u) => u.id === String(receiverId));
    const creator = recipientUser ? undefined : db.spotlights.find((c) => c.id === String(receiverId));
    if (!recipientUser && !creator) {
      res.status(404).json({ error: 'Prestador não encontrado.' });
      return;
    }

    const receiverName = recipientUser ? recipientUser.displayName : creator!.displayName;
    const receiverAvatarUrl = recipientUser ? recipientUser.avatarUrl : creator!.avatarUrl;

    const now = new Date().toISOString();
    const proposal: ExchangeProposal = {
      id: createNewId('ex'),
      proposerId: user.id,
      proposerName: user.displayName,
      proposerAvatarUrl: user.avatarUrl,
      receiverId: recipientUser ? recipientUser.id : creator!.id,
      receiverName,
      receiverAvatarUrl,
      offeredSkill: String(offeredSkill).trim(),
      requestedSkill: String(requestedSkill).trim(),
      mode: mode === 'Remoto' ? 'Remoto' : 'Presencial',
      scheduledDate: String(scheduledDate).trim(),
      location: String(location).trim().slice(0, 160),
      notes: String(notes).trim().slice(0, 320),
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
      id: createNewId('notif'),
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
          id: createNewId('notif'),
          title: `Nova proposta de ${user.displayName}`,
          content: `${user.displayName} propôs trocar "${proposal.offeredSkill}" por "${proposal.requestedSkill}".`,
          type: 'PROPOSTA_TROCA',
          read: false,
          createdAt: now,
        });
        db.notificationsByUser[recipientUser.id] = recipientNotifs;
      }
    }

    saveDatabase(db);
    res.status(201).json({ exchange: proposal, exchanges: userExchanges, notifications });
  });

  // POST /api/exchanges/:id/respond (Aceitar, Recusar, Contraproposta, Concluir)
  app.post('/api/exchanges/:id/respond', requireAuth, (req: AuthedRequest, res) => {
    const { action = '', scheduledDate, location, offeredSkill, notes } = req.body ?? {};
    const db = loadDatabase();
    const user = req.authUser!;
    const list = db.exchangesByUser[user.id] ?? [];
    const target = list.find((ex) => ex.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Proposta de troca não encontrada.' });
      return;
    }

    const statusMap: Record<string, ExchangeStatus> = {
      accept: 'CONFIRMADA',
      decline: 'CANCELADA',
      counter: 'CONTRAPROPOSTA',
      complete: 'CONCLUIDA',
    };
    const nextStatus = statusMap[String(action)];
    if (!nextStatus) {
      res.status(400).json({ error: 'Ação de negociação inválida.' });
      return;
    }

    target.status = nextStatus;
    target.lastUpdatedBy = user.id;
    target.updatedAt = new Date().toISOString();

    if (nextStatus === 'CONTRAPROPOSTA') {
      if (typeof scheduledDate === 'string' && scheduledDate.trim()) {
        target.scheduledDate = scheduledDate.trim();
      }
      if (typeof location === 'string' && location.trim()) {
        target.location = location.trim().slice(0, 160);
      }
      if (typeof offeredSkill === 'string' && offeredSkill.trim()) {
        target.offeredSkill = offeredSkill.trim();
      }
      if (typeof notes === 'string' && notes.trim()) {
        target.notes = notes.trim().slice(0, 320);
      }
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
      id: createNewId('notif'),
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
      const mirror = counterpartList.find((ex) => ex.id === req.params.id);
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
          id: createNewId('notif'),
          title: `${notifTitle} (${user.displayName})`,
          content: `${target.offeredSkill} ↔ ${target.requestedSkill} (${target.location})`,
          type: 'AGENDAMENTO',
          read: false,
          createdAt: target.updatedAt,
        });
        db.notificationsByUser[counterpartUser.id] = counterpartNotifs;
      }
    }

    saveDatabase(db);
    res.json({ exchange: target, exchanges: list, notifications });
  });

  // POST /api/exchanges/:id/review
  app.post('/api/exchanges/:id/review', requireAuth, (req: AuthedRequest, res) => {
    const { rating = 5, comment = '' } = req.body ?? {};
    const numRating = Math.min(5, Math.max(1, Number(rating) || 5));
    const db = loadDatabase();
    const user = req.authUser!;
    const list = db.exchangesByUser[user.id] ?? [];
    const target = list.find((ex) => ex.id === req.params.id);
    if (!target) {
      res.status(404).json({ error: 'Troca não encontrada.' });
      return;
    }

    target.status = 'CONCLUIDA';
    const reviewEntry = {
      reviewerId: user.id,
      reviewerName: user.displayName,
      rating: numRating,
      comment: String(comment).trim().slice(0, 255) || 'Excelente colaboração na ELO+!',
      createdAt: new Date().toISOString(),
    };
    target.reviews.push(reviewEntry);

    const counterpartId = target.proposerId === user.id ? target.receiverId : target.proposerId;
    const counterpartUser = db.users.find((u) => u.id === counterpartId);
    if (counterpartUser) {
      const counterpartList = db.exchangesByUser[counterpartUser.id] ?? [];
      const mirror = counterpartList.find((ex) => ex.id === req.params.id);
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

    saveDatabase(db);
    res.json({ exchange: target, exchanges: list });
  });

  // GET /api/notifications & POST /api/notifications/read-all
  app.get('/api/notifications', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const notifications = db.notificationsByUser[req.authUser!.id] ?? [];
    res.json({ notifications });
  });

  app.post('/api/notifications/read-all', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const list = db.notificationsByUser[req.authUser!.id] ?? [];
    for (const item of list) {
      item.read = true;
    }
    saveDatabase(db);
    res.json({ notifications: list });
  });

  // PUT /api/settings
  app.put('/api/settings', requireAuth, (req: AuthedRequest, res) => {
    const updates = (req.body ?? {}) as Partial<UserSettings>;
    const db = loadDatabase();
    const user = db.users.find((u) => u.id === req.authUser!.id)!;

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

    saveDatabase(db);
    res.json({ user: sanitizeUser(user) });
  });

  // POST /api/support
  app.post('/api/support', requireAuth, (req: AuthedRequest, res) => {
    const { subject = '', message = '' } = req.body ?? {};
    if (String(subject).trim().length < 3 || String(message).trim().length < 5) {
      res.status(400).json({ error: 'Preencha o assunto e a descrição da dúvida.' });
      return;
    }

    const db = loadDatabase();
    const ticket = {
      id: createNewId('tkt'),
      userId: req.authUser!.id,
      userEmail: req.authUser!.email,
      subject: String(subject).trim().slice(0, 120),
      message: String(message).trim().slice(0, 1000),
      createdAt: new Date().toISOString(),
    };
    db.supportTickets.push(ticket);
    saveDatabase(db);

    res.status(201).json({
      message: 'Solicitação enviada com sucesso! Nossa equipe ELO+ responderá em breve.',
      ticketId: ticket.id,
    });
  });

  // DELETE /api/account
  app.delete('/api/account', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const userId = req.authUser!.id;
    db.users = db.users.filter((u) => u.id !== userId);
    delete db.conversationsByUser[userId];
    delete db.exchangesByUser[userId];
    delete db.notificationsByUser[userId];
    saveDatabase(db);
    res.json({ deleted: true });
  });

  // GET /api/messages/conversations
  app.get('/api/messages/conversations', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const userId = req.authUser!.id;
    const conversations = db.conversationsByUser[userId] ?? [];
    res.json({ conversations });
  });

  // POST /api/messages/conversations/:participantId/send
  app.post('/api/messages/conversations/:participantId/send', requireAuth, (req: AuthedRequest, res) => {
    const { text = '' } = req.body ?? {};
    const trimmed = String(text).trim();
    if (!trimmed) {
      res.status(400).json({ error: 'Digite uma mensagem antes de enviar.' });
      return;
    }

    const db = loadDatabase();
    const user = req.authUser!;
    const participantId = req.params.participantId;
    if (participantId === user.id) {
      res.status(400).json({ error: 'Você não pode enviar mensagens para si mesmo.' });
      return;
    }

    const recipientUser = db.users.find((u) => u.id === participantId);
    const creator = recipientUser ? undefined : db.spotlights.find((s) => s.id === participantId);
    if (!recipientUser && !creator) {
      res.status(404).json({ error: 'Participante não encontrado.' });
      return;
    }

    if (recipientUser && recipientUser.settings.privacyAllowMessages === false) {
      res.status(403).json({ error: 'Este usuário desativou o recebimento de mensagens.' });
      return;
    }

    const participantName = recipientUser ? recipientUser.displayName : creator!.displayName;
    const participantRole = recipientUser
      ? resolveUserRoleLabel(recipientUser)
      : `${creator!.roleTitle} · ${creator!.mode}`;
    const participantAvatar = recipientUser ? recipientUser.avatarUrl : creator!.avatarUrl;

    const now = new Date().toISOString();
    const message = {
      id: createNewId('msg'),
      senderId: user.id,
      senderName: user.displayName,
      text: trimmed.slice(0, 600),
      sentAt: now,
    };

    const senderList = db.conversationsByUser[user.id] ?? [];
    let senderThread: ConversationThread | undefined = senderList.find(
      (c) => c.participantId === participantId,
    );
    if (!senderThread) {
      senderThread = {
        id: createNewId('conv'),
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
      let recipientThread = recipientList.find((c) => c.participantId === user.id);
      if (!recipientThread) {
        recipientThread = {
          id: createNewId('conv'),
          participantId: user.id,
          participantName: user.displayName,
          participantRole: senderRole,
          participantAvatarUrl: user.avatarUrl,
          unreadCount: 0,
          updatedAt: now,
          messages: [],
        };
        recipientList.unshift(recipientThread);
      } else {
        recipientThread.participantName = user.displayName;
        recipientThread.participantRole = senderRole;
        recipientThread.participantAvatarUrl = user.avatarUrl;
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
          id: createNewId('notif'),
          title: `Nova mensagem de ${user.displayName}`,
          content: trimmed.slice(0, 120),
          type: 'MENSAGEM_CHAT',
          read: false,
          createdAt: now,
        });
        db.notificationsByUser[recipientUser.id] = recipientNotifs;
      }
    }

    saveDatabase(db);
    res.status(201).json({ conversation: senderThread, conversations: db.conversationsByUser[user.id] });
  });

  // POST /api/messages/conversations/:participantId/read
  app.post('/api/messages/conversations/:participantId/read', requireAuth, (req: AuthedRequest, res) => {
    const db = loadDatabase();
    const list = db.conversationsByUser[req.authUser!.id] ?? [];
    const thread = list.find((c) => c.participantId === req.params.participantId);
    if (thread && thread.unreadCount > 0) {
      thread.unreadCount = 0;
      saveDatabase(db);
    }
    res.json({ conversations: list });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`ELO+ server running at http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

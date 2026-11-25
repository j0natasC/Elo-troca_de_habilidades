import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import type {
  CategoryItem,
  ConversationThread,
  CreatorSpotlight,
  ExchangeProposal,
  NotificationItem,
  SupportTicketPayload,
  UserProfile,
} from '../src/shared/types';
import {
  SEED_CATEGORIES,
  SEED_SPOTLIGHTS,
  createSeedConversationsList,
  createSeedDemoProfile,
  createSeedExchangesList,
  createSeedNotificationsList,
} from '../src/shared/seedData';
import { hashPassword } from './auth';
import { isDemoEntityId } from '../src/shared/firebaseContracts';

export interface StoredUser extends UserProfile {
  passwordHash: string;
}

export interface OtpChallenge {
  email: string;
  codeHash: string;
  expiresAt: number;
  verified: boolean;
  attempts: number;
}

export interface StoredTicket extends SupportTicketPayload {
  id: string;
  userId: string;
  userEmail: string;
  createdAt: string;
}

export interface DatabaseState {
  users: StoredUser[];
  spotlights: CreatorSpotlight[];
  categories: CategoryItem[];
  conversationsByUser: Record<string, ConversationThread[]>;
  exchangesByUser: Record<string, ExchangeProposal[]>;
  notificationsByUser: Record<string, NotificationItem[]>;
  otpChallenges: Record<string, OtpChallenge>;
  supportTickets: StoredTicket[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'eloplus.db.json');

function createDefaultDemoUser(): StoredUser {
  return {
    ...createSeedDemoProfile(),
    passwordHash: hashPassword('Comum@123'),
  };
}

export function createSeedConversations(userId: string): ConversationThread[] {
  return createSeedConversationsList(userId);
}

export function createSeedExchanges(user: StoredUser): ExchangeProposal[] {
  return createSeedExchangesList(user);
}

export function createSeedNotifications(): NotificationItem[] {
  return createSeedNotificationsList();
}

function createInitialDb(): DatabaseState {
  const demoUser = createDefaultDemoUser();
  return {
    users: [demoUser],
    spotlights: SEED_SPOTLIGHTS,
    categories: SEED_CATEGORIES,
    conversationsByUser: {
      [demoUser.id]: createSeedConversations(demoUser.id),
    },
    exchangesByUser: {
      [demoUser.id]: createSeedExchanges(demoUser),
    },
    notificationsByUser: {
      [demoUser.id]: createSeedNotifications(),
    },
    otpChallenges: {},
    supportTickets: [],
  };
}

let cachedDb: DatabaseState | null = null;

export function loadDatabase(): DatabaseState {
  if (cachedDb) return cachedDb;
  try {
    if (fs.existsSync(DB_PATH)) {
      const raw = fs.readFileSync(DB_PATH, 'utf8');
      const parsed = JSON.parse(raw) as DatabaseState;
      parsed.spotlights = (parsed.spotlights ?? []).map((s) => ({
        ...s,
        isDemo: Boolean(s.isDemo || isDemoEntityId(s.id)),
      }));
      parsed.users = (parsed.users ?? []).map((u) => ({
        ...u,
        isDemo: Boolean(u.isDemo || isDemoEntityId(u.id)),
      }));
      cachedDb = parsed;
      return cachedDb;
    }
  } catch {
    // Fallback to clean seed if file is unreadable
  }
  cachedDb = createInitialDb();
  saveDatabase(cachedDb);
  return cachedDb;
}

export function saveDatabase(db: DatabaseState): void {
  cachedDb = db;
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), 'utf8');
}

export function sanitizeUser(user: StoredUser): UserProfile {
  const { passwordHash: _omit, ...publicUser } = user;
  return publicUser;
}

export function createNewId(prefix: string): string {
  return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
}

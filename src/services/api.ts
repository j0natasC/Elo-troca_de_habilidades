import type {
  AuthResponse,
  CategorySlug,
  ConversationThread,
  DiscoverResponse,
  ExchangeProposal,
  ForgotPasswordResponse,
  NotificationItem,
  SkillItem,
  SupportTicketPayload,
  UserProfile,
  UserSettings,
} from '../shared/types';
import { localRuntime } from './localRuntime';

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') || '';

let inMemoryToken: string | null = null;
let fallbackToLocal =
  import.meta.env.VITE_STATIC_MODE === 'true' ||
  (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io'));

export function setAuthToken(token: string | null): void {
  inMemoryToken = token;
  localRuntime.setToken(token);
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

function shouldUseLocalRuntime(): boolean {
  return !API_BASE && fallbackToLocal;
}

async function withBackendOrLocal<T>(
  path: string,
  init: RequestInit,
  localCall: () => Promise<T>,
): Promise<T> {
  if (shouldUseLocalRuntime()) {
    return localCall();
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> | undefined),
  };

  if (inMemoryToken) {
    headers.Authorization = `Bearer ${inMemoryToken}`;
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers,
    });
  } catch {
    if (!API_BASE) {
      fallbackToLocal = true;
      return localCall();
    }
    throw new Error('Não foi possível conectar ao servidor.');
  }

  const contentType = response.headers.get('content-type') || '';
  if (!API_BASE && response.status === 404 && !contentType.includes('application/json')) {
    fallbackToLocal = true;
    return localCall();
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as { error?: string }).error || 'Erro ao comunicar com o servidor.');
  }

  return data as T;
}

export const api = {
  login(email: string, password: string): Promise<AuthResponse> {
    return withBackendOrLocal(
      '/api/auth/login',
      { method: 'POST', body: JSON.stringify({ email, password }) },
      () => localRuntime.login(email, password),
    );
  },

  register(payload: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    acceptedTerms: boolean;
  }): Promise<AuthResponse> {
    return withBackendOrLocal(
      '/api/auth/register',
      { method: 'POST', body: JSON.stringify(payload) },
      () => localRuntime.register(payload),
    );
  },

  googleSignIn(email: string, name: string): Promise<AuthResponse> {
    return withBackendOrLocal(
      '/api/auth/google',
      { method: 'POST', body: JSON.stringify({ email, name }) },
      () => localRuntime.googleSignIn(email, name),
    );
  },

  forgotPassword(identifier: string): Promise<ForgotPasswordResponse> {
    return withBackendOrLocal(
      '/api/auth/forgot-password',
      { method: 'POST', body: JSON.stringify({ identifier }) },
      () => localRuntime.forgotPassword(identifier),
    );
  },

  verifyOtp(identifier: string, digits: string[]): Promise<{ verified: boolean; email: string }> {
    return withBackendOrLocal(
      '/api/auth/verify-otp',
      { method: 'POST', body: JSON.stringify({ identifier, digits }) },
      () => localRuntime.verifyOtp(identifier, digits),
    );
  },

  resetPassword(
    identifier: string,
    password: string,
    confirmPassword: string,
  ): Promise<{ message: string }> {
    return withBackendOrLocal(
      '/api/auth/reset-password',
      { method: 'POST', body: JSON.stringify({ identifier, password, confirmPassword }) },
      () => localRuntime.resetPassword(identifier, password, confirmPassword),
    );
  },

  getMe(): Promise<{ user: UserProfile }> {
    return withBackendOrLocal('/api/auth/me', {}, () => localRuntime.getMe());
  },

  discover(
    q = '',
    category: CategorySlug | 'all' = 'all',
    mode: 'all' | 'Presencial' | 'Remoto' = 'all',
  ): Promise<DiscoverResponse> {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (category !== 'all') params.set('category', category);
    if (mode !== 'all') params.set('mode', mode);
    const qs = params.toString();
    return withBackendOrLocal(`/api/discover${qs ? `?${qs}` : ''}`, {}, () =>
      localRuntime.discover(q, category, mode),
    );
  },

  updateProfile(payload: {
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
    return withBackendOrLocal(
      '/api/profile',
      { method: 'PUT', body: JSON.stringify(payload) },
      () => localRuntime.updateProfile(payload),
    );
  },

  addSkill(payload: {
    name: string;
    categoryId: CategorySlug;
    level: SkillItem['level'];
    mode?: SkillItem['mode'];
    description?: string;
  }): Promise<{ user: UserProfile }> {
    return withBackendOrLocal(
      '/api/profile/skills',
      { method: 'POST', body: JSON.stringify(payload) },
      () => localRuntime.addSkill(payload),
    );
  },

  removeSkill(skillId: string): Promise<{ user: UserProfile }> {
    return withBackendOrLocal(
      `/api/profile/skills/${encodeURIComponent(skillId)}`,
      { method: 'DELETE' },
      () => localRuntime.removeSkill(skillId),
    );
  },

  addFeaturedWork(payload: {
    title: string;
    category: string;
    description: string;
  }): Promise<{ user: UserProfile }> {
    return withBackendOrLocal(
      '/api/profile/works',
      { method: 'POST', body: JSON.stringify(payload) },
      () => localRuntime.addFeaturedWork(payload),
    );
  },

  getExchanges(): Promise<{ exchanges: ExchangeProposal[] }> {
    return withBackendOrLocal('/api/exchanges', {}, () => localRuntime.getExchanges());
  },

  createExchange(payload: {
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
    return withBackendOrLocal(
      '/api/exchanges',
      { method: 'POST', body: JSON.stringify(payload) },
      () => localRuntime.createExchange(payload),
    );
  },

  respondExchange(
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
    return withBackendOrLocal(
      `/api/exchanges/${encodeURIComponent(id)}/respond`,
      { method: 'POST', body: JSON.stringify(payload) },
      () => localRuntime.respondExchange(id, payload),
    );
  },

  reviewExchange(
    id: string,
    payload: { rating: number; comment: string },
  ): Promise<{ exchange: ExchangeProposal; exchanges: ExchangeProposal[] }> {
    return withBackendOrLocal(
      `/api/exchanges/${encodeURIComponent(id)}/review`,
      { method: 'POST', body: JSON.stringify(payload) },
      () => localRuntime.reviewExchange(id, payload),
    );
  },

  getNotifications(): Promise<{ notifications: NotificationItem[] }> {
    return withBackendOrLocal('/api/notifications', {}, () => localRuntime.getNotifications());
  },

  markNotificationsRead(): Promise<{ notifications: NotificationItem[] }> {
    return withBackendOrLocal('/api/notifications/read-all', { method: 'POST' }, () =>
      localRuntime.markNotificationsRead(),
    );
  },

  updateSettings(settings: Partial<UserSettings>): Promise<{ user: UserProfile }> {
    return withBackendOrLocal(
      '/api/settings',
      { method: 'PUT', body: JSON.stringify(settings) },
      () => localRuntime.updateSettings(settings),
    );
  },

  submitSupportTicket(payload: SupportTicketPayload): Promise<{ message: string; ticketId: string }> {
    return withBackendOrLocal(
      '/api/support',
      { method: 'POST', body: JSON.stringify(payload) },
      () => localRuntime.submitSupportTicket(payload),
    );
  },

  deleteAccount(): Promise<{ deleted: boolean }> {
    return withBackendOrLocal('/api/account', { method: 'DELETE' }, () =>
      localRuntime.deleteAccount(),
    );
  },

  getConversations(): Promise<{ conversations: ConversationThread[] }> {
    return withBackendOrLocal('/api/messages/conversations', {}, () =>
      localRuntime.getConversations(),
    );
  },

  sendMessage(
    participantId: string,
    text: string,
  ): Promise<{ conversation: ConversationThread; conversations: ConversationThread[] }> {
    return withBackendOrLocal(
      `/api/messages/conversations/${encodeURIComponent(participantId)}/send`,
      { method: 'POST', body: JSON.stringify({ text }) },
      () => localRuntime.sendMessage(participantId, text),
    );
  },

  markConversationRead(participantId: string): Promise<{ conversations: ConversationThread[] }> {
    return withBackendOrLocal(
      `/api/messages/conversations/${encodeURIComponent(participantId)}/read`,
      { method: 'POST' },
      () => localRuntime.markConversationRead(participantId),
    );
  },
};

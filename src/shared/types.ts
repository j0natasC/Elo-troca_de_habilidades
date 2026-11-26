export type CategorySlug =
  | 'programacao'
  | 'desenho'
  | 'cozinhar'
  | 'ilustracao'
  | 'musica'
  | 'escrita'
  | 'trafego'
  | 'banco-de-dados';

export type AttendanceMode = 'Presencial' | 'Remoto' | 'Presencial e Remoto';

export type ExchangeStatus =
  | 'PENDENTE'
  | 'CONTRAPROPOSTA'
  | 'CONFIRMADA'
  | 'EM_ANDAMENTO'
  | 'CONCLUIDA'
  | 'CANCELADA';

export interface CategoryItem {
  id: CategorySlug;
  name: string;
  description: string;
  iconKey: CategorySlug;
  creatorCount: number;
}

export interface SkillItem {
  id: string;
  name: string;
  categoryId: CategorySlug;
  level: 'Iniciante' | 'Intermediário' | 'Avançado';
  mode?: AttendanceMode;
  description?: string;
}

export interface FeaturedWork {
  id: string;
  title: string;
  authorName: string;
  category: string;
  rating: number;
  maxRating: number;
  imageUrl: string;
  description: string;
  createdAt: string;
}

export interface AddressInfo {
  logradouro: string;
  bairro: string;
  municipio: string;
  estado: string;
}

export interface UserSettings {
  language: 'pt-BR' | 'en-US';
  darkMode: boolean;
  maxDistanceKm: number;
  notificationsEmail: boolean;
  notificationsPush: boolean;
  notificationsMessages: boolean;
  notificationsProposals: boolean;
  notificationsReminders: boolean;
  privacyPublicProfile: boolean;
  privacyShowEmail: boolean;
  privacyAllowMessages: boolean;
}

export interface UserProfile {
  id: string;
  displayName: string;
  fullName: string;
  email: string;
  cpf?: string;
  phone?: string;
  age: number;
  headline: string;
  bio: string;
  locationLabel: string;
  address?: AddressInfo;
  avatarUrl: string;
  coverUrl: string;
  rating: number;
  skills: SkillItem[];
  desiredSkills: string[];
  featuredWorks: FeaturedWork[];
  settings: UserSettings;
  isDemo?: boolean;
  createdAt: string;
}

export interface CreatorSpotlight {
  id: string;
  displayName: string;
  fullName: string;
  roleTitle: string;
  categoryId: CategorySlug;
  location: string;
  distanceKm: number;
  mode: AttendanceMode;
  rating: number;
  avatarUrl: string;
  coverUrl: string;
  bio: string;
  skills: string[];
  desiredSkills: string[];
  featuredWorks: FeaturedWork[];
  isDemo?: boolean;
}

export interface ExchangeReview {
  reviewerId: string;
  reviewerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ExchangeProposal {
  id: string;
  proposerId: string;
  proposerName: string;
  proposerAvatarUrl: string;
  receiverId: string;
  receiverName: string;
  receiverAvatarUrl: string;
  offeredSkill: string;
  requestedSkill: string;
  mode: 'Presencial' | 'Remoto';
  scheduledDate: string;
  location: string;
  notes: string;
  status: ExchangeStatus;
  lastUpdatedBy: string;
  reviews: ExchangeReview[];
  createdAt: string;
  updatedAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  content: string;
  type: 'PROPOSTA_TROCA' | 'MENSAGEM_CHAT' | 'AGENDAMENTO' | 'AVALIACAO';
  read: boolean;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  sentAt: string;
}

export interface ConversationThread {
  id: string;
  participantId: string;
  participantName: string;
  participantRole: string;
  participantAvatarUrl: string;
  unreadCount: number;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface AuthResponse {
  token: string;
  user: UserProfile;
  isNewUser?: boolean;
}

export interface DiscoverResponse {
  categories: CategoryItem[];
  spotlights: CreatorSpotlight[];
}

export interface ForgotPasswordResponse {
  message: string;
  emailMasked: string;
  devPreviewCode?: string;
}

export interface SupportTicketPayload {
  subject: string;
  message: string;
}

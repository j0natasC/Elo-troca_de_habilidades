export const BLUEPRINT_LIMITS = {
  ID_MAX: 128,
  ID_PATTERN: /^[a-zA-Z0-9_-]+$/,
  DISPLAY_NAME_MAX: 80,
  FULL_NAME_MAX: 120,
  HEADLINE_MAX: 140,
  BIO_MAX: 600,
  LOCATION_MAX: 120,
  MEDIA_URL_MAX: 260000,
  EMAIL_MAX: 160,
  SKILL_NAME_MAX: 80,
  WORK_TITLE_MAX: 120,
  MAX_ARRAY_ITEMS: 12,
  CHAT_TEXT_MAX: 1000,
  NOTIF_TITLE_MAX: 120,
  NOTIF_CONTENT_MAX: 300,
  EXCHANGE_SKILL_MAX: 120,
  EXCHANGE_DATE_MAX: 40,
  EXCHANGE_LOCATION_MAX: 200,
  EXCHANGE_NOTES_MAX: 600,
  REVIEW_COMMENT_MAX: 500,
  SUPPORT_SUBJECT_MAX: 120,
  SUPPORT_MESSAGE_MAX: 1500,
} as const;

export function truncateText(value: string, maxLength: number): string {
  const normalized = String(value ?? '').trim();
  if (normalized.length <= maxLength) return normalized;
  return normalized.slice(0, maxLength);
}

export function sanitizeId(raw: string): string {
  const cleaned = String(raw ?? '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const sliced = cleaned.slice(0, BLUEPRINT_LIMITS.ID_MAX);
  return sliced || `id_${Date.now()}`;
}

export function isValidFirestoreId(id: string): boolean {
  return (
    typeof id === 'string' &&
    id.length >= 1 &&
    id.length <= BLUEPRINT_LIMITS.ID_MAX &&
    BLUEPRINT_LIMITS.ID_PATTERN.test(id)
  );
}

export function sortedUidPair(uidA: string, uidB: string): [string, string] {
  return uidA < uidB ? [uidA, uidB] : [uidB, uidA];
}

export function canonicalChatId(uidA: string, uidB: string): string {
  const [first, second] = sortedUidPair(sanitizeId(uidA), sanitizeId(uidB));
  return `${first}__${second}`;
}

export function isDemoEntityId(id: string): boolean {
  return id.startsWith('creator-') || id === 'user-juan';
}

export function clampMediaDataUrl(url: string | undefined): string {
  const value = String(url ?? '').trim();
  if (!value) return '';
  if (value.length <= BLUEPRINT_LIMITS.MEDIA_URL_MAX) return value;
  throw new Error('A imagem selecionada excede o limite permitido (máx. ~200 KB). Escolha uma foto menor.');
}

export function clampArray<T>(items: T[], maxItems = BLUEPRINT_LIMITS.MAX_ARRAY_ITEMS): T[] {
  return items.slice(0, maxItems);
}

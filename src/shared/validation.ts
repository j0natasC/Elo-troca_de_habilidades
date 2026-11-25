import type { AttendanceMode, CategorySlug, CreatorSpotlight } from './types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): ValidationResult {
  const trimmed = email.trim();
  if (!trimmed) {
    return { valid: false, error: 'Informe o seu e-mail.' };
  }
  if (!EMAIL_PATTERN.test(trimmed)) {
    return { valid: false, error: 'Informe um e-mail válido.' };
  }
  return { valid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (!password) {
    return { valid: false, error: 'Informe a sua senha.' };
  }
  if (password.length < 6) {
    return { valid: false, error: 'A senha deve ter pelo menos 6 caracteres.' };
  }
  return { valid: true };
}

export function validateRegistration(input: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  acceptedTerms: boolean;
}): ValidationResult {
  const name = input.name.trim();
  if (name.length < 2) {
    return { valid: false, error: 'Informe seu nome completo (mínimo 2 caracteres).' };
  }

  const emailCheck = validateEmail(input.email);
  if (!emailCheck.valid) {
    return emailCheck;
  }

  const passCheck = validatePassword(input.password);
  if (!passCheck.valid) {
    return passCheck;
  }

  if (input.password !== input.confirmPassword) {
    return { valid: false, error: 'As senhas informadas não conferem.' };
  }

  if (!input.acceptedTerms) {
    return {
      valid: false,
      error: 'Aceite os Termos de Uso e Política de Privacidade para continuar.',
    };
  }

  return { valid: true };
}

export function validateOtpCode(digits: string[]): ValidationResult {
  const joined = digits.map((d) => d.trim()).join('');
  if (!/^\d{4}$/.test(joined)) {
    return { valid: false, error: 'Digite os 4 dígitos numéricos do código.' };
  }
  return { valid: true };
}

export function validateNewPassword(password: string, confirmPassword: string): ValidationResult {
  const passCheck = validatePassword(password);
  if (!passCheck.valid) {
    return passCheck;
  }
  if (password !== confirmPassword) {
    return { valid: false, error: 'A confirmação de senha não confere.' };
  }
  return { valid: true };
}

export function validateExchangeProposal(input: {
  offeredSkill: string;
  requestedSkill: string;
  scheduledDate: string;
  location: string;
  userSkillCount: number;
}): ValidationResult {
  // RN-AGE-08: Pelo menos uma habilidade cadastrada no perfil
  if (input.userSkillCount < 1) {
    return {
      valid: false,
      error: 'Cadastre pelo menos uma habilidade no seu perfil antes de propor uma troca.',
    };
  }
  if (!input.offeredSkill.trim() || !input.requestedSkill.trim()) {
    return {
      valid: false,
      error: 'Selecione a habilidade ofertada e a habilidade desejada.',
    };
  }
  if (!input.scheduledDate.trim()) {
    return { valid: false, error: 'Escolha a data e horário para a troca.' };
  }
  if (input.location.trim().length < 3) {
    return {
      valid: false,
      error: 'Informe o local de encontro ou link para atendimento remoto.',
    };
  }
  return { valid: true };
}

export function maskEmailAddress(email: string): string {
  const [localPart, domain] = email.split('@');
  if (!localPart || !domain) return '***';
  const visible = localPart.slice(0, Math.min(2, localPart.length));
  return `${visible}${'*'.repeat(Math.max(2, localPart.length - 2))}@${domain}`;
}

export function filterCreatorsByCategoryAndQuery(
  creators: CreatorSpotlight[],
  categoryId: CategorySlug | 'all',
  query: string,
  modeFilter: 'all' | 'Presencial' | 'Remoto' = 'all',
  maxDistanceKm?: number,
  onlyRealUsers = false,
): CreatorSpotlight[] {
  const normalizedQuery = query.trim().toLowerCase();

  return creators.filter((creator) => {
    if (onlyRealUsers && creator.isDemo) return false;

    const matchesCategory = categoryId === 'all' || creator.categoryId === categoryId;
    if (!matchesCategory) return false;

    if (modeFilter !== 'all') {
      const modeMatches =
        creator.mode === 'Presencial e Remoto' || creator.mode === modeFilter;
      if (!modeMatches) return false;
    }

    if (typeof maxDistanceKm === 'number' && maxDistanceKm > 0 && creator.mode !== 'Remoto') {
      if (creator.distanceKm > maxDistanceKm) return false;
    }

    if (!normalizedQuery) return true;

    const haystack = [
      creator.displayName,
      creator.fullName,
      creator.roleTitle,
      creator.location,
      creator.mode,
      creator.bio,
      ...creator.skills,
      ...creator.desiredSkills,
      ...creator.featuredWorks.map((w) => `${w.title} ${w.category}`),
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function extractFirstName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return 'Usuário';
  return trimmed.split(/\s+/)[0];
}

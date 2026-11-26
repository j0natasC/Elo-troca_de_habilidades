import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractFirstName,
  filterCreatorsByCategoryAndQuery,
  isProfilePendingOnboarding,
  maskEmailAddress,
  validateEmail,
  validateExchangeProposal,
  validateNewPassword,
  validateOnboardingProfile,
  validateOtpCode,
  validateRegistration,
} from './validation';
import type { CreatorSpotlight } from './types';

test('validateEmail accepts valid emails and rejects invalid ones', () => {
  assert.equal(validateEmail('juan.silva@gmail.com').valid, true);
  assert.equal(validateEmail('').valid, false);
  assert.equal(validateEmail('sem-arroba.com').valid, false);
});

test('validateRegistration enforces terms, password match, and minimum length', () => {
  const valid = validateRegistration({
    name: 'Juan Silva',
    email: 'juan@eloplus.com.br',
    password: 'segredo123',
    confirmPassword: 'segredo123',
    acceptedTerms: true,
  });
  assert.equal(valid.valid, true);

  const missingTerms = validateRegistration({
    name: 'Juan Silva',
    email: 'juan@eloplus.com.br',
    password: 'segredo123',
    confirmPassword: 'segredo123',
    acceptedTerms: false,
  });
  assert.equal(missingTerms.valid, false);

  const mismatch = validateRegistration({
    name: 'Juan Silva',
    email: 'juan@eloplus.com.br',
    password: 'segredo123',
    confirmPassword: 'outra',
    acceptedTerms: true,
  });
  assert.equal(mismatch.valid, false);
});

test('validateOtpCode requires exactly 4 digits', () => {
  assert.equal(validateOtpCode(['4', '8', '2', '9']).valid, true);
  assert.equal(validateOtpCode(['4', '8', '', '9']).valid, false);
  assert.equal(validateOtpCode(['4', 'a', '2', '9']).valid, false);
});

test('validateNewPassword verifies confirmation match', () => {
  assert.equal(validateNewPassword('nova123', 'nova123').valid, true);
  assert.equal(validateNewPassword('123', '123').valid, false);
  assert.equal(validateNewPassword('nova123', 'nova124').valid, false);
});

test('validateExchangeProposal enforces RN-AGE-08 minimum skill and required scheduling fields', () => {
  assert.equal(
    validateExchangeProposal({
      offeredSkill: 'Banco de Dados',
      requestedSkill: 'Programação',
      scheduledDate: '2026-12-01T14:00',
      location: 'Fatec Zona Sul - São Paulo',
      userSkillCount: 0,
    }).valid,
    false,
  );

  assert.equal(
    validateExchangeProposal({
      offeredSkill: 'Banco de Dados',
      requestedSkill: 'Programação',
      scheduledDate: '2026-12-01T14:00',
      location: 'Fatec Zona Sul - São Paulo',
      userSkillCount: 1,
    }).valid,
    true,
  );
});

test('maskEmailAddress obscures local part safely', () => {
  assert.equal(maskEmailAddress('juan.silva@gmail.com'), 'ju********@gmail.com');
});

test('extractFirstName returns first token safely', () => {
  assert.equal(extractFirstName('Juan Silva de Lima'), 'Juan');
  assert.equal(extractFirstName('  '), 'Usuário');
});

test('filterCreatorsByCategoryAndQuery filters by category, modality, location, and search text', () => {
  const sample: CreatorSpotlight[] = [
    {
      id: 'c1',
      displayName: 'Mateus Silva',
      fullName: 'Mateus Silva',
      roleTitle: 'Programador',
      categoryId: 'programacao',
      location: 'Santo Amaro, São Paulo',
      distanceKm: 4,
      mode: 'Presencial e Remoto',
      rating: 4.9,
      avatarUrl: '/a.jpg',
      coverUrl: '/c.jpg',
      bio: 'Spring Boot e TypeScript',
      skills: ['Java', 'Spring Boot', 'Ionic'],
      desiredSkills: ['Inglês'],
      featuredWorks: [],
      isDemo: true,
    },
    {
      id: 'c2',
      displayName: 'Ana Costa',
      fullName: 'Ana Costa',
      roleTitle: 'Ilustradora',
      categoryId: 'ilustracao',
      location: 'Vila Mariana, São Paulo',
      distanceKm: 11,
      mode: 'Remoto',
      rating: 4.8,
      avatarUrl: '/b.jpg',
      coverUrl: '/c.jpg',
      bio: 'Arte vetorial editorial',
      skills: ['Ilustração', 'Desenho'],
      desiredSkills: ['Programação'],
      featuredWorks: [],
      isDemo: false,
    },
  ];

  assert.equal(filterCreatorsByCategoryAndQuery(sample, 'programacao', '').length, 1);
  assert.equal(filterCreatorsByCategoryAndQuery(sample, 'all', 'santo amaro').length, 1);
  assert.equal(filterCreatorsByCategoryAndQuery(sample, 'all', '', 'Presencial').length, 1);
  assert.equal(filterCreatorsByCategoryAndQuery(sample, 'all', '', 'Remoto').length, 2);
  assert.equal(filterCreatorsByCategoryAndQuery(sample, 'all', '', 'all', undefined, true).length, 1);
  assert.equal(filterCreatorsByCategoryAndQuery(sample, 'all', '', 'all', undefined, true)[0].id, 'c2');
  assert.equal(filterCreatorsByCategoryAndQuery(sample, 'cozinhar', '').length, 0);
});

test('validateOnboardingProfile requires real age, location, headline, and at least one skill', () => {
  assert.equal(
    validateOnboardingProfile({
      fullName: 'Jonatas Costa',
      age: '',
      locationLabel: 'Santo Amaro',
      headline: 'Desenvolvedor',
      skillsCount: 1,
    }).valid,
    false,
  );
  assert.equal(
    validateOnboardingProfile({
      fullName: 'Jonatas Costa',
      age: '12',
      locationLabel: 'Santo Amaro',
      headline: 'Desenvolvedor',
      skillsCount: 1,
    }).valid,
    false,
  );
  assert.equal(
    validateOnboardingProfile({
      fullName: 'Jonatas Costa',
      age: '24',
      locationLabel: '',
      headline: 'Desenvolvedor',
      skillsCount: 1,
    }).valid,
    false,
  );
  assert.equal(
    validateOnboardingProfile({
      fullName: 'Jonatas Costa',
      age: '24',
      locationLabel: 'Santo Amaro · SP',
      headline: 'Desenvolvedor Web',
      skillsCount: 0,
    }).valid,
    false,
  );
  assert.equal(
    validateOnboardingProfile({
      fullName: 'Jonatas Costa',
      age: '24',
      locationLabel: 'Santo Amaro · SP',
      headline: 'Desenvolvedor Web',
      skillsCount: 1,
    }).valid,
    true,
  );
});

test('isProfilePendingOnboarding detects blank newly-created profiles and ignores completed or demo users', () => {
  assert.equal(
    isProfilePendingOnboarding({ headline: '', locationLabel: '', skills: [], isDemo: false }, false),
    true,
  );
  assert.equal(
    isProfilePendingOnboarding({ headline: '', locationLabel: '', skills: [], isDemo: true }, false),
    false,
  );
  assert.equal(
    isProfilePendingOnboarding({ headline: '', locationLabel: '', skills: [], isDemo: false }, true),
    false,
  );
  assert.equal(
    isProfilePendingOnboarding(
      { headline: 'Designer', locationLabel: 'Pinheiros', skills: [], isDemo: false },
      false,
    ),
    false,
  );
});

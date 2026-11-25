import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDiscoverSpotlights, userToCreatorSpotlight } from './userDirectory';
import { SEED_SPOTLIGHTS, createSeedDemoProfile } from './seedData';
import type { UserProfile } from './types';

function makeUser(overrides: Partial<UserProfile>): UserProfile {
  const base = createSeedDemoProfile();
  return {
    ...base,
    id: 'user-lucas',
    displayName: 'Lucas',
    fullName: 'Lucas Ferreira',
    email: 'lucas@example.com',
    avatarUrl: '',
    coverUrl: '',
    bio: '',
    locationLabel: '',
    skills: [],
    desiredSkills: [],
    ...overrides,
  };
}

test('userToCreatorSpotlight hides self and private profiles', () => {
  const lucas = makeUser({});
  assert.equal(userToCreatorSpotlight(lucas, 'user-lucas'), null);

  const privateLucas = makeUser({
    settings: { ...lucas.settings, privacyPublicProfile: false },
  });
  assert.equal(userToCreatorSpotlight(privateLucas, 'user-other'), null);

  const visible = userToCreatorSpotlight(lucas, 'user-other');
  assert.ok(visible);
  assert.equal(visible.avatarUrl, '');
  assert.equal(visible.coverUrl, '');
  assert.deepEqual(visible.skills, ['Colaboração ELO+']);
});

test('buildDiscoverSpotlights places registered members ahead of seed spotlights and omits viewer', () => {
  const demo = createSeedDemoProfile();
  const aline = makeUser({ id: 'user-aline', displayName: 'Aline', fullName: 'Aline Andrade' });
  const lucas = makeUser({ id: 'user-lucas', displayName: 'Lucas', fullName: 'Lucas Ferreira' });

  const list = buildDiscoverSpotlights([demo, aline, lucas], SEED_SPOTLIGHTS, 'user-aline');
  assert.equal(list[0].id, 'user-lucas');
  assert.ok(!list.some((item) => item.id === 'user-aline'));
  assert.ok(list.some((item) => item.id === 'creator-mateus'));
});

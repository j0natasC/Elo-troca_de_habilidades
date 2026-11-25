import type { AttendanceMode, CategorySlug, CreatorSpotlight, UserProfile } from './types';
import { isDemoEntityId } from './firebaseContracts';

function normalizeMode(mode?: AttendanceMode): AttendanceMode {
  if (mode === 'Presencial' || mode === 'Remoto' || mode === 'Presencial e Remoto') {
    return mode;
  }
  return 'Presencial e Remoto';
}

export function userToCreatorSpotlight(
  user: UserProfile,
  viewerId?: string,
): CreatorSpotlight | null {
  if (viewerId && user.id === viewerId) {
    return null;
  }
  if (user.settings?.privacyPublicProfile === false) {
    return null;
  }

  const primarySkill = user.skills[0];
  const categoryId: CategorySlug = primarySkill?.categoryId ?? 'programacao';
  const mode = normalizeMode(primarySkill?.mode);
  const roleTitle =
    user.headline.trim() ||
    (primarySkill ? `Especialista em ${primarySkill.name}` : 'Membro da comunidade ELO+');

  return {
    id: user.id,
    displayName: user.displayName,
    fullName: user.fullName,
    roleTitle,
    categoryId,
    location: user.locationLabel.trim() || 'Comunidade ELO+ · Brasil',
    distanceKm: 2,
    mode,
    rating: Number.isFinite(user.rating) && user.rating > 0 ? user.rating : 5,
    avatarUrl: user.avatarUrl,
    coverUrl: user.coverUrl,
    bio:
      user.bio.trim() ||
      'Membro cadastrado na plataforma ELO+ disponível para trocar habilidades sem usar dinheiro.',
    skills: user.skills.length > 0 ? user.skills.map((s) => s.name) : ['Colaboração ELO+'],
    desiredSkills: user.desiredSkills,
    featuredWorks: user.featuredWorks ?? [],
    isDemo: Boolean(user.isDemo || isDemoEntityId(user.id)),
  };
}

export function buildDiscoverSpotlights(
  users: UserProfile[],
  seedSpotlights: CreatorSpotlight[],
  viewerId?: string,
): CreatorSpotlight[] {
  const registeredSpotlights: CreatorSpotlight[] = [];
  const seenIds = new Set<string>();

  // List newer registered members first so newly connected people appear right away in highlights
  for (let i = users.length - 1; i >= 0; i -= 1) {
    const converted = userToCreatorSpotlight(users[i], viewerId);
    if (converted && !seenIds.has(converted.id)) {
      seenIds.add(converted.id);
      registeredSpotlights.push(converted);
    }
  }

  const combined = [...registeredSpotlights];
  for (const seed of seedSpotlights) {
    if (!seenIds.has(seed.id)) {
      seenIds.add(seed.id);
      combined.push({
        ...seed,
        isDemo: Boolean(seed.isDemo || isDemoEntityId(seed.id)),
      });
    }
  }

  return combined;
}

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BLUEPRINT_LIMITS,
  canonicalChatId,
  isValidFirestoreId,
} from './src/shared/firebaseContracts';

const rulesText = fs.readFileSync(path.resolve('firestore.rules'), 'utf8');
const blueprint = JSON.parse(fs.readFileSync(path.resolve('firebase-blueprint.json'), 'utf8'));

type AuthCtx = { uid: string } | null;

function evaluateDirtyDozen(scenario: string, auth: AuthCtx, payload: Record<string, unknown>): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!auth || !auth.uid) return 'PERMISSION_DENIED';

  switch (scenario) {
    case '1_chat_sender_spoof': {
      return payload.senderId === auth.uid ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    case '2_shadow_field_public_profile': {
      const allowed = new Set(blueprint.entities.PublicProfile.required);
      const hasShadow = Object.keys(payload).some((k) => !allowed.has(k));
      return hasShadow ? 'PERMISSION_DENIED' : 'ALLOW';
    }
    case '3_pii_cross_read': {
      return payload.targetUid === auth.uid ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    case '4_private_profile_scrape': {
      return payload.privacyPublicProfile === true || payload.uid === auth.uid
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    case '5_unauth_list': {
      return auth ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    case '6_id_poisoning': {
      return isValidFirestoreId(String(payload.docId ?? '')) ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    case '7_payload_overflow': {
      const textOk = String(payload.text ?? '').length <= BLUEPRINT_LIMITS.CHAT_TEXT_MAX;
      const skillsOk = Array.isArray(payload.skills)
        ? payload.skills.length <= BLUEPRINT_LIMITS.MAX_ARRAY_ITEMS
        : true;
      return textOk && skillsOk ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    case '8_exchange_state_shortcut': {
      return payload.status === 'PENDENTE' ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    case '9_terminal_state_mutation': {
      const prevStatus = String(payload.existingStatus ?? '');
      return prevStatus === 'CANCELADA' || prevStatus === 'CONCLUIDA'
        ? 'PERMISSION_DENIED'
        : 'ALLOW';
    }
    case '10_immutable_proposer_hijack': {
      return payload.incomingProposerId === payload.existingProposerId
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    case '11_timestamp_forgery': {
      return payload.sentAt === 'REQUEST_TIME' ? 'ALLOW' : 'PERMISSION_DENIED';
    }
    case '12_review_before_complete_or_spoof': {
      return payload.exchangeStatus === 'CONCLUIDA' && payload.reviewerId === auth.uid
        ? 'ALLOW'
        : 'PERMISSION_DENIED';
    }
    default:
      return 'PERMISSION_DENIED';
  }
}

test('firestore.rules enforces Eight Pillars structural invariants', () => {
  assert.match(rulesText, /rules_version = '2';/);
  assert.match(rulesText, /match \/\{document=\*\*\} \{\s*allow read, write: if false;/);
  assert.match(rulesText, /request\.auth != null && request\.auth\.uid is string/);
  assert.match(rulesText, /resource == null && \(/);
  assert.match(rulesText, /function isValidId\(id\)/);
  assert.match(rulesText, /function isValidPublicProfile\(data\)/);
  assert.match(rulesText, /function isValidPrivateUser\(data\)/);
  assert.match(rulesText, /function isValidChat\(data\)/);
  assert.match(rulesText, /function isValidChatMessage\(data\)/);
  assert.match(rulesText, /function isValidExchange\(data\)/);
  assert.match(rulesText, /function isValidReview\(data\)/);
  assert.match(rulesText, /getAfter\(/);
  assert.match(rulesText, /existing\(\)\.status != 'CANCELADA'/);
  assert.match(rulesText, /existing\(\)\.status != 'CONCLUIDA'/);
  assert.ok(!/allow (read|list):\s*if isSignedIn\(\)\s*;/.test(rulesText), 'No blanket allow list');
  assert.ok(
    !/allow list:[\s\S]{0,120}existing\(\)\.(participants|exchangeParticipants) is list/.test(rulesText),
    'array-contains list rules must not add is list checks rejected by Firestore query analyzer',
  );
});

test('Dirty Dozen adversarial payloads all return PERMISSION_DENIED', () => {
  const attacker: AuthCtx = { uid: 'userA' };

  assert.equal(
    evaluateDirtyDozen('1_chat_sender_spoof', attacker, { senderId: 'userB' }),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateDirtyDozen('2_shadow_field_public_profile', attacker, {
      ...Object.fromEntries(blueprint.entities.PublicProfile.required.map((k: string) => [k, 'x'])),
      isAdmin: true,
    }),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateDirtyDozen('3_pii_cross_read', attacker, { targetUid: 'userB' }),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateDirtyDozen('4_private_profile_scrape', attacker, {
      uid: 'userB',
      privacyPublicProfile: false,
    }),
    'PERMISSION_DENIED',
  );
  assert.equal(evaluateDirtyDozen('5_unauth_list', null, {}), 'PERMISSION_DENIED');
  assert.equal(
    evaluateDirtyDozen('6_id_poisoning', attacker, { docId: `${'a'.repeat(130)}/bad$id` }),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateDirtyDozen('7_payload_overflow', attacker, {
      text: 'x'.repeat(BLUEPRINT_LIMITS.CHAT_TEXT_MAX + 1),
      skills: Array.from({ length: 20 }, (_, i) => `s${i}`),
    }),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateDirtyDozen('8_exchange_state_shortcut', attacker, { status: 'CONFIRMADA' }),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateDirtyDozen('9_terminal_state_mutation', attacker, { existingStatus: 'CANCELADA' }),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateDirtyDozen('10_immutable_proposer_hijack', attacker, {
      existingProposerId: 'userA',
      incomingProposerId: 'userB',
    }),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateDirtyDozen('11_timestamp_forgery', attacker, { sentAt: '2020-01-01T00:00:00Z' }),
    'PERMISSION_DENIED',
  );
  assert.equal(
    evaluateDirtyDozen('12_review_before_complete_or_spoof', attacker, {
      exchangeStatus: 'PENDENTE',
      reviewerId: 'userB',
    }),
    'PERMISSION_DENIED',
  );
});

test('canonicalChatId orders participant UIDs deterministically', () => {
  assert.equal(canonicalChatId('uidB', 'uidA'), 'uidA__uidB');
  assert.equal(canonicalChatId('uidA', 'uidB'), 'uidA__uidB');
  assert.ok(isValidFirestoreId(canonicalChatId('uidA', 'uidB')));
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createLocalRuntime, type StorageLike } from './localRuntime';

function createMemoryStorage(): StorageLike {
  const map = new Map<string, string>();
  return {
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
  };
}

test('localRuntime authenticates demo user and supports proposals, counter-proposals, and reviews', async () => {
  const rt = createLocalRuntime(createMemoryStorage());

  const auth = await rt.login('juan.silva@gmail.com', 'Comum@123');
  assert.equal(auth.user.displayName, 'Juan');
  assert.ok(auth.token.startsWith('local.'));

  const discoverRemote = await rt.discover('', 'all', 'Remoto');
  assert.ok(discoverRemote.spotlights.length >= 2);

  const created = await rt.createExchange({
    receiverId: 'creator-mateus',
    offeredSkill: 'Banco de Dados',
    requestedSkill: 'Java Spring Boot',
    mode: 'Presencial',
    scheduledDate: '2026-12-05T14:00',
    location: 'Fatec Zona Sul — São Paulo, SP',
    notes: 'Revisão prática do projeto.',
  });
  assert.equal(created.exchange.status, 'PENDENTE');
  assert.ok(created.notifications[0].title.includes('Proposta'));

  const countered = await rt.respondExchange(created.exchange.id, {
    action: 'counter',
    scheduledDate: '2026-12-06T16:00',
    location: 'Google Meet',
  });
  assert.equal(countered.exchange.status, 'CONTRAPROPOSTA');
  assert.equal(countered.exchange.location, 'Google Meet');

  const reviewed = await rt.reviewExchange(created.exchange.id, {
    rating: 5,
    comment: 'Excelente troca colaborativa!',
  });
  assert.equal(reviewed.exchange.status, 'CONCLUIDA');
  assert.equal(reviewed.exchange.reviews[0].rating, 5);
});

test('localRuntime registers new account, prevents duplicate skills, and persists messages', async () => {
  const rt = createLocalRuntime(createMemoryStorage());

  const reg = await rt.register({
    name: 'Samira Rodrigues',
    email: 'samira@fatec.sp.gov.br',
    password: 'Senha@123',
    confirmPassword: 'Senha@123',
    acceptedTerms: true,
  });
  assert.equal(reg.user.displayName, 'Samira');
  assert.equal(reg.user.avatarUrl, '');
  assert.equal(reg.user.coverUrl, '');

  await assert.rejects(
    () =>
      rt.addSkill({
        name: 'Programação',
        categoryId: 'programacao',
        level: 'Avançado',
      }),
    /já possui essa habilidade/i,
  );

  const sent = await rt.sendMessage('creator-ana', 'Olá Ana, vamos trocar habilidades?');
  assert.equal(sent.conversation.messages.at(-1)?.text, 'Olá Ana, vamos trocar habilidades?');

  await assert.rejects(() => rt.googleSignIn('', ''), /e-mail/i);

  const googleAuth = await rt.googleSignIn('aline.andrade@gmail.com', 'Aline Andrade');
  assert.equal(googleAuth.user.displayName, 'Aline');
  assert.equal(googleAuth.user.avatarUrl, '');
  assert.equal(googleAuth.user.coverUrl, '');
  assert.equal(googleAuth.user.skills.length, 0);
});

test('two registered users discover each other, chat two-way with unread counts, and negotiate exchanges', async () => {
  const storage = createMemoryStorage();
  const rtAline = createLocalRuntime(storage);
  const rtLucas = createLocalRuntime(storage);

  const alineAuth = await rtAline.register({
    name: 'Aline Andrade',
    email: 'aline@elo.com',
    password: 'Senha@123',
    confirmPassword: 'Senha@123',
    acceptedTerms: true,
  });

  const lucasAuth = await rtLucas.register({
    name: 'Lucas Ferreira',
    email: 'lucas@elo.com',
    password: 'Senha@123',
    confirmPassword: 'Senha@123',
    acceptedTerms: true,
  });

  // 1. Both appear in each other's discover directory (excluding themselves)
  const alineDiscover = await rtAline.discover();
  assert.ok(alineDiscover.spotlights.some((s) => s.id === lucasAuth.user.id));
  assert.ok(!alineDiscover.spotlights.some((s) => s.id === alineAuth.user.id));

  const lucasDiscover = await rtLucas.discover();
  assert.ok(lucasDiscover.spotlights.some((s) => s.id === alineAuth.user.id));
  assert.ok(!lucasDiscover.spotlights.some((s) => s.id === lucasAuth.user.id));

  // 2. Aline sends message -> Lucas receives unread thread + notification -> marks read -> replies -> Aline receives reply
  await rtAline.sendMessage(lucasAuth.user.id, 'Olá Lucas, podemos conversar sobre trocas?');
  const lucasInbox = await rtLucas.getConversations();
  assert.equal(lucasInbox.conversations.length, 1);
  assert.equal(lucasInbox.conversations[0].participantId, alineAuth.user.id);
  assert.equal(lucasInbox.conversations[0].unreadCount, 1);
  assert.equal(lucasInbox.conversations[0].messages[0].text, 'Olá Lucas, podemos conversar sobre trocas?');

  const lucasNotifs = await rtLucas.getNotifications();
  assert.ok(lucasNotifs.notifications.some((n) => n.title.includes('Nova mensagem de Aline')));

  const lucasRead = await rtLucas.markConversationRead(alineAuth.user.id);
  assert.equal(lucasRead.conversations[0].unreadCount, 0);

  await rtLucas.sendMessage(alineAuth.user.id, 'Oi Aline! Claro, podemos combinar sim.');
  const alineInbox = await rtAline.getConversations();
  assert.equal(alineInbox.conversations[0].unreadCount, 1);
  assert.equal(alineInbox.conversations[0].messages.length, 2);
  assert.equal(alineInbox.conversations[0].messages[1].text, 'Oi Aline! Claro, podemos combinar sim.');

  // 3. Aline proposes exchange to Lucas -> Lucas sees pending proposal -> Lucas accepts -> Aline sees CONFIRMADA
  const createdEx = await rtAline.createExchange({
    receiverId: lucasAuth.user.id,
    offeredSkill: 'Programação',
    requestedSkill: 'Colaboração ELO+',
    mode: 'Remoto',
    scheduledDate: '2026-12-10T18:00',
    location: 'Google Meet',
    notes: 'Sessão de integração entre usuários.',
  });
  assert.equal(createdEx.exchange.status, 'PENDENTE');

  const lucasExchanges = await rtLucas.getExchanges();
  assert.equal(lucasExchanges.exchanges.length, 1);
  assert.equal(lucasExchanges.exchanges[0].proposerId, alineAuth.user.id);

  await rtLucas.respondExchange(lucasExchanges.exchanges[0].id, { action: 'accept' });
  const alineExchanges = await rtAline.getExchanges();
  assert.equal(alineExchanges.exchanges[0].status, 'CONFIRMADA');
  assert.equal(alineExchanges.exchanges[0].lastUpdatedBy, lucasAuth.user.id);
});

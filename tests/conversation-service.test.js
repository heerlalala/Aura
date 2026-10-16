const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

const servicePath = path.join(__dirname, '..', 'js', 'conversation-service.js');
const source = fs.readFileSync(servicePath, 'utf8');
const context = {
  TextEncoder,
  Date,
  Math,
  JSON,
  Object,
  Array,
  Map,
  Set,
  String,
  RegExp,
  unescape,
  encodeURIComponent,
  crypto: { randomUUID: () => 'test-id' }
};
context.globalThis = context;
vm.runInNewContext(`${source}\nglobalThis.__service = auraConversationService;`, context);
const service = context.__service;

const appSource = fs.readFileSync(path.join(__dirname, '..', 'js', 'app.js'), 'utf8');
const appContext = {
  window: { addEventListener() {}, innerWidth: 1024 },
  document: { getElementById() { return null; }, querySelectorAll() { return []; } },
  console,
  Date,
  Math,
  JSON,
  Set,
  Map,
  Array,
  Object,
  String
};
appContext.globalThis = appContext;
vm.runInNewContext(`${appSource}\nglobalThis.__app = app;`, appContext);
const controller = appContext.__app;

test('normalizes WhatsApp timestamps, speaker order, and continuation lines', () => {
  const conversation = service.normalizeTranscript(
    '12/05/2025, 10:30 PM - Taylor: Could we talk?\ncontinued message\n[12/06/2025, 9:00 AM] Alex: Yes, tomorrow.',
    { sourceName: 'chat.txt', sourceType: 'txt' }
  );
  assert.equal(conversation.messages.length, 2);
  assert.equal(conversation.messages[0].speaker, 'Taylor');
  assert.equal(conversation.messages[0].timestamp, '12/05/2025, 10:30 PM');
  assert.match(conversation.messages[0].text, /continued message/);
  assert.equal(conversation.messages[1].speaker, 'Alex');
  assert.deepEqual(Array.from(conversation.speakers), ['Taylor', 'Alex']);
});

test('normalizes JSON messages and preserves timestamps', () => {
  const conversation = service.normalizeTranscript(JSON.stringify({ messages: [
    { sender: 'Sam', text: 'I feel worried.', timestamp: '2026-01-02T10:00:00Z' },
    { speaker: 'Lee', message: 'Can we talk?', date: 'later' }
  ] }), { format: 'json', sourceName: 'chat.json' });
  assert.equal(conversation.messages.length, 2);
  assert.equal(conversation.messages[0].timestamp, '2026-01-02T10:00:00Z');
  assert.equal(conversation.sourceType, 'json');
});

test('rejects empty, malformed, and unsupported JSON structures instead of inventing a default', () => {
  assert.throws(() => service.normalizeTranscript('  '), /empty/i);
  assert.throws(() => service.normalizeTranscript('{bad', { format: 'json' }), /malformed/i);
  assert.throws(() => service.normalizeTranscript('{"items":[]}', { format: 'json' }), /messages array/i);
});

test('rejects oversized inputs', () => {
  assert.throws(() => service.normalizeTranscript('x'.repeat(service.MAX_BYTES + 1)), /1 MiB/i);
});

test('findings and recommendations reference actual source message IDs', async () => {
  const conversation = service.normalizeTranscript('Alex: You always ignore me.\nTaylor: I hear you. Can we plan a time?', { id: 'conv-a', version: 2 });
  const analysis = await service.analyzeConversation(conversation);
  assert.equal(analysis.conversationId, conversation.id);
  assert.equal(analysis.analysisVersion, 2);
  assert.equal(analysis.method, 'local-heuristic');
  const absolute = analysis.findings.find((item) => item.id === 'absolute-language');
  assert.deepEqual(Array.from(absolute.evidenceMessageIds), ['m1']);
  assert.ok(analysis.recommendations.some((item) => item.basedOnFindingIds.includes('absolute-language')));
  assert.match(analysis.limitations, /does not infer intent/i);
});

test('rejects provider results for a stale or different conversation', async () => {
  const conversation = service.normalizeTranscript('A: Hello', { id: 'conv-a', version: 4 });
  await assert.rejects(
    service.analyzeConversation(conversation, { analyze: async () => ({ conversationId: 'conv-b', analysisVersion: 4 }) }),
    /does not match/i
  );
});

test('simulator reply is tied to selected text cues and labelled fictional', () => {
  const reply = service.createPracticeReply('clarification', { speaker: 'Taylor', text: 'You never answer my texts.' });
  assert.match(reply, /response-timing concern/i);
  assert.match(reply, /Fictional practice response/i);
  assert.match(reply, /not a prediction/i);
});

test('draft review reports wording markers, not outcome probabilities', () => {
  const review = service.reviewDraft('I feel ignored. Could we talk?');
  assert.ok(review.markers.includes('uses first-person feeling language'));
  assert.ok(review.markers.includes('includes a concrete request'));
  assert.doesNotMatch(review.note, /%|probability/i);
});

test('local user state keys remain scoped to distinct Firebase UIDs', () => {
  const first = controller.storageKey.call({ currentUser: { uid: 'uid-one' } });
  const second = controller.storageKey.call({ currentUser: { uid: 'uid-two' } });
  assert.equal(first, 'aura_state_vault:uid-one');
  assert.equal(second, 'aura_state_vault:uid-two');
  assert.notEqual(first, second);
});

test('a client-controlled onboarded flag cannot route an unauthenticated user into a protected view', () => {
  let rendered = '';
  const fake = {
    currentUser: null,
    state: { onboarded: true, currentView: 'dashboard' },
    saveState() {},
    renderCurrentView() { rendered = this.state.currentView; },
    logAudit() {},
    announceA11y() {}
  };
  controller.switchView.call(fake, 'dashboard');
  assert.equal(fake.state.currentView, 'auth');
  assert.equal(rendered, 'auth');
});

test('users must complete the current onboarding questions before opening the dashboard', () => {
  let rendered = '';
  const fake = {
    currentUser: { uid: 'uid-one' },
    state: { onboarded: true, onboardingVersion: 1, currentView: 'dashboard' },
    hasCompletedOnboarding: controller.hasCompletedOnboarding,
    saveState() {},
    renderCurrentView() { rendered = this.state.currentView; },
    logAudit() {},
    announceA11y() {}
  };
  controller.switchView.call(fake, 'dashboard');
  assert.equal(fake.state.currentView, 'onboarding');
  assert.equal(rendered, 'onboarding');
});

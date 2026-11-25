import test from 'node:test';
import assert from 'node:assert/strict';
import {
  appendVoiceHistory,
  createVoiceHistoryEntry,
  extractJournalSearchTerms,
  filterVoiceHistory,
  isJournalVoiceQuery,
  parseVoiceHistoryJson,
  removeVoiceHistoryEntry,
  SEED_VOICE_HISTORY,
  updateVoiceHistoryEntry,
} from './voiceHistory';

test('isJournalVoiceQuery detects Indonesian and English journal voice commands', () => {
  assert.equal(isJournalVoiceQuery('Marvis cari jurnal AI 2024'), true);
  assert.equal(isJournalVoiceQuery('Cari paper tentang energi terbarukan'), true);
  assert.equal(isJournalVoiceQuery('Ganti tema jadi merah'), false);
  assert.equal(isJournalVoiceQuery('Apa saja', true), true);
});

test('extractJournalSearchTerms strips Indonesian command filler words and years', () => {
  assert.equal(
    extractJournalSearchTerms('Woi Marvis, cari jurnal tentang machine learning tahun 2024'),
    'machine learning',
  );
});

test('appendVoiceHistory prepends newest entry, deduplicates rapid repeats, and respects max cap', () => {
  const e1 = createVoiceHistoryEntry({
    id: 'a',
    query: 'Cek cuaca Jakarta',
    timestamp: '10.00',
    createdAt: 1000,
  });
  const e2 = createVoiceHistoryEntry({
    id: 'b',
    query: 'Cek cuaca Jakarta',
    timestamp: '10.00',
    createdAt: 5000,
  });
  const e3 = createVoiceHistoryEntry({
    id: 'c',
    query: 'Cari jurnal kesehatan 2025',
    timestamp: '10.01',
    createdAt: 20000,
  });

  const afterDup = appendVoiceHistory([e1], e2, 2);
  assert.equal(afterDup.length, 1);
  assert.equal(afterDup[0].id, 'b');

  const afterNew = appendVoiceHistory(afterDup, e3, 2);
  assert.deepEqual(
    afterNew.map((i) => i.id),
    ['c', 'b'],
  );
  assert.equal(afterNew[0].category, 'journal');
});

test('updateVoiceHistoryEntry, removeVoiceHistoryEntry, and filterVoiceHistory operate cleanly', () => {
  const updated = updateVoiceHistoryEntry(SEED_VOICE_HISTORY, 'vh-seed-3', {
    reply: 'Bandung 24 derajat.',
    actionSummary: 'Cuaca Bandung 24°C',
  });
  assert.equal(updated.find((i) => i.id === 'vh-seed-3')?.reply, 'Bandung 24 derajat.');

  const onlyJournal = filterVoiceHistory(updated, 'journal');
  assert.equal(onlyJournal.every((i) => i.category === 'journal'), true);
  assert.equal(onlyJournal.length, 2);

  const removed = removeVoiceHistoryEntry(updated, 'vh-seed-1');
  assert.equal(removed.length, SEED_VOICE_HISTORY.length - 1);
});

test('parseVoiceHistoryJson preserves explicit empty cleared list and recovers from corrupt JSON', () => {
  assert.deepEqual(parseVoiceHistoryJson('[]', SEED_VOICE_HISTORY), []);
  assert.equal(parseVoiceHistoryJson(null, SEED_VOICE_HISTORY).length, SEED_VOICE_HISTORY.length);
  assert.equal(
    parseVoiceHistoryJson('{invalid-json', SEED_VOICE_HISTORY).length,
    SEED_VOICE_HISTORY.length,
  );
});

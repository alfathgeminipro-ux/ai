import test from 'node:test';
import assert from 'node:assert/strict';
import {
  matchWakeWord,
  pickPreferredIndonesianMaleVoice,
  splitIntoSentences,
} from './voiceLogic';

test('matchWakeWord detects woi marvis and phonetic variations', () => {
  const m1 = matchWakeWord('Woi Marvis!');
  assert.equal(m1.triggered, true);
  assert.equal(m1.trailingCommand, '');

  const m2 = matchWakeWord('woy mervis ganti tema jadi merah');
  assert.equal(m2.triggered, true);
  assert.equal(m2.trailingCommand, 'ganti tema jadi merah');

  const m3 = matchWakeWord('hei marfis cek cuaca bandung');
  assert.equal(m3.triggered, true);
  assert.equal(m3.trailingCommand, 'cek cuaca bandung');

  const m4 = matchWakeWord('woi mar vis buka jurnal');
  assert.equal(m4.triggered, true);
  assert.equal(m4.trailingCommand, 'buka jurnal');
});

test('matchWakeWord ignores unrelated everyday speech', () => {
  const nonMatch = matchWakeWord('hari ini kita mau rapat desain jam dua siang');
  assert.equal(nonMatch.triggered, false);
});

test('splitIntoSentences chunks Indonesian reply cleanly for progressive TTS', () => {
  const sentences = splitIntoSentences(
    'Siap bang! Tema udah diubah ke **merah**. Ada lagi yang perlu kubantu?',
  );
  assert.deepEqual(sentences, [
    'Siap bang!',
    'Tema udah diubah ke merah.',
    'Ada lagi yang perlu kubantu?',
  ]);
});

test('pickPreferredIndonesianMaleVoice prefers Indonesian male voice over others', () => {
  const chosen = pickPreferredIndonesianMaleVoice([
    { name: 'English Female', lang: 'en-US', voiceURI: 'en-f' },
    { name: 'Microsoft Gadis Online (id-ID)', lang: 'id-ID', voiceURI: 'id-gadis' },
    { name: 'Microsoft Ardi Online (id-ID)', lang: 'id-ID', voiceURI: 'id-ardi' },
  ]);
  assert.equal(chosen?.voiceURI, 'id-ardi');
});

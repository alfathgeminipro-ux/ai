/**
 * Modul logika suara murni untuk deteksi wake word ("woi marvis" dan variasi),
 * pemecahan kalimat untuk streaming TTS, serta pemilihan suara pria bahasa Indonesia.
 */

export interface WakeWordMatch {
  triggered: boolean;
  matchedPhrase: string;
  trailingCommand: string;
}

const WAKE_PREFIXES = new Set([
  'woi',
  'woy',
  'oy',
  'oi',
  'hei',
  'hey',
  'hai',
  'hi',
  'halo',
  'hallo',
  'bro',
  'bang',
  'eh',
  'oke',
  'ok',
]);

const TARGET_NAME = 'marvis';

function normalizeIndonesianSpeech(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

function isMarvisToken(token: string): boolean {
  if (token.length < 4 || token.length > 8) return false;
  // Normalisasi bunyi f/v/p dan e/a yang sering tertukar oleh SpeechRecognition id-ID
  const phonetic = token.replace(/f/g, 'v').replace(/z/g, 's');
  if (phonetic === TARGET_NAME) return true;
  if (['mervis', 'marfis', 'marviz', 'malfis', 'malvis', 'marbis', 'jarvis'].includes(token)) {
    return true;
  }
  const dist = levenshteinDistance(phonetic, TARGET_NAME);
  return dist <= 2 && phonetic[0] === 'm';
}

/**
 * Mendeteksi apakah transkrip mengandung wake word seperti "woi marvis", "woy mervis",
 * "hei marvis", atau panggilan langsung "marvis <perintah>".
 */
export function matchWakeWord(rawTranscript: string): WakeWordMatch {
  const clean = normalizeIndonesianSpeech(rawTranscript);
  if (!clean) {
    return { triggered: false, matchedPhrase: '', trailingCommand: '' };
  }

  const tokens = clean.split(' ');

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (isMarvisToken(token)) {
      const hasPrefix = i > 0 && WAKE_PREFIXES.has(tokens[i - 1]);
      // Jika disebut sendiri tanpa prefix, pastikan memang di awal kalimat atau diikuti perintah
      if (hasPrefix || i === 0 || tokens.length <= 4) {
        const startIdx = hasPrefix ? i - 1 : i;
        const matchedPhrase = tokens.slice(startIdx, i + 1).join(' ');
        const trailingCommand = tokens.slice(i + 1).join(' ').trim();
        return {
          triggered: true,
          matchedPhrase,
          trailingCommand,
        };
      }
    }

    // Kasus SpeechRecognition memecah "mar vis" menjadi dua kata
    if (i + 1 < tokens.length && `${token}${tokens[i + 1]}` === 'marvis') {
      const hasPrefix = i > 0 && WAKE_PREFIXES.has(tokens[i - 1]);
      const startIdx = hasPrefix ? i - 1 : i;
      const matchedPhrase = tokens.slice(startIdx, i + 2).join(' ');
      const trailingCommand = tokens.slice(i + 2).join(' ').trim();
      return {
        triggered: true,
        matchedPhrase,
        trailingCommand,
      };
    }
  }

  return { triggered: false, matchedPhrase: '', trailingCommand: '' };
}

/**
 * Memecah teks respons menjadi kalimat-kalimat siap ucap untuk TTS bertahap.
 */
export function splitIntoSentences(text: string): string[] {
  const cleaned = text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/[#*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  const matches = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g);
  if (!matches) return [cleaned];

  return matches.map((s) => s.trim()).filter((s) => s.length > 0);
}

/**
 * Memilih suara TTS pria bahasa Indonesia terbaik dari daftar SpeechSynthesisVoice browser.
 */
export function pickPreferredIndonesianMaleVoice<
  T extends { name: string; lang: string; voiceURI: string },
>(voices: T[]): T | null {
  if (!voices.length) return null;

  const scoreVoice = (v: T): number => {
    const lang = v.lang.toLowerCase();
    const name = v.name.toLowerCase();
    let score = 0;

    if (lang === 'id-id' || lang.startsWith('id')) score += 100;
    else if (lang.startsWith('ms')) score += 45;

    // Prioritaskan suara pria (contoh: Ardi, Andika, Damayanti=wanita, Google Bahasa Indonesia)
    if (/(ardi|andika|pria|male|david|daniel|alex|natural|neural)/i.test(name)) score += 35;
    if (/(google|microsoft|edge|online)/i.test(name)) score += 15;
    if (/(gadis|damayanti|female|wanita|siti)/i.test(name)) score -= 20;

    return score;
  };

  const sorted = [...voices].sort((a, b) => scoreVoice(b) - scoreVoice(a));
  return sorted[0] ?? null;
}

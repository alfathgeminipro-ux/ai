import type { VoiceHistoryEntry } from '../types';

export const VOICE_HISTORY_STORAGE_KEY = 'marvis_voice_history_v1';
export const MAX_VOICE_HISTORY_ITEMS = 30;

const JOURNAL_VOICE_PATTERN =
  /\b(jurnal|paper|artikel|riset|penelitian|publikasi|sitasi|scholar|openalex|crossref)\b/i;

export const SEED_VOICE_HISTORY: VoiceHistoryEntry[] = [
  {
    id: 'vh-seed-1',
    query: 'Marvis, cari jurnal artificial intelligence tahun 2024',
    reply: 'Siap bang, ini hasil jurnal artificial intelligence tahun 2024 dari OpenAlex.',
    actionSummary: 'Jurnal "artificial intelligence" (2024–2024)',
    category: 'journal',
    journalParams: {
      query: 'artificial intelligence',
      yearStart: 2024,
      yearEnd: 2024,
    },
    timestamp: '09.15',
    createdAt: 1732410900000,
  },
  {
    id: 'vh-seed-2',
    query: 'Cari jurnal manajemen keuangan 2022 sampai 2025',
    reply: 'Oke bang, jurnal manajemen keuangan rentang 2022 sampai 2025 udah aku buka.',
    actionSummary: 'Jurnal "manajemen keuangan" (2022–2025)',
    category: 'journal',
    journalParams: {
      query: 'manajemen keuangan',
      yearStart: 2022,
      yearEnd: 2025,
    },
    timestamp: '08.40',
    createdAt: 1732408800000,
  },
  {
    id: 'vh-seed-3',
    query: 'Cek cuaca Bandung hari ini',
    reply: 'Di Bandung sekarang sejuk berawan bang, pas banget buat produktif.',
    actionSummary: 'Cuaca Bandung',
    category: 'general',
    timestamp: '08.12',
    createdAt: 1732407120000,
  },
];

/**
 * Menentukan apakah perintah suara berkaitan dengan pencarian jurnal ilmiah.
 */
export function isJournalVoiceQuery(text: string, hasJournalAction = false): boolean {
  if (hasJournalAction) return true;
  return JOURNAL_VOICE_PATTERN.test(text);
}

/**
 * Mengekstrak kata kunci bersih dari kalimat perintah suara jurnal apabila
 * parameter terstruktur dari LLM tidak tersedia.
 */
export function extractJournalSearchTerms(spokenQuery: string): string {
  const cleaned = spokenQuery
    .replace(/^(woi|woy|hei|hai|halo)?\s*marvis[,\s]*/i, '')
    .replace(/\b(tolong|coba|carikan|cari|buka|tampilkan|lihat)\b/gi, ' ')
    .replace(/\b(jurnal|paper|artikel|ilmiah|tentang|mengenai|tahun|dari|sampai|hingga)\b/gi, ' ')
    .replace(/\b20\d{2}\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || spokenQuery.trim();
}

/**
 * Membuat entri riwayat suara baru yang terstruktur.
 */
export function createVoiceHistoryEntry(params: {
  id: string;
  query: string;
  timestamp: string;
  createdAt?: number;
  category?: 'journal' | 'general';
  journalParams?: VoiceHistoryEntry['journalParams'];
}): VoiceHistoryEntry {
  const cleanedQuery = params.query.trim();
  return {
    id: params.id,
    query: cleanedQuery,
    category:
      params.category ??
      (isJournalVoiceQuery(cleanedQuery, Boolean(params.journalParams))
        ? 'journal'
        : 'general'),
    journalParams: params.journalParams,
    timestamp: params.timestamp,
    createdAt: params.createdAt ?? Date.now(),
  };
}

/**
 * Menambahkan perintah suara terbaru ke urutan teratas daftar dan membatasi jumlah tersimpan.
 */
export function appendVoiceHistory(
  list: readonly VoiceHistoryEntry[],
  next: VoiceHistoryEntry,
  maxItems = MAX_VOICE_HISTORY_ITEMS,
): VoiceHistoryEntry[] {
  const normalizedNext = next.query.trim().toLowerCase();
  const deduped = list.filter(
    (item) =>
      !(
        item.query.trim().toLowerCase() === normalizedNext &&
        Math.abs(next.createdAt - item.createdAt) < 15_000
      ),
  );
  return [next, ...deduped].slice(0, Math.max(1, maxItems));
}

/**
 * Memperbarui entri riwayat suara dengan jawaban MARVIS, ringkasan aksi, atau parameter jurnal.
 */
export function updateVoiceHistoryEntry(
  list: readonly VoiceHistoryEntry[],
  id: string,
  patch: Partial<Pick<VoiceHistoryEntry, 'reply' | 'actionSummary' | 'category' | 'journalParams'>>,
): VoiceHistoryEntry[] {
  return list.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

/**
 * Menghapus satu entri dari riwayat suara.
 */
export function removeVoiceHistoryEntry(
  list: readonly VoiceHistoryEntry[],
  id: string,
): VoiceHistoryEntry[] {
  return list.filter((item) => item.id !== id);
}

/**
 * Menyaring riwayat suara untuk tampilan Chat (semua) atau JournalSection (khusus jurnal).
 */
export function filterVoiceHistory(
  list: readonly VoiceHistoryEntry[],
  scope: 'all' | 'journal',
): VoiceHistoryEntry[] {
  if (scope === 'all') return [...list];
  return list.filter((item) => item.category === 'journal');
}

/**
 * Membaca dan memvalidasi JSON riwayat suara dari localStorage secara aman.
 * Jika pengguna sengaja mengosongkan daftar ("[]"), tetap pertahankan kosong.
 */
export function parseVoiceHistoryJson(
  raw: string | null,
  fallback: readonly VoiceHistoryEntry[] = SEED_VOICE_HISTORY,
): VoiceHistoryEntry[] {
  if (raw === null) return [...fallback];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...fallback];
    return parsed.filter(
      (item): item is VoiceHistoryEntry =>
        Boolean(item) &&
        typeof item === 'object' &&
        typeof item.id === 'string' &&
        typeof item.query === 'string' &&
        typeof item.timestamp === 'string' &&
        (item.category === 'journal' || item.category === 'general'),
    );
  } catch {
    return [...fallback];
  }
}

export function loadVoiceHistoryFromStorage(): VoiceHistoryEntry[] {
  if (typeof window === 'undefined') return [...SEED_VOICE_HISTORY];
  try {
    return parseVoiceHistoryJson(
      window.localStorage.getItem(VOICE_HISTORY_STORAGE_KEY),
      SEED_VOICE_HISTORY,
    );
  } catch {
    return [...SEED_VOICE_HISTORY];
  }
}

export function saveVoiceHistoryToStorage(list: readonly VoiceHistoryEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(VOICE_HISTORY_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Abaikan kuota penyimpanan penuh
  }
}

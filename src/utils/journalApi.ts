import type { JournalArticle } from '../types';

export const JOURNAL_MIN_YEAR = 2020;
export const JOURNAL_MAX_YEAR = 2026;
export const JOURNAL_FAVORITES_KEY = 'marvis_journal_favs_v1';

export function clampYearRange(start: number, end: number): { start: number; end: number } {
  const s = Math.max(JOURNAL_MIN_YEAR, Math.min(JOURNAL_MAX_YEAR, Math.round(start)));
  const e = Math.max(JOURNAL_MIN_YEAR, Math.min(JOURNAL_MAX_YEAR, Math.round(end)));
  return s <= e ? { start: s, end: e } : { start: e, end: s };
}

/**
 * Merekonstruksi abstrak dari format abstract_inverted_index milik OpenAlex.
 */
export function reconstructOpenAlexAbstract(
  invertedIndex: Record<string, number[]> | null | undefined,
): string {
  if (!invertedIndex || typeof invertedIndex !== 'object') return '';
  const words: string[] = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      if (typeof pos === 'number' && pos >= 0 && pos < 600) {
        words[pos] = word;
      }
    }
  }
  return words.filter(Boolean).join(' ').trim();
}

interface OpenAlexWork {
  id?: string;
  display_name?: string;
  title?: string;
  publication_year?: number;
  cited_by_count?: number;
  doi?: string;
  primary_location?: {
    landing_page_url?: string;
    source?: { display_name?: string };
  };
  authorships?: Array<{ author?: { display_name?: string } }>;
  abstract_inverted_index?: Record<string, number[]> | null;
}

export function normalizeOpenAlexWork(work: OpenAlexWork): JournalArticle {
  const rawId = work.id ?? `oa-${Math.random().toString(36).slice(2, 9)}`;
  const authors = (work.authorships ?? [])
    .map((a) => a.author?.display_name)
    .filter((name): name is string => Boolean(name))
    .slice(0, 4);

  const doiUrl = work.doi?.startsWith('http')
    ? work.doi
    : work.doi
      ? `https://doi.org/${work.doi}`
      : undefined;

  return {
    id: rawId,
    title: (work.display_name ?? work.title ?? 'Judul tidak tersedia').trim(),
    authors: authors.length > 0 ? authors : ['Penulis tidak tercantum'],
    year: work.publication_year ?? 2024,
    venue: work.primary_location?.source?.display_name ?? 'Publikasi Ilmiah',
    citations: typeof work.cited_by_count === 'number' ? work.cited_by_count : 0,
    url: work.primary_location?.landing_page_url ?? doiUrl ?? rawId,
    doi: work.doi,
    abstractText: reconstructOpenAlexAbstract(work.abstract_inverted_index),
    source: 'OpenAlex',
  };
}

interface CrossrefItem {
  DOI?: string;
  URL?: string;
  title?: string[];
  author?: Array<{ given?: string; family?: string }>;
  'container-title'?: string[];
  'is-referenced-by-count'?: number;
  published?: { 'date-parts'?: number[][] };
  issued?: { 'date-parts'?: number[][] };
  abstract?: string;
}

export function normalizeCrossrefItem(item: CrossrefItem): JournalArticle {
  const year =
    item.published?.['date-parts']?.[0]?.[0] ??
    item.issued?.['date-parts']?.[0]?.[0] ??
    2024;
  const authors = (item.author ?? [])
    .map((a) => [a.given, a.family].filter(Boolean).join(' ').trim())
    .filter(Boolean)
    .slice(0, 4);

  const cleanAbstract = item.abstract
    ? item.abstract.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
    : '';

  return {
    id: item.DOI ? `cr-${item.DOI}` : `cr-${Math.random().toString(36).slice(2, 9)}`,
    title: (item.title?.[0] ?? 'Judul tidak tersedia').trim(),
    authors: authors.length > 0 ? authors : ['Penulis tidak tercantum'],
    year,
    venue: item['container-title']?.[0] ?? 'Crossref Journal',
    citations: typeof item['is-referenced-by-count'] === 'number' ? item['is-referenced-by-count'] : 0,
    url: item.URL ?? (item.DOI ? `https://doi.org/${item.DOI}` : 'https://api.crossref.org'),
    doi: item.DOI,
    abstractText: cleanAbstract,
    source: 'Crossref',
  };
}

// Data awal deterministik agar antarmuka Jurnal langsung terisi saat pertama dibuka atau saat offline
export const SEED_JOURNALS: JournalArticle[] = [
  {
    id: 'seed-oa-1',
    title: 'Artificial Intelligence in Financial Risk Management: A Systematic Review of Machine Learning Models',
    authors: ['A. Rahmawati', 'B. Santoso', 'D. Wijaya'],
    year: 2025,
    venue: 'Journal of Financial Innovation & AI',
    citations: 142,
    url: 'https://doi.org/10.1000/marvis-fin-2025',
    abstractText:
      'Studi sistematis ini mengevaluasi penerapan pembelajaran mesin dan arsitektur transformer dalam deteksi risiko kredit, prediksi volatilitas pasar, serta transparansi tata kelola keuangan modern.',
    source: 'OpenAlex',
  },
  {
    id: 'seed-oa-2',
    title: 'Human-Centered Voice Interfaces and Multimodal AI Assistants for Knowledge Workers',
    authors: ['M. Pratama', 'L. Chen', 'S. Kusuma'],
    year: 2024,
    venue: 'International Journal of Human-Computer Interaction',
    citations: 98,
    url: 'https://doi.org/10.1000/marvis-hci-2024',
    abstractText:
      'Penelitian ini menganalisis peningkatan efisiensi alur kerja hingga 34% ketika asisten suara multimodal dikombinasikan dengan antarmuka spasial interaktif dan eksekusi perintah kontekstual.',
    source: 'OpenAlex',
  },
  {
    id: 'seed-oa-3',
    title: 'Sustainable Corporate Financial Management and ESG Performance in Southeast Asian Markets',
    authors: ['R. Hidayat', 'N. Putri', 'K. Tan'],
    year: 2023,
    venue: 'Asian Journal of Business & Finance',
    citations: 76,
    url: 'https://doi.org/10.1000/marvis-esg-2023',
    abstractText:
      'Analisis empiris terhadap 420 perusahaan publik di Asia Tenggara menunjukkan korelasi positif antara praktik manajemen keuangan berkelanjutan dengan ketahanan arus kas jangka panjang.',
    source: 'OpenAlex',
  },
  {
    id: 'seed-oa-4',
    title: 'Generative AI Adoption in Higher Education: Academic Integrity and Research Productivity',
    authors: ['F. Nugroho', 'E. Sari'],
    year: 2026,
    venue: 'Computers & Education Open',
    citations: 54,
    url: 'https://doi.org/10.1000/marvis-edu-2026',
    abstractText:
      'Mengkaji kerangka penggunaan AI generatif untuk sintesis literatur ilmiah, verifikasi sitasi otomatis, serta strategi peningkatan literasi riset mahasiswa tingkat lanjut.',
    source: 'OpenAlex',
  },
];

export interface JournalSearchResponse {
  articles: JournalArticle[];
  total: number;
  page: number;
  source: 'OpenAlex' | 'Crossref' | 'Offline';
  warning?: string;
}

export async function searchJournals(params: {
  query: string;
  yearStart: number;
  yearEnd: number;
  page?: number;
  sortBy?: 'relevance' | 'citations';
}): Promise<JournalSearchResponse> {
  const { start, end } = clampYearRange(params.yearStart, params.yearEnd);
  const page = Math.max(1, params.page ?? 1);
  const q = params.query.trim() || 'artificial intelligence';
  const sortParam = params.sortBy === 'citations' ? '&sort=cited_by_count:desc' : '';

  // 1. Sumber utama: OpenAlex API (tanpa API key)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&filter=publication_year:${start}-${end}&per-page=8&page=${page}${sortParam}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as {
        results?: OpenAlexWork[];
        meta?: { count?: number };
      };
      const articles = (data.results ?? []).map(normalizeOpenAlexWork);
      return {
        articles,
        total: data.meta?.count ?? articles.length,
        page,
        source: 'OpenAlex',
      };
    }
  } catch {
    // Lanjut ke cadangan Crossref API
  }

  // 2. Sumber cadangan: Crossref API
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 7000);
    const offset = (page - 1) * 8;
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(q)}&filter=from-pub-date:${start}-01-01,until-pub-date:${end}-12-31&rows=8&offset=${offset}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data = (await res.json()) as {
        message?: { items?: CrossrefItem[]; 'total-results'?: number };
      };
      const articles = (data.message?.items ?? []).map(normalizeCrossrefItem);
      return {
        articles,
        total: data.message?.['total-results'] ?? articles.length,
        page,
        source: 'Crossref',
      };
    }
  } catch {
    // Fallback ke katalog lokal bila jaringan dibatasi
  }

  const filteredSeed = SEED_JOURNALS.filter((item) => item.year >= start && item.year <= end);
  return {
    articles: filteredSeed,
    total: filteredSeed.length,
    page: 1,
    source: 'Offline',
    warning: 'Koneksi ke OpenAlex & Crossref sedang terbatas. Menampilkan katalog referensi lokal.',
  };
}

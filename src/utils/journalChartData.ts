import type { JournalArticle } from '../types';
import { clampYearRange } from './journalApi';

export interface JournalYearBucket {
  year: number;
  paperCount: number;
  citedPaperCount: number;
  uncitedPaperCount: number;
  totalCitations: number;
  avgCitations: number;
  topPaperTitle: string | null;
  topPaperCitations: number;
}

export interface JournalCitationSummary {
  buckets: JournalYearBucket[];
  totalPapers: number;
  totalCitedPapers: number;
  totalCitations: number;
  peakYear: number | null;
  peakCitations: number;
  peakCitedYear: number | null;
  peakCitedCount: number;
}

/**
 * Mengagregasi distribusi artikel tersitasi dan total sitasi per tahun
 * sesuai rentang filter tahun yang aktif (2020–2026).
 */
export function buildJournalYearDistribution(
  articles: JournalArticle[],
  yearStart: number,
  yearEnd: number,
): JournalCitationSummary {
  const { start, end } = clampYearRange(yearStart, yearEnd);
  const map = new Map<number, JournalYearBucket>();

  for (let y = start; y <= end; y++) {
    map.set(y, {
      year: y,
      paperCount: 0,
      citedPaperCount: 0,
      uncitedPaperCount: 0,
      totalCitations: 0,
      avgCitations: 0,
      topPaperTitle: null,
      topPaperCitations: 0,
    });
  }

  for (const art of articles) {
    const bucket = map.get(art.year);
    if (!bucket) continue;
    const cites = Math.max(0, Number.isFinite(art.citations) ? art.citations : 0);
    bucket.paperCount += 1;
    if (cites > 0) {
      bucket.citedPaperCount += 1;
    } else {
      bucket.uncitedPaperCount += 1;
    }
    bucket.totalCitations += cites;
    if (bucket.topPaperTitle === null || cites > bucket.topPaperCitations) {
      bucket.topPaperTitle = art.title;
      bucket.topPaperCitations = cites;
    }
  }

  const buckets: JournalYearBucket[] = [];
  let totalPapers = 0;
  let totalCitedPapers = 0;
  let totalCitations = 0;
  let peakYear: number | null = null;
  let peakCitations = 0;
  let peakCitedYear: number | null = null;
  let peakCitedCount = 0;

  for (let y = start; y <= end; y++) {
    const b = map.get(y)!;
    b.avgCitations = b.paperCount > 0 ? Math.round((b.totalCitations / b.paperCount) * 10) / 10 : 0;
    buckets.push(b);

    totalPapers += b.paperCount;
    totalCitedPapers += b.citedPaperCount;
    totalCitations += b.totalCitations;

    if (b.totalCitations > peakCitations) {
      peakCitations = b.totalCitations;
      peakYear = b.year;
    }
    if (b.citedPaperCount > peakCitedCount) {
      peakCitedCount = b.citedPaperCount;
      peakCitedYear = b.year;
    }
  }

  return {
    buckets,
    totalPapers,
    totalCitedPapers,
    totalCitations,
    peakYear,
    peakCitations,
    peakCitedYear,
    peakCitedCount,
  };
}

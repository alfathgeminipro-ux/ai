import test from 'node:test';
import assert from 'node:assert/strict';
import type { JournalArticle } from '../types';
import { buildJournalYearDistribution } from './journalChartData';

const SAMPLE: JournalArticle[] = [
  {
    id: '1',
    title: 'Paper A',
    authors: ['A'],
    year: 2022,
    venue: 'V1',
    citations: 40,
    url: 'https://example.com/1',
    source: 'OpenAlex',
  },
  {
    id: '2',
    title: 'Paper B',
    authors: ['B'],
    year: 2022,
    venue: 'V2',
    citations: 0,
    url: 'https://example.com/2',
    source: 'OpenAlex',
  },
  {
    id: '3',
    title: 'Paper C',
    authors: ['C'],
    year: 2024,
    venue: 'V3',
    citations: 95,
    url: 'https://example.com/3',
    source: 'OpenAlex',
  },
  {
    id: '4',
    title: 'Out of Range',
    authors: ['D'],
    year: 2026,
    venue: 'V4',
    citations: 200,
    url: 'https://example.com/4',
    source: 'OpenAlex',
  },
];

test('buildJournalYearDistribution fills every year in filter range and computes cited counts', () => {
  const res = buildJournalYearDistribution(SAMPLE, 2022, 2024);
  assert.deepEqual(
    res.buckets.map((b) => b.year),
    [2022, 2023, 2024],
  );
  assert.equal(res.buckets[0].paperCount, 2);
  assert.equal(res.buckets[0].citedPaperCount, 1);
  assert.equal(res.buckets[0].uncitedPaperCount, 1);
  assert.equal(res.buckets[0].totalCitations, 40);
  assert.equal(res.buckets[0].avgCitations, 20);
  assert.equal(res.buckets[1].paperCount, 0);
  assert.equal(res.buckets[2].totalCitations, 95);
  assert.equal(res.totalPapers, 3);
  assert.equal(res.totalCitedPapers, 2);
  assert.equal(res.totalCitations, 135);
  assert.equal(res.peakYear, 2024);
  assert.equal(res.peakCitedYear, 2022);
  assert.equal(res.peakCitedCount, 1);
});

test('buildJournalYearDistribution handles single-year selection cleanly', () => {
  const res = buildJournalYearDistribution(SAMPLE, 2024, 2024);
  assert.equal(res.buckets.length, 1);
  assert.equal(res.buckets[0].year, 2024);
  assert.equal(res.buckets[0].topPaperTitle, 'Paper C');
});

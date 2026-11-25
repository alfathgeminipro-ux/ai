import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampYearRange,
  normalizeCrossrefItem,
  normalizeOpenAlexWork,
  reconstructOpenAlexAbstract,
} from './journalApi';

test('clampYearRange enforces 2020-2026 bounds and ascending order', () => {
  assert.deepEqual(clampYearRange(2015, 2030), { start: 2020, end: 2026 });
  assert.deepEqual(clampYearRange(2025, 2022), { start: 2022, end: 2025 });
});

test('reconstructOpenAlexAbstract restores word ordering from inverted index', () => {
  const abstract = reconstructOpenAlexAbstract({
    Manajemen: [0],
    keuangan: [1],
    berbasis: [2],
    AI: [3],
  });
  assert.equal(abstract, 'Manajemen keuangan berbasis AI');
});

test('normalizeOpenAlexWork and normalizeCrossrefItem produce uniform JournalArticle', () => {
  const oa = normalizeOpenAlexWork({
    id: 'https://openalex.org/W123',
    display_name: 'Deep Learning Ekonomi',
    publication_year: 2023,
    cited_by_count: 42,
    doi: 'https://doi.org/10.1234/abc',
    authorships: [{ author: { display_name: 'Alfath' } }],
    primary_location: { source: { display_name: 'Jurnal Riset' } },
  });
  assert.equal(oa.title, 'Deep Learning Ekonomi');
  assert.equal(oa.year, 2023);
  assert.equal(oa.citations, 42);
  assert.equal(oa.authors[0], 'Alfath');

  const cr = normalizeCrossrefItem({
    DOI: '10.5555/test',
    title: ['Sistem Cerdas'],
    author: [{ given: 'Budi', family: 'Pratama' }],
    'container-title': ['IEEE Nusantara'],
    'is-referenced-by-count': 19,
    published: { 'date-parts': [[2024]] },
  });
  assert.equal(cr.title, 'Sistem Cerdas');
  assert.equal(cr.authors[0], 'Budi Pratama');
  assert.equal(cr.year, 2024);
});

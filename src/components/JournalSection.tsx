import React, { useEffect, useMemo, useState } from 'react';
import {
  Bookmark,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Search,
  Sparkles,
} from 'lucide-react';
import type { JournalArticle, VoiceHistoryEntry } from '../types';
import {
  JOURNAL_MAX_YEAR,
  JOURNAL_MIN_YEAR,
} from '../utils/journalApi';
import { extractJournalSearchTerms } from '../utils/voiceHistory';
import { LiquidCard } from './LiquidCard';
import { JournalCitationChart } from './JournalCitationChart';
import { VoiceHistoryPanel } from './VoiceHistoryPanel';

interface JournalSectionProps {
  query: string;
  yearStart: number;
  yearEnd: number;
  articles: JournalArticle[];
  total: number;
  page: number;
  loading: boolean;
  sourceLabel: string;
  warning?: string;
  favorites: JournalArticle[];
  voiceHistory: VoiceHistoryEntry[];
  playingVoiceId: string | null;
  onSearch: (params: {
    query: string;
    yearStart: number;
    yearEnd: number;
    page: number;
    sortBy: 'relevance' | 'citations';
  }) => void;
  onToggleFavorite: (article: JournalArticle) => void;
  onSummarizeWithMarvis: (article: JournalArticle) => void;
  onPlaybackVoiceEntry: (entry: VoiceHistoryEntry) => void;
  onStopVoicePlayback: () => void;
  onRerunVoiceEntry: (entry: VoiceHistoryEntry) => void;
  onDeleteVoiceEntry: (id: string) => void;
  onClearVoiceHistory: () => void;
  onStartVoiceListening?: () => void;
}

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025, 2026];

export function JournalSection({
  query,
  yearStart,
  yearEnd,
  articles,
  total,
  page,
  loading,
  sourceLabel,
  warning,
  favorites,
  voiceHistory,
  playingVoiceId,
  onSearch,
  onToggleFavorite,
  onSummarizeWithMarvis,
  onPlaybackVoiceEntry,
  onStopVoicePlayback,
  onRerunVoiceEntry,
  onDeleteVoiceEntry,
  onClearVoiceHistory,
  onStartVoiceListening,
}: JournalSectionProps) {
  const [inputQuery, setInputQuery] = useState(query);
  const [localStart, setLocalStart] = useState(yearStart);
  const [localEnd, setLocalEnd] = useState(yearEnd);
  const [sortBy, setSortBy] = useState<'relevance' | 'citations'>('relevance');
  const [viewMode, setViewMode] = useState<'all' | 'favorites'>('all');

  useEffect(() => {
    setInputQuery(query);
  }, [query]);

  useEffect(() => {
    setLocalStart(yearStart);
    setLocalEnd(yearEnd);
  }, [yearStart, yearEnd]);

  // Sinkronkan perubahan rentang tahun dan kata kunci secara dinamis ke hasil & grafik D3
  useEffect(() => {
    const nextStart = Math.min(localStart, localEnd);
    const nextEnd = Math.max(localStart, localEnd);
    const trimmedInput = inputQuery.trim();
    const trimmedActive = query.trim();

    const rangeChanged = nextStart !== yearStart || nextEnd !== yearEnd;
    const queryChanged = trimmedInput !== trimmedActive && trimmedInput.length >= 2;
    if (!rangeChanged && !queryChanged) return undefined;

    const delayMs = rangeChanged ? 300 : 550;
    const timer = window.setTimeout(() => {
      setViewMode('all');
      onSearch({
        query: trimmedInput || trimmedActive,
        yearStart: nextStart,
        yearEnd: nextEnd,
        page: 1,
        sortBy,
      });
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [localStart, localEnd, yearStart, yearEnd, inputQuery, query, sortBy, onSearch]);

  const favIds = useMemo(() => new Set(favorites.map((f) => f.id)), [favorites]);

  const displayedArticles = viewMode === 'favorites' ? favorites : articles;

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    setViewMode('all');
    onSearch({
      query: inputQuery,
      yearStart: Math.min(localStart, localEnd),
      yearEnd: Math.max(localStart, localEnd),
      page: 1,
      sortBy,
    });
  };

  const handleYearChipClick = (yr: number) => {
    setViewMode('all');
    // Jika chip tahun yang sama diklik dua kali, buka kembali rentang penuh 2020-2026
    if (localStart === yr && localEnd === yr) {
      setLocalStart(JOURNAL_MIN_YEAR);
      setLocalEnd(JOURNAL_MAX_YEAR);
      onSearch({
        query: inputQuery,
        yearStart: JOURNAL_MIN_YEAR,
        yearEnd: JOURNAL_MAX_YEAR,
        page: 1,
        sortBy,
      });
    } else {
      setLocalStart(yr);
      setLocalEnd(yr);
      onSearch({
        query: inputQuery,
        yearStart: yr,
        yearEnd: yr,
        page: 1,
        sortBy,
      });
    }
  };

  return (
    <div className="space-y-5">
      <LiquidCard
        title="Pencarian Jurnal Ilmiah (2020–2026)"
        subtitle="Sumber terbuka OpenAlex & Crossref — cari topik, filter rentang tahun, atau minta Marvis meringkas."
        headerRight={
          <div className="flex items-center gap-1 rounded-xl bg-white/[0.06] p-1 border border-white/10">
            <button
              type="button"
              onClick={() => setViewMode('all')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                viewMode === 'all'
                  ? 'bg-white/15 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Hasil ({total.toLocaleString('id-ID')})
            </button>
            <button
              type="button"
              onClick={() => setViewMode('favorites')}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                viewMode === 'favorites'
                  ? 'bg-white/15 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Favorit ({favorites.length})
            </button>
          </div>
        }
      >
        <form onSubmit={submitSearch} className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <label htmlFor="journal-search-input" className="sr-only">
                Kata kunci jurnal ilmiah
              </label>
              <input
                id="journal-search-input"
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Cari jurnal: manajemen keuangan, AI kesehatan, energi terbarukan..."
                className="w-full rounded-2xl border border-white/15 bg-white/[0.06] py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-slate-400 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                aria-label="Urutkan hasil jurnal"
                value={sortBy}
                onChange={(e) => {
                  const nextSort = e.target.value as 'relevance' | 'citations';
                  setSortBy(nextSort);
                  onSearch({
                    query: inputQuery,
                    yearStart: Math.min(localStart, localEnd),
                    yearEnd: Math.max(localStart, localEnd),
                    page: 1,
                    sortBy: nextSort,
                  });
                }}
                className="rounded-2xl border border-white/15 bg-[#0c1428] px-3.5 py-2.5 text-xs font-medium text-slate-200 focus:border-[var(--accent)] focus:outline-none"
              >
                <option value="relevance">Paling Relevan</option>
                <option value="citations">Sitasi Terbanyak</option>
              </select>

              <button
                type="submit"
                className="marvis-accent-btn rounded-2xl px-5 py-2.5 text-xs font-semibold text-white whitespace-nowrap shrink-0"
              >
                Cari Jurnal
              </button>
            </div>
          </div>

          {/* Filter rentang tahun 2020-2026: Slider + Chip tahun */}
          <div className="grid gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-2">
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs text-slate-300">
                <span>Rentang Tahun Publikasi</span>
                <span className="font-mono-tabular font-semibold text-white">
                  {Math.min(localStart, localEnd)} – {Math.max(localStart, localEnd)}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-[11px] text-slate-400">
                  Dari tahun ({localStart})
                  <input
                    type="range"
                    min={JOURNAL_MIN_YEAR}
                    max={JOURNAL_MAX_YEAR}
                    value={localStart}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setLocalStart(v);
                      if (v > localEnd) setLocalEnd(v);
                    }}
                    className="mt-1 w-full accent-[var(--accent)]"
                  />
                </label>
                <label className="text-[11px] text-slate-400">
                  Sampai tahun ({localEnd})
                  <input
                    type="range"
                    min={JOURNAL_MIN_YEAR}
                    max={JOURNAL_MAX_YEAR}
                    value={localEnd}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setLocalEnd(v);
                      if (v < localStart) setLocalStart(v);
                    }}
                    className="mt-1 w-full accent-[var(--accent)]"
                  />
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <span className="block text-xs text-slate-300">Pilih Cepat Tahun</span>
              <div className="flex flex-wrap gap-1.5">
                {YEARS.map((yr) => {
                  const active = yr >= Math.min(localStart, localEnd) && yr <= Math.max(localStart, localEnd);
                  const singleSelected = localStart === yr && localEnd === yr;
                  return (
                    <button
                      key={yr}
                      type="button"
                      onClick={() => handleYearChipClick(yr)}
                      className={`font-mono-tabular rounded-xl px-3 py-1.5 text-xs font-medium transition-all ${
                        singleSelected
                          ? 'bg-[var(--accent)] text-white shadow-sm'
                          : active
                            ? 'bg-white/12 text-white border border-white/20'
                            : 'bg-white/[0.04] text-slate-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {yr}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>
              Sumber aktif: <strong className="font-medium text-slate-200">{sourceLabel}</strong>
              <span aria-hidden="true"> · </span>
              Perintah suara: &ldquo;Marvis, cari jurnal manajemen keuangan tahun 2023&rdquo;
            </span>
            {warning && <span className="text-amber-300">{warning}</span>}
          </div>
        </form>
      </LiquidCard>

      {/* Visualisasi D3.js Distribusi Jurnal Tersitasi per Tahun */}
      <JournalCitationChart
        articles={displayedArticles}
        yearStart={Math.min(localStart, localEnd)}
        yearEnd={Math.max(localStart, localEnd)}
        loading={loading && viewMode === 'all'}
        viewMode={viewMode}
        onSelectYear={handleYearChipClick}
      />

      {/* Log Riwayat Suara Jurnal (localStorage) */}
      <VoiceHistoryPanel
        entries={voiceHistory}
        defaultScope="journal"
        playingEntryId={playingVoiceId}
        onPlaybackEntry={onPlaybackVoiceEntry}
        onStopPlayback={onStopVoicePlayback}
        onRerunEntry={(entry) => {
          if (entry.journalParams) {
            setViewMode('all');
            setInputQuery(entry.journalParams.query);
            setLocalStart(entry.journalParams.yearStart);
            setLocalEnd(entry.journalParams.yearEnd);
            onSearch({
              query: entry.journalParams.query,
              yearStart: entry.journalParams.yearStart,
              yearEnd: entry.journalParams.yearEnd,
              page: 1,
              sortBy,
            });
          } else if (entry.category === 'journal') {
            const terms = extractJournalSearchTerms(entry.query);
            setViewMode('all');
            setInputQuery(terms);
            onSearch({
              query: terms,
              yearStart: Math.min(localStart, localEnd),
              yearEnd: Math.max(localStart, localEnd),
              page: 1,
              sortBy,
            });
          } else {
            onRerunVoiceEntry(entry);
          }
        }}
        onDeleteEntry={onDeleteVoiceEntry}
        onClearAll={onClearVoiceHistory}
        onStartListening={onStartVoiceListening}
        compact
      />

      {/* Daftar Hasil Jurnal */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2" aria-label="Memuat jurnal ilmiah">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="liquid-card p-5 space-y-3"
            >
              <div className="marvis-skeleton h-5 w-4/5 rounded-lg" />
              <div className="marvis-skeleton h-4 w-3/5 rounded-lg" />
              <div className="marvis-skeleton h-12 w-full rounded-xl" />
              <div className="flex gap-2 pt-1">
                <div className="marvis-skeleton h-9 w-24 rounded-xl" />
                <div className="marvis-skeleton h-9 w-40 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      ) : displayedArticles.length === 0 ? (
        <LiquidCard>
          <div className="py-10 text-center space-y-2">
            <BookOpen className="mx-auto h-8 w-8 text-slate-400" />
            <h3 className="font-display text-base font-semibold text-white">
              {viewMode === 'favorites'
                ? 'Belum ada jurnal favorit tersimpan'
                : 'Tidak ada jurnal yang cocok'}
            </h3>
            <p className="text-sm text-slate-400 max-w-md mx-auto">
              {viewMode === 'favorites'
                ? 'Klik tombol Simpan pada jurnal yang menarik agar mudah diakses kapan saja.'
                : 'Coba perluas rentang tahun 2020–2026 atau gunakan kata kunci dalam bahasa Inggris/Indonesia.'}
            </p>
          </div>
        </LiquidCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {displayedArticles.map((art) => {
            const isFav = favIds.has(art.id);
            return (
              <LiquidCard key={art.id} className="flex flex-col justify-between gap-4">
                <div className="space-y-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-display text-[15px] font-semibold leading-snug text-white">
                      {art.title}
                    </h3>
                    <button
                      type="button"
                      onClick={() => onToggleFavorite(art)}
                      aria-label={isFav ? `Hapus favorit ${art.title}` : `Simpan favorit ${art.title}`}
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border transition-colors ${
                        isFav
                          ? 'border-[var(--accent)] bg-[var(--accent)]/20 text-[var(--accent-2)]'
                          : 'border-white/10 bg-white/[0.04] text-slate-400 hover:text-white'
                      }`}
                    >
                      <Bookmark className="h-4 w-4" fill={isFav ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  {/* Metadata bersih tanpa kotak pill */}
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-300">
                    <span className="truncate max-w-[260px]">{art.authors.join(', ')}</span>
                    <span aria-hidden="true" className="text-slate-500">·</span>
                    <span className="font-mono-tabular text-white font-medium">{art.year}</span>
                    <span aria-hidden="true" className="text-slate-500">·</span>
                    <span className="truncate max-w-[220px] text-slate-400">{art.venue}</span>
                    <span aria-hidden="true" className="text-slate-500">·</span>
                    <span className="font-mono-tabular text-[var(--accent-2)]">
                      {art.citations.toLocaleString('id-ID')} sitasi
                    </span>
                  </div>

                  {art.abstractText && (
                    <p className="text-xs leading-relaxed text-slate-400 line-clamp-3">
                      {art.abstractText}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                  <a
                    href={art.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.06] px-3.5 py-2 text-xs font-medium text-white hover:bg-white/12 transition-colors whitespace-nowrap"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Buka
                  </a>
                  <button
                    type="button"
                    onClick={() => onSummarizeWithMarvis(art)}
                    className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-white transition-all whitespace-nowrap"
                    style={{
                      background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent) 85%, transparent), color-mix(in srgb, var(--accent-2) 70%, transparent))',
                    }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Ringkas dengan Marvis
                  </button>
                </div>
              </LiquidCard>
            );
          })}
        </div>
      )}

      {/* Pagination halus */}
      {viewMode === 'all' && !loading && articles.length > 0 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-slate-400 font-mono-tabular">
            Halaman {page} · Menampilkan {articles.length} jurnal
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() =>
                onSearch({
                  query: inputQuery,
                  yearStart: Math.min(localStart, localEnd),
                  yearEnd: Math.max(localStart, localEnd),
                  page: Math.max(1, page - 1),
                  sortBy,
                })
              }
              className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/[0.05] px-3.5 py-2 text-xs font-medium text-slate-200 disabled:opacity-40 hover:bg-white/10 transition-colors"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              Sebelumnya
            </button>
            <button
              type="button"
              onClick={() =>
                onSearch({
                  query: inputQuery,
                  yearStart: Math.min(localStart, localEnd),
                  yearEnd: Math.max(localStart, localEnd),
                  page: page + 1,
                  sortBy,
                })
              }
              className="inline-flex items-center gap-1 rounded-xl border border-white/15 bg-white/[0.05] px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors"
            >
              Berikutnya
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

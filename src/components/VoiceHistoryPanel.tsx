import { useMemo, useState } from 'react';
import {
  History,
  Mic,
  Play,
  RotateCcw,
  Square,
  Trash2,
  Volume2,
} from 'lucide-react';
import type { VoiceHistoryEntry } from '../types';
import { filterVoiceHistory } from '../utils/voiceHistory';
import { LiquidCard } from './LiquidCard';

interface VoiceHistoryPanelProps {
  entries: VoiceHistoryEntry[];
  defaultScope?: 'all' | 'journal';
  playingEntryId: string | null;
  onPlaybackEntry: (entry: VoiceHistoryEntry) => void;
  onStopPlayback: () => void;
  onRerunEntry: (entry: VoiceHistoryEntry) => void;
  onDeleteEntry: (id: string) => void;
  onClearAll: () => void;
  onStartListening?: () => void;
  compact?: boolean;
}

/**
 * Panel Riwayat Suara (Voice History) berbasis localStorage untuk meninjau,
 * memutar ulang via TTS, dan menjalankan kembali perintah suara di tampilan Chat maupun Jurnal.
 */
export function VoiceHistoryPanel({
  entries,
  defaultScope = 'all',
  playingEntryId,
  onPlaybackEntry,
  onStopPlayback,
  onRerunEntry,
  onDeleteEntry,
  onClearAll,
  onStartListening,
  compact = false,
}: VoiceHistoryPanelProps) {
  const [scope, setScope] = useState<'all' | 'journal'>(defaultScope);

  const visibleEntries = useMemo(
    () => filterVoiceHistory(entries, scope),
    [entries, scope],
  );

  const journalCount = useMemo(
    () => entries.filter((e) => e.category === 'journal').length,
    [entries],
  );

  return (
    <LiquidCard
      title="Riwayat Suara"
      subtitle={
        scope === 'journal'
          ? 'Perintah suara pencarian jurnal tersimpan lokal · putar ulang atau cari kembali'
          : 'Log perintah suara MARVIS tersimpan lokal · putar ulang atau jalankan kembali'
      }
      headerRight={
        <div className="flex items-center gap-1.5">
          <div
            role="group"
            aria-label="Filter kategori riwayat suara"
            className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.06] p-1"
          >
            <button
              type="button"
              onClick={() => setScope('all')}
              aria-pressed={scope === 'all'}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                scope === 'all'
                  ? 'bg-white/15 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Semua ({entries.length})
            </button>
            <button
              type="button"
              onClick={() => setScope('journal')}
              aria-pressed={scope === 'journal'}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors ${
                scope === 'journal'
                  ? 'bg-white/15 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Jurnal ({journalCount})
            </button>
          </div>

          {entries.length > 0 && (
            <button
              type="button"
              onClick={onClearAll}
              aria-label="Hapus semua riwayat suara"
              title="Hapus semua riwayat suara"
              className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 hover:border-red-400/40 hover:bg-red-500/15 hover:text-red-200 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      }
    >
      <div data-testid="voice-history-panel" data-scope={scope} className="space-y-3">
        {visibleEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/12 bg-white/[0.02] px-4 py-7 text-center">
            <History className="h-6 w-6 text-slate-500 mb-2" />
            <p className="text-xs font-medium text-slate-300">
              {scope === 'journal'
                ? 'Belum ada perintah suara jurnal tersimpan'
                : 'Belum ada riwayat perintah suara'}
            </p>
            <p className="mt-1 max-w-xs text-[11px] text-slate-400">
              Ucapkan &ldquo;Woi Marvis&rdquo; atau ketuk tombol mikrofon untuk merekam perintah suara otomatis.
            </p>
            {onStartListening && (
              <button
                type="button"
                onClick={onStartListening}
                className="mt-3 inline-flex items-center gap-1.5 rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/15 px-3.5 py-1.5 text-xs font-medium text-white hover:bg-[var(--accent)]/25 transition-colors"
              >
                <Mic className="h-3.5 w-3.5 text-[var(--accent-2)]" />
                Mulai Perintah Suara
              </button>
            )}
          </div>
        ) : (
          <ul
            className={`space-y-2.5 overflow-y-auto marvis-scroll pr-1 ${
              compact ? 'max-h-[280px]' : 'max-h-[460px]'
            }`}
            aria-label="Daftar riwayat perintah suara"
          >
            {visibleEntries.map((entry) => {
              const isPlaying = playingEntryId === entry.id;
              return (
                <li
                  key={entry.id}
                  data-testid="voice-history-item"
                  data-entry-id={entry.id}
                  data-playing={isPlaying ? 'true' : 'false'}
                  className={`rounded-2xl border p-3.5 transition-colors ${
                    isPlaying
                      ? 'border-[var(--accent-2)]/60 bg-[var(--accent)]/12'
                      : 'border-white/10 bg-white/[0.035] hover:border-white/20 hover:bg-white/[0.055]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="min-w-0 flex-1 space-y-1">
                      <p className="text-xs sm:text-[13px] font-medium leading-snug text-white break-words">
                        &ldquo;{entry.query}&rdquo;
                      </p>

                      {/* Metadata bersih tanpa pill box */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-400">
                        <span className="font-mono-tabular text-slate-300">{entry.timestamp}</span>
                        <span aria-hidden="true" className="text-slate-600">·</span>
                        <span className="text-[var(--accent-2)]">
                          {entry.category === 'journal' ? 'Jurnal' : 'Umum'}
                        </span>
                        {entry.actionSummary && (
                          <>
                            <span aria-hidden="true" className="text-slate-600">·</span>
                            <span className="truncate max-w-[240px] text-slate-300">
                              {entry.actionSummary}
                            </span>
                          </>
                        )}
                      </div>

                      {entry.reply && (
                        <p className="text-[11px] leading-relaxed text-slate-400 line-clamp-2 pt-0.5">
                          MARVIS: {entry.reply}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => onDeleteEntry(entry.id)}
                      aria-label={`Hapus riwayat suara ${entry.query}`}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-white/10 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Aksi Putar Ulang & Jalankan Kembali */}
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() =>
                        isPlaying ? onStopPlayback() : onPlaybackEntry(entry)
                      }
                      aria-label={
                        isPlaying
                          ? `Hentikan pemutaran ${entry.query}`
                          : `Putar ulang suara ${entry.query}`
                      }
                      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                        isPlaying
                          ? 'bg-[var(--accent)] text-white'
                          : 'border border-white/12 bg-white/[0.06] text-slate-100 hover:bg-white/12'
                      }`}
                    >
                      {isPlaying ? (
                        <>
                          <Square className="h-3 w-3 fill-current" />
                          Hentikan
                        </>
                      ) : (
                        <>
                          <Play className="h-3 w-3 fill-current" />
                          Putar Suara
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => onRerunEntry(entry)}
                      aria-label={`Jalankan ulang perintah ${entry.query}`}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-white/12 bg-white/[0.04] px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:border-[var(--accent-2)]/50 hover:bg-white/10 hover:text-white transition-colors whitespace-nowrap"
                    >
                      <RotateCcw className="h-3 w-3" />
                      {entry.category === 'journal' ? 'Cari Ulang Jurnal' : 'Jalankan Ulang'}
                    </button>

                    {isPlaying && (
                      <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-[var(--accent-2)]">
                        <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                        Memutar...
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </LiquidCard>
  );
}

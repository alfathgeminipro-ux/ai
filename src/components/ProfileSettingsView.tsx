import React, { useState } from 'react';
import { Check, Eye, EyeOff, RotateCcw, Volume2 } from 'lucide-react';
import type { LayoutConfig, ThemePalette, VoiceSettings, WidgetId } from '../types';
import { PRESET_THEMES } from '../utils/themeEngine';
import { LiquidCard } from './LiquidCard';

interface ProfileSettingsViewProps {
  activeTheme: ThemePalette;
  onSelectTheme: (theme: ThemePalette) => void;
  onApplyCustomColor: (colorInput: string) => void;
  voiceSettings: VoiceSettings;
  onUpdateVoiceSettings: (patch: Partial<VoiceSettings>) => void;
  availableVoices: SpeechSynthesisVoice[];
  onTestVoice: () => void;
  speechSupported: boolean;
  isSecure: boolean;
  layoutConfig: LayoutConfig;
  onToggleWidgetVisibility: (id: WidgetId) => void;
  onResetLayout: () => void;
}

const WIDGET_LABELS: Record<WidgetId, string> = {
  greeting: 'Kartu Sapaan & Waveform',
  'ai-tools': 'AI Tools',
  shortcuts: 'Smart Shortcuts',
  'avatar-chat': 'Avatar 3D & Panel Chat',
  weather: 'Cuaca (Open-Meteo)',
  insights: 'AI Insights & Produktivitas',
  schedule: 'Jadwal Hari Ini',
  devices: 'Connected Devices',
  trending: 'Topik Trending',
  journal: 'Jurnal Ilmiah',
};

export function ProfileSettingsView({
  activeTheme,
  onSelectTheme,
  onApplyCustomColor,
  voiceSettings,
  onUpdateVoiceSettings,
  availableVoices,
  onTestVoice,
  speechSupported,
  isSecure,
  layoutConfig,
  onToggleWidgetVisibility,
  onResetLayout,
}: ProfileSettingsViewProps) {
  const [customInput, setCustomInput] = useState(activeTheme.accent);

  const handleCustomSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customInput.trim()) return;
    onApplyCustomColor(customInput.trim());
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {/* Tema Warna Dinamis */}
      <LiquidCard
        title="Tema Warna & Hologram"
        subtitle="Seluruh kartu, cahaya tepi, partikel, grafik, dan avatar 3D bertransisi halus dalam 600ms."
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            {PRESET_THEMES.map((theme) => {
              const isSelected = activeTheme.id === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => onSelectTheme(theme)}
                  aria-pressed={isSelected}
                  className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left transition-all ${
                    isSelected
                      ? 'border-white/40 bg-white/14'
                      : 'border-white/10 bg-white/[0.04] hover:bg-white/[0.09]'
                  }`}
                >
                  <span
                    className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-white/30"
                    style={{
                      background: `linear-gradient(135deg, ${theme.accent}, ${theme.accent2})`,
                    }}
                  >
                    {isSelected && <Check className="h-3 w-3 text-slate-950" />}
                  </span>
                  <span className="text-xs font-medium text-white truncate">{theme.name}</span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleCustomSubmit} className="flex flex-wrap items-center gap-2.5 pt-1">
            <label htmlFor="custom-theme-color" className="text-xs text-slate-300">
              Warna bebas / Hex:
            </label>
            <input
              type="color"
              aria-label="Pemilih warna tema"
              value={activeTheme.accent}
              onChange={(e) => {
                setCustomInput(e.target.value);
                onApplyCustomColor(e.target.value);
              }}
              className="h-9 w-11 cursor-pointer rounded-xl border border-white/15 bg-transparent p-0.5"
            />
            <input
              id="custom-theme-color"
              type="text"
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="tosca, kuning, atau #ff5500"
              className="flex-1 min-w-[150px] rounded-xl border border-white/15 bg-white/[0.06] px-3 py-2 text-xs text-white font-mono-tabular focus:border-[var(--accent)] focus:outline-none"
            />
            <button
              type="submit"
              className="marvis-accent-btn rounded-xl px-4 py-2 text-xs font-semibold text-white whitespace-nowrap"
            >
              Terapkan
            </button>
          </form>
        </div>
      </LiquidCard>

      {/* Pengaturan Suara & Wake Word */}
      <LiquidCard
        title="Suara MARVIS & Wake Word"
        subtitle='Panggil "Woi Marvis" untuk memicu jawaban langsung "Nape bang?" lalu ucapkan perintahmu.'
      >
        <div className="space-y-4">
          {!speechSupported && (
            <div className="rounded-2xl border border-amber-400/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              Browser ini tidak mendukung Web Speech API. Untuk perintah suara real-time, gunakan Chrome, Edge, atau Safari versi terbaru.
            </div>
          )}
          {!isSecure && (
            <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200">
              Akses mikrofon memerlukan koneksi HTTPS atau localhost.
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="tts-voice-select" className="text-xs font-medium text-slate-300">
              Pilihan Suara TTS (Cadangan Perangkat)
            </label>
            <select
              id="tts-voice-select"
              value={voiceSettings.voiceURI}
              onChange={(e) => onUpdateVoiceSettings({ voiceURI: e.target.value })}
              className="w-full rounded-2xl border border-white/15 bg-[#0c1428] px-3.5 py-2.5 text-xs text-white focus:border-[var(--accent)] focus:outline-none"
            >
              <option value="">Otomatis (Suara Pria Indonesia Terbaik)</option>
              {availableVoices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name} ({v.lang})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="space-y-1 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>Pitch</span>
                <span className="font-mono-tabular text-white">{voiceSettings.pitch.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.55"
                max="1.35"
                step="0.05"
                value={voiceSettings.pitch}
                onChange={(e) => onUpdateVoiceSettings({ pitch: Number(e.target.value) })}
                className="w-full accent-[var(--accent)]"
              />
            </label>

            <label className="space-y-1 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>Kecepatan</span>
                <span className="font-mono-tabular text-white">{voiceSettings.rate.toFixed(2)}x</span>
              </div>
              <input
                type="range"
                min="0.7"
                max="1.5"
                step="0.05"
                value={voiceSettings.rate}
                onChange={(e) => onUpdateVoiceSettings({ rate: Number(e.target.value) })}
                className="w-full accent-[var(--accent)]"
              />
            </label>

            <label className="space-y-1 text-xs text-slate-300">
              <div className="flex justify-between">
                <span>Volume</span>
                <span className="font-mono-tabular text-white">
                  {Math.round(voiceSettings.volume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={voiceSettings.volume}
                onChange={(e) => onUpdateVoiceSettings({ volume: Number(e.target.value) })}
                className="w-full accent-[var(--accent)]"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap gap-4">
              <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voiceSettings.wakeWordEnabled}
                  onChange={(e) =>
                    onUpdateVoiceSettings({ wakeWordEnabled: e.target.checked })
                  }
                  className="h-4 w-4 rounded accent-[var(--accent)]"
                />
                Aktifkan Wake Word &ldquo;Woi Marvis&rdquo;
              </label>

              <label className="inline-flex items-center gap-2 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={voiceSettings.autoSpeak}
                  onChange={(e) => onUpdateVoiceSettings({ autoSpeak: e.target.checked })}
                  className="h-4 w-4 rounded accent-[var(--accent)]"
                />
                Bacakan jawaban otomatis
              </label>
            </div>

            <button
              type="button"
              onClick={onTestVoice}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.08] px-3.5 py-2 text-xs font-semibold text-white hover:bg-white/15 transition-colors whitespace-nowrap"
            >
              <Volume2 className="h-3.5 w-3.5" />
              Tes Suara
            </button>
          </div>
        </div>
      </LiquidCard>

      {/* Manajemen Widget & Tata Letak */}
      <LiquidCard
        title="Tata Letak Widget Dashboard"
        subtitle="Tampilkan, sembunyikan, atau reset urutan kartu widget yang tersimpan di perangkat."
        headerRight={
          <button
            type="button"
            onClick={onResetLayout}
            className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.07] px-3 py-1.5 text-xs font-medium text-white hover:bg-white/14 transition-colors whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset Layout
          </button>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {(Object.keys(WIDGET_LABELS) as WidgetId[]).map((id) => {
            const isHidden = layoutConfig.hidden.includes(id);
            const isLocked = id === 'avatar-chat';
            return (
              <button
                key={id}
                type="button"
                disabled={isLocked}
                onClick={() => onToggleWidgetVisibility(id)}
                className={`flex items-center justify-between rounded-2xl border px-3.5 py-2.5 text-left text-xs transition-colors ${
                  isHidden
                    ? 'border-white/8 bg-white/[0.02] text-slate-500'
                    : 'border-white/14 bg-white/[0.06] text-slate-100 hover:bg-white/[0.1]'
                } disabled:opacity-65 disabled:cursor-not-allowed`}
              >
                <span className="truncate">{WIDGET_LABELS[id]}</span>
                {isHidden ? (
                  <EyeOff className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                ) : (
                  <Eye className="h-3.5 w-3.5 shrink-0 text-[var(--accent-2)]" />
                )}
              </button>
            );
          })}
        </div>
      </LiquidCard>

      {/* Profil & Panduan Perintah Suara */}
      <LiquidCard
        title="Profil Alfath & Daftar Perintah Cepat"
        subtitle="Contoh kalimat santai yang langsung dijalankan oleh otak AI MARVIS."
      >
        <div className="space-y-3 text-xs text-slate-300">
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              '"Ganti tema jadi merah / warna tosca / mode neon"',
              '"Cari jurnal manajemen keuangan tahun 2023"',
              '"Cek cuaca Bandung hari ini"',
              '"Tambah jadwal review desain jam 15:30"',
              '"Sembunyikan widget trending"',
              '"Reset layout dashboard"',
            ].map((cmd) => (
              <div
                key={cmd}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-slate-200"
              >
                {cmd}
              </div>
            ))}
          </div>

          <p className="text-[11px] leading-relaxed text-slate-400 pt-1">
            Seluruh panggilan AI diproses melalui server proxy Node Express (<code className="font-mono-tabular text-slate-200">/api/chat</code>) sehingga kredensial tetap aman di sisi server. Siap dideploy ke Cloud Run, Vercel, atau Netlify dengan variabel lingkungan server.
          </p>
        </div>
      </LiquidCard>
    </div>
  );
}

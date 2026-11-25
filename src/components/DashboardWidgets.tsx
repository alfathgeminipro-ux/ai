import React, { useState } from 'react';
import {
  BarChart3,
  BookOpen,
  CalendarClock,
  Check,
  CloudSun,
  Code2,
  Droplets,
  FileText,
  GraduationCap,
  Languages,
  Laptop,
  Lightbulb,
  Mail,
  Palette,
  PenTool,
  Plus,
  Search,
  Speaker,
  TrendingUp,
  Wind,
  AirVent,
} from 'lucide-react';
import type {
  ConnectedDevice,
  JournalArticle,
  MarvisState,
  ScheduleItem,
  WeatherData,
} from '../types';
import { AudioWaveform } from './AudioWaveform';

/* ========= 1. Greeting Widget ========= */
export function GreetingWidgetContent({
  state,
  analyser,
  speechLevelRef,
  interimTranscript,
  micActive,
  awaitingCommand,
}: {
  state: MarvisState;
  analyser: AnalyserNode | null;
  speechLevelRef: React.MutableRefObject<number>;
  interimTranscript: string;
  micActive: boolean;
  awaitingCommand: boolean;
}) {
  const statusCopy: Record<MarvisState, string> = {
    idle: micActive
      ? 'Siaga — sebut "Woi Marvis" untuk memanggil'
      : 'Siaga — ketuk tombol mikrofon atau ketik perintah',
    listening: awaitingCommand
      ? 'Mendengarkan perintahmu, bang...'
      : 'Mendengarkan...',
    thinking: 'Berpikir & memproses perintah...',
    speaking: 'Berbicara...',
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-white leading-snug text-balance">
          Halo, Alfath — Mau menyelesaikan apa hari ini?
        </h1>
        <p className="text-xs text-slate-300">{statusCopy[state]}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.035] px-3 py-2.5">
        <AudioWaveform
          state={state}
          analyser={analyser}
          speechLevelRef={speechLevelRef}
        />
        {interimTranscript && (
          <p className="mt-1.5 text-center text-xs text-[var(--accent-2)] truncate">
            &ldquo;{interimTranscript}&rdquo;
          </p>
        )}
      </div>
    </div>
  );
}

/* ========= 2. AI Tools Widget ========= */
const AI_TOOLS = [
  { id: 'ringkas', label: 'Ringkas', icon: FileText, prompt: 'Ringkas poin-poin penting dari catatan rapat hari ini dengan singkat bang.' },
  { id: 'terjemah', label: 'Terjemah', icon: Languages, prompt: 'Terjemahkan kalimat ini ke bahasa Inggris profesional: Kami siap meluncurkan pembaruan minggu depan.' },
  { id: 'tulis', label: 'Tulis', icon: PenTool, prompt: 'Bantu tulis draf pesan singkat untuk mengajak tim sinkronisasi proyek sore ini.' },
  { id: 'analisis', label: 'Analisis', icon: BarChart3, prompt: 'Berikan analisis singkat tren adopsi AI untuk produktivitas mahasiswa dan profesional tahun 2026.' },
  { id: 'desain', label: 'Desain', icon: Palette, prompt: 'Berikan 3 ide palet warna antarmuka futuristik gelap yang elegan dan nyaman di mata.' },
  { id: 'kode', label: 'Kode', icon: Code2, prompt: 'Buatkan contoh fungsi TypeScript singkat untuk debounce input pencarian.' },
];

export function AiToolsWidgetContent({
  onSelectTool,
}: {
  onSelectTool: (label: string, prompt: string) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-2.5">
      {AI_TOOLS.map((tool) => {
        const Icon = tool.icon;
        return (
          <button
            key={tool.id}
            type="button"
            onClick={() => onSelectTool(tool.label, tool.prompt)}
            className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-2 py-3.5 text-center transition-all hover:border-[var(--accent)]/50 hover:bg-white/[0.09] active:scale-[0.98]"
          >
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 transition-colors"
              style={{
                background: 'color-mix(in srgb, var(--accent) 18%, rgba(255,255,255,0.04))',
                color: 'var(--accent-2)',
              }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <span className="text-xs font-medium text-slate-200 group-hover:text-white whitespace-nowrap">
              {tool.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ========= 3. Smart Shortcuts Widget ========= */
const SMART_SHORTCUTS = [
  {
    id: 'meeting',
    title: 'Ringkasan Rapat',
    desc: 'Susun notulen & tindak lanjut',
    icon: FileText,
    prompt: 'Buatkan template ringkasan rapat produk singkat lengkap dengan action items.',
  },
  {
    id: 'email',
    title: 'Asisten Email',
    desc: 'Balas cepat & rapi',
    icon: Mail,
    prompt: 'Buatkan draf email follow-up santai tapi profesional untuk menanyakan progres proposal.',
  },
  {
    id: 'study',
    title: 'Study Helper',
    desc: 'Bedah materi & kuis cepat',
    icon: GraduationCap,
    prompt: 'Jelaskan konsep Machine Learning dan Deep Learning dengan analogi sederhana dalam 3 kalimat.',
  },
  {
    id: 'plan',
    title: 'Rencanakan Hariku',
    desc: 'Atur prioritas fokus',
    icon: CalendarClock,
    prompt: 'Bantu susun rencana prioritas kerja hari ini berdasarkan jadwalku agar tetap fokus.',
  },
];

export function ShortcutsWidgetContent({
  onRunShortcut,
}: {
  onRunShortcut: (title: string, prompt: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
      {SMART_SHORTCUTS.map((sc) => {
        const Icon = sc.icon;
        return (
          <button
            key={sc.id}
            type="button"
            onClick={() => onRunShortcut(sc.title, sc.prompt)}
            className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-left transition-all hover:border-[var(--accent)]/45 hover:bg-white/[0.09] active:scale-[0.98]"
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: 'color-mix(in srgb, var(--accent) 18%, rgba(255,255,255,0.05))',
                color: 'var(--accent-2)',
              }}
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">{sc.title}</div>
              <div className="text-[11px] text-slate-400 truncate">{sc.desc}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ========= 4. Cuaca Widget (Open-Meteo) ========= */
export function WeatherWidgetContent({
  weather,
  loading,
  onSearchCity,
}: {
  weather: WeatherData;
  loading: boolean;
  onSearchCity: (city: string) => void;
}) {
  const [cityInput, setCityInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cityInput.trim()) return;
    onSearchCity(cityInput.trim());
    setCityInput('');
  };

  return (
    <div className="space-y-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-white tabular-nums">
              {loading ? '--' : `${weather.temperature}°C`}
            </span>
            <span className="text-xs text-slate-400 tabular-nums">
              Terasa {weather.apparentTemp}°
            </span>
          </div>
          <p className="mt-1 text-sm font-medium text-slate-200">
            {weather.city}
            {weather.country ? `, ${weather.country}` : ''}
          </p>
          <p className="text-xs text-slate-400">{weather.condition}</p>
        </div>

        <div className="flex flex-col items-end gap-1.5 text-xs text-slate-300 tabular-nums">
          <CloudSun className="h-7 w-7 text-[var(--accent-2)]" />
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
            <Droplets className="h-3 w-3" /> {weather.humidity}%
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
            <Wind className="h-3 w-3" /> {weather.windSpeed} km/j
          </span>
        </div>
      </div>

      {/* Perkiraan per jam */}
      <div className="grid grid-cols-5 gap-1.5 border-t border-white/10 pt-3 text-center">
        {weather.hourly.slice(0, 5).map((slot) => (
          <div key={slot.time} className="rounded-xl bg-white/[0.035] py-2 px-1">
            <div className="font-mono-tabular text-[10px] text-slate-400">{slot.time}</div>
            <div className="font-mono-tabular mt-1 text-xs font-semibold text-white">
              {slot.temp}°
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <label htmlFor="weather-city-input" className="sr-only">
          Cari kota cuaca
        </label>
        <input
          id="weather-city-input"
          type="text"
          value={cityInput}
          onChange={(e) => setCityInput(e.target.value)}
          placeholder="Ganti kota (mis. Bandung)..."
          className="w-full rounded-xl border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs text-white placeholder:text-slate-400 focus:border-[var(--accent)] focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Cek cuaca kota"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/[0.07] text-slate-200 hover:bg-white/15 transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
        </button>
      </form>
    </div>
  );
}

/* ========= 5. AI Insights Widget ========= */
const PRODUCTIVITY_POINTS = [
  { day: 'Sen', value: 74 },
  { day: 'Sel', value: 82 },
  { day: 'Rab', value: 78 },
  { day: 'Kam', value: 89 },
  { day: 'Jum', value: 94 },
  { day: 'Sab', value: 86 },
  { day: 'Min', value: 91 },
];

export function InsightsWidgetContent({
  completedTasks,
  totalTasks,
}: {
  completedTasks: number;
  totalTasks: number;
}) {
  const score = Math.min(99, 82 + completedTasks * 3);
  const maxVal = 100;
  const width = 260;
  const height = 84;
  const padX = 10;
  const padY = 10;

  const coords = PRODUCTIVITY_POINTS.map((p, idx) => {
    const x = padX + (idx / (PRODUCTIVITY_POINTS.length - 1)) * (width - padX * 2);
    const y = height - padY - (p.value / maxVal) * (height - padY * 2);
    return { x, y, ...p };
  });

  const linePath = coords
    .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(1)} ${height} L ${coords[0].x.toFixed(1)} ${height} Z`;

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <span className="text-xs text-slate-400">Skor Produktivitas</span>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-3xl font-bold text-white tabular-nums">
              {score}
            </span>
            <span className="text-xs text-emerald-400 font-mono-tabular">+12% minggu ini</span>
          </div>
        </div>
        <div className="text-right text-xs text-slate-400 font-mono-tabular">
          <div className="text-white font-medium">
            {completedTasks}/{totalTasks} selesai
          </div>
          <div>Fokus 5,4 jam</div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-2.5">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-20 w-full overflow-visible"
          role="img"
          aria-label="Grafik tren produktivitas 7 hari terakhir"
        >
          <defs>
            <linearGradient id="marvis-insight-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.45" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
            </linearGradient>
          </defs>
          <path d={areaPath} fill="url(#marvis-insight-fill)" />
          <path
            d={linePath}
            fill="none"
            stroke="var(--accent-2)"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {coords.map((c) => (
            <circle
              key={c.day}
              cx={c.x}
              cy={c.y}
              r="3"
              fill="#ffffff"
              stroke="var(--accent)"
              strokeWidth="1.5"
            />
          ))}
        </svg>
        <div className="mt-1 flex justify-between px-1 text-[10px] text-slate-400 font-mono-tabular">
          {PRODUCTIVITY_POINTS.map((p) => (
            <span key={p.day}>{p.day}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ========= 6. Jadwal Hari Ini Widget ========= */
export function ScheduleWidgetContent({
  items,
  onToggle,
  onAdd,
}: {
  items: ScheduleItem[];
  onToggle: (id: string) => void;
  onAdd: (title: string, time: string) => void;
}) {
  const [title, setTitle] = useState('');
  const [time, setTime] = useState('16:00');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onAdd(title.trim(), time || '16:00');
    setTitle('');
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2 max-h-52 overflow-y-auto marvis-scroll pr-1">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between gap-2.5 rounded-2xl border border-white/8 bg-white/[0.035] px-3 py-2.5"
          >
            <button
              type="button"
              onClick={() => onToggle(item.id)}
              aria-label={`Tandai selesai ${item.title}`}
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                item.done
                  ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                  : 'border-white/25 hover:border-white/50'
              }`}
            >
              {item.done && <Check className="h-3.5 w-3.5" />}
            </button>
            <div className="min-w-0 flex-1">
              <div
                className={`text-xs font-medium truncate ${
                  item.done ? 'line-through text-slate-500' : 'text-slate-100'
                }`}
              >
                {item.title}
              </div>
              <div className="text-[11px] text-slate-400">
                {item.category}
                {item.isReminder ? ' · Pengingat' : ''}
              </div>
            </div>
            <span className="font-mono-tabular text-xs text-[var(--accent-2)] shrink-0">
              {item.time}
            </span>
          </li>
        ))}
      </ul>

      <form onSubmit={submit} className="flex items-center gap-2 pt-1">
        <label htmlFor="schedule-title-input" className="sr-only">
          Tambah jadwal baru
        </label>
        <input
          id="schedule-title-input"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Tambah agenda hari ini..."
          className="flex-1 min-w-0 rounded-xl border border-white/12 bg-white/[0.05] px-3 py-1.5 text-xs text-white placeholder:text-slate-400 focus:border-[var(--accent)] focus:outline-none"
        />
        <input
          aria-label="Jam jadwal"
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="w-[82px] shrink-0 rounded-xl border border-white/12 bg-[#0c1428] px-2 py-1.5 text-xs text-slate-200 font-mono-tabular focus:border-[var(--accent)] focus:outline-none"
        />
        <button
          type="submit"
          aria-label="Simpan jadwal"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl marvis-accent-btn text-white"
        >
          <Plus className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

/* ========= 7. Connected Devices Widget ========= */
export function DevicesWidgetContent({
  devices,
  onToggleDevice,
}: {
  devices: ConnectedDevice[];
  onToggleDevice: (id: string) => void;
}) {
  const iconFor = (type: ConnectedDevice['type']) => {
    switch (type) {
      case 'light':
        return Lightbulb;
      case 'ac':
        return AirVent;
      case 'laptop':
        return Laptop;
      case 'speaker':
        return Speaker;
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2.5">
      {devices.map((dev) => {
        const Icon = iconFor(dev.type);
        return (
          <button
            key={dev.id}
            type="button"
            onClick={() => onToggleDevice(dev.id)}
            aria-pressed={dev.active}
            className={`flex flex-col justify-between gap-2.5 rounded-2xl border p-3 text-left transition-all ${
              dev.active
                ? 'border-[var(--accent)]/50 bg-[var(--accent)]/12'
                : 'border-white/10 bg-white/[0.035] hover:bg-white/[0.07]'
            }`}
          >
            <div className="flex items-center justify-between w-full">
              <Icon
                className={`h-4 w-4 ${dev.active ? 'text-[var(--accent-2)]' : 'text-slate-400'}`}
              />
              <span
                className={`text-[10px] font-medium ${
                  dev.active ? 'text-[var(--accent-2)]' : 'text-slate-500'
                }`}
              >
                {dev.active ? 'Aktif' : 'Nonaktif'}
              </span>
            </div>
            <div>
              <div className="text-xs font-semibold text-white truncate">{dev.name}</div>
              <div className="text-[11px] text-slate-400 truncate">
                {dev.room} · {dev.detail}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ========= 8. Trending Widget ========= */
const TRENDING_ITEMS = [
  {
    title: 'Agen AI Multimodal Real-Time 2026',
    meta: 'Teknologi · 18,4rb dibahas',
    prompt: 'Jelaskan secara singkat apa tren terbaru agen AI multimodal real-time di tahun 2026.',
  },
  {
    title: 'Riset Keuangan Berkelanjutan & ESG',
    meta: 'Ekonomi · 9,2rb dibahas',
    prompt: 'Ringkas kenapa strategi ESG makin penting dalam manajemen keuangan perusahaan.',
  },
  {
    title: 'Antarmuka Spasial & Liquid Glass UI',
    meta: 'Desain · 12,7rb dibahas',
    prompt: 'Apa prinsip desain utama dari gaya antarmuka Liquid Glass modern?',
  },
];

export function TrendingWidgetContent({
  onAskTopic,
}: {
  onAskTopic: (prompt: string) => void;
}) {
  return (
    <div className="divide-y divide-white/8">
      {TRENDING_ITEMS.map((item) => (
        <button
          key={item.title}
          type="button"
          onClick={() => onAskTopic(item.prompt)}
          className="flex w-full items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0 text-left hover:text-[var(--accent-2)] transition-colors group"
        >
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-100 group-hover:text-white truncate">
              {item.title}
            </div>
            <div className="text-[11px] text-slate-400 mt-0.5">{item.meta}</div>
          </div>
          <TrendingUp className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-[var(--accent-2)]" />
        </button>
      ))}
    </div>
  );
}

/* ========= 9. Jurnal Preview Widget ========= */
export function JournalPreviewWidgetContent({
  articles,
  onOpenJournalTab,
  onSummarize,
}: {
  articles: JournalArticle[];
  onOpenJournalTab: () => void;
  onSummarize: (art: JournalArticle) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2.5">
        {articles.slice(0, 2).map((art) => (
          <div
            key={art.id}
            className="rounded-2xl border border-white/10 bg-white/[0.035] p-3 space-y-1.5"
          >
            <div className="text-xs font-semibold text-white line-clamp-2 leading-snug">
              {art.title}
            </div>
            <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400">
              <span className="truncate">
                {art.authors[0]} · <span className="font-mono-tabular text-slate-200">{art.year}</span>
              </span>
              <button
                type="button"
                onClick={() => onSummarize(art)}
                className="text-[var(--accent-2)] hover:underline whitespace-nowrap shrink-0 font-medium"
              >
                Ringkas
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={onOpenJournalTab}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/[0.06] py-2 text-xs font-semibold text-white hover:bg-white/12 transition-colors"
      >
        <BookOpen className="h-3.5 w-3.5" />
        Buka Pencarian Jurnal 2020–2026
      </button>
    </div>
  );
}

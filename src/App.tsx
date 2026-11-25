import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Home,
  MessageSquare,
  Mic,
  MicOff,
  RotateCcw,
  User,
  Wrench,
  X,
} from 'lucide-react';
import type {
  ChatMessage,
  ConnectedDevice,
  JournalArticle,
  LayoutConfig,
  MarvisAction,
  NavTab,
  ScheduleItem,
  ThemePalette,
  VoiceHistoryEntry,
  VoiceSettings,
  WeatherData,
  WidgetId,
} from './types';
import {
  applyThemeToDocument,
  loadSavedTheme,
  resolveTheme,
  saveTheme,
} from './utils/themeEngine';
import {
  clampYearRange,
  JOURNAL_FAVORITES_KEY,
  JOURNAL_MAX_YEAR,
  JOURNAL_MIN_YEAR,
  searchJournals,
  SEED_JOURNALS,
} from './utils/journalApi';
import {
  appendVoiceHistory,
  createVoiceHistoryEntry,
  loadVoiceHistoryFromStorage,
  removeVoiceHistoryEntry,
  saveVoiceHistoryToStorage,
  updateVoiceHistoryEntry,
} from './utils/voiceHistory';
import { FALLBACK_WEATHER, fetchWeatherForCity } from './utils/weatherApi';
import { useMarvisVoice } from './hooks/useMarvisVoice';
import { StarfieldBackground } from './components/StarfieldBackground';
import { LiquidCard } from './components/LiquidCard';
import { AvatarChatCard } from './components/AvatarChatCard';
import {
  AiToolsWidgetContent,
  DevicesWidgetContent,
  GreetingWidgetContent,
  InsightsWidgetContent,
  JournalPreviewWidgetContent,
  ScheduleWidgetContent,
  ShortcutsWidgetContent,
  TrendingWidgetContent,
  WeatherWidgetContent,
} from './components/DashboardWidgets';
import { JournalSection } from './components/JournalSection';
import { ProfileSettingsView } from './components/ProfileSettingsView';
import { VoiceHistoryPanel } from './components/VoiceHistoryPanel';

const LAYOUT_STORAGE_KEY = 'marvis_layout_v1';
const VOICE_STORAGE_KEY = 'marvis_voice_v1';

const DEFAULT_WIDGET_ORDER: WidgetId[] = [
  'greeting',
  'avatar-chat',
  'weather',
  'ai-tools',
  'journal',
  'insights',
  'shortcuts',
  'trending',
  'schedule',
  'devices',
];

const DEFAULT_LAYOUT: LayoutConfig = {
  order: DEFAULT_WIDGET_ORDER,
  hidden: [],
};

const DEFAULT_VOICE_SETTINGS: VoiceSettings = {
  voiceURI: '',
  rate: 1.0,
  pitch: 0.82,
  volume: 1.0,
  wakeWordEnabled: true,
  autoSpeak: true,
};

const INITIAL_SCHEDULE: ScheduleItem[] = [
  { id: 'sc-1', title: 'Sinkronisasi Proyek MARVIS', time: '09:30', category: 'Rapat', done: true },
  { id: 'sc-2', title: 'Review Literatur Jurnal AI 2025', time: '13:00', category: 'Fokus', done: false },
  { id: 'sc-3', title: 'Presentasi Desain Liquid Glass', time: '15:30', category: 'Rapat', done: false },
];

const INITIAL_DEVICES: ConnectedDevice[] = [
  { id: 'dev-1', name: 'Lampu Ruang Kerja', room: 'Studio', detail: '75% Hangat', active: true, type: 'light' },
  { id: 'dev-2', name: 'AC Kamar', room: 'Kamar', detail: '22°C Eco', active: true, type: 'ac' },
  { id: 'dev-3', name: 'MacBook Pro Alfath', room: 'Meja', detail: 'Baterai 92%', active: true, type: 'laptop' },
  { id: 'dev-4', name: 'Speaker Studio', room: 'Studio', detail: 'Siaga', active: false, type: 'speaker' },
];

function nowTimeLabel(): string {
  return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}

function loadLayout(): LayoutConfig {
  try {
    const raw = window.localStorage.getItem(LAYOUT_STORAGE_KEY);
    if (!raw) return DEFAULT_LAYOUT;
    const parsed = JSON.parse(raw) as LayoutConfig;
    if (Array.isArray(parsed.order) && parsed.order.length === DEFAULT_WIDGET_ORDER.length) {
      return {
        order: parsed.order,
        hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
      };
    }
  } catch {
    // Abaikan data tidak valid
  }
  return DEFAULT_LAYOUT;
}

function loadVoiceSettings(): VoiceSettings {
  try {
    const raw = window.localStorage.getItem(VOICE_STORAGE_KEY);
    if (!raw) return DEFAULT_VOICE_SETTINGS;
    return { ...DEFAULT_VOICE_SETTINGS, ...(JSON.parse(raw) as Partial<VoiceSettings>) };
  } catch {
    return DEFAULT_VOICE_SETTINGS;
  }
}

function loadFavorites(): JournalArticle[] {
  try {
    const raw = window.localStorage.getItem(JOURNAL_FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as JournalArticle[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export default function App() {
  // Deteksi ?autostart=1 untuk langsung membuka dashboard utama
  const autoStart = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('autostart') === '1';
  }, []);

  const [activated, setActivated] = useState(autoStart);
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [activeTheme, setActiveTheme] = useState<ThemePalette>(() => loadSavedTheme());
  const [layoutConfig, setLayoutConfig] = useState<LayoutConfig>(() => loadLayout());
  const [voiceSettings, setVoiceSettings] = useState<VoiceSettings>(() => loadVoiceSettings());
  const [lowPower, setLowPower] = useState(false);

  // State percakapan & streaming kata demi kata
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'assistant',
      text: 'Yo bang Alfath! MARVIS siap bantu. Panggil "Woi Marvis" atau klik chip cepat di bawah buat ganti tema, cek cuaca, sampai cari jurnal 2020–2026.',
      timestamp: nowTimeLabel(),
    },
  ]);
  const [streamingText, setStreamingText] = useState('');
  const [latestBubble, setLatestBubble] = useState(
    'Siap bang Alfath! Mau beresin apa hari ini?',
  );
  const streamTimerRef = useRef<number | null>(null);

  // State Cuaca (Open-Meteo)
  const [weather, setWeather] = useState<WeatherData>(FALLBACK_WEATHER);
  const [weatherLoading, setWeatherLoading] = useState(false);

  // State Jadwal & Perangkat
  const [schedule, setSchedule] = useState<ScheduleItem[]>(INITIAL_SCHEDULE);
  const [devices, setDevices] = useState<ConnectedDevice[]>(INITIAL_DEVICES);

  // State Jurnal (OpenAlex + Crossref)
  const [journalQuery, setJournalQuery] = useState('artificial intelligence');
  const [journalYearStart, setJournalYearStart] = useState(JOURNAL_MIN_YEAR);
  const [journalYearEnd, setJournalYearEnd] = useState(JOURNAL_MAX_YEAR);
  const [journalArticles, setJournalArticles] = useState<JournalArticle[]>(SEED_JOURNALS);
  const [journalTotal, setJournalTotal] = useState(SEED_JOURNALS.length);
  const [journalPage, setJournalPage] = useState(1);
  const [journalLoading, setJournalLoading] = useState(false);
  const [journalSource, setJournalSource] = useState('OpenAlex');
  const [journalWarning, setJournalWarning] = useState<string | undefined>(undefined);
  const [journalFavorites, setJournalFavorites] = useState<JournalArticle[]>(() => loadFavorites());

  // State Riwayat Suara (Voice History berbasis localStorage)
  const [voiceHistory, setVoiceHistory] = useState<VoiceHistoryEntry[]>(() =>
    loadVoiceHistoryFromStorage(),
  );
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);

  // State Drag & Drop widget
  const [draggingId, setDraggingId] = useState<WidgetId | null>(null);
  const [dropTargetId, setDropTargetId] = useState<WidgetId | null>(null);

  // Deteksi perangkat lemah otomatis untuk menurunkan beban blur/partikel
  useEffect(() => {
    const cores = navigator.hardwareConcurrency ?? 8;
    const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8;
    const isWeak = cores <= 4 || mem <= 4;
    setLowPower(isWeak);
    document.documentElement.classList.toggle('marvis-low-power', isWeak);
  }, []);

  // Terapkan CSS variables tema saat berubah & simpan di localStorage
  useEffect(() => {
    applyThemeToDocument(activeTheme);
    saveTheme(activeTheme);
  }, [activeTheme]);

  // Simpan layout di localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layoutConfig));
    } catch {
      // Abaikan
    }
  }, [layoutConfig]);

  // Simpan pengaturan suara di localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(VOICE_STORAGE_KEY, JSON.stringify(voiceSettings));
    } catch {
      // Abaikan
    }
  }, [voiceSettings]);

  // Simpan riwayat perintah suara di localStorage
  useEffect(() => {
    saveVoiceHistoryToStorage(voiceHistory);
  }, [voiceHistory]);

  // Simpan jurnal favorit di localStorage
  useEffect(() => {
    try {
      window.localStorage.setItem(JOURNAL_FAVORITES_KEY, JSON.stringify(journalFavorites));
    } catch {
      // Abaikan
    }
  }, [journalFavorites]);

  // Muat cuaca Jakarta otomatis saat pertama jalan
  const handleFetchWeather = useCallback(async (city: string) => {
    setWeatherLoading(true);
    const data = await fetchWeatherForCity(city);
    setWeather(data);
    setWeatherLoading(false);
    return data;
  }, []);

  useEffect(() => {
    void handleFetchWeather('Jakarta');
  }, [handleFetchWeather]);

  // Pencarian jurnal ilmiah 2020–2026
  const handleSearchJournals = useCallback(
    async (params: {
      query: string;
      yearStart: number;
      yearEnd: number;
      page: number;
      sortBy: 'relevance' | 'citations';
    }) => {
      const clamped = clampYearRange(params.yearStart, params.yearEnd);
      setJournalQuery(params.query);
      setJournalYearStart(clamped.start);
      setJournalYearEnd(clamped.end);
      setJournalPage(params.page);
      setJournalLoading(true);
      setJournalWarning(undefined);

      const res = await searchJournals({
        query: params.query,
        yearStart: clamped.start,
        yearEnd: clamped.end,
        page: params.page,
        sortBy: params.sortBy,
      });

      setJournalArticles(res.articles);
      setJournalTotal(res.total);
      setJournalSource(res.source);
      setJournalWarning(res.warning);
      setJournalLoading(false);
      return res;
    },
    [],
  );

  const handleToggleFavorite = useCallback((article: JournalArticle) => {
    setJournalFavorites((prev) => {
      const exists = prev.some((item) => item.id === article.id);
      if (exists) return prev.filter((item) => item.id !== article.id);
      return [article, ...prev];
    });
  }, []);

  // Streaming teks kata demi kata pada UI chat
  const revealReplyStream = useCallback((fullText: string, actionSummary?: string) => {
    if (streamTimerRef.current !== null) {
      window.clearInterval(streamTimerRef.current);
      streamTimerRef.current = null;
    }

    const words = fullText.split(/\s+/).filter(Boolean);
    if (words.length <= 4) {
      setStreamingText('');
      setLatestBubble(fullText);
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          text: fullText,
          timestamp: nowTimeLabel(),
          actionSummary,
        },
      ]);
      return;
    }

    let idx = 0;
    setStreamingText('');
    streamTimerRef.current = window.setInterval(() => {
      idx += 2;
      if (idx >= words.length) {
        if (streamTimerRef.current !== null) {
          window.clearInterval(streamTimerRef.current);
          streamTimerRef.current = null;
        }
        setStreamingText('');
        setLatestBubble(fullText);
        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: 'assistant',
            text: fullText,
            timestamp: nowTimeLabel(),
            actionSummary,
          },
        ]);
      } else {
        const partial = words.slice(0, idx).join(' ');
        setStreamingText(partial);
        setLatestBubble(partial);
      }
    }, 36);
  }, []);

  // Referensi agar callback suara selalu memakai versi terbaru
  const sendToMarvisRef = useRef<(text: string, viaVoice?: boolean) => Promise<void>>(
    async () => undefined,
  );

  const voice = useMarvisVoice({
    settings: voiceSettings,
    onCommandReady: (cmd, viaVoice) => {
      void sendToMarvisRef.current(cmd, viaVoice);
    },
    onWakeWordReply: (reply) => {
      setLatestBubble(reply);
      setMessages((prev) => [
        ...prev,
        {
          id: `wake-${Date.now()}`,
          role: 'assistant',
          text: reply,
          timestamp: nowTimeLabel(),
        },
      ]);
    },
  });

  // Eksekusi aksi nyata dari function calling LLM
  const executeMarvisActions = useCallback(
    async (
      actions: MarvisAction[],
    ): Promise<{
      summaries: string[];
      extraSpeech: string;
      journalParams?: VoiceHistoryEntry['journalParams'];
    }> => {
      const summaries: string[] = [];
      let extraSpeech = '';
      let journalParams: VoiceHistoryEntry['journalParams'];

      for (const act of actions) {
        const args = act.args ?? {};
        switch (act.name) {
          case 'ganti_tema': {
            const warna = String(args.warna ?? 'biru');
            const hex = typeof args.hex === 'string' ? args.hex : undefined;
            const resolved = resolveTheme(warna, hex);
            setActiveTheme(resolved);
            summaries.push(`Tema diubah ke ${resolved.name}`);
            break;
          }
          case 'buka_jurnal': {
            const q = String(args.kata_kunci ?? 'artificial intelligence');
            const start = Number(args.tahun_awal ?? JOURNAL_MIN_YEAR);
            const end = Number(args.tahun_akhir ?? JOURNAL_MAX_YEAR);
            const range = clampYearRange(start, end);
            journalParams = { query: q, yearStart: range.start, yearEnd: range.end };
            setActiveTab('journal');
            const res = await handleSearchJournals({
              query: q,
              yearStart: range.start,
              yearEnd: range.end,
              page: 1,
              sortBy: 'relevance',
            });
            summaries.push(`Jurnal "${q}" (${range.start}–${range.end})`);
            if (res.articles.length > 0) {
              const top3 = res.articles
                .slice(0, 3)
                .map((a, i) => `${i + 1}. ${a.title} tahun ${a.year}`)
                .join('. ');
              extraSpeech = ` Ini 3 jurnal teratasnya bang: ${top3}.`;
            }
            break;
          }
          case 'cek_cuaca': {
            const kota = String(args.kota ?? 'Jakarta');
            const data = await handleFetchWeather(kota);
            summaries.push(`Cuaca ${data.city}: ${data.temperature}°C, ${data.condition}`);
            extraSpeech = ` Di ${data.city} sekarang ${data.temperature} derajat Celsius, kondisi ${data.condition.toLowerCase()}.`;
            break;
          }
          case 'tambah_jadwal': {
            const judul = String(args.judul ?? 'Agenda Baru');
            const waktu = String(args.waktu ?? '16:00');
            const kategori = String(args.kategori ?? 'Agenda');
            setSchedule((prev) => [
              ...prev,
              { id: `sc-${Date.now()}`, title: judul, time: waktu, category: kategori, done: false },
            ]);
            summaries.push(`Jadwal "${judul}" (${waktu})`);
            break;
          }
          case 'set_pengingat': {
            const judul = String(args.judul ?? 'Pengingat');
            const waktu = String(args.waktu ?? '17:00');
            setSchedule((prev) => [
              ...prev,
              {
                id: `rem-${Date.now()}`,
                title: judul,
                time: waktu,
                category: 'Pengingat',
                done: false,
                isReminder: true,
              },
            ]);
            summaries.push(`Pengingat "${judul}" (${waktu})`);
            break;
          }
          case 'buka_widget': {
            const id = String(args.nama_widget ?? '') as WidgetId;
            if (DEFAULT_WIDGET_ORDER.includes(id)) {
              setLayoutConfig((prev) => ({
                ...prev,
                hidden: prev.hidden.filter((h) => h !== id),
              }));
              summaries.push(`Widget ${id} ditampilkan`);
            }
            break;
          }
          case 'sembunyikan_widget': {
            const id = String(args.nama_widget ?? '') as WidgetId;
            if (DEFAULT_WIDGET_ORDER.includes(id) && id !== 'avatar-chat') {
              setLayoutConfig((prev) => ({
                ...prev,
                hidden: prev.hidden.includes(id) ? prev.hidden : [...prev.hidden, id],
              }));
              summaries.push(`Widget ${id} disembunyikan`);
            }
            break;
          }
          case 'reset_layout': {
            setLayoutConfig(DEFAULT_LAYOUT);
            summaries.push('Layout dikembalikan ke posisi awal');
            break;
          }
          case 'ubah_volume': {
            const raw = Number(args.volume ?? 100);
            const normalized = raw > 1 ? raw / 100 : raw;
            const vol = Math.max(0, Math.min(1, normalized));
            setVoiceSettings((prev) => ({ ...prev, volume: vol }));
            summaries.push(`Volume ${Math.round(vol * 100)}%`);
            break;
          }
          case 'ubah_kecepatan_bicara': {
            const rate = Math.max(0.6, Math.min(1.6, Number(args.kecepatan ?? 1.0)));
            setVoiceSettings((prev) => ({ ...prev, rate }));
            summaries.push(`Kecepatan bicara ${rate.toFixed(1)}x`);
            break;
          }
          case 'ganti_suara': {
            const pref = String(args.preferensi ?? '').toLowerCase();
            const match = voice.availableVoices.find((v) =>
              v.name.toLowerCase().includes(pref),
            );
            if (match) {
              setVoiceSettings((prev) => ({ ...prev, voiceURI: match.voiceURI }));
              summaries.push(`Suara: ${match.name}`);
            } else if (pref.includes('berat') || pref.includes('pria')) {
              setVoiceSettings((prev) => ({ ...prev, pitch: 0.75 }));
              summaries.push('Pitch suara diatur lebih berat');
            }
            break;
          }
          default:
            break;
        }
      }

      return { summaries, extraSpeech, journalParams };
    },
    [handleFetchWeather, handleSearchJournals, voice.availableVoices],
  );

  // Pengiriman pesan ke backend proxy Express `/api/chat`
  const sendToMarvis = useCallback(
    async (rawText: string, viaVoice = false) => {
      const text = rawText.trim();
      if (!text) return;

      voice.stopSpeaking();
      setPlayingVoiceId(null);
      const stamp = nowTimeLabel();
      const userMsg: ChatMessage = {
        id: `usr-${Date.now()}`,
        role: 'user',
        text,
        timestamp: stamp,
      };
      setMessages((prev) => [...prev, userMsg]);
      voice.setMarvisState('thinking');

      // Catat otomatis setiap perintah suara ke Riwayat Suara (localStorage)
      let voiceEntryId: string | null = null;
      if (viaVoice) {
        const entry = createVoiceHistoryEntry({
          id: `vh-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          query: text,
          timestamp: stamp,
        });
        voiceEntryId = entry.id;
        setVoiceHistory((prev) => appendVoiceHistory(prev, entry));
      }

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: messages.slice(-10).map((m) => ({ role: m.role, text: m.text })),
            voiceMode: viaVoice,
            contextHint: `Tema aktif: ${activeTheme.name}; Cuaca: ${weather.city} ${weather.temperature}°C ${weather.condition}; Jumlah jadwal hari ini: ${schedule.length}`,
          }),
        });

        const data = (await res.json()) as {
          reply?: string;
          actions?: MarvisAction[];
          error?: string;
        };

        if (!res.ok) {
          throw new Error(data.error || 'Gagal menghubungi server AI MARVIS.');
        }

        const actions = Array.isArray(data.actions) ? data.actions : [];
        const { summaries, extraSpeech, journalParams } = await executeMarvisActions(actions);
        const finalReply = `${data.reply ?? 'Siap bang!'}${extraSpeech}`.trim();
        const actionSummary = summaries.length > 0 ? summaries.join(' · ') : undefined;

        if (voiceEntryId) {
          setVoiceHistory((prev) =>
            updateVoiceHistoryEntry(prev, voiceEntryId!, {
              reply: finalReply,
              actionSummary,
              category: journalParams ? 'journal' : undefined,
              journalParams,
            }),
          );
        }

        revealReplyStream(finalReply, actionSummary);

        if (voiceSettings.autoSpeak || viaVoice) {
          voice.speakText(finalReply);
        } else {
          voice.setMarvisState('idle');
        }
      } catch (err: unknown) {
        const msg =
          err instanceof Error
            ? err.message
            : 'Koneksi ke server AI sedang bermasalah, coba lagi sebentar ya bang.';
        voice.setMarvisState('idle');
        setLatestBubble(msg);
        if (voiceEntryId) {
          setVoiceHistory((prev) =>
            updateVoiceHistoryEntry(prev, voiceEntryId!, { reply: msg }),
          );
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            text: msg,
            timestamp: nowTimeLabel(),
          },
        ]);
      }
    },
    [
      activeTheme.name,
      executeMarvisActions,
      messages,
      revealReplyStream,
      schedule.length,
      voice,
      voiceSettings.autoSpeak,
      weather.city,
      weather.condition,
      weather.temperature,
    ],
  );

  sendToMarvisRef.current = sendToMarvis;

  // Kontrol pemutaran ulang, eksekusi ulang, dan hapus Riwayat Suara
  const handlePlaybackVoiceEntry = useCallback(
    (entry: VoiceHistoryEntry) => {
      voice.stopSpeaking();
      setPlayingVoiceId(entry.id);
      const spokenText = entry.reply
        ? `Perintah kamu: ${entry.query}. Jawaban MARVIS: ${entry.reply}`
        : entry.query;
      setLatestBubble(entry.reply || entry.query);
      voice.speakText(spokenText, () => {
        setPlayingVoiceId((current) => (current === entry.id ? null : current));
      });
    },
    [voice],
  );

  const handleStopVoicePlayback = useCallback(() => {
    voice.stopSpeaking();
    setPlayingVoiceId(null);
  }, [voice]);

  const handleRerunVoiceEntry = useCallback(
    (entry: VoiceHistoryEntry) => {
      setPlayingVoiceId(null);
      if (entry.journalParams) {
        setActiveTab('journal');
        void handleSearchJournals({
          query: entry.journalParams.query,
          yearStart: entry.journalParams.yearStart,
          yearEnd: entry.journalParams.yearEnd,
          page: 1,
          sortBy: 'relevance',
        });
        return;
      }
      setActiveTab('chat');
      void sendToMarvis(entry.query, true);
    },
    [handleSearchJournals, sendToMarvis],
  );

  const handleDeleteVoiceEntry = useCallback(
    (id: string) => {
      if (playingVoiceId === id) {
        voice.stopSpeaking();
        setPlayingVoiceId(null);
      }
      setVoiceHistory((prev) => removeVoiceHistoryEntry(prev, id));
    },
    [playingVoiceId, voice],
  );

  const handleClearVoiceHistory = useCallback(() => {
    voice.stopSpeaking();
    setPlayingVoiceId(null);
    setVoiceHistory([]);
  }, [voice]);

  // Ringkas jurnal dengan Marvis
  const handleSummarizeJournal = useCallback(
    (article: JournalArticle) => {
      setActiveTab('chat');
      const prompt = `Ringkas jurnal ilmiah ini dalam 3 poin penting bahasa Indonesia yang mudah dipahami:\nJudul: "${article.title}" (${article.year}, ${article.venue}).\nPenulis: ${article.authors.join(', ')}.\nAbstrak: ${article.abstractText || 'Tidak tersedia, jelaskan fokus utamanya berdasarkan judul dan konteks riset.'}`;
      void sendToMarvis(prompt, false);
    },
    [sendToMarvis],
  );

  // Drag & Drop widget reorder (HTML5 + Pointer untuk sentuhan HP)
  const reorderWidgets = useCallback((sourceId: WidgetId, targetId: WidgetId) => {
    if (sourceId === targetId) return;
    setLayoutConfig((prev) => {
      const next = [...prev.order];
      const fromIdx = next.indexOf(sourceId);
      const toIdx = next.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, sourceId);
      return { ...prev, order: next };
    });
  }, []);

  const handlePointerDragStart = useCallback(
    (sourceId: WidgetId, e: React.PointerEvent) => {
      if (e.pointerType === 'mouse') return; // Mouse memakai native drag yang mulus dengan Motion layout
      e.preventDefault();
      setDraggingId(sourceId);

      const onMove = (moveEvent: PointerEvent) => {
        const el = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
        const card = el?.closest('[data-widget-id]') as HTMLElement | null;
        const hoveredId = card?.dataset.widgetId as WidgetId | undefined;
        if (hoveredId && hoveredId !== sourceId) {
          setDropTargetId(hoveredId);
        }
      };

      const onUp = (upEvent: PointerEvent) => {
        const el = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
        const card = el?.closest('[data-widget-id]') as HTMLElement | null;
        const targetId = card?.dataset.widgetId as WidgetId | undefined;
        if (targetId && targetId !== sourceId) {
          reorderWidgets(sourceId, targetId);
        }
        setDraggingId(null);
        setDropTargetId(null);
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };

      window.addEventListener('pointermove', onMove, { passive: true });
      window.addEventListener('pointerup', onUp);
    },
    [reorderWidgets],
  );

  const handleResetLayout = useCallback(() => {
    setLayoutConfig(DEFAULT_LAYOUT);
  }, []);

  const handleToggleWidgetVisibility = useCallback((id: WidgetId) => {
    if (id === 'avatar-chat') return;
    setLayoutConfig((prev) => ({
      ...prev,
      hidden: prev.hidden.includes(id)
        ? prev.hidden.filter((h) => h !== id)
        : [...prev.hidden, id],
    }));
  }, []);

  const handleMicButtonClick = () => {
    if (voice.marvisState === 'speaking') {
      voice.stopSpeaking();
      return;
    }
    if (voice.micActive) {
      if (voice.awaitingCommand) {
        voice.stopListening();
      } else {
        // Sedang standby wake word -> langsung masuk mode dengarkan perintah
        void voice.startListening(true);
      }
    } else {
      void voice.startListening(true);
    }
  };

  const handleActivateWithMic = async () => {
    setActivated(true);
    await voice.startListening(false);
    voice.speakText('Halo bang Alfath, MARVIS aktif dan siap membantu.');
  };

  const completedTasks = schedule.filter((s) => s.done).length;

  // Pemetaan konten widget untuk grid 3 kolom yang bisa digeser-geser
  const renderWidget = (id: WidgetId) => {
    const dragProps = {
      widgetId: id,
      draggable: true,
      isDragging: draggingId === id,
      isDropTarget: dropTargetId === id && draggingId !== id,
      onDragStartWidget: (wId: WidgetId) => setDraggingId(wId),
      onDragOverWidget: (wId: WidgetId) => setDropTargetId(wId),
      onDropWidget: (targetId: WidgetId) => {
        if (draggingId) reorderWidgets(draggingId, targetId);
        setDraggingId(null);
        setDropTargetId(null);
      },
      onDragEndWidget: () => {
        setDraggingId(null);
        setDropTargetId(null);
      },
      onPointerDragStart: handlePointerDragStart,
    };

    switch (id) {
      case 'greeting':
        return (
          <LiquidCard key={id} {...dragProps}>
            <GreetingWidgetContent
              state={voice.marvisState}
              analyser={voice.analyserNode}
              speechLevelRef={voice.speechLevelRef}
              interimTranscript={voice.interimTranscript}
              micActive={voice.micActive}
              awaitingCommand={voice.awaitingCommand}
            />
          </LiquidCard>
        );
      case 'ai-tools':
        return (
          <LiquidCard key={id} title="AI Tools" subtitle="Aksi cepat instan" {...dragProps}>
            <AiToolsWidgetContent
              onSelectTool={(_label, prompt) => {
                void sendToMarvis(prompt, false);
              }}
            />
          </LiquidCard>
        );
      case 'shortcuts':
        return (
          <LiquidCard key={id} title="Smart Shortcuts" subtitle="Alur kerja siap pakai" {...dragProps}>
            <ShortcutsWidgetContent
              onRunShortcut={(_title, prompt) => {
                void sendToMarvis(prompt, false);
              }}
            />
          </LiquidCard>
        );
      case 'avatar-chat':
        return (
          <LiquidCard
            key={id}
            title="Hologram MARVIS"
            subtitle="Asisten suara & chat aktif"
            isWebGL
            {...dragProps}
          >
            <AvatarChatCard
              state={voice.marvisState}
              accentHex={activeTheme.accent}
              accent2Hex={activeTheme.accent2}
              speechLevelRef={voice.speechLevelRef}
              messages={messages}
              streamingText={streamingText}
              latestBubble={latestBubble}
              onSendMessage={(txt) => void sendToMarvis(txt, false)}
              onStopSpeaking={voice.stopSpeaking}
            />
          </LiquidCard>
        );
      case 'weather':
        return (
          <LiquidCard
            key={id}
            title="Cuaca"
            subtitle={`Open-Meteo · Diperbarui ${weather.updatedAt}`}
            {...dragProps}
          >
            <WeatherWidgetContent
              weather={weather}
              loading={weatherLoading}
              onSearchCity={(city) => void handleFetchWeather(city)}
            />
          </LiquidCard>
        );
      case 'insights':
        return (
          <LiquidCard key={id} title="AI Insights" subtitle="Ringkasan performa minggu ini" {...dragProps}>
            <InsightsWidgetContent
              completedTasks={completedTasks}
              totalTasks={schedule.length}
            />
          </LiquidCard>
        );
      case 'schedule':
        return (
          <LiquidCard key={id} title="Jadwal Hari Ini" subtitle={`${schedule.length} agenda`} {...dragProps}>
            <ScheduleWidgetContent
              items={schedule}
              onToggle={(scId) =>
                setSchedule((prev) =>
                  prev.map((s) => (s.id === scId ? { ...s, done: !s.done } : s)),
                )
              }
              onAdd={(title, time) =>
                setSchedule((prev) => [
                  ...prev,
                  { id: `sc-${Date.now()}`, title, time, category: 'Agenda', done: false },
                ])
              }
            />
          </LiquidCard>
        );
      case 'devices':
        return (
          <LiquidCard key={id} title="Connected Devices" subtitle="Kontrol ruang kerja" {...dragProps}>
            <DevicesWidgetContent
              devices={devices}
              onToggleDevice={(devId) =>
                setDevices((prev) =>
                  prev.map((d) => (d.id === devId ? { ...d, active: !d.active } : d)),
                )
              }
            />
          </LiquidCard>
        );
      case 'trending':
        return (
          <LiquidCard key={id} title="Trending" subtitle="Klik topik untuk tanya Marvis" {...dragProps}>
            <TrendingWidgetContent
              onAskTopic={(prompt) => void sendToMarvis(prompt, false)}
            />
          </LiquidCard>
        );
      case 'journal':
        return (
          <LiquidCard key={id} title="Jurnal (2020–2026)" subtitle="Riset terbaru OpenAlex" {...dragProps}>
            <JournalPreviewWidgetContent
              articles={journalArticles}
              onOpenJournalTab={() => setActiveTab('journal')}
              onSummarize={handleSummarizeJournal}
            />
          </LiquidCard>
        );
    }
  };

  const visibleWidgets = layoutConfig.order.filter((id) => !layoutConfig.hidden.includes(id));

  // Status suara ringkas di tombol mic tengah bawah
  const micStatusLabel =
    voice.marvisState === 'listening'
      ? 'Mendengarkan...'
      : voice.marvisState === 'thinking'
        ? 'Berpikir...'
        : voice.marvisState === 'speaking'
          ? 'Berbicara...'
          : voice.micActive
            ? 'Siaga (Woi Marvis)'
            : 'Ketuk Bicara';

  return (
    <div
      className="relative min-h-dvh text-slate-100 pb-28"
      data-theme-id={activeTheme.id}
      data-marvis-state={voice.marvisState}
    >
      <StarfieldBackground accentHex={activeTheme.accent} lowPower={lowPower} />

      {/* Layar Aktivasi Pertama (Gesture Browser untuk Mic & Speaker) */}
      {!activated && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="marvis-activate-heading"
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#040714]/88 backdrop-blur-xl p-6"
        >
          <div className="liquid-card max-w-md w-full p-8 text-center space-y-6">
            <div
              className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-white/25"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent-2))',
                boxShadow: '0 0 42px var(--glow)',
              }}
            >
              <Mic className="h-9 w-9 text-white" />
            </div>

            <div className="space-y-2">
              <h1
                id="marvis-activate-heading"
                className="font-display text-2xl font-bold tracking-tight text-white text-balance"
              >
                Ketuk untuk mengaktifkan Marvis
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                Aktifkan mikrofon dan speaker agar kamu bisa memanggil{' '}
                <strong className="text-white">&ldquo;Woi Marvis&rdquo;</strong> kapan saja
                secara real-time.
              </p>
            </div>

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => void handleActivateWithMic()}
                className="marvis-accent-btn w-full rounded-2xl py-3.5 px-5 text-sm font-semibold text-white"
              >
                Aktifkan Suara & Masuk MARVIS
              </button>
              <button
                type="button"
                onClick={() => setActivated(true)}
                className="w-full rounded-2xl border border-white/15 bg-white/[0.06] py-3 px-5 text-xs font-medium text-slate-200 hover:bg-white/12 transition-colors"
              >
                Lanjut Tanpa Mikrofon
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Top Navigation Bar — Kontrak 3 Zona Bersih */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050919]/70 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-[1440px] items-center justify-between gap-8 px-4 sm:px-6 lg:px-8">
          {/* Zona 1: Brand Wordmark satu baris */}
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            className="font-display text-lg font-bold tracking-[0.14em] text-white whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
          >
            MARVIS
          </button>

          {/* Zona 2: Navigasi teks satu baris (desktop) */}
          <nav
            aria-label="Navigasi utama"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-300"
          >
            {(
              [
                ['home', 'Beranda'],
                ['chat', 'Chat'],
                ['journal', 'Jurnal'],
                ['tools', 'Tools'],
                ['profile', 'Profil'],
              ] as Array<[NavTab, string]>
            ).map(([tab, label]) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`relative py-1 whitespace-nowrap shrink-0 transition-colors ${
                  activeTab === tab
                    ? 'text-white after:absolute after:inset-x-0 after:-bottom-1 after:h-[2px] after:rounded-full after:bg-[var(--accent-2)]'
                    : 'hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {/* Zona 3: 1 Aksi Utama */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={handleResetLayout}
              className="inline-flex items-center gap-1.5 rounded-xl border border-white/15 bg-white/[0.07] px-3.5 py-2 text-xs font-medium text-white hover:bg-white/14 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Layout
            </button>
          </div>
        </div>
      </header>

      {/* Banner peringatan mikrofon / browser (muncul hanya jika ada error) */}
      {voice.voiceError && (
        <div className="relative z-20 mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 pt-4">
          <div
            role="alert"
            className="flex items-center justify-between gap-3 rounded-2xl border border-amber-400/35 bg-amber-500/12 px-4 py-2.5 text-xs text-amber-100"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-300" />
              <span>{voice.voiceError}</span>
            </div>
            <button
              type="button"
              onClick={() => voice.setVoiceError(null)}
              aria-label="Tutup peringatan suara"
              className="rounded-lg p-1 hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Konten Utama Responsif (1 kolom HP, 3 kolom rapat di Laptop tanpa celah kosong) */}
      <main className="relative z-10 mx-auto max-w-[1440px] px-4 sm:px-6 lg:px-8 py-5 pb-12">
        {activeTab === 'home' && (() => {
          // Distribusikan widget secara merata ke 3 kolom desktop agar tidak ada celah vertikal kosong
          const col0: WidgetId[] = [];
          const col1: WidgetId[] = [];
          const col2: WidgetId[] = [];

          visibleWidgets.forEach((id, idx) => {
            if (id === 'avatar-chat') {
              col1.unshift(id);
            } else if (idx % 3 === 0) {
              col0.push(id);
            } else if (idx % 3 === 2) {
              col2.push(id);
            } else {
              col1.push(id);
            }
          });

          return (
            <div
              data-testid="dashboard-grid"
              className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:items-start"
            >
              <div className="flex flex-col gap-5">{col0.map((id) => renderWidget(id))}</div>
              <div className="flex flex-col gap-5">{col1.map((id) => renderWidget(id))}</div>
              <div className="flex flex-col gap-5">{col2.map((id) => renderWidget(id))}</div>
            </div>
          );
        })()}

        {activeTab === 'chat' && (
          <div className="mx-auto max-w-6xl grid gap-5 lg:grid-cols-12 items-start">
            <div className="lg:col-span-7">
              <LiquidCard
                title="Ruang Percakapan MARVIS"
                subtitle="Avatar hologram 3D interaktif dengan eksekusi perintah otomatis"
                isWebGL
              >
                <AvatarChatCard
                  state={voice.marvisState}
                  accentHex={activeTheme.accent}
                  accent2Hex={activeTheme.accent2}
                  speechLevelRef={voice.speechLevelRef}
                  messages={messages}
                  streamingText={streamingText}
                  latestBubble={latestBubble}
                  onSendMessage={(txt) => void sendToMarvis(txt, false)}
                  onStopSpeaking={handleStopVoicePlayback}
                  expanded
                />
              </LiquidCard>
            </div>
            <div className="lg:col-span-5">
              <VoiceHistoryPanel
                entries={voiceHistory}
                defaultScope="all"
                playingEntryId={playingVoiceId}
                onPlaybackEntry={handlePlaybackVoiceEntry}
                onStopPlayback={handleStopVoicePlayback}
                onRerunEntry={handleRerunVoiceEntry}
                onDeleteEntry={handleDeleteVoiceEntry}
                onClearAll={handleClearVoiceHistory}
                onStartListening={() => void voice.startListening(true)}
              />
            </div>
          </div>
        )}

        {activeTab === 'journal' && (
          <JournalSection
            query={journalQuery}
            yearStart={journalYearStart}
            yearEnd={journalYearEnd}
            articles={journalArticles}
            total={journalTotal}
            page={journalPage}
            loading={journalLoading}
            sourceLabel={journalSource}
            warning={journalWarning}
            favorites={journalFavorites}
            voiceHistory={voiceHistory}
            playingVoiceId={playingVoiceId}
            onSearch={(params) => void handleSearchJournals(params)}
            onToggleFavorite={handleToggleFavorite}
            onSummarizeWithMarvis={handleSummarizeJournal}
            onPlaybackVoiceEntry={handlePlaybackVoiceEntry}
            onStopVoicePlayback={handleStopVoicePlayback}
            onRerunVoiceEntry={handleRerunVoiceEntry}
            onDeleteVoiceEntry={handleDeleteVoiceEntry}
            onClearVoiceHistory={handleClearVoiceHistory}
            onStartVoiceListening={() => void voice.startListening(true)}
          />
        )}

        {activeTab === 'tools' && (
          <div className="space-y-5">
            <div className="grid gap-5 lg:grid-cols-2">
              <LiquidCard
                title="AI Tools"
                subtitle="Pilih alat bantu AI untuk langsung diproses oleh MARVIS"
              >
                <AiToolsWidgetContent
                  onSelectTool={(_label, prompt) => {
                    setActiveTab('chat');
                    void sendToMarvis(prompt, false);
                  }}
                />
              </LiquidCard>
              <LiquidCard
                title="Smart Shortcuts"
                subtitle="Otomasi harian cepat untuk rapat, email, belajar, dan jadwal"
              >
                <ShortcutsWidgetContent
                  onRunShortcut={(_title, prompt) => {
                    setActiveTab('chat');
                    void sendToMarvis(prompt, false);
                  }}
                />
              </LiquidCard>
            </div>
            <JournalSection
              query={journalQuery}
              yearStart={journalYearStart}
              yearEnd={journalYearEnd}
              articles={journalArticles}
              total={journalTotal}
              page={journalPage}
              loading={journalLoading}
              sourceLabel={journalSource}
              warning={journalWarning}
              favorites={journalFavorites}
              voiceHistory={voiceHistory}
              playingVoiceId={playingVoiceId}
              onSearch={(params) => void handleSearchJournals(params)}
              onToggleFavorite={handleToggleFavorite}
              onSummarizeWithMarvis={handleSummarizeJournal}
              onPlaybackVoiceEntry={handlePlaybackVoiceEntry}
              onStopVoicePlayback={handleStopVoicePlayback}
              onRerunVoiceEntry={handleRerunVoiceEntry}
              onDeleteVoiceEntry={handleDeleteVoiceEntry}
              onClearVoiceHistory={handleClearVoiceHistory}
              onStartVoiceListening={() => void voice.startListening(true)}
            />
          </div>
        )}

        {activeTab === 'profile' && (
          <ProfileSettingsView
            activeTheme={activeTheme}
            onSelectTheme={(t) => setActiveTheme(t)}
            onApplyCustomColor={(input) => setActiveTheme(resolveTheme(input))}
            voiceSettings={voiceSettings}
            onUpdateVoiceSettings={(patch) =>
              setVoiceSettings((prev) => ({ ...prev, ...patch }))
            }
            availableVoices={voice.availableVoices}
            onTestVoice={() =>
              voice.speakText('Halo bang Alfath, ini tes suara MARVIS. Kedengeran jelas dan keren kan?')
            }
            speechSupported={voice.speechSupported}
            isSecure={voice.isSecure}
            layoutConfig={layoutConfig}
            onToggleWidgetVisibility={handleToggleWidgetVisibility}
            onResetLayout={handleResetLayout}
          />
        )}
      </main>

      {/* Bottom Navigation Pill + Tombol Mic AI Besar Bercahaya di Tengah */}
      <nav
        aria-label="Navigasi bawah"
        className="fixed bottom-3 left-1/2 z-40 w-[min(430px,calc(100vw-24px))] -translate-x-1/2"
      >
        <div className="marvis-nav-pill relative flex items-center justify-between rounded-[26px] px-3 py-1.5">
          <button
            type="button"
            onClick={() => setActiveTab('home')}
            aria-label="Navigasi Home"
            className={`flex min-w-[56px] flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-medium transition-colors ${
              activeTab === 'home' ? 'text-white bg-white/10' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Home className="h-4 w-4" />
            <span>Home</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('chat')}
            aria-label="Navigasi Chat"
            className={`flex min-w-[56px] flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-medium transition-colors ${
              activeTab === 'chat' ? 'text-white bg-white/10' : 'text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="h-4 w-4" />
            <span>Chat</span>
          </button>

          {/* Tombol Mic Besar Bercahaya di Tengah */}
          <div className="relative -mt-5 flex flex-col items-center">
            <button
              type="button"
              onClick={handleMicButtonClick}
              aria-label={`Tombol suara AI MARVIS: ${micStatusLabel}`}
              className="marvis-accent-btn liquid-refract-rim flex h-12 w-12 items-center justify-center rounded-full border border-white/35 text-white"
              style={{
                boxShadow:
                  voice.marvisState !== 'idle'
                    ? '0 0 34px var(--glow), inset 0 1px 0 rgba(255,255,255,0.5)'
                    : '0 10px 26px -6px var(--glow), inset 0 1px 0 rgba(255,255,255,0.35)',
              }}
            >
              {voice.micActive ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
            </button>
            <span className="mt-1 whitespace-nowrap text-[10px] font-medium text-[var(--accent-2)]">
              {micStatusLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'tools' ? 'journal' : 'tools')}
            aria-label="Navigasi Tools dan Jurnal"
            className={`flex min-w-[56px] flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-medium transition-colors ${
              activeTab === 'tools' || activeTab === 'journal'
                ? 'text-white bg-white/10'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {activeTab === 'journal' ? (
              <BookOpen className="h-4 w-4" />
            ) : (
              <Wrench className="h-4 w-4" />
            )}
            <span>Tools</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            aria-label="Navigasi Profil"
            className={`flex min-w-[56px] flex-col items-center gap-0.5 rounded-2xl py-1.5 text-[11px] font-medium transition-colors ${
              activeTab === 'profile' ? 'text-white bg-white/10' : 'text-slate-400 hover:text-white'
            }`}
          >
            <User className="h-4 w-4" />
            <span>Profil</span>
          </button>
        </div>
      </nav>
    </div>
  );
}

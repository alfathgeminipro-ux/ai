import React, { useEffect, useRef, useState } from 'react';
import { Send, VolumeX } from 'lucide-react';
import type { ChatMessage, MarvisState } from '../types';
import { MarvisAvatar3D } from './MarvisAvatar3D';

interface AvatarChatCardProps {
  state: MarvisState;
  accentHex: string;
  accent2Hex: string;
  speechLevelRef: React.MutableRefObject<number>;
  messages: ChatMessage[];
  streamingText: string;
  latestBubble: string;
  onSendMessage: (text: string) => void;
  onStopSpeaking: () => void;
  expanded?: boolean;
}

const QUICK_REPLIES = [
  'Ganti tema jadi merah',
  'Cek cuaca Bandung',
  'Cari jurnal AI 2024',
  'Tambah jadwal rapat jam 15:00',
  'Mode neon',
];

const STATE_LABELS: Record<MarvisState, string> = {
  idle: 'Siaga',
  listening: 'Mendengarkan...',
  thinking: 'Berpikir...',
  speaking: 'Berbicara...',
};

export function AvatarChatCard({
  state,
  accentHex,
  accent2Hex,
  speechLevelRef,
  messages,
  streamingText,
  latestBubble,
  onSendMessage,
  onStopSpeaking,
  expanded = false,
}: AvatarChatCardProps) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = draft.trim();
    if (!cleaned) return;
    onSendMessage(cleaned);
    setDraft('');
  };

  return (
    <div className="flex flex-col gap-3.5 h-full">
      {/* Panggung Avatar 3D Cowok Hologram + Bubble Chat */}
      <div className="relative flex flex-col items-center">
        {/* Bubble ucapan terbaru MARVIS */}
        <div className="relative z-10 mb-2 w-full rounded-2xl border border-white/15 bg-white/[0.08] px-4 py-2.5 text-center shadow-lg">
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-400 mb-1">
            <span className="font-display font-semibold text-[var(--accent-2)]">MARVIS</span>
            <div className="flex items-center gap-2">
              <span data-testid="marvis-status-label" className="text-slate-300 font-medium">
                {STATE_LABELS[state]}
              </span>
              {state === 'speaking' && (
                <button
                  type="button"
                  onClick={onStopSpeaking}
                  aria-label="Hentikan suara MARVIS"
                  className="inline-flex items-center gap-1 rounded-lg bg-white/10 px-2 py-0.5 text-[10px] text-white hover:bg-white/20 transition-colors"
                >
                  <VolumeX className="h-3 w-3" />
                  Stop
                </button>
              )}
            </div>
          </div>
          <p className="text-xs sm:text-[13px] leading-relaxed text-white/95 line-clamp-3">
            {streamingText || latestBubble}
          </p>
        </div>

        {/* Viewport WebGL Three.js */}
        <div
          className={`relative w-full overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.03] via-transparent to-[var(--accent)]/[0.08] ${
            expanded ? 'h-[320px] sm:h-[360px]' : 'h-[260px] sm:h-[290px]'
          }`}
        >
          <MarvisAvatar3D
            state={state}
            accentHex={accentHex}
            accent2Hex={accent2Hex}
            speechLevelRef={speechLevelRef}
          />
        </div>
      </div>

      {/* Panel Riwayat Chat */}
      <div
        ref={scrollRef}
        className={`flex-1 space-y-2.5 overflow-y-auto marvis-scroll pr-1 ${
          expanded ? 'max-h-[360px] min-h-[200px]' : 'max-h-[210px] min-h-[150px]'
        }`}
        aria-live="polite"
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed ${
                  isUser
                    ? 'text-white rounded-br-md'
                    : 'border border-white/12 bg-white/[0.06] text-slate-100 rounded-bl-md'
                }`}
                style={
                  isUser
                    ? {
                        background:
                          'linear-gradient(135deg, color-mix(in srgb, var(--accent) 88%, #000), color-mix(in srgb, var(--accent-2) 78%, #000))',
                      }
                    : undefined
                }
              >
                <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                {msg.actionSummary && (
                  <p className="mt-1.5 border-t border-white/15 pt-1 text-[11px] text-[var(--accent-2)]">
                    Aksi dijalankan: {msg.actionSummary}
                  </p>
                )}
              </div>
              <span className="mt-1 px-1 text-[10px] text-slate-500 font-mono-tabular">
                {isUser ? 'Alfath' : 'MARVIS'} · {msg.timestamp}
              </span>
            </div>
          );
        })}

        {streamingText && (
          <div className="flex flex-col items-start">
            <div className="max-w-[88%] rounded-2xl rounded-bl-md border border-[var(--accent)]/40 bg-white/[0.08] px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed text-white">
              {streamingText}
            </div>
          </div>
        )}
      </div>

      {/* Quick-Reply Chips interaktif */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 marvis-scroll">
        {QUICK_REPLIES.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => onSendMessage(chip)}
            className="shrink-0 whitespace-nowrap rounded-xl border border-white/12 bg-white/[0.05] px-3 py-1.5 text-[11px] font-medium text-slate-200 hover:border-[var(--accent)]/60 hover:bg-white/[0.11] hover:text-white transition-colors"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Input Chat Manual */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <label htmlFor={expanded ? 'chat-input-full' : 'chat-input-dash'} className="sr-only">
          Ketik pesan untuk MARVIS
        </label>
        <input
          id={expanded ? 'chat-input-full' : 'chat-input-dash'}
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Tanya apa aja atau kasih perintah ke Marvis..."
          className="flex-1 min-w-0 rounded-2xl border border-white/15 bg-white/[0.06] px-4 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-400 focus:border-[var(--accent)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30"
        />
        <button
          type="submit"
          aria-label="Kirim pesan ke MARVIS"
          className="marvis-accent-btn flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

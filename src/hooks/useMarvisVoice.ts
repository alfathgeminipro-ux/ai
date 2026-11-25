import { useCallback, useEffect, useRef, useState } from 'react';
import type { MarvisState, VoiceSettings } from '../types';
import {
  matchWakeWord,
  pickPreferredIndonesianMaleVoice,
  splitIntoSentences,
} from '../utils/voiceLogic';

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

export interface UseMarvisVoiceOptions {
  settings: VoiceSettings;
  onCommandReady: (command: string, viaVoice: boolean) => void;
  onWakeWordReply: (reply: string) => void;
}

export function useMarvisVoice({
  settings,
  onCommandReady,
  onWakeWordReply,
}: UseMarvisVoiceOptions) {
  const [marvisState, setMarvisState] = useState<MarvisState>('idle');
  const [micActive, setMicActive] = useState(false);
  const [awaitingCommand, setAwaitingCommand] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [analyserNode, setAnalyserNode] = useState<AnalyserNode | null>(null);

  const speechLevelRef = useRef(0);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micActiveRef = useRef(false);
  const awaitingCommandRef = useRef(false);
  const commandTimeoutRef = useRef<number | null>(null);
  const speakingRef = useRef(false);
  const settingsRef = useRef(settings);
  const onCommandReadyRef = useRef(onCommandReady);
  const onWakeWordReplyRef = useRef(onWakeWordReply);

  settingsRef.current = settings;
  onCommandReadyRef.current = onCommandReady;
  onWakeWordReplyRef.current = onWakeWordReply;

  const speechSupported =
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
  const ttsSupported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const isSecure =
    typeof window === 'undefined' ||
    window.isSecureContext ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1';

  // Muat daftar suara TTS browser
  useEffect(() => {
    if (!ttsSupported) return;
    const loadVoices = () => {
      const list = window.speechSynthesis.getVoices();
      if (list.length > 0) {
        setAvailableVoices(list);
      }
    };
    loadVoices();
    window.speechSynthesis.addEventListener('voiceschanged', loadVoices);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', loadVoices);
  }, [ttsSupported]);

  const clearCommandTimeout = useCallback(() => {
    if (commandTimeoutRef.current !== null) {
      window.clearTimeout(commandTimeoutRef.current);
      commandTimeoutRef.current = null;
    }
  }, []);

  const enterAwaitingCommand = useCallback(() => {
    awaitingCommandRef.current = true;
    setAwaitingCommand(true);
    setMarvisState('listening');
    clearCommandTimeout();
    // Timeout 8 detik tanpa suara -> kembali standby
    commandTimeoutRef.current = window.setTimeout(() => {
      awaitingCommandRef.current = false;
      setAwaitingCommand(false);
      setInterimTranscript('');
      if (!speakingRef.current) {
        setMarvisState('idle');
      }
    }, 8000);
  }, [clearCommandTimeout]);

  const stopSpeaking = useCallback(() => {
    if (ttsSupported) {
      window.speechSynthesis.cancel();
    }
    speakingRef.current = false;
    speechLevelRef.current = 0;
    setMarvisState((prev) => (prev === 'speaking' ? (awaitingCommandRef.current ? 'listening' : 'idle') : prev));
  }, [ttsSupported]);

  /**
   * Mengucapkan teks per kalimat menggunakan speechSynthesis agar respons mulai bicara segera.
   */
  const speakText = useCallback(
    (fullText: string, onDone?: () => void) => {
      if (!ttsSupported || !fullText.trim()) {
        onDone?.();
        return;
      }

      window.speechSynthesis.cancel();
      const sentences = splitIntoSentences(fullText);
      if (sentences.length === 0) {
        onDone?.();
        return;
      }

      const cfg = settingsRef.current;
      const voices = window.speechSynthesis.getVoices();
      const selectedVoice =
        voices.find((v) => v.voiceURI === cfg.voiceURI) ??
        pickPreferredIndonesianMaleVoice(voices);

      speakingRef.current = true;
      setMarvisState('speaking');
      speechLevelRef.current = 0.65;

      let idx = 0;
      const speakNext = () => {
        if (!speakingRef.current || idx >= sentences.length) {
          speakingRef.current = false;
          speechLevelRef.current = 0;
          setMarvisState(awaitingCommandRef.current ? 'listening' : 'idle');
          onDone?.();
          return;
        }

        const utterance = new SpeechSynthesisUtterance(sentences[idx]);
        utterance.lang = selectedVoice?.lang || 'id-ID';
        if (selectedVoice) utterance.voice = selectedVoice;
        utterance.pitch = Math.max(0.5, Math.min(1.5, cfg.pitch));
        utterance.rate = Math.max(0.6, Math.min(1.6, cfg.rate));
        utterance.volume = Math.max(0, Math.min(1, cfg.volume));

        utterance.onboundary = () => {
          speechLevelRef.current = 0.5 + Math.random() * 0.45;
        };
        utterance.onend = () => {
          idx += 1;
          speakNext();
        };
        utterance.onerror = () => {
          speakingRef.current = false;
          speechLevelRef.current = 0;
          setMarvisState(awaitingCommandRef.current ? 'listening' : 'idle');
          onDone?.();
        };

        window.speechSynthesis.speak(utterance);
      };

      speakNext();
    },
    [ttsSupported],
  );

  // Inisialisasi Web Audio AnalyserNode untuk waveform mikrofon real-time
  const startAudioAnalyser = useCallback(async (): Promise<boolean> => {
    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      if (!streamRef.current) {
        streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AudioCtx();
        const source = ctx.createMediaStreamSource(streamRef.current);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 128;
        analyser.smoothingTimeConstant = 0.78;
        source.connect(analyser);
        audioCtxRef.current = ctx;
        setAnalyserNode(analyser);
      } else if (audioCtxRef.current.state === 'suspended') {
        await audioCtxRef.current.resume();
      }
      return true;
    } catch (err: unknown) {
      const name = err instanceof DOMException ? err.name : '';
      if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
        setVoiceError('Izin mikrofon ditolak. Aktifkan izin mikrofon di pengaturan browser untuk mode suara.');
      } else if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
        setVoiceError('Perangkat mikrofon tidak ditemukan. Kamu tetap bisa mengetik langsung di panel chat.');
      } else {
        setVoiceError('Gagal mengakses mikrofon. Pastikan halaman dibuka lewat HTTPS atau localhost.');
      }
      return false;
    }
  }, []);

  const stopListening = useCallback(() => {
    micActiveRef.current = false;
    awaitingCommandRef.current = false;
    setMicActive(false);
    setAwaitingCommand(false);
    setInterimTranscript('');
    clearCommandTimeout();

    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch {
        // Abaikan jika sudah berhenti
      }
      recognitionRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => undefined);
      audioCtxRef.current = null;
    }
    setAnalyserNode(null);
    if (!speakingRef.current) {
      setMarvisState('idle');
    }
  }, [clearCommandTimeout]);

  const startListening = useCallback(
    async (directCommandMode = false) => {
      setVoiceError(null);

      if (!isSecure) {
        setVoiceError('Akses mikrofon membutuhkan koneksi HTTPS atau localhost.');
        return;
      }
      if (!speechSupported) {
        setVoiceError(
          'Browser ini belum mendukung pengenalan suara Web Speech API. Gunakan Chrome, Edge, atau Safari terbaru.',
        );
        return;
      }

      // Interupsi bila MARVIS sedang bicara
      if (speakingRef.current) {
        stopSpeaking();
      }

      const audioReady = await startAudioAnalyser();
      if (!audioReady) return;

      const SpeechCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechCtor) return;

      micActiveRef.current = true;
      setMicActive(true);

      if (directCommandMode || !settingsRef.current.wakeWordEnabled) {
        enterAwaitingCommand();
      } else {
        setMarvisState('idle');
      }

      const spawnRecognition = () => {
        if (!micActiveRef.current) return;
        const rec = new SpeechCtor();
        rec.lang = 'id-ID';
        rec.continuous = true;
        rec.interimResults = true;

        rec.onresult = (event) => {
          // Interupsi langsung jika pengguna mulai berbicara saat MARVIS masih bersuara
          if (speakingRef.current) {
            stopSpeaking();
          }

          let interim = '';
          let finalText = '';

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const chunk = event.results[i][0]?.transcript ?? '';
            if (event.results[i].isFinal) {
              finalText += `${chunk} `;
            } else {
              interim += chunk;
            }
          }

          const preview = (finalText || interim).trim();
          if (preview) {
            setInterimTranscript(preview);
          }

          if (!finalText.trim()) return;
          const spoken = finalText.trim();

          // Mode menunggu perintah langsung
          if (awaitingCommandRef.current) {
            clearCommandTimeout();
            awaitingCommandRef.current = false;
            setAwaitingCommand(false);
            setInterimTranscript('');

            const wakeCheck = matchWakeWord(spoken);
            const cleanCmd = wakeCheck.triggered && wakeCheck.trailingCommand
              ? wakeCheck.trailingCommand
              : spoken;

            if (cleanCmd) {
              onCommandReadyRef.current(cleanCmd, true);
            }
            return;
          }

          // Mode standby: dengarkan wake word ("woi marvis" dan variasi)
          if (settingsRef.current.wakeWordEnabled) {
            const wake = matchWakeWord(spoken);
            if (wake.triggered) {
              setInterimTranscript('');
              if (wake.trailingCommand) {
                onCommandReadyRef.current(wake.trailingCommand, true);
              } else {
                const reply = 'Nape bang?';
                onWakeWordReplyRef.current(reply);
                speakText(reply, () => {
                  if (micActiveRef.current) {
                    enterAwaitingCommand();
                  }
                });
              }
            }
          } else {
            setInterimTranscript('');
            onCommandReadyRef.current(spoken, true);
          }
        };

        rec.onerror = (event) => {
          if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
            setVoiceError('Izin mikrofon ditolak browser. Aktifkan izin lalu coba lagi.');
            stopListening();
          } else if (event.error === 'audio-capture') {
            setVoiceError('Mikrofon tidak terdeteksi pada perangkat ini.');
            stopListening();
          }
        };

        rec.onend = () => {
          // Auto-restart bila mode suara masih aktif
          if (micActiveRef.current) {
            window.setTimeout(() => {
              if (micActiveRef.current) {
                spawnRecognition();
              }
            }, 260);
          }
        };

        recognitionRef.current = rec;
        try {
          rec.start();
        } catch {
          // Abaikan double-start sementara
        }
      };

      spawnRecognition();
    },
    [
      clearCommandTimeout,
      enterAwaitingCommand,
      isSecure,
      speakText,
      speechSupported,
      startAudioAnalyser,
      stopListening,
      stopSpeaking,
    ],
  );

  // Bersihkan resource saat unmount
  useEffect(() => {
    return () => {
      stopListening();
      if (ttsSupported) window.speechSynthesis.cancel();
    };
  }, [stopListening, ttsSupported]);

  return {
    marvisState,
    setMarvisState,
    micActive,
    awaitingCommand,
    interimTranscript,
    voiceError,
    setVoiceError,
    availableVoices,
    analyserNode,
    speechLevelRef,
    speechSupported,
    ttsSupported,
    isSecure,
    startListening,
    stopListening,
    speakText,
    stopSpeaking,
  };
}

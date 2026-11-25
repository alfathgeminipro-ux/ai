import { useEffect, useRef } from 'react';
import type { MarvisState } from '../types';
import { shouldRunRenderLoop } from '../utils/lazyRender';
import { useCardVisibility } from './LiquidCard';

interface AudioWaveformProps {
  state: MarvisState;
  analyser: AnalyserNode | null;
  speechLevelRef: React.MutableRefObject<number>;
}

const BAR_COUNT = 22;

/**
 * Visualizer waveform suara real-time menggunakan Web Audio API AnalyserNode
 * saat mikrofon aktif, atau sinkron amplitudo suara saat MARVIS berbicara.
 * Otomatis berhenti merender saat LiquidCard berada di luar viewport.
 */
export function AudioWaveform({ state, analyser, speechLevelRef }: AudioWaveformProps) {
  const barsRef = useRef<Array<HTMLSpanElement | null>>([]);
  const { isInViewport } = useCardVisibility();

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reducedMotion || !isInViewport) {
      barsRef.current.forEach((bar, i) => {
        if (!bar) return;
        const centerDist = Math.abs(i - (BAR_COUNT - 1) / 2) / (BAR_COUNT / 2);
        const h = Math.max(0.18, 0.72 - centerDist * 0.45);
        bar.style.transform = `scaleY(${h.toFixed(2)})`;
      });
      return;
    }

    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    let rafId = 0;

    const tick = (now: number) => {
      if (!shouldRunRenderLoop({ isInViewport, isDocumentHidden: document.hidden })) {
        return;
      }

      const t = now * 0.005;

      if (analyser && freqData && state === 'listening') {
        analyser.getByteFrequencyData(freqData);
      }

      for (let i = 0; i < BAR_COUNT; i++) {
        const bar = barsRef.current[i];
        if (!bar) continue;

        const normPos = Math.abs(i - (BAR_COUNT - 1) / 2) / (BAR_COUNT / 2);
        const envelope = Math.max(0.2, 1 - normPos * 0.78);
        let scale = 0.18;

        if (state === 'listening' && freqData) {
          const bin = Math.min(freqData.length - 1, Math.floor((i / BAR_COUNT) * 32) + 2);
          const amp = (freqData[bin] ?? 0) / 255;
          const idleRipple = 0.16 + 0.1 * Math.sin(t * 1.8 + i * 0.45);
          scale = Math.min(1, Math.max(idleRipple, amp * 1.35) * envelope + 0.14);
        } else if (state === 'speaking') {
          const voiceAmp = speechLevelRef.current;
          const wave = Math.abs(Math.sin(t * 2.6 + i * 0.58) * Math.cos(t * 1.4 - i * 0.25));
          scale = Math.min(1, (0.2 + wave * (0.45 + voiceAmp * 0.65)) * envelope);
        } else if (state === 'thinking') {
          const sweep = 0.5 + 0.5 * Math.sin(t * 2.4 - i * 0.45);
          scale = 0.18 + sweep * 0.55 * envelope;
        } else {
          const calm = 0.5 + 0.5 * Math.sin(t * 0.65 + i * 0.4);
          scale = 0.14 + calm * 0.22 * envelope;
        }

        bar.style.transform = `scaleY(${scale.toFixed(3)})`;
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    const onVis = () => {
      if (shouldRunRenderLoop({ isInViewport, isDocumentHidden: document.hidden })) {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(tick);
      } else {
        cancelAnimationFrame(rafId);
      }
    };

    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelAnimationFrame(rafId);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [state, analyser, speechLevelRef, isInViewport]);

  return (
    <div
      className="flex h-10 items-center justify-center gap-[3px] px-2"
      role="img"
      aria-label={`Gelombang suara MARVIS: ${state}`}
    >
      {Array.from({ length: BAR_COUNT }).map((_, idx) => (
        <span
          key={idx}
          ref={(el) => {
            barsRef.current[idx] = el;
          }}
          className="h-9 w-[3px] origin-center rounded-full will-change-transform"
          style={{
            background:
              idx % 2 === 0
                ? 'linear-gradient(180deg, var(--accent-2), var(--accent))'
                : 'linear-gradient(180deg, rgba(255,255,255,0.85), var(--accent))',
            transform: 'scaleY(0.22)',
          }}
        />
      ))}
    </div>
  );
}

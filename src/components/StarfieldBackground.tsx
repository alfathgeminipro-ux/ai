import { useEffect, useRef } from 'react';
import { hexToRgb } from '../utils/themeEngine';

interface StarfieldBackgroundProps {
  accentHex: string;
  lowPower: boolean;
}

interface Star {
  x: number;
  y: number;
  r: number;
  alpha: number;
  twinkleSpeed: number;
  phase: number;
  vx: number;
  vy: number;
}

/**
 * Latar belakang mesh gradasi gelap + partikel bintang halus yang mengikuti warna tema aktif.
 * Otomatis berhenti merender saat tab tidak aktif atau prefers-reduced-motion aktif.
 */
export function StarfieldBackground({ accentHex, lowPower }: StarfieldBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const accentRef = useRef(accentHex);
  accentRef.current = accentHex;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const starCount = reducedMotion ? 32 : lowPower ? 40 : 85;

    let width = window.innerWidth;
    let height = window.innerHeight;
    const dpr = lowPower ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();

    const stars: Star[] = Array.from({ length: starCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: Math.random() * 1.35 + 0.35,
      alpha: Math.random() * 0.55 + 0.2,
      twinkleSpeed: Math.random() * 0.9 + 0.35,
      phase: Math.random() * Math.PI * 2,
      vx: (Math.random() - 0.5) * 0.08,
      vy: -(Math.random() * 0.09 + 0.02),
    }));

    let rafId = 0;
    let lastTime = performance.now();

    const renderFrame = (now: number) => {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      ctx.clearRect(0, 0, width, height);
      const { r, g, b } = hexToRgb(accentRef.current);

      for (let i = 0; i < stars.length; i++) {
        const s = stars[i];
        if (!reducedMotion) {
          s.x += s.vx * (dt * 60);
          s.y += s.vy * (dt * 60);
          if (s.y < -4) s.y = height + 4;
          if (s.x < -4) s.x = width + 4;
          if (s.x > width + 4) s.x = -4;
        }

        const twinkle = reducedMotion
          ? s.alpha
          : s.alpha * (0.65 + 0.35 * Math.sin(now * 0.001 * s.twinkleSpeed + s.phase));

        const tinted = i % 4 === 0;
        ctx.fillStyle = tinted
          ? `rgba(${r}, ${g}, ${b}, ${Math.min(0.85, twinkle + 0.15)})`
          : `rgba(226, 236, 255, ${twinkle})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      if (!reducedMotion && !document.hidden) {
        rafId = requestAnimationFrame(renderFrame);
      }
    };

    renderFrame(performance.now());

    const handleVisibility = () => {
      if (!document.hidden && !reducedMotion) {
        cancelAnimationFrame(rafId);
        lastTime = performance.now();
        rafId = requestAnimationFrame(renderFrame);
      } else {
        cancelAnimationFrame(rafId);
      }
    };

    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [lowPower]);

  return (
    <>
      <div className="marvis-mesh-bg" aria-hidden="true" />
      <div className="marvis-mesh-orb marvis-mesh-orb-1" aria-hidden="true" />
      <div className="marvis-mesh-orb marvis-mesh-orb-2" aria-hidden="true" />
      <canvas
        ref={canvasRef}
        className="fixed inset-0 z-0 pointer-events-none opacity-80"
        aria-hidden="true"
      />
      {/* SVG Filter untuk efek refraksi tepi liquid glass */}
      <svg className="sr-only" aria-hidden="true" focusable="false">
        <defs>
          <filter id="marvis-liquid-refract" x="-10%" y="-10%" width="120%" height="120%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.015 0.025"
              numOctaves="2"
              seed="7"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="3"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>
    </>
  );
}

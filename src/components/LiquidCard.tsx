import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { GripVertical } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import type { WidgetId } from '../types';
import { nextLazyMountState, type LazyMountState } from '../utils/lazyRender';
import {
  appendRipple,
  computeLiquidRipple,
  shouldSpawnRipple,
  type LiquidRippleSpec,
} from '../utils/rippleMath';
import { LiquidRippleLayer } from './LiquidRippleLayer';

interface CardVisibilityContextValue {
  isInViewport: boolean;
  hasEnteredViewport: boolean;
}

const CardVisibilityContext = createContext<CardVisibilityContextValue>({
  isInViewport: true,
  hasEnteredViewport: true,
});

let globalRippleSeq = 0;

/**
 * Hook agar komponen anak (seperti Three.js 3D Avatar dan AudioWaveform)
 * otomatis menunda/menjeda rendering ketika kartu LiquidCard berada di luar viewport.
 */
export function useCardVisibility(): CardVisibilityContextValue {
  return useContext(CardVisibilityContext);
}

interface LiquidCardProps {
  widgetId?: WidgetId;
  title?: string;
  subtitle?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  isWebGL?: boolean;
  draggable?: boolean;
  isDragging?: boolean;
  isDropTarget?: boolean;
  onDragStartWidget?: (id: WidgetId) => void;
  onDragOverWidget?: (id: WidgetId) => void;
  onDropWidget?: (targetId: WidgetId) => void;
  onDragEndWidget?: () => void;
  onPointerDragStart?: (id: WidgetId, e: React.PointerEvent) => void;
}

/**
 * Kartu Liquid Glass global dengan:
 * - IntersectionObserver Lazy Rendering (blur berat, gyroscope, dan animasi hanya aktif saat di viewport)
 * - Global Framer Motion ripple effect pada koordinat pointer/sentuhan yang akurat
 * - Kepatuhan penuh terhadap media query prefers-reduced-motion
 * - Specular highlight mengikuti kursor/gyroscope dan drag-and-drop 60fps
 */
export function LiquidCard({
  widgetId,
  title,
  subtitle,
  headerRight,
  children,
  className = '',
  isWebGL = false,
  draggable = false,
  isDragging = false,
  isDropTarget = false,
  onDragStartWidget,
  onDragOverWidget,
  onDropWidget,
  onDragEndWidget,
  onPointerDragStart,
}: LiquidCardProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const prefersReducedMotion = Boolean(useReducedMotion());
  const [ripples, setRipples] = useState<LiquidRippleSpec[]>([]);
  const [visibility, setVisibility] = useState<LazyMountState>(() => ({
    isInViewport: typeof IntersectionObserver === 'undefined',
    hasEnteredViewport: typeof IntersectionObserver === 'undefined',
  }));

  // Bersihkan ripple aktif seketika apabila prefers-reduced-motion diaktifkan
  useEffect(() => {
    if (prefersReducedMotion) {
      setRipples([]);
    }
  }, [prefersReducedMotion]);

  // Pantau visibilitas kartu di viewport menggunakan IntersectionObserver
  useEffect(() => {
    const el = cardRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setVisibility({ isInViewport: true, hasEnteredViewport: true });
      return undefined;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        setVisibility((prev) => nextLazyMountState(prev, entry.isIntersecting));
      },
      {
        root: null,
        rootMargin: '48px 0px',
        threshold: 0.01,
      },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Dukungan gyroscope HP hanya aktif ketika kartu terlihat di viewport dan tidak reduced-motion
  useEffect(() => {
    if (!visibility.isInViewport || prefersReducedMotion) return undefined;

    const handleOrientation = (event: DeviceOrientationEvent) => {
      if (!cardRef.current || event.gamma == null || event.beta == null) return;
      const x = Math.max(5, Math.min(95, 50 + event.gamma * 1.2));
      const y = Math.max(5, Math.min(95, 35 + (event.beta - 45) * 0.9));
      cardRef.current.style.setProperty('--mx', `${x}%`);
      cardRef.current.style.setProperty('--my', `${y}%`);
    };

    if (typeof window !== 'undefined' && 'DeviceOrientationEvent' in window) {
      window.addEventListener('deviceorientation', handleOrientation, { passive: true });
      return () => window.removeEventListener('deviceorientation', handleOrientation);
    }
    return undefined;
  }, [visibility.isInViewport, prefersReducedMotion]);

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!visibility.isInViewport) return;
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    el.style.setProperty('--mx', `${x}px`);
    el.style.setProperty('--my', `${y}px`);
  };

  // Tangkap interaksi pointer di fase capture agar seluruh elemen dalam LiquidCard memicu ripple cair global
  const handlePointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    if (target?.closest('[data-drag-handle="true"]')) return;

    const mediaReduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!shouldSpawnRipple(prefersReducedMotion || mediaReduced, visibility.isInViewport)) {
      return;
    }

    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    globalRippleSeq += 1;
    const nextRipple = computeLiquidRipple(
      { clientX: e.clientX, clientY: e.clientY },
      rect,
      globalRippleSeq,
    );
    setRipples((prev) => appendRipple(prev, nextRipple, 4));
  };

  const handleRippleComplete = useCallback((id: number) => {
    setRipples((prev) => prev.filter((r) => r.id !== id));
  }, []);

  return (
    <CardVisibilityContext.Provider value={visibility}>
      <motion.section
        ref={cardRef}
        layout={!prefersReducedMotion}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : {
                layout: { type: 'spring', stiffness: 360, damping: 32, mass: 0.85 },
              }
        }
        data-widget-id={widgetId}
        data-in-viewport={visibility.isInViewport ? 'true' : 'false'}
        data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
        draggable={draggable}
        onDragStart={() => {
          if (draggable && widgetId && onDragStartWidget) onDragStartWidget(widgetId);
        }}
        onDragOver={(e) => {
          if (draggable && widgetId && onDragOverWidget) {
            e.preventDefault();
            onDragOverWidget(widgetId);
          }
        }}
        onDrop={(e) => {
          if (draggable && widgetId && onDropWidget) {
            e.preventDefault();
            onDropWidget(widgetId);
          }
        }}
        onDragEnd={() => {
          if (onDragEndWidget) onDragEndWidget();
        }}
        onPointerMove={handlePointerMove}
        onPointerDownCapture={handlePointerDownCapture}
        className={`liquid-card ${isWebGL ? 'liquid-card-webgl' : ''} ${
          !visibility.isInViewport ? 'liquid-card-offscreen' : ''
        } ${isDragging ? 'is-dragging' : ''} ${
          isDropTarget ? 'is-drop-target' : ''
        } p-5 ${className}`}
      >
        {/* Lapisan ripple cair global berbasis Framer Motion */}
        <LiquidRippleLayer
          ripples={ripples}
          prefersReducedMotion={prefersReducedMotion}
          onComplete={handleRippleComplete}
        />

        {(title || draggable || headerRight) && (
          <div className="relative z-10 mb-3.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="min-w-[180px] flex-1">
              {title && (
                <h2 className="font-display text-[15px] font-semibold tracking-tight text-white/95 leading-snug">
                  {title}
                </h2>
              )}
              {subtitle && (
                <p className="text-xs text-slate-400 mt-0.5 leading-snug">{subtitle}</p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {headerRight}
              {draggable && widgetId && (
                <button
                  type="button"
                  data-drag-handle="true"
                  aria-label={`Geser widget ${title ?? widgetId}`}
                  title="Tahan & geser untuk menyusun ulang widget"
                  onPointerDown={(e) => {
                    if (onPointerDragStart) onPointerDragStart(widgetId, e);
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 hover:bg-white/10 hover:text-white cursor-grab active:cursor-grabbing transition-colors touch-none"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}

        <div className="relative z-10">{children}</div>
      </motion.section>
    </CardVisibilityContext.Provider>
  );
}

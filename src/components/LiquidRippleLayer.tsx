import { AnimatePresence, motion } from 'motion/react';
import type { LiquidRippleSpec } from '../utils/rippleMath';

interface LiquidRippleLayerProps {
  ripples: LiquidRippleSpec[];
  prefersReducedMotion: boolean;
  onComplete: (id: number) => void;
}

/**
 * Lapisan efek ripple cair berbasis Framer Motion (motion/react) yang memancar tepat
 * dari titik koordinat kursor/sentuhan dan menghormati prefers-reduced-motion.
 */
export function LiquidRippleLayer({
  ripples,
  prefersReducedMotion,
  onComplete,
}: LiquidRippleLayerProps) {
  if (prefersReducedMotion) return null;

  return (
    <span
      className="pointer-events-none absolute inset-0 z-[5] overflow-hidden rounded-[inherit]"
      aria-hidden="true"
    >
      <AnimatePresence>
        {ripples.map((r) => (
          <span
            key={r.id}
            data-testid="liquid-ripple"
            data-origin-x={r.x}
            data-origin-y={r.y}
            style={{
              left: `${r.x}px`,
              top: `${r.y}px`,
              width: `${r.diameter}px`,
              height: `${r.diameter}px`,
            }}
            className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
          >
            {/* Gelombang isi cair dengan gradasi tema CSS variables */}
            <motion.span
              initial={{ scale: 0, opacity: 0.68 }}
              animate={{ scale: 1, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.68,
                ease: [0.16, 1, 0.3, 1],
              }}
              onAnimationComplete={() => onComplete(r.id)}
              className="liquid-ripple-fill block h-full w-full rounded-full"
            />

            {/* Cincin refraksi tepi cair tipis */}
            <motion.span
              initial={{ scale: 0.06, opacity: 0.6 }}
              animate={{ scale: 1.04, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.56,
                ease: [0.2, 0.85, 0.25, 1],
              }}
              className="liquid-ripple-ring absolute inset-0 block rounded-full"
            />
          </span>
        ))}
      </AnimatePresence>
    </span>
  );
}

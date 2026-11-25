export interface LiquidRippleSpec {
  id: number;
  x: number;
  y: number;
  diameter: number;
}

export interface RectBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PointerCoords {
  clientX: number;
  clientY: number;
}

/**
 * Menghitung koordinat lokal ripple tepat pada titik sentuh/klik kursor
 * dan diameter maksimum agar gelombang cair menjangkau sudut terjauh kartu.
 */
export function computeLiquidRipple(
  pointer: PointerCoords,
  rect: RectBounds,
  id: number,
): LiquidRippleSpec {
  const width = Math.max(0, rect.width);
  const height = Math.max(0, rect.height);
  const rawX = pointer.clientX - rect.left;
  const rawY = pointer.clientY - rect.top;

  const x = Math.max(0, Math.min(width, Math.round(rawX * 10) / 10));
  const y = Math.max(0, Math.min(height, Math.round(rawY * 10) / 10));

  const farthestX = Math.max(x, width - x);
  const farthestY = Math.max(y, height - y);
  const radius = Math.hypot(farthestX, farthestY);
  const diameter = Math.max(96, Math.ceil(radius * 2) + 24);

  return { id, x, y, diameter };
}

/**
 * Menentukan apakah efek ripple boleh dipicu:
 * wajib nonaktif ketika prefers-reduced-motion aktif atau kartu di luar viewport.
 */
export function shouldSpawnRipple(
  prefersReducedMotion: boolean,
  isInViewport: boolean,
): boolean {
  return !prefersReducedMotion && isInViewport;
}

/**
 * Membatasi jumlah ripple aktif secara bersamaan per kartu agar animasi tetap 60fps.
 */
export function appendRipple<T>(
  ripples: readonly T[],
  next: T,
  maxActive = 4,
): T[] {
  const limit = Math.max(1, maxActive);
  if (ripples.length < limit) {
    return [...ripples, next];
  }
  return [...ripples.slice(ripples.length - limit + 1), next];
}

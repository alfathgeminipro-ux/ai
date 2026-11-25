/**
 * Utilitas logika murni untuk keputusan Lazy Rendering berbasis IntersectionObserver.
 */

export interface RenderActivityInput {
  isInViewport: boolean;
  isDocumentHidden: boolean;
}

export interface LazyMountState {
  hasEnteredViewport: boolean;
  isInViewport: boolean;
}

/**
 * Menentukan apakah loop animasi berat (Three.js WebGL / waveform rAF) boleh berjalan.
 */
export function shouldRunRenderLoop({
  isInViewport,
  isDocumentHidden,
}: RenderActivityInput): boolean {
  return isInViewport && !isDocumentHidden;
}

/**
 * Memperbarui state lazy mount ketika IntersectionObserver melaporkan perubahan visibilitas.
 */
export function nextLazyMountState(
  prev: LazyMountState,
  isIntersecting: boolean,
): LazyMountState {
  return {
    isInViewport: isIntersecting,
    hasEnteredViewport: prev.hasEnteredViewport || isIntersecting,
  };
}

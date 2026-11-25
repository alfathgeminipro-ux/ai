import type { ThemePalette } from '../types';

export const THEME_STORAGE_KEY = 'marvis_theme_v1';

export const PRESET_THEMES: ThemePalette[] = [
  {
    id: 'biru',
    name: 'Biru',
    accent: '#3b82f6',
    accent2: '#38bdf8',
    glow: 'rgba(59, 130, 246, 0.45)',
    bg1: '#050919',
    bg2: '#0f1738',
    surfaceTint: 'rgba(59, 130, 246, 0.14)',
  },
  {
    id: 'merah',
    name: 'Merah',
    accent: '#ef4444',
    accent2: '#fb7185',
    glow: 'rgba(239, 68, 68, 0.45)',
    bg1: '#14060a',
    bg2: '#280d14',
    surfaceTint: 'rgba(239, 68, 68, 0.14)',
  },
  {
    id: 'hijau',
    name: 'Hijau',
    accent: '#10b981',
    accent2: '#34d399',
    glow: 'rgba(16, 185, 129, 0.44)',
    bg1: '#041310',
    bg2: '#0a2620',
    surfaceTint: 'rgba(16, 185, 129, 0.14)',
  },
  {
    id: 'ungu',
    name: 'Ungu',
    accent: '#a855f7',
    accent2: '#c084fc',
    glow: 'rgba(168, 85, 247, 0.45)',
    bg1: '#0c0618',
    bg2: '#1d1035',
    surfaceTint: 'rgba(168, 85, 247, 0.14)',
  },
  {
    id: 'emas',
    name: 'Emas',
    accent: '#f59e0b',
    accent2: '#fbbf24',
    glow: 'rgba(245, 158, 11, 0.44)',
    bg1: '#140e04',
    bg2: '#281d0a',
    surfaceTint: 'rgba(245, 158, 11, 0.14)',
  },
  {
    id: 'pink',
    name: 'Pink',
    accent: '#ec4899',
    accent2: '#f472b6',
    glow: 'rgba(236, 72, 153, 0.45)',
    bg1: '#160611',
    bg2: '#2b0d21',
    surfaceTint: 'rgba(236, 72, 153, 0.14)',
  },
  {
    id: 'cyan',
    name: 'Cyan',
    accent: '#06b6d4',
    accent2: '#22d3ee',
    glow: 'rgba(6, 182, 212, 0.45)',
    bg1: '#041218',
    bg2: '#0a2430',
    surfaceTint: 'rgba(6, 182, 212, 0.14)',
  },
  {
    id: 'oranye',
    name: 'Oranye',
    accent: '#f97316',
    accent2: '#fb923c',
    glow: 'rgba(249, 115, 22, 0.45)',
    bg1: '#160b05',
    bg2: '#2c160a',
    surfaceTint: 'rgba(249, 115, 22, 0.14)',
  },
  {
    id: 'neon',
    name: 'Neon',
    accent: '#00f0ff',
    accent2: '#a855f7',
    glow: 'rgba(0, 240, 255, 0.5)',
    bg1: '#050618',
    bg2: '#130c30',
    surfaceTint: 'rgba(0, 240, 255, 0.15)',
  },
  {
    id: 'monokrom',
    name: 'Hitam Putih',
    accent: '#e2e8f0',
    accent2: '#94a3b8',
    glow: 'rgba(226, 232, 240, 0.34)',
    bg1: '#07080a',
    bg2: '#15181e',
    surfaceTint: 'rgba(226, 232, 240, 0.1)',
    isMonochrome: true,
  },
];

// Kamus warna bebas dalam bahasa Indonesia & Inggris
const FREEFORM_COLOR_MAP: Record<string, string> = {
  tosca: '#14b8a6',
  toska: '#14b8a6',
  turquoise: '#14b8a6',
  teal: '#0d9488',
  mint: '#34d399',
  lime: '#84cc16',
  kuning: '#eab308',
  yellow: '#eab308',
  nila: '#6366f1',
  indigo: '#6366f1',
  magenta: '#d946ef',
  crimson: '#dc2626',
  maroon: '#9f1239',
  coral: '#fb7185',
  perak: '#cbd5e1',
  silver: '#cbd5e1',
  putih: '#e2e8f0',
  biru: '#3b82f6',
  blue: '#3b82f6',
  merah: '#ef4444',
  red: '#ef4444',
  hijau: '#10b981',
  green: '#10b981',
  ungu: '#a855f7',
  purple: '#a855f7',
  emas: '#f59e0b',
  gold: '#f59e0b',
  pink: '#ec4899',
  cyan: '#06b6d4',
  oranye: '#f97316',
  orange: '#f97316',
};

export function normalizeHex(raw: string): string | null {
  const cleaned = raw.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(cleaned)) {
    const [r, g, b] = cleaned.split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  if (/^[0-9a-fA-F]{6}$/.test(cleaned)) {
    return `#${cleaned}`.toLowerCase();
  }
  return null;
}

export function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex) ?? '#3b82f6';
  const num = parseInt(normalized.slice(1), 16);
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((c) => c.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Membangun palet tema lengkap dari satu warna hex kustom.
 */
export function buildCustomTheme(hex: string, label?: string): ThemePalette {
  const validHex = normalizeHex(hex) ?? '#3b82f6';
  const { r, g, b } = hexToRgb(validHex);
  const accent2 = rgbToHex(r + (255 - r) * 0.28, g + (255 - g) * 0.28, b + (255 - b) * 0.28);
  const bg1 = rgbToHex(r * 0.06 + 4, g * 0.06 + 6, b * 0.06 + 10);
  const bg2 = rgbToHex(r * 0.14 + 8, g * 0.14 + 10, b * 0.14 + 18);

  return {
    id: `custom-${validHex.slice(1)}`,
    name: label ? label.charAt(0).toUpperCase() + label.slice(1) : validHex.toUpperCase(),
    accent: validHex,
    accent2,
    glow: `rgba(${r}, ${g}, ${b}, 0.46)`,
    bg1,
    bg2,
    surfaceTint: `rgba(${r}, ${g}, ${b}, 0.14)`,
  };
}

/**
 * Memetakan input warna dari pengguna atau LLM (nama preset, warna bebas, atau hex) menjadi ThemePalette.
 */
export function resolveTheme(input: string, fallbackHex?: string): ThemePalette {
  const normalized = input.trim().toLowerCase();

  if (
    normalized.includes('hitam putih') ||
    normalized.includes('monokrom') ||
    normalized.includes('monochrome') ||
    normalized.includes('abu')
  ) {
    return PRESET_THEMES.find((t) => t.id === 'monokrom')!;
  }

  if (normalized.includes('neon') || normalized.includes('cyber')) {
    return PRESET_THEMES.find((t) => t.id === 'neon')!;
  }

  // Cek kode hex langsung pada input
  const hexMatch = normalized.match(/#([0-9a-f]{3}|[0-9a-f]{6})\b/i);
  if (hexMatch) {
    const parsed = normalizeHex(hexMatch[0]);
    if (parsed) return buildCustomTheme(parsed, parsed.toUpperCase());
  }

  // Cek preset persis terlebih dahulu
  for (const preset of PRESET_THEMES) {
    if (normalized === preset.id || normalized === preset.name.toLowerCase()) {
      return preset;
    }
  }

  // Jika LLM mengirimkan hex khusus untuk warna bebas/bernuansa (mis. "biru samudra dalam")
  if (fallbackHex) {
    const parsedFallback = normalizeHex(fallbackHex);
    if (parsedFallback) {
      return buildCustomTheme(parsedFallback, input.trim() || parsedFallback);
    }
  }

  // Cek preset berdasarkan kecocokan kata dalam kalimat perintah (mis. "ganti jadi emas")
  for (const preset of PRESET_THEMES) {
    if (normalized.includes(preset.id)) {
      return preset;
    }
  }

  // Cek kamus warna bebas Indonesia/Inggris
  for (const [key, hex] of Object.entries(FREEFORM_COLOR_MAP)) {
    if (normalized.includes(key)) {
      const matchedPreset = PRESET_THEMES.find((p) => p.accent.toLowerCase() === hex);
      if (matchedPreset) return matchedPreset;
      return buildCustomTheme(hex, key);
    }
  }

  return PRESET_THEMES[0];
}

export function applyThemeToDocument(theme: ThemePalette): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--accent', theme.accent);
  root.style.setProperty('--accent-2', theme.accent2);
  root.style.setProperty('--glow', theme.glow);
  root.style.setProperty('--bg-1', theme.bg1);
  root.style.setProperty('--bg-2', theme.bg2);
  root.style.setProperty('--surface-tint', theme.surfaceTint);
}

export function loadSavedTheme(): ThemePalette {
  if (typeof window === 'undefined') return PRESET_THEMES[0];
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (!raw) return PRESET_THEMES[0];
    const parsed = JSON.parse(raw) as ThemePalette;
    if (parsed && typeof parsed.accent === 'string' && normalizeHex(parsed.accent)) {
      return parsed;
    }
  } catch {
    // Abaikan data storage rusak
  }
  return PRESET_THEMES[0];
}

export function saveTheme(theme: ThemePalette): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(theme));
  } catch {
    // Abaikan kuota penuh
  }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCustomTheme, normalizeHex, PRESET_THEMES, resolveTheme } from './themeEngine';

test('resolveTheme maps Indonesian preset names accurately', () => {
  assert.equal(resolveTheme('merah').id, 'merah');
  assert.equal(resolveTheme('ganti jadi emas').id, 'emas');
  assert.equal(resolveTheme('tema hitam putih').id, 'monokrom');
  assert.equal(resolveTheme('mode neon').id, 'neon');
});

test('resolveTheme parses free-form Indonesian color names and hex codes', () => {
  const tosca = resolveTheme('warna tosca');
  assert.equal(tosca.accent, '#14b8a6');

  const hexTheme = resolveTheme('ganti ke #ff5500');
  assert.equal(hexTheme.accent, '#ff5500');

  const shortHex = normalizeHex('#0af');
  assert.equal(shortHex, '#00aaff');
});

test('resolveTheme uses LLM-provided fallback hex when name is unknown', () => {
  const theme = resolveTheme('biru samudra dalam', '#1d4ed8');
  assert.equal(theme.accent, '#1d4ed8');
  assert.ok(theme.glow.startsWith('rgba('));
});

test('buildCustomTheme derives valid dark backgrounds and glow', () => {
  const custom = buildCustomTheme('#ff5500', 'Oranye Api');
  assert.equal(custom.name, 'Oranye Api');
  assert.match(custom.bg1, /^#[0-9a-f]{6}$/);
  assert.match(custom.bg2, /^#[0-9a-f]{6}$/);
  assert.equal(PRESET_THEMES.length >= 8, true);
});

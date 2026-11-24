// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { LOCALE_DICTIONARIES, SUPPORTED_LANGUAGES } from '../i18n';

function flattenKeys(obj: unknown, prefix = ''): Array<{ key: string; value: unknown }> {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return prefix ? [{ key: prefix, value: obj }] : [];
  }
  return Object.entries(obj as Record<string, unknown>).flatMap(([k, v]) => {
    const nextPrefix = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return flattenKeys(v, nextPrefix);
    }
    return [{ key: nextPrefix, value: v }];
  });
}

describe('17-Locale Translation Completeness & Parity', () => {
  it('exposes exactly 17 supported languages with RTL strictly on Arabic', () => {
    expect(SUPPORTED_LANGUAGES).toHaveLength(17);
    const rtlLocales = SUPPORTED_LANGUAGES.filter(l => l.dir === 'rtl').map(l => l.code);
    expect(rtlLocales).toEqual(['ar']);
  });

  it('ensures every supported locale has identical key sets and non-empty values matching es and en', () => {
    const esEntries = flattenKeys(LOCALE_DICTIONARIES.es);
    const esKeySet = new Set(esEntries.map(e => e.key));
    expect(esKeySet.size).toBeGreaterThan(1400);

    for (const meta of SUPPORTED_LANGUAGES) {
      const dict = LOCALE_DICTIONARIES[meta.code];
      expect(dict, `Missing dictionary for ${meta.code}`).toBeDefined();

      const entries = flattenKeys(dict);
      const keySet = new Set(entries.map(e => e.key));

      const missing = [...esKeySet].filter(k => !keySet.has(k));
      const extra = [...keySet].filter(k => !esKeySet.has(k));

      expect(missing, `Missing keys in ${meta.code}`).toEqual([]);
      expect(extra, `Extra keys in ${meta.code}`).toEqual([]);

      for (const { key, value } of entries) {
        if (typeof value === 'string') {
          expect(value.trim().length, `Empty string at ${meta.code}.${key}`).toBeGreaterThan(0);
        } else if (Array.isArray(value)) {
          expect(value.length, `Empty array at ${meta.code}.${key}`).toBeGreaterThan(0);
        }
      }
    }
  });
});

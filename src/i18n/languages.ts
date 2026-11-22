/**
 * languages.ts
 * Catálogo oficial de los 17 idiomas soportados en Commonspoly Edición Verde.
 */

import { LanguageCode, LanguageMeta } from './types';

export const SUPPORTED_LANGUAGES: LanguageMeta[] = [
  { code: 'es', bcp47: 'es-ES', nativeName: 'Español', englishName: 'Spanish', shortCode: 'ES', dir: 'ltr' },
  { code: 'en', bcp47: 'en-US', nativeName: 'English', englishName: 'English', shortCode: 'EN', dir: 'ltr' },
  { code: 'fr', bcp47: 'fr-FR', nativeName: 'Français', englishName: 'French', shortCode: 'FR', dir: 'ltr' },
  { code: 'pt', bcp47: 'pt-PT', nativeName: 'Português', englishName: 'Portuguese', shortCode: 'PT', dir: 'ltr' },
  { code: 'it', bcp47: 'it-IT', nativeName: 'Italiano', englishName: 'Italian', shortCode: 'IT', dir: 'ltr' },
  { code: 'de', bcp47: 'de-DE', nativeName: 'Deutsch', englishName: 'German', shortCode: 'DE', dir: 'ltr' },
  { code: 'ca', bcp47: 'ca-ES', nativeName: 'Català', englishName: 'Catalan', shortCode: 'CA', dir: 'ltr' },
  { code: 'gl', bcp47: 'gl-ES', nativeName: 'Galego', englishName: 'Galician', shortCode: 'GL', dir: 'ltr' },
  { code: 'eu', bcp47: 'eu-ES', nativeName: 'Euskara', englishName: 'Basque', shortCode: 'EU', dir: 'ltr' },
  { code: 'nl', bcp47: 'nl-NL', nativeName: 'Nederlands', englishName: 'Dutch', shortCode: 'NL', dir: 'ltr' },
  { code: 'pl', bcp47: 'pl-PL', nativeName: 'Polski', englishName: 'Polish', shortCode: 'PL', dir: 'ltr' },
  { code: 'ru', bcp47: 'ru-RU', nativeName: 'Русский', englishName: 'Russian', shortCode: 'RU', dir: 'ltr' },
  { code: 'ja', bcp47: 'ja-JP', nativeName: '日本語', englishName: 'Japanese', shortCode: 'JA', dir: 'ltr' },
  { code: 'ko', bcp47: 'ko-KR', nativeName: '한국어', englishName: 'Korean', shortCode: 'KO', dir: 'ltr' },
  { code: 'zh', bcp47: 'zh-CN', nativeName: '简体中文', englishName: 'Chinese', shortCode: 'ZH', dir: 'ltr' },
  { code: 'ar', bcp47: 'ar-SA', nativeName: 'العربية', englishName: 'Arabic', shortCode: 'AR', dir: 'rtl' },
  { code: 'hi', bcp47: 'hi-IN', nativeName: 'हिन्दी', englishName: 'Hindi', shortCode: 'HI', dir: 'ltr' }
];

export const LANGUAGE_META_MAP: Record<LanguageCode, LanguageMeta> = SUPPORTED_LANGUAGES.reduce(
  (acc, item) => {
    acc[item.code] = item;
    return acc;
  },
  {} as Record<LanguageCode, LanguageMeta>
);

export function isSupportedLanguage(code: string): code is LanguageCode {
  return code in LANGUAGE_META_MAP;
}

export function detectBrowserLanguage(): LanguageCode {
  if (typeof navigator === 'undefined') return 'es';
  const candidates = [
    ...(Array.isArray(navigator.languages) ? navigator.languages : []),
    navigator.language
  ].filter(Boolean);

  for (const raw of candidates) {
    const base = raw.toLowerCase().split('-')[0];
    if (isSupportedLanguage(base)) {
      return base;
    }
  }
  return 'es';
}

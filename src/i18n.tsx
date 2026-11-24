/**
 * src/i18n.tsx
 * Configuración oficial de i18next con i18next-browser-languagedetector y react-i18next.
 * Proporciona soporte multilingüe completo (Español, Inglés y todos los idiomas soportados),
 * sincronización con localStorage y exportación del LanguageProvider.
 */

import i18n from 'i18next';
import { initReactI18next, useTranslation, I18nextProvider } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import { es } from './i18n/locales/es';
import { en } from './i18n/locales/en';
import {
  LOCALE_DICTIONARIES,
  SUPPORTED_LANGUAGES,
  LANGUAGE_META_MAP,
  isSupportedLanguage,
  detectBrowserLanguage,
  getCurrentLanguage,
  getCurrentLanguageMeta,
  getCurrentDict,
  LanguageProvider as OriginalLanguageProvider,
  useI18n,
  type LanguageCode,
  type LanguageMeta,
  type TranslationDict
} from './i18n/index';

export const resources = {
  es: { translation: es },
  en: { translation: en },
  fr: { translation: LOCALE_DICTIONARIES.fr },
  pt: { translation: LOCALE_DICTIONARIES.pt },
  it: { translation: LOCALE_DICTIONARIES.it },
  de: { translation: LOCALE_DICTIONARIES.de },
  ca: { translation: LOCALE_DICTIONARIES.ca },
  gl: { translation: LOCALE_DICTIONARIES.gl },
  eu: { translation: LOCALE_DICTIONARIES.eu },
  nl: { translation: LOCALE_DICTIONARIES.nl },
  pl: { translation: LOCALE_DICTIONARIES.pl },
  ru: { translation: LOCALE_DICTIONARIES.ru },
  ja: { translation: LOCALE_DICTIONARIES.ja },
  ko: { translation: LOCALE_DICTIONARIES.ko },
  zh: { translation: LOCALE_DICTIONARIES.zh },
  ar: { translation: LOCALE_DICTIONARIES.ar },
  hi: { translation: LOCALE_DICTIONARIES.hi }
} as const;

if (!i18n.isInitialized) {
  void i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'es',
      supportedLngs: ['es', 'en', 'fr', 'pt', 'it', 'de', 'ca', 'gl', 'eu', 'nl', 'pl', 'ru', 'ja', 'ko', 'zh', 'ar', 'hi'],
      interpolation: {
        escapeValue: false
      },
      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        caches: ['localStorage'],
        lookupLocalStorage: 'commonspoly_language_v1'
      },
      react: {
        useSuspense: false
      }
    });
}

export const LanguageProvider = OriginalLanguageProvider;

export {
  i18n,
  useTranslation,
  I18nextProvider,
  useI18n,
  SUPPORTED_LANGUAGES,
  LANGUAGE_META_MAP,
  LOCALE_DICTIONARIES,
  isSupportedLanguage,
  detectBrowserLanguage,
  getCurrentLanguage,
  getCurrentLanguageMeta,
  getCurrentDict,
  type LanguageCode,
  type LanguageMeta,
  type TranslationDict
};

export default i18n;

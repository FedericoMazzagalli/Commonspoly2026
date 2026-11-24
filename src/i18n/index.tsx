/**
 * i18n/index.tsx
 * Proveedor global de traducciones con detección automática, persistencia en localStorage,
 * soporte RTL para árabe, sincronización de <html lang/dir> y acceso no-React para audio/narración.
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { LanguageCode, LanguageMeta, TranslationDict } from './types';
import {
  SUPPORTED_LANGUAGES,
  LANGUAGE_META_MAP,
  isSupportedLanguage,
  detectBrowserLanguage
} from './languages';

import { es } from './locales/es';
import { en } from './locales/en';
import { fr } from './locales/fr';
import { pt } from './locales/pt';
import { it } from './locales/it';
import { de } from './locales/de';
import { ca } from './locales/ca';
import { gl } from './locales/gl';
import { eu } from './locales/eu';
import { nl } from './locales/nl';
import { pl } from './locales/pl';
import { ru } from './locales/ru';
import { ja } from './locales/ja';
import { ko } from './locales/ko';
import { zh } from './locales/zh';
import { ar } from './locales/ar';
import { hi } from './locales/hi';

import i18n from 'i18next';

export type { LanguageCode, LanguageMeta, TranslationDict } from './types';
export { SUPPORTED_LANGUAGES, LANGUAGE_META_MAP, isSupportedLanguage, detectBrowserLanguage };

const STORAGE_KEY = 'commonspoly_language_v1';

export const LOCALE_DICTIONARIES: Record<LanguageCode, TranslationDict> = {
  es,
  en,
  fr,
  pt,
  it,
  de,
  ca,
  gl,
  eu,
  nl,
  pl,
  ru,
  ja,
  ko,
  zh,
  ar,
  hi
};

function readInitialLanguage(): LanguageCode {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved && isSupportedLanguage(saved)) {
        return saved;
      }
    }
  } catch {
    // Ignore storage read errors in restricted contexts
  }
  return detectBrowserLanguage();
}

let activeGlobalLanguage: LanguageCode = readInitialLanguage();

function syncDocumentLanguage(code: LanguageCode): void {
  if (typeof document === 'undefined') return;
  const meta = LANGUAGE_META_MAP[code] ?? LANGUAGE_META_MAP.es;
  document.documentElement.lang = meta.bcp47;
  document.documentElement.dir = meta.dir;
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new CustomEvent('commonspoly:language-changed', { detail: { code, bcp47: meta.bcp47 } }));
  }
}

export function getCurrentLanguage(): LanguageCode {
  return activeGlobalLanguage;
}

export function getCurrentLanguageMeta(): LanguageMeta {
  return LANGUAGE_META_MAP[activeGlobalLanguage] ?? LANGUAGE_META_MAP.es;
}

export function getCurrentDict(): TranslationDict {
  return LOCALE_DICTIONARIES[activeGlobalLanguage] ?? es;
}

interface I18nContextValue {
  language: LanguageCode;
  languageMeta: LanguageMeta;
  setLanguage: (code: LanguageCode) => void;
  t: TranslationDict;
  dict: TranslationDict;
  languages: LanguageMeta[];
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatDate: (date: Date | number | string, options?: Intl.DateTimeFormatOptions) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<LanguageCode>(() => {
    const initial = readInitialLanguage();
    activeGlobalLanguage = initial;
    syncDocumentLanguage(initial);
    return initial;
  });

  useEffect(() => {
    activeGlobalLanguage = language;
    syncDocumentLanguage(language);
    if (i18n.isInitialized && i18n.language !== language) {
      void i18n.changeLanguage(language);
    }
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_KEY, language);
      }
    } catch {
      // Ignore storage write errors
    }
  }, [language]);

  const setLanguage = useCallback((code: LanguageCode) => {
    if (!isSupportedLanguage(code)) return;
    activeGlobalLanguage = code;
    syncDocumentLanguage(code);
    setLanguageState(code);
  }, []);

  const languageMeta = LANGUAGE_META_MAP[language] ?? LANGUAGE_META_MAP.es;
  const dict = LOCALE_DICTIONARIES[language] ?? es;

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => {
      try {
        return new Intl.NumberFormat(languageMeta.bcp47, options).format(value);
      } catch {
        return String(value);
      }
    },
    [languageMeta.bcp47]
  );

  const formatDate = useCallback(
    (date: Date | number | string, options?: Intl.DateTimeFormatOptions) => {
      try {
        const d = date instanceof Date ? date : new Date(date);
        return new Intl.DateTimeFormat(languageMeta.bcp47, options).format(d);
      } catch {
        return String(date);
      }
    },
    [languageMeta.bcp47]
  );

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      languageMeta,
      setLanguage,
      t: dict,
      dict,
      languages: SUPPORTED_LANGUAGES,
      formatNumber,
      formatDate
    }),
    [language, languageMeta, setLanguage, dict, formatNumber, formatDate]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (ctx) return ctx;

  // Fallback seguro si se invoca fuera de LanguageProvider
  const fallbackCode = getCurrentLanguage();
  const fallbackMeta = LANGUAGE_META_MAP[fallbackCode] ?? LANGUAGE_META_MAP.es;
  const fallbackDict = LOCALE_DICTIONARIES[fallbackCode] ?? es;
  return {
    language: fallbackCode,
    languageMeta: fallbackMeta,
    setLanguage: (code: LanguageCode) => {
      activeGlobalLanguage = code;
      syncDocumentLanguage(code);
    },
    t: fallbackDict,
    dict: fallbackDict,
    languages: SUPPORTED_LANGUAGES,
    formatNumber: (v, opts) => new Intl.NumberFormat(fallbackMeta.bcp47, opts).format(v),
    formatDate: (d, opts) =>
      new Intl.DateTimeFormat(fallbackMeta.bcp47, opts).format(d instanceof Date ? d : new Date(d))
  };
}

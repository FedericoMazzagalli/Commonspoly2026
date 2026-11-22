/**
 * LanguageSelector.tsx
 * Selector accesible y buscable para los 17 idiomas soportados de Commonspoly.
 * Diseñado sin backdrop-blur ni animate-pulse para mantener rendimiento WebGL 3D estable.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Globe, Search } from 'lucide-react';
import { useI18n } from '../../i18n';

interface LanguageSelectorProps {
  variant?: 'compact' | 'pill' | 'inlineGrid';
  align?: 'left' | 'right';
  className?: string;
  onSelect?: () => void;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  variant = 'pill',
  align = 'right',
  className = '',
  onSelect
}) => {
  const { language, languageMeta, setLanguage, languages, t } = useI18n();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const filteredLanguages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return languages;
    return languages.filter(
      (lang) =>
        lang.nativeName.toLowerCase().includes(q) ||
        lang.englishName.toLowerCase().includes(q) ||
        lang.shortCode.toLowerCase().includes(q) ||
        lang.code.toLowerCase().includes(q)
    );
  }, [languages, query]);

  useEffect(() => {
    if (!open) return;
    const handleOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setTimeout(() => searchInputRef.current?.focus(), 20);
    } else {
      setQuery('');
    }
  }, [open]);

  if (variant === 'inlineGrid') {
    return (
      <div className={`space-y-3 ${className}`}>
        <div className="relative">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.common.searchLanguage}
            aria-label={t.common.searchLanguage}
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950/90 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-60 overflow-y-auto pr-1">
          {filteredLanguages.map((lang) => {
            const active = lang.code === language;
            return (
              <button
                key={lang.code}
                type="button"
                onClick={() => {
                  setLanguage(lang.code);
                  onSelect?.();
                }}
                dir={lang.dir}
                className={`text-left px-3 py-2 rounded-xl border transition flex items-center justify-between gap-2 ${
                  active
                    ? 'bg-emerald-950/80 border-emerald-400 text-emerald-100 shadow-sm'
                    : 'bg-slate-950/75 border-slate-800 text-slate-300 hover:border-slate-600 hover:text-white'
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-bold truncate">{lang.nativeName}</div>
                  <div className="text-[10px] text-slate-400 truncate">
                    {lang.englishName} · {lang.shortCode}
                  </div>
                </div>
                {active && <Check size={13} className="text-emerald-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${t.common.chooseLanguage}: ${languageMeta.nativeName}`}
        title={`${t.common.language}: ${languageMeta.nativeName}`}
        className={
          variant === 'compact'
            ? 'h-9 px-2.5 rounded-lg bg-slate-900/95 hover:bg-slate-800 border border-slate-700/80 text-slate-100 flex items-center gap-1.5 text-xs font-bold transition shadow-md cursor-pointer'
            : 'flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-900/95 hover:bg-slate-800 border border-slate-700/80 text-slate-100 text-xs font-bold transition shadow-md cursor-pointer'
        }
      >
        <Globe size={variant === 'compact' ? 14 : 16} className="text-emerald-400 shrink-0" />
        <span className="tracking-wide">{languageMeta.shortCode}</span>
        {variant === 'pill' && (
          <span className="hidden md:inline text-slate-300 font-semibold max-w-[92px] truncate">
            {languageMeta.nativeName}
          </span>
        )}
        <ChevronDown
          size={13}
          className={`text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label={t.common.chooseLanguage}
          className={`absolute top-full mt-2 w-72 rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl z-[120] overflow-hidden ${
            align === 'right' ? 'right-0' : 'left-0'
          }`}
        >
          <div className="p-2.5 border-b border-slate-800 bg-slate-950/90">
            <div className="flex items-center justify-between px-1 mb-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <Globe size={12} /> {t.common.chooseLanguage} ({languages.length})
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {languageMeta.shortCode}
              </span>
            </div>
            <div className="relative">
              <Search
                size={13}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.common.searchLanguage}
                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto p-1.5 space-y-1">
            {filteredLanguages.map((lang) => {
              const active = lang.code === language;
              return (
                <button
                  key={lang.code}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    setLanguage(lang.code);
                    setOpen(false);
                    onSelect?.();
                  }}
                  dir={lang.dir}
                  className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-2 transition cursor-pointer ${
                    active
                      ? 'bg-emerald-950/90 border border-emerald-500/60 text-emerald-100'
                      : 'hover:bg-slate-800/90 border border-transparent text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 text-center py-0.5 rounded bg-slate-800 text-[10px] font-mono font-bold text-slate-300 shrink-0">
                      {lang.shortCode}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold truncate">{lang.nativeName}</div>
                      <div className="text-[10px] text-slate-400 truncate">{lang.englishName}</div>
                    </div>
                  </div>
                  {active && <Check size={14} className="text-emerald-400 shrink-0" />}
                </button>
              );
            })}
            {filteredLanguages.length === 0 && (
              <div className="px-3 py-4 text-center text-xs text-slate-400">
                —
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

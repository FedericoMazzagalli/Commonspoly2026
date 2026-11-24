/**
 * SetupWizard.tsx
 * Asistente interactivo guiado paso a paso según el manual oficial de Commonspoly (Edición Verde)
 */

import React, { useState } from 'react';
import { 
  Users, 
  Dices, 
  ShieldAlert, 
  Sparkles, 
  Bot, 
  User, 
  ChevronRight,
  ChevronLeft,
  ChevronUp,
  ChevronDown,
  CheckCircle2, 
  RefreshCw,
  GraduationCap,
  Award,
  Box,
  CloudSun
} from 'lucide-react';
import { OFFICIAL_CHARACTERS } from '../data/characters';
import { SetupInitialRolls, DifficultyLevel, RulesetMode } from '../types/game';
import { playSound } from '../utils/audio';
import { Avatar3DPreview } from './Avatar3DPreview';
import { useI18n } from '../i18n';
import { LanguageSelector } from './hud/LanguageSelector';

interface SetupWizardProps {
  onComplete: (
    selectedCharacters: { baseCharId: string; controller: 'HUMAN' | 'BOT' }[],
    rolls: SetupInitialRolls
  ) => void;
  onCancel: () => void;
  onOpenWeatherSettings?: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({
  onComplete,
  onCancel,
  onOpenWeatherSettings
}) => {
  const { t } = useI18n();
  const [step, setStep] = useState<1 | 2>(1);
  const [rulesetMode, setRulesetMode] = useState<RulesetMode>('EXPANDED');
  const [enableTutorialOnStart, setEnableTutorialOnStart] = useState<boolean>(true);
  const [expandedCharId, setExpandedCharId] = useState<string | null>('carolina');

  // Paso 1: Selección de jugadores
  const [selectedChars, setSelectedChars] = useState<
    { baseCharId: string; controller: 'HUMAN' | 'BOT' }[]
  >([
    { baseCharId: 'carolina', controller: 'HUMAN' },
    { baseCharId: 'chelsea', controller: 'BOT' },
    { baseCharId: 'moha', controller: 'BOT' },
    { baseCharId: 'yayo', controller: 'BOT' }
  ]);

  // Paso 2: Tirada de dados para definir los 4 tipos de bienes y dificultad
  const [rolls, setRolls] = useState<{
    health: number;
    urban: number;
    knowledge: number;
    environment: number;
  }>({
    health: 3,
    urban: 2,
    knowledge: 4,
    environment: 3
  });

  const [isRolling, setIsRolling] = useState(false);

  // Cálculo de dificultad
  const totalSum = rolls.health + rolls.urban + rolls.knowledge + rolls.environment;
  let difficulty: DifficultyLevel = 'EN_TRANSICION';
  let speculatorsCount = 2;

  if (totalSum <= 10) {
    difficulty = 'MAD_MAX';
    speculatorsCount = 1;
  } else if (totalSum >= 18) {
    difficulty = 'COMUNLANDIA';
    speculatorsCount = 3;
  }

  const rollInitialDice = () => {
    setIsRolling(true);
    playSound.diceRoll();
    setTimeout(() => {
      setRolls({
        health: Math.floor(Math.random() * 6) + 1,
        urban: Math.floor(Math.random() * 6) + 1,
        knowledge: Math.floor(Math.random() * 6) + 1,
        environment: Math.floor(Math.random() * 6) + 1
      });
      setIsRolling(false);
    }, 600);
  };

  const toggleCharacter = (charId: string) => {
    const exists = selectedChars.find(c => c.baseCharId === charId);
    if (exists) {
      if (selectedChars.length <= 2) return; // Mínimo 2 jugadores
      playSound.uiToggle(false);
      setSelectedChars(prev => prev.filter(c => c.baseCharId !== charId));
    } else {
      if (selectedChars.length >= 8) return; // Máximo 8 jugadores
      playSound.uiToggle(true);
      setSelectedChars(prev => [...prev, { baseCharId: charId, controller: 'BOT' }]);
    }
  };

  const toggleController = (charId: string) => {
    playSound.uiClick();
    setSelectedChars(prev =>
      prev.map(c =>
        c.baseCharId === charId
          ? { ...c, controller: c.controller === 'HUMAN' ? 'BOT' : 'HUMAN' }
          : c
      )
    );
  };

  const handleToggleExpand = (charId: string) => {
    playSound.uiClick();
    setExpandedCharId(prev => (prev === charId ? null : charId));
  };

  const expandedIndex = expandedCharId
    ? OFFICIAL_CHARACTERS.findIndex(c => c.id === expandedCharId)
    : -1;
  const expandedChar = expandedIndex >= 0 ? OFFICIAL_CHARACTERS[expandedIndex] : null;
  const expandedSelection = expandedChar
    ? selectedChars.find(c => c.baseCharId === expandedChar.id)
    : undefined;

  const cycleExpandedChar = (delta: -1 | 1) => {
    playSound.uiClick();
    const baseIdx = expandedIndex >= 0 ? expandedIndex : 0;
    const nextIdx = (baseIdx + delta + OFFICIAL_CHARACTERS.length) % OFFICIAL_CHARACTERS.length;
    setExpandedCharId(OFFICIAL_CHARACTERS[nextIdx].id);
  };

  const getStateLabel = (val: number) => {
    if (val <= 2) return { text: t.common.private, bg: 'bg-rose-950 text-rose-300 border-rose-800' };
    if (val <= 4) return { text: t.common.public, bg: 'bg-slate-800 text-slate-300 border-slate-700' };
    return { text: t.common.common, bg: 'bg-emerald-950 text-emerald-300 border-emerald-700' };
  };

  const handleFinish = () => {
    if (enableTutorialOnStart) {
      try {
        localStorage.removeItem('commonspoly_tutorial_dismissed_v2');
        localStorage.removeItem('commonspoly_tutorial_dont_show_v2');
      } catch {
        // Ignorar
      }
    }
    const setupData: SetupInitialRolls = {
      health: rolls.health,
      urban: rolls.urban,
      knowledge: rolls.knowledge,
      environment: rolls.environment,
      totalSum,
      difficulty,
      speculatorsCount,
      rulesetMode
    };
    onComplete(selectedChars, setupData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-2.5 sm:p-4 pt-safe pb-safe bg-slate-950/90 overflow-y-auto overscroll-contain-y">
      <div className="hud-surface w-full max-w-5xl bg-slate-900 border border-teal-800/80 rounded-2xl shadow-2xl p-4 sm:p-5 md:p-7 text-slate-100 sm:my-auto">
        
        {/* Header con pasos */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-5 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-400 text-sm font-semibold tracking-wider uppercase mb-1">
              <Sparkles className="w-4 h-4" />
              <span>{t.setup.officialPrep}</span>
            </div>
            <h2 className="hud-heading text-2xl md:text-3xl font-extrabold text-white">
              {step === 1 ? t.setup.step1Title : t.setup.step2Title}
            </h2>
          </div>

          <div className="flex items-center gap-2 text-sm font-medium flex-wrap">
            <LanguageSelector variant="compact" />
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${step === 1 ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {t.setup.step1Badge} ({selectedChars.length})
            </span>
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${step === 2 ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              {t.setup.step2Badge}
            </span>
          </div>
        </div>

        {/* CONTENIDO PASO 1 */}
        {step === 1 && (
          <div className="py-5 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-slate-300 text-sm leading-relaxed">
                {t.setup.teamIntro}
              </p>

              {!expandedChar && (
                <button
                  type="button"
                  onClick={() => handleToggleExpand('carolina')}
                  className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-700/50 text-xs font-semibold transition-colors"
                >
                  <Box className="w-3.5 h-3.5" />
                  <span>{t.setup.open3dViewer}</span>
                  <ChevronDown className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* PANEL EXPANDIBLE DE INSPECTOR 3D */}
            {expandedChar && (
              <div className="rounded-2xl bg-slate-950/90 border border-slate-700/80 p-4 md:p-5 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800/80">
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Box className="w-4 h-4 text-teal-400" />
                    <span className="font-semibold text-slate-200">
                      {t.setup.inspectorTitle} {expandedIndex + 1} {t.common.of} {OFFICIAL_CHARACTERS.length}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => cycleExpandedChar(-1)}
                      className="min-w-[44px] min-h-[44px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                      title={t.setup.prevChar}
                      aria-label={t.setup.prevChar}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => cycleExpandedChar(1)}
                      className="min-w-[44px] min-h-[44px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                      title={t.setup.nextChar}
                      aria-label={t.setup.nextChar}
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleToggleExpand(expandedChar.id)}
                      className="ml-1 min-h-[44px] sm:min-h-[34px] inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-medium text-slate-300 hover:text-white transition-colors"
                    >
                      <span>{t.setup.collapse}</span>
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-stretch">
                  {/* Columna izquierda: Avatar 3D interactivo + acciones de equipo */}
                  <div className="md:col-span-5 flex flex-col gap-3">
                    <Avatar3DPreview
                      charId={expandedChar.id}
                      name={expandedChar.name}
                      color={expandedChar.color}
                      accentColor={expandedChar.accentColor}
                      className="h-60 md:h-64 w-full"
                    />

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => toggleCharacter(expandedChar.id)}
                        disabled={Boolean(expandedSelection) && selectedChars.length <= 2}
                        className={`flex-1 min-h-[44px] sm:min-h-[38px] py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors ${
                          expandedSelection
                            ? selectedChars.length <= 2
                              ? 'bg-teal-950/60 text-teal-300/70 border-teal-800/50 cursor-not-allowed'
                              : 'bg-teal-600/25 hover:bg-rose-950/60 text-teal-200 hover:text-rose-200 border-teal-500/50 hover:border-rose-500/50'
                            : 'bg-teal-600 hover:bg-teal-500 text-white border-teal-500'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>
                          {expandedSelection
                            ? selectedChars.length <= 2
                              ? t.setup.minTwo
                              : t.setup.inTeamRemove
                            : t.setup.addToTeam}
                        </span>
                      </button>

                      {expandedSelection && (
                        <button
                          type="button"
                          onClick={() => toggleController(expandedChar.id)}
                          className={`min-h-[44px] sm:min-h-[38px] py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                            expandedSelection.controller === 'HUMAN'
                              ? 'bg-teal-600/30 text-teal-200 border-teal-500/50 hover:bg-teal-600/40'
                              : 'bg-indigo-950/70 text-indigo-200 border-indigo-700/60 hover:bg-indigo-900/70'
                          }`}
                        >
                          {expandedSelection.controller === 'HUMAN' ? (
                            <>
                              <User className="w-3.5 h-3.5" />
                              <span>{t.setup.humanLabel}</span>
                            </>
                          ) : (
                            <>
                              <Bot className="w-3.5 h-3.5" />
                              <span>{t.setup.botAiLabel}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Columna derecha: Biografía, Bonificador Único y Costes de Habilidad */}
                  <div className="md:col-span-7 flex flex-col justify-between gap-4">
                    <div className="space-y-3">
                      <div>
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-4 h-4 rounded-full border border-white/30 shrink-0"
                            style={{ backgroundColor: expandedChar.color }}
                          />
                          <h3 className="text-2xl font-extrabold text-white tracking-tight">
                            {expandedChar.name}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-400 mt-1">
                          <span className="text-teal-300 font-semibold">
                            {expandedChar.hasCitizenship ? t.setup.citizenshipYes : t.setup.citizenshipNo}
                          </span>
                          {' · '}
                          <span>{t.setup.socialClass} {expandedChar.socialClass.toLowerCase()}</span>
                          {' · '}
                          <span>{expandedChar.identityTag}</span>
                        </p>
                      </div>

                      <div className="rounded-xl bg-slate-900/75 border border-slate-800 p-3.5">
                        <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-1">
                          {t.setup.thematicBio}
                        </div>
                        <p className="text-sm text-slate-200 leading-relaxed">
                          «{expandedChar.bio}»
                        </p>
                      </div>

                      {expandedChar.uniqueBonus && (
                        <div
                          className="rounded-xl bg-slate-900/90 border p-3.5 space-y-1.5"
                          style={{ borderColor: `${expandedChar.color}66` }}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Award className="w-4 h-4 text-amber-400 shrink-0" />
                              <span className="text-xs font-extrabold uppercase tracking-wide text-amber-300">
                                {t.setup.uniqueBonus} · {expandedChar.uniqueBonus.title}
                              </span>
                            </div>
                            <span className="text-[11px] font-semibold text-teal-300">
                              {expandedChar.uniqueBonus.shortLabel}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300 leading-relaxed">
                            {expandedChar.uniqueBonus.description}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Habilidades + Coste real en Bienestar */}
                    <div>
                      <div className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-2">
                        {t.setup.skillsAndCost}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                        {[
                          {
                            label: t.common.care,
                            domain: t.common.health,
                            val: expandedChar.skills.care,
                            good: 'HEALTH',
                            boxClass: 'bg-purple-950/60 border-purple-800/50 text-purple-300'
                          },
                          {
                            label: t.common.occupy,
                            domain: t.common.urban,
                            val: expandedChar.skills.occupy,
                            good: 'URBAN',
                            boxClass: 'bg-orange-950/60 border-orange-800/50 text-orange-300'
                          },
                          {
                            label: t.common.share,
                            domain: t.common.knowledge,
                            val: expandedChar.skills.share,
                            good: 'KNOWLEDGE',
                            boxClass: 'bg-yellow-950/60 border-yellow-800/50 text-yellow-300'
                          },
                          {
                            label: t.common.regenerate,
                            domain: t.common.environment,
                            val: expandedChar.skills.regenerate,
                            good: 'ENVIRONMENT',
                            boxClass: 'bg-emerald-950/60 border-emerald-800/50 text-emerald-300'
                          }
                        ].map(item => {
                          const hasBonusDiscount = expandedChar.uniqueBonus?.goodType === item.good;
                          const effectiveBase = Math.max(1, 10 - item.val - (hasBonusDiscount ? 1 : 0));
                          return (
                            <div
                              key={item.label}
                              className={`rounded-xl border p-2.5 ${item.boxClass}`}
                            >
                              <div className="text-lg font-black text-white tabular-nums leading-none">
                                {item.val}
                              </div>
                              <div className="text-[11px] font-bold mt-1">{item.label}</div>
                              <div className="text-[10px] text-slate-400">
                                {item.domain} · {t.setup.costLabel} {effectiveBase}
                                {hasBonusDiscount ? ' (-1)' : ''}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* CUADRÍCULA DE LOS 8 PERSONAJES */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
              {OFFICIAL_CHARACTERS.map(char => {
                const isSelected = selectedChars.some(c => c.baseCharId === char.id);
                const current = selectedChars.find(c => c.baseCharId === char.id);
                const isExpanded = expandedCharId === char.id;

                return (
                  <div
                    key={char.id}
                    className={`relative p-3.5 rounded-xl border transition-all text-left flex flex-col justify-between ${
                      isExpanded
                        ? 'border-teal-400 bg-slate-800 shadow-lg ring-1 ring-teal-400/50'
                        : isSelected
                          ? 'border-teal-600/80 bg-slate-800/85 shadow-md'
                          : 'border-slate-800 bg-slate-900/60 opacity-70 hover:opacity-95 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <button
                          type="button"
                          onClick={() => handleToggleExpand(char.id)}
                          className="flex items-center gap-2 text-left group"
                          title={`Inspeccionar avatar 3D de ${char.name}`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-white/25 shrink-0"
                            style={{ backgroundColor: char.color }}
                          />
                          <h3 className="font-bold text-base text-white group-hover:text-teal-300 transition-colors">
                            {char.name}
                          </h3>
                        </button>

                        <button
                          type="button"
                          onClick={() => toggleCharacter(char.id)}
                          disabled={isSelected && selectedChars.length <= 2}
                          className={`min-w-[44px] min-h-[44px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center rounded text-xs transition-colors ${
                            isSelected ? 'text-teal-400 hover:text-teal-300' : 'text-slate-400 hover:text-white'
                          }`}
                          title={isSelected ? 'Quitar del equipo' : 'Añadir al equipo'}
                          aria-label={isSelected ? `Quitar a ${char.name}` : `Añadir a ${char.name}`}
                        >
                          <CheckCircle2 className={`w-5 h-5 ${isSelected ? 'fill-teal-500/20 text-teal-400' : 'text-slate-400'}`} />
                        </button>
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-2 mb-2 leading-snug">
                        {char.bio}
                      </p>

                      <div className="text-[11px] text-slate-400 border-t border-slate-700/60 pt-2 mb-2">
                        <span className="text-teal-300 font-medium">{char.hasCitizenship ? t.setup.citizenshipYes : t.setup.citizenshipNo}</span> · {char.socialClass}
                      </div>

                      {char.uniqueBonus && (
                        <div className="text-[11px] text-amber-200/90 flex items-start gap-1.5 mb-2.5 leading-snug">
                          <Award className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                          <span>{char.uniqueBonus.shortLabel}</span>
                        </div>
                      )}

                      {/* Habilidades fijas */}
                      <div className="grid grid-cols-4 gap-1 text-center text-[10px] mb-2.5">
                        <div className="bg-purple-950/60 border border-purple-800/40 rounded p-1">
                          <div className="text-purple-300 font-bold">{char.skills.care}</div>
                          <div className="text-slate-400 text-[9px] truncate">{t.common.care}</div>
                        </div>
                        <div className="bg-orange-950/60 border border-orange-800/40 rounded p-1">
                          <div className="text-orange-300 font-bold">{char.skills.occupy}</div>
                          <div className="text-slate-400 text-[9px] truncate">{t.common.occupy}</div>
                        </div>
                        <div className="bg-yellow-950/60 border border-yellow-800/40 rounded p-1">
                          <div className="text-yellow-300 font-bold">{char.skills.share}</div>
                          <div className="text-slate-400 text-[9px] truncate">{t.common.share}</div>
                        </div>
                        <div className="bg-emerald-950/60 border border-emerald-800/40 rounded p-1">
                          <div className="text-emerald-300 font-bold">{char.skills.regenerate}</div>
                          <div className="text-slate-400 text-[9px] truncate">{t.common.regenerate}</div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleExpand(char.id)}
                        className={`w-full min-h-[44px] sm:min-h-[36px] py-1.5 px-2.5 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 border transition-colors ${
                          isExpanded
                            ? 'bg-teal-500/20 text-teal-200 border-teal-400/60'
                            : 'bg-slate-900/80 text-slate-300 border-slate-700/80 hover:border-teal-500/50 hover:text-teal-200'
                        }`}
                      >
                        <Box className="w-3.5 h-3.5" />
                        <span>{isExpanded ? t.setup.hide3d : t.setup.inspect3d}</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {/* Selector de Humano / Bot */}
                      {isSelected && current && (
                        <button
                          type="button"
                          onClick={() => toggleController(char.id)}
                          className={`w-full min-h-[44px] sm:min-h-[36px] py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                            current.controller === 'HUMAN'
                              ? 'bg-teal-600/30 text-teal-300 border border-teal-500/50 hover:bg-teal-600/40'
                              : 'bg-indigo-950/60 text-indigo-300 border border-indigo-700/50 hover:bg-indigo-900/60'
                          }`}
                        >
                          {current.controller === 'HUMAN' ? (
                            <>
                              <User className="w-3.5 h-3.5" />
                              <span>{t.setup.humanLocal}</span>
                            </>
                          ) : (
                            <>
                              <Bot className="w-3.5 h-3.5" />
                              <span>{t.setup.botCoop}</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* CONTENIDO PASO 2 */}
        {step === 2 && (
          <div className="py-6 space-y-6">
            <div className="bg-slate-800/70 border border-slate-700 rounded-xl p-5 text-sm text-slate-300 leading-relaxed">
              <p className="font-semibold text-white mb-2 flex items-center gap-2">
                <Dices className="w-4 h-4 text-teal-400" />
                {t.setup.officialRuleTitle}
              </p>
              {t.setup.officialRuleBody}
            </div>

            {/* Tirada de dados */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Salud */}
              <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/60 text-center space-y-2">
                <div className="text-xs uppercase font-bold text-purple-300 tracking-wider">{t.setup.healthGoods}</div>
                <div className="text-4xl font-extrabold text-white tabular-nums">{rolls.health}</div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStateLabel(rolls.health).bg}`}>
                  {getStateLabel(rolls.health).text}
                </span>
              </div>

              {/* Urbanos */}
              <div className="p-4 rounded-xl bg-orange-950/30 border border-orange-800/60 text-center space-y-2">
                <div className="text-xs uppercase font-bold text-orange-300 tracking-wider">{t.setup.urbanGoods}</div>
                <div className="text-4xl font-extrabold text-white tabular-nums">{rolls.urban}</div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStateLabel(rolls.urban).bg}`}>
                  {getStateLabel(rolls.urban).text}
                </span>
              </div>

              {/* Conocimiento */}
              <div className="p-4 rounded-xl bg-yellow-950/30 border border-yellow-800/60 text-center space-y-2">
                <div className="text-xs uppercase font-bold text-yellow-300 tracking-wider">{t.setup.knowledgeGoods}</div>
                <div className="text-4xl font-extrabold text-white tabular-nums">{rolls.knowledge}</div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStateLabel(rolls.knowledge).bg}`}>
                  {getStateLabel(rolls.knowledge).text}
                </span>
              </div>

              {/* Medioambiente */}
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/60 text-center space-y-2">
                <div className="text-xs uppercase font-bold text-emerald-300 tracking-wider">{t.setup.environmentGoods}</div>
                <div className="text-4xl font-extrabold text-white tabular-nums">{rolls.environment}</div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStateLabel(rolls.environment).bg}`}>
                  {getStateLabel(rolls.environment).text}
                </span>
              </div>
            </div>

            {/* Botón de Tirar Nuevamente */}
            <div className="flex justify-center">
              <button
                onClick={rollInitialDice}
                disabled={isRolling}
                className="min-h-[44px] px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-600/50 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-md active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 ${isRolling ? 'animate-spin' : ''}`} />
                <span>{isRolling ? t.setup.rollingDice : t.setup.rerollDice}</span>
              </button>
            </div>

            {/* Tarjeta de Dificultad Resultante */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center md:text-left">
                <div className="text-xs font-semibold text-slate-400">
                  {t.setup.totalSumScore}: <span className="text-white font-bold text-base">{totalSum} / 24</span>
                </div>
                <div className="text-lg font-extrabold flex items-center justify-center md:justify-start gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  <span>
                    {t.setup.difficultyLabel}: {difficulty === 'MAD_MAX' ? t.setup.diffMadMax : difficulty === 'EN_TRANSICION' ? t.setup.diffTransition : t.setup.diffComunlandia}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {difficulty === 'MAD_MAX' && t.setup.diffDescMadMax}
                  {difficulty === 'EN_TRANSICION' && t.setup.diffDescTransition}
                  {difficulty === 'COMUNLANDIA' && t.setup.diffDescComunlandia}
                </p>
              </div>

              <div className="px-5 py-3 rounded-lg bg-slate-900 border border-slate-700 text-center shrink-0">
                <div className="text-xs text-slate-400">{t.setup.speculatorsTitle}</div>
                <div className="text-2xl font-black text-rose-400 tabular-nums">{speculatorsCount}</div>
              </div>
            </div>

            {/* Selector de Reglamento: Oficial ZEMOS98 vs Digital Expandido */}
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
              <div className="text-xs font-bold uppercase tracking-wider text-teal-300">
                {t.setup.rulesetTitle ?? 'Reglamento de Partida'}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    setRulesetMode('OFFICIAL');
                  }}
                  aria-pressed={rulesetMode === 'OFFICIAL'}
                  className={`p-3.5 rounded-xl border text-left transition-all space-y-1 ${
                    rulesetMode === 'OFFICIAL'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md'
                      : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold">
                      {t.setup.rulesetOfficialLabel ?? 'Edición Verde Oficial (ZEMOS98)'}
                    </span>
                    {rulesetMode === 'OFFICIAL' && (
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {t.setup.rulesetOfficialDesc ??
                      'Reglas estrictas del manual físico: columnas radiales exactas al Ágora, sin crisis, clima dinámico, reputación ni descuentos únicos.'}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    playSound.uiClick();
                    setRulesetMode('EXPANDED');
                  }}
                  aria-pressed={rulesetMode === 'EXPANDED'}
                  className={`min-h-[44px] p-3.5 rounded-xl border text-left transition-all space-y-1 ${
                    rulesetMode === 'EXPANDED'
                      ? 'bg-teal-950/60 border-teal-500 text-white shadow-md'
                      : 'bg-slate-900/70 border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold">
                      {t.setup.rulesetExpandedLabel ?? 'Edición Digital Expandida'}
                    </span>
                    {rulesetMode === 'EXPANDED' && (
                      <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 leading-snug">
                    {t.setup.rulesetExpandedDesc ??
                      'Incluye bonificadores únicos de personaje, Crisis Inesperadas, Clima Dinámico 3D y Reputación Vecinal.'}
                  </p>
                </button>
              </div>
            </div>

            {/* Checkbox para activar tutorial interactivo al iniciar */}
            <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-800/60 flex flex-col gap-3 shadow-md">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-teal-900/60 border border-teal-700/50 text-teal-300 shrink-0">
                    <GraduationCap className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span>{t.setup.voiceTutorialTitle}</span>
                      <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                        {t.setup.recommended}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {t.setup.voiceTutorialDesc}
                    </p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={enableTutorialOnStart}
                    onChange={(e) => setEnableTutorialOnStart(e.target.checked)}
                    className="w-4 h-4 rounded bg-slate-800 border-slate-700 text-teal-600 focus:ring-0 focus:outline-none"
                  />
                </label>
              </div>
            </div>
            {onOpenWeatherSettings && (
              <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <CloudSun className="w-4 h-4 text-sky-400 shrink-0" />
                    <span>{t.setup.weatherCardTitle}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {t.setup.weatherCardDesc}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    playSound.modalOpen();
                    onOpenWeatherSettings();
                  }}
                  className="min-h-[44px] sm:min-h-[38px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sky-300 font-bold text-xs whitespace-nowrap shrink-0 transition-colors"
                >
                  {t.setup.configWeatherBtn}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer con acciones */}
        <div className="flex flex-wrap items-center justify-between pt-5 border-t border-slate-800 gap-3">
          <button
            onClick={() => {
              playSound.uiClick();
              if (step === 2) setStep(1);
              else onCancel();
            }}
            className="min-h-[44px] px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition-colors"
          >
            {step === 2 ? t.setup.backToChars : t.common.cancel}
          </button>

          {step === 1 ? (
            <button
              onClick={() => {
                playSound.uiClick();
                setStep(2);
              }}
              className="min-h-[44px] px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95"
            >
              <span>{t.setup.continueToDiff}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => {
                playSound.unlockCommon();
                handleFinish();
              }}
              className="min-h-[44px] px-7 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-black text-sm flex items-center gap-2 transition-all shadow-xl active:scale-95"
            >
              <Users className="w-4 h-4" />
              <span>{t.setup.startMatchBtn}</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

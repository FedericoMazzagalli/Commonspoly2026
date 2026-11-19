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
  CheckCircle2, 
  RefreshCw,
  Volume2
} from 'lucide-react';
import { OFFICIAL_CHARACTERS } from '../data/characters';
import { SetupInitialRolls, DifficultyLevel } from '../types/game';
import { playSound } from '../utils/audio';

interface SetupWizardProps {
  onComplete: (
    selectedCharacters: { baseCharId: string; controller: 'HUMAN' | 'BOT' }[],
    rolls: SetupInitialRolls
  ) => void;
  onCancel: () => void;
}

export const SetupWizard: React.FC<SetupWizardProps> = ({ onComplete, onCancel }) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [enableTutorialOnStart, setEnableTutorialOnStart] = useState<boolean>(true);

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

  const getStateLabel = (val: number) => {
    if (val <= 2) return { text: 'Privado', bg: 'bg-rose-950 text-rose-300 border-rose-800' };
    if (val <= 4) return { text: 'Público', bg: 'bg-slate-800 text-slate-300 border-slate-700' };
    return { text: 'Común', bg: 'bg-emerald-950 text-emerald-300 border-emerald-700' };
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
      speculatorsCount
    };
    onComplete(selectedChars, setupData);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900 border border-teal-800/80 rounded-2xl shadow-2xl p-6 md:p-8 text-slate-100 my-auto">
        
        {/* Header con pasos */}
        <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-2 text-teal-400 text-sm font-semibold tracking-wider uppercase mb-1">
              <Sparkles className="w-4 h-4" />
              <span>Preparación Oficial · Commonspoly Edición Verde</span>
            </div>
            <h2 className="text-2xl md:text-3xl font-extrabold text-white">
              {step === 1 ? '1. Elige tu Equipo Ciudadano' : '2. Tirada Inicial de Dificultad y Recursos'}
            </h2>
          </div>

          <div className="flex items-center gap-2 text-sm font-medium">
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${step === 1 ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              Paso 1: Personajes ({selectedChars.length})
            </span>
            <ChevronRight className="w-4 h-4 text-slate-600" />
            <span className={`px-3 py-1 rounded-full text-xs font-bold ${step === 2 ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-400'}`}>
              Paso 2: Dificultad
            </span>
          </div>
        </div>

        {/* CONTENIDO PASO 1 */}
        {step === 1 && (
          <div className="py-6 space-y-6">
            <p className="text-slate-300 text-sm leading-relaxed">
              Commonspoly se juega en equipo colaborando entre <strong className="text-teal-400">2 y 8 personajes</strong>. 
              Elige los integrantes y decide si cada uno será controlado por una persona en pantalla o por un Bot Cooperativo.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {OFFICIAL_CHARACTERS.map(char => {
                const isSelected = selectedChars.some(c => c.baseCharId === char.id);
                const current = selectedChars.find(c => c.baseCharId === char.id);

                return (
                  <div
                    key={char.id}
                    className={`relative p-4 rounded-xl border transition-all text-left flex flex-col justify-between ${
                      isSelected
                        ? 'border-teal-500 bg-slate-800/90 shadow-md ring-1 ring-teal-500/50'
                        : 'border-slate-800 bg-slate-900/60 opacity-60 hover:opacity-90'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="w-4 h-4 rounded-full border border-white/20"
                            style={{ backgroundColor: char.color }}
                          />
                          <h3 className="font-bold text-base text-white">{char.name}</h3>
                        </div>

                        <button
                          onClick={() => toggleCharacter(char.id)}
                          className={`p-1 rounded text-xs transition-colors ${
                            isSelected ? 'text-teal-400 hover:text-teal-300' : 'text-slate-500 hover:text-white'
                          }`}
                        >
                          <CheckCircle2 className={`w-5 h-5 ${isSelected ? 'fill-teal-500/20 text-teal-400' : 'text-slate-600'}`} />
                        </button>
                      </div>

                      <p className="text-xs text-slate-400 line-clamp-3 mb-3 leading-snug">
                        {char.bio}
                      </p>

                      <div className="text-[11px] text-slate-400 border-t border-slate-700/60 pt-2 mb-3">
                        <span className="text-teal-300 font-medium">{char.hasCitizenship ? 'Con Ciudadanía' : 'Sin Ciudadanía'}</span> · {char.socialClass}
                      </div>

                      {/* Habilidades fijas */}
                      <div className="grid grid-cols-4 gap-1 text-center text-[10px] mb-3">
                        <div className="bg-purple-950/60 border border-purple-800/40 rounded p-1">
                          <div className="text-purple-300 font-bold">{char.skills.care}</div>
                          <div className="text-slate-400 text-[9px]">Cuidar</div>
                        </div>
                        <div className="bg-orange-950/60 border border-orange-800/40 rounded p-1">
                          <div className="text-orange-300 font-bold">{char.skills.occupy}</div>
                          <div className="text-slate-400 text-[9px]">Ocupar</div>
                        </div>
                        <div className="bg-yellow-950/60 border border-yellow-800/40 rounded p-1">
                          <div className="text-yellow-300 font-bold">{char.skills.share}</div>
                          <div className="text-slate-400 text-[9px]">Compartir</div>
                        </div>
                        <div className="bg-emerald-950/60 border border-emerald-800/40 rounded p-1">
                          <div className="text-emerald-300 font-bold">{char.skills.regenerate}</div>
                          <div className="text-slate-400 text-[9px]">Regenerar</div>
                        </div>
                      </div>
                    </div>

                    {/* Selector de Humano / Bot */}
                    {isSelected && current && (
                      <button
                        onClick={() => toggleController(char.id)}
                        className={`w-full py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                          current.controller === 'HUMAN'
                            ? 'bg-teal-600/30 text-teal-300 border border-teal-500/50 hover:bg-teal-600/40'
                            : 'bg-indigo-950/60 text-indigo-300 border border-indigo-700/50 hover:bg-indigo-900/60'
                        }`}
                      >
                        {current.controller === 'HUMAN' ? (
                          <>
                            <User className="w-3.5 h-3.5" />
                            <span>Humano (Tú / Local)</span>
                          </>
                        ) : (
                          <>
                            <Bot className="w-3.5 h-3.5" />
                            <span>Bot Cooperativo (IA)</span>
                          </>
                        )}
                      </button>
                    )}
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
                Regla Oficial de Preparación: Tirada de Estado Inicial
              </p>
              Tira los 4 dados (uno por cada tipo de bien). El resultado asigna el estado inicial: 
              <span className="font-bold text-rose-300 ml-1">1-2: Privado</span>, 
              <span className="font-bold text-slate-300 ml-1">3-4: Público</span>, 
              <span className="font-bold text-emerald-300 ml-1">5-6: Común</span>. 
              La suma total (4 a 24) determina el Grado de Dificultad y el número de Especuladores al acecho.
            </div>

            {/* Tirada de dados */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {/* Salud */}
              <div className="p-4 rounded-xl bg-purple-950/30 border border-purple-800/60 text-center space-y-2">
                <div className="text-xs uppercase font-bold text-purple-300 tracking-wider">Bienes de Salud</div>
                <div className="text-4xl font-extrabold text-white tabular-nums">{rolls.health}</div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStateLabel(rolls.health).bg}`}>
                  {getStateLabel(rolls.health).text}
                </span>
              </div>

              {/* Urbanos */}
              <div className="p-4 rounded-xl bg-orange-950/30 border border-orange-800/60 text-center space-y-2">
                <div className="text-xs uppercase font-bold text-orange-300 tracking-wider">Bienes Urbanos</div>
                <div className="text-4xl font-extrabold text-white tabular-nums">{rolls.urban}</div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStateLabel(rolls.urban).bg}`}>
                  {getStateLabel(rolls.urban).text}
                </span>
              </div>

              {/* Conocimiento */}
              <div className="p-4 rounded-xl bg-yellow-950/30 border border-yellow-800/60 text-center space-y-2">
                <div className="text-xs uppercase font-bold text-yellow-300 tracking-wider">Conocimiento</div>
                <div className="text-4xl font-extrabold text-white tabular-nums">{rolls.knowledge}</div>
                <span className={`inline-block px-2.5 py-0.5 rounded-full text-xs font-semibold border ${getStateLabel(rolls.knowledge).bg}`}>
                  {getStateLabel(rolls.knowledge).text}
                </span>
              </div>

              {/* Medioambiente */}
              <div className="p-4 rounded-xl bg-emerald-950/30 border border-emerald-800/60 text-center space-y-2">
                <div className="text-xs uppercase font-bold text-emerald-300 tracking-wider">Medioambientales</div>
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
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-teal-300 border border-teal-600/50 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all shadow-md active:scale-95"
              >
                <RefreshCw className={`w-4 h-4 ${isRolling ? 'animate-spin' : ''}`} />
                <span>{isRolling ? 'Lanzando Dados...' : 'Lanzar Dados Nuevamente'}</span>
              </button>
            </div>

            {/* Tarjeta de Dificultad Resultante */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-center md:text-left">
                <div className="text-xs font-semibold text-slate-400">
                  Puntuación Suma Total: <span className="text-white font-bold text-base">{totalSum} / 24</span>
                </div>
                <div className="text-lg font-extrabold flex items-center justify-center md:justify-start gap-2">
                  <ShieldAlert className="w-5 h-5 text-amber-400" />
                  <span>
                    Dificultad: {difficulty === 'MAD_MAX' ? 'Mad Max (4-10)' : difficulty === 'EN_TRANSICION' ? 'En Transición (11-17)' : 'Comunlandia (18-24)'}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {difficulty === 'MAD_MAX' && 'En tu sociedad predominan los Bienes Privados. ¡1 Especulador en juego!'}
                  {difficulty === 'EN_TRANSICION' && 'Sociedad diversa con mezcla de públicos y comunes. ¡2 Especuladores en juego!'}
                  {difficulty === 'COMUNLANDIA' && 'Cerca de la utopía comunitaria, ¡pero 3 Especuladores ferozmente al acecho!'}
                </p>
              </div>

              <div className="px-5 py-3 rounded-lg bg-slate-900 border border-slate-700 text-center shrink-0">
                <div className="text-xs text-slate-400">Especuladores</div>
                <div className="text-2xl font-black text-rose-400 tabular-nums">{speculatorsCount}</div>
              </div>
            </div>

            {/* Checkbox para activar tutorial de onboarding con voz al iniciar */}
            <div className="p-3.5 rounded-xl bg-teal-950/40 border border-teal-800/60 flex items-center justify-between gap-3 shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-teal-900/60 border border-teal-700/50 text-teal-300 shrink-0">
                  <Volume2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Tutorial de Onboarding con Voz Guiada</span>
                    <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30">
                      Recomendado
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Activa la locución por voz interactiva al comenzar para explicar las mecánicas básicas paso a paso.
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
        )}

        {/* Footer con acciones */}
        <div className="flex items-center justify-between pt-6 border-t border-slate-800 gap-4">
          <button
            onClick={() => {
              playSound.uiClick();
              if (step === 2) setStep(1);
              else onCancel();
            }}
            className="px-5 py-2.5 rounded-xl border border-slate-700 text-slate-300 hover:bg-slate-800 text-sm font-semibold transition-colors"
          >
            {step === 2 ? 'Volver a Personajes' : 'Cancelar'}
          </button>

          {step === 1 ? (
            <button
              onClick={() => {
                playSound.uiClick();
                setStep(2);
              }}
              className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-sm flex items-center gap-2 transition-all shadow-lg active:scale-95"
            >
              <span>Continuar a Dificultad</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={() => {
                playSound.unlockCommon();
                handleFinish();
              }}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-black text-sm flex items-center gap-2 transition-all shadow-xl active:scale-95"
            >
              <Users className="w-4 h-4" />
              <span>¡Comenzar Partida!</span>
            </button>
          )}
        </div>

      </div>
    </div>
  );
};

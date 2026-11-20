/**
 * GameOverlayHUD.tsx
 * HUD perimetral ergonómico y dock de control inferior colapsable
 * Diseñado según las directrices de Three.js y Frontend Design:
 * - Sin ocluir el tablero 3D central (pointer-events: none en wrapper)
 * - Dock inferior unificado y colapsable (H / toggle)
 * - Metadatos claros y números tabulares
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { 
  Dices, 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  BookOpen, 
  Flame, 
  Award, 
  Building,
  Volume2,
  VolumeX,
  Trees,
  HelpCircle,
  History,
  Keyboard,
  Trophy,
  HeartHandshake,
  SlidersHorizontal,
  Headphones,
  Vibrate,
  Save,
  Check,
  Home,
  X,
  Radar,
  BarChart3,
  AlertTriangle,
  CloudRain,
  Snowflake,
  Sun,
  Wind,
  ShieldCheck,
  Vote
} from 'lucide-react';
import { GameEngineState, AmbientMode, WeatherMode, TimeOfDayMode } from '../../types/game';
import { BitacoraHUD } from './BitacoraHUD';
import { GameLogComponent } from './GameLogComponent';
import { GlobalResourceTracker } from './GlobalResourceTracker';
import { PlayerTurnIndicator } from './PlayerTurnIndicator';
import { CooperativeChatComponent } from './CooperativeChatComponent';
import { TurnTimerComponent } from './TurnTimerComponent';
import { WeatherControllerHUD } from './WeatherControllerHUD';
import { TutorialOverlay } from './TutorialOverlay';
import { GameChatLog } from './GameChatLog';
import { GameHistorySidebar } from './GameHistorySidebar';
import { SavedGameMetadata, formatSavedTimestamp } from '../../utils/gameStorage';
import { GameToastHUD } from './GameToastHUD';
import { AchievementNotificationHUD } from './AchievementNotificationHUD';
import { CommonsEvolutionHUD } from './CommonsEvolutionHUD';
import { AudioVisualizer } from './AudioVisualizer';
import { WeatherOverlay } from './WeatherOverlay';
import { MeteorologicalInsightHUD } from './MeteorologicalInsightHUD';
import { CollectiveImpactHUD } from './CollectiveImpactHUD';
import { playSound, audioManager } from '../../utils/audio';
import { resolveWeather } from '../../utils/weather';
import { hapticsManager } from '../../utils/haptics';
import { getEffectiveResourceReward, getEffectiveUnlockCost } from '../../utils/crisisEngine';
import { formatWeatherImpactSummary } from '../../utils/weatherEvents';
import {
  computeReferendumTrustSummary,
  formatSignedScore,
  getReputationProfile
} from '../../utils/reputation';

interface GameOverlayHUDProps {
  state: GameEngineState;
  isRulesOpen?: boolean;
  isShortcutsOpen?: boolean;
  isAchievementsOpen?: boolean;
  isGameHistoryOpen?: boolean;
  isEvolutionOpen?: boolean;
  isDockCollapsed?: boolean;
  onRollDice: () => void;
  onUnlockTile: () => void;
  onPassTile: () => void;
  onTurnTimeout?: () => void;
  onTryEnterAgora: () => void;
  onStayInAgora?: () => void;
  onOpenDetentionRescue?: () => void;
  onTriggerNeighborhoodDecision?: () => void;
  onOpenRules: () => void;
  onOpenShortcuts?: () => void;
  onOpenAchievements?: () => void;
  onDismissRecentAchievement?: () => void;
  onToggleGameHistory?: () => void;
  onCloseGameHistory?: () => void;
  onToggleEvolution?: () => void;
  onCloseEvolution?: () => void;
  onToggleDock?: () => void;
  isTutorialOpen?: boolean;
  onToggleTutorial?: () => void;
  onTutorialVisibilityChange?: (visible: boolean) => void;
  onSetCameraMode: (mode: 'ISOMETRIC' | 'TOP_DOWN' | 'FOLLOW') => void;
  onToggleSound: () => void;
  onToggleHaptics?: () => void;
  onTogglePostProcessing?: () => void;
  onSetAmbientMode: (mode: AmbientMode) => void;
  onSetWeatherMode: (mode: WeatherMode) => void;
  onSetWeatherIntensity?: (intensity: number) => void;
  onSetTimeOfDayMode?: (mode: TimeOfDayMode) => void;
  onSendCooperativeChat: (text: string, votingContext?: string) => void;
  savedGameMeta?: SavedGameMetadata | null;
  onSaveGame?: () => void;
  onPauseToTitle?: () => void;
}

export const GameOverlayHUD: React.FC<GameOverlayHUDProps> = ({
  state,
  isRulesOpen = false,
  isShortcutsOpen = false,
  isAchievementsOpen = false,
  isGameHistoryOpen: controlledHistoryOpen,
  isEvolutionOpen: controlledEvolutionOpen,
  isDockCollapsed: controlledDockCollapsed,
  isTutorialOpen: controlledTutorialOpen,
  onToggleTutorial,
  onRollDice,
  onUnlockTile,
  onPassTile,
  onTurnTimeout,
  onTryEnterAgora,
  onStayInAgora,
  onOpenDetentionRescue,
  onTriggerNeighborhoodDecision,
  onOpenRules,
  onOpenShortcuts,
  onOpenAchievements,
  onDismissRecentAchievement,
  onToggleGameHistory,
  onCloseGameHistory,
  onToggleEvolution,
  onCloseEvolution,
  onToggleDock,
  onTutorialVisibilityChange,
  onSetCameraMode,
  onToggleSound,
  onToggleHaptics,
  onTogglePostProcessing,
  onSetAmbientMode,
  onSetWeatherMode,
  onSetWeatherIntensity,
  onSetTimeOfDayMode,
  onSendCooperativeChat,
  savedGameMeta,
  onSaveGame,
  onPauseToTitle
}) => {
  const [internalDockCollapsed, setInternalDockCollapsed] = useState(false);
  const [internalHistoryOpen, setInternalHistoryOpen] = useState(false);
  const [internalEvolutionOpen, setInternalEvolutionOpen] = useState(false);
  const [showTutorial, setShowTutorial] = useState<boolean | undefined>(undefined);
  const [internalTutorialVisible, setInternalTutorialVisible] = useState(false);
  const [isAudioMixerOpen, setIsAudioMixerOpen] = useState(false);
  const [isMeteorologicalInsightOpen, setIsMeteorologicalInsightOpen] = useState(false);
  const [isCollectiveImpactOpen, setIsCollectiveImpactOpen] = useState(false);
  const [spatialEnabled, setSpatialEnabled] = useState(() => audioManager.isSpatialEnabled());
  const [ambientVol, setAmbientVol] = useState(() => audioManager.getAmbientVolume());
  const [sfxVol, setSfxVol] = useState(() => audioManager.getSfxVolume());
  const [justSaved, setJustSaved] = useState(false);
  const [saveLabel, setSaveLabel] = useState<'Guardado' | 'Auto-guardado'>('Guardado');
  const prevAutosaveCountRef = useRef<number>(savedGameMeta?.autosaveCount ?? 0);

  useEffect(() => {
    const nextCount = savedGameMeta?.autosaveCount ?? 0;
    if (nextCount > prevAutosaveCountRef.current) {
      prevAutosaveCountRef.current = nextCount;
      setSaveLabel('Auto-guardado');
      setJustSaved(true);
      const timer = window.setTimeout(() => setJustSaved(false), 1800);
      return () => window.clearTimeout(timer);
    }
    prevAutosaveCountRef.current = nextCount;
  }, [savedGameMeta?.autosaveCount]);

  const isDockCollapsed = controlledDockCollapsed ?? internalDockCollapsed;
  const isGameHistoryOpen = controlledHistoryOpen ?? internalHistoryOpen;
  const isEvolutionOpen = controlledEvolutionOpen ?? internalEvolutionOpen;

  const handleToggleDock = () => {
    playSound.uiToggle(isDockCollapsed);
    if (onToggleDock) {
      onToggleDock();
    } else {
      setInternalDockCollapsed(prev => !prev);
    }
  };

  const handleToggleHistory = () => {
    playSound.uiToggle(!isGameHistoryOpen);
    if (onToggleGameHistory) {
      onToggleGameHistory();
    } else {
      setInternalHistoryOpen(prev => !prev);
    }
  };

  const handleCloseHistory = () => {
    if (onCloseGameHistory) {
      onCloseGameHistory();
    } else {
      setInternalHistoryOpen(false);
    }
  };

  const handleToggleEvolution = () => {
    setIsMeteorologicalInsightOpen(false);
    setIsCollectiveImpactOpen(false);
    if (onToggleEvolution) {
      onToggleEvolution();
    } else {
      setInternalEvolutionOpen(prev => !prev);
    }
  };

  const handleCloseEvolution = () => {
    if (onCloseEvolution) {
      onCloseEvolution();
    } else {
      setInternalEvolutionOpen(false);
    }
  };

  const handleToggleMeteorologicalInsight = () => {
    setIsMeteorologicalInsightOpen(prev => {
      const next = !prev;
      playSound.uiToggle(next);
      if (next) {
        setIsCollectiveImpactOpen(false);
        if (isEvolutionOpen) handleCloseEvolution();
      }
      return next;
    });
  };

  const handleToggleCollectiveImpact = () => {
    setIsCollectiveImpactOpen(prev => {
      const next = !prev;
      playSound.uiToggle(next);
      if (next) {
        setIsMeteorologicalInsightOpen(false);
        if (isEvolutionOpen) handleCloseEvolution();
      }
      return next;
    });
  };

  const activeSoundscape = audioManager.resolveSoundscapeFromState(state);
  const activeWeather = resolveWeather(
    state.tiles,
    state.weatherMode,
    state.weatherIntensity ?? 0.85,
    state.round,
    state.activePlayerIndex,
    state.activeWeatherEvent
  );
  const urbanNatureMix = audioManager.getUrbanNatureMix(
    activeWeather.type,
    activeWeather.intensity,
    activeSoundscape,
    state.weatherMode
  );
  const hapticsSupported = hapticsManager.isSupported();
  const hapticsEnabled = state.hapticsEnabled ?? true;
  const postProcessingEnabled = state.postProcessingEnabled ?? true;

  const achievementsList = state.achievements ?? [];
  const unlockedAchievementsCount = achievementsList.filter(a => a.isUnlocked).length;

  const activePlayer = state.players[state.activePlayerIndex];
  const currentTile = state.tiles.find(t => t.id === activePlayer?.position);
  const detainedTeammate = state.players.find(p => p.isDetained && p.id !== activePlayer?.id);
  const activeRep = getReputationProfile(activePlayer);
  const referendumSummary = state.neighborhoodDecision
    ? computeReferendumTrustSummary(state.neighborhoodDecision, state.players)
    : null;

  // Cálculo de legitimidad colectiva
  const totalLegitimacy = state.players.reduce((sum, p) => sum + p.legitimacy, 0);
  const requiredLegitimacyForAgora = state.players.length * 10;
  const canEnterAgora = totalLegitimacy >= requiredLegitimacyForAgora && !activePlayer?.inAgora;

  // Cálculo de coste y recompensa efectivos (incluye Crisis Inesperada, Clima Dinámico y bonificador único)
  const unlockCostInfo = getEffectiveUnlockCost(
    currentTile,
    activePlayer,
    state.activeCrisis,
    state.activeWeatherEvent
  );
  const neededWellnessToUnlock = unlockCostInfo.effectiveCost;
  const publicPassReward = getEffectiveResourceReward(
    currentTile,
    1,
    1,
    state.activeCrisis,
    activePlayer,
    state.activeWeatherEvent
  );
  const canUnlockCurrentTile =
    currentTile &&
    (currentTile.category === 'RESOURCE' || currentTile.category === 'AGORA_ENTRY') &&
    (currentTile.state === 'PRIVATE' || currentTile.state === 'PUBLIC') &&
    activePlayer &&
    activePlayer.wellness >= neededWellnessToUnlock &&
    state.phase === 'TILE_ACTION_DECISION';

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 md:p-6 select-none z-10 overflow-hidden">
      
      {/* TOP PERIMETER CLUSTER: Status Bar + Players Strip (Top-Left) + GlobalResourceTracker (Top-Right) */}
      <div className="w-full flex flex-col gap-2.5">
        {/* 1. TOP STATUS BAR */}
        <div className="w-full flex items-center justify-between gap-3 pointer-events-auto">
          
          {/* Brand & Round Tracker */}
          <div className="flex items-center gap-3 bg-slate-900/90 border border-teal-800/80 px-4 py-2 rounded-2xl shadow-xl">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-teal-400" />
              <h1 className="text-sm font-black tracking-tight text-white uppercase hidden sm:block">
                Commonspoly
              </h1>
            </div>
            <span className="text-slate-600 hidden sm:inline" aria-hidden="true">·</span>
            <div className="text-xs font-bold text-teal-300">
              Ronda <span className="text-white text-sm tabular-nums">{state.round}</span> / 20
            </div>
            <span className="text-slate-600" aria-hidden="true">·</span>
            {/* Legitimidad colectiva */}
            <div className="text-xs text-slate-300 flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden md:inline">Legitimidad Colectiva:</span>
              <span className={`font-bold tabular-nums ${totalLegitimacy >= requiredLegitimacyForAgora ? 'text-emerald-400' : 'text-amber-300'}`}>
                {totalLegitimacy} / {requiredLegitimacyForAgora}
              </span>
            </div>
          </div>

          {/* Right Utility Actions */}
          <div className="flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-1.5 rounded-2xl shadow-xl">
            {/* Camera switcher */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl text-xs">
              <button
                onClick={() => onSetCameraMode('ISOMETRIC')}
                className={`px-2 py-1 rounded-lg font-medium transition-colors ${
                  state.cameraMode === 'ISOMETRIC' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Vista Isométrica de Mesa (Atajo: 1)"
              >
                Isométrica
              </button>
              <button
                onClick={() => onSetCameraMode('TOP_DOWN')}
                className={`px-2 py-1 rounded-lg font-medium transition-colors ${
                  state.cameraMode === 'TOP_DOWN' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Vista Cenital Táctica (Atajo: 2)"
              >
                Cenital
              </button>
              <button
                onClick={() => onSetCameraMode('FOLLOW')}
                className={`px-2 py-1 rounded-lg font-medium transition-colors ${
                  state.cameraMode === 'FOLLOW' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title="Seguir al Personaje Activo (Atajo: 3)"
              >
                Seguimiento
              </button>
            </div>

            {/* Ambient Soundscape Switcher & Mute */}
            <div className="hidden lg:flex items-center gap-1 bg-slate-950 p-1 rounded-xl text-[11px]">
              <button
                onClick={() => onSetAmbientMode('AUTO')}
                className={`px-2 py-1 rounded-lg font-medium transition-colors whitespace-nowrap shrink-0 ${
                  state.ambientMode === 'AUTO' ? 'bg-teal-700 text-white' : 'text-slate-400 hover:text-white'
                }`}
                title={`Ambiente automático según tablero (Actual: ${activeSoundscape === 'NATURE' ? 'Naturaleza' : activeSoundscape === 'AGORA' ? 'Ágora' : 'Urbano'})`}
              >
                Auto ({activeSoundscape === 'NATURE' ? 'Natura' : activeSoundscape === 'AGORA' ? 'Ágora' : 'Urbano'})
              </button>
              <button
                onClick={() => onSetAmbientMode('NATURE')}
                className={`p-1 rounded-lg transition-colors ${
                  state.ambientMode === 'NATURE' ? 'bg-emerald-700 text-white' : 'text-slate-400 hover:text-emerald-300'
                }`}
                title="Sonido ambiental de Naturaleza"
              >
                <Trees className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onSetAmbientMode('URBAN')}
                className={`p-1 rounded-lg transition-colors ${
                  state.ambientMode === 'URBAN' ? 'bg-orange-700 text-white' : 'text-slate-400 hover:text-orange-300'
                }`}
                title="Sonido ambiental de Entorno Urbano"
              >
                <Building className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative flex items-center gap-1.5">
              <AudioVisualizer
                soundEnabled={state.soundEnabled}
                soundscape={activeSoundscape}
                weatherType={activeWeather.type}
                className="hidden sm:inline-flex"
              />

              <button
                onClick={onToggleSound}
                className={`p-2 rounded-xl transition-colors ${
                  state.soundEnabled
                    ? 'text-teal-300 hover:text-white hover:bg-slate-800'
                    : 'text-rose-400 bg-rose-950/40 hover:bg-rose-950/60'
                }`}
                title={state.soundEnabled ? 'Silenciar audio (Atajo: M)' : 'Activar audio (Atajo: M)'}
                aria-label={state.soundEnabled ? 'Silenciar audio' : 'Activar audio'}
              >
                {state.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={() => {
                  audioManager.unlock();
                  playSound.uiToggle(!isAudioMixerOpen);
                  setIsAudioMixerOpen(prev => !prev);
                }}
                className={`p-2 rounded-xl transition-colors ${
                  isAudioMixerOpen
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Mezclador de Audio Espacial 3D y Clima"
                aria-label="Abrir mezclador de audio espacial 3D y clima"
                aria-expanded={isAudioMixerOpen}
              >
                <SlidersHorizontal className="w-4 h-4" />
              </button>

              {isAudioMixerOpen && (
                <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900/95 border border-slate-700/90 rounded-2xl shadow-2xl p-3.5 z-40 text-slate-100 space-y-3">
                  <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-800">
                    <div className="flex items-center gap-2">
                      <Headphones className="w-4 h-4 text-teal-400 shrink-0" />
                      <span className="text-xs font-bold text-white tracking-wide">
                        Audio Espacial 3D y Clima
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsAudioMixerOpen(false)}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                      aria-label="Cerrar mezclador de audio"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between gap-2 tabular-nums">
                    <span className="truncate">
                      Clima: <strong className="text-slate-200">{activeWeather.label}</strong>
                    </span>
                    <span className="text-slate-600" aria-hidden="true">·</span>
                    <span className="shrink-0">
                      {Math.round(activeWeather.intensity * 100)}%
                    </span>
                  </div>

                  <div className="text-[11px] text-slate-400 flex items-center justify-between gap-2">
                    <span>Entorno base:</span>
                    <span className="font-semibold text-teal-300">
                      {activeSoundscape === 'NATURE' ? 'Naturaleza' : activeSoundscape === 'AGORA' ? 'Ágora' : 'Urbano'}
                    </span>
                  </div>

                  <AudioVisualizer
                    soundEnabled={state.soundEnabled}
                    soundscape={activeSoundscape}
                    weatherType={activeWeather.type}
                    className="w-full"
                    canvasClassName="w-full h-7"
                  />

                  {/* Mezcla dinámica Naturaleza Urbana según weatherMode */}
                  <div className="rounded-xl bg-slate-950/80 border border-slate-800/80 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span className="font-semibold text-slate-200">Naturaleza Urbana</span>
                      <span className="tabular-nums text-teal-300">{activeWeather.label}</span>
                    </div>
                    {[
                      { label: 'Pájaros en parques', value: urbanNatureMix.birdsLevel, color: 'bg-emerald-400' },
                      { label: 'Brisa', value: urbanNatureMix.breezeLevel, color: 'bg-teal-400' },
                      { label: 'Tráfico lejano', value: urbanNatureMix.trafficLevel, color: 'bg-amber-400' }
                    ].map(stem => (
                      <div key={stem.label} className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] text-slate-400 tabular-nums">
                          <span>{stem.label}</span>
                          <span className="text-slate-300 font-medium">{Math.round(stem.value * 100)}%</span>
                        </div>
                        <div className="h-1 w-full rounded-full bg-slate-800 overflow-hidden">
                          <motion.div
                            animate={{ scaleX: stem.value }}
                            transition={{ duration: 0.4, ease: 'easeOut' }}
                            className={`h-full w-full origin-left rounded-full ${stem.color}`}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      audioManager.unlock();
                      const next = !spatialEnabled;
                      setSpatialEnabled(next);
                      audioManager.setSpatialEnabled(next);
                      playSound.uiToggle(next);
                    }}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border transition-colors whitespace-nowrap ${
                      spatialEnabled
                        ? 'bg-teal-950/60 border-teal-600/70 text-teal-200'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>Panoramización 3D (HRTF)</span>
                    <span className="font-bold">
                      {spatialEnabled ? 'Activado' : 'Estéreo 2D'}
                    </span>
                  </button>

                  <label className="block space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-300 tabular-nums">
                      <span>Volumen Clima / Ambiente</span>
                      <span className="font-semibold text-teal-300">{Math.round(ambientVol * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={ambientVol}
                      onChange={(e) => {
                        audioManager.unlock();
                        const val = parseFloat(e.target.value);
                        setAmbientVol(val);
                        audioManager.setAmbientVolume(val);
                      }}
                      className="w-full accent-teal-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </label>

                  <label className="block space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-300 tabular-nums">
                      <span>Volumen Efectos 3D</span>
                      <span className="font-semibold text-teal-300">{Math.round(sfxVol * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={sfxVol}
                      onChange={(e) => {
                        audioManager.unlock();
                        const val = parseFloat(e.target.value);
                        setSfxVol(val);
                        audioManager.setSfxVolume(val);
                      }}
                      className="w-full accent-teal-400 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                    />
                  </label>

                  {onToggleHaptics && (
                    <div className="pt-2 border-t border-slate-800 space-y-1.5">
                      <button
                        type="button"
                        onClick={onToggleHaptics}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border transition-colors whitespace-nowrap ${
                          hapticsEnabled
                            ? 'bg-teal-950/60 border-teal-600/70 text-teal-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Vibrate className="w-3.5 h-3.5 shrink-0" />
                          <span>Vibración háptica</span>
                        </span>
                        <span className="font-bold">
                          {hapticsEnabled ? 'Activada' : 'Desactivada'}
                        </span>
                      </button>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        <span>Dispositivo:</span>
                        <span aria-hidden="true">·</span>
                        <span className={hapticsSupported ? 'text-emerald-400' : 'text-slate-500'}>
                          {hapticsSupported ? 'Compatible (navigator.vibrate)' : 'Sin motor de vibración'}
                        </span>
                      </div>
                    </div>
                  )}

                  {onTogglePostProcessing && (
                    <div className="pt-2 border-t border-slate-800 space-y-1.5">
                      <button
                        type="button"
                        onClick={onTogglePostProcessing}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between gap-2 border transition-colors whitespace-nowrap ${
                          postProcessingEnabled
                            ? 'bg-teal-950/60 border-teal-600/70 text-teal-200'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        <span className="flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 shrink-0" />
                          <span>Post-procesado 3D</span>
                        </span>
                        <span className="font-bold">
                          {postProcessingEnabled ? 'Cinemático' : 'Estándar'}
                        </span>
                      </button>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
                        <span>Efectos:</span>
                        <span aria-hidden="true">·</span>
                        <span className="text-slate-300">Bloom + Color Cinematográfico</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={handleToggleCollectiveImpact}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                isCollectiveImpactOpen
                  ? 'bg-emerald-600 text-white font-bold'
                  : 'text-emerald-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Collective Impact: Eficiencia del equipo preservando comunes frente a especuladores"
              aria-label="Abrir Collective Impact"
              aria-expanded={isCollectiveImpactOpen}
            >
              <BarChart3 className="w-4 h-4 shrink-0" />
              <span className="hidden xl:inline">Collective Impact</span>
            </button>

            <button
              type="button"
              onClick={handleToggleMeteorologicalInsight}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                isMeteorologicalInsightOpen
                  ? 'bg-cyan-600 text-white font-bold'
                  : 'text-cyan-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Meteorological Insight: Análisis estratégico del clima y recursos"
              aria-label="Abrir Meteorological Insight"
              aria-expanded={isMeteorologicalInsightOpen}
            >
              <Radar className="w-4 h-4 shrink-0" />
              <span className="hidden xl:inline">Meteorological Insight</span>
            </button>

            <button
              onClick={() => {
                playSound.uiToggle(true);
                if (onToggleTutorial) {
                  onToggleTutorial();
                } else {
                  setShowTutorial(prev => !prev);
                }
              }}
              className="px-2.5 py-1.5 rounded-xl text-teal-300 hover:text-white hover:bg-slate-800 transition-colors flex items-center gap-1.5 text-xs font-semibold"
              title="Tutorial Interactivo de Onboarding con Voz (Atajo: T)"
              aria-label="Abrir tutorial interactivo de onboarding con narrador de voz"
            >
              <HelpCircle className="w-4 h-4 text-teal-400 shrink-0" />
              <span className="hidden lg:inline">Tutorial con Voz</span>
              <kbd className="hidden xl:inline-block px-1 py-0.2 rounded bg-slate-800 text-[10px] font-mono text-slate-400 border border-slate-700">
                T
              </kbd>
            </button>

            <button
              type="button"
              onClick={handleToggleHistory}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                isGameHistoryOpen
                  ? 'bg-teal-600 text-white font-bold'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800'
              }`}
              title="Abrir Chat y Narrativa de Sesión (Atajo: G)"
              aria-label="Abrir Chat y Narrativa de Sesión"
              aria-expanded={isGameHistoryOpen}
            >
              <History className="w-4 h-4 shrink-0 text-teal-400" />
              <span className="hidden xl:inline">Chat y Narrativa</span>
              <span className="text-[11px] opacity-80 tabular-nums">({state.logs.length + state.chatMessages.length})</span>
            </button>

            {onOpenAchievements && (
              <button
                type="button"
                onClick={() => {
                  playSound.modalOpen();
                  onOpenAchievements();
                }}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors ${
                  isAchievementsOpen
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'text-amber-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Logros Locales (Atajo: L)"
                aria-label="Abrir Logros Locales"
                aria-expanded={isAchievementsOpen}
              >
                <Trophy className="w-4 h-4 shrink-0" />
                <span className="hidden xl:inline">Logros</span>
                <span className="text-[11px] opacity-90 tabular-nums">
                  ({unlockedAchievementsCount}/{achievementsList.length})
                </span>
              </button>
            )}

            {onOpenShortcuts && (
              <button
                type="button"
                onClick={() => {
                  playSound.modalOpen();
                  onOpenShortcuts();
                }}
                className={`p-2 rounded-xl transition-colors ${
                  isShortcutsOpen
                    ? 'bg-teal-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title="Atajos de Teclado (Atajo: ?)"
                aria-label="Abrir guía de atajos de teclado"
                aria-expanded={isShortcutsOpen}
              >
                <Keyboard className="w-4 h-4" />
              </button>
            )}

            <button
              onClick={() => {
                playSound.modalOpen();
                onOpenRules();
              }}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              title="Manual de Reglas (Atajo: B)"
              aria-label="Abrir Manual de Reglas"
            >
              <BookOpen className="w-4 h-4" />
            </button>

            {onSaveGame && (
              <button
                type="button"
                onClick={() => {
                  onSaveGame();
                  setSaveLabel('Guardado');
                  setJustSaved(true);
                  window.setTimeout(() => setJustSaved(false), 1800);
                }}
                className={`px-2 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1 whitespace-nowrap shrink-0 transition-colors ${
                  justSaved
                    ? 'bg-emerald-600/25 text-emerald-300'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
                title={
                  savedGameMeta
                    ? `Auto-guardado por fin de turno · Ronda ${savedGameMeta.round}${
                        savedGameMeta.lastEndedTurnBy ? ` (${savedGameMeta.lastEndedTurnBy})` : ''
                      } · ${formatSavedTimestamp(savedGameMeta.savedAt)}`
                    : 'Guardar partida manualmente en LocalStorage'
                }
                aria-label="Guardar partida manualmente"
              >
                {justSaved ? (
                  <>
                    <Check className="w-4 h-4 shrink-0" />
                    <span className="hidden xl:inline">{saveLabel}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4 shrink-0" />
                    <span className="hidden xl:inline">Guardar</span>
                  </>
                )}
              </button>
            )}

            {onPauseToTitle && (
              <button
                type="button"
                onClick={onPauseToTitle}
                className="p-2 rounded-xl text-slate-300 hover:text-amber-300 hover:bg-slate-800 transition-colors shrink-0"
                title="Guardar y volver al título"
                aria-label="Guardar y volver al título"
              >
                <Home className="w-4 h-4" />
              </button>
            )}
          </div>

        </div>

        {/* 2. SUB-ROW: PlayerTurnIndicator (Top-Left) & GlobalResourceTracker (Top-Right) */}
        <div className="w-full flex flex-col md:flex-row items-start justify-between gap-2.5">
          <div className="max-w-full md:max-w-[calc(100%-21rem)] flex flex-col gap-2">
            <PlayerTurnIndicator
              players={state.players}
              activePlayerIndex={state.activePlayerIndex}
              phase={state.phase}
              currentDiceRoll={state.currentDiceRoll}
            />
            {/* REGISTRO DE CHAT Y ACCIONES: Últimos 5 mensajes e historial de bots y jugadores */}
            <GameChatLog state={state} />

            {/* BANNER DE CRISIS INESPERADA ACTIVA */}
            {state.activeCrisis && (
              <div
                role="status"
                aria-label="Crisis inesperada activa"
                className={`pointer-events-auto max-w-md rounded-xl border px-3 py-2 shadow-lg text-xs flex items-start gap-2.5 ${
                  state.activeCrisis.severity === 'OPPORTUNITY'
                    ? 'bg-emerald-950/90 border-emerald-600/70 text-emerald-100'
                    : state.activeCrisis.severity === 'WARNING'
                    ? 'bg-amber-950/90 border-amber-600/70 text-amber-100'
                    : 'bg-rose-950/90 border-rose-600/70 text-rose-100'
                }`}
              >
                <AlertTriangle
                  className={`w-4 h-4 shrink-0 mt-0.5 ${
                    state.activeCrisis.severity === 'OPPORTUNITY'
                      ? 'text-emerald-400'
                      : state.activeCrisis.severity === 'WARNING'
                      ? 'text-amber-400'
                      : 'text-rose-400'
                  }`}
                />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold truncate">{state.activeCrisis.title}</span>
                    <span className="px-1.5 py-0.5 rounded bg-slate-950/70 text-[10px] font-bold tabular-nums shrink-0">
                      {state.activeCrisis.turnsRemaining}{' '}
                      {state.activeCrisis.turnsRemaining === 1 ? 'turno' : 'turnos'}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90 leading-snug">
                    {state.activeCrisis.description}
                  </p>
                </div>
              </div>
            )}

            {/* ALERTA DE EVENTO METEOROLÓGICO DINÁMICO ACTIVO */}
            {state.activeWeatherEvent && (
              <div
                role="status"
                aria-label="Alerta meteorológica dinámica activa"
                className={`pointer-events-auto max-w-md rounded-xl border px-3 py-2 shadow-lg text-xs flex items-start gap-2.5 ${
                  state.activeWeatherEvent.severity === 'BENEFICIAL'
                    ? 'bg-emerald-950/90 border-emerald-500/70 text-emerald-100'
                    : state.activeWeatherEvent.severity === 'WARNING'
                    ? 'bg-cyan-950/90 border-cyan-500/70 text-cyan-100'
                    : 'bg-orange-950/90 border-orange-500/70 text-orange-100'
                }`}
              >
                {state.activeWeatherEvent.weatherType === 'RAIN' ? (
                  <CloudRain className="w-4 h-4 text-cyan-300 shrink-0 mt-0.5" />
                ) : state.activeWeatherEvent.weatherType === 'SNOW' ? (
                  <Snowflake className="w-4 h-4 text-sky-200 shrink-0 mt-0.5" />
                ) : state.activeWeatherEvent.weatherType === 'SUNNY' ? (
                  <Sun className="w-4 h-4 text-amber-300 shrink-0 mt-0.5" />
                ) : state.activeWeatherEvent.weatherType === 'DROUGHT' ? (
                  <Flame className="w-4 h-4 text-orange-300 shrink-0 mt-0.5" />
                ) : (
                  <Wind className="w-4 h-4 text-emerald-300 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold truncate">
                      {state.activeWeatherEvent.title} · {formatWeatherImpactSummary(state.activeWeatherEvent)}
                    </span>
                    <span className="text-[10px] font-bold tabular-nums shrink-0 opacity-90">
                      {state.activeWeatherEvent.turnsRemaining}{' '}
                      {state.activeWeatherEvent.turnsRemaining === 1 ? 'turno' : 'turnos'}
                    </span>
                  </div>
                  <p className="text-[11px] opacity-90 leading-snug">
                    Casillas afectadas: {state.activeWeatherEvent.affectedTileNames.join(', ')}.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Top-Right Cluster: Weather Controller & Global Resource Tracker */}
          <div className="self-end md:self-start shrink-0 flex flex-col sm:flex-row items-end sm:items-start gap-2">
            <WeatherControllerHUD
              state={state}
              onSetWeatherMode={onSetWeatherMode}
              onSetWeatherIntensity={onSetWeatherIntensity}
              onSetTimeOfDayMode={onSetTimeOfDayMode}
              isMeteorologicalInsightOpen={isMeteorologicalInsightOpen}
              onToggleMeteorologicalInsight={handleToggleMeteorologicalInsight}
            />
            <GlobalResourceTracker
              state={state}
              isEvolutionOpen={isEvolutionOpen}
              onToggleEvolution={handleToggleEvolution}
              isCollectiveImpactOpen={isCollectiveImpactOpen}
              onToggleCollectiveImpact={handleToggleCollectiveImpact}
            />
          </div>
        </div>
      </div>

      {/* 3. BITÁCORA DE JUEGO (Superposición sutil y narrativa colaborativa) */}
      <BitacoraHUD logs={state.logs} round={state.round} />

      {/* 3A. NOTIFICACIÓN DE LOGRO LOCAL DESBLOQUEADO EN LA PARTE SUPERIOR DEL HUD */}
      <AchievementNotificationHUD
        achievement={state.recentAchievement}
        onDismiss={() => onDismissRecentAchievement?.()}
        onOpenAchievements={onOpenAchievements}
      />

      {/* 3B. SISTEMA DE NOTIFICACIONES TOAST NO INTRUSIVO */}
      <GameToastHUD
        state={state}
        topOffsetClass={state.recentAchievement ? 'top-36' : 'top-16'}
        onOpenHistory={() => {
          if (!isGameHistoryOpen) {
            handleToggleHistory();
          }
        }}
      />

      {/* 4. CHAT RÁPIDO COOPERATIVO INFERIOR DERECHO */}
      <CooperativeChatComponent
        state={state}
        onSendMessage={onSendCooperativeChat}
        isDockCollapsed={isDockCollapsed}
      />

      {/* 5. HISTORIAL COLABORATIVO INFERIOR IZQUIERDO (GameLogComponent con auto-scroll) */}
      <GameLogComponent state={state} isDockCollapsed={isDockCollapsed} />

      {/* 5B. GAME HISTORY SIDEBAR (Registro cronológico completo de toda la partida) */}
      <GameHistorySidebar
        isOpen={isGameHistoryOpen}
        onClose={handleCloseHistory}
        logs={state.logs}
        chatMessages={state.chatMessages}
        round={state.round}
        players={state.players}
        achievements={state.achievements}
        gameResult={state.gameResult}
        gameResultDetails={state.gameResultDetails}
        disableEscapeKey={Boolean(onCloseGameHistory)}
      />

      {/* 5C. DATA VISUALIZATION D3 EN VIVO (Evolución histórica turno a turno) */}
      <CommonsEvolutionHUD
        isOpen={isEvolutionOpen}
        turnHistory={state.turnHistory ?? []}
        onClose={handleCloseEvolution}
      />

      {/* 5D. METEOROLOGICAL INSIGHT (Análisis estratégico con pronóstico y registros) */}
      <MeteorologicalInsightHUD
        isOpen={isMeteorologicalInsightOpen}
        state={state}
        onClose={() => setIsMeteorologicalInsightOpen(false)}
      />

      {/* 5E. COLLECTIVE IMPACT (Dashboard Recharts en tiempo real vs especuladores) */}
      <CollectiveImpactHUD
        isOpen={isCollectiveImpactOpen}
        state={state}
        onClose={() => setIsCollectiveImpactOpen(false)}
      />

      {/* 4. UNIFIED BOTTOM CONTROL DOCK (Centered, collapsible, zero occlusion) */}
      <div className="w-full flex flex-col items-center pointer-events-auto">
        
        {/* Turn Timer + Collapse toggle strip */}
        <div className="mb-1.5 flex items-center gap-2.5 flex-wrap justify-center">
          <TurnTimerComponent
            activePlayer={activePlayer}
            activePlayerIndex={state.activePlayerIndex}
            round={state.round}
            phase={state.phase}
            isPausedByOverlay={
              Boolean(state.activeModal) ||
              isRulesOpen ||
              isShortcutsOpen ||
              isAchievementsOpen ||
              Boolean(showTutorial) ||
              internalTutorialVisible
            }
            durationSeconds={60}
            onTimeout={() => {
              if (onTurnTimeout) {
                onTurnTimeout();
              } else {
                onPassTile();
              }
            }}
          />

          <button
            onClick={handleToggleDock}
            className="px-4 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800 text-[11px] font-semibold text-slate-400 hover:text-white flex items-center gap-1 transition-colors shadow-lg"
            title="Mostrar / ocultar controles (Atajo: H)"
          >
            {isDockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Mostrar Controles</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Ocultar Controles</span>
              </>
            )}
          </button>
        </div>

        {!isDockCollapsed && (
          <div className="w-full max-w-4xl bg-slate-900/95 border border-teal-800/80 rounded-2xl shadow-2xl p-4 md:p-5 text-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
            
            {/* Active Turn Persona & Current Tile Info */}
            <div className="flex items-center gap-3.5">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white font-black text-lg shadow-md shrink-0"
                style={{ backgroundColor: activePlayer?.color || '#0d9488' }}
              >
                {activePlayer?.name.charAt(0)}
              </div>

              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-white">
                    Turno de {activePlayer?.name}
                  </h3>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-teal-300 border border-slate-700">
                    {activePlayer?.controller === 'HUMAN' ? 'Jugador Local' : 'Bot Cooperativo'}
                  </span>
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-2">
                  <span>Casilla: <strong className="text-slate-200">{currentTile?.name || 'Iniciando'}</strong></span>
                  {currentTile?.state && (
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      currentTile.state === 'COMMON' ? 'bg-emerald-950 text-emerald-300' :
                      currentTile.state === 'PUBLIC' ? 'bg-slate-800 text-slate-300' : 'bg-rose-950 text-rose-300'
                    }`}>
                      {currentTile.state === 'COMMON' ? 'Común' : currentTile.state === 'PUBLIC' ? 'Público' : 'Privado'}
                    </span>
                  )}
                </div>

                <div className="text-[11px] text-slate-400 flex items-center flex-wrap gap-x-2.5 gap-y-0.5 pt-0.5 tabular-nums">
                  <span className="text-rose-400 font-medium">Bienestar: {activePlayer?.wellness}</span>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span className="text-amber-400 font-medium">Legitimidad: {activePlayer?.legitimacy}</span>
                  <span className="text-slate-600" aria-hidden="true">·</span>
                  <span
                    className={`font-semibold inline-flex items-center gap-1 ${
                      activeRep.tone === 'POSITIVE'
                        ? 'text-emerald-300'
                        : activeRep.tone === 'NEGATIVE'
                        ? 'text-rose-300'
                        : 'text-slate-300'
                    }`}
                    title={activeRep.shortDesc}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Rep. Vecinal: {activeRep.label} ({formatSignedScore(activeRep.score)}) · Voto {activeRep.voteWeight}x
                    </span>
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons Zone */}
            <div className="flex items-center gap-2.5 flex-wrap justify-end">
              
              {/* Botón Tirar Dado (cuando está listo) */}
              {state.phase === 'PLAYER_TURN_READY' && (
                <>
                  {activePlayer?.inAgora && activePlayer.roundsInAgora < 3 && activePlayer.wellness > 1 && onStayInAgora && (
                    <button
                      type="button"
                      onClick={onStayInAgora}
                      title="Permanecer en el Ágora esperando refuerzos (-1 Bienestar)"
                      className="px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all whitespace-nowrap shrink-0"
                    >
                      <Flame className="w-4 h-4" />
                      <span>Esperar en Ágora (-1 Bienestar · {activePlayer.roundsInAgora}/3)</span>
                    </button>
                  )}

                  <button
                    onClick={onRollDice}
                    title="Lanzar dado 3D (Atajo: R o Espacio)"
                    className="px-6 py-3 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg active:scale-95 transition-all whitespace-nowrap shrink-0"
                  >
                    <Dices className="w-5 h-5" />
                    <span>{activePlayer?.inAgora ? 'Salir del Ágora (Dado)' : 'Tirar Dado 3D'}</span>
                    {activePlayer?.controller === 'HUMAN' && (
                      <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-950/20 border border-slate-950/30 text-[10px] font-mono font-bold text-slate-950">
                        R
                      </kbd>
                    )}
                  </button>
                </>
              )}

              {/* Botón Rescate Solidario si hay una compañera detenida */}
              {detainedTeammate && activePlayer?.controller === 'HUMAN' && state.phase === 'PLAYER_TURN_READY' && onOpenDetentionRescue && (
                <button
                  type="button"
                  onClick={onOpenDetentionRescue}
                  className="px-4 py-2.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-md transition-colors whitespace-nowrap shrink-0"
                  title={`Rescatar a ${detainedTeammate.name} del Centro de Detención`}
                >
                  <HeartHandshake className="w-4 h-4" />
                  <span>Rescatar a {detainedTeammate.name}</span>
                </button>
              )}

              {/* Botón Desbloquear Bien (10 pts ± crisis) */}
              {state.phase === 'TILE_ACTION_DECISION' && canUnlockCurrentTile && (
                <button
                  onClick={onUnlockTile}
                  title="Desbloquear / Comunizar bien actual (Atajo: D)"
                  className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-md active:scale-95 transition-all"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    Desbloquear a {currentTile?.state === 'PRIVATE' ? 'Público' : 'Común'} 
                    <span className="text-[10px] opacity-80 ml-1 tabular-nums">
                      (-{neededWellnessToUnlock} Bienestar
                      {unlockCostInfo.crisisDelta !== 0
                        ? ` · Crisis ${unlockCostInfo.crisisDelta > 0 ? `+${unlockCostInfo.crisisDelta}` : unlockCostInfo.crisisDelta}`
                        : ''}
                      {unlockCostInfo.weatherDelta !== 0
                        ? ` · Clima ${unlockCostInfo.weatherDelta > 0 ? `+${unlockCostInfo.weatherDelta}` : unlockCostInfo.weatherDelta}`
                        : ''}
                      {unlockCostInfo.reputationDelta !== 0
                        ? ` · Rep. ${unlockCostInfo.reputationDelta > 0 ? `+${unlockCostInfo.reputationDelta}` : unlockCostInfo.reputationDelta}`
                        : ''})
                    </span>
                  </span>
                  {activePlayer?.controller === 'HUMAN' && (
                    <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-950/20 border border-slate-950/30 text-[10px] font-mono font-bold text-slate-950">
                      D
                    </kbd>
                  )}
                </button>
              )}

              {/* Botón Pasar / Ganar puntos */}
              {state.phase === 'TILE_ACTION_DECISION' && (
                <button
                  onClick={onPassTile}
                  title="Pasar turno (Atajo: P)"
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-2 transition-colors"
                >
                  <span>
                    {currentTile?.state === 'PUBLIC'
                      ? `Pasar (+${publicPassReward.wellness} Bienestar / +${publicPassReward.legitimacy} Legitimidad)`
                      : 'Pasar Turno'}
                  </span>
                  {activePlayer?.controller === 'HUMAN' && (
                    <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] font-mono font-bold text-slate-300">
                      P
                    </kbd>
                  )}
                </button>
              )}

              {/* Botón Entrar al Ágora Central */}
              {canEnterAgora && state.phase === 'PLAYER_TURN_READY' && (
                <button
                  onClick={onTryEnterAgora}
                  title="Entrar al Ágora Central (Atajo: A)"
                  className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                >
                  <Flame className="w-4 h-4" />
                  <span>¡Entrar al Ágora Central!</span>
                  {activePlayer?.controller === 'HUMAN' && (
                    <kbd className="hidden sm:inline-block px-1.5 py-0.5 rounded bg-pink-950/50 border border-pink-400/40 text-[10px] font-mono font-bold text-pink-100">
                      A
                    </kbd>
                  )}
                </button>
              )}

              {/* Botón Referéndum Barrial (convocar o abrir votación in-situ) */}
              {onTriggerNeighborhoodDecision &&
                activePlayer?.controller === 'HUMAN' &&
                (state.phase === 'PLAYER_TURN_READY' ||
                  (state.phase === 'TILE_ACTION_DECISION' && Boolean(state.neighborhoodDecision))) && (
                  <button
                    type="button"
                    onClick={() => {
                      playSound.modalOpen();
                      onTriggerNeighborhoodDecision();
                    }}
                    title="Abrir o convocar Referéndum Barrial in-situ ponderado por Reputación Vecinal"
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 tabular-nums border ${
                      state.neighborhoodDecision
                        ? 'bg-teal-950/90 hover:bg-teal-900 text-teal-200 border-teal-500/70 shadow-md'
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border-slate-700'
                    }`}
                  >
                    <Vote className="w-4 h-4 text-teal-300 shrink-0" />
                    <span>
                      {state.neighborhoodDecision && referendumSummary
                        ? `Referéndum (${referendumSummary.trustAccumulated.toFixed(1)}/${referendumSummary.requiredTrust.toFixed(1)})`
                        : 'Referéndum Barrial'}
                    </span>
                  </button>
                )}

            </div>

          </div>
        )}

      </div>

      {/* 6. TUTORIAL OVERLAY CONTEXTUAL (Primeros 3 turnos y bajo demanda) */}
      <TutorialOverlay
        state={state}
        isOpen={controlledTutorialOpen !== undefined ? controlledTutorialOpen : showTutorial}
        onClose={() => {
          setShowTutorial(false);
          if (controlledTutorialOpen && onToggleTutorial) {
            onToggleTutorial();
          }
        }}
        onOpenRules={onOpenRules}
        disableEscapeKey={isRulesOpen || isShortcutsOpen || isAchievementsOpen}
        onVisibilityChange={(visible) => {
          setInternalTutorialVisible(visible);
          onTutorialVisibilityChange?.(visible);
        }}
      />

      {/* 7. CAPA ATMOSFÉRICA CSS SUPERPUESTA SOBRE EL HUD SEGÚN weatherMode */}
      <WeatherOverlay
        weatherType={activeWeather.type}
        weatherMode={state.weatherMode}
        intensity={activeWeather.intensity}
      />

    </div>
  );
};

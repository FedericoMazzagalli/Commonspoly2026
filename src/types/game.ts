/**
 * Commonspoly Types & Interfaces
 * Basado en la Edición Verde oficial de Commonspoly (ZEMOS98)
 */

export type GoodType = 'HEALTH' | 'URBAN' | 'KNOWLEDGE' | 'ENVIRONMENT';

export type GoodState = 'PRIVATE' | 'PUBLIC' | 'COMMON';

export type TileCategory = 
  | 'RESOURCE'           // Bien sujeto a privatización/comunización
  | 'INALIENABLE_COMMON' // Bien común inalienable (Rosa)
  | 'SPECIAL'            // Casillas especiales (Asamblea, Burocracia, Banco, etc.)
  | 'SITUATION'          // Casilla 'S' de Cartas de Situación
  | 'CORNER'             // Salida, Asamblea, Burocracia, Tragedia
  | 'AGORA_ENTRY'        // Columna de acceso al Ágora Central
  | 'AGORA_CENTER';      // Centro de Insurrección Colectiva

export type SpecialTileType = 
  | 'START'
  | 'ASSEMBLY'           // Pierdes 2 Bienestar, ganas 2 Legitimidad
  | 'BUREAUCRACY'        // Pagas 6 Bienestar para convertir 1 Privado en Público
  | 'TRAGEDY_OF_COMMONS' // Privatizas obligatoriamente 3 bienes comunes
  | 'CROWDFUNDING'       // Donar 1 Bienestar da 2 Legitimidad al donante
  | 'BANK'               // Pierdes 6 Bienestar
  | 'CASINO'             // Pierdes 6 Legitimidad
  | 'DETENTION_CENTER'   // Retenido 1-6 rondas
  | 'NONE';

export interface Tile {
  id: number;
  code: string;
  name: string;
  category: TileCategory;
  goodType?: GoodType;
  defaultState?: GoodState;
  state?: GoodState;     // Estado actual: PRIVATE (Blanco), PUBLIC (Gris), COMMON (Negro)
  transformedById?: string;
  transformedByName?: string;
  transformedAtRound?: number;
  specialType?: SpecialTileType;
  columnId?: 'BOTTOM' | 'RIGHT' | 'TOP' | 'LEFT' | 'CENTER';
  columnIndex?: number;
  // Coordenadas en el espacio 3D (x, z)
  x: number;
  z: number;
  rotation?: number;     // Orientación visual
  description: string;
}

export type ControllerType = 'HUMAN' | 'BOT';

export interface CharacterSkills {
  care: number;          // Cuidar -> Bienes de Salud (1-6)
  occupy: number;        // Ocupar -> Bienes Urbanos (1-6)
  share: number;         // Compartir -> Bienes del Conocimiento (1-6)
  regenerate: number;    // Regenerar -> Bienes Medioambientales (1-6)
}

export interface CharacterUniqueBonus {
  id: string;
  title: string;
  shortLabel: string;
  description: string;
  goodType?: GoodType;
}

export type ReputationTierId =
  | 'DISTRUSTED'
  | 'SUSPECT'
  | 'NEUTRAL'
  | 'TRUSTED'
  | 'EXEMPLARY';

export interface ReputationEvent {
  id: string;
  round: number;
  delta: number;
  reason: string;
  kind: 'POSITIVE' | 'SELFISH';
}

export interface Character {
  id: string;
  name: string;
  bio: string;
  identityTag: string;
  hasCitizenship: boolean;
  socialClass: 'BAJA' | 'MEDIA' | 'ALTA';
  skills: CharacterSkills;
  uniqueBonus?: CharacterUniqueBonus;
  color: string;         // Color distintivo para la ficha 3D y UI
  accentColor: string;
  
  // Estado dinámico en la partida
  wellness: number;      // Puntos de Bienestar (comienzan con 5)
  legitimacy: number;    // Puntos de Legitimidad (comienzan con 5)
  position: number;      // ID de casilla actual
  isDetained: boolean;   // ¿Está en el Centro de Detención?
  detentionRoundsLeft: number;
  inAgora: boolean;      // ¿Está en el Ágora Central?
  roundsInAgora: number; // Máximo 3 rondas (-1 bienestar por ronda)
  controller: ControllerType;
  neighborhoodReputation?: number; // -20 a +20 (inicio 0)
  reputationHistory?: ReputationEvent[];
}

export interface Speculator {
  id: number;
  position: number;
  name: string;
  color: string;
}

export interface GlobalCard {
  id: string;
  title: string;
  quote?: string;
  description: string;
  effect: (state: GameEngineState) => { message: string; stateUpdates?: Partial<GameEngineState> };
}

export interface SituationCard {
  id: string;
  title: string;
  description: string;
  impactText: string;
  apply: (char: Character, state: GameEngineState) => { charUpdates: Partial<Character>; message: string };
}

export interface NeighborhoodDecision {
  id: string;
  title: string;
  description: string;
  targetTileIds: number[];
  votesCast: string[];
  trustAccumulated?: number;
  requiredTrust?: number;
  rewardSummary: string;
}

export type CrisisSeverity = 'WARNING' | 'CRITICAL' | 'OPPORTUNITY';

export interface UnexpectedCrisisEvent {
  id: string;
  title: string;
  description: string;
  affectedGoodType: GoodType | 'ALL';
  unlockCostDelta: number;
  commonYieldDelta: number;
  turnsRemaining: number;
  totalTurns: number;
  severity: CrisisSeverity;
  triggeredAtRound: number;
}

export type DifficultyLevel = 'MAD_MAX' | 'EN_TRANSICION' | 'COMUNLANDIA';

export type RulesetMode = 'OFFICIAL' | 'EXPANDED';

export interface SetupInitialRolls {
  health: number;        // 1-2 Privado, 3-4 Público, 5-6 Común
  urban: number;
  knowledge: number;
  environment: number;
  totalSum: number;
  difficulty: DifficultyLevel;
  speculatorsCount: number;
  rulesetMode?: RulesetMode;
}

export type GamePhase = 
  | 'TITLE'
  | 'SETUP'
  | 'GLOBAL_CARD'
  | 'PLAYER_TURN_READY'
  | 'DICE_ROLLING'
  | 'MOVE_ANIMATING'
  | 'TILE_ACTION_DECISION'
  | 'AGORA_COUNCIL'
  | 'SPECULATOR_TURN'
  | 'ROUND_TRANSITION'
  | 'GAME_OVER';

export type LogCategory = 'COOPERATIVE' | 'HAZARD' | 'SYSTEM' | 'CARD';
export type CooperativeActionType = 
  | 'RESCUE' 
  | 'COLLECTIVE_VOTE'
  | 'COMMON_UNLOCK' 
  | 'PUBLIC_UNLOCK' 
  | 'AGORA_INSURRECTION' 
  | 'CROWDFUND' 
  | 'SOLIDARITY' 
  | 'PROTECTION'
  | 'BUROCRACIA';

export interface GameLogEntry {
  id: string;
  round: number;
  timestamp: string;
  actor: string;
  actorColor?: string;
  target?: string;
  message: string;
  type: 'INFO' | 'ACTION' | 'CARD' | 'HAZARD' | 'SUCCESS';
  category?: LogCategory;
  cooperativeAction?: CooperativeActionType;
  highlight?: boolean;
}

export type SpeculatorActionKind =
  | 'BUY_TILE'
  | 'VANDALIZE_TILE'
  | 'ATTACK_PLAYER'
  | 'DETAIN_PLAYER'
  | 'BLOCKED'
  | 'MOVE';

export interface SpeculatorActionLogEntry {
  id: string;
  round: number;
  timestamp: string;
  speculatorId: number;
  speculatorName: string;
  speculatorColor: string;
  kind: SpeculatorActionKind;
  fromTileId: number;
  toTileId: number;
  tileName: string;
  diceRoll: number;
  previousTileState?: GoodState;
  nextTileState?: GoodState;
  targetPlayerName?: string;
  deltaPoints?: number;
  detentionRounds?: number;
  details: string;
}

export interface CooperativeChatMessage {
  id: string;
  senderName: string;
  senderColor: string;
  controller: ControllerType;
  text: string;
  round: number;
  timestamp: string;
  votingContext?: string;
}

export type AmbientSoundscape = 'TITLE' | 'NATURE' | 'URBAN' | 'AGORA';
export type AmbientMode = 'AUTO' | 'NATURE' | 'URBAN';

export type WeatherType = 'RAIN' | 'SNOW' | 'SUNNY' | 'DROUGHT' | 'TEMPERATE';
export type WeatherMode = 'AUTO' | 'RAIN' | 'SNOW' | 'SUNNY' | 'DROUGHT' | 'TEMPERATE';

export type TimeOfDayMode = 'AUTO' | 'DAWN' | 'NOON' | 'SUNSET' | 'NIGHT';
export type TimeOfDayPhase = 'DAWN' | 'MORNING' | 'NOON' | 'SUNSET' | 'TWILIGHT' | 'NIGHT';
export type CardAtmosphereKind =
  | 'NONE'
  | 'HEATWAVE'
  | 'ENERGY_CRISIS'
  | 'SPECULATIVE_PRESSURE'
  | 'SOLIDARITY_GLOW'
  | 'ECOLOGICAL_HOPE'
  | 'TRAGEDY_SHADOW'
  | 'AGORA_RADIANCE';

export interface WeatherCondition {
  type: WeatherType;
  mode: WeatherMode;
  intensity: number; // 0.2 a 1.0 para modular gradualmente partículas y atmósfera
  label: string;
  description: string;
  envCommonCount: number;
  envPublicCount: number;
  envPrivateCount: number;
  totalEnvTiles: number;
}

export type DynamicWeatherEventKind =
  | 'DROUGHT'
  | 'TORRENTIAL_RAIN'
  | 'HEATWAVE'
  | 'FROST_WAVE'
  | 'SOLAR_BLOOM';

export interface DynamicWeatherEvent {
  id: string;
  kind: DynamicWeatherEventKind;
  weatherType: WeatherType;
  title: string;
  description: string;
  alertMessage: string;
  affectedTileIds: number[];
  affectedTileNames: string[];
  affectedGoodTypes: GoodType[];
  unlockCostDelta: number;
  resourceYieldDelta: number;
  turnsRemaining: number;
  totalTurns: number;
  severity: 'HAZARD' | 'WARNING' | 'BENEFICIAL';
  triggeredAtRound: number;
}

export interface WeatherAdvancedConfig {
  /** Multiplicador de frecuencia de eventos dinámicos (0 = desactivado, 1 = estándar, 2 = extremo) */
  eventFrequencyMultiplier: number;
  /** Enfriamiento mínimo en turnos entre eventos meteorológicos (1 a 6) */
  minCooldownTurns: number;
  /** Escala de densidad y visibilidad de partículas climáticas 3D (0 a 1.5) */
  particleDensityScale: number;
  /** Escala de impacto atmosférico 3D: niebla, humedad, nubes e iluminación (0 a 1.5) */
  atmosphereImpactScale: number;
  /** Opacidad de la superposición atmosférica 2D sobre el HUD (0 a 1) */
  hudOverlayOpacity: number;
}

export type AchievementCategory = 
  | 'RESCUE' 
  | 'AGORA' 
  | 'ENVIRONMENT' 
  | 'HEALTH' 
  | 'KNOWLEDGE' 
  | 'URBAN' 
  | 'SOLIDARITY' 
  | 'VOTE';

export interface CooperativeAchievement {
  id: string;
  title: string;
  description: string;
  iconName: string;
  category: AchievementCategory;
  isUnlocked: boolean;
  unlockedAtRound?: number;
  unlockedByPlayerName?: string;
  unlockedByPlayerColor?: string;
  progress: {
    current: number;
    target: number;
  };
  tier?: 'BRONZE' | 'SILVER' | 'GOLD';
}

export interface GameEngineState {
  phase: GamePhase;
  round: number;         // 1 a 20
  activePlayerIndex: number;
  players: Character[];
  speculators: Speculator[];
  tiles: Tile[];
  setupConfig?: SetupInitialRolls;
  
  // Dados
  currentDiceRoll: number | null;
  
  // Cartas actuales
  currentGlobalCard: GlobalCard | null;
  currentSituationCard: SituationCard | null;
  
  // Modales interactivos
  activeModal: 
    | null 
    | 'GLOBAL_CARD' 
    | 'SITUATION_CARD' 
    | 'SPECULATOR_ATTACK' 
    | 'AGORA_INSURRECTION' 
    | 'DETENTION_RESCUE' 
    | 'TRAGEDY_VOTE' 
    | 'BUREAUCRACY'
    | 'CROWDFUNDING'
    | 'ACHIEVEMENTS'
    | 'RULES'
    | 'NEIGHBORHOOD_DECISION';

  neighborhoodDecision: NeighborhoodDecision | null;

  // Logros de cooperación
  achievements?: CooperativeAchievement[];
  recentAchievement?: CooperativeAchievement | null;

  // Estadísticas de rendimiento y evolución por ronda (para Dashboard de Fin de Partida)
  playerStats?: Record<string, PlayerContributionStats>;
  performanceHistory?: RoundPerformanceSnapshot[];
  turnHistory?: TurnCommonsSnapshot[];
  replayFrames?: TurnReplayFrame[];

  // Modal context payloads
  speculatorAttackPayload?: {
    speculatorId: number;
    victimId: string;
    actionType: 'POINTS' | 'DETENTION' | 'TRAGEDY';
    diceRoll: number;
  };

  // Historial de la partida
  logs: GameLogEntry[];

  // Log en tiempo real de acciones de especuladores (compras, vandalismo, ataques, bloqueos)
  speculatorActionLogs?: SpeculatorActionLogEntry[];

  // Chat rápido cooperativo
  chatMessages: CooperativeChatMessage[];

  // Fin de juego
  gameResult?: 'VICTORY' | 'DRAW' | 'DEFEAT';
  gameResultDetails?: string;

  // Preferencias de vista, gráficos, audio y háptica
  cameraMode: 'ISOMETRIC' | 'TOP_DOWN' | 'FOLLOW';
  soundEnabled: boolean;
  hapticsEnabled?: boolean;
  postProcessingEnabled?: boolean;
  ambientMode: AmbientMode;
  weatherMode: WeatherMode;
  weatherIntensity?: number;
  weatherAdvancedConfig?: WeatherAdvancedConfig;
  timeOfDayMode?: TimeOfDayMode;

  // Motor de eventos de crisis inesperada
  activeCrisis?: UnexpectedCrisisEvent | null;
  turnsSinceLastCrisis?: number;

  // Motor de eventos meteorológicos dinámicos
  activeWeatherEvent?: DynamicWeatherEvent | null;
  turnsSinceLastWeatherEvent?: number;

  // Metadatos de sesión (Sandbox, Reto Diario determinista, Multijugador Online, Modo de Reglas)
  rulesetMode?: RulesetMode;
  globalDeckIds?: string[];
  globalDeckCursor?: number;
  situationDeckIds?: string[];
  situationDeckCursor?: number;
  isSandboxSession?: boolean;
  probabilitySandbox?: ProbabilitySandboxConfig;
  dailyChallengeDate?: string | null;
  seedNumber?: number | null;
  multiplayerRoomId?: string | null;
  multiplayerRoomCode?: string | null;
}

export type SandboxDiceProfile = 'FAIR' | 'LOW_BIASED' | 'HIGH_BIASED' | 'FORCED';

export type SandboxSpeculatorMovementLogic =
  | 'STANDARD_1D6'
  | 'CHASE_NEAREST'
  | 'AGGRESSIVE_MAX'
  | 'FROZEN';

export interface SpeculatorBehaviorOverride {
  speculatorId: number;
  aggressivenessPct: number;
  influenceRadius: number;
  decisionThreshold: number;
}

export interface ProbabilitySandboxConfig {
  enabled: boolean;
  playerDiceProfile: SandboxDiceProfile;
  forcedPlayerDice: number;
  speculatorMovementLogic: SandboxSpeculatorMovementLogic;
  forcedSpeculatorDice: number | null;
  detentionChanceOverridePct: number | null;
  speculatorBehaviors?: Record<number, SpeculatorBehaviorOverride>;
}

export interface PlayerContributionStats {
  playerId: string;
  playerName: string;
  color: string;
  commonsUnlocked: number;
  publicsUnlocked: number;
  cooperativeActions: number;
  wellnessInvested: number;
  totalResourcesEarned: number;
}

export interface RoundPlayerSnapshot {
  playerId: string;
  playerName: string;
  color: string;
  wellness: number;
  legitimacy: number;
  totalResources: number;
  commonsContributed: number;
  publicsContributed: number;
  cooperativeActions: number;
}

export interface RoundPerformanceSnapshot {
  round: number;
  commonCount: number;
  publicCount: number;
  privateCount: number;
  players: RoundPlayerSnapshot[];
}

export interface TurnCommonsSnapshot {
  turn: number;
  round: number;
  label: string;
  actorName: string;
  actorColor?: string;
  eventSummary?: string;
  commonCount: number;
  recoveredDelta: number;
  publicCount: number;
  privateCount: number;
  totalResourceTiles: number;
}

export interface ReplayPlayerSnapshot {
  id: string;
  name: string;
  color: string;
  controller: ControllerType;
  position: number;
  wellness: number;
  legitimacy: number;
  isDetained: boolean;
  detentionRoundsLeft: number;
  inAgora: boolean;
  roundsInAgora: number;
  neighborhoodReputation: number;
}

export interface TurnReplayFrame {
  frameIndex: number;
  round: number;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorColor: string;
  activePlayerIndex: number;
  diceRoll: number | null;
  eventSummary: string;
  turnLogs: GameLogEntry[];
  newestLogId?: string;
  players: ReplayPlayerSnapshot[];
  speculators: Speculator[];
  tileStates: Record<number, GoodState>;
  commonCount: number;
  publicCount: number;
  privateCount: number;
  activeWeatherTitle?: string;
  activeCrisisTitle?: string;
}

export type TutorialBoardFocus =
  | 'NONE'
  | 'LEGITIMACY_AND_GOAL'
  | 'GOODS_STATES'
  | 'ACTIVE_PLAYER_PAWN'
  | 'TURN_DICE_AND_TILE'
  | 'SPECULATORS_THREAT'
  | 'AGORA_CENTRAL';

export type BoardDangerZoneTier = 'NONE' | 'MODERATE' | 'HIGH' | 'CRITICAL' | 'PROTECTED';

export interface BoardDangerZoneEntry {
  tileId: number;
  intensity: number; // 0..1
  tier: BoardDangerZoneTier;
  isIntendedTarget: boolean;
  hitChancePct: number;
  intendedByCount: number;
}

export interface SpeculatorTrajectory {
  speculatorId: number;
  speculatorName: string;
  orderIndex: number;
  fromTileId: number;
  toTileId: number;
  distance: number;
  reason: 'IN_RANGE_ATTACK' | 'BLOCKED_MUTUAL_PROTECTION' | 'NEAREST_ISOLATED_CHASE' | 'EXPECTED_MIDPOINT';
  inCurrentRollRange: boolean;
  targetPlayerName?: string;
  color: string;
  colorHex: number;
  pathTileIds: number[];
}


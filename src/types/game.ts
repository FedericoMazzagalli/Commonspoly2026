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

export interface Character {
  id: string;
  name: string;
  bio: string;
  identityTag: string;
  hasCitizenship: boolean;
  socialClass: 'BAJA' | 'MEDIA' | 'ALTA';
  skills: CharacterSkills;
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

export type DifficultyLevel = 'MAD_MAX' | 'EN_TRANSICION' | 'COMUNLANDIA';

export interface SetupInitialRolls {
  health: number;        // 1-2 Privado, 3-4 Público, 5-6 Común
  urban: number;
  knowledge: number;
  environment: number;
  totalSum: number;
  difficulty: DifficultyLevel;
  speculatorsCount: number;
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
    | 'RULES';

  // Logros de cooperación
  achievements?: CooperativeAchievement[];
  recentAchievement?: CooperativeAchievement | null;

  // Estadísticas de rendimiento y evolución por ronda (para Dashboard de Fin de Partida)
  playerStats?: Record<string, PlayerContributionStats>;
  performanceHistory?: RoundPerformanceSnapshot[];
  turnHistory?: TurnCommonsSnapshot[];

  // Modal context payloads
  speculatorAttackPayload?: {
    speculatorId: number;
    victimId: string;
    actionType: 'POINTS' | 'DETENTION' | 'TRAGEDY';
    diceRoll: number;
  };

  // Historial de la partida
  logs: GameLogEntry[];

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
  timeOfDayMode?: TimeOfDayMode;
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

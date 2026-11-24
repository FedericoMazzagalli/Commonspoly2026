/**
 * Casillas completas de Commonspoly (Edición Verde)
 * 40 casillas de perímetro + columnas radiales + Ágora Central
 */

import { Tile, GoodState } from '../types/game';

export const INITIAL_TILES: Tile[] = [
  // --- LADO INFERIOR (Z = 10, X: -10 -> 10) ---
  {
    id: 0,
    code: 'SALIDA',
    name: 'SALIDA',
    category: 'CORNER',
    specialType: 'START',
    x: -10,
    z: 10,
    description: 'Punto de partida de todos los Personajes y Especuladores.'
  },
  {
    id: 1,
    code: 'COSTA',
    name: 'Costa',
    category: 'RESOURCE',
    goodType: 'ENVIRONMENT',
    x: -8,
    z: 10,
    description: 'Espacio litoral común para disfrute libre y protección de la biodiversidad marina.'
  },
  {
    id: 2,
    code: 'HOSPITAL',
    name: 'Hospital',
    category: 'RESOURCE',
    goodType: 'HEALTH',
    x: -6,
    z: 10,
    description: 'Infraestructura hospitalaria y de atención comunitaria integral.'
  },
  {
    id: 3,
    code: 'SIT_1',
    name: 'Situación',
    category: 'SITUATION',
    x: -4,
    z: 10,
    description: 'Toma una Carta de Situación y resuelve su impacto inmediato.'
  },
  {
    id: 4,
    code: 'COOPERATIVA',
    name: 'Cooperativa',
    category: 'INALIENABLE_COMMON',
    state: 'COMMON',
    x: -2,
    z: 10,
    description: 'Bien Común Inalienable. Otorga +2 Bienestar y +2 Legitimidad al visitarla.'
  },
  {
    id: 5,
    code: 'TRANVIA',
    name: 'Tranvía',
    category: 'RESOURCE',
    goodType: 'URBAN',
    x: 0,
    z: 10,
    description: 'Transporte público colectivo, accesible y descarbonizado.'
  },
  {
    id: 6,
    code: 'MUSEO',
    name: 'Museo',
    category: 'RESOURCE',
    goodType: 'KNOWLEDGE',
    x: 2,
    z: 10,
    description: 'Acervo cultural, archivo vivo y memoria histórica libre.'
  },
  {
    id: 7,
    code: 'JARDIN',
    name: 'Jardín',
    category: 'RESOURCE',
    goodType: 'ENVIRONMENT',
    x: 4,
    z: 10,
    description: 'Pulmón verde urbano y refugio climático de proximidad.'
  },
  {
    id: 8,
    code: 'EDIFICIO_ABANDONADO',
    name: 'Edificio Abandonado',
    category: 'RESOURCE',
    goodType: 'URBAN',
    x: 6,
    z: 10,
    description: 'Inmueble vacío susceptible de ocupación vecinal o especulación inmobiliaria.'
  },
  {
    id: 9,
    code: 'SAUNA',
    name: 'Sauna',
    category: 'RESOURCE',
    goodType: 'HEALTH',
    x: 8,
    z: 10,
    description: 'Espacio de termalismo social, autocuidado y salud preventiva.'
  },
  {
    id: 10,
    code: 'BUROCRACIA',
    name: 'Burocracia',
    category: 'CORNER',
    specialType: 'BUREAUCRACY',
    x: 10,
    z: 10,
    description: 'Casilla Especial: Puedes pagar 6 Bienestar para convertir 1 Bien Privado en Público.'
  },

  // --- LADO DERECHO (X = 10, Z: 8 -> -10) ---
  {
    id: 11,
    code: 'GRANJA_ECO',
    name: 'Granja Eco',
    category: 'RESOURCE',
    goodType: 'ENVIRONMENT',
    x: 10,
    z: 8,
    description: 'Agroecología campesina y soberanía alimentaria sin agrotóxicos.'
  },
  {
    id: 12,
    code: 'BIBLIOTECA',
    name: 'Biblioteca',
    category: 'RESOURCE',
    goodType: 'KNOWLEDGE',
    x: 10,
    z: 6,
    description: 'Acceso universal al conocimiento, préstamo de libros y herramientas.'
  },
  {
    id: 13,
    code: 'SIT_2',
    name: 'Situación',
    category: 'SITUATION',
    x: 10,
    z: 4,
    description: 'Toma una Carta de Situación y resuelve su impacto inmediato.'
  },
  {
    id: 14,
    code: 'RED_P2P',
    name: 'Red P2P',
    category: 'INALIENABLE_COMMON',
    state: 'COMMON',
    x: 10,
    z: 2,
    description: 'Bien Común Inalienable. Infraestructura descentralizada: +2 Bienestar y +2 Legitimidad.'
  },
  {
    id: 15,
    code: 'SALA_CONCIERTOS',
    name: 'Sala de Conciertos',
    category: 'RESOURCE',
    goodType: 'KNOWLEDGE',
    x: 10,
    z: 0,
    description: 'Espacio escénico autogestionado para la cultura comunitaria.'
  },
  {
    id: 16,
    code: 'PARQUE_INFANTIL',
    name: 'Parque Infantil',
    category: 'RESOURCE',
    goodType: 'URBAN',
    x: 10,
    z: -2,
    description: 'Área lúdica comunitaria para la crianza colectiva y el juego libre.'
  },
  {
    id: 17,
    code: 'HUERTO_URBANO',
    name: 'Huerto Urbano',
    category: 'INALIENABLE_COMMON',
    state: 'COMMON',
    x: 10,
    z: -4,
    description: 'Bien Común Inalienable. Cultivo vecinal solidario: +2 Bienestar y +2 Legitimidad.'
  },
  {
    id: 18,
    code: 'CENTRO_DETENCION',
    name: 'Centro de Detención',
    category: 'SPECIAL',
    specialType: 'DETENTION_CENTER',
    x: 10,
    z: -6,
    description: 'Retención administrativa represiva. Requiere rescate solidario para liberarse.'
  },
  {
    id: 19,
    code: 'RESIDENCIA_MAYORES',
    name: 'Residencia de Mayores',
    category: 'RESOURCE',
    goodType: 'HEALTH',
    x: 10,
    z: -8,
    description: 'Cuidados intergeneracionales dignos frente al abandono mercantil.'
  },
  {
    id: 20,
    code: 'TRAGEDIA_COMUNES',
    name: 'Tragedia de los Comunes',
    category: 'CORNER',
    specialType: 'TRAGEDY_OF_COMMONS',
    x: 10,
    z: -10,
    description: '¡Alarma! Obliga a privatizar de inmediato 3 Bienes Comunes (los inalienables no sufren).'
  },

  // --- LADO SUPERIOR (Z = -10, X: 8 -> -10) ---
  {
    id: 21,
    code: 'PARQUE',
    name: 'Parque',
    category: 'RESOURCE',
    goodType: 'ENVIRONMENT',
    x: 8,
    z: -10,
    description: 'Gran parque metropolitano abierto a toda la ciudadanía.'
  },
  {
    id: 22,
    code: 'COLEGIO',
    name: 'Colegio',
    category: 'RESOURCE',
    goodType: 'KNOWLEDGE',
    x: 6,
    z: -10,
    description: 'Escuela pública inclusiva y laica orientada al pensamiento crítico.'
  },
  {
    id: 23,
    code: 'SIT_3',
    name: 'Situación',
    category: 'SITUATION',
    x: 4,
    z: -10,
    description: 'Toma una Carta de Situación y resuelve su impacto inmediato.'
  },
  {
    id: 24,
    code: 'CENTRO_SOCIAL',
    name: 'Centro Social',
    category: 'INALIENABLE_COMMON',
    state: 'COMMON',
    x: 2,
    z: -10,
    description: 'Bien Común Inalienable. Espacio liberado para reuniones: +2 Bienestar y +2 Legitimidad.'
  },
  {
    id: 25,
    code: 'SKATE_PARK',
    name: 'Skate Park',
    category: 'RESOURCE',
    goodType: 'URBAN',
    x: 0,
    z: -10,
    description: 'Pistas juveniles autogestionadas y apropiación del espacio público.'
  },
  {
    id: 26,
    code: 'PISCINA',
    name: 'Piscina Municipal',
    category: 'RESOURCE',
    goodType: 'HEALTH',
    x: -2,
    z: -10,
    description: 'Instalaciones acuáticas públicas para ocio y terapia física comunitaria.'
  },
  {
    id: 27,
    code: 'ESTACION_CARGA',
    name: 'Estación de Carga',
    category: 'RESOURCE',
    goodType: 'ENVIRONMENT',
    x: -4,
    z: -10,
    description: 'Energía renovable comunitaria y puntos de recarga limpia.'
  },
  {
    id: 28,
    code: 'BANCO',
    name: 'Banco Privado',
    category: 'SPECIAL',
    specialType: 'BANK',
    x: -6,
    z: -10,
    description: '¡Trampa financiera! Si caes aquí pierdes 6 Puntos de Bienestar.'
  },
  {
    id: 29,
    code: 'RUTA_CICLISTA',
    name: 'Ruta Ciclista',
    category: 'RESOURCE',
    goodType: 'URBAN',
    x: -8,
    z: -10,
    description: 'Vía ciclista protegida conectando barrios periféricos con el centro.'
  },
  {
    id: 30,
    code: 'ASAMBLEA',
    name: 'Asamblea',
    category: 'CORNER',
    specialType: 'ASSEMBLY',
    x: -10,
    z: -10,
    description: 'Democracia directa: Pierdes 2 Puntos de Bienestar pero ganas 2 de Legitimidad.'
  },

  // --- LADO IZQUIERDO (X = -10, Z: -8 -> 8) ---
  {
    id: 31,
    code: 'TIENDA_ECOLOGICA',
    name: 'Tienda Ecológica',
    category: 'INALIENABLE_COMMON',
    state: 'COMMON',
    x: -10,
    z: -8,
    description: 'Bien Común Inalienable. Comercio justo cooperativo: +2 Bienestar y +2 Legitimidad.'
  },
  {
    id: 32,
    code: 'UNIVERSIDAD',
    name: 'Universidad',
    category: 'RESOURCE',
    goodType: 'KNOWLEDGE',
    x: -10,
    z: -6,
    description: 'Universidad pública libre, divulgación científica sin patentes abusivas.'
  },
  {
    id: 33,
    code: 'SIT_4',
    name: 'Situación',
    category: 'SITUATION',
    x: -10,
    z: -4,
    description: 'Toma una Carta de Situación y resuelve su impacto inmediato.'
  },
  {
    id: 34,
    code: 'HACKLAB',
    name: 'Hacklab',
    category: 'INALIENABLE_COMMON',
    state: 'COMMON',
    x: -10,
    z: -2,
    description: 'Bien Común Inalienable. Laboratorio de código y soberanía tecno: +2 Bienestar y +2 Legitimidad.'
  },
  {
    id: 35,
    code: 'SALUD_MENTAL',
    name: 'Centro de Salud Mental',
    category: 'RESOURCE',
    goodType: 'HEALTH',
    x: -10,
    z: 0,
    description: 'Acompañamiento psicosocial colectivo frente a la soledad e incertidumbre.'
  },
  {
    id: 36,
    code: 'CASINO',
    name: 'Casino',
    category: 'SPECIAL',
    specialType: 'CASINO',
    x: -10,
    z: 2,
    description: '¡Trampa especulativa! Si caes aquí pierdes 6 Puntos de Legitimidad.'
  },
  {
    id: 37,
    code: 'CANTERA',
    name: 'Antigua Cantera',
    category: 'RESOURCE',
    goodType: 'ENVIRONMENT',
    x: -10,
    z: 4,
    description: 'Zona degradada en proceso de restauración ecológica comunitaria.'
  },
  {
    id: 38,
    code: 'CROWDFUNDING',
    name: 'Crowdfunding',
    category: 'SPECIAL',
    specialType: 'CROWDFUNDING',
    x: -10,
    z: 6,
    description: 'Caja de resistencia: Cada 1 Bienestar que dones a otro te otorga 2 de Legitimidad.'
  },
  {
    id: 39,
    code: 'INFRAESTRUCTURA',
    name: 'Infraestructura Eléctrica',
    category: 'RESOURCE',
    goodType: 'URBAN',
    x: -10,
    z: 8,
    description: 'Red comunitaria de autoconsumo solar distribuido.'
  },

  // --- COLUMNAS DE ACCESO AL ÁGORA CENTRAL ---
  // Columna Sur (Entrada desde Tranvía)
  {
    id: 41,
    code: 'COL_RIO',
    name: 'Río',
    category: 'AGORA_ENTRY',
    goodType: 'ENVIRONMENT',
    columnId: 'BOTTOM',
    columnIndex: 1,
    x: 0,
    z: 7.5,
    description: 'Cauce vivo del río urbano. Vía de acceso hacia el Ágora Central.'
  },
  {
    id: 42,
    code: 'COL_CITAS',
    name: 'Centro de Citas',
    category: 'AGORA_ENTRY',
    goodType: 'HEALTH',
    columnId: 'BOTTOM',
    columnIndex: 2,
    x: 0,
    z: 5.2,
    description: 'Espacio de afectos y vínculos libres. Segundo paso hacia el Ágora.'
  },
  {
    id: 43,
    code: 'COL_TREN',
    name: 'Estación de Tren',
    category: 'AGORA_ENTRY',
    goodType: 'URBAN',
    columnId: 'BOTTOM',
    columnIndex: 3,
    x: 0,
    z: 3.0,
    description: 'Nodal de cercanías. ¡Tira el valor exacto para entrar al Ágora Central!'
  },

  // Columna Este (Entrada desde Sala de Conciertos)
  {
    id: 45,
    code: 'COL_TEATRO',
    name: 'Teatro',
    category: 'AGORA_ENTRY',
    goodType: 'KNOWLEDGE',
    columnId: 'RIGHT',
    columnIndex: 1,
    x: 7.5,
    z: 0,
    description: 'Teatro de las oprimidas. Acceso este hacia el Ágora Central.'
  },
  {
    id: 46,
    code: 'COL_INTERNET',
    name: 'Internet Libre',
    category: 'AGORA_ENTRY',
    goodType: 'KNOWLEDGE',
    columnId: 'RIGHT',
    columnIndex: 2,
    x: 5.2,
    z: 0,
    description: 'Red comunitaria sin censura comercial. Camino al Ágora.'
  },
  {
    id: 47,
    code: 'COL_CALLE',
    name: 'Calle Peatonal',
    category: 'AGORA_ENTRY',
    goodType: 'URBAN',
    columnId: 'RIGHT',
    columnIndex: 3,
    x: 3.0,
    z: 0,
    description: 'Vía sin coches. ¡Tira el valor exacto para entrar al Ágora Central!'
  },

  // Columna Norte (Entrada desde Skate Park)
  {
    id: 48,
    code: 'COL_BANOS',
    name: 'Baños Públicos',
    category: 'AGORA_ENTRY',
    goodType: 'HEALTH',
    columnId: 'TOP',
    columnIndex: 1,
    x: 0,
    z: -7.5,
    description: 'Higiene digna y agua gratuita. Acceso norte hacia el Ágora.'
  },
  {
    id: 49,
    code: 'COL_YOGA',
    name: 'Centro de Yoga',
    category: 'AGORA_ENTRY',
    goodType: 'HEALTH',
    columnId: 'TOP',
    columnIndex: 2,
    x: 0,
    z: -5.2,
    description: 'Salud somática y respiración colectiva. Camino al Ágora.'
  },
  {
    id: 50,
    code: 'COL_RESERVA',
    name: 'Reserva Natural',
    category: 'AGORA_ENTRY',
    goodType: 'ENVIRONMENT',
    columnId: 'TOP',
    columnIndex: 3,
    x: 0,
    z: -3.0,
    description: 'Santuario de flora autóctona. ¡Tira el valor exacto para entrar al Ágora Central!'
  },

  // Columna Oeste (Entrada desde Salud Mental)
  {
    id: 51,
    code: 'COL_POLI',
    name: 'Polideportivo',
    category: 'AGORA_ENTRY',
    goodType: 'HEALTH',
    columnId: 'LEFT',
    columnIndex: 1,
    x: -7.5,
    z: 0,
    description: 'Deporte de base no competitivo. Acceso oeste hacia el Ágora.'
  },
  {
    id: 52,
    code: 'COL_GRIFO',
    name: 'Agua del Grifo',
    category: 'AGORA_ENTRY',
    goodType: 'ENVIRONMENT',
    columnId: 'LEFT',
    columnIndex: 2,
    x: -5.2,
    z: 0,
    description: 'Derecho humano al agua potable universal. Camino al Ágora.'
  },
  {
    id: 53,
    code: 'COL_MERCADO',
    name: 'Mercado de Abastos',
    category: 'AGORA_ENTRY',
    goodType: 'URBAN',
    columnId: 'LEFT',
    columnIndex: 3,
    x: -3.0,
    z: 0,
    description: 'Comercio barrial de cercanía. ¡Tira el valor exacto para entrar al Ágora Central!'
  },

  // --- ÁGORA CENTRAL ---
  {
    id: 100,
    code: 'AGORA_CENTRAL',
    name: 'ÁGORA CENTRAL',
    category: 'AGORA_CENTER',
    x: 0,
    z: 0,
    description: 'El corazón asambleario de Commonspoly. ¡Reunid a 3 personajes con suficiente Legitimidad colectiva para desprivatizar una categoría entera de bienes!'
  }
];

export interface AgoraColumnConfig {
  entryTileId: number;
  columnId: 'BOTTOM' | 'RIGHT' | 'TOP' | 'LEFT';
  tileIds: [number, number, number];
}

export const AGORA_COLUMNS: AgoraColumnConfig[] = [
  { entryTileId: 5, columnId: 'BOTTOM', tileIds: [41, 42, 43] },
  { entryTileId: 15, columnId: 'RIGHT', tileIds: [45, 46, 47] },
  { entryTileId: 25, columnId: 'TOP', tileIds: [48, 49, 50] },
  { entryTileId: 35, columnId: 'LEFT', tileIds: [51, 52, 53] }
];

export function findAgoraColumnByTileId(tileId: number): AgoraColumnConfig | undefined {
  return AGORA_COLUMNS.find(
    col => col.entryTileId === tileId || col.tileIds.includes(tileId)
  );
}

export function isAgoraEntryOrColumnTile(tileId: number): boolean {
  return Boolean(findAgoraColumnByTileId(tileId));
}

export interface AgoraColumnMoveResult {
  targetPos: number;
  enteredAgora: boolean;
  reboundedInColumn: boolean;
  pathTileIds: number[];
}

/**
 * Calcula el avance radial por las columnas de acceso al Ágora Central (regla oficial:
 * entrada desde casillas 5, 15, 25 o 35 con Legitimidad colectiva suficiente y entrada por tirada exacta al #100 con rebote).
 */
export function computeAgoraColumnMove(
  currentPos: number,
  roll: number,
  collectiveLegitimacyMet: boolean
): AgoraColumnMoveResult | null {
  const col = findAgoraColumnByTileId(currentPos);
  if (!col) return null;

  const isInsideColumn = col.tileIds.includes(currentPos);
  // Sólo se puede iniciar el ascenso desde el perímetro si el grupo alcanzó la Legitimidad colectiva
  if (!isInsideColumn && !collectiveLegitimacyMet) {
    return null;
  }

  const chain: number[] = [col.entryTileId, ...col.tileIds, 100];
  const startIdx = chain.indexOf(currentPos);
  if (startIdx < 0) return null;

  let idx = startIdx;
  let dir = 1;
  let reboundedInColumn = false;
  const pathTileIds: number[] = [chain[idx]];

  for (let step = 1; step <= roll; step++) {
    const maxReachableIdx = collectiveLegitimacyMet ? 4 : 3;
    if (idx >= maxReachableIdx) {
      dir = -1;
      reboundedInColumn = true;
    } else if (idx <= 0) {
      dir = 1;
    }
    idx += dir;
    pathTileIds.push(chain[idx]);
  }

  const targetPos = chain[idx];
  return {
    targetPos,
    enteredAgora: targetPos === 100,
    reboundedInColumn,
    pathTileIds
  };
}

export function applyInitialDifficultyToTiles(tiles: Tile[], rolls: { health: number; urban: number; knowledge: number; environment: number }): Tile[] {
  const stateFromRoll = (val: number): GoodState => {
    if (val <= 2) return 'PRIVATE';
    if (val <= 4) return 'PUBLIC';
    return 'COMMON';
  };

  const healthState = stateFromRoll(rolls.health);
  const urbanState = stateFromRoll(rolls.urban);
  const knowledgeState = stateFromRoll(rolls.knowledge);
  const environmentState = stateFromRoll(rolls.environment);

  return tiles.map(tile => {
    if (tile.category === 'INALIENABLE_COMMON') {
      return { ...tile, state: 'COMMON' };
    }
    if (tile.goodType === 'HEALTH') {
      return { ...tile, state: healthState };
    }
    if (tile.goodType === 'URBAN') {
      return { ...tile, state: urbanState };
    }
    if (tile.goodType === 'KNOWLEDGE') {
      return { ...tile, state: knowledgeState };
    }
    if (tile.goodType === 'ENVIRONMENT') {
      return { ...tile, state: environmentState };
    }
    return tile;
  });
}

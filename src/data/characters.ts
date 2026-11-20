/**
 * Los 8 Personajes Oficiales de Commonspoly (Edición Verde)
 * Con sus perfiles sociodemográficos, habilidades inmutables (1-6), atributos
 * y bonificadores únicos para el juego cooperativo.
 */

import { Character, CharacterUniqueBonus } from '../types/game';

export const OFFICIAL_CHARACTERS: Omit<
  Character,
  'wellness' | 'legitimacy' | 'position' | 'isDetained' | 'detentionRoundsLeft' | 'inAgora' | 'roundsInAgora' | 'controller'
>[] = [
  {
    id: 'carolina',
    name: 'Carolina',
    bio: 'Soy una trabajadora doméstica salvadoreña que lucha por los derechos laborales de las mujeres migrantes.',
    identityTag: 'Mujer heterosexual latina de clase media · Sin ciudadanía',
    hasCitizenship: false,
    socialClass: 'MEDIA',
    skills: {
      care: 6,       // Salud (Cuidar)
      occupy: 3,     // Urbano (Ocupar)
      share: 2,      // Conocimiento (Compartir)
      regenerate: 1  // Medioambiental (Regenerar)
    },
    uniqueBonus: {
      id: 'mutual_care_network',
      title: 'Red de Cuidados Mutuos',
      shortLabel: '-1 coste Salud · +1 Bienestar al rescatar',
      description:
        'Reduce en 1 punto adicional el coste de Bienestar al transformar Bienes de Salud y recupera +1 Bienestar para sí cuando rescata a una compañera detenida.',
      goodType: 'HEALTH'
    },
    color: '#D946EF', // Rosa fucsia
    accentColor: '#A21CAF'
  },
  {
    id: 'chelsea',
    name: 'Chelsea',
    bio: 'Soy una mujer trans experta en seguridad digital y activista LGTB.',
    identityTag: 'Blanca y heterosexual de clase media · Sin ciudadanía',
    hasCitizenship: false,
    socialClass: 'MEDIA',
    skills: {
      care: 2,
      occupy: 3,
      share: 6,       // Conocimiento (Compartir)
      regenerate: 1
    },
    uniqueBonus: {
      id: 'open_digital_commons',
      title: 'Cultura Digital Abierta',
      shortLabel: '-1 coste Saber · +1 Legitimidad en Saber público',
      description:
        'Reduce en 1 punto adicional el coste de transformar Bienes del Conocimiento y obtiene +1 Legitimidad extra al pasar o disfrutar casillas de Conocimiento.',
      goodType: 'KNOWLEDGE'
    },
    color: '#3B82F6', // Azul eléctrico
    accentColor: '#1D4ED8'
  },
  {
    id: 'matsuko',
    name: 'Matsuko',
    bio: 'Soy actor y activista a favor del travestismo y de la comunidad gay.',
    identityTag: 'Hombre asiático homosexual de clase alta · Con ciudadanía',
    hasCitizenship: true,
    socialClass: 'ALTA',
    skills: {
      care: 3,
      occupy: 1,
      share: 4,
      regenerate: 4
    },
    uniqueBonus: {
      id: 'cultural_agitation',
      title: 'Agitación Cultural',
      shortLabel: '+1 Legitimidad extra al comunizar cualquier bien',
      description:
        'Su proyección pública inspira a la asamblea: cada vez que eleva un recurso a Bien Común, obtiene +1 punto adicional de Legitimidad colectiva.'
    },
    color: '#8B5CF6', // Violeta
    accentColor: '#6D28D9'
  },
  {
    id: 'moha',
    name: 'Moha',
    bio: 'Soy un activista antirracista interesado en narrativas por el derecho a una ciudad diversa e inclusiva.',
    identityTag: 'Hombre negro homosexual de clase baja · Con ciudadanía',
    hasCitizenship: true,
    socialClass: 'BAJA',
    skills: {
      care: 1,
      occupy: 4,
      share: 4,
      regenerate: 3
    },
    uniqueBonus: {
      id: 'right_to_the_city',
      title: 'Derecho a la Ciudad',
      shortLabel: '-1 coste Urbano · +1 Bienestar al cruzar Salida',
      description:
        'Reduce en 1 punto adicional el coste de transformar Bienes Urbanos y obtiene +1 Bienestar extra cada vez que cruza o cae en la casilla de Salida.',
      goodType: 'URBAN'
    },
    color: '#F97316', // Naranja
    accentColor: '#C2410C'
  },
  {
    id: 'prafulla',
    name: 'Prafulla',
    bio: 'Soy cocinero en un restaurante ambulante y solidario de comida ecológica hindú.',
    identityTag: 'Hombre negro heterosexual de clase media · Sin ciudadanía',
    hasCitizenship: false,
    socialClass: 'MEDIA',
    skills: {
      care: 2,
      occupy: 6,      // Urbano (Ocupar)
      share: 1,
      regenerate: 3
    },
    uniqueBonus: {
      id: 'solidarity_kitchen',
      title: 'Cocina Ambulante Solidaria',
      shortLabel: '-1 coste Urbano · +1 Bienestar en Bienes Públicos',
      description:
        'Reduce en 1 punto adicional el coste de Bienes Urbanos y suma +1 Bienestar adicional al pasar o descansar en cualquier Bien Público.',
      goodType: 'URBAN'
    },
    color: '#EAB308', // Amarillo mostaza
    accentColor: '#A16207'
  },
  {
    id: 'temple',
    name: 'Temple',
    bio: 'Soy veterinaria y zoóloga. Orgullosa de hablar sobre mi autismo abiertamente.',
    identityTag: 'Mujer blanca lesbiana de clase alta · Con ciudadanía',
    hasCitizenship: true,
    socialClass: 'ALTA',
    skills: {
      care: 5,
      occupy: 4,
      share: 1,
      regenerate: 2
    },
    uniqueBonus: {
      id: 'systematic_observation',
      title: 'Observación Sistemática',
      shortLabel: '-1 sobrecoste ante Crisis activas en cualquier bien',
      description:
        'Su análisis minucioso mitiga los cuellos de botella: reduce en 1 punto el sobrecoste impuesto por cualquier Crisis Inesperada activa.'
    },
    color: '#10B981', // Esmeralda
    accentColor: '#047857'
  },
  {
    id: 'whina',
    name: 'Whina',
    bio: 'Soy profesora en un colegio público e investigadora sobre causas indígenas.',
    identityTag: 'Mujer polinesia heterosexual de clase media · Con ciudadanía',
    hasCitizenship: true,
    socialClass: 'MEDIA',
    skills: {
      care: 4,
      occupy: 1,
      share: 3,
      regenerate: 4
    },
    uniqueBonus: {
      id: 'ancestral_stewardship',
      title: 'Sabiduría Ancestral',
      shortLabel: '-1 coste Medioambiente · +1 Legitimidad en Salud/Entorno',
      description:
        'Reduce en 1 punto adicional el coste de Bienes Medioambientales y suma +1 Legitimidad extra al comunizar Bienes de Salud o Medioambiente.',
      goodType: 'ENVIRONMENT'
    },
    color: '#14B8A6', // Turquesa
    accentColor: '#0F766E'
  },
  {
    id: 'yayo',
    name: 'Yayo',
    bio: 'Soy profesora universitaria. Escribo y hablo públicamente sobre ecofeminismo.',
    identityTag: 'Mujer blanca heterosexual de clase media · Con ciudadanía',
    hasCitizenship: true,
    socialClass: 'MEDIA',
    skills: {
      care: 1,
      occupy: 2,
      share: 3,
      regenerate: 6   // Medioambiental (Regenerar)
    },
    uniqueBonus: {
      id: 'ecofeminist_economy',
      title: 'Economía Ecofeminista',
      shortLabel: '-1 coste Medioambiente · +1 Bienestar al comunizar entorno',
      description:
        'Reduce en 1 punto adicional el coste de Bienes Medioambientales y recupera +1 Bienestar vital al convertir cualquier casilla ambiental en Bien Común.',
      goodType: 'ENVIRONMENT'
    },
    color: '#059669', // Verde oscuro ecologista
    accentColor: '#065F46'
  }
];

export function getCharacterUniqueBonus(charId: string): CharacterUniqueBonus | undefined {
  return OFFICIAL_CHARACTERS.find(c => c.id === charId)?.uniqueBonus;
}

export function createInitialCharacter(base: typeof OFFICIAL_CHARACTERS[0], controller: 'HUMAN' | 'BOT'): Character {
  return {
    ...base,
    wellness: 5,
    legitimacy: 5,
    position: 0, // Casilla de SALIDA
    isDetained: false,
    detentionRoundsLeft: 0,
    inAgora: false,
    roundsInAgora: 0,
    controller,
    neighborhoodReputation: 0,
    reputationHistory: []
  };
}

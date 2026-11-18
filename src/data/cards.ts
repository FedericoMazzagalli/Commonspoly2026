/**
 * Cartas Globales y Cartas de Situación de Commonspoly
 */

import { GlobalCard, SituationCard } from '../types/game';

export const GLOBAL_CARDS: GlobalCard[] = [
  {
    id: 'g_clima',
    title: 'Ola de Calor Extremo y Refugios Climáticos',
    quote: '"El planeta no se vende, se defiende."',
    description: 'Una ola de calor sin precedentes azota la metrópoli. Los bienes medioambientales comunes protegen a la población; todos los personajes reciben +1 Punto de Bienestar si hay al menos 3 bienes medioambientales comunes.',
    effect: (state) => {
      const greenCommons = state.tiles.filter(t => t.goodType === 'ENVIRONMENT' && t.state === 'COMMON').length;
      if (greenCommons >= 3) {
        state.players.forEach(p => p.wellness += 1);
        return { message: '¡Gracias a los refugios verdes comunes, cada personaje gana +1 Punto de Bienestar!' };
      }
      return { message: 'El calor arrecia pero no hay suficientes espacios verdes comunes consolidados aún.' };
    }
  },
  {
    id: 'g_huelga_cuidados',
    title: 'Huelga General de Cuidados',
    quote: '"Si las que cuidan paran, el mundo se cae."',
    description: 'Las trabajadoras del hogar y colectivos feministas ocupan las plazas. Toda la comunidad reflexiona sobre el valor reproductivo de la vida. Todos los personajes ganan +2 Puntos de Legitimidad.',
    effect: (state) => {
      state.players.forEach(p => p.legitimacy += 2);
      return { message: '¡La huelga de cuidados une los lazos colectivos! Cada personaje recibe +2 Puntos de Legitimidad.' };
    }
  },
  {
    id: 'g_fondos_buitre',
    title: 'Ofensiva de Fondos Buitre Inmobiliarios',
    quote: '"La vivienda es un derecho, no una mercancía."',
    description: 'Presión especulativa internacional sobre el mercado del alquiler. Cada personaje con menos de 4 Puntos de Bienestar debe perder 1 Punto de Bienestar por el encarecimiento de la vida.',
    effect: (state) => {
      let affected = 0;
      state.players.forEach(p => {
        if (p.wellness < 4 && p.wellness > 1) {
          p.wellness -= 1;
          affected++;
        }
      });
      return { message: `La escalada del coste de vida golpea a los más vulnerables (${affected} personajes pierden 1 Bienestar).` };
    }
  },
  {
    id: 'g_ciencia_abierta',
    title: 'Pacto por la Ciencia Abierta y las Vacunas Libres',
    quote: '"El conocimiento humano pertenece a la humanidad."',
    description: 'Científicos rebeldes liberan patentes médicas cruciales. Si existen al menos 2 bienes del conocimiento convertidos a Comunes, todos los personajes recuperan +1 Punto de Bienestar.',
    effect: (state) => {
      const knowCommons = state.tiles.filter(t => t.goodType === 'KNOWLEDGE' && t.state === 'COMMON').length;
      if (knowCommons >= 2) {
        state.players.forEach(p => p.wellness += 1);
        return { message: '¡La liberación de patentes médicas alivia a toda la población! Todos ganan +1 Bienestar.' };
      }
      return { message: 'El conocimiento sigue en manos privadas y corporativas; no se activó la mejora.' };
    }
  },
  {
    id: 'g_asamblea_barrial',
    title: 'Asamblea Popular Descentralizada',
    quote: '"De abajo hacia arriba, entre todas."',
    description: 'Los barrios se autogestionan para coordinar despensas solidarias y redes de apoyo mutuo. Todos los personajes ganan +1 Punto de Legitimidad y +1 Punto de Bienestar.',
    effect: (state) => {
      state.players.forEach(p => {
        p.legitimacy += 1;
        p.wellness += 1;
      });
      return { message: '¡La asamblea barrial fortalece el tejido comunitario! Todos ganan +1 Bienestar y +1 Legitimidad.' };
    }
  },
  {
    id: 'g_inflacion',
    title: 'Crisis Energética e Inflación Especulativa',
    quote: '"Los beneficios caen en paraísos fiscales mientras la factura sube."',
    description: 'Las corporaciones eléctricas aumentan sus tarifas. Todos los personajes pierden 1 Punto de Bienestar, a menos que el personaje esté en una casilla de Bien Común.',
    effect: (state) => {
      let count = 0;
      state.players.forEach(p => {
        const currentTile = state.tiles.find(t => t.id === p.position);
        if (currentTile?.state !== 'COMMON' && currentTile?.category !== 'INALIENABLE_COMMON') {
          p.wellness = Math.max(1, p.wellness - 1);
          count++;
        }
      });
      return { message: `Facturas desorbitadas: ${count} personajes desprotegidos fuera de bienes comunes pierden 1 Bienestar.` };
    }
  },
  {
    id: 'g_red_solidaridad',
    title: 'Red Federal de Soberanía Alimentaria',
    quote: '"Comer es un acto político."',
    description: 'Campesinos agroecológicos distribuyen canastas frescas a precios justos en centros sociales. Todos los personajes en el juego suman +1 Punto de Bienestar.',
    effect: (state) => {
      state.players.forEach(p => p.wellness += 1);
      return { message: '¡Canastas agroecológicas frescas para todo el mundo! Cada personaje suma +1 Bienestar.' };
    }
  }
];

export const SITUATION_CARDS: SituationCard[] = [
  {
    id: 'sit_taller_reparacion',
    title: 'Taller Popular de Auto-reparación',
    description: 'Encuentras un colectivo que enseña a reparar bicicletas y electrodomésticos.',
    impactText: 'Ganas +2 Puntos de Bienestar y +1 Punto de Legitimidad.',
    apply: (char) => {
      return {
        charUpdates: {
          wellness: char.wellness + 2,
          legitimacy: char.legitimacy + 1
        },
        message: `${char.name} aprendió a reparar sus herramientas de forma autónoma (+2 Bienestar, +1 Legitimidad).`
      };
    }
  },
  {
    id: 'sit_redada',
    title: 'Control Policial y Perfilamiento Racial',
    description: 'Agentes realizan identificaciones aleatorias en el transporte público.',
    impactText: 'Si no tienes ciudadanía, pierdes 2 Puntos de Bienestar por el hostigamiento; si tienes ciudadanía, ganas +1 Legitimidad por interponerte.',
    apply: (char) => {
      if (!char.hasCitizenship) {
        return {
          charUpdates: { wellness: Math.max(1, char.wellness - 2) },
          message: `${char.name} sufrió el hostigamiento del control migratorio (-2 Bienestar).`
        };
      } else {
        return {
          charUpdates: { legitimacy: char.legitimacy + 1 },
          message: `${char.name} apoyó como testigo solidario frenando la violencia institucional (+1 Legitimidad).`
        };
      }
    }
  },
  {
    id: 'sit_caja_resistencia',
    title: 'Aporte a la Caja de Resistencia',
    description: 'Una huelga vecinal necesita apoyo financiero para mantenerse firme.',
    impactText: 'Decides donar 1 Punto de Bienestar a la caja colectiva y ganas +2 Puntos de Legitimidad.',
    apply: (char) => {
      const wellCost = Math.min(1, Math.max(0, char.wellness - 1));
      return {
        charUpdates: {
          wellness: char.wellness - wellCost,
          legitimacy: char.legitimacy + 2
        },
        message: `${char.name} donó a la caja de resistencia comunitaria (-1 Bienestar, +2 Legitimidad).`
      };
    }
  },
  {
    id: 'sit_desalojo_frenado',
    title: 'Stop Desahucios en el Barrio',
    description: 'Cientos de personas se sientan en el portal impidiendo la expulsión de una familia trabajadora.',
    impactText: 'Ganas +3 Puntos de Legitimidad gracias a la victoria popular.',
    apply: (char) => {
      return {
        charUpdates: { legitimacy: char.legitimacy + 3 },
        message: `¡Desahucio paralizado en el portal! ${char.name} refuerza la moral de lucha (+3 Legitimidad).`
      };
    }
  },
  {
    id: 'sit_agotamiento',
    title: 'Síndrome de Burnout Militante',
    description: 'El exceso de reuniones y la sobrecarga de tareas te pasan factura.',
    impactText: 'Debes descansar: Pierdes 2 Puntos de Bienestar pero ganas la empatía de tus compañeras.',
    apply: (char) => {
      return {
        charUpdates: { wellness: Math.max(1, char.wellness - 2) },
        message: `${char.name} necesita frenar y recibir cuidados (-2 Bienestar).`
      };
    }
  },
  {
    id: 'sit_server_comunitario',
    title: 'Nodo de Servidor Autónomo Comunitario',
    description: 'Configuras un nodo en una red mesh barrial para compartir conocimiento libre.',
    impactText: 'Ganas +2 Puntos de Legitimidad.',
    apply: (char) => {
      return {
        charUpdates: { legitimacy: char.legitimacy + 2 },
        message: `${char.name} desplegó infraestructura digital soberana (+2 Legitimidad).`
      };
    }
  }
];

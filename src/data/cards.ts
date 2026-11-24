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
  },
  {
    id: 'g_auditoria_deuda',
    title: 'Auditoría Ciudadana de la Deuda Ilegítima',
    quote: '"No debemos, no pagamos; lo público no se rescata en la sombra."',
    description: 'Una plataforma vecinal audita contratos públicos abusivos. Si hay al menos 6 bienes Públicos o Comunes, cada personaje gana +2 de Legitimidad.',
    effect: (state) => {
      const protectedGoods = state.tiles.filter(
        t => (t.category === 'RESOURCE' || t.category === 'AGORA_ENTRY') && (t.state === 'PUBLIC' || t.state === 'COMMON')
      ).length;
      if (protectedGoods >= 6) {
        state.players.forEach(p => p.legitimacy += 2);
        return { message: `¡Auditoría exitosa (${protectedGoods} bienes protegidos)! Toda la mesa gana +2 Legitimidad.` };
      }
      return { message: 'La opacidad financiera frena la auditoría: aún faltan bienes públicos o comunes.' };
    }
  },
  {
    id: 'g_agua_comun',
    title: 'Remunicipalización y Gestión Comunitaria del Agua',
    quote: '"El agua es vida y no un dividendo bursátil."',
    description: 'Las juntas vecinales recuperan el ciclo del agua. Los personajes con menos de 5 Puntos de Bienestar recuperan +2 Puntos de Bienestar.',
    effect: (state) => {
      let boosted = 0;
      state.players.forEach(p => {
        if (p.wellness < 5) {
          p.wellness += 2;
          boosted++;
        }
      });
      return {
        message: boosted > 0
          ? `¡Agua común para todas! ${boosted} personajes vulnerables recuperan +2 Bienestar.`
          : 'Todas las jugadoras ya cuentan con hidratación y bienestar estable.'
      };
    }
  },
  {
    id: 'g_soberania_tecnologica',
    title: 'Cumbre de Software Libre y Redes Mesh',
    quote: '"Código abierto, infraestructuras en manos de quienes las habitan."',
    description: 'Hacklabs y bibliotecas despliegan redes libres sin rastreo corporativo. Quienes posean habilidad Compartir ≥ 4 suman +2 de Legitimidad.',
    effect: (state) => {
      let count = 0;
      state.players.forEach(p => {
        if (p.skills.share >= 4) {
          p.legitimacy += 2;
          count++;
        }
      });
      return { message: `Redes federadas activas: ${count} referentes del conocimiento ganan +2 Legitimidad.` };
    }
  },
  {
    id: 'g_derecho_ciudad',
    title: 'Sindicatos de Inquilinas en Acción',
    quote: '"Las casas para vivirlas, no para especular."',
    description: 'Los bloques en lucha frenan subidas abusivas. Si existen al menos 2 bienes Urbanos Comunes, todos los personajes suman +1 Bienestar y +1 Legitimidad.',
    effect: (state) => {
      const urbanCommons = state.tiles.filter(t => t.goodType === 'URBAN' && t.state === 'COMMON').length;
      if (urbanCommons >= 2) {
        state.players.forEach(p => {
          p.wellness += 1;
          p.legitimacy += 1;
        });
        return { message: '¡Victoria vecinal contra la gentrificación! Todos ganan +1 Bienestar y +1 Legitimidad.' };
      }
      return { message: 'El mercado inmobiliario sigue tenso; consolidar bienes urbanos comunes desbloqueará fuerza.' };
    }
  },
  {
    id: 'g_semillas_libres',
    title: 'Banco Abierto de Semillas Autóctonas',
    quote: '"Ninguna corporación debe patentar la base de la vida."',
    description: 'Huertos urbanos y granjas intercambian variedades libres. Todos los personajes con Regenerar ≥ 3 ganan +2 Bienestar.',
    effect: (state) => {
      let count = 0;
      state.players.forEach(p => {
        if (p.skills.regenerate >= 3) {
          p.wellness += 2;
          count++;
        }
      });
      return { message: `Cosecha comunitaria compartida: ${count} personajes ganan +2 Bienestar.` };
    }
  },
  {
    id: 'g_turismo_depredador',
    title: 'Presión de Plataformas Turísticas',
    quote: '"Cuando el barrio se convierte en escaparate, se vacía de vecinas."',
    description: 'Los especuladores se acercan al corazón urbano. Si hay más bienes Urbanos Privados que Comunes, cada personaje pierde 1 de Legitimidad.',
    effect: (state) => {
      const urbanPriv = state.tiles.filter(t => t.goodType === 'URBAN' && t.state === 'PRIVATE').length;
      const urbanCom = state.tiles.filter(t => t.goodType === 'URBAN' && t.state === 'COMMON').length;
      if (urbanPriv > urbanCom) {
        state.players.forEach(p => {
          p.legitimacy = Math.max(0, p.legitimacy - 1);
        });
        return { message: 'La turistificación vacía los barrios: cada personaje pierde 1 Punto de Legitimidad.' };
      }
      return { message: 'El vecindario organizado frena los pisos turísticos ilegales sin pérdidas.' };
    }
  },
  {
    id: 'g_transicion_energetica',
    title: 'Comunidades Energéticas Solares',
    quote: '"El sol es de todas, el kilovatio comunitario también."',
    description: 'Tejados cooperativos vierten energía limpia al barrio. Todos los personajes ganan +1 Punto de Bienestar.',
    effect: (state) => {
      state.players.forEach(p => p.wellness += 1);
      return { message: 'Autoconsumo compartido en marcha: cada personaje recibe +1 Punto de Bienestar.' };
    }
  },
  {
    id: 'g_renta_basica',
    title: 'Ensayo Piloto de Renta Básica Universal',
    quote: '"Garantizar la existencia libera tiempo para lo común."',
    description: 'El apoyo incondicional reduce la precariedad. Todos los personajes con menos de 6 de Bienestar suben +2 Puntos de Bienestar.',
    effect: (state) => {
      let beneficiaries = 0;
      state.players.forEach(p => {
        if (p.wellness < 6) {
          p.wellness += 2;
          beneficiaries++;
        }
      });
      return { message: `Piso digno garantizado: ${beneficiaries} personajes reciben +2 Bienestar.` };
    }
  },
  {
    id: 'g_banco_tiempo',
    title: 'Red Metropolitana de Bancos del Tiempo',
    quote: '"Una hora de tu cuidado vale lo mismo que una hora del mío."',
    description: 'El intercambio solidario de saberes y cuidados iguala posiciones. Toda la mesa suma +1 Bienestar y +1 Legitimidad.',
    effect: (state) => {
      state.players.forEach(p => {
        p.wellness += 1;
        p.legitimacy += 1;
      });
      return { message: '¡Intercambio recíproco en los barrios! Cada personaje gana +1 Bienestar y +1 Legitimidad.' };
    }
  },
  {
    id: 'g_patentes_salud',
    title: 'Recortes y Copagos en la Sanidad Mercantilizada',
    quote: '"Con la salud no se hace caja."',
    description: 'Clínicas privadas endurecen tarifas. Quienes tengan Cuidar < 4 pierden 1 de Bienestar salvo estar en una casilla Común o Inalienable.',
    effect: (state) => {
      let hit = 0;
      state.players.forEach(p => {
        const tile = state.tiles.find(t => t.id === p.position);
        const safe = tile?.state === 'COMMON' || tile?.category === 'INALIENABLE_COMMON';
        if (!safe && p.skills.care < 4 && p.wellness > 1) {
          p.wellness -= 1;
          hit++;
        }
      });
      return { message: `Copago sanitario regresivo: ${hit} personajes pierden 1 Punto de Bienestar.` };
    }
  },
  {
    id: 'g_educacion_popular',
    title: 'Universidades Populares en las Plazas',
    quote: '"Nadie educa a nadie; nos educamos en comunidad."',
    description: 'Talleres abiertos de pensamiento crítico y ecología política. Todos los personajes suman +2 Puntos de Legitimidad.',
    effect: (state) => {
      state.players.forEach(p => p.legitimacy += 2);
      return { message: '¡Debate colectivo vibrante! Todos los personajes obtienen +2 Puntos de Legitimidad.' };
    }
  },
  {
    id: 'g_movilidad_sostenible',
    title: 'Día Sin Coches y Transporte Gratuito',
    quote: '"Recuperar las calles es recuperar el encuentro."',
    description: 'Carriles bici y tranvías gratuitos conectan todos los distritos. Todos los personajes que no estén detenidos ganan +1 Bienestar.',
    effect: (state) => {
      let moved = 0;
      state.players.forEach(p => {
        if (!p.isDetained) {
          p.wellness += 1;
          moved++;
        }
      });
      return { message: `Ciudad respirable: ${moved} personajes activos ganan +1 Punto de Bienestar.` };
    }
  },
  {
    id: 'g_fondo_resiliencia',
    title: 'Caja Común Frente al Acoso Especulativo',
    quote: '"Si tocan a una, respondemos todas."',
    description: 'Si alguna jugadora está detenida o con Bienestar ≤ 2, el resto dona 1 de Legitimidad virtual generando +2 Bienestar de rescate inmediato.',
    effect: (state) => {
      const vulnerable = state.players.filter(p => p.isDetained || p.wellness <= 2);
      if (vulnerable.length > 0) {
        vulnerable.forEach(p => {
          p.wellness += 2;
        });
        return { message: `Apoyo mutuo de emergencia activado para ${vulnerable.length} compañeras vulnerables (+2 Bienestar).` };
      }
      state.players.forEach(p => p.legitimacy += 1);
      return { message: 'La caja común refuerza la cohesión preventiva (+1 Legitimidad para todas).' };
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
  },
  {
    id: 'sit_asamblea_inquilinas',
    title: 'Asamblea de Bloque en Huelga de Alquileres',
    description: 'Organizas a tus vecinas para negociar de forma colectiva frente al gran tenedor.',
    impactText: 'Ganas +2 Legitimidad y +1 Bienestar por la seguridad habitacional.',
    apply: (char) => ({
      charUpdates: {
        legitimacy: char.legitimacy + 2,
        wellness: char.wellness + 1
      },
      message: `${char.name} articula la asamblea de bloque (+1 Bienestar, +2 Legitimidad).`
    })
  },
  {
    id: 'sit_huerta_escolar',
    title: 'Bancales Agroecológicos en el Patio Escolar',
    description: 'Colaboras en la siembra comunitaria de otoño junto al profesorado y familias.',
    impactText: 'Ganas +2 Puntos de Bienestar.',
    apply: (char) => ({
      charUpdates: { wellness: char.wellness + 2 },
      message: `${char.name} cosecha verduras frescas en la huerta escolar (+2 Bienestar).`
    })
  },
  {
    id: 'sit_multa_protesta',
    title: 'Sanción Administrativa por Protesta Pacífica',
    description: 'La ley mordaza golpea una acción visible en defensa de un espacio verde.',
    impactText: 'Pierdes 1 Punto de Bienestar en trámites legales, pero ganas +2 Legitimidad.',
    apply: (char) => ({
      charUpdates: {
        wellness: Math.max(1, char.wellness - 1),
        legitimacy: char.legitimacy + 2
      },
      message: `${char.name} afronta una multa solidaria (-1 Bienestar, +2 Legitimidad).`
    })
  },
  {
    id: 'sit_radio_libre',
    title: 'Programa Nocturno en la Radio Libre Barrial',
    description: 'Difundes las campañas de recuperación de bienes comunes por FM comunitaria.',
    impactText: 'Ganas +2 Puntos de Legitimidad y +1 Punto de Bienestar.',
    apply: (char) => ({
      charUpdates: {
        legitimacy: char.legitimacy + 2,
        wellness: char.wellness + 1
      },
      message: `${char.name} amplifica la voz del barrio en radio libre (+1 Bienestar, +2 Legitimidad).`
    })
  },
  {
    id: 'sit_cuidados_compartidos',
    title: 'Grupo de Crianza y Cuidados Rotativos',
    description: 'Varias familias comparten tardes de cuidado mutuo para liberar tiempo de vida.',
    impactText: 'Recuperas +3 Puntos de Bienestar.',
    apply: (char) => ({
      charUpdates: { wellness: char.wellness + 3 },
      message: `${char.name} disfruta de tiempo liberado gracias a los cuidados compartidos (+3 Bienestar).`
    })
  },
  {
    id: 'sit_especulacion_alquiler',
    title: 'Subida Repentina de Suministros y Vivienda',
    description: 'El propietario exige una actualización abusiva al terminar el contrato.',
    impactText: 'Si eres clase BAJA pierdes 2 Bienestar; si no, pierdes 1 Bienestar.',
    apply: (char) => {
      const loss = char.socialClass === 'BAJA' ? 2 : 1;
      return {
        charUpdates: { wellness: Math.max(1, char.wellness - loss) },
        message: `${char.name} soporta el encarecimiento especulativo (-${loss} Bienestar).`
      };
    }
  },
  {
    id: 'sit_comedor_popular',
    title: 'Comedor Popular de Cocina Colectiva',
    description: 'Preparamos ollas comunitarias aprovechando excedentes de mercados locales.',
    impactText: 'Ganas +2 Bienestar y +1 Legitimidad.',
    apply: (char) => ({
      charUpdates: {
        wellness: char.wellness + 2,
        legitimacy: char.legitimacy + 1
      },
      message: `${char.name} comparte mesa en el comedor popular (+2 Bienestar, +1 Legitimidad).`
    })
  },
  {
    id: 'sit_bici_taller',
    title: 'Bicicrítica y Talleres de Movilidad',
    description: 'Pedaleas en masa reivindicando carriles seguros en las avenidas.',
    impactText: 'Ganas +1 Bienestar y +2 Legitimidad.',
    apply: (char) => ({
      charUpdates: {
        wellness: char.wellness + 1,
        legitimacy: char.legitimacy + 2
      },
      message: `${char.name} toma la calle en bici (+1 Bienestar, +2 Legitimidad).`
    })
  },
  {
    id: 'sit_brecha_digital',
    title: 'Licencias Propietarias y Brecha Digital',
    description: 'Una plataforma educativa impone suscripciones obligatorias y bloquea el acceso libre.',
    impactText: 'Pierdes 1 Punto de Legitimidad si Compartir < 4; en caso contrario ganas +1 Legitimidad liberando apuntes.',
    apply: (char) => {
      if (char.skills.share >= 4) {
        return {
          charUpdates: { legitimacy: char.legitimacy + 1 },
          message: `${char.name} sortea el muro de pago con recursos abiertos (+1 Legitimidad).`
        };
      }
      return {
        charUpdates: { legitimacy: Math.max(0, char.legitimacy - 1) },
        message: `${char.name} queda excluida por licencias cerradas (-1 Legitimidad).`
      };
    }
  },
  {
    id: 'sit_apoyo_mutuo',
    title: 'Despensa Solidaria de Emergencia',
    description: 'Distribuyes cestas de productos básicos entre hogares golpeados por el desempleo.',
    impactText: 'Ganas +2 Legitimidad por el vínculo construido.',
    apply: (char) => ({
      charUpdates: { legitimacy: char.legitimacy + 2 },
      message: `${char.name} refuerza la despensa solidaria (+2 Legitimidad).`
    })
  },
  {
    id: 'sit_reconversion_solar',
    title: 'Instalación de Placas Solares Vecinales',
    description: 'Ayudas a montar una micro-red fotovoltaica en la azotea del centro social.',
    impactText: 'Ganas +2 Bienestar y +1 Legitimidad.',
    apply: (char) => ({
      charUpdates: {
        wellness: char.wellness + 2,
        legitimacy: char.legitimacy + 1
      },
      message: `${char.name} conecta energía limpia vecinal (+2 Bienestar, +1 Legitimidad).`
    })
  },
  {
    id: 'sit_guarderia_comunitaria',
    title: 'Escuelita Popular Autogestionada',
    description: 'Vecinas y pedagogas abren un espacio infantil gratuito y multilingüe.',
    impactText: 'Ganas +2 Bienestar y +2 Legitimidad.',
    apply: (char) => ({
      charUpdates: {
        wellness: char.wellness + 2,
        legitimacy: char.legitimacy + 2
      },
      message: `${char.name} impulsa la escuelita comunitaria (+2 Bienestar, +2 Legitimidad).`
    })
  },
  {
    id: 'sit_corte_suministro',
    title: 'Corte de Suministro Eléctrico por Pobreza Energética',
    description: 'Una comercializadora corta la luz sin previo aviso durante la ola de frío.',
    impactText: 'Pierdes 2 Puntos de Bienestar afrontando la emergencia.',
    apply: (char) => ({
      charUpdates: { wellness: Math.max(1, char.wellness - 2) },
      message: `${char.name} resiste un corte de suministro injusto (-2 Bienestar).`
    })
  },
  {
    id: 'sit_archivo_memoria',
    title: 'Digitalización del Archivo Vivo del Barrio',
    description: 'Recopilas fotografías, actas y testimonios de luchas históricas locales.',
    impactText: 'Ganas +2 Legitimidad preservando la memoria común.',
    apply: (char) => ({
      charUpdates: { legitimacy: char.legitimacy + 2 },
      message: `${char.name} documenta la memoria vecinal en dominio público (+2 Legitimidad).`
    })
  },
  {
    id: 'sit_banco_herramientas',
    title: 'Biblioteca de Cosas y Banco de Herramientas',
    description: 'En lugar de comprar taladros individuales, el barrio comparte un inventario común.',
    impactText: 'Ganas +2 Bienestar y +1 Legitimidad.',
    apply: (char) => ({
      charUpdates: {
        wellness: char.wellness + 2,
        legitimacy: char.legitimacy + 1
      },
      message: `${char.name} estrena la biblioteca de herramientas (+2 Bienestar, +1 Legitimidad).`
    })
  },
  {
    id: 'sit_defensa_costa',
    title: 'Limpieza Comunitaria de Litoral y Humedales',
    description: 'Voluntariado ecológico retira plásticos y restaura dunas frente a un resort privado.',
    impactText: 'Ganas +1 Bienestar y +2 Legitimidad.',
    apply: (char) => ({
      charUpdates: {
        wellness: char.wellness + 1,
        legitimacy: char.legitimacy + 2
      },
      message: `${char.name} defiende el litoral común (+1 Bienestar, +2 Legitimidad).`
    })
  },
  {
    id: 'sit_medicina_integrativa',
    title: 'Clínica Comunitaria de Salud Mental y Cuidados',
    description: 'Grupos de escucha mutua atenúan la ansiedad cotidiana sin medicalización mercantil.',
    impactText: 'Recuperas +3 Puntos de Bienestar.',
    apply: (char) => ({
      charUpdates: { wellness: char.wellness + 3 },
      message: `${char.name} recibe sostén psicosocial colectivo (+3 Bienestar).`
    })
  },
  {
    id: 'sit_consulta_ciudadana',
    title: 'Consulta Popular sobre Presupuestos Participativos',
    description: 'Movilizas a cientos de vecinas para votar inversión directa en bienes públicos.',
    impactText: 'Ganas +3 Puntos de Legitimidad.',
    apply: (char) => ({
      charUpdates: { legitimacy: char.legitimacy + 3 },
      message: `${char.name} lidera la consulta participativa (+3 Legitimidad).`
    })
  }
];

export function createShuffledCardIds<T extends { id: string }>(
  cards: T[],
  rand: () => number
): string[] {
  const ids = cards.map(c => c.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = ids[i];
    ids[i] = ids[j];
    ids[j] = tmp;
  }
  return ids;
}

export function drawCardFromQueue<T extends { id: string }>(
  cards: T[],
  queueIds: string[] | undefined,
  cursor: number | undefined,
  rand: () => number
): { card: T; nextQueueIds: string[]; nextCursor: number } {
  const validIds = new Set(cards.map(c => c.id));
  let activeQueue =
    queueIds && queueIds.length === cards.length && queueIds.every(id => validIds.has(id))
      ? [...queueIds]
      : createShuffledCardIds(cards, rand);
  let activeCursor = typeof cursor === 'number' && cursor >= 0 ? cursor : 0;

  if (activeCursor >= activeQueue.length) {
    activeQueue = createShuffledCardIds(cards, rand);
    activeCursor = 0;
  }

  const pickedId = activeQueue[activeCursor];
  const card = cards.find(c => c.id === pickedId) || cards[0];
  return {
    card,
    nextQueueIds: activeQueue,
    nextCursor: activeCursor + 1
  };
}

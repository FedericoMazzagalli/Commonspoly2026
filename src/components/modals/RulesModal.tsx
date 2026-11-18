/**
 * RulesModal.tsx
 * Manual interactivo de reglas, glosario e historia de Commonspoly (Edición Verde)
 */

import React, { useState } from 'react';
import { BookOpen, X, Shield, Dices, Users, HeartHandshake, History, Award } from 'lucide-react';

interface RulesModalProps {
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ onClose }) => {
  const [tab, setTab] = useState<'RULES' | 'COMMONS' | 'SPECULATORS' | 'HISTORY'>('RULES');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-3xl bg-slate-900 border border-teal-800 rounded-2xl shadow-2xl p-6 text-slate-100 my-auto flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-teal-400" />
            <h3 className="font-extrabold text-xl text-white">Guía Oficial de Juego · Commonspoly</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 py-3 border-b border-slate-800 text-xs font-semibold overflow-x-auto shrink-0">
          <button
            onClick={() => setTab('RULES')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              tab === 'RULES' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Mecánicas y Victoria
          </button>
          <button
            onClick={() => setTab('COMMONS')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              tab === 'COMMONS' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Desbloqueo de Bienes
          </button>
          <button
            onClick={() => setTab('SPECULATORS')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              tab === 'SPECULATORS' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Los Especuladores
          </button>
          <button
            onClick={() => setTab('HISTORY')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              tab === 'HISTORY' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Historia del Juego (1904-2020)
          </button>
        </div>

        {/* Tab Content */}
        <div className="py-4 overflow-y-auto space-y-4 text-sm text-slate-300 leading-relaxed pr-1 flex-1">
          {tab === 'RULES' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-white mb-1 flex items-center gap-2">
                  <Award className="w-4 h-4 text-teal-400" />
                  Condiciones de Fin de Partida (20 Rondas)
                </h4>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><strong className="text-emerald-400">Victoria</strong>: Todos los bienes del tablero se han convertido en Bienes Comunes.</li>
                  <li><strong className="text-sky-400">Empate</strong>: Al terminar la ronda 20, coexisten Bienes Públicos y Comunes sin ningún Bien Privado.</li>
                  <li><strong className="text-rose-400">Derrota</strong>: Queda al menos 1 Bien Privado en el tablero al expirar las 20 rondas.</li>
                </ul>
              </div>

              <div className="space-y-2 text-xs">
                <p><strong>Máximo 2 fichas por casilla:</strong> En cualquier momento solo puede haber hasta 2 fichas por casilla (personajes o especuladores). Si una tercera ficha intenta entrar, se genera un rebote por los pasos sobrantes.</p>
                <p><strong>Protección mutua:</strong> Si hay 2 personajes juntos en la misma casilla, los Especuladores no pueden acceder ni atacar esa casilla.</p>
                <p><strong>Cartas Globales:</strong> A partir de la ronda 2, el Máster lee una Carta Global antes del inicio de la ronda que afecta colectivamente a toda la sociedad.</p>
              </div>
            </div>
          )}

          {tab === 'COMMONS' && (
            <div className="space-y-4 text-xs">
              <p>Cada Personaje posee Puntos de Habilidad inmutables (1 a 6) para cada categoría de bien:</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="p-2.5 rounded bg-purple-950/40 border border-purple-800/40">
                  <div className="font-bold text-purple-300">Cuidar</div>
                  <div>Bienes de Salud</div>
                </div>
                <div className="p-2.5 rounded bg-orange-950/40 border border-orange-800/40">
                  <div className="font-bold text-orange-300">Ocupar</div>
                  <div>Bienes Urbanos</div>
                </div>
                <div className="p-2.5 rounded bg-yellow-950/40 border border-yellow-800/40">
                  <div className="font-bold text-yellow-300">Compartir</div>
                  <div>Conocimiento</div>
                </div>
                <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800/40">
                  <div className="font-bold text-emerald-300">Regenerar</div>
                  <div>Medioambientales</div>
                </div>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                <h5 className="font-bold text-white">Regla de los 10 Puntos de Desbloqueo:</h5>
                <p>Para desprivatizar un bien (Privado $\rightarrow$ Público o Público $\rightarrow$ Común) necesitas sumar <strong>10 Puntos</strong> combinando tu Habilidad correspondiente y tus Puntos de Bienestar disponibles.</p>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                <h5 className="font-bold text-white">Ágora Central & Insurrección Colectiva:</h5>
                <p>Cuando el grupo reúne <strong>10 Puntos de Legitimidad por persona</strong>, pueden acceder al centro a través de las 4 columnas. ¡Al entrar 3 personajes, toda la ciudadanía se une y desprivatiza una categoría entera a Común!</p>
              </div>
            </div>
          )}

          {tab === 'SPECULATORS' && (
            <div className="space-y-3 text-xs">
              <p>Los Especuladores representan las fuerzas neoliberales y se mueven siempre al final de cada ronda:</p>
              <ul className="list-disc list-inside space-y-1.5">
                <li><strong>Quitar Puntos:</strong> Tiran el dado y sustraen esa cantidad de Puntos de Bienestar o Legitimidad.</li>
                <li><strong>Centro de Detención:</strong> Envían al personaje a prisión entre 1 y 6 rondas. Sus compañeras pueden pagar una fianza solidaria (1 pt de bienestar por ronda si tiene ciudadanía/clase media-alta, 2 pts por ronda si es sin ciudadanía/clase baja).</li>
                <li><strong>Tragedia de los Comunes:</strong> Si el especulador saca doble, privatiza de inmediato 3 bienes comunes.</li>
              </ul>
            </div>
          )}

          {tab === 'HISTORY' && (
            <div className="space-y-3 text-xs">
              <p>En <strong>1904</strong>, Elizabeth Magie patentó <em>The Landlord&apos;s Game</em> para advertir sobre los monopolios. Décadas después, Parker Brothers compró la patente y distorsionó su espíritu, creando el Monopoly contemporáneo enfocado en la acumulación salvaje y la bancarrota ajena.</p>
              <p>En <strong>2015</strong>, en el Hackcamp <em>Reclaim the Commons</em> durante el Festival ZEMOS98 (Sevilla), un grupo activista y cultural hackeó el tablero y alumbró Commonspoly para celebrar la cooperación y los bienes comunes.</p>
              <p>En <strong>2020</strong> nació la <strong>Edición Verde (versión 4.0)</strong>, con licencia Peer Production, replicable y de código abierto.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs"
          >
            Entendido
          </button>
        </div>

      </div>
    </div>
  );
};

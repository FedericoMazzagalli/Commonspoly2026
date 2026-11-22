/**
 * RulesModal.tsx
 * Manual interactivo de reglas, glosario e historia de Commonspoly (Edición Verde)
 */

import React, { useState } from 'react';
import { BookOpen, X, Shield, Dices, Users, HeartHandshake, History, Award } from 'lucide-react';
import { useI18n } from '../../i18n';

interface RulesModalProps {
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ onClose }) => {
  const { t } = useI18n();
  const [tab, setTab] = useState<'RULES' | 'COMMONS' | 'SPECULATORS' | 'HISTORY'>('RULES');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/88 overflow-y-auto">
      <div className="w-full max-w-3xl bg-slate-900 border border-teal-800 rounded-2xl shadow-2xl p-6 text-slate-100 my-auto flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-teal-400" />
            <h3 className="font-extrabold text-xl text-white">{t.rules.title}</h3>
          </div>
          <button
            onClick={onClose}
            aria-label={t.common.close}
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
            {t.rules.tabRules}
          </button>
          <button
            onClick={() => setTab('COMMONS')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              tab === 'COMMONS' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.rules.tabCommons}
          </button>
          <button
            onClick={() => setTab('SPECULATORS')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              tab === 'SPECULATORS' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.rules.tabSpeculators}
          </button>
          <button
            onClick={() => setTab('HISTORY')}
            className={`px-3 py-1.5 rounded-lg whitespace-nowrap transition-colors ${
              tab === 'HISTORY' ? 'bg-teal-600 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.rules.tabHistory}
          </button>
        </div>

        {/* Tab Content */}
        <div className="py-4 overflow-y-auto space-y-4 text-sm text-slate-300 leading-relaxed pr-1 flex-1">
          {tab === 'RULES' && (
            <div className="space-y-4">
              <div className="p-4 bg-slate-800/60 rounded-xl border border-slate-700/60">
                <h4 className="font-bold text-white mb-1 flex items-center gap-2">
                  <Award className="w-4 h-4 text-teal-400" />
                  {t.rules.endConditionsTitle}
                </h4>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li><strong className="text-emerald-400">{t.common.victory}:</strong> {t.rules.victoryRule}</li>
                  <li><strong className="text-sky-400">{t.common.draw}:</strong> {t.rules.drawRule}</li>
                  <li><strong className="text-rose-400">{t.common.defeat}:</strong> {t.rules.defeatRule}</li>
                </ul>
              </div>

              <div className="space-y-2 text-xs">
                <p>{t.rules.maxTokensRule}</p>
                <p>{t.rules.mutualProtRule}</p>
                <p>{t.rules.globalCardsRule}</p>
              </div>
            </div>
          )}

          {tab === 'COMMONS' && (
            <div className="space-y-4 text-xs">
              <p>{t.rules.skillsIntro}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="p-2.5 rounded bg-purple-950/40 border border-purple-800/40">
                  <div className="font-bold text-purple-300">{t.common.care}</div>
                  <div>{t.common.health}</div>
                </div>
                <div className="p-2.5 rounded bg-orange-950/40 border border-orange-800/40">
                  <div className="font-bold text-orange-300">{t.common.occupy}</div>
                  <div>{t.common.urban}</div>
                </div>
                <div className="p-2.5 rounded bg-yellow-950/40 border border-yellow-800/40">
                  <div className="font-bold text-yellow-300">{t.common.share}</div>
                  <div>{t.common.knowledge}</div>
                </div>
                <div className="p-2.5 rounded bg-emerald-950/40 border border-emerald-800/40">
                  <div className="font-bold text-emerald-300">{t.common.regenerate}</div>
                  <div>{t.common.environment}</div>
                </div>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                <h5 className="font-bold text-white">{t.rules.unlock10Title}</h5>
                <p>{t.rules.unlock10Body}</p>
              </div>

              <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700/60 space-y-1">
                <h5 className="font-bold text-white">{t.rules.agoraTitle}</h5>
                <p>{t.rules.agoraBody}</p>
              </div>
            </div>
          )}

          {tab === 'SPECULATORS' && (
            <div className="space-y-3 text-xs">
              <p>{t.rules.specIntro}</p>
              <ul className="list-disc list-inside space-y-1.5">
                <li>{t.rules.specSteal}</li>
                <li>{t.rules.specDetention}</li>
                <li>{t.rules.specTragedy}</li>
              </ul>
            </div>
          )}

          {tab === 'HISTORY' && (
            <div className="space-y-3 text-xs">
              <p><strong>1904</strong> — {t.rules.history1904}</p>
              <p><strong>2015</strong> — {t.rules.history2015}</p>
              <p><strong>2020</strong> — {t.rules.history2020}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs"
          >
            {t.common.understood}
          </button>
        </div>

      </div>
    </div>
  );
};

/**
 * MultiplayerLobbyModal.tsx
 * Vestíbulo de Multijugador Cooperativo Online en tiempo real mediante salas de Firebase Firestore.
 * Permite crear salas con código de 6 caracteres, unirse por código o lista pública,
 * elegir personaje, marcar listo y lanzar la partida cooperativa compartida.
 */

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Globe,
  LogIn,
  LogOut,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  Users,
  WifiOff,
  X
} from 'lucide-react';
import { type User } from '../../firebase';
import { OFFICIAL_CHARACTERS } from '../../data/characters';
import { DifficultyLevel } from '../../types/game';
import { playSound } from '../../utils/audio';
import { loadSavedLeaderboardAlias } from '../../utils/leaderboard';
import {
  fetchPublicWaitingRooms,
  MultiplayerRoom
} from '../../utils/multiplayerRooms';
import { useI18n } from '../../i18n';

interface MultiplayerLobbyModalProps {
  isOpen: boolean;
  authUser: User | null;
  isAuthBusy: boolean;
  isOnline: boolean;
  activeRoom: MultiplayerRoom | null;
  onClose: () => void;
  onSignInGoogle: () => void;
  onCreateRoom: (
    alias: string,
    characterId: string,
    difficulty: DifficultyLevel,
    maxPlayers: number,
    isPublic: boolean
  ) => Promise<void>;
  onJoinByCode: (code: string, alias: string, characterId: string) => Promise<void>;
  onJoinById: (roomId: string, alias: string, characterId: string) => Promise<void>;
  onUpdateMember: (characterId: string, ready: boolean) => Promise<void>;
  onLeaveRoom: () => Promise<void>;
  onLaunchMatch: () => Promise<void>;
}

export const MultiplayerLobbyModal: React.FC<MultiplayerLobbyModalProps> = ({
  isOpen,
  authUser,
  isAuthBusy,
  isOnline,
  activeRoom,
  onClose,
  onSignInGoogle,
  onCreateRoom,
  onJoinByCode,
  onJoinById,
  onUpdateMember,
  onLeaveRoom,
  onLaunchMatch
}) => {
  const { t } = useI18n();
  const [alias, setAlias] = useState(() => loadSavedLeaderboardAlias() || 'Activista');
  const [selectedCharId, setSelectedCharId] = useState(OFFICIAL_CHARACTERS[0].id);
  const [difficulty, setDifficulty] = useState<DifficultyLevel>('EN_TRANSICION');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isPublic, setIsPublic] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [publicRooms, setPublicRooms] = useState<MultiplayerRoom[]>([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);

  const loadRooms = async () => {
    if (!authUser || !isOnline) return;
    setIsLoadingRooms(true);
    setErrorMsg(null);
    try {
      const list = await fetchPublicWaitingRooms(15);
      setPublicRooms(list);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al buscar salas públicas.');
    } finally {
      setIsLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (isOpen && authUser && isOnline && !activeRoom) {
      void loadRooms();
    }
  }, [isOpen, authUser, isOnline, activeRoom]);

  useEffect(() => {
    if (authUser?.displayName && (!alias || alias === 'Activista')) {
      setAlias(loadSavedLeaderboardAlias() || authUser.displayName.slice(0, 32));
    }
  }, [authUser, alias]);

  if (!isOpen) return null;

  const isHost = Boolean(activeRoom && authUser && activeRoom.hostUid === authUser.uid);
  const currentMember = activeRoom?.members.find(m => m.uid === authUser?.uid);
  const usedCharIds = new Set(
    (activeRoom?.members ?? []).filter(m => m.uid !== authUser?.uid).map(m => m.characterId)
  );

  const handleCopyCode = async () => {
    if (!activeRoom) return;
    try {
      await navigator.clipboard.writeText(activeRoom.roomCode);
      setCopiedCode(true);
      window.setTimeout(() => setCopiedCode(false), 1800);
    } catch {
      // Ignorar si clipboard no está disponible
    }
  };

  const handleCreate = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onCreateRoom(alias, selectedCharId, difficulty, maxPlayers, isPublic);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo crear la sala.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onJoinByCode(joinCode, alias, selectedCharId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo entrar en la sala.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleJoinPublic = async (roomId: string) => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onJoinById(roomId, alias, selectedCharId);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo unir a la sala.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStart = async () => {
    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      await onLaunchMatch();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error al iniciar la partida.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.multiplayer.title}
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-950/85 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-slate-900 border border-teal-500/50 rounded-2xl shadow-2xl p-5 sm:p-6 text-slate-100 my-auto space-y-5"
        onClick={e => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-teal-500/15 border border-teal-500/40 text-teal-300 shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-white tracking-tight">
                {t.multiplayer.title}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {t.multiplayer.subtitle}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label={t.common.close}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!isOnline ? (
          <div className="p-6 rounded-xl bg-slate-950 border border-amber-700/50 text-center space-y-2">
            <WifiOff className="w-8 h-8 text-amber-400 mx-auto" />
            <div className="text-sm font-bold text-white">{t.multiplayer.noInternet}</div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {t.multiplayer.noInternetDesc}
            </p>
          </div>
        ) : !authUser ? (
          <div className="p-6 rounded-xl bg-slate-950 border border-slate-800 text-center space-y-3">
            <ShieldCheck className="w-8 h-8 text-teal-400 mx-auto" />
            <div className="text-sm font-bold text-white">
              {t.multiplayer.signInTitle}
            </div>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              {t.multiplayer.signInDesc}
            </p>
            <button
              type="button"
              onClick={() => {
                playSound.uiClick();
                onSignInGoogle();
              }}
              disabled={isAuthBusy}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-black text-xs inline-flex items-center gap-2 transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>{isAuthBusy ? t.multiplayer.connecting : t.multiplayer.signInGoogle}</span>
            </button>
          </div>
        ) : activeRoom ? (
          /* SALA DE ESPERA ACTIVA */
          <div className="space-y-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-teal-700/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="text-[11px] uppercase tracking-wider text-teal-300 font-bold">
                  {t.multiplayer.activeRoom} · {activeRoom.isPublic ? t.multiplayer.publicRoom : t.multiplayer.privateRoom} · {activeRoom.difficulty}
                </div>
                <div className="flex items-center gap-2.5 mt-1">
                  <span className="text-2xl font-black font-mono tracking-widest text-white tabular-nums">
                    {activeRoom.roomCode}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="min-h-[34px] px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-teal-200 flex items-center gap-1"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedCode ? t.multiplayer.copied : t.multiplayer.copyCode}</span>
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void onLeaveRoom()}
                className="min-h-[40px] px-3.5 rounded-xl bg-rose-950/60 hover:bg-rose-900/70 border border-rose-700/60 text-rose-200 font-bold text-xs flex items-center gap-1.5 self-start sm:self-auto"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t.multiplayer.leaveRoom}</span>
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
                {errorMsg}
              </div>
            )}

            {/* Miembros conectados */}
            <div className="space-y-2">
              <div className="text-xs font-bold text-slate-300 flex justify-between">
                <span>{t.multiplayer.playersInRoom} ({activeRoom.members.length}/{activeRoom.maxPlayers})</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {activeRoom.members.map(member => {
                  const charMeta = OFFICIAL_CHARACTERS.find(c => c.id === member.characterId);
                  const isSelf = member.uid === authUser.uid;
                  return (
                    <div
                      key={member.uid}
                      className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                        isSelf
                          ? 'bg-teal-950/40 border-teal-500/50'
                          : 'bg-slate-950 border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: charMeta?.color || '#14b8a6' }}
                        />
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-white truncate">
                            {member.displayAlias} {member.isHost ? `· ${t.multiplayer.hostBadge}` : ''}
                          </div>
                          <div className="text-[11px] text-slate-400 truncate">
                            {charMeta?.name || member.characterId}
                          </div>
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-bold shrink-0 ${
                          member.ready ? 'text-emerald-300' : 'text-amber-300'
                        }`}
                      >
                        {member.ready ? t.multiplayer.ready : t.multiplayer.waiting}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Selector de personaje y listo */}
            {currentMember && (
              <div className="space-y-2 border-t border-slate-800 pt-3">
                <div className="text-xs font-bold text-slate-300">{t.multiplayer.selectCharacter}</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {OFFICIAL_CHARACTERS.slice(0, 8).map(char => {
                    const takenByOther = usedCharIds.has(char.id);
                    const isMine = currentMember.characterId === char.id;
                    return (
                      <button
                        key={char.id}
                        type="button"
                        disabled={takenByOther}
                        onClick={() => void onUpdateMember(char.id, currentMember.ready)}
                        className={`p-2 rounded-lg border text-left text-[11px] transition-colors flex items-center gap-2 ${
                          isMine
                            ? 'bg-teal-950/60 border-teal-400 text-white font-bold'
                            : takenByOther
                            ? 'bg-slate-950/40 border-slate-900 text-slate-600 cursor-not-allowed'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                        }`}
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: char.color }}
                        />
                        <span className="truncate">{char.name.split(' ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-800">
              {currentMember && !isHost && (
                <button
                  type="button"
                  onClick={() =>
                    void onUpdateMember(currentMember.characterId, !currentMember.ready)
                  }
                  className={`min-h-[44px] px-4 rounded-xl font-bold text-xs flex items-center gap-1.5 ${
                    currentMember.ready
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{currentMember.ready ? t.multiplayer.unmarkReady : t.multiplayer.markReady}</span>
                </button>
              )}

              {isHost ? (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleStart()}
                  className="ml-auto min-h-[44px] px-6 rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-black text-xs flex items-center gap-2 transition-colors"
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>
                    {isSubmitting ? t.common.loading : t.multiplayer.launchMatch}
                  </span>
                </button>
              ) : (
                <span className="text-xs text-slate-400 ml-auto">
                  {t.multiplayer.waiting}
                </span>
              )}
            </div>
          </div>
        ) : (
          /* CREAR O UNIRSE A SALA */
          <div className="space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-500/40 text-xs text-rose-200">
                {errorMsg}
              </div>
            )}

            {/* Alias + Personaje favorito */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <label htmlFor="mp-alias" className="block text-[11px] font-bold text-slate-300 mb-1">
                  {t.multiplayer.yourAlias}
                </label>
                <input
                  id="mp-alias"
                  type="text"
                  maxLength={32}
                  value={alias}
                  onChange={e => setAlias(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:border-teal-400 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="mp-char" className="block text-[11px] font-bold text-slate-300 mb-1">
                  {t.multiplayer.selectCharacter}
                </label>
                <select
                  id="mp-char"
                  value={selectedCharId}
                  onChange={e => setSelectedCharId(e.target.value)}
                  className="w-full min-h-[38px] px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white focus:border-teal-400 focus:outline-none"
                >
                  {OFFICIAL_CHARACTERS.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Crear sala */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-teal-400" />
                  <span>{t.multiplayer.createRoomTitle}</span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label htmlFor="mp-diff" className="block text-[10px] text-slate-400 mb-1">
                      {t.multiplayer.difficulty}
                    </label>
                    <select
                      id="mp-diff"
                      value={difficulty}
                      onChange={e => setDifficulty(e.target.value as DifficultyLevel)}
                      className="w-full min-h-[36px] px-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    >
                      <option value="COMUNLANDIA">{t.setup.diffComunlandia}</option>
                      <option value="EN_TRANSICION">{t.setup.diffTransition}</option>
                      <option value="MAD_MAX">{t.setup.diffMadMax}</option>
                    </select>
                  </div>
                  <div>
                    <label htmlFor="mp-max" className="block text-[10px] text-slate-400 mb-1">
                      {t.multiplayer.maxPlayers}
                    </label>
                    <select
                      id="mp-max"
                      value={maxPlayers}
                      onChange={e => setMaxPlayers(Number(e.target.value))}
                      className="w-full min-h-[36px] px-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white"
                    >
                      <option value={2}>2 {t.multiplayer.playersCount}</option>
                      <option value={3}>3 {t.multiplayer.playersCount}</option>
                      <option value={4}>4 {t.multiplayer.playersCount}</option>
                    </select>
                  </div>
                </div>

                <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={e => setIsPublic(e.target.checked)}
                    className="rounded border-slate-700 bg-slate-900 text-teal-400"
                  />
                  <span>{t.multiplayer.visibility}: {t.multiplayer.publicOpt}</span>
                </label>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => void handleCreate()}
                  className="w-full min-h-[42px] rounded-xl bg-teal-500 hover:bg-teal-400 disabled:opacity-50 text-slate-950 font-black text-xs transition-colors"
                >
                  {isSubmitting ? t.multiplayer.creating : t.multiplayer.createRoomBtn}
                </button>
              </div>

              {/* Unirse por código + lista pública */}
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="text-xs font-extrabold text-white flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5">
                    <Globe className="w-4 h-4 text-sky-400" />
                    <span>{t.multiplayer.joinByCodeTitle}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadRooms()}
                    disabled={isLoadingRooms}
                    className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300"
                    title={t.multiplayer.refreshRooms}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRooms ? 'animate-spin' : ''}`} />
                  </button>
                </div>

                <form onSubmit={handleJoinCode} className="flex gap-2">
                  <input
                    type="text"
                    maxLength={6}
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value.toUpperCase())}
                    placeholder={t.multiplayer.enterCodePlaceholder}
                    className="flex-1 min-h-[38px] px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono uppercase tracking-wider text-white focus:border-sky-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting || joinCode.trim().length < 4}
                    className="min-h-[38px] px-3.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-black text-xs whitespace-nowrap"
                  >
                    {t.multiplayer.joinBtn}
                  </button>
                </form>

                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {isLoadingRooms ? (
                    <div className="text-[11px] text-slate-400 py-3 text-center">
                      {t.common.loading}
                    </div>
                  ) : publicRooms.length === 0 ? (
                    <div className="text-[11px] text-slate-500 py-3 text-center">
                      {t.multiplayer.noPublicRooms}
                    </div>
                  ) : (
                    publicRooms.map(r => (
                      <div
                        key={r.roomId}
                        className="px-2.5 py-2 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-mono font-bold text-white">
                            {r.roomCode} · {r.members.length}/{r.maxPlayers}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">
                            {t.multiplayer.hostBadge}: {r.members[0]?.displayAlias || 'Comunidad'} · {r.difficulty}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isSubmitting}
                          onClick={() => void handleJoinPublic(r.roomId)}
                          className="px-2.5 py-1.5 rounded-lg bg-teal-500/20 hover:bg-teal-500/30 border border-teal-500/50 text-teal-200 font-bold text-[11px] shrink-0"
                        >
                          {t.multiplayer.joinThisRoom}
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

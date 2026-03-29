import { useState, useEffect } from 'react';
import { mockFirebase } from '../services/mockFirebase';
import type { UserProfile, RoomInfo } from '../services/mockFirebase';

type SetupStep = 'NAME' | 'LOBBY' | 'HOST_SETTINGS' | 'JOIN_ROOM' | 'WAITING_ROOM' | 'PROFILE_VIEW';

// API connectivity check
const checkApiConnection = async (): Promise<boolean> => {
  try {
    const res = await fetch('https://api.npoint.io/93e15f401f78ab48895b', { method: 'GET' });
    return res.ok;
  } catch {
    return false;
  }
};

export function SetupFlow({ onComplete }: { onComplete: (profile: UserProfile, room: RoomInfo | null) => void }) {
  const [step, setStepState] = useState<SetupStep>('NAME');
  const [name, setName] = useState('');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  
  const [mode, setMode] = useState<'Collaborative' | 'Racing'>('Collaborative');
  const [wordPack, setWordPack] = useState<'Common' | 'Rare'>('Common');
  const [joinCode, setJoinCode] = useState('');
  const [activeRoom, setActiveRoom] = useState<RoomInfo | null>(null);
  const [isConnected, setIsConnected] = useState<boolean | null>(null); // null = checking
  const [isMarkingReady, setIsMarkingReady] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

  const setStep = (newStep: SetupStep) => {
    window.history.pushState({ step: newStep }, '', window.location.href);
    setStepState(newStep);
  };

  // Check API connectivity on load
  useEffect(() => {
    checkApiConnection().then(ok => {
      setIsConnected(ok);
      console.log(`[LOBBY]: Cloud sync API ${ok ? 'reachable ✅' : 'unreachable ❌'}`);
    });
  }, []);

  useEffect(() => {
    const existing = mockFirebase.getProfile();
    let initialStep: SetupStep = 'NAME';
    if (existing) {
      setProfile(existing);
      initialStep = 'LOBBY';
    }
    window.history.replaceState({ step: initialStep }, '', window.location.href);
    setStepState(initialStep);

    const handlePopState = (e: PopStateEvent) => {
      if (e.state?.step) setStepState(e.state.step);
      else setStepState(existing ? 'LOBBY' : 'NAME');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Lobby polling — updates player list and checks ready state
  useEffect(() => {
    let interval: any;
    if (step === 'WAITING_ROOM' && activeRoom) {
      interval = setInterval(async () => {
        try {
          const freshRoom = await mockFirebase.getRoom(activeRoom.code);
          if (freshRoom) {
            const prevCount = activeRoom.players.length;
            const newCount = freshRoom.players.length;

            // Log when a new peer joins
            if (newCount > prevCount) {
              const newPeer = freshRoom.players[freshRoom.players.length - 1];
              console.log(`[LOBBY]: Room ${freshRoom.code} verified. Peer "${newPeer.name}" found.`);
            }

            setActiveRoom(freshRoom);

            // Guest auto-transitions when host starts game
            if (freshRoom.status === 'playing' && freshRoom.hostId !== profile?.id) {
              console.log(`[LOBBY]: Host started game. Guest transitioning...`);
              onComplete(profile!, freshRoom);
            }
          }
        } catch (e) { /* silent fail on poll */ }
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [step, activeRoom?.code, profile, onComplete]);

  const handleNameSubmit = () => {
    if (!name.trim()) return;
    const newProfile: UserProfile = {
      id: `player_${Date.now()}`,
      name: name.trim(),
      diamonds: 100,
      levelProgress: 1,
      totalWordsFound: 0
    };
    mockFirebase.saveProfile(newProfile);
    setProfile(newProfile);
    setStep('LOBBY');
  };

  const handleHostCreate = async () => {
    if (!profile) return;
    setIsCreating(true);
    try {
      const code = await mockFirebase.createRoom(profile.id, profile.name, mode, wordPack);
      const room = await mockFirebase.joinRoom(code, profile.id, profile.name);
      setActiveRoom(room);
      setStep('WAITING_ROOM');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinSubmit = async () => {
    if (!profile || joinCode.length !== 4) return;
    setIsJoining(true);
    try {
      const room = await mockFirebase.joinRoom(joinCode, profile.id, profile.name);
      if (room) {
        setActiveRoom(room);
        setStep('WAITING_ROOM');
      } else {
        alert(`Room ${joinCode} not active. Please ask the Host for a new code.`);
      }
    } finally {
      setIsJoining(false);
    }
  };

  const handleMarkReady = async () => {
    if (!profile || !activeRoom) return;
    setIsMarkingReady(true);
    try {
      const updatedReady = { ...(activeRoom.readyPlayers || {}), [profile.id]: true };
      await mockFirebase.updateRoom(activeRoom.code, { readyPlayers: updatedReady });
      setActiveRoom(prev => prev ? { ...prev, readyPlayers: updatedReady } : prev);
      console.log(`[LOBBY]: ${profile.name} marked Ready in Room ${activeRoom.code}`);
    } finally {
      setIsMarkingReady(false);
    }
  };

  const startMultiplayerGame = async () => {
    if (!profile || !activeRoom || activeRoom.hostId !== profile.id) return;
    await mockFirebase.updateRoom(activeRoom.code, { status: 'playing' });
    onComplete(profile, activeRoom);
  };

  // Derived lobby state
  const myReady = activeRoom?.readyPlayers?.[profile?.id ?? ''] === true;
  const allReady = activeRoom
    ? activeRoom.players.every(p => activeRoom.readyPlayers?.[p.id] === true)
    : false;
  const isHost = activeRoom?.hostId === profile?.id;
  const playerCount = activeRoom?.players.length ?? 0;
  const peer = activeRoom?.players.find(p => p.id !== profile?.id);

  // Connection indicator component
  const ConnectionDot = () => (
    <div className="flex items-center gap-1.5">
      <div className={`w-2.5 h-2.5 rounded-full ${
        isConnected === null ? 'bg-slate-400 animate-pulse' :
        isConnected ? 'bg-emerald-500 shadow-[0_0_6px_rgba(16,185,129,0.6)]' :
        'bg-rose-500 shadow-[0_0_6px_rgba(239,68,68,0.6)] animate-pulse'
      }`} />
      <span className={`text-[10px] font-black uppercase tracking-widest ${
        isConnected === null ? 'text-slate-400' :
        isConnected ? 'text-emerald-500' : 'text-rose-500'
      }`}>
        {profile ? 'Ready to Play' : 'Setting up...'}
      </span>
    </div>
  );

  return (
    <div className="h-[100dvh] w-screen bg-slate-50 text-slate-900 flex flex-col items-center justify-center p-6 absolute top-0 left-0 z-50 overflow-hidden">

      {/* Global Connection Status */}
      <div className="absolute top-4 right-4">
        <ConnectionDot />
      </div>

      {/* ─── NAME STEP ─── */}
      {step === 'NAME' && (
        <div className="w-full max-w-sm flex flex-col items-center gap-6 animate-fadeIn">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-rose-500 text-center drop-shadow-sm">
            Words of Connection
          </h1>
          <p className="text-slate-500 text-center text-sm font-bold uppercase tracking-widest">Create Profile</p>
          <input
            type="text"
            placeholder="Enter your name"
            maxLength={12}
            className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-lg focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-400 text-center font-black text-xl placeholder-slate-300 transition-all text-slate-800 shadow-sm"
            value={name}
            onChange={e => setName(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && handleNameSubmit()}
          />
          <button
            onClick={handleNameSubmit}
            disabled={!name.trim()}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-bold rounded-xl shadow-[0_6px_0_#3730A3,0_10px_20px_rgba(0,0,0,0.5)] active:shadow-[0_0px_0_#3730A3] active:translate-y-[6px] transition-all uppercase tracking-widest"
          >
            Continue
          </button>
        </div>
      )}

      {/* ─── LOBBY STEP ─── */}
      {step === 'LOBBY' && profile && (
        <div className="w-full max-w-md flex flex-col items-center gap-5 animate-fadeIn">
          <div className="text-center">
            <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-rose-500">Words of Connection</h1>
            <p className="text-slate-400 font-bold text-sm mt-1">Welcome, <span className="text-indigo-500">{profile.name}</span> 👋</p>
          </div>

          <div className="w-full flex flex-col gap-3">
            <button
              onClick={() => onComplete(profile, null)}
              className="w-full py-5 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-black rounded-2xl text-xl shadow-[0_6px_0_#3730A3] active:translate-y-[6px] active:shadow-none transition-all uppercase tracking-widest"
            >
              ✏️ Solo Play
            </button>
            <button
              onClick={() => setStep('HOST_SETTINGS')}
              className="w-full py-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black rounded-2xl text-lg shadow-[0_6px_0_#047857] active:translate-y-[6px] active:shadow-none transition-all uppercase tracking-widest"
            >
              🏠 Host a Game
            </button>
            <button
              onClick={() => setStep('JOIN_ROOM')}
              className="w-full py-4 bg-gradient-to-r from-rose-500 to-pink-600 text-white font-black rounded-2xl text-lg shadow-[0_6px_0_#be123c] active:translate-y-[6px] active:shadow-none transition-all uppercase tracking-widest"
            >
              📲 Join a Game
            </button>
          </div>

          <button onClick={() => setStep('PROFILE_VIEW')} className="text-slate-400 hover:text-slate-600 transition-colors uppercase text-xs font-bold tracking-widest">View Profile Stats</button>
          <button
            onClick={() => {
              const debugData = { uid: profile.id, name: profile.name, apiOk: isConnected, ver: '1.1.0' };
              navigator.clipboard.writeText(JSON.stringify(debugData, null, 2));
              alert('Debug info copied!');
            }}
            className="text-slate-300 hover:text-indigo-400 transition-colors text-[10px] font-bold uppercase tracking-widest flex items-center gap-1"
          >
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            Copy Debug Info
          </button>
        </div>
      )}

      {/* ─── HOST SETTINGS STEP ─── */}
      {step === 'HOST_SETTINGS' && (
        <div className="w-full max-w-md flex flex-col gap-6 animate-fadeIn">
          <h2 className="text-2xl font-black text-center text-slate-800">Room Settings</h2>

          <div className="space-y-2">
            <label className="text-slate-500 text-sm font-bold uppercase tracking-wider">Game Mode</label>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setMode('Collaborative')} className={`py-4 rounded-xl font-bold border-2 transition-colors ${mode === 'Collaborative' ? 'bg-indigo-600 border-indigo-400 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>🤝 Team</button>
              <button onClick={() => setMode('Racing')} className={`py-4 rounded-xl font-bold border-2 transition-colors ${mode === 'Racing' ? 'bg-rose-500 border-rose-400 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>🏁 Race</button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-slate-500 text-sm font-bold uppercase tracking-wider">Word Pack</label>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setWordPack('Common')} className={`py-4 rounded-xl font-bold border-2 transition-colors ${wordPack === 'Common' ? 'bg-blue-600 border-blue-400 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>🌿 Common</button>
              <button onClick={() => setWordPack('Rare')} className={`py-4 rounded-xl font-bold border-2 transition-colors ${wordPack === 'Rare' ? 'bg-purple-600 border-purple-400 text-white' : 'bg-white border-slate-200 text-slate-500'}`}>💜 Expert</button>
            </div>
          </div>

          <div className="flex gap-4 mt-2">
            <button onClick={() => window.history.back()} className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 font-bold rounded-xl">Back</button>
            <button
              onClick={handleHostCreate}
              disabled={isCreating}
              className="flex-1 py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-white font-black rounded-xl shadow-[0_4px_0_#047857] active:translate-y-1 active:shadow-none transition-all uppercase tracking-wider"
            >
              {isCreating ? 'Creating...' : 'Create Lobby'}
            </button>
          </div>
        </div>
      )}

      {/* ─── JOIN ROOM STEP ─── */}
      {step === 'JOIN_ROOM' && (
        <div className="w-full max-w-sm flex flex-col items-center gap-6 animate-fadeIn">
          <h2 className="text-3xl font-black text-slate-800">Join Game</h2>
          <p className="text-slate-400 text-center text-sm font-bold">Enter the 4-digit code from your host</p>
          <input
            type="text"
            inputMode="numeric"
            placeholder="0000"
            maxLength={4}
            className="w-full px-4 py-5 bg-white border-4 border-indigo-200 focus:border-indigo-500 rounded-2xl focus:outline-none text-center font-black text-5xl tracking-[0.5em] text-slate-800 shadow-inner transition-all"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.replace(/[^0-9]/g, ''))}
            onKeyDown={e => e.key === 'Enter' && handleJoinSubmit()}
          />
          <div className="flex gap-4 w-full">
            <button onClick={() => window.history.back()} className="flex-1 py-4 bg-white border-2 border-slate-200 text-slate-600 font-bold rounded-xl">Cancel</button>
            <button
              onClick={handleJoinSubmit}
              disabled={joinCode.length !== 4 || isJoining}
              className="flex-1 py-4 bg-rose-500 hover:bg-rose-400 disabled:opacity-60 text-white font-black rounded-xl shadow-[0_4px_0_#be123c] active:translate-y-1 active:shadow-none transition-all uppercase tracking-wider"
            >
              {isJoining ? 'Joining...' : 'Join'}
            </button>
          </div>
        </div>
      )}

      {/* ─── WAITING ROOM STEP ─── */}
      {step === 'WAITING_ROOM' && activeRoom && profile && (
        <div className="w-full max-w-sm flex flex-col items-center gap-5 animate-fadeIn">

          {/* Room Code Header */}
          <div className="text-center">
            <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-1">Room Code</p>
            <div className="text-6xl font-black text-indigo-600 tracking-[0.2em] drop-shadow-sm">{activeRoom.code}</div>
            <p className="text-slate-400 text-xs mt-1">Share this code with {isHost ? 'your player' : 'the host'}</p>
          </div>

          {/* Room Info Badge */}
          <div className="flex gap-3">
            <span className="bg-indigo-50 border border-indigo-200 text-indigo-600 font-black text-xs px-3 py-1.5 rounded-full uppercase tracking-wider">{activeRoom.mode}</span>
            <span className="bg-purple-50 border border-purple-200 text-purple-600 font-black text-xs px-3 py-1.5 rounded-full uppercase tracking-wider">{activeRoom.wordPack}</span>
          </div>

          {/* Player List */}
          <div className="w-full bg-white border border-slate-100 rounded-2xl p-4 shadow-sm space-y-3">
            <h3 className="text-slate-400 font-black text-xs uppercase tracking-widest mb-1">Players ({playerCount}/2)</h3>

            {activeRoom.players.map((p) => {
              const isMe = p.id === profile.id;
              const isPlayerHost = p.id === activeRoom.hostId;
              const isReady = activeRoom.readyPlayers?.[p.id] === true;
              return (
                <div key={p.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 transition-all ${isReady ? 'bg-emerald-50 border-emerald-300' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${isReady ? 'bg-emerald-500' : 'bg-slate-300 animate-pulse'}`} />
                    <span className="font-black text-slate-800">{p.name}{isMe ? ' (You)' : ''}</span>
                    {isPlayerHost && <span className="text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-black uppercase">Host</span>}
                  </div>
                  <span className={`text-xs font-black uppercase tracking-wide ${isReady ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {isReady ? '✅ Ready' : 'Not Ready'}
                  </span>
                </div>
              );
            })}

            {/* Waiting for second player */}
            {playerCount < 2 && (
              <div className="flex items-center justify-between px-4 py-3 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-slate-200 animate-pulse" />
                  <span className="font-bold text-slate-400 text-sm">Waiting for Player 2...</span>
                </div>
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}

            {/* Peer joined banner */}
            {peer && playerCount >= 2 && (
              <div className="text-center py-1">
                <span className="text-emerald-600 font-black text-sm animate-fadeIn">🎉 {peer.name} Joined!</span>
              </div>
            )}
          </div>

          {/* Ready / Start buttons */}
          <div className="w-full flex flex-col gap-3">
            {/* Ready button — both players */}
            {!myReady ? (
              <button
                onClick={handleMarkReady}
                disabled={isMarkingReady}
                className="w-full py-4 bg-gradient-to-r from-emerald-400 to-teal-500 text-white font-black rounded-xl shadow-[0_4px_0_#047857] active:translate-y-1 active:shadow-none transition-all uppercase tracking-widest text-lg disabled:opacity-60"
              >
                {isMarkingReady ? 'Marking...' : '✅ I\'m Ready!'}
              </button>
            ) : (
              <div className="w-full py-4 bg-emerald-50 border-2 border-emerald-300 text-emerald-700 font-black rounded-xl text-center uppercase tracking-widest">
                ✅ You're Ready!
              </div>
            )}

            {/* Start Game — host only, locked until all ready */}
            {isHost && (
              <button
                onClick={startMultiplayerGame}
                disabled={!allReady || playerCount < 2}
                className={`w-full py-4 font-black rounded-xl text-white uppercase tracking-widest text-lg transition-all ${
                  allReady && playerCount >= 2
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 shadow-[0_4px_0_#3730A3] active:translate-y-1 active:shadow-none animate-pulse'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                {allReady && playerCount >= 2 ? '🚀 Start Game!' : `Waiting for ${!allReady ? 'All Ready' : 'Player 2'}...`}
              </button>
            )}

            {!isHost && (
              <div className="w-full py-3 bg-slate-100 border border-slate-200 text-slate-500 font-bold rounded-xl text-center text-sm">
                {allReady ? '🔴 Waiting for Host to start...' : 'Waiting for all players to be ready...'}
              </div>
            )}

            <button onClick={() => window.history.back()} className="w-full py-3 bg-white border-2 border-slate-200 text-slate-500 font-bold rounded-xl text-sm">Leave Room</button>
          </div>

          {/* Sync status */}
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'}`} />
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              {room ? 'Room Active' : 'Direct Link Ready'}
            </span>
          </div>
        </div>
      )}

      {/* ─── PROFILE VIEW ─── */}
      {step === 'PROFILE_VIEW' && profile && (
        <div className="w-full max-w-sm flex flex-col items-center gap-5 animate-fadeIn bg-white border border-slate-200 p-8 rounded-2xl shadow-lg">
          <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-500 to-rose-500">My Profile</h2>
          <div className="text-center mb-2">
            <div className="text-slate-400 font-bold text-xs tracking-widest">PLAYER NAME</div>
            <div className="text-2xl font-black text-slate-800">{profile.name}</div>
          </div>
          <div className="w-full space-y-3">
            {[['Level', String(profile.levelProgress)], ['💎 Diamonds', String(profile.diamonds)], ['Words Found', String(profile.totalWordsFound)]].map(([k, v]) => (
              <div key={k} className="flex justify-between border-b border-slate-100 pb-3">
                <span className="text-slate-500 font-bold text-sm">{k}</span>
                <span className="text-slate-800 font-black">{v}</span>
              </div>
            ))}
          </div>
          <button onClick={() => window.history.back()} className="w-full py-4 mt-2 bg-white border-2 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold uppercase tracking-widest rounded-xl transition-all">Back</button>
        </div>
      )}

    </div>
  );
}

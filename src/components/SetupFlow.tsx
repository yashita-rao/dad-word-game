// @ts-nocheck
import { useState, useEffect } from 'react';
import { mockFirebase } from '../services/mockFirebase';

export function SetupFlow({ onComplete }) {
  const [step, setStep] = useState('NAME');
  const [name, setName] = useState('');
  const [profile, setProfile] = useState(null);
  const [joinCode, setJoinCode] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    const existing = mockFirebase.getProfile();
    if (existing) {
      setProfile(existing);
      setStep('LOBBY');
    }
  }, []);

  const handleNameSubmit = () => {
    if (!name.trim()) return;
    const newProfile = {
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

  const handleHostCreate = () => {
    // We create a "Fake" room object first, 
    // App.tsx will fill in the real Peer ID later
    const room = {
      code: 'GENERATING...',
      hostId: profile.id,
      players: [{ id: profile.id, name: profile.name }]
    };
    onComplete(profile, room);
  };

  const handleJoinSubmit = () => {
    if (joinCode.length < 5) {
      alert("Please enter the full Peer ID from the host.");
      return;
    }
    const room = {
      code: joinCode,
      hostId: 'remote-host',
      players: [{ id: profile.id, name: profile.name }]
    };
    onComplete(profile, room);
  };

  return (
    <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-slate-900">
      
      {/* STEP 1: NAME ENTRY */}
      {step === 'NAME' && (
        <div className="w-full max-w-sm flex flex-col gap-6 animate-in fade-in duration-500">
          <h1 className="text-4xl font-black text-center text-indigo-600">Word Game</h1>
          <input
            type="text"
            placeholder="YOUR NAME"
            className="w-full p-4 border-4 border-slate-200 rounded-2xl text-center font-bold text-xl uppercase"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button 
            onClick={handleNameSubmit}
            className="w-full py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-[0_6px_0_#3730A3] active:translate-y-1 active:shadow-none transition-all"
          >
            CONTINUE
          </button>
        </div>
      )}

      {/* STEP 2: LOBBY */}
      {step === 'LOBBY' && profile && (
        <div className="w-full max-w-sm flex flex-col gap-4 animate-in slide-in-from-bottom-4 duration-500">
          <div className="text-center mb-4">
            <h2 className="text-2xl font-black">Welcome, {profile.name}!</h2>
          </div>
          
          <button 
            onClick={() => onComplete(profile, null)}
            className="w-full py-4 bg-white border-4 border-indigo-100 text-indigo-600 font-black rounded-2xl hover:bg-indigo-50 transition-all"
          >
            🕹️ SOLO PLAY
          </button>

          <button 
            onClick={handleHostCreate}
            className="w-full py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-[0_6px_0_#065f46] active:translate-y-1 active:shadow-none transition-all"
          >
            🏠 HOST GAME
          </button>

          <button 
            onClick={() => setStep('JOIN')}
            className="w-full py-4 bg-pink-500 text-white font-black rounded-2xl shadow-[0_6px_0_#9d174d] active:translate-y-1 active:shadow-none transition-all"
          >
            📲 JOIN FRIEND
          </button>
        </div>
      )}

      {/* STEP 3: JOIN ROOM */}
      {step === 'JOIN' && (
        <div className="w-full max-w-sm flex flex-col gap-6">
          <h2 className="text-2xl font-black text-center">Enter Host ID</h2>
          <input
            type="text"
            placeholder="PASTE ID HERE"
            className="w-full p-4 border-4 border-pink-200 rounded-2xl text-center font-mono text-sm"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
          />
          <div className="flex gap-2">
            <button onClick={() => setStep('LOBBY')} className="flex-1 py-3 bg-slate-200 font-bold rounded-xl">BACK</button>
            <button 
              onClick={handleJoinSubmit}
              className="flex-2 py-3 bg-pink-500 text-white font-black rounded-xl px-8 shadow-[0_4px_0_#9d174d]"
            >
              JOIN
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
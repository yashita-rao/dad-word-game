// @ts-nocheck
import React, { useState } from 'react';

export function SetupFlow({ onComplete }) {
  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [isJoining, setIsJoining] = useState(false);

  const handleHost = () => {
    if (!name) return alert("Please enter your name!");
    onComplete({ name }, { isHost: true });
  };

  const handleJoin = () => {
    if (!name) return alert("Please enter your name!");
    if (!isJoining) {
      setIsJoining(true); // Show the ID input box
      return;
    }
    if (!joinId) return alert("Paste the ID from the other phone!");

    // Connect to the Host's ID
    const peer = new window.Peer();
    peer.on('open', () => {
      const conn = peer.connect(joinId);
      conn.on('open', () => {
        onComplete({ name }, { isHost: false, conn, id: joinId });
      });
    });
  };

  return (
    <div className="h-screen w-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border-4 border-indigo-100">
        <h1 className="text-3xl font-black text-indigo-600 mb-6 text-center italic uppercase">Word Connect</h1>
        
        <input 
          type="text" 
          placeholder="ENTER YOUR NAME" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-4 mb-4 rounded-xl border-2 border-slate-200 font-bold uppercase"
        />

        {isJoining && (
          <input 
            type="text" 
            placeholder="PASTE DEVICE ID HERE" 
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            className="w-full p-4 mb-4 rounded-xl border-2 border-indigo-200 bg-indigo-50 font-mono text-xs"
          />
        )}

        <div className="flex flex-col gap-3">
          {!isJoining && (
            <button onClick={handleHost} className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl shadow-[0_4px_0_#3730A3]">
              HOST GAME
            </button>
          )}
          
          <button onClick={handleJoin} className="w-full py-4 bg-white text-indigo-600 border-2 border-indigo-600 font-black rounded-xl">
            {isJoining ? 'CONNECT NOW' : 'JOIN DAD'}
          </button>
        </div>
      </div>
    </div>
  );
}
// @ts-nocheck
import React, { useState } from 'react';

export function SetupFlow({ onComplete }) {
  const [name, setName] = useState('');
  const [joinId, setJoinId] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [status, setStatus] = useState(''); // New status tracker
  const [isConnecting, setIsConnecting] = useState(false);

  const handleHost = () => {
    if (!name) return alert("Please enter your name!");
    onComplete({ name }, { isHost: true });
  };

  const handleJoin = () => {
    if (!name) return alert("Please enter your name!");
    
    if (!isJoining) {
      setIsJoining(true);
      return;
    }

    if (!joinId) return alert("Paste the ID first!");

    setIsConnecting(true);
    setStatus('Connecting to Host...');

    // Initialize Peer
    const peer = new window.Peer();

    peer.on('open', () => {
      const conn = peer.connect(joinId.trim());

      conn.on('open', () => {
        setStatus('Connected! Waiting for Host to start...');
        // Wait a split second so they can see the success message
        setTimeout(() => {
          onComplete({ name }, { isHost: false, conn, id: joinId });
        }, 1000);
      });

      conn.on('error', (err) => {
        console.error(err);
        setStatus('Connection failed. Check the ID.');
        setIsConnecting(false);
      });
    });

    peer.on('error', (err) => {
      setStatus('Error: ' + err.type);
      setIsConnecting(false);
    });
  };

  return (
    <div className="h-screen w-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full border-4 border-indigo-100">
        <h1 className="text-3xl font-black text-indigo-600 mb-6 text-center uppercase italic">Word Connect</h1>
        
        <input 
          type="text" 
          placeholder="YOUR NAME" 
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full p-4 mb-4 rounded-xl border-2 border-slate-200 font-bold uppercase focus:border-indigo-500 outline-none"
        />

        {isJoining && (
          <>
            <input 
              type="text" 
              placeholder="PASTE DEVICE ID" 
              value={joinId}
              onChange={(e) => setJoinId(e.target.value)}
              className="w-full p-4 mb-2 rounded-xl border-2 border-indigo-200 bg-indigo-50 font-mono text-xs"
            />
            {status && (
              <p className={`text-[10px] font-bold mb-4 text-center uppercase ${status.includes('Error') ? 'text-rose-500' : 'text-indigo-500'}`}>
                {status}
              </p>
            )}
          </>
        )}

        <div className="flex flex-col gap-3">
          {!isJoining && (
            <button onClick={handleHost} className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl shadow-[0_4px_0_#3730A3] active:translate-y-1 active:shadow-none">
              HOST GAME
            </button>
          )}
          
          <button 
            onClick={handleJoin} 
            disabled={isConnecting}
            className={`w-full py-4 font-black rounded-xl border-2 transition-all ${
              isConnecting 
              ? 'bg-slate-100 border-slate-300 text-slate-400 cursor-not-allowed' 
              : 'bg-white text-indigo-600 border-indigo-600 active:bg-indigo-50'
            }`}
          >
            {isConnecting ? 'CONNECTING...' : isJoining ? 'CONNECT NOW' : 'JOIN DAD'}
          </button>
        </div>
      </div>
    </div>
  );
}
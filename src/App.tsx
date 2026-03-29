// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { generateGrid } from './utils/gridGenerator';
import { SetupFlow } from './components/SetupFlow';
import { mockFirebase } from './services/mockFirebase';

function App() {
  const [profile, setProfile] = useState(null);
  const [room, setRoom] = useState(null);
  const [grid, setGrid] = useState(null);
  const [myPeerId, setMyPeerId] = useState('');
  const [wheelLetters, setWheelLetters] = useState([]);
  const [foundWords, setFoundWords] = useState([]);

  // 1. Initialize PeerJS when someone chooses to Host or Join
  useEffect(() => {
    if (profile && !myPeerId) {
      const peer = new window.Peer(); // Accessing from index.html script
      
      peer.on('open', (id) => {
        setMyPeerId(id);
        console.log("My Peer ID is: ", id);
      });

      peer.on('connection', (conn) => {
        conn.on('data', (data) => {
          if (data.type === 'GUESS') {
            // Handle player 2's guesses here
          }
        });
        // Save connection to room state
        setRoom(prev => ({ ...prev, conn }));
      });
    }
  }, [profile]);

  if (!profile) {
    return <SetupFlow onComplete={(p, r) => {
      setProfile(p);
      setRoom(r);
    }} />;
  }

  // 2. THIS IS THE HOST VIEW (The part that was empty)
  if (room && !grid) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border-4 border-indigo-100 flex flex-col items-center gap-6 max-w-sm w-full">
          <h2 className="text-2xl font-black text-indigo-600 uppercase tracking-tighter">Lobby Active</h2>
          
          <div className="w-full bg-slate-100 p-4 rounded-xl border-2 border-dashed border-slate-300">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Your Device ID</p>
            <p className="font-mono text-sm break-all font-black text-slate-700 select-all">
              {myPeerId || 'Generating ID...'}
            </p>
          </div>

          <p className="text-center text-sm text-slate-500 font-medium">
            Share this ID with your friend so they can join your session.
          </p>

          <button 
            onClick={() => {
              const newGrid = generateGrid();
              setGrid(newGrid);
              const wl = newGrid.wheelLetters.map((char, i) => ({ id: `w-${i}-${char}`, char }));
              setWheelLetters(wl);
            }}
            className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl shadow-[0_4px_0_#3730A3]"
          >
            START GAME
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col items-center justify-center">
      <h1 className="text-xl font-bold">Game Started!</h1>
      {/* Your game board code goes here */}
    </div>
  );
}

export default App;


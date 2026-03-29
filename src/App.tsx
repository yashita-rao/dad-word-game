// @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
import { generateGrid } from './utils/gridGenerator';
import { SetupFlow } from './components/SetupFlow';
import { mockFirebase } from './services/mockFirebase';

function App() {
  const [profile, setProfile] = useState(null);
  const [room, setRoom] = useState(null);
  const [grid, setGrid] = useState(null);
  const [foundWords, setFoundWords] = useState([]);
  const [wheelLetters, setWheelLetters] = useState([]);
  const [activePath, setActivePath] = useState([]);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [pointerPos, setPointerPos] = useState(null);

  const letterRefs = useRef({});
  const wheelContainerRef = useRef(null);

  // This handles data coming from the other phone
  const handlePeerData = (data) => {
    if (data.type === 'START_GAME') {
      setGrid(data.grid);
      setFoundWords([]);
      const wl = data.grid.wheelLetters.map((char, i) => ({
        id: `w-${i}-${char}`, char
      }));
      setWheelLetters(wl);
    }
    if (data.type === 'WORD_FOUND') {
      setFoundWords(prev => [...new Set([...prev, data.word])]);
    }
  };

  const initLevel = (currentRoom, p) => {
    const activeProf = p || profile;
    if (!activeProf || !currentRoom) return;

    if (currentRoom.hostId === activeProf.id) {
      const newGrid = generateGrid();
      if (newGrid) {
        setGrid(newGrid);
        setFoundWords([]);
        const wl = newGrid.wheelLetters.map((char, i) => ({ id: `w-${i}-${char}`, char }));
        setWheelLetters(wl);
        // Send the grid to the guest immediately
        mockFirebase.sendUpdate({ type: 'START_GAME', grid: newGrid });
      }
    }
  };

  const handlePointerDown = (e) => {
    setIsPointerDown(true);
    setPointerPos({ x: e.clientX, y: e.clientY });
  };

  const handlePointerMove = (e) => {
    if (!isPointerDown) return;
    
    let closestLetter = null;
    let minDistance = 40;

    wheelLetters.forEach((wl) => {
      const node = letterRefs.current[wl.id];
      if (node) {
        const rect = node.getBoundingClientRect();
        const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        const dist = Math.hypot(center.x - e.clientX, center.y - e.clientY);
        if (dist < minDistance) {
          minDistance = dist;
          closestLetter = wl;
        }
      }
    });

    if (closestLetter && !activePath.find(p => p.id === closestLetter.id)) {
      setActivePath(prev => [...prev, closestLetter]);
    }
  };

  const handlePointerUp = () => {
    setIsPointerDown(false);
    if (activePath.length > 0 && grid) {
      const spelledWord = activePath.map(p => p.char.toUpperCase()).join('');
      const isPlaced = grid.placedWords.find(pw => pw.word.toUpperCase() === spelledWord);

      if (isPlaced && !foundWords.includes(spelledWord)) {
        const newFound = [...foundWords, spelledWord];
        setFoundWords(newFound);
        // Update diamonds
        const newD = mockFirebase.updateDiamonds(5);
        setProfile(prev => ({...prev, diamonds: newD}));
        // Sync to other player
        mockFirebase.sendUpdate({ type: 'WORD_FOUND', word: spelledWord });
      }
    }
    setActivePath([]);
  };

  if (!profile) {
    return (
      <SetupFlow onComplete={(p, r) => { 
        setProfile(p); 
        setRoom(r); 
        if (r) {
          if (r.hostId === p.id) {
            mockFirebase.initConnection(handlePeerData).then((id) => {
              // The room code is now the Peer ID
              r.code = id; 
              initLevel(r, p);
            });
          } else {
            mockFirebase.joinRoom(r.code, handlePeerData);
          }
        }
      }} />
    );
  }

  if (!grid) return <div className="h-screen flex items-center justify-center bg-slate-900 text-white font-bold">Connecting to Peer...</div>;

  return (
    <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center touch-none">
      {/* Simple Crossword Grid */}
      <div className="relative w-full max-w-md h-1/2 p-8">
        {grid.cells.map((cell, i) => {
          const isF = foundWords.includes(grid.placedWords.find(pw => 
            (pw.isHorizontal ? (cell.y === pw.y && cell.x >= pw.x && cell.x < pw.x + pw.word.length) : (cell.x === pw.x && cell.y >= pw.y && cell.y < pw.y + pw.word.length))
          )?.word.toUpperCase());
          
          return (
            <div key={i} className={`absolute border flex items-center justify-center font-bold text-xl rounded-lg transition-all ${isF ? 'bg-pink-500 text-white scale-105' : 'bg-white text-transparent'}`}
              style={{ 
                left: `${((cell.x - grid.minX) / grid.width) * 100}%`, 
                top: `${((cell.y - grid.minY) / grid.height) * 100}%`, 
                width: `${(100 / grid.width) - 1}%`, height: `${(100 / grid.height) - 1}%` 
              }}>
              {cell.letter}
            </div>
          );
        })}
      </div>

      {/* Selected Word Preview */}
      <div className="h-10 text-pink-500 font-black text-2xl uppercase mb-4">
        {activePath.map(p => p.char).join('')}
      </div>

      {/* The Wheel */}
      <div className="relative w-64 h-64 rounded-full bg-white shadow-2xl border-4 border-white"
           onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp}>
        {wheelLetters.map((wl, i) => {
          const angle = (i / wheelLetters.length) * 2 * Math.PI - Math.PI / 2;
          const x = 128 + 90 * Math.cos(angle);
          const y = 128 + 90 * Math.sin(angle);
          const isActive = activePath.some(p => p.id === wl.id);
          return (
            <div key={wl.id} ref={el => letterRefs.current[wl.id] = el}
              className={`absolute w-14 h-14 -ml-7 -mt-7 rounded-full flex items-center justify-center text-2xl font-black transition-all ${isActive ? 'bg-pink-500 text-white scale-110 shadow-lg' : 'bg-slate-100 text-slate-700'}`}
              style={{ left: x, top: y }}>
              {wl.char}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default App;
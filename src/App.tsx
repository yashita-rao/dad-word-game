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

  // peerjs is now loaded via index.html script tag
  // We access it via window.Peer

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

    if (currentRoom.isHost) {
      const newGrid = generateGrid();
      setGrid(newGrid);
      setFoundWords([]);
      const wl = newGrid.wheelLetters.map((char, i) => ({
        id: `w-${i}-${char}`, char
      }));
      setWheelLetters(wl);
      
      if (currentRoom.conn) {
        currentRoom.conn.send({ type: 'START_GAME', grid: newGrid });
      }
    }
  };

  // Remove the useEffect that was forcing isOffline = true
  
  if (!profile) {
    return <SetupFlow onComplete={(p, r) => {
      setProfile(p);
      setRoom(r);
      if (r.conn) {
        r.conn.on('data', handlePeerData);
      }
      initLevel(r, p);
    }} />;
  }

  // Rest of your game logic (handlePointerDown, etc.) remains here...
  // [I have truncated for brevity, but keep your existing game movement functions below this line]
}

export default App;
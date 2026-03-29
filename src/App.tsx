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

  // @ts-nocheck
import React, { useEffect, useState, useRef } from 'react';
// ... other imports

function App() {
  const [profile, setProfile] = useState(null);
  const [room, setRoom] = useState(null);
  const [grid, setGrid] = useState(null);
  const [myPeerId, setMyPeerId] = useState('');
  // ... other states

  useEffect(() => {
    // Only initialize Peer if we have a profile and haven't started Peer yet
    if (profile && !window.myPeerInstance) {
      const peer = new window.Peer();
      window.myPeerInstance = peer; // Store it globally to prevent double-init

      peer.on('open', (id) => {
        setMyPeerId(id);
        if (!room?.isHost) {
          // If we are joining, the connection is handled in SetupFlow
        }
      });

      // CRITICAL: This is what fixes the "Dads screen stuck" issue
      // It tells your phone: "When someone connects to me, accept them!"
      peer.on('connection', (conn) => {
        conn.on('open', () => {
          setRoom({ isHost: true, conn, id: myPeerId });
          // Optional: Send a 'Welcome' message to trigger his "Connected" screen
          conn.send({ type: 'WELCOME' });
        });

        conn.on('data', (data) => {
          // Handle incoming game moves from Dad here
        });
      });
    }
  }, [profile]);

  // Update handlePeerData to catch the WELCOME message on Dad's side
  const handlePeerData = (data) => {
    if (data.type === 'WELCOME') {
        console.log("Host acknowledged us!");
    }
    // ... rest of your START_GAME logic
  };

  // ... rest of your App component
}
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

// 1. If no profile, show the Name/Avatar setup
  if (!profile) {
    return <SetupFlow onComplete={(p, r) => {
      setProfile(p);
      setRoom(r);
    }} />;
  }

  // 2. If we have a profile but NO GRID yet, show the Lobby (ID screen)
  // This is what you were seeing. We add "!grid" so it disappears once the game starts.
  if (room && !grid) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="bg-white p-8 rounded-3xl shadow-xl border-4 border-indigo-100 flex flex-col items-center gap-6 max-w-sm w-full">
          <h2 className="text-2xl font-black text-indigo-600 uppercase tracking-tighter">Lobby Active</h2>
          
          <div className="w-full bg-slate-100 p-4 rounded-xl border-2 border-dashed border-slate-300">
            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Your Device ID</p>
            <p className="font-mono text-sm break-all font-black text-slate-700">
              {myPeerId || 'Generating ID...'}
            </p>
          </div>

          <button 
            onClick={() => {
              const newGrid = generateGrid();
              setGrid(newGrid); // This will now trigger the game view below
              const wl = newGrid.wheelLetters.map((char, i) => ({ id: `w-${i}-${char}`, char }));
              setWheelLetters(wl);
              
              // Send the grid to Dad's phone
              if (room.conn) {
                room.conn.send({ type: 'START_GAME', grid: newGrid });
              }
            }}
            className="w-full py-4 bg-indigo-600 text-white font-black rounded-xl shadow-[0_4px_0_#3730A3] active:translate-y-1 active:shadow-none transition-all"
          >
            START GAME
          </button>
        </div>
      </div>
    );
  }

  // 3. THE GAME BOARD (This will now show for both you and your dad)
  return (
    <div className="h-screen w-screen bg-[#f8fafc] flex flex-col items-center justify-center overflow-hidden touch-none">
       {/* Put your existing Game Board UI code here (the grid, the wheel, etc.) */}
       <div className="text-indigo-600 font-bold mb-4">Room: {room?.id || 'Connected'}</div>
       
       {/* ... rest of your game rendering ... */}
    </div>
  );
}

export default App;
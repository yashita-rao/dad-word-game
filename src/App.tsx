import { useEffect, useState, useRef } from 'react';
import { generateGrid } from './utils/gridGenerator';
import type { GridData, Cell } from './utils/gridGenerator';
import { SetupFlow } from './components/SetupFlow';
import { mockFirebase } from './services/mockFirebase';
import type { UserProfile, RoomInfo } from './services/mockFirebase';

type WheelLetter = {
  id: string;
  char: string;
};

type Point = { x: number; y: number };

function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [room, setRoom] = useState<RoomInfo | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const [grid, setGrid] = useState<GridData | null>(null);
  const [foundWords, setFoundWords] = useState<string[]>([]);
  const [extraWords, setExtraWords] = useState<string[]>([]);
  const [hintedCells, setHintedCells] = useState<string[]>([]);
  
  const [wheelLetters, setWheelLetters] = useState<WheelLetter[]>([]);
  
  // Interaction states
  const [activePath, setActivePath] = useState<WheelLetter[]>([]);
  const [isPointerDown, setIsPointerDown] = useState(false);
  const [pointerPos, setPointerPos] = useState<Point | null>(null);
  
  // FX States
  const [recentlyFound, setRecentlyFound] = useState<string | null>(null);
  const [shakeHint, setShakeHint] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncError, setSyncError] = useState(false);
  const [flyingDiamonds, setFlyingDiamonds] = useState<{id: number, startX: number, startY: number, endX: number, endY: number}[]>([]);

  // Letter position refs for drawing lines
  const letterRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const wheelContainerRef = useRef<HTMLDivElement>(null);
  const wakeLockRef = useRef<any>(null);

  const spawnDiamonds = (amount: number, startX: number, startY: number) => {
    const hudX = window.innerWidth - 60;
    const hudY = 40;
    const newDiamonds = Array.from({length: amount}).map((_, i) => ({
        id: Date.now() + Math.random() + i,
        startX: startX + (Math.random() * 40 - 20),
        startY: startY + (Math.random() * 40 - 20),
        endX: hudX,
        endY: hudY
    }));
    setFlyingDiamonds(prev => [...prev, ...newDiamonds]);
    setTimeout(() => {
        setFlyingDiamonds(prev => prev.filter(d => !newDiamonds.find(nd => nd.id === d.id)));
    }, 1000);
  };

  const showToast = (msg: string) => {
      setToastMsg(msg);
      setTimeout(() => setToastMsg(null), 2000);
  };

  useEffect(() => {
    const requestWakeLock = async () => {
      try {
        if ('wakeLock' in navigator) {
          wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
        }
      } catch (err) { }
    };

    const handleVisibilityChange = () => {
      if (wakeLockRef.current !== null && document.visibilityState === 'visible' && profile && grid) {
        requestWakeLock();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    if (profile && grid) {
      requestWakeLock();
      window.history.pushState({ gameActive: true }, '', window.location.href);
    }
    
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (profile && grid) {
          e.preventDefault();
          e.returnValue = "Are you sure?";
          return "Are you sure?";
      }
    };
    
    const handlePopState = (_e: PopStateEvent) => {
      if (profile && grid) {
          const confirmLeave = window.confirm("Leave game?");
          if (!confirmLeave) {
              window.history.pushState({ gameActive: true }, '', window.location.href);
          } else {
              setGrid(null);
              setProfile(null); 
          }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('popstate', handlePopState);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('popstate', handlePopState);
      if (wakeLockRef.current !== null) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [profile, grid]);

  // --- CROSS-DEVICE GLOBAL POLLING ---
  useEffect(() => {
    if (!room || !profile) return;
    const interval = setInterval(async () => {
        try {
            setIsSyncing(true);
            const freshRoom = await mockFirebase.getRoom(room.code);
            setSyncError(false);
            if (!freshRoom) {
               setIsSyncing(false);
               return;
            }

            setRoom(freshRoom);

            // Guest receives grid from host
            if (freshRoom.gridData && freshRoom.hostId !== profile.id) {
                const isNewGrid = !grid || grid.masterWord !== freshRoom.gridData.masterWord;
                if (isNewGrid) {
                    setGrid(freshRoom.gridData);
                    if (freshRoom.mode === 'Racing') {
                        setFoundWords([]);
                    } else {
                        setFoundWords(freshRoom.foundWords || []);
                    }
                    const wl = freshRoom.gridData.wheelLetters.map((char: string, i: number) => ({
                        id: `w-${i}-${char}`, char
                    }));
                    setWheelLetters(wl);
                }
            }

            // Collaborative Sync
            if (grid && freshRoom.mode === 'Collaborative') {
                const remoteWords: string[] = freshRoom.foundWords || [];
                const newWords = remoteWords.filter(w => !foundWords.includes(w));
                if (newWords.length > 0) {
                    newWords.forEach(w => {
                        setRecentlyFound(w);
                        setTimeout(() => setRecentlyFound(null), 1000);
                    });
                    setFoundWords(remoteWords);
                }
                if (typeof freshRoom.roomDiamonds === 'number' && profile.diamonds !== freshRoom.roomDiamonds) {
                    const updated = { ...profile, diamonds: freshRoom.roomDiamonds };
                    setProfile(updated);
                    mockFirebase.saveProfile(updated);
                }
            }

            // Racing Sync
            if (grid && freshRoom.mode === 'Racing' && freshRoom.status === 'finished') {
                const myProgress = freshRoom.progress?.[profile.id] || 0;
                const totalWords = grid.placedWords?.length || 0;
                if (myProgress < totalWords) {
                    showToast('Opponent Won! 🏆');
                    setTimeout(() => { setGrid(null); }, 2500);
                }
            }
            setIsSyncing(false);
        } catch (e) { 
            setIsSyncing(false);
            setSyncError(true);
        }
    }, 2000); 
    return () => clearInterval(interval);
  }, [room?.code, grid ? true : false, foundWords.length, profile?.diamonds, profile?.id]);

  const initLevel = async (currentRoom: RoomInfo | null, p?: UserProfile) => {
    const activeProf = p || profile;
    if (currentRoom && currentRoom.hostId !== activeProf?.id) {
       setGrid(null);
       return;
    }

    let newGrid = null;
    let attempts = 0;
    while (!newGrid && attempts < 100) {
      try { newGrid = generateGrid(); } catch { }
      attempts++;
    }
    if (newGrid) {
      setGrid(newGrid);
      setFoundWords([]);
      setExtraWords([]);
      setHintedCells([]);
      setActivePath([]);
      
      const wl = newGrid.wheelLetters.map((char, i) => ({
        id: `w-${i}-${char}`,
        char
      }));
      setWheelLetters(wl);
      
      if (currentRoom && currentRoom.hostId === activeProf?.id) {
          await mockFirebase.updateRoom(currentRoom.code, { 
              gridData: newGrid, 
              foundWords: [], 
              progress: { [currentRoom.hostId]: 0 } 
          });
      }
    }
  };

  const handleShuffle = () => {
    const shuffled = [...wheelLetters];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    setWheelLetters(shuffled);
  };

  const handleHint = () => {
    if (!profile || !grid) return;
    if (profile.diamonds < 25) {
      setShakeHint(true);
      setTimeout(() => setShakeHint(false), 500);
      return;
    }

    const unrevealed: Cell[] = [];
    grid.cells.forEach(cell => {
        const isFound = grid.placedWords.some(pw => {
            const isHoriz = pw.isHorizontal;
            const inWord = isHoriz 
                ? cell.y === pw.y && cell.x >= pw.x && cell.x < pw.x + pw.word.length
                : cell.x === pw.x && cell.y >= pw.y && cell.y < pw.y + pw.word.length;
            return inWord && foundWords.includes(pw.word);
        });
        
        const cellKey = `${cell.x},${cell.y}`;
        if (!isFound && !hintedCells.includes(cellKey)) unrevealed.push(cell);
    });

    if (unrevealed.length > 0) {
        const newD = mockFirebase.updateDiamonds(-25);
        setProfile({ ...profile, diamonds: newD });
        const randomCell = unrevealed[Math.floor(Math.random() * unrevealed.length)];
        setHintedCells(prev => [...prev, `${randomCell.x},${randomCell.y}`]);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    setIsPointerDown(true);
    setPointerPos({ x: e.clientX, y: e.clientY });
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isPointerDown) return;
    setPointerPos({ x: e.clientX, y: e.clientY });
    
    let closestLetter: WheelLetter | null = null;
    let minDistance = 55;

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

    if (closestLetter) {
      const lid = (closestLetter as WheelLetter).id;
      if (!activePath.find(p => p.id === lid)) {
        setActivePath(prev => [...prev, closestLetter as WheelLetter]);
      } else if (activePath.length > 1) {
        const prevNode = activePath[activePath.length - 2];
        if (prevNode && prevNode.id === lid) {
            setActivePath(prev => prev.slice(0, prev.length - 1));
        }
      }
    }
  };

  const handlePointerUp = async (e: React.PointerEvent) => {
    const endX = e.clientX;
    const endY = e.clientY;
    setIsPointerDown(false);
    setPointerPos(null);
    e.currentTarget.releasePointerCapture(e.pointerId);

    if (activePath.length > 0 && grid && profile) {
      const spelledWord = activePath.map(p => p.char.toUpperCase().trim()).join('');
      const isPlaced = grid.placedWords.find(pw => pw.word.toUpperCase().trim() === spelledWord);
      
      const rewardPlayerForWord = async (diamondsAwarded: number, isGridWord: boolean = false) => {
          const newTotal = profile.totalWordsFound + 1;
          let newDiamonds = profile.diamonds;
          if (diamondsAwarded > 0) newDiamonds = mockFirebase.updateDiamonds(diamondsAwarded);
          const freshProfile = { ...profile, diamonds: newDiamonds, totalWordsFound: newTotal };
          mockFirebase.saveProfile(freshProfile);
          setProfile(freshProfile);
          
          if (room && room.mode === 'Collaborative') {
              await mockFirebase.increaseRoomDiamonds(room.code, diamondsAwarded);
              await mockFirebase.updateRoom(room.code, { 
                  foundWords: isGridWord ? [...foundWords, spelledWord] : foundWords 
              });
          }

          if (isGridWord) {
              const updatedWords = [...foundWords, spelledWord];
              if (room && room.mode === 'Racing') {
                  const freshRoom = await mockFirebase.getRoom(room.code);
                  if (freshRoom) {
                      const prog = freshRoom.progress || {};
                      prog[profile.id] = updatedWords.length;
                      const isWinner = grid.placedWords.every(pw => updatedWords.includes(pw.word.toUpperCase().trim()));
                      await mockFirebase.updateRoom(room.code, { progress: prog, status: isWinner ? 'finished' : freshRoom.status });
                  }
              }
          }
          if (diamondsAwarded >= 10) spawnDiamonds(3, endX, endY);
          else if (diamondsAwarded >= 5) spawnDiamonds(1, endX, endY);
      };

      if (isPlaced) {
          const placedWord = isPlaced.word.toUpperCase();
          const currentRoomState = room ? await mockFirebase.getRoom(room.code) : null;
          const remoteFoundWords = currentRoomState?.foundWords?.map((w: string) => w.toUpperCase()) || [];
          const alreadySolvedAnywhere = foundWords.map(w => w.toUpperCase()).includes(placedWord) || remoteFoundWords.includes(placedWord);

          if (!alreadySolvedAnywhere) {
              setFoundWords(prev => [...prev, spelledWord]);
              setRecentlyFound(spelledWord);
              setTimeout(() => setRecentlyFound(null), 1000);
              if (spelledWord.length === grid.wheelLetters.length) {
                  showToast("Perfect! +15 💎");
                  await rewardPlayerForWord(15, true);
              } else {
                  showToast("Found! +5 💎");
                  await rewardPlayerForWord(5, true);
              }
          } else {
              showToast("Already Found!");
          }
      } else if (grid.dictionaryWords.map(w => w.toUpperCase()).includes(spelledWord)) {
          if (![...foundWords, ...extraWords].map(w => w.toUpperCase()).includes(spelledWord)) {
              setExtraWords(prev => [...prev, spelledWord]);
              if (spelledWord.length === grid.wheelLetters.length || spelledWord.length === 7) {
                  showToast("Bonus Anagram! +10 💎");
                  await rewardPlayerForWord(10);
              } else {
                  setRecentlyFound("EXTRA");
                  setTimeout(() => setRecentlyFound(null), 1000);
                  await rewardPlayerForWord(5);
              }
          } else {
              showToast("Already Found!");
          }
      } else if (spelledWord.length >= 3) {
          showToast("Not a Word! ❌");
      }
    }
    setActivePath([]);
  };

  if (!profile) return <SetupFlow onComplete={(p, r) => { setProfile(p); setRoom(r); initLevel(r, p); }} />;

  if (!grid) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-[#0a0f1c] text-white">
        <svg className="animate-spin h-10 w-10 text-indigo-500 mb-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
        <div className="animate-pulse text-lg font-bold tracking-widest text-indigo-300">Connecting to Server...</div>
      </div>
    );
  }

  const isLevelComplete = grid && grid.placedWords.length > 0 && grid.placedWords.every(pw => foundWords.includes(pw.word.trim().toUpperCase()));
  const currentWord = activePath.map(p => p.char).join('');

  return (
    <div className="h-[100dvh] w-screen overflow-hidden bg-slate-50 flex flex-col font-sans select-none touch-none text-slate-900">
      
      {isMenuOpen && (
          <div className="absolute inset-0 z-50 flex">
              <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsMenuOpen(false)}></div>
              <div className="relative w-64 h-full bg-white shadow-2xl flex flex-col pt-16 px-6 animate-fadeIn slide-in-left">
                  <h2 className="text-2xl font-black text-indigo-600 mb-8 border-b border-slate-200 pb-4">Menu</h2>
                  <div className="flex flex-col gap-4">
                      <button onClick={() => { setIsMenuOpen(false); initLevel(room, profile); }} className="text-left font-bold text-slate-700 hover:text-indigo-600 py-2 transition-colors uppercase tracking-widest text-sm">Reset Level</button>
                      <button onClick={() => { setIsMenuOpen(false); window.location.reload(); }} className="text-left font-bold text-slate-700 hover:text-indigo-600 py-2 transition-colors uppercase tracking-widest text-sm">Home / Lobby</button>
                  </div>
              </div>
          </div>
      )}

      <div className="flex-grow min-h-0 w-full p-4 sm:p-8 flex flex-col items-center justify-center relative overflow-hidden bg-slate-50 max-h-[70%]">
        <div className="absolute top-4 left-4 right-4 flex flex-col items-center z-20 pointer-events-none">
            <div className="flex w-full justify-between items-start pointer-events-auto">
                <button onClick={() => setIsMenuOpen(true)} className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-[4px] active:scale-95 transition-transform"><div className="w-5 h-0.5 bg-slate-600"></div><div className="w-5 h-0.5 bg-slate-600"></div><div className="w-5 h-0.5 bg-slate-600"></div></button>
                
                <div className="flex flex-col items-center">
                    <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-2">
                        <span className="text-xl font-black text-indigo-600 tracking-tight">#{room ? room.code : profile.levelProgress}</span>
                        {room && <div className={`w-2 h-2 rounded-full ${syncError ? 'bg-rose-500 animate-pulse' : (isSyncing ? 'bg-indigo-400 animate-pulse' : 'bg-emerald-500')}`} />}
                    </div>
                    {syncError && room && <span className="text-[10px] font-black text-rose-500 uppercase tracking-tighter mt-1 bg-white/80 px-2 rounded-md">Connecting to server...</span>}
                </div>

                <div className="bg-white/90 backdrop-blur-md px-4 py-2 rounded-2xl shadow-sm border border-slate-200 flex items-center gap-2">
                    <span className="text-2xl font-black text-amber-500">💎</span>
                    <span className="text-2xl font-black text-slate-700 tabular-nums">{profile.diamonds}</span>
                </div>
            </div>
            {recentlyFound === "EXTRA" && <div className="animate-bounce mt-4 text-emerald-500 font-black text-xl drop-shadow-[0_0_10px_rgba(16,185,129,0.3)] whitespace-nowrap">EXTRA WORD! +5 💎</div>}
        </div>

        {toastMsg && <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-slate-800 text-white font-bold px-6 py-3 rounded-full shadow-lg z-50 animate-fadeIn pointer-events-none">{toastMsg}</div>}

        {flyingDiamonds.map(d => (
            <div key={d.id} className="fixed z-[100] text-3xl animate-flyToCounter pointer-events-none drop-shadow-md" style={{ '--startX': `${d.startX}px`, '--startY': `${d.startY}px`, '--endX': `${d.endX}px`, '--endY': `${d.endY}px` } as React.CSSProperties}>💎</div>
        ))}

        <div className="relative w-full h-full max-w-4xl mx-auto flex items-center justify-center p-2 sm:p-6 pb-4">
          <div className="relative transition-all duration-300" style={{ width: '100%', maxHeight: '100%', maxWidth: `calc(65vh * (${grid.width} / ${grid.height}))`, aspectRatio: `${grid.width} / ${grid.height}` }}>
            {grid.cells.map((cell: Cell, i) => {
              const bl = grid.placedWords.filter(pw => pw.isHorizontal ? cell.y === pw.y && cell.x >= pw.x && cell.x < pw.x + pw.word.length : cell.x === pw.x && cell.y >= pw.y && cell.y < pw.y + pw.word.length);
              const isF = bl.some(bw => foundWords.includes(bw.word));
              const isRF = bl.some(bw => bw.word === recentlyFound);
              const isH = hintedCells.includes(`${cell.x},${cell.y}`);
              return (
                <div key={`${cell.x}-${cell.y}-${i}`} className="absolute p-[1.5%]" style={{ left: `${((cell.x - grid.minX) / grid.width) * 100}%`, top: `${((cell.y - grid.minY) / grid.height) * 100}%`, width: `${100 / grid.width}%`, height: `${100 / grid.height}%` }}>
                  <div className={`ghost-tile w-full h-full transition-colors duration-300 ${isRF ? 'bg-pink-500 animate-pop3D z-10' : isF ? 'bg-indigo-500' : isH ? 'bg-yellow-500' : 'bg-gray-800'} ${isF ? 'text-white' : isH ? 'text-yellow-900' : 'text-transparent'}`} style={{ boxShadow: isRF ? 'none' : `0 4px 0 ${isRF ? '#be185d' : isF ? '#3730A3' : isH ? '#a16207' : '#1f2937'}, 0 5px 10px rgba(0,0,0,0.3)`, fontSize: `clamp(14px, calc(60vh / ${Math.max(grid.width, grid.height)}), 48px)` }}>{(isF || isH) ? cell.letter : ''}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="flex-shrink-0 h-[25vh] min-h-[220px] pb-10 w-full bg-white relative z-10 flex flex-col items-center justify-center shadow-[0_-10px_40px_rgba(0,0,0,0.05)] border-t border-slate-200 pointer-events-auto max-h-[25%] mb-safe">
        <div className="absolute top-2 h-10 flex items-center justify-center pointer-events-none"><div className="text-2xl font-black tracking-widest text-rose-500 drop-shadow-sm uppercase">{currentWord}</div></div>
        <div className="flex items-center justify-center w-full gap-4 sm:gap-12 relative mt-4">
            <button onClick={handleHint} className={`w-14 h-14 sm:w-16 sm:h-16 bg-amber-400 hover:bg-amber-300 text-amber-900 rounded-full flex flex-col items-center justify-center shadow-[0_4px_0_#b45309,0_8px_10px_rgba(0,0,0,0.1)] active:translate-y-[4px] active:shadow-[0_0px_0_#b45309,0_2px_4px_rgba(0,0,0,0.1)] transition-all ${shakeHint ? 'animate-shake' : ''}`}><div className="text-xl sm:text-2xl leading-none">💡</div><div className="text-[10px] sm:text-xs font-black -mt-1">-25</div></button>
            <div ref={wheelContainerRef} className="relative w-[220px] h-[220px] sm:w-[260px] sm:h-[260px] touch-none" onPointerDown={handlePointerDown} onPointerMove={handlePointerMove} onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp} onPointerLeave={handlePointerUp}>
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                    {activePath.length > 1 && activePath.map((p, i) => {
                        const prev = activePath[i-1];
                        const prevRect = letterRefs.current[prev.id]?.getBoundingClientRect();
                        const currRect = letterRefs.current[p.id]?.getBoundingClientRect();
                        const cRect = wheelContainerRef.current?.getBoundingClientRect();
                        if (!prevRect || !currRect || !cRect) return null;
                        return <line key={i} x1={prevRect.left - cRect.left + prevRect.width/2} y1={prevRect.top - cRect.top + prevRect.height/2} x2={currRect.left - cRect.left + currRect.width/2} y2={currRect.top - cRect.top + currRect.height/2} stroke="#f43f5e" strokeWidth="12" strokeLinecap="round" className="opacity-40" />;
                    })}
                    {activePath.length > 0 && pointerPos && (
                        (() => {
                            const lastLetter = activePath[activePath.length - 1];
                            const lastRect = letterRefs.current[lastLetter.id]?.getBoundingClientRect();
                            const cRect = wheelContainerRef.current?.getBoundingClientRect();
                            if (!lastRect || !cRect) return null;
                            return <line x1={lastRect.left - cRect.left + lastRect.width/2} y1={lastRect.top - cRect.top + lastRect.height/2} x2={pointerPos.x - cRect.left} y2={pointerPos.y - cRect.top} stroke="#f43f5e" strokeWidth="12" strokeLinecap="round" className="opacity-20" />;
                        })()
                    )}
                </svg>
                {wheelLetters.map((wl, i) => {
                    const radius = window.innerWidth < 640 ? 75 : 90;
                    const c = window.innerWidth < 640 ? 110 : 130;
                    const angle = (i / wheelLetters.length) * 2 * Math.PI - Math.PI / 2;
                    const isActive = activePath.some(p => p.id === wl.id);
                    return <div key={wl.id} ref={(el) => { letterRefs.current[wl.id] = el; }} className={`absolute flex items-center justify-center w-[4.5rem] h-[4.5rem] sm:w-[5.5rem] sm:h-[5.5rem] -ml-[2.25rem] -mt-[2.25rem] sm:-ml-[2.75rem] sm:-mt-[2.75rem] rounded-full text-3xl sm:text-4xl font-black transition-all ${isActive ? 'bg-rose-500 text-white scale-110 shadow-lg border-0' : 'bg-white text-slate-800 shadow-md border-2 border-slate-100'}`} style={{ left: `${c + radius * Math.cos(angle)}px`, top: `${c + radius * Math.sin(angle)}px` }}>{wl.char}</div>;
                })}
            </div>
            <button onClick={handleShuffle} className="w-14 h-14 sm:w-16 sm:h-16 bg-indigo-500 hover:bg-indigo-400 text-white rounded-full flex items-center justify-center shadow-[0_4px_0_#4338ca,0_8px_10px_rgba(0,0,0,0.1)] active:translate-y-[4px] transition-all"><svg className="w-6 h-6 sm:w-8 sm:h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg></button>
        </div>
      </div>

      {isLevelComplete && (
          <div className="absolute inset-0 bg-white/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center animate-fadeIn">
              <div className="text-center px-8"><div className="text-7xl mb-4 animate-bounce">🎉</div><h2 className="text-4xl font-black text-slate-800 mb-2">Level Complete!</h2></div>
              <div className="flex gap-6 my-8">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl px-8 py-4 text-center shadow-sm"><div className="text-slate-500 font-bold text-xs tracking-widest uppercase mb-1">Words Found</div><div className="text-3xl font-black text-indigo-600">{foundWords.length}</div></div>
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl px-8 py-4 text-center shadow-sm"><div className="text-slate-500 font-bold text-xs tracking-widest uppercase mb-1">💎 Earned</div><div className="text-3xl font-black text-amber-500">+15</div></div>
              </div>
              <button onClick={async () => { const u = { ...profile, levelProgress: profile.levelProgress + 1, diamonds: profile.diamonds + 15 }; mockFirebase.saveProfile(u); setProfile(u); if (room && room.mode === 'Racing') await mockFirebase.updateRoom(room.code, { status: 'finished' }); await initLevel(room, u); }} className="px-12 py-6 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-2xl font-black rounded-2xl shadow-[0_8px_0_#3730A3,0_20px_30px_rgba(0,0,0,0.5)] active:translate-y-[8px] transition-all uppercase tracking-widest">Next Level</button>
          </div>
      )}
    </div>
  );
}

export default App;

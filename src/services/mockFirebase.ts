// Global Sync Service using NPoint.io public API (No Auth Required)
export interface UserProfile {
  id: string;
  name: string;
  diamonds: number;
  levelProgress: number;
  totalWordsFound: number;
}

export interface RoomInfo {
  code: string;
  hostId: string;
  mode: 'Collaborative' | 'Racing';
  wordPack: 'Common' | 'Rare';
  players: { id: string, name: string }[];
  readyPlayers: Record<string, boolean>;
  status: 'waiting' | 'playing' | 'finished';
  gridData?: any;
  foundWords: string[];
  progress: Record<string, number>;
  roomDiamonds?: number;
  lastUpdate?: number;
}

const PROFILE_KEY = 'dad-word-game-profile';

// PUBLIC DISCOVERY HUB - Used to share codes globally across phones
// This Bin ID is shared by everyone playing your specific build
// Using a public, no-auth testing relay
const API_URL = 'https://api.npoint.io/b9de9d7a83abe8f6ee1b';

export const mockFirebase = {
  getProfile: () => {
    const data = localStorage.getItem(PROFILE_KEY);
    if (!data) return null;
    const profile = JSON.parse(data);
    if (typeof profile.totalWordsFound !== 'number') profile.totalWordsFound = 0;
    return profile;
  },
  
  saveProfile: (profile: any) => {
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
  },
  
  updateDiamonds: (amount: number) => {
    const profile = mockFirebase.getProfile();
    if (!profile) return 0;
    let newDiamonds = Math.max(0, Math.min(999, profile.diamonds + amount));
    profile.diamonds = newDiamonds;
    mockFirebase.saveProfile(profile);
    return newDiamonds;
  },

  // --- CROSS-PHONE GLOBAL SYNC ---

  _getSyncState: async (): Promise<Record<string, RoomInfo>> => {
    try {
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error("Cloud Fetch Failed");
      return await res.json();
    } catch (e) {
      console.warn("[SYNC]: Cloud disconnected. Falling back to Local Session.");
      return JSON.parse(localStorage.getItem('dad-game-fallback') || '{}');
    }
  },

  _updateSyncState: async (rooms: Record<string, RoomInfo>) => {
    localStorage.setItem('dad-game-fallback', JSON.stringify(rooms));
    try {
      await fetch(API_URL, {
        method: 'POST', // NPoint uses POST to overwrite the bin content
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rooms)
      });
    } catch (e) {
      console.error("[SYNC]: Cloud Push Failed.", e);
    }
  },

  createRoom: async (hostId: string, name: string, mode: any, wordPack: any): Promise<string> => {
    const rooms = await mockFirebase._getSyncState();
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    
    rooms[code] = {
      code, hostId, mode, wordPack,
      players: [{ id: hostId, name }],
      readyPlayers: { [hostId]: false },
      status: 'waiting',
      foundWords: [],
      progress: { [hostId]: 0 },
      roomDiamonds: 0,
      lastUpdate: Date.now()
    };
    
    console.log(`[LOBBY]: Room ${code} created globally. Waiting for peers...`);
    await mockFirebase._updateSyncState(rooms);
    return code;
  },

  joinRoom: async (code: string, playerId: string, playerName: string): Promise<RoomInfo | null> => {
    const rooms = await mockFirebase._getSyncState();
    const room = rooms[code];
    if (room) {
      if (!room.players.find(p => p.id === playerId)) {
        room.players.push({ id: playerId, name: playerName });
        room.readyPlayers[playerId] = false;
        await mockFirebase._updateSyncState(rooms);
        console.log(`[LOBBY]: Room ${code} verified. Peer ${playerName} found.`);
      }
      return room;
    }
    return null;
  },

  updateRoom: async (code: string, updates: Partial<RoomInfo>) => {
    const rooms = await mockFirebase._getSyncState();
    if (rooms[code]) {
      rooms[code] = { ...rooms[code], ...updates, lastUpdate: Date.now() };
      await mockFirebase._updateSyncState(rooms);
    }
  },

  increaseRoomDiamonds: async (code: string, amount: number) => {
    const rooms = await mockFirebase._getSyncState();
    if (rooms[code]) {
      rooms[code].roomDiamonds = (rooms[code].roomDiamonds || 0) + amount;
      rooms[code].lastUpdate = Date.now();
      await mockFirebase._updateSyncState(rooms);
    }
  },
  // --- FIXED getRoom to use Cloud Sync ---
  getRoom: async (code: string): Promise<RoomInfo | null> => {
      try {
        // This line tells the phone to check the internet mailbox
        const rooms = await mockFirebase._getSyncState();
        return rooms[code] || null;
      } catch (e) {
        console.error("[SYNC]: Error fetching room", e);
        return null;
      }
    },
};
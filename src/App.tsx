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
  status: 'waiting' | 'playing' | 'finished';
  gridData?: any;
  foundWords?: string[];
  roomDiamonds?: number;
  progress?: Record<string, number>;
}

// Internal storage for our "Mock" database
const STORAGE_KEYS = {
  PROFILE: 'word_game_profile',
  ROOMS: 'word_game_rooms'
};

export const mockFirebase = {
  // --- PROFILE ACTIONS ---
  getProfile: (): UserProfile | null => {
    const data = localStorage.getItem(STORAGE_KEYS.PROFILE);
    return data ? JSON.parse(data) : null;
  },

  saveProfile: (profile: UserProfile) => {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  },

  updateDiamonds: (amount: number): number => {
    const profile = mockFirebase.getProfile();
    if (!profile) return 0;
    const newTotal = Math.max(0, profile.diamonds + amount);
    mockFirebase.saveProfile({ ...profile, diamonds: newTotal });
    return newTotal;
  },

  // --- ROOM ACTIONS (The missing parts) ---
  
  // This is the "getRoom" function your App.tsx was looking for!
  getRoom: async (code: string): Promise<RoomInfo | null> => {
    const rooms = JSON.parse(localStorage.getItem(STORAGE_KEYS.ROOMS) || '{}');
    return rooms[code] || null;
  },

  createRoom: async (room: RoomInfo) => {
    const rooms = JSON.parse(localStorage.getItem(STORAGE_KEYS.ROOMS) || '{}');
    rooms[room.code] = room;
    localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(rooms));
  },

  updateRoom: async (code: string, updates: Partial<RoomInfo>) => {
    const rooms = JSON.parse(localStorage.getItem(STORAGE_KEYS.ROOMS) || '{}');
    if (rooms[code]) {
      rooms[code] = { ...rooms[code], ...updates };
      localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(rooms));
    }
  },

  increaseRoomDiamonds: async (code: string, amount: number) => {
    const rooms = JSON.parse(localStorage.getItem(STORAGE_KEYS.ROOMS) || '{}');
    if (rooms[code]) {
      rooms[code].roomDiamonds = (rooms[code].roomDiamonds || 0) + amount;
      localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(rooms));
    }
  }
};
import { Peer } from 'peerjs';

// These definitions fix the "Cannot find name" errors
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
  mode: string;
  players: { id: string, name: string }[];
}

let peer: any = null;
let connection: any = null;

export const mockFirebase = {
  getProfile: (): UserProfile | null => {
    const data = localStorage.getItem('dad-word-game-profile');
    return data ? JSON.parse(data) : null;
  },
  
  saveProfile: (profile: UserProfile) => {
    localStorage.setItem('dad-word-game-profile', JSON.stringify(profile));
  },

  updateDiamonds: (amount: number) => {
    const profile = mockFirebase.getProfile();
    if (!profile) return 0;
    const newDiamonds = Math.max(0, profile.diamonds + amount);
    profile.diamonds = newDiamonds;
    mockFirebase.saveProfile(profile);
    return newDiamonds;
  },

  initConnection: (onDataReceived: (data: any) => void): Promise<string> => {
    peer = new Peer();
    return new Promise((resolve) => {
      peer.on('open', (id: string) => {
        resolve(id); // Use the full ID to ensure connection works
      });
      peer.on('connection', (conn: any) => {
        connection = conn;
        conn.on('data', (data: any) => onDataReceived(data));
      });
    });
  },

  joinRoom: (code: string, onDataReceived: (data: any) => void) => {
    if (!peer) peer = new Peer();
    connection = peer.connect(code);
    connection.on('open', () => {
      connection.on('data', (data: any) => onDataReceived(data));
    });
  },

  sendUpdate: (data: any) => {
    if (connection && connection.open) {
      connection.send(data);
    }
  }
};
// @ts-nocheck

// We use "window" to find Peer because we added the script to index.html
const getPeer = () => (window as any).Peer;

export const mockFirebase = {
  getProfile: () => {
    const data = localStorage.getItem('dad-word-game-profile');
    return data ? JSON.parse(data) : null;
  },
  
  saveProfile: (profile: any) => {
    localStorage.setItem('dad-word-game-profile', JSON.stringify(profile));
  },

  updateDiamonds: (amount: number) => {
    const profile = mockFirebase.getProfile();
    if (!profile) return 0;
    const current = profile.diamonds || 0;
    profile.diamonds = current + amount;
    mockFirebase.saveProfile(profile);
    return profile.diamonds;
  },

  initConnection: (onDataReceived: (data: any) => void): Promise<string> => {
    const PClass = getPeer();
    if (!PClass) return Promise.reject("PeerJS not loaded yet");
    
    const peer = new PClass();
    return new Promise((resolve) => {
      peer.on('open', (id: string) => resolve(id));
      peer.on('connection', (conn: any) => {
        conn.on('data', (data: any) => onDataReceived(data));
      });
    });
  },

  joinRoom: (code: string, onDataReceived: (data: any) => void) => {
    const PClass = getPeer();
    if (!PClass) return;
    
    const peer = new PClass();
    peer.on('open', () => {
      const conn = peer.connect(code);
      conn.on('open', () => {
        conn.on('data', (data: any) => onDataReceived(data));
      });
    });
  },

  sendUpdate: (data: any) => {
    console.log("Sync data:", data);
  }
};
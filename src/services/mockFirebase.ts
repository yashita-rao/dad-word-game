// @ts-ignore
const Peer = window.Peer; // This looks at the script we added to index.html

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
    profile.diamonds = (profile.diamonds || 0) + amount;
    mockFirebase.saveProfile(profile);
    return profile.diamonds;
  },

  initConnection: (onDataReceived: (data: any) => void): Promise<string> => {
    // @ts-ignore
    const peer = new Peer(); 
    return new Promise((resolve) => {
      peer.on('open', (id: string) => resolve(id));
      peer.on('connection', (conn: any) => {
        conn.on('data', (data: any) => onDataReceived(data));
      });
    });
  },

  joinRoom: (code: string, onDataReceived: (data: any) => void) => {
    // @ts-ignore
    const peer = new Peer();
    peer.on('open', () => {
      const conn = peer.connect(code);
      conn.on('open', () => {
        conn.on('data', (data: any) => onDataReceived(data));
      });
    });
  },

  sendUpdate: (data: any) => {
    // Note: In this simple version, we'll focus on getting the game board to show up first.
    console.log("Sending update:", data);
  }
};
// ===== 七並べ (Sevens) - Network (PeerJS WebRTC) =====

class GameNetwork {
  constructor() {
    this.peer = null;
    this.conn = null;
    this.isHost = false;
    this.roomCode = '';
    this.onConnected = null;
    this.onMessage = null;
    this.onDisconnected = null;
    this.onError = null;
  }

  generateRoomCode() {
    return String(Math.floor(1000 + Math.random() * 9000));
  }

  // --- Host ---

  createRoom() {
    return new Promise((resolve, reject) => {
      this.isHost = true;
      this.roomCode = this.generateRoomCode();
      const peerId = 'nanarabe-' + this.roomCode;

      this.peer = new Peer(peerId);

      this.peer.on('open', () => {
        resolve(this.roomCode);
      });

      this.peer.on('connection', (conn) => {
        this.conn = conn;
        this.setupConnection(conn);
      });

      this.peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
          // Room code collision, try again
          this.peer.destroy();
          this.roomCode = this.generateRoomCode();
          const newId = 'nanarabe-' + this.roomCode;
          this.peer = new Peer(newId);
          this.peer.on('open', () => resolve(this.roomCode));
          this.peer.on('connection', (conn) => {
            this.conn = conn;
            this.setupConnection(conn);
          });
          this.peer.on('error', (e) => {
            if (this.onError) this.onError(e);
            reject(e);
          });
        } else {
          if (this.onError) this.onError(err);
          reject(err);
        }
      });
    });
  }

  // --- Client ---

  joinRoom(code) {
    return new Promise((resolve, reject) => {
      this.isHost = false;
      this.roomCode = code;

      this.peer = new Peer();

      this.peer.on('open', () => {
        const hostId = 'nanarabe-' + code;
        this.conn = this.peer.connect(hostId, { reliable: true });

        this.conn.on('open', () => {
          this.setupConnection(this.conn);
          resolve();
        });

        this.conn.on('error', (err) => {
          if (this.onError) this.onError(err);
          reject(err);
        });

        // Timeout for connection
        setTimeout(() => {
          if (!this.conn || !this.conn.open) {
            reject(new Error('接続タイムアウト'));
          }
        }, 10000);
      });

      this.peer.on('error', (err) => {
        if (this.onError) this.onError(err);
        reject(err);
      });
    });
  }

  setupConnection(conn) {
    conn.on('data', (data) => {
      if (this.onMessage) this.onMessage(data);
    });

    conn.on('close', () => {
      if (this.onDisconnected) this.onDisconnected();
    });

    conn.on('error', (err) => {
      if (this.onError) this.onError(err);
    });

    if (this.onConnected) this.onConnected();
  }

  // --- Messaging ---

  send(data) {
    if (this.conn && this.conn.open) {
      this.conn.send(data);
    }
  }

  // --- Cleanup ---

  destroy() {
    if (this.conn) {
      this.conn.close();
      this.conn = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}

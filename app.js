// ===== 七並べ (Sevens) - Main App Coordinator =====

class GameApp {
  constructor() {
    this.game = null;
    this.network = new GameNetwork();
    this.ui = new GameUI();
    this.isHost = false;
    this.myPlayerIndex = -1;
    this.onLocalInput = null;
    this.onRemoteInput = null;
    this.running = false;
  }

  init() {
    this.ui.init();
    this.bindLobbyEvents();
  }

  // --- Lobby ---

  bindLobbyEvents() {
    document.getElementById('btn-create').addEventListener('click', () => this.createRoom());
    document.getElementById('btn-join').addEventListener('click', () => this.joinRoom());

    // Allow Enter key on room code input
    document.getElementById('input-code').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.joinRoom();
    });

    document.getElementById('btn-restart').addEventListener('click', () => this.restartGame());
  }

  async createRoom() {
    try {
      document.getElementById('btn-create').disabled = true;
      document.getElementById('btn-create').textContent = '作成中...';

      const code = await this.network.createRoom();
      this.isHost = true;
      this.myPlayerIndex = 0;

      this.ui.showScreen('waiting');
      this.ui.showRoomCode(code);
      this.ui.showWaitingMessage('相手の参加を待っています...');

      this.network.onConnected = () => {
        this.ui.showWaitingMessage('相手が参加しました！ゲーム開始！');
        setTimeout(() => this.startGame(), 1000);
      };

      this.network.onMessage = (data) => this.handleMessage(data);
      this.network.onDisconnected = () => this.handleDisconnect();
    } catch (err) {
      alert('部屋の作成に失敗しました: ' + err.message);
      document.getElementById('btn-create').disabled = false;
      document.getElementById('btn-create').textContent = '部屋を作る';
    }
  }

  async joinRoom() {
    const code = document.getElementById('input-code').value.trim();
    if (!code || code.length !== 4) {
      alert('4桁のルームコードを入力してください');
      return;
    }

    try {
      document.getElementById('btn-join').disabled = true;
      document.getElementById('btn-join').textContent = '接続中...';

      await this.network.joinRoom(code);
      this.isHost = false;
      this.myPlayerIndex = 2;

      this.ui.showScreen('game');
      this.ui.showMessage('ゲーム開始を待っています...', 0);

      this.network.onMessage = (data) => this.handleMessage(data);
      this.network.onDisconnected = () => this.handleDisconnect();
    } catch (err) {
      alert('接続に失敗しました: ' + err.message);
      document.getElementById('btn-join').disabled = false;
      document.getElementById('btn-join').textContent = '部屋に入る';
    }
  }

  // --- Game Start (Host only) ---

  startGame() {
    this.game = new SevenGame();
    const playerSetup = [
      { name: 'プレイヤー1', type: 'human' },
      { name: 'CPU 1', type: 'cpu' },
      { name: 'プレイヤー2', type: 'human' },
      { name: 'CPU 2', type: 'cpu' },
    ];

    this.game.initGame(playerSetup);
    this.running = true;

    // Set up card click and pass handlers
    this.ui.onCardClick = (suit, rank) => this.handleLocalCardClick(suit, rank);
    this.ui.onPassClick = () => this.handleLocalPass();

    this.ui.showScreen('game');
    this.sendStateToClient();
    this.updateLocalUI();

    // Show initial action (♦7 was auto-played)
    const startMsg = this.ui.getActionText(this.game.lastAction, this.game.players);
    this.ui.showMessage(startMsg, 1500);

    // Start game loop
    setTimeout(() => this.gameLoop(), 1500);
  }

  // --- Game Loop (Host only) ---

  async gameLoop() {
    while (this.running && !this.game.gameOver) {
      const playerIndex = this.game.currentPlayerIndex;
      const player = this.game.players[playerIndex];
      const playable = this.game.getPlayableCards(playerIndex);

      // Update UI before each turn
      this.sendStateToClient();
      this.updateLocalUI();

      if (playable.length === 0) {
        // Auto-pass or eliminate
        await this.delay(800);

        if (player.passCount >= MAX_PASSES) {
          this.game.eliminate(playerIndex);
          const msg = `${player.name}は脱落しました...`;
          this.ui.showMessage(msg, 1500);
          this.sendStateToClient();
          this.updateLocalUI();
          await this.delay(1500);
        } else {
          this.game.pass(playerIndex);
          const msg = `${player.name}はパスしました (${player.passCount}/${MAX_PASSES})`;
          this.ui.showMessage(msg, 1000);
          this.sendStateToClient();
          this.updateLocalUI();
          await this.delay(1000);
        }
        continue;
      }

      if (player.type === 'cpu') {
        // CPU turn with thinking delay
        await this.delay(800 + Math.random() * 700);
        const card = this.game.cpuChooseCard(playerIndex);
        this.game.playCard(playerIndex, card.suit, card.rank);
        const msg = `${player.name}が ${SUIT_SYMBOLS[card.suit]}${RANK_DISPLAY[card.rank]} を出しました`;
        this.ui.showMessage(msg, 1200);
        this.sendStateToClient();
        this.updateLocalUI();
        await this.delay(600);
        continue;
      }

      // Human turn
      if (playerIndex === this.myPlayerIndex) {
        // Host's turn - wait for local input
        this.sendStateToClient();
        this.updateLocalUI();
        await this.waitForLocalInput();
      } else {
        // Client's turn - send state and wait for remote input
        this.sendStateToClient();
        this.updateLocalUI();
        await this.waitForRemoteInput();
      }

      // Show what was played
      if (this.game.lastAction) {
        const msg = this.ui.getActionText(this.game.lastAction, this.game.players);
        this.ui.showMessage(msg, 1200);
        this.sendStateToClient();
        this.updateLocalUI();
        await this.delay(400);
      }
    }

    // Game over
    if (this.game.gameOver) {
      this.sendStateToClient();
      this.showGameOver();
    }
  }

  waitForLocalInput() {
    return new Promise(resolve => {
      this.onLocalInput = resolve;
    });
  }

  waitForRemoteInput() {
    return new Promise(resolve => {
      this.onRemoteInput = resolve;
    });
  }

  handleLocalCardClick(suit, rank) {
    if (!this.isHost || !this.game) return;
    if (this.game.currentPlayerIndex !== this.myPlayerIndex) return;

    if (this.game.playCard(this.myPlayerIndex, suit, rank)) {
      if (this.onLocalInput) {
        this.onLocalInput();
        this.onLocalInput = null;
      }
    }
  }

  handleLocalPass() {
    if (!this.isHost || !this.game) return;
    if (this.game.currentPlayerIndex !== this.myPlayerIndex) return;

    const player = this.game.players[this.myPlayerIndex];
    if (player.passCount < MAX_PASSES) {
      this.game.pass(this.myPlayerIndex);
      if (this.onLocalInput) {
        this.onLocalInput();
        this.onLocalInput = null;
      }
    }
  }

  // --- Network Messages ---

  handleMessage(data) {
    if (this.isHost) {
      // Host receives from Client
      if (data.type === 'PLAY_CARD') {
        const { suit, rank } = data;
        if (this.game.currentPlayerIndex === 2) { // Client is player 2
          if (this.game.playCard(2, suit, rank)) {
            if (this.onRemoteInput) {
              this.onRemoteInput();
              this.onRemoteInput = null;
            }
          }
        }
      } else if (data.type === 'PASS') {
        if (this.game.currentPlayerIndex === 2) {
          const player = this.game.players[2];
          if (player.passCount < MAX_PASSES) {
            this.game.pass(2);
            if (this.onRemoteInput) {
              this.onRemoteInput();
              this.onRemoteInput = null;
            }
          }
        }
      } else if (data.type === 'RESTART_REQUEST') {
        this.restartGame();
      }
    } else {
      // Client receives from Host
      if (data.type === 'GAME_STATE') {
        this.handleClientState(data.state);
      } else if (data.type === 'GAME_OVER') {
        this.handleClientState(data.state);
        this.showGameOver();
      } else if (data.type === 'RESTART') {
        this.ui.showScreen('game');
        this.ui.showMessage('新しいゲームを開始します...', 1500);
      }
    }
  }

  handleClientState(state) {
    // Client renders the state received from Host
    this.ui.renderGame(state);

    // Show last action message
    if (state.lastAction) {
      const msg = this.ui.getActionText(state.lastAction, state.players);
      if (msg) this.ui.showMessage(msg, 1200);
    }

    // If it's client's turn, enable interactions
    if (state.isYourTurn && (state.playableCards.length > 0 || state.players[state.yourPlayerIndex].passCount < MAX_PASSES)) {
      this.ui.onCardClick = (suit, rank) => {
        const valid = state.playableCards.some(c => c.suit === suit && c.rank === rank);
        if (valid) {
          this.network.send({ type: 'PLAY_CARD', suit, rank });
          this.ui.onCardClick = null;
          this.ui.onPassClick = null;
          this.ui.showMessage('相手の番を待っています...', 0);
        }
      };
      this.ui.onPassClick = () => {
        const myPlayer = state.players[state.yourPlayerIndex];
        if (myPlayer.passCount < MAX_PASSES) {
          this.network.send({ type: 'PASS' });
          this.ui.onCardClick = null;
          this.ui.onPassClick = null;
          this.ui.showMessage('相手の番を待っています...', 0);
        }
      };
    }

    // Show game over on client side
    if (state.gameOver) {
      this.ui.showResults(state.players, state.rankings);
      setTimeout(() => {
        this.ui.showScreen('result');
      }, 2000);
    }
  }

  sendStateToClient() {
    if (!this.isHost || !this.game) return;
    const state = this.game.getStateForPlayer(2); // Client is player 2
    this.network.send({ type: state.gameOver ? 'GAME_OVER' : 'GAME_STATE', state });
  }

  updateLocalUI() {
    if (!this.isHost || !this.game) return;
    const state = this.game.getStateForPlayer(this.myPlayerIndex);
    this.ui.renderGame(state);
  }

  // --- Game Over ---

  showGameOver() {
    if (this.isHost && this.game) {
      const state = this.game.getStateForPlayer(this.myPlayerIndex);
      this.ui.showResults(state.players, state.rankings);
    }
    setTimeout(() => {
      this.ui.showScreen('result');
    }, 2000);
  }

  // --- Restart ---

  restartGame() {
    if (this.isHost) {
      this.network.send({ type: 'RESTART' });
      this.startGame();
    } else {
      this.network.send({ type: 'RESTART_REQUEST' });
    }
  }

  // --- Disconnect ---

  handleDisconnect() {
    this.running = false;
    alert('相手との接続が切れました。ロビーに戻ります。');
    this.network.destroy();
    this.ui.showScreen('lobby');

    // Reset buttons
    document.getElementById('btn-create').disabled = false;
    document.getElementById('btn-create').textContent = '部屋を作る';
    document.getElementById('btn-join').disabled = false;
    document.getElementById('btn-join').textContent = '部屋に入る';
    document.getElementById('input-code').value = '';
  }

  // --- Utility ---

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// --- Initialize on page load ---
document.addEventListener('DOMContentLoaded', () => {
  const app = new GameApp();
  app.init();
});

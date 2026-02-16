// ===== 七並べ (Sevens) - Game Logic =====

const SUITS = ['spades', 'hearts', 'diamonds', 'clubs'];
const SUIT_SYMBOLS = { spades: '♠', hearts: '♥', diamonds: '♦', clubs: '♣' };
const SUIT_COLORS = { spades: 'black', hearts: 'red', diamonds: 'red', clubs: 'black' };
const RANK_DISPLAY = ['', 'A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const MAX_PASSES = 3;

class SevenGame {
  constructor() {
    this.board = {};
    this.players = [];
    this.currentPlayerIndex = -1;
    this.rankings = [];
    this.eliminatedOrder = [];
    this.gameOver = false;
    this.lastAction = null;
  }

  // --- Initialization ---

  reset() {
    this.board = {};
    for (const suit of SUITS) {
      this.board[suit] = new Array(14).fill(false); // index 1-13 used
    }
    this.players = [];
    this.currentPlayerIndex = -1;
    this.rankings = [];
    this.eliminatedOrder = [];
    this.gameOver = false;
    this.lastAction = null;
  }

  createDeck() {
    const deck = [];
    for (const suit of SUITS) {
      for (let rank = 1; rank <= 13; rank++) {
        deck.push({ suit, rank });
      }
    }
    return deck;
  }

  shuffle(deck) {
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  sortHand(hand) {
    const suitOrder = { spades: 0, hearts: 1, diamonds: 2, clubs: 3 };
    return hand.sort((a, b) => {
      if (suitOrder[a.suit] !== suitOrder[b.suit]) {
        return suitOrder[a.suit] - suitOrder[b.suit];
      }
      return a.rank - b.rank;
    });
  }

  initGame(playerSetup) {
    // playerSetup: [{ name, type:'human'|'cpu' }, ...]
    this.reset();
    const deck = this.shuffle(this.createDeck());

    for (let i = 0; i < 4; i++) {
      this.players.push({
        id: i,
        name: playerSetup[i].name,
        type: playerSetup[i].type,
        hand: this.sortHand(deck.slice(i * 13, (i + 1) * 13)),
        passCount: 0,
        eliminated: false,
        rank: null,
      });
    }

    // Find who has ♦7
    const startPlayer = this.players.findIndex(p =>
      p.hand.some(c => c.suit === 'diamonds' && c.rank === 7)
    );
    this.currentPlayerIndex = startPlayer;

    // Auto-play ♦7
    this.playCard(startPlayer, 'diamonds', 7);

    return startPlayer;
  }

  // --- Card Play Logic ---

  canPlay(suit, rank) {
    if (this.board[suit][rank]) return false; // already placed

    if (rank === 7) {
      return !this.board[suit][7];
    }

    if (!this.board[suit][7]) return false; // 7 must be placed first

    // Adjacency check
    if (rank > 1 && this.board[suit][rank - 1]) return true;
    if (rank < 13 && this.board[suit][rank + 1]) return true;
    return false;
  }

  getPlayableCards(playerIndex) {
    const player = this.players[playerIndex];
    if (player.eliminated || player.rank !== null) return [];
    return player.hand.filter(c => this.canPlay(c.suit, c.rank));
  }

  playCard(playerIndex, suit, rank) {
    const player = this.players[playerIndex];
    const idx = player.hand.findIndex(c => c.suit === suit && c.rank === rank);
    if (idx === -1) return false;
    if (!this.canPlay(suit, rank)) return false;

    player.hand.splice(idx, 1);
    this.board[suit][rank] = true;

    this.lastAction = { playerIndex, action: 'play', suit, rank };

    // Check if player finished
    if (player.hand.length === 0) {
      player.rank = this.rankings.length + 1;
      this.rankings.push(playerIndex);
    }

    this.advanceTurn();
    return true;
  }

  pass(playerIndex) {
    const player = this.players[playerIndex];
    player.passCount++;
    this.lastAction = { playerIndex, action: 'pass' };
    this.advanceTurn();
    return true;
  }

  eliminate(playerIndex) {
    const player = this.players[playerIndex];
    player.eliminated = true;
    this.eliminatedOrder.push(playerIndex);

    // Place all remaining cards on board
    for (const card of player.hand) {
      this.board[card.suit][card.rank] = true;
    }
    player.hand = [];

    this.lastAction = { playerIndex, action: 'eliminate' };
    this.advanceTurn();
  }

  advanceTurn() {
    const active = this.players.filter(p => !p.eliminated && p.rank === null);

    if (active.length <= 1) {
      // Assign rank to last active player
      for (const p of active) {
        p.rank = this.rankings.length + 1;
        this.rankings.push(p.id);
      }
      // Eliminated players: last eliminated = better rank
      for (let i = this.eliminatedOrder.length - 1; i >= 0; i--) {
        const pid = this.eliminatedOrder[i];
        if (this.players[pid].rank === null) {
          this.players[pid].rank = this.rankings.length + 1;
          this.rankings.push(pid);
        }
      }
      this.gameOver = true;
      return;
    }

    // Find next active player
    let next = (this.currentPlayerIndex + 1) % 4;
    let safety = 0;
    while ((this.players[next].eliminated || this.players[next].rank !== null) && safety < 4) {
      next = (next + 1) % 4;
      safety++;
    }
    this.currentPlayerIndex = next;
  }

  // --- CPU AI ---

  cpuChooseCard(playerIndex) {
    const playable = this.getPlayableCards(playerIndex);
    if (playable.length === 0) return null;

    const player = this.players[playerIndex];

    // Play 7s first (opening suits benefits everyone but is mandatory-ish strategically)
    const sevens = playable.filter(c => c.rank === 7);
    if (sevens.length > 0) {
      return sevens[0];
    }

    // If running low on passes, play closest to 7
    if (player.passCount >= 2) {
      return playable.sort((a, b) => Math.abs(a.rank - 7) - Math.abs(b.rank - 7))[0];
    }

    // Strategy: prefer playing cards closest to 7 to block extremes
    // But also consider: play cards where we have a "run" (consecutive cards)
    const scored = playable.map(card => {
      let score = 0;
      // Prefer cards closer to 7 (blocks opponents from extending)
      score -= Math.abs(card.rank - 7) * 2;
      // Prefer suits where we have many cards (keep options open)
      const suitCards = player.hand.filter(c => c.suit === card.suit).length;
      score += suitCards;
      return { card, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0].card;
  }

  // --- State Serialization ---

  getStateForPlayer(playerIndex) {
    return {
      board: this.serializeBoard(),
      players: this.players.map(p => ({
        id: p.id,
        name: p.name,
        type: p.type,
        handCount: p.hand.length,
        passCount: p.passCount,
        eliminated: p.eliminated,
        rank: p.rank,
      })),
      yourPlayerIndex: playerIndex,
      yourHand: this.players[playerIndex].hand.map(c => ({ suit: c.suit, rank: c.rank })),
      playableCards: this.getPlayableCards(playerIndex).map(c => ({ suit: c.suit, rank: c.rank })),
      currentPlayerIndex: this.currentPlayerIndex,
      isYourTurn: this.currentPlayerIndex === playerIndex,
      gameOver: this.gameOver,
      rankings: [...this.rankings],
      lastAction: this.lastAction ? { ...this.lastAction } : null,
    };
  }

  serializeBoard() {
    const b = {};
    for (const suit of SUITS) {
      b[suit] = [...this.board[suit]];
    }
    return b;
  }
}

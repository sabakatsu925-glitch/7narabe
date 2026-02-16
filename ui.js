// ===== 七並べ (Sevens) - UI Rendering =====

class GameUI {
  constructor() {
    this.onCardClick = null; // callback(suit, rank)
    this.onPassClick = null; // callback()
    this.screens = {};
    this.messageTimer = null;
  }

  init() {
    this.screens = {
      lobby: document.getElementById('screen-lobby'),
      waiting: document.getElementById('screen-waiting'),
      game: document.getElementById('screen-game'),
      result: document.getElementById('screen-result'),
    };
  }

  // --- Screen Management ---

  showScreen(name) {
    for (const [key, el] of Object.entries(this.screens)) {
      el.classList.toggle('active', key === name);
    }
  }

  // --- Lobby ---

  showRoomCode(code) {
    document.getElementById('room-code-display').textContent = code;
  }

  showWaitingMessage(msg) {
    document.getElementById('waiting-message').textContent = msg;
  }

  // --- Game Rendering ---

  renderGame(state) {
    this.renderBoard(state.board);
    this.renderPlayerInfo(state.players, state.currentPlayerIndex, state.yourPlayerIndex);
    const myPlayer = state.players[state.yourPlayerIndex];
    const canPass = state.isYourTurn && state.playableCards.length > 0 && myPlayer.passCount < MAX_PASSES && !myPlayer.eliminated && myPlayer.rank === null;
    this.renderHand(state.yourHand, state.playableCards, state.isYourTurn, canPass, myPlayer.passCount);
    this.renderTurnIndicator(state);
  }

  renderBoard(board) {
    const boardEl = document.getElementById('board');
    boardEl.innerHTML = '';

    for (const suit of SUITS) {
      const row = document.createElement('div');
      row.className = 'board-row';

      // Suit label
      const label = document.createElement('div');
      label.className = 'board-suit-label';
      label.textContent = SUIT_SYMBOLS[suit];
      label.style.color = SUIT_COLORS[suit];
      row.appendChild(label);

      // Cards A through K
      for (let rank = 1; rank <= 13; rank++) {
        const cell = document.createElement('div');
        const placed = board[suit][rank];
        cell.className = 'board-card' + (placed ? ' placed' : ' empty');

        if (placed) {
          const rankSpan = document.createElement('span');
          rankSpan.className = 'board-card-rank';
          rankSpan.textContent = RANK_DISPLAY[rank];
          rankSpan.style.color = SUIT_COLORS[suit];
          cell.appendChild(rankSpan);
        }

        if (rank === 7) {
          cell.classList.add('seven');
        }

        row.appendChild(cell);
      }

      boardEl.appendChild(row);
    }
  }

  renderPlayerInfo(players, currentPlayerIndex, myIndex) {
    const infoEl = document.getElementById('player-info');
    infoEl.innerHTML = '';

    for (const p of players) {
      const row = document.createElement('div');
      row.className = 'player-row';

      if (p.id === currentPlayerIndex) {
        row.classList.add('current-turn');
      }
      if (p.eliminated) {
        row.classList.add('eliminated');
      }
      if (p.rank !== null) {
        row.classList.add('finished');
      }

      const name = document.createElement('span');
      name.className = 'player-name';
      const displayName = p.id === myIndex ? `${p.name}(あなた)` : p.name;
      name.textContent = displayName;
      row.appendChild(name);

      const info = document.createElement('span');
      info.className = 'player-stats';

      if (p.rank !== null) {
        info.textContent = `${p.rank}位`;
      } else if (p.eliminated) {
        info.textContent = '脱落';
      } else {
        const passDisplay = p.passCount > 0 ? ` パス:${p.passCount}/${MAX_PASSES}` : '';
        info.textContent = `${p.handCount}枚${passDisplay}`;
      }
      row.appendChild(info);

      infoEl.appendChild(row);
    }
  }

  renderHand(hand, playableCards, isMyTurn, canPass, passCount) {
    const handEl = document.getElementById('hand');
    handEl.innerHTML = '';

    if (!hand || hand.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'hand-empty';
      empty.textContent = '手札なし';
      handEl.appendChild(empty);
      return;
    }

    for (const card of hand) {
      const cardEl = document.createElement('div');
      cardEl.className = 'hand-card';

      const isPlayable = isMyTurn && playableCards.some(
        c => c.suit === card.suit && c.rank === card.rank
      );

      if (isPlayable) {
        cardEl.classList.add('playable');
        cardEl.addEventListener('click', () => {
          if (this.onCardClick) {
            this.onCardClick(card.suit, card.rank);
          }
        });
      }

      const suitSpan = document.createElement('div');
      suitSpan.className = 'hand-card-suit';
      suitSpan.textContent = SUIT_SYMBOLS[card.suit];
      suitSpan.style.color = SUIT_COLORS[card.suit];

      const rankSpan = document.createElement('div');
      rankSpan.className = 'hand-card-rank';
      rankSpan.textContent = RANK_DISPLAY[card.rank];
      rankSpan.style.color = SUIT_COLORS[card.suit];

      cardEl.appendChild(rankSpan);
      cardEl.appendChild(suitSpan);

      handEl.appendChild(cardEl);
    }

    // Pass button
    if (canPass) {
      const passBtn = document.createElement('button');
      passBtn.className = 'btn-pass';
      passBtn.textContent = `パスする (残り${MAX_PASSES - passCount}回)`;
      passBtn.addEventListener('click', () => {
        if (this.onPassClick) {
          this.onPassClick();
        }
      });
      handEl.appendChild(passBtn);
    }
  }

  renderTurnIndicator(state) {
    const indicator = document.getElementById('turn-indicator');
    if (state.gameOver) {
      indicator.textContent = 'ゲーム終了！';
      indicator.className = 'turn-text game-over';
      return;
    }
    if (state.isYourTurn) {
      indicator.textContent = 'あなたの番です';
      indicator.className = 'turn-text my-turn';
    } else {
      const currentPlayer = state.players[state.currentPlayerIndex];
      indicator.textContent = `${currentPlayer.name}の番...`;
      indicator.className = 'turn-text other-turn';
    }
  }

  // --- Messages ---

  showMessage(text, duration) {
    const msgEl = document.getElementById('message-area');
    msgEl.textContent = text;
    msgEl.classList.add('visible');

    if (this.messageTimer) clearTimeout(this.messageTimer);

    if (duration) {
      this.messageTimer = setTimeout(() => {
        msgEl.classList.remove('visible');
      }, duration);
    }
  }

  hideMessage() {
    const msgEl = document.getElementById('message-area');
    msgEl.classList.remove('visible');
    if (this.messageTimer) {
      clearTimeout(this.messageTimer);
      this.messageTimer = null;
    }
  }

  // --- Results ---

  showResults(players, rankings) {
    const listEl = document.getElementById('result-list');
    listEl.innerHTML = '';

    // Sort by rank
    const sorted = [...players].sort((a, b) => (a.rank || 99) - (b.rank || 99));

    for (const p of sorted) {
      const row = document.createElement('div');
      row.className = 'result-row';
      if (p.rank === 1) row.classList.add('winner');

      const rankEl = document.createElement('span');
      rankEl.className = 'result-rank';
      const medals = { 1: '🥇', 2: '🥈', 3: '🥉', 4: '' };
      rankEl.textContent = `${medals[p.rank] || ''}${p.rank}位`;

      const nameEl = document.createElement('span');
      nameEl.className = 'result-name';
      nameEl.textContent = p.name;

      const tagEl = document.createElement('span');
      tagEl.className = 'result-tag';
      tagEl.textContent = p.eliminated ? '(脱落)' : '';

      row.appendChild(rankEl);
      row.appendChild(nameEl);
      row.appendChild(tagEl);
      listEl.appendChild(row);
    }
  }

  // --- Last Action Display ---

  getActionText(lastAction, players) {
    if (!lastAction) return '';
    const name = players[lastAction.playerIndex].name;
    switch (lastAction.action) {
      case 'play':
        return `${name}が ${SUIT_SYMBOLS[lastAction.suit]}${RANK_DISPLAY[lastAction.rank]} を出しました`;
      case 'pass':
        return `${name}がパスしました`;
      case 'eliminate':
        return `${name}が脱落しました`;
      default:
        return '';
    }
  }
}

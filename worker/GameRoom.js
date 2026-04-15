// 单个游戏房间的 Durable Object
export class GameRoom {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    this.players = [];    // [{ws, color}]
    this.board = null;
    this.history = [];
    this.currentPlayer = 1; // 1=黑, 2=白
    this.gameOver = false;
    this.scores = { 1: 0, 2: 0 };
    this.lastMove = null;
    this.undoRequester = null;
  }

  async fetch(request) {
    const url = new URL(request.url);

    // 非 WebSocket 请求（健康检查等）
    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('Expected WebSocket', { status: 400 });
    }

    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // 分配颜色
    let color = 0;
    if (this.players.length === 0) {
      color = 1; // 黑棋
    } else if (this.players.length === 1) {
      color = 2; // 白棋
    } else {
      // 房间已满，作为旁观者
      color = 0;
    }

    this.players.push({ ws: server, color });

    server.accept();
    server.addEventListener('message', (event) => {
      this.handleMessage(server, event.data);
    });
    server.addEventListener('close', () => {
      this.handleDisconnect(server);
    });

    // 先初始化棋盘（如果还没初始化）
    if (!this.board) {
      this.resetBoard();
    }

    // 发送初始状态
    this.send(server, { type: 'init', color, roomId: url.pathname.split('/room/')[1] });

    // 如果两人都到了，开始游戏
    if (this.players.length === 2) {
      this.broadcast({ type: 'start' });
    }

    // 旁观者也能看到棋盘
    if (this.players.length > 2 && this.board) {
      this.send(server, { type: 'start' });
      this.send(server, { type: 'sync', board: this.board, currentPlayer: this.currentPlayer, lastMove: this.lastMove, history: this.history });
    }

    return new Response(null, { status: 101, webSocket: client });
  }

  resetBoard() {
    this.board = Array.from({ length: 15 }, () => Array(15).fill(0));
    this.history = [];
    this.currentPlayer = 1;
    this.gameOver = false;
    this.lastMove = null;
    this.undoRequester = null;
  }

  handleMessage(ws, data) {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }

    const player = this.players.find(p => p.ws === ws);
    if (!player) return;

    switch (msg.type) {
      case 'move':
        this.handleMove(player, msg);
        break;
      case 'undo-request':
        this.handleUndoRequest(player);
        break;
      case 'undo-accept':
        this.handleUndoAccept(player);
        break;
      case 'undo-reject':
        this.handleUndoReject(player);
        break;
      case 'restart':
        this.handleRestart(player);
        break;
      case 'chat':
        this.broadcast({ type: 'chat', from: player.color, text: msg.text });
        break;
    }
  }

  handleMove(player, msg) {
    if (this.gameOver) return;
    if (player.color !== this.currentPlayer) return;
    if (!this.board) return;
    const { r, c } = msg;
    if (r < 0 || r >= 15 || c < 0 || c >= 15) return;
    if (this.board[r][c] !== 0) return;

    this.board[r][c] = player.color;
    this.history.push({ r, c, player: player.color });
    this.lastMove = [r, c];

    if (this.checkWin(r, c, player.color)) {
      this.gameOver = true;
      this.scores[player.color]++;
      this.broadcast({ type: 'move', r, c, player: player.color, lastMove: this.lastMove });
      this.broadcast({ type: 'win', player: player.color, scores: this.scores });
      return;
    }

    if (this.history.length === 15 * 15) {
      this.gameOver = true;
      this.broadcast({ type: 'move', r, c, player: player.color, lastMove: this.lastMove });
      this.broadcast({ type: 'draw' });
      return;
    }

    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    this.broadcast({ type: 'move', r, c, player: player.color, lastMove: this.lastMove, currentPlayer: this.currentPlayer });
  }

  handleUndoRequest(player) {
    if (this.history.length === 0 || this.gameOver) return;
    this.undoRequester = player.color;
    // 通知对方
    const other = this.players.find(p => p.color !== player.color);
    if (other) {
      const name = player.color === 1 ? '黑棋' : '白棋';
      this.send(other.ws, { type: 'undo-request', from: player.color, name });
    }
  }

  handleUndoAccept(player) {
    if (!this.undoRequester) return;
    // 撤回一步
    if (this.history.length > 0) {
      const move = this.history.pop();
      this.board[move.r][move.c] = 0;
    }
    this.currentPlayer = this.history.length % 2 === 0 ? 1 : 2;
    this.lastMove = this.history.length > 0 ? [this.history[this.history.length - 1].r, this.history[this.history.length - 1].c] : null;
    this.undoRequester = null;
    this.broadcast({ type: 'undo-done', board: this.board, currentPlayer: this.currentPlayer, lastMove: this.lastMove, history: this.history });
  }

  handleUndoReject(player) {
    this.undoRequester = null;
    this.broadcast({ type: 'undo-rejected' });
  }

  handleRestart(player) {
    this.resetBoard();
    this.broadcast({ type: 'restarted', board: this.board, currentPlayer: this.currentPlayer, scores: this.scores });
  }

  handleDisconnect(ws) {
    this.players = this.players.filter(p => p.ws !== ws);
    this.broadcast({ type: 'player-left', remaining: this.players.length });
  }

  checkWin(r, c, player) {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (const [dr, dc] of dirs) {
      let count = 1;
      for (let i = 1; i < 5; i++) {
        const nr = r + dr * i, nc = c + dc * i;
        if (nr < 0 || nr >= 15 || nc < 0 || nc >= 15) break;
        if (this.board[nr][nc] !== player) break;
        count++;
      }
      for (let i = 1; i < 5; i++) {
        const nr = r - dr * i, nc = c - dc * i;
        if (nr < 0 || nr >= 15 || nc < 0 || nc >= 15) break;
        if (this.board[nr][nc] !== player) break;
        count++;
      }
      if (count >= 5) return true;
    }
    return false;
  }

  send(ws, data) {
    try { ws.send(JSON.stringify(data)); } catch {}
  }

  broadcast(data) {
    for (const p of this.players) {
      this.send(p.ws, data);
    }
  }
}

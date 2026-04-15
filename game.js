// ========== 配置 ==========
const WS_URL = 'wss://wuziqi-api.tmuxp.com';
const SIZE = 15;
const CELL = 40;
const PADDING = 20;
const STONE_R = 17;
const EMPTY = 0, BLACK = 1, WHITE = 2;

// ========== 状态 ==========
let mode = null;       // 'local' | 'online'
let board = [];
let history = [];
let currentPlayer = BLACK;
let gameOver = false;
let scores = { [BLACK]: 0, [WHITE]: 0 };
let lastMove = null;
let aiEnabled = false;

// 在线模式状态
let ws = null;
let myColor = 0;
let roomId = null;
let undoRequester = null;

// ========== Canvas ==========
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

// ========== 页面切换 ==========
function showPage(id) {
    document.getElementById('lobby').classList.add('hidden');
    document.getElementById('waiting').classList.add('hidden');
    document.getElementById('game').classList.add('hidden');
    document.getElementById(id).classList.remove('hidden');
}

// ========== 大厅操作 ==========
function generateRoomId() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let id = '';
    for (let i = 0; i < 5; i++) id += chars[Math.floor(Math.random() * chars.length)];
    return id;
}

function createRoom() {
    roomId = generateRoomId();
    const link = window.location.origin + window.location.pathname + '#room=' + roomId;
    document.getElementById('room-id-display').textContent = roomId;
    document.getElementById('share-link').value = link;
    showPage('waiting');
    connectWS(roomId);
}

function joinRoom() {
    const input = document.getElementById('room-input').value.trim().toUpperCase();
    if (!input) return;
    roomId = input;
    connectWS(roomId);
}

function cancelRoom() {
    if (ws) { ws.close(); ws = null; }
    showPage('lobby');
}

function copyLink() {
    const input = document.getElementById('share-link');
    const text = input.value;
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(() => {
            const btn = document.querySelector('.btn-copy');
            btn.textContent = '已复制!';
            setTimeout(() => btn.textContent = '复制链接', 1500);
        }).catch(() => {
            fallbackCopy(text);
        });
    } else {
        fallbackCopy(text);
    }
}

function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
        document.execCommand('copy');
        const btn = document.querySelector('.btn-copy');
        btn.textContent = '已复制!';
        setTimeout(() => btn.textContent = '复制链接', 1500);
    } catch {}
    document.body.removeChild(ta);
}

function backToLobby() {
    if (ws) { ws.close(); ws = null; }
    mode = null;
    showPage('lobby');
}

// ========== 本地对战 ==========
function startLocal() {
    mode = 'local';
    aiEnabled = false;
    showPage('game');
    document.getElementById('my-color').textContent = '';
    initGame();
}

// ========== WebSocket ==========
function connectWS(roomId) {
    mode = 'online';
    const url = `${WS_URL}/room/${roomId}`;
    ws = new WebSocket(url);

    ws.onopen = () => {};

    ws.onmessage = (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }
        handleServerMsg(msg);
    };

    ws.onclose = () => {
        if (mode === 'online' && document.getElementById('game').classList.contains('hidden') === false) {
            // 游戏中断开
        }
    };

    ws.onerror = () => {};
}

function handleServerMsg(msg) {
    console.log('[server msg]', msg.type, msg);
    switch (msg.type) {
        case 'init':
            myColor = msg.color;
            break;
        case 'start':
            showPage('game');
            const colorText = myColor === 1 ? '你是黑棋' : '你是白棋';
            const colorEl = document.getElementById('my-color');
            colorEl.textContent = colorText;
            colorEl.className = 'my-color ' + (myColor === 1 ? 'black' : 'white');
            initGame();
            break;
        case 'sync':
            board = msg.board;
            currentPlayer = msg.currentPlayer;
            lastMove = msg.lastMove;
            history = msg.history || [];
            updateStatus();
            draw();
            break;
        case 'move':
            board[msg.r][msg.c] = msg.player;
            history.push({ r: msg.r, c: msg.c, player: msg.player });
            lastMove = msg.lastMove || [msg.r, msg.c];
            currentPlayer = msg.currentPlayer || (msg.player === BLACK ? WHITE : BLACK);
            updateStatus();
            draw();
            break;
        case 'win':
            gameOver = true;
            scores = msg.scores || scores;
            updateScores();
            draw();
            setTimeout(() => showWin(msg.player), 300);
            break;
        case 'draw':
            gameOver = true;
            draw();
            setTimeout(() => showDraw(), 300);
            break;
        case 'undo-request':
            // 对方请求悔棋，我需要同意或拒绝
            document.getElementById('undo-message').textContent = `${msg.name} 请求悔棋`;
            document.getElementById('undo-overlay').classList.remove('hidden');
            break;
        case 'undo-done':
            board = msg.board;
            currentPlayer = msg.currentPlayer;
            lastMove = msg.lastMove;
            history = msg.history || [];
            updateStatus();
            draw();
            break;
        case 'undo-rejected':
            break;
        case 'restarted':
            board = msg.board;
            currentPlayer = msg.currentPlayer;
            scores = msg.scores || scores;
            lastMove = null;
            gameOver = false;
            history = [];
            updateScores();
            updateStatus();
            draw();
            break;
        case 'player-left':
            break;
    }
}

// ========== 游戏初始化 ==========
function initGame() {
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
    history = [];
    currentPlayer = BLACK;
    gameOver = false;
    lastMove = null;
    document.getElementById('win-overlay').classList.add('hidden');
    updateStatus();
    updateScores();
    draw();
}

// ========== 绘制 ==========
function draw() {
    ctx.fillStyle = '#dcb35c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 木纹
    ctx.strokeStyle = 'rgba(160, 120, 40, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.height; i += 6) {
        ctx.beginPath();
        ctx.moveTo(0, i + Math.sin(i * 0.05) * 3);
        ctx.lineTo(canvas.width, i + Math.sin(i * 0.05 + 2) * 3);
        ctx.stroke();
    }

    // 网格
    ctx.strokeStyle = '#5a4320';
    ctx.lineWidth = 1;
    for (let i = 0; i < SIZE; i++) {
        const pos = PADDING + i * CELL;
        ctx.beginPath(); ctx.moveTo(PADDING, pos); ctx.lineTo(PADDING + (SIZE - 1) * CELL, pos); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(pos, PADDING); ctx.lineTo(pos, PADDING + (SIZE - 1) * CELL); ctx.stroke();
    }

    // 星位
    const stars = [3, 7, 11];
    ctx.fillStyle = '#5a4320';
    for (const r of stars) for (const c of stars) {
        ctx.beginPath(); ctx.arc(PADDING + c * CELL, PADDING + r * CELL, 4, 0, Math.PI * 2); ctx.fill();
    }

    // 棋子
    for (let r = 0; r < SIZE; r++)
        for (let c = 0; c < SIZE; c++)
            if (board[r][c] !== EMPTY) drawStone(r, c, board[r][c]);

    // 最后一手
    if (lastMove) {
        const [lr, lc] = lastMove;
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(PADDING + lc * CELL, PADDING + lr * CELL, 6, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawStone(r, c, player) {
    const x = PADDING + c * CELL, y = PADDING + r * CELL;
    ctx.beginPath(); ctx.arc(x + 2, y + 2, STONE_R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill();

    const grad = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, STONE_R);
    if (player === BLACK) { grad.addColorStop(0, '#666'); grad.addColorStop(1, '#111'); }
    else { grad.addColorStop(0, '#fff'); grad.addColorStop(1, '#bbb'); }
    ctx.beginPath(); ctx.arc(x, y, STONE_R, 0, Math.PI * 2);
    ctx.fillStyle = grad; ctx.fill();
}

// ========== 点击落子 ==========
canvas.addEventListener('click', (e) => {
    if (gameOver) return;

    // 在线模式：只能下自己的棋
    if (mode === 'online' && currentPlayer !== myColor) return;
    // 在线模式：不允许 AI
    if (mode === 'online') return handleOnlineMove(e);

    // 本地模式
    if (aiEnabled && currentPlayer === WHITE) return;
    handleLocalMove(e);
});

function getGridPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;
    const c = Math.round((mx - PADDING) / CELL);
    const r = Math.round((my - PADDING) / CELL);
    return { r, c };
}

function handleOnlineMove(e) {
    const { r, c } = getGridPos(e);
    console.log('[online move]', { r, c, myColor, currentPlayer, wsReady: ws ? ws.readyState : 'null' });
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return;
    if (board[r][c] !== EMPTY) return;
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'move', r, c }));
    } else {
        console.error('[online move] ws not open');
    }
}

function handleLocalMove(e) {
    const { r, c } = getGridPos(e);
    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return;
    if (board[r][c] !== EMPTY) return;
    placeStone(r, c);
}

// ========== 本地落子 ==========
function placeStone(r, c) {
    board[r][c] = currentPlayer;
    history.push({ r, c, player: currentPlayer });
    lastMove = [r, c];

    if (checkWin(r, c, currentPlayer)) {
        gameOver = true;
        scores[currentPlayer]++;
        updateScores();
        draw();
        setTimeout(() => showWin(currentPlayer), 300);
        return;
    }
    if (history.length === SIZE * SIZE) {
        gameOver = true;
        draw();
        setTimeout(() => showDraw(), 300);
        return;
    }

    currentPlayer = currentPlayer === BLACK ? WHITE : BLACK;
    updateStatus();
    draw();

    if (aiEnabled && currentPlayer === WHITE && !gameOver) {
        setTimeout(aiMove, 200);
    }
}

// ========== 悔棋 ==========
function undoMove() {
    if (history.length === 0 || gameOver) return;

    if (mode === 'online') {
        ws.send(JSON.stringify({ type: 'undo-request' }));
        return;
    }

    // 本地模式
    const steps = aiEnabled && history.length >= 2 ? 2 : 1;
    doUndo(steps);
}

function acceptUndo() {
    document.getElementById('undo-overlay').classList.add('hidden');
    if (mode === 'online') {
        ws.send(JSON.stringify({ type: 'undo-accept' }));
    } else {
        doUndo(1);
    }
}

function rejectUndo() {
    document.getElementById('undo-overlay').classList.add('hidden');
    if (mode === 'online') {
        ws.send(JSON.stringify({ type: 'undo-reject' }));
    }
}

function doUndo(steps) {
    for (let i = 0; i < steps && history.length > 0; i++) {
        const move = history.pop();
        board[move.r][move.c] = EMPTY;
    }
    currentPlayer = history.length % 2 === 0 ? BLACK : WHITE;
    lastMove = history.length > 0 ? [history[history.length - 1].r, history[history.length - 1].c] : null;
    updateStatus();
    draw();
}

// ========== 重新开始 ==========
function restartGame() {
    document.getElementById('win-overlay').classList.add('hidden');
    if (mode === 'online') {
        ws.send(JSON.stringify({ type: 'restart' }));
        return;
    }
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
    history = [];
    currentPlayer = BLACK;
    gameOver = false;
    lastMove = null;
    updateStatus();
    draw();
}

// ========== 胜负判定 ==========
function checkWin(r, c, player) {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (const [dr, dc] of dirs) {
        let count = 1;
        for (let i = 1; i < 5; i++) {
            const nr = r + dr * i, nc = c + dc * i;
            if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break;
            if (board[nr][nc] !== player) break;
            count++;
        }
        for (let i = 1; i < 5; i++) {
            const nr = r - dr * i, nc = c - dc * i;
            if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break;
            if (board[nr][nc] !== player) break;
            count++;
        }
        if (count >= 5) return true;
    }
    return false;
}

// ========== AI ==========
function aiMove() {
    let bestScore = -Infinity, bestMoves = [];
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (board[r][c] !== EMPTY) continue;
            if (!hasNeighbor(r, c, 2)) continue;
            const score = evaluatePos(r, c);
            if (score > bestScore) { bestScore = score; bestMoves = [{ r, c }]; }
            else if (score === bestScore) bestMoves.push({ r, c });
        }
    }
    if (bestMoves.length === 0) bestMoves = [{ r: 7, c: 7 }];
    const move = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    placeStone(move.r, move.c);
}

function hasNeighbor(r, c, dist) {
    for (let dr = -dist; dr <= dist; dr++)
        for (let dc = -dist; dc <= dist; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] !== EMPTY) return true;
        }
    return false;
}

function evaluatePos(r, c) {
    let score = 0;
    score += calcDirectionScore(r, c, WHITE) * 1.1;
    score += calcDirectionScore(r, c, BLACK);
    score += (7 - Math.abs(r - 7)) * 0.1;
    score += (7 - Math.abs(c - 7)) * 0.1;
    return score;
}

function calcDirectionScore(r, c, player) {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    let total = 0;
    for (const [dr, dc] of dirs) {
        let count = 1, openEnds = 0, blocked = false;
        for (let i = 1; i <= 4; i++) {
            const nr = r + dr * i, nc = c + dc * i;
            if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) { blocked = true; break; }
            if (board[nr][nc] === player) count++;
            else { if (board[nr][nc] === EMPTY) openEnds++; else blocked = true; break; }
        }
        if (!blocked) openEnds++;
        blocked = false;
        for (let i = 1; i <= 4; i++) {
            const nr = r - dr * i, nc = c - dc * i;
            if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) { blocked = true; break; }
            if (board[nr][nc] === player) count++;
            else { if (board[nr][nc] === EMPTY) openEnds++; else blocked = true; break; }
        }
        if (!blocked) openEnds++;
        total += patternScore(count, openEnds);
    }
    return total;
}

function patternScore(count, openEnds) {
    if (count >= 5) return 1000000;
    if (openEnds === 0) return 0;
    return ({ 4: { 1: 10000, 2: 100000 }, 3: { 1: 500, 2: 5000 }, 2: { 1: 50, 2: 500 }, 1: { 1: 10, 2: 50 } }[count]?.[openEnds]) || 0;
}

// ========== UI ==========
function updateStatus() {
    const name = currentPlayer === BLACK ? '黑棋' : '白棋';
    let text = `${name}走棋`;
    if (mode === 'online') {
        text = currentPlayer === myColor ? '轮到你下棋' : '等待对方下棋...';
    }
    document.getElementById('status').textContent = text;
    document.querySelector('.stone').className = 'stone ' + (currentPlayer === BLACK ? 'black-stone' : 'white-stone');
}

function updateScores() {
    document.getElementById('black-score').textContent = scores[BLACK];
    document.getElementById('white-score').textContent = scores[WHITE];
}

function showWin(player) {
    const name = player === BLACK ? '黑棋' : '白棋';
    if (mode === 'online') {
        document.getElementById('win-message').textContent = player === myColor ? '你赢了!' : '你输了...';
    } else {
        document.getElementById('win-message').textContent = `${name} 获胜!`;
    }
    document.getElementById('win-overlay').classList.remove('hidden');
}

function showDraw() {
    document.getElementById('win-message').textContent = '平局!';
    document.getElementById('win-overlay').classList.remove('hidden');
}

// ========== URL 自动加入房间 ==========
function checkUrlRoom() {
    const hash = window.location.hash;
    const match = hash.match(/#room=([A-Z0-9]+)/i);
    if (match) {
        roomId = match[1].toUpperCase();
        document.getElementById('room-input').value = roomId;
        connectWS(roomId);
    }
}

// ========== 启动 ==========
showPage('lobby');
checkUrlRoom();

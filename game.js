// ========== 常量 ==========
const SIZE = 15;           // 棋盘大小
const CELL = 40;           // 每格像素
const PADDING = 20;        // 边距
const STONE_R = 17;        // 棋子半径
const EMPTY = 0, BLACK = 1, WHITE = 2;

// ========== 状态 ==========
let board = [];
let history = [];
let currentPlayer = BLACK;
let gameOver = false;
let scores = { [BLACK]: 0, [WHITE]: 0 };
let aiEnabled = false;
let lastMove = null;

// ========== Canvas ==========
const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');

// ========== 初始化 ==========
function init() {
    board = Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
    history = [];
    currentPlayer = BLACK;
    gameOver = false;
    lastMove = null;
    document.getElementById('win-overlay').classList.add('hidden');
    updateStatus();
    draw();
}

// ========== 绘制 ==========
function draw() {
    // 棋盘背景
    ctx.fillStyle = '#dcb35c';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 木纹效果
    ctx.strokeStyle = 'rgba(160, 120, 40, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.height; i += 6) {
        ctx.beginPath();
        ctx.moveTo(0, i + Math.sin(i * 0.05) * 3);
        ctx.lineTo(canvas.width, i + Math.sin(i * 0.05 + 2) * 3);
        ctx.stroke();
    }

    // 网格线
    ctx.strokeStyle = '#5a4320';
    ctx.lineWidth = 1;
    for (let i = 0; i < SIZE; i++) {
        const pos = PADDING + i * CELL;
        ctx.beginPath();
        ctx.moveTo(PADDING, pos);
        ctx.lineTo(PADDING + (SIZE - 1) * CELL, pos);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos, PADDING);
        ctx.lineTo(pos, PADDING + (SIZE - 1) * CELL);
        ctx.stroke();
    }

    // 星位
    const stars = [3, 7, 11];
    ctx.fillStyle = '#5a4320';
    for (const r of stars) {
        for (const c of stars) {
            ctx.beginPath();
            ctx.arc(PADDING + c * CELL, PADDING + r * CELL, 4, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // 棋子
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (board[r][c] !== EMPTY) {
                drawStone(r, c, board[r][c]);
            }
        }
    }

    // 最后一手标记
    if (lastMove) {
        const [lr, lc] = lastMove;
        const x = PADDING + lc * CELL;
        const y = PADDING + lr * CELL;
        ctx.strokeStyle = '#e94560';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.stroke();
    }
}

function drawStone(r, c, player) {
    const x = PADDING + c * CELL;
    const y = PADDING + r * CELL;

    // 阴影
    ctx.beginPath();
    ctx.arc(x + 2, y + 2, STONE_R, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();

    // 棋子本体
    const grad = ctx.createRadialGradient(x - 5, y - 5, 2, x, y, STONE_R);
    if (player === BLACK) {
        grad.addColorStop(0, '#666');
        grad.addColorStop(1, '#111');
    } else {
        grad.addColorStop(0, '#fff');
        grad.addColorStop(1, '#bbb');
    }
    ctx.beginPath();
    ctx.arc(x, y, STONE_R, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
}

// ========== 交互 ==========
canvas.addEventListener('click', (e) => {
    if (gameOver) return;
    if (aiEnabled && currentPlayer === WHITE) return; // AI 回合不允许点击

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const mx = (e.clientX - rect.left) * scaleX;
    const my = (e.clientY - rect.top) * scaleY;

    const c = Math.round((mx - PADDING) / CELL);
    const r = Math.round((my - PADDING) / CELL);

    if (r < 0 || r >= SIZE || c < 0 || c >= SIZE) return;
    if (board[r][c] !== EMPTY) return;

    placeStone(r, c);
});

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

    // AI 走棋
    if (aiEnabled && currentPlayer === WHITE && !gameOver) {
        setTimeout(aiMove, 200);
    }
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

// ========== AI（简单评分） ==========
function aiMove() {
    let bestScore = -Infinity;
    let bestMoves = [];

    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            if (board[r][c] !== EMPTY) continue;
            if (!hasNeighbor(r, c, 2)) continue;

            const score = evaluatePos(r, c);
            if (score > bestScore) {
                bestScore = score;
                bestMoves = [{ r, c }];
            } else if (score === bestScore) {
                bestMoves.push({ r, c });
            }
        }
    }

    // 没有邻居的空位时下中心
    if (bestMoves.length === 0) {
        bestMoves = [{ r: 7, c: 7 }];
    }

    const move = bestMoves[Math.floor(Math.random() * bestMoves.length)];
    placeStone(move.r, move.c);
}

function hasNeighbor(r, c, dist) {
    for (let dr = -dist; dr <= dist; dr++) {
        for (let dc = -dist; dc <= dist; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && board[nr][nc] !== EMPTY) {
                return true;
            }
        }
    }
    return false;
}

function evaluatePos(r, c) {
    // 评估 AI（白）在此处落子的分数
    let score = 0;
    // 进攻分
    score += calcDirectionScore(r, c, WHITE) * 1.1;
    // 防守分
    score += calcDirectionScore(r, c, BLACK);
    // 中心偏好
    score += (7 - Math.abs(r - 7)) * 0.1;
    score += (7 - Math.abs(c - 7)) * 0.1;
    return score;
}

function calcDirectionScore(r, c, player) {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    let totalScore = 0;

    for (const [dr, dc] of dirs) {
        let count = 1;
        let openEnds = 0;

        // 正方向
        let blocked = false;
        for (let i = 1; i <= 4; i++) {
            const nr = r + dr * i, nc = c + dc * i;
            if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) { blocked = true; break; }
            if (board[nr][nc] === player) count++;
            else { if (board[nr][nc] === EMPTY) openEnds++; else blocked = true; break; }
        }
        if (!blocked) openEnds++;

        // 反方向
        blocked = false;
        for (let i = 1; i <= 4; i++) {
            const nr = r - dr * i, nc = c - dc * i;
            if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) { blocked = true; break; }
            if (board[nr][nc] === player) count++;
            else { if (board[nr][nc] === EMPTY) openEnds++; else blocked = true; break; }
        }
        if (!blocked) openEnds++;

        totalScore += patternScore(count, openEnds);
    }
    return totalScore;
}

function patternScore(count, openEnds) {
    if (count >= 5) return 1000000;
    if (openEnds === 0) return 0;

    const scores = {
        4: { 1: 10000, 2: 100000 },
        3: { 1: 500,   2: 5000 },
        2: { 1: 50,    2: 500 },
        1: { 1: 10,    2: 50 },
    };

    return (scores[count] && scores[count][openEnds]) || 0;
}

// ========== UI ==========
function updateStatus() {
    const statusEl = document.getElementById('status');
    const name = currentPlayer === BLACK ? '黑棋' : '白棋';
    statusEl.textContent = `${name}走棋`;
    // 更新棋子图标
    const stoneEl = document.querySelector('.stone');
    stoneEl.className = currentPlayer === BLACK ? 'stone black-stone' : 'stone white-stone';
}

function updateScores() {
    document.getElementById('black-score').textContent = scores[BLACK];
    document.getElementById('white-score').textContent = scores[WHITE];
}

function showWin(player) {
    const name = player === BLACK ? '黑棋' : '白棋';
    document.getElementById('win-message').textContent = `${name} 获胜!`;
    document.getElementById('win-overlay').classList.remove('hidden');
}

function showDraw() {
    document.getElementById('win-message').textContent = '平局!';
    document.getElementById('win-overlay').classList.remove('hidden');
}

function restartGame() {
    init();
}

function undoMove() {
    if (history.length === 0 || gameOver) return;

    // 人机模式：AI 自动同意，直接悔棋
    if (aiEnabled) {
        doUndo(2);
        return;
    }

    // 双人模式：弹出确认，请求对方同意
    const requester = history[history.length - 1].player;
    const requesterName = requester === BLACK ? '黑棋' : '白棋';
    document.getElementById('undo-message').textContent = `${requesterName} 请求悔棋`;
    document.getElementById('undo-overlay').classList.remove('hidden');
}

function acceptUndo() {
    document.getElementById('undo-overlay').classList.add('hidden');
    doUndo(1);
}

function rejectUndo() {
    document.getElementById('undo-overlay').classList.add('hidden');
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

function toggleAI() {
    aiEnabled = !aiEnabled;
    document.getElementById('btn-ai').textContent = `人机对战: ${aiEnabled ? '开' : '关'}`;
    restartGame();
}

// ========== 启动 ==========
init();

/* ===================== CONFIG GERAL ===================== */
const TOTAL_PHASES = 20;
const MAX_LIVES = 3;
let boardCols = 6; // colunas do tabuleiro serpentina (varia por fase)
let boardRows = 5; // linhas do tabuleiro serpentina

/* Temas visuais/nome para cada um dos 20 tabuleiros (trocam de novo no loop) */
const BOARD_THEMES = [
  "Trilha da Floresta", "Caminho das Estrelas", "Deserto Dourado", "Rio Congelado",
  "Vulcão Perdido", "Jardim Encantado", "Cidade Robótica", "Ilha do Tesouro",
  "Caverna de Cristal", "Pista de Corrida", "Templo Antigo", "Praia Tropical",
  "Montanha Nevada", "Labirinto Mágico", "Estação Espacial", "Fazenda Solar",
  "Recife Submarino", "Castelo Encantado", "Oficina Mecânica", "Portal Final"
];

const BOARD_THEMES_LOOP2 = [
  "Trilha Arco-Íris", "Nebulosa Distante", "Savana Dourada", "Geleira Azul",
  "Cratera de Fogo", "Pomar Mágico", "Metrópole Neon", "Baía dos Piratas",
  "Túnel de Diamantes", "Autódromo Turbo", "Pirâmide Secreta", "Atol Perdido",
  "Pico Gelado", "Floresta de Espelhos", "Anel de Saturno", "Vale Eólico",
  "Recife Bioluminescente", "Fortaleza das Nuvens", "Laboratório Secreto", "Portal Estelar"
];

/* ===================== TIPOS DE CASA ===================== */
// normal | bonus(+pontos) | coin(+moedas) | trap(-vida) | fork(escolha caminho) | start | finish

/* ===================== POWER-UPS DA LOJA ===================== */
const SHOP_ITEMS = [
  {
    id: 'dado_extra',
    icon: '🎲',
    name: 'Dado Extra',
    desc: 'Role o dado mais uma vez nesta fase',
    price: 20,
    effect: 'extraRoll'
  },
  {
    id: 'escudo',
    icon: '🛡️',
    name: 'Escudo',
    desc: 'Protege contra a próxima casa-armadilha',
    price: 25,
    effect: 'shield'
  },
  {
    id: 'impulso',
    icon: '🚀',
    name: 'Impulso',
    desc: 'Avance 2 casas extras imediatamente',
    price: 15,
    effect: 'boost2'
  },
  {
    id: 'cura',
    icon: '💖',
    name: 'Recuperar Vida',
    desc: 'Restaura 1 vida (até o máximo de 3)',
    price: 40,
    effect: 'heal'
  },
  {
    id: 'sorte',
    icon: '🍀',
    name: 'Trevo da Sorte',
    desc: 'A próxima casa de "fork" sempre dá rota segura grátis',
    price: 18,
    effect: 'luck'
  }
];

/* ===================== STATE ===================== */
let phase = 0; // 0-19
let score = 0;
let coins = 0;
let lives = MAX_LIVES;
let cycleCount = 0;

let board = [];        // array de células {type, bonus, coin, ...}
let position = 0;      // índice atual no board
let boardSize = 0;
let pendingFork = null; // {fromIndex, shortTarget, longTarget, shortPts, longPts}
let rolling = false;
let stepsRemaining = 0;

// efeitos ativos
let activeEffects = {
  extraRollsLeft: 0,
  shieldActive: false,
  luckActive: false
};

/* ===================== ELEMENTS ===================== */
const phaseNum = document.getElementById('phaseNum');
const scoreLabel = document.getElementById('scoreLabel');
const coinsLabel = document.getElementById('coinsLabel');
const livesBox = document.getElementById('livesBox');
const boardTitle = document.getElementById('boardTitle');
const boardEl = document.getElementById('board');
const tokenEl = document.getElementById('token');
const diceEl = document.getElementById('dice');
const rollBtn = document.getElementById('rollBtn');
const moveArea = document.getElementById('moveArea');
const moveBtn = document.getElementById('moveBtn');
const stepsLeftEl = document.getElementById('stepsLeft');
const pathChoice = document.getElementById('pathChoice');
const pathShortBtn = document.getElementById('pathShort');
const pathLongBtn = document.getElementById('pathLong');
const eventLog = document.getElementById('eventLog');
const shopListEl = document.getElementById('shopList');
const finishBtn = document.getElementById('finishBtn');

const startScreen = document.getElementById('startScreen');
const gameOverScreen = document.getElementById('gameOverScreen');
const winScreen = document.getElementById('winScreen');
const allDoneScreen = document.getElementById('allDoneScreen');

/* ===================== HELPERS ===================== */
function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

function flashScreen(color) {
  const flash = document.createElement('div');
  flash.className = 'flash-overlay ' + color;
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 500);
}

function log(msg) {
  eventLog.textContent = msg;
}

/* ===================== GERAÇÃO DO TABULEIRO ===================== */
/* Cada fase gera um tabuleiro com tamanho crescente (16 a 34 casas) e
   1-3 "forks" (bifurcações: atalho vs rota segura) espalhadas pelo percurso. */
function generateBoard(phaseIdx) {
  // varia o formato do tabuleiro a cada fase: colunas 5-7, linhas 4-6
  boardCols = 5 + (phaseIdx % 3); // 5,6,7,5,6,7...
  boardRows = 4 + Math.floor(phaseIdx / 5) % 3; // 4,5,6 crescendo a cada 5 fases, depois repete
  const size = boardCols * boardRows;
  const cells = [];

  for (let i = 0; i < size; i++) {
    if (i === 0) {
      cells.push({ type: 'start' });
    } else if (i === size - 1) {
      cells.push({ type: 'finish' });
    } else {
      cells.push({ type: 'normal' });
    }
  }

  // distribui casas especiais (bonus, coin, trap) no meio do tabuleiro
  const specialSlots = [];
  for (let i = 1; i < size - 1; i++) specialSlots.push(i);
  shuffleInPlace(specialSlots);

  const numBonus = Math.max(2, Math.floor(size * 0.18));
  const numCoin = Math.max(2, Math.floor(size * 0.15));
  const numTrap = Math.min(Math.floor(size * 0.12) + Math.floor(phaseIdx / 4), Math.floor(size * 0.22));

  let s = 0;
  for (let i = 0; i < numBonus && s < specialSlots.length; i++, s++) {
    const idx = specialSlots[s];
    cells[idx] = { type: 'bonus', value: rnd(10, 25) };
  }
  for (let i = 0; i < numCoin && s < specialSlots.length; i++, s++) {
    const idx = specialSlots[s];
    cells[idx] = { type: 'coin', value: rnd(3, 8) };
  }
  for (let i = 0; i < numTrap && s < specialSlots.length; i++, s++) {
    const idx = specialSlots[s];
    cells[idx] = { type: 'trap', value: 1 };
  }

  // forks: bifurcações no caminho - escolhidas entre posições normais restantes,
  // garantindo espaçamento mínimo
  const numForks = phaseIdx < 3 ? 1 : (phaseIdx < 10 ? 2 : 3);
  const forkPositions = [];
  let attempts = 0;
  while (forkPositions.length < numForks && attempts < 200) {
    attempts++;
    const candidate = rnd(2, size - 5);
    const tooClose = forkPositions.some(p => Math.abs(p - candidate) < 4);
    const cell = cells[candidate];
    if (!tooClose && (cell.type === 'normal')) {
      forkPositions.push(candidate);
    }
  }
  forkPositions.sort((a, b) => a - b);

  forkPositions.forEach(pos => {
    // atalho: pula 2-4 casas a frente (menos pontos)
    // rota segura: avança apenas 1 casa, mas dá pontos bônus extra ao "completar" o trecho
    const skip = rnd(2, 4);
    const shortTarget = Math.min(pos + skip, size - 1);
    const longTarget = pos + 1;
    cells[pos] = {
      type: 'fork',
      shortTarget,
      longTarget,
      shortPts: 5,
      longPts: 5 * skip // recompensa proporcional ao tamanho do desvio evitado
    };
  });

  return cells;
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

/* ===================== RENDER DO TABULEIRO ===================== */
const CELL_ICONS = {
  start: '🚩',
  finish: '🏆',
  normal: '',
  bonus: '⭐',
  coin: '🪙',
  trap: '⚠️',
  fork: '🔀'
};

function renderBoard() {
  const themeNames = cycleCount % 2 === 0 ? BOARD_THEMES : BOARD_THEMES_LOOP2;
  boardTitle.textContent = `Tabuleiro ${phase + 1}: ${themeNames[phase]}`;

  boardEl.innerHTML = '';
  boardEl.style.gridTemplateColumns = `repeat(${boardCols}, 1fr)`;
  boardEl.style.gridTemplateRows = `repeat(${boardRows}, auto)`;

  board.forEach((cell, i) => {
    const { row, col } = serpentinePos(i);

    const div = document.createElement('div');
    div.className = 'cell ' + cell.type;
    div.dataset.idx = i;
    div.style.gridRow = (row + 1);
    div.style.gridColumn = (col + 1);

    const num = document.createElement('div');
    num.className = 'num';
    num.textContent = i + 1;
    div.appendChild(num);

    const icon = document.createElement('div');
    icon.className = 'icon';
    icon.textContent = CELL_ICONS[cell.type] || '';
    div.appendChild(icon);

    if (cell.type === 'bonus' || cell.type === 'coin') {
      const v = document.createElement('div');
      v.className = 'val';
      v.textContent = '+' + cell.value;
      div.appendChild(v);
    }

    boardEl.appendChild(div);
  });

  drawPath();
  positionToken();
}

/* Desenha uma linha (SVG) conectando o centro de cada casa em ordem,
   criando o efeito de "estrada" sinuosa como no tabuleiro de referência */
function drawPath() {
  let svg = boardEl.querySelector('.board-path');
  if (svg) svg.remove();

  svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'board-path');
  boardEl.insertBefore(svg, boardEl.firstChild);

  // espera o layout calcular as posições dos .cell antes de medir
  requestAnimationFrame(() => {
    const boardRect = boardEl.getBoundingClientRect();
    svg.setAttribute('width', boardRect.width);
    svg.setAttribute('height', boardRect.height);
    svg.setAttribute('viewBox', `0 0 ${boardRect.width} ${boardRect.height}`);

    const cells = boardEl.querySelectorAll('.cell');
    const points = [];
    cells.forEach(c => {
      const r = c.getBoundingClientRect();
      points.push({
        x: r.left - boardRect.left + r.width / 2,
        y: r.top - boardRect.top + r.height / 2
      });
    });

    if (points.length < 2) return;

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'rgba(255,255,255,0.12)');
    path.setAttribute('stroke-width', '14');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    svg.appendChild(path);

    const dashPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    dashPath.setAttribute('d', d);
    dashPath.setAttribute('fill', 'none');
    dashPath.setAttribute('stroke', 'rgba(255,255,255,0.35)');
    dashPath.setAttribute('stroke-width', '2');
    dashPath.setAttribute('stroke-dasharray', '6 8');
    dashPath.setAttribute('stroke-linecap', 'round');
    svg.appendChild(dashPath);

    // setas de atalho (forks): linha curva colorida da casa fork até o destino do atalho
    board.forEach((cell, i) => {
      if (cell.type !== 'fork') return;
      const from = points[i];
      const to = points[cell.shortTarget];
      if (!from || !to) return;

      const midX = (from.x + to.x) / 2;
      const midY = (from.y + to.y) / 2 - 30; // curva para cima

      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrow.setAttribute('d', `M ${from.x} ${from.y} Q ${midX} ${midY} ${to.x} ${to.y}`);
      arrow.setAttribute('fill', 'none');
      arrow.setAttribute('stroke', '#ff9d4d');
      arrow.setAttribute('stroke-width', '3');
      arrow.setAttribute('stroke-dasharray', '2 6');
      arrow.setAttribute('stroke-linecap', 'round');
      arrow.setAttribute('opacity', '0.85');
      svg.appendChild(arrow);
    });
  });
}

/* Converte um índice linear (0-based, ordem de jogo) em (linha, coluna) no grid,
   seguindo um percurso serpentina: linha 0 da esquerda p/ direita, linha 1 da
   direita p/ esquerda, linha 2 esquerda p/ direita, etc. A casa 0 (start) fica
   no canto inferior esquerdo (última linha), espelhando o tabuleiro de referência. */
function serpentinePos(index) {
  const rowFromBottom = Math.floor(index / boardCols);
  const posInRow = index % boardCols;
  const row = boardRows - 1 - rowFromBottom; // começa de baixo para cima
  // linhas pares (a partir de baixo, rowFromBottom 0,2,4...) vão da esquerda p/ direita
  // linhas ímpares vão da direita p/ esquerda
  const col = (rowFromBottom % 2 === 0) ? posInRow : (boardCols - 1 - posInRow);
  return { row, col };
}

/* Calcula a posição (linha/coluna) de um índice no grid e posiciona o token */
function positionToken() {
  const cells = boardEl.querySelectorAll('.cell');
  cells.forEach(c => c.classList.remove('active-token'));

  const activeCell = cells[position];
  if (!activeCell) return;
  activeCell.classList.add('active-token');

  // posiciona o emoji do token sobre a célula ativa
  const boardRect = boardEl.getBoundingClientRect();
  const cellRect = activeCell.getBoundingClientRect();
  const left = cellRect.left - boardRect.left + cellRect.width / 2 - 12;
  const top = cellRect.top - boardRect.top + cellRect.height / 2 - 12;
  tokenEl.style.left = left + 'px';
  tokenEl.style.top = top + 'px';
}

/* ===================== DRAG DO TOKEN (TOUCH/MOUSE) ===================== */
let dragState = null; // {startX, startY, origLeft, origTop}

function enableTokenDrag() {
  tokenEl.classList.add('draggable');
}

function disableTokenDrag() {
  tokenEl.classList.remove('draggable', 'dragging');
  dragState = null;
}

tokenEl.addEventListener('pointerdown', (e) => {
  if (!tokenEl.classList.contains('draggable') || stepsRemaining <= 0 || pendingFork) return;
  e.preventDefault();
  tokenEl.classList.add('dragging');
  tokenEl.setPointerCapture(e.pointerId);

  const rect = tokenEl.getBoundingClientRect();
  dragState = {
    startX: e.clientX,
    startY: e.clientY,
    origLeft: tokenEl.offsetLeft,
    origTop: tokenEl.offsetTop
  };
});

tokenEl.addEventListener('pointermove', (e) => {
  if (!dragState) return;
  const dx = e.clientX - dragState.startX;
  const dy = e.clientY - dragState.startY;
  tokenEl.style.left = (dragState.origLeft + dx) + 'px';
  tokenEl.style.top = (dragState.origTop + dy) + 'px';
});

tokenEl.addEventListener('pointerup', (e) => {
  if (!dragState) return;
  tokenEl.classList.remove('dragging');
  tokenEl.releasePointerCapture(e.pointerId);

  const nextCell = boardEl.querySelector('.cell.next-step');
  let landedOnNext = false;

  if (nextCell) {
    const cellRect = nextCell.getBoundingClientRect();
    const tokenRect = tokenEl.getBoundingClientRect();
    const tokenCx = tokenRect.left + tokenRect.width / 2;
    const tokenCy = tokenRect.top + tokenRect.height / 2;
    landedOnNext =
      tokenCx >= cellRect.left && tokenCx <= cellRect.right &&
      tokenCy >= cellRect.top && tokenCy <= cellRect.bottom;
  }

  dragState = null;

  if (landedOnNext) {
    takeOneStep();
  } else {
    // volta para a posição atual com animação
    positionToken();
  }
});

tokenEl.addEventListener('pointercancel', () => {
  dragState = null;
  tokenEl.classList.remove('dragging');
  positionToken();
});


function setupPhase() {
  board = generateBoard(phase);
  boardSize = board.length;
  position = 0;
  pendingFork = null;
  activeEffects = { extraRollsLeft: 0, shieldActive: false, luckActive: false };

  renderBoard();
  renderShop();
  updateHUD();

  rollBtn.disabled = false;
  rollBtn.classList.remove('hidden');
  moveArea.classList.add('hidden');
  stepsRemaining = 0;
  disableTokenDrag();
  pathChoice.classList.add('hidden');
  finishBtn.classList.add('hidden');
  diceEl.textContent = '🎲';
  log('Role o dado para avançar pela trilha!');
}

/* ===================== DADO E MOVIMENTO (MANUAL) ===================== */
rollBtn.addEventListener('click', () => {
  if (rolling || pendingFork || stepsRemaining > 0) return;
  rollDice();
});

function rollDice() {
  rolling = true;
  rollBtn.disabled = true;
  diceEl.classList.add('rolling');

  let ticks = 0;
  const tickInterval = setInterval(() => {
    diceEl.textContent = '🎲 ' + (1 + (ticks % 6));
    ticks++;
  }, 60);

  setTimeout(() => {
    clearInterval(tickInterval);
    diceEl.classList.remove('rolling');
    const value = rnd(1, 6);
    diceEl.textContent = '🎲 ' + value;
    rolling = false;
    startManualMove(value);
  }, 480);
}

/* O jogador controla cada passo manualmente, arrastando o token até a próxima casa */
function startManualMove(steps) {
  stepsRemaining = steps;
  rollBtn.classList.add('hidden');
  moveArea.classList.remove('hidden');
  stepsLeftEl.textContent = stepsRemaining;
  log(`🎲 Você tirou ${steps}! Arraste o 🚀 até a próxima casa para avançar.`);
  enableTokenDrag();
  highlightNextStep();
}

/* Destaca a próxima casa para onde o token pode ser arrastado */
function highlightNextStep() {
  boardEl.querySelectorAll('.cell').forEach(c => c.classList.remove('next-step'));
  if (stepsRemaining <= 0 || pendingFork) return;
  const nextIdx = Math.min(position + 1, boardSize - 1);
  const cells = boardEl.querySelectorAll('.cell');
  if (cells[nextIdx]) cells[nextIdx].classList.add('next-step');
}

function takeOneStep() {
  if (position < boardSize - 1) {
    position++;
  }
  stepsRemaining--;
  positionToken();
  stepsLeftEl.textContent = stepsRemaining;

  if (position >= boardSize - 1) {
    stepsRemaining = 0;
    moveArea.classList.add('hidden');
    disableTokenDrag();
    clearNextStepHighlight();
    finishPhase();
    return;
  }

  const cell = board[position];

  if (cell.type === 'fork') {
    // pausa o movimento manual e oferece a bifurcação
    moveArea.classList.add('hidden');
    disableTokenDrag();
    clearNextStepHighlight();
    offerFork(cell);
    return;
  }

  applyCellEffect(cell);

  if (stepsRemaining <= 0) {
    moveArea.classList.add('hidden');
    disableTokenDrag();
    clearNextStepHighlight();
    finishTurn();
  } else {
    highlightNextStep();
  }
}

function clearNextStepHighlight() {
  boardEl.querySelectorAll('.cell').forEach(c => c.classList.remove('next-step'));
}

/* ===================== EFEITOS DAS CASAS (sem mover) ===================== */
function applyCellEffect(cell) {
  switch (cell.type) {
    case 'normal':
      log('Casa livre. Continue avançando!');
      break;

    case 'bonus':
      score += cell.value;
      flashScreen('green');
      log(`⭐ Casa de bônus! +${cell.value} pontos!`);
      updateHUD();
      break;

    case 'coin':
      coins += cell.value;
      flashScreen('gold');
      log(`🪙 Você encontrou ${cell.value} moedas!`);
      updateHUD();
      break;

    case 'trap':
      if (activeEffects.shieldActive) {
        activeEffects.shieldActive = false;
        flashScreen('green');
        log('🛡️ Seu escudo te protegeu da armadilha!');
      } else {
        lives--;
        flashScreen('red');
        log('⚠️ Armadilha! Você perdeu 1 vida.');
        updateHUD();
        if (lives <= 0) {
          stepsRemaining = 0;
          moveArea.classList.add('hidden');
          setTimeout(showGameOver, 700);
          return;
        }
      }
      break;

    default:
      break;
  }
}

function finishTurn() {
  if (activeEffects.extraRollsLeft > 0) {
    activeEffects.extraRollsLeft--;
    setTimeout(() => {
      log('🎲 Dado extra ativo — role de novo!');
      rollBtn.classList.remove('hidden');
      rollBtn.disabled = false;
    }, 300);
    return;
  }
  rollBtn.classList.remove('hidden');
  rollBtn.disabled = false;
}

/* ===================== FORK (BIFURCAÇÃO) ===================== */
function offerFork(cell) {
  pendingFork = cell;
  pathChoice.classList.remove('hidden');
  rollBtn.classList.add('hidden');

  pathShortBtn.querySelector('span').textContent =
    `vai para a casa ${cell.shortTarget + 1} (+${cell.shortPts} pts)`;
  pathLongBtn.querySelector('span').textContent =
    `vai para a casa ${cell.longTarget + 1} (+${cell.longPts} pts)`;

  if (activeEffects.luckActive) {
    log('🍀 Trevo da sorte ativo! A Rota Segura está com bônus garantido.');
  } else {
    log('🔀 Bifurcação! Escolha seu caminho.');
  }
}

pathShortBtn.addEventListener('click', () => choosePath('short'));
pathLongBtn.addEventListener('click', () => choosePath('long'));

function choosePath(kind) {
  if (!pendingFork) return;
  const cell = pendingFork;
  pendingFork = null;
  pathChoice.classList.add('hidden');

  if (kind === 'short') {
    position = cell.shortTarget;
    score += cell.shortPts;
    flashScreen('green');
    log(`⚡ Atalho! Pulou para a casa ${cell.shortTarget + 1}. +${cell.shortPts} pontos.`);
  } else {
    position = cell.longTarget;
    let pts = cell.longPts;
    if (activeEffects.luckActive) {
      pts += 10;
      activeEffects.luckActive = false;
      log(`🛡️🍀 Rota Segura com sorte! +${pts} pontos.`);
    } else {
      log(`🛡️ Rota Segura. +${pts} pontos.`);
    }
    score += pts;
    flashScreen('green');
  }

  updateHUD();
  positionToken();

  // a bifurcação encerra o movimento deste turno
  stepsRemaining = 0;
  moveArea.classList.add('hidden');

  setTimeout(() => {
    if (position >= boardSize - 1) {
      finishPhase();
    } else {
      finishTurn();
    }
  }, 400);
}

/* ===================== FIM DE FASE ===================== */
function finishPhase() {
  rolling = false;
  stepsRemaining = 0;
  rollBtn.classList.add('hidden');
  moveArea.classList.add('hidden');
  pathChoice.classList.add('hidden');
  disableTokenDrag();
  clearNextStepHighlight();

  const completionBonus = 30 + phase * 5;
  score += completionBonus;
  updateHUD();

  log(`🏆 Você chegou ao fim do tabuleiro! +${completionBonus} pontos bônus.`);
  finishBtn.classList.remove('hidden');
}

finishBtn.addEventListener('click', () => {
  document.getElementById('winText').textContent =
    `Você completou o "${(cycleCount % 2 === 0 ? BOARD_THEMES : BOARD_THEMES_LOOP2)[phase]}"!`;
  document.getElementById('winScore').textContent = score;
  winScreen.classList.remove('hidden');
});

document.getElementById('continueBtn').addEventListener('click', () => {
  winScreen.classList.add('hidden');
  if (phase + 1 >= TOTAL_PHASES) {
    document.getElementById('allDoneScore').textContent = score;
    allDoneScreen.classList.remove('hidden');
  } else {
    phase++;
    setupPhase();
  }
});

/* ===================== LOOP ===================== */
document.getElementById('loopBtn').addEventListener('click', () => {
  allDoneScreen.classList.add('hidden');
  cycleCount++;
  phase = 0;
  lives = MAX_LIVES;
  setupPhase();
});

/* ===================== LOJA DE POWER-UPS ===================== */
function renderShop() {
  shopListEl.innerHTML = '';
  SHOP_ITEMS.forEach(item => {
    const row = document.createElement('div');
    row.className = 'shop-item';

    const iconBox = document.createElement('div');
    iconBox.className = 'icon-box';
    iconBox.textContent = item.icon;

    const info = document.createElement('div');
    info.className = 'info';
    const pname = document.createElement('div');
    pname.className = 'pname';
    pname.textContent = item.name;
    const pdesc = document.createElement('div');
    pdesc.className = 'pdesc';
    pdesc.textContent = item.desc;
    const pprice = document.createElement('div');
    pprice.className = 'pprice';
    pprice.textContent = '⭐ ' + item.price;
    info.appendChild(pname);
    info.appendChild(pdesc);
    info.appendChild(pprice);

    const btn = document.createElement('button');
    btn.className = 'buy-btn';
    btn.textContent = 'Usar';
    btn.disabled = score < item.price || stepsRemaining > 0 || !!pendingFork;
    btn.addEventListener('click', () => buyPowerUp(item));

    row.appendChild(iconBox);
    row.appendChild(info);
    row.appendChild(btn);
    shopListEl.appendChild(row);
  });
}

function buyPowerUp(item) {
  if (score < item.price) return;
  score -= item.price;

  switch (item.effect) {
    case 'extraRoll':
      activeEffects.extraRollsLeft++;
      log('🎲 Dado extra adquirido! Use ao rolar novamente.');
      break;
    case 'shield':
      activeEffects.shieldActive = true;
      log('🛡️ Escudo ativado! Protegido contra a próxima armadilha.');
      break;
    case 'boost2':
      if (pendingFork || stepsRemaining > 0) {
        log('🚀 Espere terminar o movimento atual antes de usar o Impulso.');
        score += item.price; // devolve o custo
        break;
      }
      log('🚀 Impulso! Avançando 2 casas extras.');
      flashScreen('green');
      stepsRemaining += 2;
      rollBtn.classList.add('hidden');
      moveArea.classList.remove('hidden');
      stepsLeftEl.textContent = stepsRemaining;
      enableTokenDrag();
      highlightNextStep();
      break;
    case 'heal':
      if (lives < MAX_LIVES) {
        lives++;
        flashScreen('green');
        log('💖 Vida recuperada!');
      } else {
        log('💖 Suas vidas já estão completas!');
        score += item.price; // devolve o custo
      }
      break;
    case 'luck':
      activeEffects.luckActive = true;
      log('🍀 Trevo da sorte ativado para a próxima bifurcação!');
      break;
  }

  updateHUD();
  renderShop();
}

/* ===================== HUD ===================== */
function updateHUD() {
  phaseNum.textContent = (phase + 1);
  scoreLabel.textContent = score;
  coinsLabel.textContent = coins;
  const hearts = livesBox.querySelectorAll('.heart');
  hearts.forEach((h, i) => h.classList.toggle('lost', i >= lives));
  renderShop();
}

/* ===================== GAME OVER / RESET ===================== */
function showGameOver() {
  document.getElementById('goPhase').textContent = (phase + 1);
  document.getElementById('goScore').textContent = score;
  gameOverScreen.classList.remove('hidden');
}

function resetGame() {
  phase = 0;
  score = 0;
  coins = 0;
  lives = MAX_LIVES;
  cycleCount = 0;
  setupPhase();
}

document.getElementById('startBtn').addEventListener('click', () => {
  startScreen.classList.add('hidden');
  resetGame();
});

document.getElementById('restartBtn').addEventListener('click', () => {
  gameOverScreen.classList.add('hidden');
  resetGame();
});

/* Reposiciona o token se a janela for redimensionada */
window.addEventListener('resize', () => {
  if (board.length) {
    drawPath();
    positionToken();
  }
});

/* ===================== PWA ===================== */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
       

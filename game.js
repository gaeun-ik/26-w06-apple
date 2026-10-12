const BOARD_SIZE = 8;
const GAME_DURATION_SECONDS = 60;
const BEST_SCORE_KEY = 'apple-game-best-score-v1';

const boardElement = document.querySelector('#game-board');
const statusElement = document.querySelector('#game-status');
const timerElement = document.querySelector('#timer');
const timerProgressElement = document.querySelector('#timer-progress');
const confettiElement = document.querySelector('#confetti');
const scoreElement = document.querySelector('#score');
const bestScoreElement = document.querySelector('#best-score');
const selectionSumElement = document.querySelector('#selection-sum');
const sumLabelElement = document.querySelector('#sum-label');
const sumStateElement = document.querySelector('#sum-state');
const sumLineElement = document.querySelector('.sum-line');
const startButton = document.querySelector('#start-button');
const buttonLabel = document.querySelector('#button-label');

let board = createBoard();
let selection = [];
let score = 0;
let bestScore = readBestScore();
let isRunning = false;
let isPointerSelecting = false;
let activePointerId = null;
let timerInterval = null;
let confettiTimeout = null;
let deadline = 0;

function createBoard() {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => randomNumber());
}

function randomNumber() {
  return Math.floor(Math.random() * 9) + 1;
}

function readBestScore() {
  try {
    const savedScore = Number(window.localStorage.getItem(BEST_SCORE_KEY));
    return Number.isFinite(savedScore) && savedScore > 0 ? savedScore : 0;
  } catch {
    return 0;
  }
}

function saveBestScore(value) {
  try {
    window.localStorage.setItem(BEST_SCORE_KEY, String(value));
  } catch {
    statusElement.textContent = '기록을 저장할 수 없습니다';
  }
}

function selectedSum() {
  return selection.reduce((sum, index) => sum + board[index], 0);
}

function isMultipleOfTen(value) {
  return value > 0 && value % 10 === 0;
}

function renderBoard() {
  const selectedSumValue = selectedSum();
  const isValidSelection = isMultipleOfTen(selectedSumValue);
  const cells = document.createDocumentFragment();

  board.forEach((value, index) => {
    const cell = document.createElement('button');
    const isSelected = selection.includes(index);

    cell.type = 'button';
    cell.className = 'cell';
    cell.dataset.index = String(index);
    const number = document.createElement('span');
    number.className = 'cell-number';
    number.textContent = value === null ? '' : String(value);
    cell.append(number);
    cell.disabled = !isRunning || value === null;
    cell.setAttribute('aria-label', `행 ${Math.floor(index / BOARD_SIZE) + 1}, 열 ${index % BOARD_SIZE + 1}, ${value ?? '빈칸'}`);
    cell.setAttribute('aria-pressed', String(isSelected));

    if (value === null) {
      cell.classList.add('is-empty');
    }
    if (isSelected) {
      cell.classList.add('is-selected');
      if (isValidSelection) {
        cell.classList.add('is-valid');
      }
    }

    cells.append(cell);
  });

  boardElement.replaceChildren(cells);
  updateSelectionDisplay();
}

function updateSelectionDisplay() {
  const sum = selectedSum();
  const hasSelection = selection.length > 0;
  const isValid = isMultipleOfTen(sum);

  selectionSumElement.textContent = String(sum);
  sumLabelElement.textContent = hasSelection ? '선택 합계' : '현재 합계';
  sumStateElement.textContent = hasSelection
    ? (isValid ? `${selection.length}칸 획득 가능` : `${selection.length}칸 선택`)
    : '선택 대기';
  sumLineElement.classList.toggle('is-valid', hasSelection && isValid);
}

function updateScore() {
  scoreElement.textContent = String(score);

  if (score > bestScore) {
    bestScore = score;
    bestScoreElement.textContent = String(bestScore);
    saveBestScore(bestScore);
    showConfetti();
  }
}

function showConfetti() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return;
  }

  const colors = ['#e85a50', '#f2bf54', '#6e9b68', '#ed91a0', '#fff0cf'];
  const pieces = document.createDocumentFragment();

  for (let index = 0; index < 56; index += 1) {
    const piece = document.createElement('span');
    piece.className = index % 3 === 0 ? 'confetti-piece is-petal' : 'confetti-piece';
    piece.style.setProperty('--x', `${Math.random() * 100}%`);
    piece.style.setProperty('--delay', `${Math.random() * 0.3}s`);
    piece.style.setProperty('--duration', `${1.8 + Math.random() * 0.9}s`);
    piece.style.setProperty('--drift', `${Math.round((Math.random() - 0.5) * 260)}px`);
    piece.style.setProperty('--spin', `${Math.round((Math.random() - 0.5) * 1100)}deg`);
    piece.style.setProperty('--confetti-color', colors[index % colors.length]);
    pieces.append(piece);
  }

  window.clearTimeout(confettiTimeout);
  confettiElement.replaceChildren(pieces);
  confettiTimeout = window.setTimeout(() => {
    confettiElement.replaceChildren();
    confettiTimeout = null;
  }, 3200);
}

function settleBoard() {
  for (let column = 0; column < BOARD_SIZE; column += 1) {
    let writeRow = BOARD_SIZE - 1;

    for (let readRow = BOARD_SIZE - 1; readRow >= 0; readRow -= 1) {
      const sourceIndex = readRow * BOARD_SIZE + column;
      if (board[sourceIndex] === null) {
        continue;
      }

      const targetIndex = writeRow * BOARD_SIZE + column;
      board[targetIndex] = board[sourceIndex];
      if (sourceIndex !== targetIndex) {
        board[sourceIndex] = null;
      }
      writeRow -= 1;
    }

    for (let row = writeRow; row >= 0; row -= 1) {
      board[row * BOARD_SIZE + column] = randomNumber();
    }
  }
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

function updateTimer() {
  const remainingMilliseconds = Math.max(0, deadline - Date.now());
  const remainingSeconds = Math.ceil(remainingMilliseconds / 1000);
  const progress = remainingMilliseconds / (GAME_DURATION_SECONDS * 1000);
  const isUrgent = remainingSeconds <= 10;

  timerElement.textContent = formatTime(remainingSeconds);
  timerElement.setAttribute('aria-label', `남은 시간 ${formatTime(remainingSeconds)}`);
  timerElement.classList.toggle('is-urgent', isUrgent);
  timerProgressElement.style.transform = `scaleX(${progress})`;
  timerProgressElement.classList.toggle('is-urgent', isUrgent);

  if (remainingMilliseconds === 0) {
    endGame();
  }
}

function startGame() {
  window.clearInterval(timerInterval);
  board = createBoard();
  selection = [];
  score = 0;
  isRunning = true;
  isPointerSelecting = false;
  activePointerId = null;
  deadline = Date.now() + GAME_DURATION_SECONDS * 1000;

  scoreElement.textContent = '0';
  buttonLabel.textContent = '다시하기';
  statusElement.textContent = '게임 진행 중';
  renderBoard();
  updateTimer();
  timerInterval = window.setInterval(updateTimer, 100);
}

function endGame() {
  window.clearInterval(timerInterval);
  timerInterval = null;
  isRunning = false;
  isPointerSelecting = false;
  activePointerId = null;
  selection = [];
  buttonLabel.textContent = '다시하기';
  statusElement.textContent = '시간 종료';
  renderBoard();
}

function getCellAtPoint(clientX, clientY) {
  const target = document.elementFromPoint(clientX, clientY)?.closest('[data-index]');

  if (!target || !boardElement.contains(target)) {
    return null;
  }

  return Number(target.dataset.index);
}

function updateSelection(nextIndex) {
  if (!Number.isInteger(nextIndex) || board[nextIndex] === null) {
    return;
  }

  const lastIndex = selection.at(-1);
  if (nextIndex === lastIndex) {
    return;
  }

  if (selection.length > 1 && nextIndex === selection.at(-2)) {
    selection.pop();
    renderBoard();
    return;
  }

  if (selection.includes(nextIndex)) {
    return;
  }

  selection.push(nextIndex);
  renderBoard();
}

function finishSelection() {
  if (!isPointerSelecting) {
    return;
  }

  isPointerSelecting = false;
  activePointerId = null;

  const sum = selectedSum();
  if (selection.length > 0 && isMultipleOfTen(sum)) {
    const removedCount = selection.length;
    selection.forEach((index) => {
      board[index] = null;
    });
    settleBoard();
    score += removedCount;
    selection = [];
    updateScore();
    statusElement.textContent = `획득! +${removedCount}점`;
  } else if (selection.length > 0) {
    selection = [];
    statusElement.textContent = '이번에는 획득하지 못했어요';
  }

  renderBoard();
}

boardElement.addEventListener('pointerdown', (event) => {
  if (!isRunning || event.button !== 0) {
    return;
  }

  const cell = event.target.closest('[data-index]');
  if (!cell || cell.disabled) {
    return;
  }

  event.preventDefault();
  selection = [Number(cell.dataset.index)];
  isPointerSelecting = true;
  activePointerId = event.pointerId;
  boardElement.setPointerCapture(event.pointerId);
  renderBoard();
});

boardElement.addEventListener('pointermove', (event) => {
  if (!isPointerSelecting || event.pointerId !== activePointerId) {
    return;
  }

  const nextIndex = getCellAtPoint(event.clientX, event.clientY);
  updateSelection(nextIndex);
});

boardElement.addEventListener('pointerup', (event) => {
  if (event.pointerId === activePointerId) {
    finishSelection();
  }
});

boardElement.addEventListener('pointercancel', finishSelection);
startButton.addEventListener('click', startGame);

bestScoreElement.textContent = String(bestScore);
renderBoard();
import './style.css';
import { inject } from '@vercel/analytics';
import { PokerGame, type PokerGameState } from './game/PokerGame';
import { PokerRenderer } from './game/PokerRenderer';
import { BattleArena } from './game/BattleArena';
import { AIOpponent } from './game/AIOpponent';
import type { PlayerPosition } from './game/types';

// Initialize Vercel Analytics
inject();

// Canvas setup
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Set canvas size to fill window
function resizeCanvas(): void {
  canvas.width = Math.min(1200, window.innerWidth);
  canvas.height = Math.min(800, window.innerHeight);
}
resizeCanvas();
window.addEventListener('resize', () => {
  resizeCanvas();
  render();
});

// UI Elements for overlays
const resultDisplay = document.getElementById('result-display')!;
const resultTitle = document.getElementById('result-title')!;
const resultMessage = document.getElementById('result-message')!;
const continueBtn = document.getElementById('continue-btn') as HTMLButtonElement;

const gameOverDisplay = document.getElementById('game-over-display')!;
const gameOverTitle = document.getElementById('game-over-title')!;
const gameOverMessage = document.getElementById('game-over-message')!;
const playAgainBtn = document.getElementById('play-again-btn') as HTMLButtonElement;

// Game state
let pokerGame: PokerGame | null = null;
let pokerRenderer: PokerRenderer | null = null;
let battleArena: BattleArena | null = null;
const aiOpponent = new AIOpponent(0.5);

const STARTING_CHIPS = 500;

// Game mode
type GameMode = 'menu' | 'poker' | 'positioning' | 'battle';
let gameMode: GameMode = 'menu';

function render(): void {
  if (gameMode === 'menu') {
    renderMenu();
  } else if (gameMode === 'poker' && pokerGame && pokerRenderer) {
    const state = pokerGame.getState();
    const isPlayerTurn = pokerGame.isPlayerTurn();
    const canCheck = pokerGame.canCheck();
    const canCall = pokerGame.canCall();
    const canRaise = pokerGame.canRaise();
    const callAmount = pokerGame.getCallAmount();

    if (canRaise) {
      pokerRenderer.setSliderRange(pokerGame.getMinRaise(), pokerGame.getMaxRaise());
    }

    pokerRenderer.render(state, isPlayerTurn, canCheck, canCall, canRaise, callAmount);
  }
  // Battle and positioning modes are handled by BattleArena
}

function renderMenu(): void {
  const { width, height } = canvas;

  // Clear canvas
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, width, height);

  // Draw title
  ctx.fillStyle = '#ffd700';
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.fillText("BATTLE HOLD'EM", width / 2, height / 2 - 80);

  // Draw subtitle
  ctx.fillStyle = '#aaa';
  ctx.font = '18px monospace';
  ctx.fillText('Poker meets Auto-Battler', width / 2, height / 2 - 40);

  // Draw start button
  const btnWidth = 200;
  const btnHeight = 50;
  const btnX = (width - btnWidth) / 2;
  const btnY = height / 2 + 20;

  const gradient = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnHeight);
  gradient.addColorStop(0, '#22c55e');
  gradient.addColorStop(1, '#16a34a');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(btnX, btnY, btnWidth, btnHeight, 10);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px monospace';
  ctx.fillText('START GAME', width / 2, btnY + 32);

  // Store button bounds for click detection
  (canvas as any).menuButton = { x: btnX, y: btnY, width: btnWidth, height: btnHeight };
}

function handleStateChange(state: PokerGameState): void {
  // Check for game over
  if (state.gameOver) {
    showGameOver(state.winner!);
    return;
  }

  // Update game mode based on state
  if (state.round === 'positioning') {
    gameMode = 'positioning';
  } else if (state.round === 'battle') {
    gameMode = 'battle';
  } else {
    gameMode = 'poker';
    render();
  }

  // Handle AI turn
  if (state.activePlayer === 'opponent' &&
      state.round !== 'showdown' &&
      state.round !== 'positioning' &&
      state.round !== 'battle' &&
      state.round !== 'hand_complete' &&
      !state.opponent.hasFolded &&
      !state.opponent.isAllIn) {
    setTimeout(() => executeAITurn(state), 1000);
  }
}

function executeAITurn(state: PokerGameState): void {
  if (!pokerGame) return;

  const decision = aiOpponent.decideAction(state);

  switch (decision.action) {
    case 'fold':
      pokerGame.fold();
      break;
    case 'check':
      pokerGame.check();
      break;
    case 'call':
      pokerGame.call();
      break;
    case 'raise':
      if (decision.raiseAmount) {
        pokerGame.raise(decision.raiseAmount);
      }
      break;
    case 'all_in':
      pokerGame.allIn();
      break;
  }
}

function enterPositioning(): void {
  if (!pokerGame) return;

  const state = pokerGame.getState();
  pokerGame.startPositioning();

  // Initialize battle arena for positioning
  battleArena = new BattleArena(canvas, (winner) => {
    pokerGame?.resolveBattle(winner);
    // Check if game is over after resolving battle
    if (pokerGame?.isGameOver()) {
      showGameOver(pokerGame.getState().winner!);
    } else {
      showHandResult(winner, state);
    }
  });

  battleArena.setupBattle({
    playerUnits: state.player.holeCards,
    opponentUnits: state.opponent.holeCards,
    modifiers: state.communityCards
  });

  // Enter positioning mode
  battleArena.startPositioning();
  gameMode = 'positioning';
}

function startBattle(): void {
  if (!pokerGame || !battleArena) return;

  pokerGame.startBattle();
  battleArena.start();
  gameMode = 'battle';
}

function showHandResult(winner: PlayerPosition | 'tie', state: PokerGameState): void {
  if (winner === 'player') {
    resultTitle.textContent = 'You Win!';
    resultMessage.textContent = `You won ${state.pot} chips!`;
    resultTitle.style.color = '#22c55e';
  } else if (winner === 'opponent') {
    resultTitle.textContent = 'Opponent Wins';
    resultMessage.textContent = `Opponent won ${state.pot} chips.`;
    resultTitle.style.color = '#ef4444';
  } else {
    resultTitle.textContent = 'Tie!';
    resultMessage.textContent = 'Pot split evenly.';
    resultTitle.style.color = '#f59e0b';
  }

  resultDisplay.classList.remove('hidden');
}

function showGameOver(winner: PlayerPosition): void {
  if (winner === 'player') {
    gameOverTitle.textContent = 'You Win!';
    gameOverMessage.textContent = 'Congratulations! You eliminated your opponent!';
    gameOverTitle.style.color = '#22c55e';
  } else {
    gameOverTitle.textContent = 'Game Over';
    gameOverMessage.textContent = 'You ran out of chips!';
    gameOverTitle.style.color = '#ef4444';
  }

  gameOverDisplay.classList.remove('hidden');
}

function initGame(): void {
  pokerGame = new PokerGame(STARTING_CHIPS, handleStateChange);
  pokerRenderer = new PokerRenderer(canvas);
  gameMode = 'menu';
  render();
}

function startGame(): void {
  gameMode = 'poker';
  pokerGame?.startNewHand();
}

// Mouse position helper
function getMousePos(e: MouseEvent): { x: number; y: number } {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY
  };
}

// Canvas click handler
canvas.addEventListener('click', (e) => {
  const pos = getMousePos(e);

  if (gameMode === 'menu') {
    const btn = (canvas as any).menuButton;
    if (btn && pos.x >= btn.x && pos.x <= btn.x + btn.width &&
        pos.y >= btn.y && pos.y <= btn.y + btn.height) {
      startGame();
    }
    return;
  }

  if (gameMode === 'poker' && pokerRenderer && pokerGame) {
    const action = pokerRenderer.handleClick(pos.x, pos.y);
    if (action) {
      handleAction(action);
    }
    return;
  }

  if (gameMode === 'positioning' && battleArena && pokerGame) {
    const btn = battleArena.getStartBattleButtonBounds();
    if (pos.x >= btn.x && pos.x <= btn.x + btn.width &&
        pos.y >= btn.y && pos.y <= btn.y + btn.height) {
      startBattle();
    }
  }
});

// Slider drag handling
let isDraggingSlider = false;

canvas.addEventListener('mousedown', (e) => {
  if (gameMode === 'poker' && pokerRenderer && pokerGame?.canRaise()) {
    const pos = getMousePos(e);
    if (pokerRenderer.handleSliderDrag(pos.x, pos.y, true)) {
      isDraggingSlider = true;
      render();
    }
  }
});

canvas.addEventListener('mousemove', (e) => {
  if (isDraggingSlider && pokerRenderer && pokerGame?.canRaise()) {
    const pos = getMousePos(e);
    pokerRenderer.handleSliderDrag(pos.x, pos.y, true);
    render();
  }
});

canvas.addEventListener('mouseup', () => {
  isDraggingSlider = false;
});

canvas.addEventListener('mouseleave', () => {
  isDraggingSlider = false;
});

function handleAction(action: string): void {
  if (!pokerGame) return;

  switch (action) {
    case 'fold':
      pokerGame.fold();
      break;
    case 'check':
      pokerGame.check();
      break;
    case 'call':
      pokerGame.call();
      break;
    case 'raise':
      if (pokerRenderer) {
        pokerGame.raise(pokerRenderer.getSliderValue());
      }
      break;
    case 'all_in':
      pokerGame.allIn();
      break;
    case 'position':
      enterPositioning();
      break;
    case 'next_hand':
      pokerGame.startNewHand();
      break;
  }
}

// Overlay button handlers
continueBtn.addEventListener('click', () => {
  resultDisplay.classList.add('hidden');
  if (pokerGame) {
    if (pokerGame.isGameOver()) {
      showGameOver(pokerGame.getState().winner!);
    } else {
      gameMode = 'poker';
      pokerGame.startNewHand();
    }
  }
});

playAgainBtn.addEventListener('click', () => {
  gameOverDisplay.classList.add('hidden');
  initGame();
  startGame();
});

// Initialize
initGame();

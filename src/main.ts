import './style.css';
import { inject } from '@vercel/analytics';
import { PokerGame, type PokerGameState } from './game/PokerGame';
import { PokerRenderer } from './game/PokerRenderer';
import { BattleArena } from './game/BattleArena';
import { AIOpponent } from './game/AIOpponent';
import { GOD_CARDS } from './game/GodCardDeck';
import type { PlayerPosition } from './game/types';
import type { UnitCard } from './game/UnitCardDeck';

// Initialize Vercel Analytics
inject();

// Canvas setup
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

// Set canvas size - larger arena for bigger battles
function resizeCanvas(): void {
  canvas.width = Math.min(1800, window.innerWidth);
  canvas.height = Math.min(1200, window.innerHeight);
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

  // Draw test battle button on the side
  const testBtnWidth = 120;
  const testBtnHeight = 40;
  const testBtnX = width - testBtnWidth - 20;
  const testBtnY = 20;

  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.roundRect(testBtnX, testBtnY, testBtnWidth, testBtnHeight, 8);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px monospace';
  ctx.fillText('TEST BATTLE', testBtnX + testBtnWidth / 2, testBtnY + 26);

  (canvas as any).testBattleButton = { x: testBtnX, y: testBtnY, width: testBtnWidth, height: testBtnHeight };

  // Draw all swordsmen button below test battle
  const swordBtnX = testBtnX;
  const swordBtnY = testBtnY + testBtnHeight + 10;

  ctx.fillStyle = '#f59e0b';
  ctx.beginPath();
  ctx.roundRect(swordBtnX, swordBtnY, testBtnWidth, testBtnHeight, 8);
  ctx.fill();

  ctx.fillStyle = '#fff';
  ctx.font = 'bold 12px monospace';
  ctx.fillText('ALL SWORDSMEN', swordBtnX + testBtnWidth / 2, swordBtnY + 26);

  (canvas as any).swordsmenButton = { x: swordBtnX, y: swordBtnY, width: testBtnWidth, height: testBtnHeight };
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
    modifiers: state.communityCards,
    playerGodCards: state.player.godCards,
    opponentGodCards: state.opponent.godCards
  });

  // Enter positioning mode
  battleArena.startPositioning();
  gameMode = 'positioning';
}

function startBattle(): void {
  if (!battleArena) return;

  // Only call pokerGame.startBattle if we're in a real game (not test mode)
  if (pokerGame) {
    pokerGame.startBattle();
  }
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

// Test battle - skip poker and go straight to battle with 6 teams
function startTestBattle(): void {
  const unitTypes: Array<'knight' | 'swordsman' | 'archer' | 'mage' | 'healer'> = ['knight', 'swordsman', 'archer', 'mage', 'healer'];
  const unitColors: Record<string, string> = {
    knight: '#f59e0b',
    swordsman: '#ef4444',
    archer: '#22c55e',
    mage: '#a855f7',
    healer: '#22d3ee'
  };

  const randomType = () => unitTypes[Math.floor(Math.random() * unitTypes.length)];
  const createUnitCard = (id: number): UnitCard => {
    const type = randomType();
    return { id, type, name: type.charAt(0).toUpperCase() + type.slice(1), description: '', color: unitColors[type] };
  };

  // Random unit cards for all 6 teams (2 units each)
  const playerUnits: UnitCard[] = [createUnitCard(1), createUnitCard(2)];      // bottom
  const opponentUnits: UnitCard[] = [createUnitCard(3), createUnitCard(4)];    // top
  const topRightUnits: UnitCard[] = [createUnitCard(5), createUnitCard(6)];    // topRight
  const bottomRightUnits: UnitCard[] = [createUnitCard(7), createUnitCard(8)]; // bottomRight
  const bottomLeftUnits: UnitCard[] = [createUnitCard(9), createUnitCard(10)]; // bottomLeft
  const topLeftUnits: UnitCard[] = [createUnitCard(11), createUnitCard(12)];   // topLeft (was leftUnits)

  // Give player some god cards
  const shuffledGodCards = [...GOD_CARDS].sort(() => Math.random() - 0.5);
  const playerGodCards = shuffledGodCards.slice(0, 3);

  // Create battle arena
  battleArena = new BattleArena(canvas, (winner) => {
    console.log('Battle ended, winner:', winner);
    // Start a new test battle (rematch)
    startTestBattle();
  });

  battleArena.setupBattle({
    playerUnits,
    opponentUnits,
    topRightUnits,
    bottomRightUnits,
    bottomLeftUnits,
    leftUnits: topLeftUnits, // topLeft team
    modifiers: [], // No modifiers for test
    playerGodCards,
    opponentGodCards: []
  });

  // Go straight to positioning
  battleArena.startPositioning();
  gameMode = 'positioning';
}

// All swordsmen battle - all 6 teams have only swordsmen
function startSwordsmanBattle(): void {
  const createSwordsmanCard = (id: number): UnitCard => {
    return { id, type: 'swordsman', name: 'Swordsman', description: '', color: '#ef4444' };
  };

  // All swordsmen for all 6 teams (4 groups of 2 = 8 units each)
  const playerUnits: UnitCard[] = [
    createSwordsmanCard(1), createSwordsmanCard(2),
    createSwordsmanCard(3), createSwordsmanCard(4),
    createSwordsmanCard(5), createSwordsmanCard(6),
    createSwordsmanCard(7), createSwordsmanCard(8)
  ];
  const opponentUnits: UnitCard[] = [
    createSwordsmanCard(9), createSwordsmanCard(10),
    createSwordsmanCard(11), createSwordsmanCard(12),
    createSwordsmanCard(13), createSwordsmanCard(14),
    createSwordsmanCard(15), createSwordsmanCard(16)
  ];
  const topRightUnits: UnitCard[] = [
    createSwordsmanCard(17), createSwordsmanCard(18),
    createSwordsmanCard(19), createSwordsmanCard(20),
    createSwordsmanCard(21), createSwordsmanCard(22),
    createSwordsmanCard(23), createSwordsmanCard(24)
  ];
  const bottomRightUnits: UnitCard[] = [
    createSwordsmanCard(25), createSwordsmanCard(26),
    createSwordsmanCard(27), createSwordsmanCard(28),
    createSwordsmanCard(29), createSwordsmanCard(30),
    createSwordsmanCard(31), createSwordsmanCard(32)
  ];
  const bottomLeftUnits: UnitCard[] = [
    createSwordsmanCard(33), createSwordsmanCard(34),
    createSwordsmanCard(35), createSwordsmanCard(36),
    createSwordsmanCard(37), createSwordsmanCard(38),
    createSwordsmanCard(39), createSwordsmanCard(40)
  ];
  const topLeftUnits: UnitCard[] = [
    createSwordsmanCard(41), createSwordsmanCard(42),
    createSwordsmanCard(43), createSwordsmanCard(44),
    createSwordsmanCard(45), createSwordsmanCard(46),
    createSwordsmanCard(47), createSwordsmanCard(48)
  ];

  // Create battle arena
  battleArena = new BattleArena(canvas, (winner) => {
    console.log('Battle ended, winner:', winner);
    // Start a new swordsman battle (rematch)
    startSwordsmanBattle();
  });

  battleArena.setupBattle({
    playerUnits,
    opponentUnits,
    topRightUnits,
    bottomRightUnits,
    bottomLeftUnits,
    leftUnits: topLeftUnits,
    modifiers: [],
    playerGodCards: [],
    opponentGodCards: []
  });

  battleArena.startPositioning();
  gameMode = 'positioning';
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
    // Check test battle button
    const testBtn = (canvas as any).testBattleButton;
    if (testBtn && pos.x >= testBtn.x && pos.x <= testBtn.x + testBtn.width &&
        pos.y >= testBtn.y && pos.y <= testBtn.y + testBtn.height) {
      startTestBattle();
    }
    // Check all swordsmen button
    const swordBtn = (canvas as any).swordsmenButton;
    if (swordBtn && pos.x >= swordBtn.x && pos.x <= swordBtn.x + swordBtn.width &&
        pos.y >= swordBtn.y && pos.y <= swordBtn.y + swordBtn.height) {
      startSwordsmanBattle();
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

  if (gameMode === 'positioning' && battleArena) {
    const btn = battleArena.getStartBattleButtonBounds();
    if (pos.x >= btn.x && pos.x <= btn.x + btn.width &&
        pos.y >= btn.y && pos.y <= btn.y + btn.height) {
      startBattle();
    }
  }

  if (gameMode === 'battle' && battleArena) {
    // Check if showing summary screen (battle ended)
    if (battleArena.isShowingSummary()) {
      battleArena.handleRematchClick(pos.x, pos.y);
      return;
    }
    // Check if clicking on god cards UI first
    const clickedGodCard = battleArena.handleGodCardClick(pos.x, pos.y);
    // If not clicking on god card UI, handle as battlefield click for targeting
    if (!clickedGodCard) {
      battleArena.handleBattlefieldClick(pos.x, pos.y);
    }
  }
});

// Slider drag handling
let isDraggingSlider = false;

canvas.addEventListener('mousedown', (e) => {
  const pos = getMousePos(e);

  // Handle positioning mode dragging
  if (gameMode === 'positioning' && battleArena) {
    battleArena.handlePositioningMouseDown(pos.x, pos.y);
    return;
  }

  if (gameMode === 'poker' && pokerRenderer && pokerGame?.canRaise()) {
    if (pokerRenderer.handleSliderDrag(pos.x, pos.y, true)) {
      isDraggingSlider = true;
      render();
    }
  }
});

canvas.addEventListener('mousemove', (e) => {
  const pos = getMousePos(e);

  // Handle positioning mode dragging
  if (gameMode === 'positioning' && battleArena) {
    battleArena.handlePositioningMouseMove(pos.x, pos.y);
    return;
  }

  if (isDraggingSlider && pokerRenderer && pokerGame?.canRaise()) {
    pokerRenderer.handleSliderDrag(pos.x, pos.y, true);
    render();
  }
});

canvas.addEventListener('mouseup', () => {
  // Handle positioning mode
  if (gameMode === 'positioning' && battleArena) {
    battleArena.handlePositioningMouseUp();
  }

  isDraggingSlider = false;
});

canvas.addEventListener('mouseleave', () => {
  // Handle positioning mode
  if (gameMode === 'positioning' && battleArena) {
    battleArena.handlePositioningMouseUp();
  }

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

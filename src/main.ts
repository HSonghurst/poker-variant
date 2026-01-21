import './style.css';
import { inject } from '@vercel/analytics';
import { PokerGame, type PokerGameState } from './game/PokerGame';
import { PokerRenderer } from './game/PokerRenderer';
import { BattleArena } from './game/BattleArena';
import { GOD_CARDS } from './game/GodCardDeck';
import { SoundManager } from './game/SoundManager';
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

    // Check if draw phase animation completed and start auto-advance timer
    if (state.round === 'draw' && pokerRenderer.isDealAnimationComplete() && drawPhaseTimerId === null) {
      drawPhaseTimerId = window.setTimeout(() => {
        drawPhaseTimerId = null;
        if (pokerGame) {
          pokerGame.advancePhase();
        }
      }, 500); // 0.5 second gap before table cards
    }
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

// Track card reveal for table_reveal phase
let revealingCardIndex = 0;
// Track auto-advance timers
let drawPhaseTimerId: number | null = null;
let battleStartTimerId: number | null = null;

function handleStateChange(state: PokerGameState): void {
  // Check for game over
  if (state.gameOver) {
    showGameOver(state.winner!);
    return;
  }

  // Update game mode based on state
  if (state.round === 'battle') {
    gameMode = 'battle';
  } else {
    gameMode = 'poker';
    render();
  }

  // Handle phase-specific logic
  if (state.round === 'table_reveal') {
    startCardReveal();
  }
}

// Auto-flip cards one by one during table_reveal
function startCardReveal(): void {
  if (!pokerRenderer || !pokerGame) return;

  revealingCardIndex = 0;
  revealNextCard();
}

function revealNextCard(): void {
  if (!pokerRenderer || !pokerGame) return;

  if (revealingCardIndex < 5) {
    // Flip the next card
    pokerRenderer.flipCardAt(revealingCardIndex);
    SoundManager.playCardFlip();
    revealingCardIndex++;

    // Schedule next card flip
    setTimeout(() => {
      revealNextCard();
    }, 600); // 600ms between each card (25% faster)
  } else {
    // All cards revealed, advance to bidding
    setTimeout(() => {
      if (pokerGame) {
        pokerGame.setPhase('bidding');
      }
    }, 500);
  }
}

function enterPositioning(): void {
  if (!pokerGame) return;

  stopPokerAnimationLoop();
  const state = pokerGame.getState();
  pokerGame.startPositioning();

  // Get all 6 players' units (hole cards + kept cards for player)
  const getPlayerUnits = (position: string) => {
    const player = state.players.find(p => p.position === position);
    if (!player) return [];
    // Combine hole cards with kept cards
    return [...player.holeCards, ...player.keptCards];
  };

  const getPlayerGodCards = (position: string) => {
    const player = state.players.find(p => p.position === position);
    return player ? player.godCards : [];
  };

  const getKeptModifiers = (position: string) => {
    const player = state.players.find(p => p.position === position);
    return player?.keptModifierCards || [];
  };

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
    playerUnits: getPlayerUnits('player'),
    opponentUnits: getPlayerUnits('opponent'),
    topRightUnits: getPlayerUnits('topRight'),
    bottomRightUnits: getPlayerUnits('bottomRight'),
    bottomLeftUnits: getPlayerUnits('bottomLeft'),
    leftUnits: getPlayerUnits('topLeft'),
    // Community cards apply to everyone
    modifiers: state.communityCards,
    // Kept modifiers only apply to the team that owns them
    teamModifiers: {
      player: getKeptModifiers('player'),
      opponent: getKeptModifiers('opponent'),
      topLeft: getKeptModifiers('topLeft'),
      topRight: getKeptModifiers('topRight'),
      bottomLeft: getKeptModifiers('bottomLeft'),
      bottomRight: getKeptModifiers('bottomRight')
    },
    playerGodCards: getPlayerGodCards('player'),
    opponentGodCards: getPlayerGodCards('opponent')
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
  pokerRenderer?.resetCardFlips();
  pokerGame?.startNewHand();
  SoundManager.playRoundStart();
  // Start deal animation with sound callback
  pokerRenderer?.startDealAnimation(() => {
    SoundManager.playCardDraw();
  });
  startPokerAnimationLoop();
}

// Animation loop for poker card flips
let pokerAnimationId: number | null = null;

function startPokerAnimationLoop(): void {
  if (pokerAnimationId !== null) return;

  function loop(): void {
    if (gameMode === 'poker') {
      render();
      pokerAnimationId = requestAnimationFrame(loop);
    } else {
      pokerAnimationId = null;
    }
  }

  loop();
}

function stopPokerAnimationLoop(): void {
  if (pokerAnimationId !== null) {
    cancelAnimationFrame(pokerAnimationId);
    pokerAnimationId = null;
  }
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
    const state = pokerGame.getState();

    // Handle bidding phase clicks
    if (state.round === 'bidding') {
      // Check button clicks FIRST (buttons may be over cards)
      const action = pokerRenderer.handleClick(pos.x, pos.y);
      if (action) {
        handleAction(action);
        return;
      }

      // Then check for card click to select for bidding
      const cardIndex = pokerRenderer.getCommunityCardClickIndex(pos.x, pos.y);
      if (cardIndex !== null) {
        const player = state.players.find(p => p.position === 'player');
        const currentBid = player?.bids[cardIndex] || 0;
        pokerRenderer.selectCardForBidding(cardIndex, currentBid);
        return;
      }
      return;
    }

    // Handle choose phase clicks
    if (state.round === 'choose') {
      const cardClick = pokerRenderer.handleHoleCardClick(pos.x, pos.y);
      if (cardClick) {
        if (cardClick.type === 'select_hole') {
          if (!pokerGame.isKeeperSlotsFull('player')) {
            pokerGame.keepCard('player', cardClick.index);
            pokerRenderer.clearSelection();
          }
          return;
        } else if (cardClick.type === 'select_keeper') {
          const holeIndex = pokerRenderer.getSelectedHoleCardIndex();
          if (holeIndex !== null) {
            pokerGame.keepCard('player', holeIndex, cardClick.index);
            pokerRenderer.clearSelection();
          }
          return;
        }
      }

      const action = pokerRenderer.handleClick(pos.x, pos.y);
      if (action) {
        handleAction(action);
      }
      return;
    }

    // Handle other phases
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
  if (!pokerGame || !pokerRenderer) return;

  switch (action) {
    // Legacy actions
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
      pokerGame.raise(pokerRenderer.getSliderValue());
      break;
    case 'all_in':
      pokerGame.allIn();
      break;
    case 'position':
      enterPositioning();
      break;

    // New phase actions
    case 'advance_phase':
      pokerGame.advancePhase();
      break;

    // Bidding actions
    case 'bid_increase':
      pokerRenderer.incrementTempBid();
      SoundManager.playButtonClick();
      break;
    case 'bid_decrease':
      pokerRenderer.decrementTempBid();
      SoundManager.playButtonClick();
      break;
    case 'bid_confirm': {
      const cardIndex = pokerRenderer.getSelectedBidCardIndex();
      const amount = pokerRenderer.getTempBidAmount();
      if (cardIndex !== null) {
        pokerGame.placeBid('player', cardIndex, amount);
        SoundManager.playBidPlace();
        pokerRenderer.deselectBidCard();
      }
      break;
    }
    case 'bid_remove': {
      const removeIndex = pokerRenderer.getSelectedBidCardIndex();
      if (removeIndex !== null) {
        pokerGame.placeBid('player', removeIndex, 0);
        pokerRenderer.deselectBidCard();
      }
      break;
    }
    case 'confirm_all_bids': {
      // AI places their bids
      pokerGame.placeAIBids();
      // Reveal all bids and determine winners
      const results = pokerGame.revealBidsAndAwardCards();
      pokerRenderer.setBidResults(results);
      // Play win sound for each card the player won
      const playerWins = Object.values(results).filter(r => r.winner === 'player').length;
      for (let i = 0; i < playerWins; i++) {
        setTimeout(() => SoundManager.playBidWin(), i * 200);
      }
      pokerGame.setPhase('bid_reveal');
      // Auto-start battle after 2 seconds
      battleStartTimerId = window.setTimeout(() => {
        battleStartTimerId = null;
        startAutoBattle();
      }, 2000);
      break;
    }

    // start_battle is now auto-triggered after bid_reveal timer

    case 'next_hand':
      // Clear any pending timers
      if (drawPhaseTimerId !== null) {
        clearTimeout(drawPhaseTimerId);
        drawPhaseTimerId = null;
      }
      if (battleStartTimerId !== null) {
        clearTimeout(battleStartTimerId);
        battleStartTimerId = null;
      }
      // AI players keep their cards before moving to next hand
      pokerGame.makeAIKeepCards();
      pokerRenderer.resetCardFlips();
      pokerRenderer.deselectBidCard();
      pokerRenderer.clearSelection();
      pokerGame.startNewHand();
      SoundManager.playRoundStart();
      // Start deal animation with sound callback
      pokerRenderer.startDealAnimation(() => {
        SoundManager.playCardDraw();
      });
      startPokerAnimationLoop();
      break;
  }
}

// Auto-battle (skip positioning, auto-sim the fight)
function startAutoBattle(): void {
  if (!pokerGame) return;

  stopPokerAnimationLoop();
  const state = pokerGame.getState();

  // Get all 6 players' units (hole cards + kept cards)
  const getPlayerUnits = (position: string) => {
    const player = state.players.find(p => p.position === position);
    if (!player) return [];
    return [...player.holeCards, ...player.keptCards];
  };

  const getPlayerGodCards = (position: string) => {
    const player = state.players.find(p => p.position === position);
    return player ? player.godCards : [];
  };

  const getKeptModifiers = (position: string) => {
    const player = state.players.find(p => p.position === position);
    const cards = player?.keptModifierCards || [];
    if (cards.length > 0) {
      console.log(`[startAutoBattle] ${position} has ${cards.length} kept modifier cards:`, cards.map(c => c.name));
    }
    return cards;
  };

  // Initialize battle arena
  battleArena = new BattleArena(canvas, (_winner) => {
    // Apply damage based on battle rankings
    if (pokerGame && battleArena) {
      const rankings = battleArena.getBattleRankings();
      pokerGame.applyBattleDamage(rankings);
    }
    // Battle complete, go to choose phase
    pokerGame?.setPhase('choose');
    gameMode = 'poker';
    startPokerAnimationLoop();
  });

  battleArena.setupBattle({
    playerUnits: getPlayerUnits('player'),
    opponentUnits: getPlayerUnits('opponent'),
    topRightUnits: getPlayerUnits('topRight'),
    bottomRightUnits: getPlayerUnits('bottomRight'),
    bottomLeftUnits: getPlayerUnits('bottomLeft'),
    leftUnits: getPlayerUnits('topLeft'),
    // Community cards apply to everyone
    modifiers: state.communityCards,
    // Kept modifiers only apply to the team that owns them
    teamModifiers: {
      player: getKeptModifiers('player'),
      opponent: getKeptModifiers('opponent'),
      topLeft: getKeptModifiers('topLeft'),
      topRight: getKeptModifiers('topRight'),
      bottomLeft: getKeptModifiers('bottomLeft'),
      bottomRight: getKeptModifiers('bottomRight')
    },
    playerGodCards: getPlayerGodCards('player'),
    opponentGodCards: getPlayerGodCards('opponent')
  });

  // Skip positioning, go straight to battle
  battleArena.startPositioning();
  // Auto-start the battle after a brief delay
  setTimeout(() => {
    if (battleArena) {
      pokerGame?.setPhase('battle');
      battleArena.start();
      gameMode = 'battle';
    }
  }, 500);
}

// Overlay button handlers
continueBtn.addEventListener('click', () => {
  resultDisplay.classList.add('hidden');
  if (pokerGame) {
    if (pokerGame.isGameOver()) {
      showGameOver(pokerGame.getState().winner!);
    } else {
      // Return to poker view (hand_complete) to allow keeping a card
      // Don't start new hand yet - let player keep a card first
      gameMode = 'poker';
      startPokerAnimationLoop();
      render();
    }
  }
});

playAgainBtn.addEventListener('click', () => {
  gameOverDisplay.classList.add('hidden');
  initGame();
  pokerRenderer?.resetCardFlips();
  startGame();
});

// Initialize
initGame();

import type { PokerGameState, Player } from './PokerGame';
import type { UnitCard } from './UnitCardDeck';
import type { GodCard } from './GodCardDeck';
import type { Card } from './Card';
import type { FighterType, PlayerPosition } from './types';
import { SpriteRenderer } from './SpriteRenderer';

const UNIT_COLORS: Record<FighterType, string> = {
  knight: '#f59e0b',
  swordsman: '#ef4444',
  archer: '#22c55e',
  mage: '#a855f7',
  healer: '#22d3ee'
};

// Colors for each player position - must match BattleArena team mapping
const PLAYER_COLORS: Record<PlayerPosition, string> = {
  player: '#dc2626',      // red (YOU)
  opponent: '#2563eb',    // blue
  topRight: '#db2777',    // pink
  bottomRight: '#7c3aed', // purple
  bottomLeft: '#ea580c',  // orange
  topLeft: '#16a34a'      // green
};

const PLAYER_NAMES: Record<PlayerPosition, string> = {
  player: 'YOU',
  opponent: 'BLUE',
  topRight: 'PINK',
  bottomRight: 'PURPLE',
  bottomLeft: 'ORANGE',
  topLeft: 'GREEN'
};

interface Button {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  action: string;
  disabled: boolean;
  color: string;
}

interface CardFlipState {
  isRevealed: boolean;
  flipProgress: number; // 0 = face down, 1 = face up
  isFlipping: boolean;
}

export class PokerRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buttons: Button[] = [];
  private sliderValue: number = 50;
  private sliderMin: number = 20;
  private sliderMax: number = 100;

  // Card flip animation state for community cards
  private communityCardFlips: CardFlipState[] = [];
  private communityCardBounds: { x: number; y: number; width: number; height: number; index: number }[] = [];

  // Hole card bounds for keeping cards
  private holeCardBounds: { x: number; y: number; width: number; height: number; index: number }[] = [];
  // Keeper card bounds for replacement selection
  private keeperCardBounds: { x: number; y: number; width: number; height: number; index: number }[] = [];
  // State for card keeping UI
  private selectedHoleCardIndex: number | null = null;

  // Bidding state
  private selectedBidCardIndex: number | null = null;
  private tempBidAmount: number = 1;
  // Bid results for display during bid_reveal phase
  private bidResults: Record<number, { winner: PlayerPosition; amount: number }> = {};

  // Hole card deal animation state
  private holeCardDealProgress: number[] = []; // 0 = not dealt, 1 = fully dealt
  private godCardDealProgress: number[] = [];
  private isDealingCards: boolean = false;
  private dealStartTime: number = 0;
  private lastHoleCardLanded: number = -1;
  private lastGodCardLanded: number = -1;
  private onCardLand: (() => void) | null = null;

  // Layout constants
  // Unit cards (hole cards) - normal size
  private readonly CARD_WIDTH = 85;
  private readonly CARD_HEIGHT = 120;
  // Modifier cards (community cards) - 30% bigger
  private readonly MOD_CARD_WIDTH = 124;
  private readonly MOD_CARD_HEIGHT = 169;
  // God cards - smaller
  private readonly GOD_CARD_WIDTH = 60;
  private readonly GOD_CARD_HEIGHT = 80;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.resetCardFlips();
  }

  resetCardFlips(): void {
    this.communityCardFlips = [];
    for (let i = 0; i < 5; i++) {
      this.communityCardFlips.push({ isRevealed: false, flipProgress: 0, isFlipping: false });
    }
    // Reset deal animation
    this.holeCardDealProgress = [];
    this.godCardDealProgress = [];
    this.isDealingCards = false;
  }

  // Start the card dealing animation
  startDealAnimation(onCardLand?: () => void): void {
    this.isDealingCards = true;
    this.dealStartTime = Date.now();
    // 2 hole cards + 2 god cards per player = 4 cards, staggered
    this.holeCardDealProgress = [0, 0];
    this.godCardDealProgress = [0, 0];
    this.lastHoleCardLanded = -1;
    this.lastGodCardLanded = -1;
    this.onCardLand = onCardLand || null;
  }

  // Update deal animation - returns true if still animating
  updateDealAnimation(): boolean {
    if (!this.isDealingCards) return false;

    const elapsed = Date.now() - this.dealStartTime;
    const cardDuration = 300; // ms per card animation
    const cardDelay = 200; // ms between cards

    // Animate hole cards (0-1)
    for (let i = 0; i < 2; i++) {
      const cardStart = i * cardDelay;
      if (elapsed >= cardStart) {
        const cardElapsed = elapsed - cardStart;
        const prevProgress = this.holeCardDealProgress[i];
        this.holeCardDealProgress[i] = Math.min(1, cardElapsed / cardDuration);

        // Check if card just landed (crossed the 1.0 threshold)
        if (prevProgress < 1 && this.holeCardDealProgress[i] >= 1 && i > this.lastHoleCardLanded) {
          this.lastHoleCardLanded = i;
          if (this.onCardLand) this.onCardLand();
        }
      }
    }

    // Animate god cards (after hole cards)
    const godCardStartOffset = 2 * cardDelay + cardDuration;
    for (let i = 0; i < 2; i++) {
      const cardStart = godCardStartOffset + i * cardDelay;
      if (elapsed >= cardStart) {
        const cardElapsed = elapsed - cardStart;
        const prevProgress = this.godCardDealProgress[i];
        this.godCardDealProgress[i] = Math.min(1, cardElapsed / cardDuration);

        // Check if card just landed
        if (prevProgress < 1 && this.godCardDealProgress[i] >= 1 && i > this.lastGodCardLanded) {
          this.lastGodCardLanded = i;
          if (this.onCardLand) this.onCardLand();
        }
      }
    }

    // Check if animation is complete
    const allDealt = this.holeCardDealProgress.every(p => p >= 1) &&
                     this.godCardDealProgress.every(p => p >= 1);

    if (allDealt) {
      this.isDealingCards = false;
    }

    return this.isDealingCards;
  }

  isDealAnimationComplete(): boolean {
    return !this.isDealingCards &&
           this.holeCardDealProgress.length > 0 &&
           this.holeCardDealProgress.every(p => p >= 1);
  }

  updateFlipAnimations(): void {
    const flipSpeed = 0.08;

    for (const flip of this.communityCardFlips) {
      if (flip.isFlipping) {
        flip.flipProgress += flipSpeed;
        if (flip.flipProgress >= 1) {
          flip.flipProgress = 1;
          flip.isFlipping = false;
          flip.isRevealed = true;
        }
      }
    }
  }

  handleCardClick(x: number, y: number): boolean {
    for (const bounds of this.communityCardBounds) {
      if (x >= bounds.x && x <= bounds.x + bounds.width &&
          y >= bounds.y && y <= bounds.y + bounds.height) {
        const flip = this.communityCardFlips[bounds.index];
        if (flip && !flip.isRevealed && !flip.isFlipping) {
          flip.isFlipping = true;
          return true;
        }
      }
    }
    return false;
  }

  // Flip a specific card by index (for auto-reveal)
  flipCardAt(index: number): void {
    if (index >= 0 && index < this.communityCardFlips.length) {
      const flip = this.communityCardFlips[index];
      if (!flip.isRevealed && !flip.isFlipping) {
        flip.isFlipping = true;
      }
    }
  }

  allCardsRevealed(): boolean {
    return this.communityCardFlips.every(f => f.isRevealed);
  }

  // Handle clicking on a hole card to keep it
  handleHoleCardClick(x: number, y: number): { type: 'select_hole', index: number } | { type: 'select_keeper', index: number } | null {
    // Check if clicking on a hole card
    for (const bounds of this.holeCardBounds) {
      if (x >= bounds.x && x <= bounds.x + bounds.width &&
          y >= bounds.y && y <= bounds.y + bounds.height) {
        this.selectedHoleCardIndex = bounds.index;
        return { type: 'select_hole', index: bounds.index };
      }
    }

    // Check if clicking on a keeper slot (for replacement)
    if (this.selectedHoleCardIndex !== null) {
      for (const bounds of this.keeperCardBounds) {
        if (x >= bounds.x && x <= bounds.x + bounds.width &&
            y >= bounds.y && y <= bounds.y + bounds.height) {
          const result = { type: 'select_keeper' as const, index: bounds.index };
          return result;
        }
      }
    }

    // Clicked elsewhere, deselect
    this.selectedHoleCardIndex = null;
    return null;
  }

  getSelectedHoleCardIndex(): number | null {
    return this.selectedHoleCardIndex;
  }

  clearSelection(): void {
    this.selectedHoleCardIndex = null;
  }

  // Check if click is on a community card (for buying)
  getCommunityCardClickIndex(x: number, y: number): number | null {
    for (const bounds of this.communityCardBounds) {
      if (x >= bounds.x && x <= bounds.x + bounds.width &&
          y >= bounds.y && y <= bounds.y + bounds.height) {
        // Only return if card is revealed
        const flip = this.communityCardFlips[bounds.index];
        if (flip && flip.isRevealed) {
          return bounds.index;
        }
      }
    }
    return null;
  }

  render(state: PokerGameState, _isPlayerTurn: boolean, _canCheck: boolean, _canCall: boolean, _canRaise: boolean, _callAmount: number): void {
    const { width, height } = this.canvas;

    // Update flip animations
    this.updateFlipAnimations();

    // Clear card bounds for this frame
    this.communityCardBounds = [];
    this.holeCardBounds = [];
    this.keeperCardBounds = [];

    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, width, height);

    // Draw poker table background
    this.drawTableBackground();

    const player = state.players.find(p => p.position === 'player');

    // Phase-specific rendering
    switch (state.round) {
      case 'draw':
        // Update deal animation
        this.updateDealAnimation();
        // Show player cards with animation
        this.drawAllPlayersWithDealAnimation(state);
        this.drawPhaseTitle('Drawing Cards...');
        // No button - auto-advance handled by main.ts timer
        break;

      case 'table_reveal':
        // Show cards flipping
        this.drawAllPlayers(state, false);
        this.drawCommunityArea(state, false, player);
        this.drawPhaseTitle('Revealing Table Cards...');
        // Auto-advance handled by main.ts
        break;

      case 'bidding':
        // Show bidding UI
        this.buttons = []; // Reset buttons before drawing
        this.drawAllPlayers(state, false);
        this.drawCommunityAreaWithBidding(state, player);
        this.drawPhaseTitle('Place Your Bids');
        this.drawBiddingControls(state, player);
        break;

      case 'bid_reveal':
        // Show bid results
        this.drawAllPlayers(state, false);
        this.drawCommunityAreaWithResults(state, player);
        this.drawPhaseTitle('Bid Results');
        // No button - auto-start battle handled by main.ts timer
        break;

      case 'choose':
        // Show choose unit UI
        this.drawChooseUnitScene(state, player);
        break;

      // Legacy phases (keep for backwards compatibility)
      case 'showdown':
        this.drawAllPlayers(state, false);
        this.drawCommunityArea(state, false, player);
        this.drawActionButton('Position Units', 'position', width / 2, height - 32);
        break;

      case 'hand_complete':
        this.drawAllPlayers(state, true);
        this.drawCommunityArea(state, true, player);
        if (!state.gameOver) {
          this.drawActionButton('Next Hand', 'next_hand', width / 2, height - 32);
        }
        break;

      default:
        // Default rendering
        this.drawAllPlayers(state, false);
        this.drawCommunityArea(state, false, player);
    }

    // Draw game info (always visible)
    this.drawGameInfo(state);
  }

  private drawPhaseTitle(title: string): void {
    const ctx = this.ctx;
    const { width } = this.canvas;

    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(title, width / 2, 50);
  }

  private drawCommunityAreaWithBidding(state: PokerGameState, player?: Player): void {
    const { width, height } = this.canvas;
    const centerY = height / 2 - 50;
    const ctx = this.ctx;

    // Draw community cards
    const totalWidth = 5 * this.MOD_CARD_WIDTH + 4 * 10;
    const startX = (width - totalWidth) / 2;

    // Calculate available coins for max bid
    const availableCoins = player ? player.coins - Object.values(player.bids).reduce((sum, amt) => sum + amt, 0) : 0;

    for (let i = 0; i < 5; i++) {
      const cardX = startX + i * (this.MOD_CARD_WIDTH + 10);
      const card = state.communityCards[i];

      this.communityCardBounds.push({
        x: cardX, y: centerY, width: this.MOD_CARD_WIDTH, height: this.MOD_CARD_HEIGHT, index: i
      });

      if (card) {
        const flip = this.communityCardFlips[i];
        if (flip && flip.isRevealed) {
          this.drawModifierCard(card, cardX, centerY);

          // Draw player's current bid on this card (only if not selected)
          const playerBid = player?.bids[i] || 0;
          if (playerBid > 0 && this.selectedBidCardIndex !== i) {
            ctx.fillStyle = '#22c55e';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`🪙 ${playerBid}`, cardX + this.MOD_CARD_WIDTH / 2, centerY - 10);
          }

          // If this card is selected, show +/- controls over it
          if (this.selectedBidCardIndex === i) {
            // Highlight border
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.roundRect(cardX - 4, centerY - 4, this.MOD_CARD_WIDTH + 8, this.MOD_CARD_HEIGHT + 8, 12);
            ctx.stroke();

            // Semi-transparent overlay
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.beginPath();
            ctx.roundRect(cardX, centerY, this.MOD_CARD_WIDTH, this.MOD_CARD_HEIGHT, 10);
            ctx.fill();

            // Bid amount display
            ctx.fillStyle = '#fbbf24';
            ctx.font = 'bold 24px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(`🪙 ${this.tempBidAmount}`, cardX + this.MOD_CARD_WIDTH / 2, centerY + 50);

            // Calculate max bid for this card
            const currentBid = player?.bids[i] || 0;
            const maxBid = availableCoins + currentBid;

            // +/- buttons over the card
            const btnWidth = 40;
            const btnHeight = 35;
            const btnY = centerY + 70;
            const minusBtnX = cardX + this.MOD_CARD_WIDTH / 2 - btnWidth - 10;
            const plusBtnX = cardX + this.MOD_CARD_WIDTH / 2 + 10;

            this.addButton(minusBtnX, btnY, btnWidth, btnHeight, '-', 'bid_decrease', this.tempBidAmount <= 0, '#ef4444');
            this.addButton(plusBtnX, btnY, btnWidth, btnHeight, '+', 'bid_increase', this.tempBidAmount >= maxBid, '#22c55e');

            // Set Bid button
            const setBtnWidth = 80;
            const setBtnY = centerY + 115;
            this.addButton(cardX + this.MOD_CARD_WIDTH / 2 - setBtnWidth / 2, setBtnY, setBtnWidth, 30, 'Set Bid', 'bid_confirm', false, '#3b82f6');

            // Remove button (if there's an existing bid)
            if (currentBid > 0) {
              const removeBtnY = centerY + 150;
              this.addButton(cardX + this.MOD_CARD_WIDTH / 2 - setBtnWidth / 2, removeBtnY, setBtnWidth, 25, 'Remove', 'bid_remove', false, '#6b7280');
            }
          } else {
            // Show "Click to Bid" hint for non-selected cards
            ctx.fillStyle = playerBid > 0 ? '#22c55e' : '#fbbf24';
            ctx.font = 'bold 11px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(playerBid > 0 ? 'CLICK TO CHANGE' : 'CLICK TO BID', cardX + this.MOD_CARD_WIDTH / 2, centerY + this.MOD_CARD_HEIGHT + 15);
          }
        } else {
          this.drawModifierCardBack(cardX, centerY);
        }
      }
    }
  }

  private drawBiddingControls(_state: PokerGameState, player?: Player): void {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    if (!player) return;

    const availableCoins = player.coins - Object.values(player.bids).reduce((sum, amt) => sum + amt, 0);

    // Show available coins at the bottom
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Available: 🪙 ${availableCoins}`, width / 2, height - 80);

    // Draw all buttons (including those added by drawCommunityAreaWithBidding)
    for (const btn of this.buttons) {
      this.drawButton(btn);
    }

    // Show confirm all bids button (only when no card is selected)
    if (this.selectedBidCardIndex === null) {
      this.addButton(width / 2 - 75, height - 45, 150, 40, 'Confirm Bids', 'confirm_all_bids', false, '#22c55e');
      // Draw just the confirm button
      const confirmBtn = this.buttons[this.buttons.length - 1];
      this.drawButton(confirmBtn);
    }
  }

  private drawCommunityAreaWithResults(state: PokerGameState, _player?: Player): void {
    const { width, height } = this.canvas;
    const centerY = height / 2 - 50;
    const ctx = this.ctx;

    const totalWidth = 5 * this.MOD_CARD_WIDTH + 4 * 10;
    const startX = (width - totalWidth) / 2;

    for (let i = 0; i < 5; i++) {
      const cardX = startX + i * (this.MOD_CARD_WIDTH + 10);
      const card = state.communityCards[i];

      if (card) {
        this.drawModifierCard(card, cardX, centerY);

        // Show all bids on this card
        let bidY = centerY - 15;
        for (const p of state.players) {
          const bid = p.bids[i] || 0;
          if (bid > 0) {
            const isWinner = this.bidResults[i]?.winner === p.position;
            ctx.fillStyle = isWinner ? '#22c55e' : '#888';
            ctx.font = `${isWinner ? 'bold ' : ''}11px monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(`${PLAYER_NAMES[p.position]}: ${bid}${isWinner ? ' ✓' : ''}`, cardX + this.MOD_CARD_WIDTH / 2, bidY);
            bidY -= 14;
          }
        }

        // Show winner
        const result = this.bidResults[i];
        if (result) {
          ctx.fillStyle = PLAYER_COLORS[result.winner];
          ctx.font = 'bold 12px monospace';
          ctx.fillText(`${PLAYER_NAMES[result.winner]} WINS!`, cardX + this.MOD_CARD_WIDTH / 2, centerY + this.MOD_CARD_HEIGHT + 15);
        } else {
          ctx.fillStyle = '#666';
          ctx.font = '11px monospace';
          ctx.fillText('No bids', cardX + this.MOD_CARD_WIDTH / 2, centerY + this.MOD_CARD_HEIGHT + 15);
        }
      }
    }
  }

  private drawChooseUnitScene(_state: PokerGameState, player?: Player): void {
    const { width, height } = this.canvas;
    const ctx = this.ctx;

    if (!player) return;

    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(0, 0, width, height);

    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 28px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Choose a Unit to Keep', width / 2, 60);

    ctx.fillStyle = '#aaa';
    ctx.font = '14px monospace';
    ctx.fillText('Click a card from your hand to add to your army', width / 2, 90);

    // Draw hole cards large and centered
    const cardScale = 1.3;
    const cardWidth = this.CARD_WIDTH * cardScale;
    const cardHeight = this.CARD_HEIGHT * cardScale;
    const spacing = 30;
    const totalCardsWidth = player.holeCards.length * cardWidth + (player.holeCards.length - 1) * spacing;
    const startX = (width - totalCardsWidth) / 2;
    const cardY = 150;

    for (let i = 0; i < player.holeCards.length; i++) {
      const cardX = startX + i * (cardWidth + spacing);

      // Track bounds
      this.holeCardBounds.push({ x: cardX, y: cardY, width: cardWidth, height: cardHeight, index: i });

      // Highlight selected
      if (this.selectedHoleCardIndex === i) {
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.roundRect(cardX - 5, cardY - 5, cardWidth + 10, cardHeight + 10, 10);
        ctx.stroke();
      }

      this.drawUnitCardScaled(player.holeCards[i], cardX, cardY, cardScale);

      // "Keep" label
      ctx.fillStyle = '#22c55e';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('KEEP', cardX + cardWidth / 2, cardY + cardHeight + 25);
    }

    // Draw current army (keeper slots)
    ctx.fillStyle = '#888';
    ctx.font = 'bold 16px monospace';
    ctx.fillText('Your Army', width / 2, cardY + cardHeight + 80);

    const keeperScale = 0.8;
    const keeperWidth = this.CARD_WIDTH * keeperScale;
    const keeperHeight = this.CARD_HEIGHT * keeperScale;
    const keeperSpacing = 15;
    const totalKeepersWidth = 4 * keeperWidth + 3 * keeperSpacing;
    const keeperStartX = (width - totalKeepersWidth) / 2;
    const keeperY = cardY + cardHeight + 100;

    for (let i = 0; i < 4; i++) {
      const keeperX = keeperStartX + i * (keeperWidth + keeperSpacing);

      this.keeperCardBounds.push({ x: keeperX, y: keeperY, width: keeperWidth, height: keeperHeight, index: i });

      if (i < player.keptCards.length) {
        // Highlight if we need to replace
        if (this.selectedHoleCardIndex !== null && player.keptCards.length >= 4) {
          ctx.strokeStyle = '#ef4444';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.roundRect(keeperX - 2, keeperY - 2, keeperWidth + 4, keeperHeight + 4, 6);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        this.drawUnitCardScaled(player.keptCards[i], keeperX, keeperY, keeperScale);
      } else {
        this.drawEmptyKeeperSlot(keeperX, keeperY, keeperWidth, keeperHeight, keeperScale);
      }
    }

    // Instructions
    if (player.keptCards.length >= 4 && this.selectedHoleCardIndex !== null) {
      ctx.fillStyle = '#ef4444';
      ctx.font = '14px monospace';
      ctx.fillText('Click a card in your army to replace it', width / 2, keeperY + keeperHeight + 40);
    }

    // Skip / Continue button
    this.buttons = [];
    const skipLabel = player.hasKeptCardThisRound ? 'Continue' : 'Skip';
    this.addButton(width / 2 - 60, height - 60, 120, 40, skipLabel, 'next_hand', false, player.hasKeptCardThisRound ? '#22c55e' : '#6b7280');
    for (const btn of this.buttons) {
      this.drawButton(btn);
    }
  }

  // Set bid results for display
  setBidResults(results: Record<number, { winner: PlayerPosition; amount: number }>): void {
    this.bidResults = results;
  }

  // Bidding UI methods
  selectCardForBidding(index: number, currentBid: number): void {
    this.selectedBidCardIndex = index;
    this.tempBidAmount = currentBid > 0 ? currentBid : 1;
  }

  deselectBidCard(): void {
    this.selectedBidCardIndex = null;
  }

  getSelectedBidCardIndex(): number | null {
    return this.selectedBidCardIndex;
  }

  getTempBidAmount(): number {
    return this.tempBidAmount;
  }

  setTempBidAmount(amount: number): void {
    this.tempBidAmount = Math.max(0, amount);
  }

  incrementTempBid(): void {
    this.tempBidAmount++;
  }

  decrementTempBid(): void {
    if (this.tempBidAmount > 0) this.tempBidAmount--;
  }

  private drawAllPlayers(state: PokerGameState, canKeepCards: boolean): void {
    const { width, height } = this.canvas;

    // Position each player around the table (hexagon layout)
    const positions: { pos: PlayerPosition; x: number; y: number; cardScale: number }[] = [
      { pos: 'player', x: width / 2, y: height - 120, cardScale: 1.1 },          // Bottom center (bigger cards)
      { pos: 'opponent', x: width / 2, y: 80, cardScale: 0.5 },                  // Top center
      { pos: 'topLeft', x: 100, y: 160, cardScale: 0.5 },                        // Top left
      { pos: 'topRight', x: width - 100, y: 160, cardScale: 0.5 },               // Top right
      { pos: 'bottomLeft', x: 100, y: height - 160, cardScale: 0.5 },            // Bottom left
      { pos: 'bottomRight', x: width - 100, y: height - 160, cardScale: 0.5 }    // Bottom right
    ];

    for (const { pos, x, y, cardScale } of positions) {
      const player = state.players.find(p => p.position === pos);
      if (player) {
        // Only show cards for the human player, hide enemy cards
        const showCards = pos === 'player';
        this.drawPlayerAt(player, x, y, cardScale, showCards, canKeepCards);
      }
    }
  }

  // Draw all players with deal animation (cards fly in from center)
  private drawAllPlayersWithDealAnimation(state: PokerGameState): void {
    const { width, height } = this.canvas;
    const centerX = width / 2;
    const centerY = height / 2 - 50; // Table center

    // Position each player around the table (hexagon layout)
    const positions: { pos: PlayerPosition; x: number; y: number; cardScale: number }[] = [
      { pos: 'player', x: width / 2, y: height - 120, cardScale: 1.1 },
      { pos: 'opponent', x: width / 2, y: 80, cardScale: 0.5 },
      { pos: 'topLeft', x: 100, y: 160, cardScale: 0.5 },
      { pos: 'topRight', x: width - 100, y: 160, cardScale: 0.5 },
      { pos: 'bottomLeft', x: 100, y: height - 160, cardScale: 0.5 },
      { pos: 'bottomRight', x: width - 100, y: height - 160, cardScale: 0.5 }
    ];

    for (const { pos, x, y, cardScale } of positions) {
      const player = state.players.find(p => p.position === pos);
      if (player) {
        const showCards = pos === 'player';
        this.drawPlayerAtWithAnimation(player, x, y, cardScale, showCards, centerX, centerY);
      }
    }
  }

  // Draw a player's cards with deal animation
  private drawPlayerAtWithAnimation(player: Player, centerX: number, centerY: number, scale: number, isPlayerCards: boolean, tableCenterX: number, tableCenterY: number): void {
    const ctx = this.ctx;
    const cardWidth = this.CARD_WIDTH * scale;
    const cardHeight = this.CARD_HEIGHT * scale;
    const godCardWidth = this.GOD_CARD_WIDTH * scale;
    const godCardHeight = this.GOD_CARD_HEIGHT * scale;

    // Check if player is eliminated
    const isEliminated = player.health <= 0;

    // Player label with health or elimination status
    ctx.fillStyle = isEliminated ? '#666' : PLAYER_COLORS[player.position];
    ctx.font = `bold ${Math.round(14 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(PLAYER_NAMES[player.position], centerX, centerY - cardHeight / 2 - 22);

    if (isEliminated) {
      ctx.fillStyle = '#666';
      ctx.font = `bold ${Math.round(11 * scale)}px monospace`;
      ctx.fillText('ELIMINATED', centerX, centerY - cardHeight / 2 - 8);
      return; // Don't draw cards for eliminated players
    }

    const healthColor = player.health > 50 ? '#22c55e' : player.health > 25 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = healthColor;
    ctx.font = `bold ${Math.round(11 * scale)}px monospace`;
    ctx.fillText(`♥ ${player.health}`, centerX, centerY - cardHeight / 2 - 8);

    // Calculate total width for cards (including keeper slots for player)
    const unitCardsWidth = player.holeCards.length * (cardWidth + 5 * scale);
    const godCardsWidth = player.godCards.length * (godCardWidth + 4 * scale);
    const keeperWidth = isPlayerCards ? 4 * (cardWidth * 0.7 + 5 * scale) + 20 * scale : 0;
    const totalWidth = unitCardsWidth + godCardsWidth + keeperWidth;

    const startX = centerX - totalWidth / 2;

    // Easing function for smooth animation
    const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);

    // Draw hole cards with animation
    for (let i = 0; i < player.holeCards.length; i++) {
      const progress = this.holeCardDealProgress[i] || 0;
      const easedProgress = easeOutCubic(progress);

      // Final position
      const finalX = startX + i * (cardWidth + 5 * scale);
      const finalY = centerY - cardHeight / 2;

      // Interpolate from center to final position
      const cardX = tableCenterX + (finalX - tableCenterX) * easedProgress;
      const cardY = tableCenterY + (finalY - tableCenterY) * easedProgress;

      // Scale effect: cards start smaller and grow
      const animScale = 0.3 + 0.7 * easedProgress;

      // Only draw if animation has started
      if (progress > 0) {
        ctx.save();
        ctx.translate(cardX + cardWidth / 2, cardY + cardHeight / 2);
        ctx.scale(animScale, animScale);
        ctx.translate(-(cardX + cardWidth / 2), -(cardY + cardHeight / 2));

        if (isPlayerCards) {
          this.drawUnitCardScaled(player.holeCards[i], cardX, cardY, scale);
        } else {
          this.drawCardBackScaled(cardX, cardY, scale);
        }

        ctx.restore();
      }
    }

    // Draw god cards with animation
    const godStartX = startX + unitCardsWidth;
    for (let i = 0; i < player.godCards.length; i++) {
      const progress = this.godCardDealProgress[i] || 0;
      const easedProgress = easeOutCubic(progress);

      // Final position
      const finalX = godStartX + i * (godCardWidth + 4 * scale);
      const finalY = centerY - godCardHeight / 2;

      // Interpolate from center to final position
      const godX = tableCenterX + (finalX - tableCenterX) * easedProgress;
      const godY = tableCenterY + (finalY - tableCenterY) * easedProgress;

      // Scale effect
      const animScale = 0.3 + 0.7 * easedProgress;

      // Only draw if animation has started
      if (progress > 0) {
        ctx.save();
        ctx.translate(godX + godCardWidth / 2, godY + godCardHeight / 2);
        ctx.scale(animScale, animScale);
        ctx.translate(-(godX + godCardWidth / 2), -(godY + godCardHeight / 2));

        if (isPlayerCards) {
          this.drawGodCardScaled(player.godCards[i], godX, godY, scale);
        } else {
          this.drawGodCardBackScaled(godX, godY, scale);
        }

        ctx.restore();
      }
    }

    // Draw keeper slots (only for player, static - no animation needed)
    if (isPlayerCards) {
      const keeperStartX = godStartX + godCardsWidth + 20 * scale;
      const keeperCardWidth = cardWidth * 0.7;
      const keeperCardHeight = cardHeight * 0.7;
      const keeperScale = scale * 0.7;

      ctx.fillStyle = '#888';
      ctx.font = `bold ${Math.round(10 * scale)}px monospace`;
      ctx.fillText('ARMY', keeperStartX + (4 * (keeperCardWidth + 5 * scale)) / 2, centerY - keeperCardHeight / 2 - 8 * scale);

      for (let i = 0; i < 4; i++) {
        const keeperX = keeperStartX + i * (keeperCardWidth + 5 * scale);
        const keeperY = centerY - keeperCardHeight / 2;

        if (i < player.keptCards.length) {
          this.drawUnitCardScaled(player.keptCards[i], keeperX, keeperY, keeperScale);
        } else {
          this.drawEmptyKeeperSlot(keeperX, keeperY, keeperCardWidth, keeperCardHeight, keeperScale);
        }
      }
    }
  }

  private drawPlayerAt(player: Player, centerX: number, centerY: number, scale: number, isPlayerCards: boolean, canKeepCards: boolean = false): void {
    const ctx = this.ctx;
    const cardWidth = this.CARD_WIDTH * scale;
    const cardHeight = this.CARD_HEIGHT * scale;
    const godCardWidth = this.GOD_CARD_WIDTH * scale;
    const godCardHeight = this.GOD_CARD_HEIGHT * scale;

    // Check if player is eliminated
    const isEliminated = player.health <= 0;

    // Player label with health or elimination status
    ctx.fillStyle = isEliminated ? '#666' : PLAYER_COLORS[player.position];
    ctx.font = `bold ${Math.round(14 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText(PLAYER_NAMES[player.position], centerX, centerY - cardHeight / 2 - 22);

    if (isEliminated) {
      ctx.fillStyle = '#666';
      ctx.font = `bold ${Math.round(11 * scale)}px monospace`;
      ctx.fillText('ELIMINATED', centerX, centerY - cardHeight / 2 - 8);
      return; // Don't draw cards for eliminated players
    }

    const healthColor = player.health > 50 ? '#22c55e' : player.health > 25 ? '#f59e0b' : '#ef4444';
    ctx.fillStyle = healthColor;
    ctx.font = `bold ${Math.round(11 * scale)}px monospace`;
    ctx.fillText(`♥ ${player.health}`, centerX, centerY - cardHeight / 2 - 8);

    // Calculate total width for cards (including keeper slots for player)
    const unitCardsWidth = player.holeCards.length * (cardWidth + 5 * scale);
    const godCardsWidth = player.godCards.length * (godCardWidth + 4 * scale);
    const keeperWidth = isPlayerCards ? 4 * (cardWidth * 0.7 + 5 * scale) + 20 * scale : 0; // 4 keeper slots, slightly smaller
    const totalWidth = unitCardsWidth + godCardsWidth + keeperWidth;

    const startX = centerX - totalWidth / 2;

    // Draw hole cards (unit cards)
    for (let i = 0; i < player.holeCards.length; i++) {
      const cardX = startX + i * (cardWidth + 5 * scale);
      const cardY = centerY - cardHeight / 2;

      if (isPlayerCards) {
        // Track bounds for click detection
        this.holeCardBounds.push({ x: cardX, y: cardY, width: cardWidth, height: cardHeight, index: i });

        // Highlight if this card is selected for keeping
        if (this.selectedHoleCardIndex === i) {
          ctx.strokeStyle = '#22c55e';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.roundRect(cardX - 4, cardY - 4, cardWidth + 8, cardHeight + 8, 10 * scale);
          ctx.stroke();
        }

        // Player's cards always shown face up
        this.drawUnitCardScaled(player.holeCards[i], cardX, cardY, scale);

        // Show "KEEP" hint if can keep and not yet kept this round (only after battle)
        if (canKeepCards && !player.hasKeptCardThisRound) {
          ctx.fillStyle = 'rgba(34, 197, 94, 0.8)';
          ctx.font = `bold ${Math.round(10 * scale)}px monospace`;
          ctx.fillText('CLICK TO KEEP', cardX + cardWidth / 2, cardY + cardHeight + 15 * scale);
        }
      } else {
        this.drawCardBackScaled(cardX, cardY, scale);
      }
    }

    // Draw god cards
    const godStartX = startX + unitCardsWidth;
    for (let i = 0; i < player.godCards.length; i++) {
      const godX = godStartX + i * (godCardWidth + 4 * scale);
      const godY = centerY - godCardHeight / 2;

      if (isPlayerCards) {
        // Player's god cards always shown face up
        this.drawGodCardScaled(player.godCards[i], godX, godY, scale);
      } else {
        this.drawGodCardBackScaled(godX, godY, scale);
      }
    }

    // Draw keeper slots (only for player)
    if (isPlayerCards) {
      const keeperStartX = godStartX + godCardsWidth + 20 * scale;
      const keeperCardWidth = cardWidth * 0.7;
      const keeperCardHeight = cardHeight * 0.7;
      const keeperScale = scale * 0.7;

      // Label for keeper area
      ctx.fillStyle = '#888';
      ctx.font = `bold ${Math.round(10 * scale)}px monospace`;
      ctx.fillText('ARMY', keeperStartX + (4 * (keeperCardWidth + 5 * scale)) / 2, centerY - keeperCardHeight / 2 - 8 * scale);

      for (let i = 0; i < 4; i++) {
        const keeperX = keeperStartX + i * (keeperCardWidth + 5 * scale);
        const keeperY = centerY - keeperCardHeight / 2;

        // Track bounds for replacement selection
        this.keeperCardBounds.push({ x: keeperX, y: keeperY, width: keeperCardWidth, height: keeperCardHeight, index: i });

        if (i < player.keptCards.length) {
          // Draw kept card
          this.drawUnitCardScaled(player.keptCards[i], keeperX, keeperY, keeperScale);

          // Highlight if selecting for replacement
          if (this.selectedHoleCardIndex !== null && player.keptCards.length >= 4) {
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.roundRect(keeperX - 2, keeperY - 2, keeperCardWidth + 4, keeperCardHeight + 4, 6 * scale);
            ctx.stroke();
            ctx.setLineDash([]);
          }
        } else {
          // Draw empty slot
          this.drawEmptyKeeperSlot(keeperX, keeperY, keeperCardWidth, keeperCardHeight, keeperScale);
        }
      }
    }
  }

  private drawEmptyKeeperSlot(x: number, y: number, width: number, height: number, scale: number): void {
    const ctx = this.ctx;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 6 * scale);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    // Plus icon
    ctx.fillStyle = '#4a5568';
    ctx.font = `${Math.round(24 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('+', x + width / 2, y + height / 2 + 8 * scale);
  }

  private drawUnitCardScaled(card: UnitCard, x: number, y: number, scale: number): void {
    const ctx = this.ctx;
    const cardWidth = this.CARD_WIDTH * scale;
    const cardHeight = this.CARD_HEIGHT * scale;

    // Card background
    ctx.fillStyle = '#2d2d44';
    ctx.strokeStyle = UNIT_COLORS[card.type];
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.roundRect(x, y, cardWidth, cardHeight, 6 * scale);
    ctx.fill();
    ctx.stroke();

    // Unit name at top
    ctx.font = `bold ${Math.round(9 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = UNIT_COLORS[card.type];
    ctx.fillText(card.name.toUpperCase(), x + cardWidth / 2, y + 14 * scale);

    // Draw unit sprite in center
    const spriteX = x + cardWidth / 2;
    const spriteY = y + cardHeight / 2 + 6 * scale;
    const spriteScale = scale * 2.0;

    ctx.save();
    ctx.translate(spriteX, spriteY);
    ctx.scale(spriteScale, spriteScale);

    switch (card.type) {
      case 'knight':
        SpriteRenderer.drawKnight(ctx, 0, 0, 'red', 0);
        break;
      case 'swordsman':
        SpriteRenderer.drawSwordsman(ctx, 0, 0, 'red', 0);
        break;
      case 'archer':
        SpriteRenderer.drawArcher(ctx, 0, 0, 'red', 0);
        break;
      case 'mage':
        SpriteRenderer.drawMage(ctx, 0, 0, 'red', 0);
        break;
      case 'healer':
        SpriteRenderer.drawHealer(ctx, 0, 0, 'red', 0);
        break;
    }

    ctx.restore();
  }

  private drawCardBackScaled(x: number, y: number, scale: number): void {
    const ctx = this.ctx;
    const cardWidth = this.CARD_WIDTH * scale;
    const cardHeight = this.CARD_HEIGHT * scale;

    const gradient = ctx.createLinearGradient(x, y, x + cardWidth, y + cardHeight);
    gradient.addColorStop(0, '#2c3e50');
    gradient.addColorStop(1, '#1a252f');

    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.roundRect(x, y, cardWidth, cardHeight, 6 * scale);
    ctx.fill();
    ctx.stroke();

    ctx.font = `${Math.round(30 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4a5568';
    ctx.fillText('?', x + cardWidth / 2, y + cardHeight / 2 + 10 * scale);
  }

  private drawGodCardScaled(card: GodCard, x: number, y: number, scale: number): void {
    const ctx = this.ctx;
    const cardWidth = this.GOD_CARD_WIDTH * scale;
    const cardHeight = this.GOD_CARD_HEIGHT * scale;

    ctx.fillStyle = '#2d2d44';
    ctx.strokeStyle = card.color;
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.roundRect(x, y, cardWidth, cardHeight, 4 * scale);
    ctx.fill();
    ctx.stroke();

    ctx.font = `${Math.round(18 * scale)}px serif`;
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText(card.icon, x + cardWidth / 2, y + 28 * scale);

    ctx.font = `bold ${Math.round(7 * scale)}px monospace`;
    ctx.fillStyle = card.color;
    ctx.fillText(card.name.split(' ')[0], x + cardWidth / 2, y + cardHeight - 6 * scale);
  }

  private drawGodCardBackScaled(x: number, y: number, scale: number): void {
    const ctx = this.ctx;
    const cardWidth = this.GOD_CARD_WIDTH * scale;
    const cardHeight = this.GOD_CARD_HEIGHT * scale;

    const gradient = ctx.createLinearGradient(x, y, x + cardWidth, y + cardHeight);
    gradient.addColorStop(0, '#4a3082');
    gradient.addColorStop(1, '#2d1f52');

    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#6b4fa0';
    ctx.lineWidth = 2 * scale;
    ctx.beginPath();
    ctx.roundRect(x, y, cardWidth, cardHeight, 4 * scale);
    ctx.fill();
    ctx.stroke();

    ctx.font = `${Math.round(18 * scale)}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#6b4fa0';
    ctx.fillText('⚡', x + cardWidth / 2, y + cardHeight / 2 + 6 * scale);
  }

  private drawTableBackground(): void {
    const { width, height } = this.canvas;
    const padding = 55;

    // Outer border
    this.ctx.fillStyle = '#8B4513';
    this.ctx.beginPath();
    this.ctx.roundRect(padding - 10, padding - 10, width - 2 * padding + 20, height - 2 * padding + 20, 20);
    this.ctx.fill();

    // Green felt
    this.ctx.fillStyle = '#1a472a';
    this.ctx.beginPath();
    this.ctx.roundRect(padding, padding, width - 2 * padding, height - 2 * padding, 15);
    this.ctx.fill();

    // Inner shadow
    const gradient = this.ctx.createRadialGradient(width / 2, height / 2, 100, width / 2, height / 2, 400);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.roundRect(padding, padding, width - 2 * padding, height - 2 * padding, 15);
    this.ctx.fill();
  }


  private drawCommunityArea(state: PokerGameState, canBuyCards: boolean, player?: Player): void {
    const { width, height } = this.canvas;
    const centerY = height / 2 - 50;
    const ctx = this.ctx;

    // Pot display
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`POT: ${state.pot}`, width / 2, centerY - 80);

    // Round indicator
    const roundNames: Record<string, string> = {
      preflop: 'Pre-Flop',
      flop: 'Flop',
      turn: 'Turn',
      river: 'River',
      showdown: 'Showdown!',
      positioning: 'Position Units',
      battle: 'Battle!',
      hand_complete: 'Choose Cards to Keep'
    };
    ctx.fillStyle = '#aaa';
    ctx.font = '14px monospace';
    ctx.fillText(roundNames[state.round] || state.round, width / 2, centerY - 55);

    // Draw community cards (5 slots)
    const totalWidth = 5 * this.MOD_CARD_WIDTH + 4 * 10;
    const startX = (width - totalWidth) / 2;

    for (let i = 0; i < 5; i++) {
      const cardX = startX + i * (this.MOD_CARD_WIDTH + 10);
      const card = state.communityCards[i];

      // Track bounds for click detection
      this.communityCardBounds.push({
        x: cardX, y: centerY, width: this.MOD_CARD_WIDTH, height: this.MOD_CARD_HEIGHT, index: i
      });

      if (card) {
        const flip = this.communityCardFlips[i];
        if (flip && (flip.isRevealed || flip.isFlipping)) {
          this.drawFlippingModifierCard(card, cardX, centerY, flip.flipProgress);

          // Show buy hint if can buy and card is revealed
          if (canBuyCards && flip.isRevealed && player) {
            const alreadyOwned = player.keptModifierCards.some(c => c.id === card.id);
            const canAfford = player.coins >= 2;

            if (alreadyOwned) {
              // Show "OWNED" badge
              ctx.fillStyle = 'rgba(34, 197, 94, 0.9)';
              ctx.font = 'bold 12px monospace';
              ctx.fillText('✓ OWNED', cardX + this.MOD_CARD_WIDTH / 2, centerY + this.MOD_CARD_HEIGHT + 18);
            } else if (canAfford) {
              // Show buy button
              ctx.fillStyle = 'rgba(251, 191, 36, 0.9)';
              ctx.font = 'bold 12px monospace';
              ctx.fillText('BUY 2🪙', cardX + this.MOD_CARD_WIDTH / 2, centerY + this.MOD_CARD_HEIGHT + 18);
            } else {
              // Not enough coins
              ctx.fillStyle = 'rgba(107, 114, 128, 0.7)';
              ctx.font = 'bold 11px monospace';
              ctx.fillText('NEED 2🪙', cardX + this.MOD_CARD_WIDTH / 2, centerY + this.MOD_CARD_HEIGHT + 18);
            }
          }
        } else {
          this.drawModifierCardBack(cardX, centerY);
        }
      } else {
        this.drawCardSlot(cardX, centerY);
      }
    }
  }


  private drawModifierCard(card: Card, x: number, y: number): void {
    const ctx = this.ctx;

    // Card background
    ctx.fillStyle = '#2d2d44';
    ctx.strokeStyle = card.rarityColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, this.MOD_CARD_WIDTH, this.MOD_CARD_HEIGHT, 10);
    ctx.fill();
    ctx.stroke();

    // Rarity indicator
    const rarityColors: Record<string, string> = {
      common: '#9ca3af',
      rare: '#3b82f6',
      epic: '#a855f7',
      legendary: '#f59e0b'
    };
    ctx.fillStyle = rarityColors[card.rarity] || '#9ca3af';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(card.rarity[0].toUpperCase(), x + this.MOD_CARD_WIDTH / 2, y + 20);

    // Card name (keep text readable, not scaled 30%)
    ctx.fillStyle = card.color;
    ctx.font = 'bold 12px monospace';
    this.wrapText(card.name, x + this.MOD_CARD_WIDTH / 2, y + 50, this.MOD_CARD_WIDTH - 16, 15);

    // Description (keep text readable)
    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    this.wrapText(card.description, x + this.MOD_CARD_WIDTH / 2, y + 90, this.MOD_CARD_WIDTH - 16, 12);
  }

  private drawModifierCardBack(x: number, y: number): void {
    const ctx = this.ctx;

    const gradient = ctx.createLinearGradient(x, y, x + this.MOD_CARD_WIDTH, y + this.MOD_CARD_HEIGHT);
    gradient.addColorStop(0, '#2c3e50');
    gradient.addColorStop(1, '#1a252f');

    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, this.MOD_CARD_WIDTH, this.MOD_CARD_HEIGHT, 10);
    ctx.fill();
    ctx.stroke();

    // Question mark pattern
    ctx.font = '40px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4a5568';
    ctx.fillText('?', x + this.MOD_CARD_WIDTH / 2, y + this.MOD_CARD_HEIGHT / 2 + 14);
  }

  private drawFlippingModifierCard(card: Card, x: number, y: number, flipProgress: number): void {
    const ctx = this.ctx;

    // Calculate flip animation
    // 0-0.5: shrinking (showing back), 0.5-1: growing (showing front)
    let scaleX: number;
    let showFront: boolean;

    if (flipProgress < 0.5) {
      scaleX = 1 - flipProgress * 2;
      showFront = false;
    } else {
      scaleX = (flipProgress - 0.5) * 2;
      showFront = true;
    }

    ctx.save();
    ctx.translate(x + this.MOD_CARD_WIDTH / 2, y + this.MOD_CARD_HEIGHT / 2);
    ctx.scale(scaleX, 1);
    ctx.translate(-(x + this.MOD_CARD_WIDTH / 2), -(y + this.MOD_CARD_HEIGHT / 2));

    if (showFront) {
      this.drawModifierCard(card, x, y);
    } else {
      this.drawModifierCardBack(x, y);
    }

    ctx.restore();
  }

  private drawCardSlot(x: number, y: number): void {
    const ctx = this.ctx;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.roundRect(x, y, this.MOD_CARD_WIDTH, this.MOD_CARD_HEIGHT, 10);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private addButton(x: number, y: number, width: number, height: number, label: string, action: string, disabled: boolean, color: string): void {
    this.buttons.push({ x, y, width, height, label, action, disabled, color });
  }

  private drawButton(btn: Button): void {
    const ctx = this.ctx;

    // Button background
    const alpha = btn.disabled ? 0.5 : 1;
    ctx.globalAlpha = alpha;

    const gradient = ctx.createLinearGradient(btn.x, btn.y, btn.x, btn.y + btn.height);
    gradient.addColorStop(0, btn.color);
    gradient.addColorStop(1, this.darkenColor(btn.color, 0.3));

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(btn.x, btn.y, btn.width, btn.height, 8);
    ctx.fill();

    // Button text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(btn.label, btn.x + btn.width / 2, btn.y + btn.height / 2 + 4);

    ctx.globalAlpha = 1;
  }

  private drawActionButton(label: string, action: string, x: number, y: number): void {
    const width = 150;
    const height = 40;

    this.buttons = [];
    this.addButton(x - width / 2, y - height / 2, width, height, label, action, false, action === 'battle' ? '#ef4444' : '#22c55e');

    for (const btn of this.buttons) {
      this.drawButton(btn);
    }
  }

  private drawGameInfo(state: PokerGameState): void {
    const ctx = this.ctx;
    const player = state.players.find(p => p.position === 'player');

    // Hand number and blinds
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Hand #${state.handNumber}`, 50, 30);
    ctx.fillText(`Blinds: ${state.smallBlind}/${state.bigBlind}`, 150, 30);

    // Coins display
    if (player) {
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`🪙 ${player.coins}`, 280, 30);
    }

    // Dealer button indicator
    const dealerX = state.dealerPosition === 'opponent' ? this.canvas.width / 2 + 100 : this.canvas.width / 2 + 100;
    const dealerY = state.dealerPosition === 'opponent' ? 70 : this.canvas.height - 160;

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(dealerX, dealerY, 12, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#000';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('D', dealerX, dealerY + 4);

    // Draw kept modifier cards (your permanent collection) on the right side
    if (player && player.keptModifierCards.length > 0) {
      const startX = this.canvas.width - 90;
      const startY = 60;
      const miniCardWidth = 70;
      const miniCardHeight = 95;

      ctx.fillStyle = '#888';
      ctx.font = 'bold 11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('YOUR MODIFIERS', startX + miniCardWidth / 2, startY - 10);

      for (let i = 0; i < player.keptModifierCards.length; i++) {
        const cardY = startY + i * (miniCardHeight + 8);
        this.drawMiniModifierCard(player.keptModifierCards[i], startX, cardY, miniCardWidth, miniCardHeight);
      }
    }
  }

  private drawMiniModifierCard(card: Card, x: number, y: number, width: number, height: number): void {
    const ctx = this.ctx;

    // Card background
    ctx.fillStyle = '#2d2d44';
    ctx.strokeStyle = card.rarityColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 6);
    ctx.fill();
    ctx.stroke();

    // Card name (truncated)
    ctx.fillStyle = card.color;
    ctx.font = 'bold 9px monospace';
    ctx.textAlign = 'center';
    const name = card.name.length > 10 ? card.name.slice(0, 9) + '...' : card.name;
    ctx.fillText(name, x + width / 2, y + 15);

    // Rarity
    const rarityColors: Record<string, string> = {
      common: '#9ca3af',
      rare: '#3b82f6',
      epic: '#a855f7',
      legendary: '#f59e0b'
    };
    ctx.fillStyle = rarityColors[card.rarity] || '#9ca3af';
    ctx.font = '8px monospace';
    ctx.fillText(card.rarity.toUpperCase(), x + width / 2, y + height - 8);
  }

  private wrapText(text: string, x: number, y: number, maxWidth: number, lineHeight: number): void {
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (const word of words) {
      const testLine = line + word + ' ';
      const metrics = this.ctx.measureText(testLine);

      if (metrics.width > maxWidth && line !== '') {
        this.ctx.fillText(line.trim(), x, currentY);
        line = word + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    this.ctx.fillText(line.trim(), x, currentY);
  }

  private darkenColor(color: string, amount: number): string {
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - Math.round(255 * amount));
    const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - Math.round(255 * amount));
    const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - Math.round(255 * amount));
    return `rgb(${r}, ${g}, ${b})`;
  }

  // Input handling
  handleClick(x: number, y: number): string | null {
    for (const btn of this.buttons) {
      if (!btn.disabled &&
          x >= btn.x && x <= btn.x + btn.width &&
          y >= btn.y && y <= btn.y + btn.height) {
        return btn.action;
      }
    }
    return null;
  }

  handleSliderDrag(x: number, y: number, canRaise: boolean): boolean {
    if (!canRaise) return false;

    const { width, height } = this.canvas;
    const sliderX = (width - 550) / 2 + 350;
    const sliderY = height - 45;
    const sliderWidth = 120;

    if (x >= sliderX && x <= sliderX + sliderWidth && y >= sliderY - 10 && y <= sliderY + 35) {
      const percent = Math.max(0, Math.min(1, (x - sliderX) / sliderWidth));
      this.sliderValue = Math.round(this.sliderMin + percent * (this.sliderMax - this.sliderMin));
      return true;
    }
    return false;
  }

  setSliderRange(min: number, max: number): void {
    this.sliderMin = min;
    this.sliderMax = max;
    this.sliderValue = Math.max(min, Math.min(max, this.sliderValue));
  }

  getSliderValue(): number {
    return this.sliderValue;
  }

  setSliderValue(value: number): void {
    this.sliderValue = value;
  }
}

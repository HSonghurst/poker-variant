import type { PokerGameState } from './PokerGame';
import type { UnitCard } from './UnitCardDeck';
import type { Card } from './Card';
import type { FighterType } from './types';
import { SpriteRenderer } from './SpriteRenderer';

const UNIT_COLORS: Record<FighterType, string> = {
  knight: '#f59e0b',
  swordsman: '#ef4444',
  archer: '#22c55e',
  mage: '#a855f7',
  healer: '#22d3ee'
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

export class PokerRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private buttons: Button[] = [];
  private sliderValue: number = 50;
  private sliderMin: number = 20;
  private sliderMax: number = 100;

  // Layout constants
  // Unit cards (hole cards) - normal size
  private readonly CARD_WIDTH = 85;
  private readonly CARD_HEIGHT = 120;
  // Modifier cards (community cards) - 30% bigger
  private readonly MOD_CARD_WIDTH = 124;
  private readonly MOD_CARD_HEIGHT = 169;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
  }

  render(state: PokerGameState, isPlayerTurn: boolean, canCheck: boolean, canCall: boolean, canRaise: boolean, callAmount: number): void {
    const { width, height } = this.canvas;

    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, width, height);

    // Draw poker table background
    this.drawTableBackground();

    // Draw opponent area (top)
    this.drawOpponentArea(state);

    // Draw community cards (center)
    this.drawCommunityArea(state);

    // Draw player area (bottom)
    this.drawPlayerArea(state);

    // Draw betting controls
    if (state.round !== 'showdown' && state.round !== 'positioning' && state.round !== 'battle' && state.round !== 'hand_complete') {
      this.drawBettingControls(state, isPlayerTurn, canCheck, canCall, canRaise, callAmount);
    }

    // Draw action buttons for showdown/positioning
    if (state.round === 'showdown') {
      this.drawActionButton('Position Units', 'position', width / 2, height - 32);
    } else if (state.round === 'positioning') {
      this.drawActionButton('Start Battle!', 'battle', width / 2, height - 32);
    } else if (state.round === 'hand_complete' && !state.gameOver) {
      this.drawActionButton('Next Hand', 'next_hand', width / 2, height - 32);
    }

    // Draw game info
    this.drawGameInfo(state);
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

  private drawOpponentArea(state: PokerGameState): void {
    const { width } = this.canvas;
    const y = 95;

    // Opponent label and chips
    this.ctx.fillStyle = '#4a90d9';
    this.ctx.font = 'bold 16px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('OPPONENT', width / 2, y - 40);

    // Chips display
    this.drawChipStack(width / 2 - 120, y - 25, state.opponent.chips);

    // Current bet
    if (state.opponent.currentBet > 0) {
      this.ctx.fillStyle = '#ffd700';
      this.ctx.font = '14px monospace';
      this.ctx.fillText(`Bet: ${state.opponent.currentBet}`, width / 2 + 120, y - 20);
    }

    // Draw hole cards
    const showCards = state.round === 'showdown' || state.round === 'positioning' || state.round === 'battle' || state.round === 'hand_complete';
    const cardStartX = width / 2 - (state.opponent.holeCards.length * (this.CARD_WIDTH + 10)) / 2;

    for (let i = 0; i < state.opponent.holeCards.length; i++) {
      const cardX = cardStartX + i * (this.CARD_WIDTH + 10);
      if (showCards) {
        this.drawUnitCard(state.opponent.holeCards[i], cardX, y);
      } else {
        this.drawCardBack(cardX, y);
      }
    }
  }

  private drawCommunityArea(state: PokerGameState): void {
    const { width, height } = this.canvas;
    const centerY = height / 2 - 50;

    // Pot display
    this.ctx.fillStyle = '#ffd700';
    this.ctx.font = 'bold 20px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`POT: ${state.pot}`, width / 2, centerY - 80);

    // Round indicator
    const roundNames: Record<string, string> = {
      preflop: 'Pre-Flop',
      flop: 'Flop',
      turn: 'Turn',
      river: 'River',
      showdown: 'Showdown!',
      positioning: 'Position Units',
      battle: 'Battle!',
      hand_complete: 'Hand Complete'
    };
    this.ctx.fillStyle = '#aaa';
    this.ctx.font = '14px monospace';
    this.ctx.fillText(roundNames[state.round] || state.round, width / 2, centerY - 55);

    // Draw community cards (5 slots)
    const totalWidth = 5 * this.MOD_CARD_WIDTH + 4 * 10;
    const startX = (width - totalWidth) / 2;

    for (let i = 0; i < 5; i++) {
      const cardX = startX + i * (this.MOD_CARD_WIDTH + 10);
      const card = state.communityCards[i];
      if (card) {
        this.drawModifierCard(card, cardX, centerY);
      } else {
        this.drawCardSlot(cardX, centerY);
      }
    }
  }

  private drawPlayerArea(state: PokerGameState): void {
    const { width, height } = this.canvas;
    const y = height - 210;

    // Player label above cards (symmetrical with opponent)
    this.ctx.fillStyle = '#d94a4a';
    this.ctx.font = 'bold 16px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('YOU', width / 2, y - 40);

    // Chips display above cards
    this.drawChipStack(width / 2 - 120, y - 25, state.player.chips);

    // Current bet above cards
    if (state.player.currentBet > 0) {
      this.ctx.fillStyle = '#ffd700';
      this.ctx.font = '14px monospace';
      this.ctx.fillText(`Bet: ${state.player.currentBet}`, width / 2 + 120, y - 20);
    }

    // Draw hole cards
    const cardStartX = width / 2 - (state.player.holeCards.length * (this.CARD_WIDTH + 10)) / 2;

    for (let i = 0; i < state.player.holeCards.length; i++) {
      const cardX = cardStartX + i * (this.CARD_WIDTH + 10);
      this.drawUnitCard(state.player.holeCards[i], cardX, y);
    }
  }

  private drawUnitCard(card: UnitCard, x: number, y: number): void {
    const ctx = this.ctx;

    // Card background
    ctx.fillStyle = '#2d2d44';
    ctx.strokeStyle = UNIT_COLORS[card.type];
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(x, y, this.CARD_WIDTH, this.CARD_HEIGHT, 8);
    ctx.fill();
    ctx.stroke();

    // Unit name at top
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = UNIT_COLORS[card.type];
    ctx.fillText(card.name.toUpperCase(), x + this.CARD_WIDTH / 2, y + 18);

    // Draw unit sprite in center
    const spriteX = x + this.CARD_WIDTH / 2;
    const spriteY = y + this.CARD_HEIGHT / 2 + 2;

    // Draw sprite based on unit type (using 'bottom' team for player-colored sprites)
    switch (card.type) {
      case 'knight':
        SpriteRenderer.drawKnight(ctx, spriteX, spriteY, 'bottom', 0);
        break;
      case 'swordsman':
        SpriteRenderer.drawSwordsman(ctx, spriteX, spriteY, 'bottom', 0);
        break;
      case 'archer':
        SpriteRenderer.drawArcher(ctx, spriteX, spriteY, 'bottom', 0);
        break;
      case 'mage':
        SpriteRenderer.drawMage(ctx, spriteX, spriteY, 'bottom', 0);
        break;
      case 'healer':
        SpriteRenderer.drawHealer(ctx, spriteX, spriteY, 'bottom', 0);
        break;
    }

    // Unit type label at bottom
    ctx.font = '10px monospace';
    ctx.fillStyle = '#888';
    ctx.fillText(card.type.charAt(0).toUpperCase() + card.type.slice(1), x + this.CARD_WIDTH / 2, y + this.CARD_HEIGHT - 10);
  }

  private drawCardBack(x: number, y: number): void {
    const ctx = this.ctx;

    // Card background
    const gradient = ctx.createLinearGradient(x, y, x + this.CARD_WIDTH, y + this.CARD_HEIGHT);
    gradient.addColorStop(0, '#2c3e50');
    gradient.addColorStop(1, '#1a252f');

    ctx.fillStyle = gradient;
    ctx.strokeStyle = '#4a5568';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, this.CARD_WIDTH, this.CARD_HEIGHT, 8);
    ctx.fill();
    ctx.stroke();

    // Question mark
    ctx.font = '40px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#4a5568';
    ctx.fillText('?', x + this.CARD_WIDTH / 2, y + this.CARD_HEIGHT / 2 + 12);
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

  private drawChipStack(x: number, y: number, amount: number): void {
    const ctx = this.ctx;

    // Chip background
    const gradient = ctx.createLinearGradient(x, y, x + 80, y + 25);
    gradient.addColorStop(0, '#ffd700');
    gradient.addColorStop(1, '#ff8c00');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(x, y, 80, 25, 12);
    ctx.fill();

    // Amount
    ctx.fillStyle = '#000';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(amount.toString(), x + 40, y + 17);
  }

  private drawBettingControls(state: PokerGameState, isPlayerTurn: boolean, canCheck: boolean, canCall: boolean, canRaise: boolean, callAmount: number): void {
    const { width, height } = this.canvas;
    const y = height - 50;
    this.buttons = [];

    const buttonWidth = 80;
    const buttonHeight = 35;
    const spacing = 10;
    const totalWidth = 5 * buttonWidth + 4 * spacing + 150; // Extra for slider
    let x = (width - totalWidth) / 2;

    // Fold button
    this.addButton(x, y, buttonWidth, buttonHeight, 'Fold', 'fold', !isPlayerTurn, '#ef4444');
    x += buttonWidth + spacing;

    // Check button
    this.addButton(x, y, buttonWidth, buttonHeight, 'Check', 'check', !isPlayerTurn || !canCheck, '#6b7280');
    x += buttonWidth + spacing;

    // Call button
    const callLabel = canCall ? `Call ${callAmount}` : 'Call';
    this.addButton(x, y, buttonWidth, buttonHeight, callLabel, 'call', !isPlayerTurn || !canCall, '#22c55e');
    x += buttonWidth + spacing;

    // Raise button
    this.addButton(x, y, buttonWidth, buttonHeight, `Raise ${this.sliderValue}`, 'raise', !isPlayerTurn || !canRaise, '#f59e0b');
    x += buttonWidth + spacing;

    // Raise slider
    if (canRaise && isPlayerTurn) {
      this.drawSlider(x, y + 5, 120, 25);
    }
    x += 130;

    // All-in button
    this.addButton(x, y, buttonWidth, buttonHeight, 'All In', 'all_in', !isPlayerTurn || state.player.isAllIn, '#a855f7');

    // Draw all buttons
    for (const btn of this.buttons) {
      this.drawButton(btn);
    }
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

  private drawSlider(x: number, y: number, width: number, height: number): void {
    const ctx = this.ctx;

    // Track
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.roundRect(x, y + height / 2 - 4, width, 8, 4);
    ctx.fill();

    // Filled portion
    const percent = (this.sliderValue - this.sliderMin) / (this.sliderMax - this.sliderMin);
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.roundRect(x, y + height / 2 - 4, width * percent, 8, 4);
    ctx.fill();

    // Handle
    const handleX = x + width * percent;
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(handleX, y + height / 2, 8, 0, Math.PI * 2);
    ctx.fill();

    // Value display
    ctx.fillStyle = '#f59e0b';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.sliderValue.toString(), x + width / 2, y - 5);
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

    // Hand number and blinds
    ctx.fillStyle = '#888';
    ctx.font = '12px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Hand #${state.handNumber}`, 50, 30);
    ctx.fillText(`Blinds: ${state.smallBlind}/${state.bigBlind}`, 150, 30);

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

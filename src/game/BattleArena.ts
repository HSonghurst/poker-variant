import type { Team, PlayerPosition } from './types';
import type { Card } from './Card';
import { TeamModifiers } from './Card';
import type { UnitCard } from './UnitCardDeck';
import { Fighter } from './Fighter';
import { Knight } from './Knight';
import { Swordsman } from './Swordsman';
import { Archer } from './Archer';
import { Mage } from './Mage';
import { Healer } from './Healer';
import { DamageNumberManager } from './DamageNumber';
import { HexGrid, type HexCoord } from './HexGrid';

export interface BattleConfig {
  playerUnits: UnitCard[];
  opponentUnits: UnitCard[];
  modifiers: Card[];
}

type BattleEndCallback = (winner: PlayerPosition | 'tie') => void;

export class BattleArena {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private playerTeam: Fighter[] = [];
  private opponentTeam: Fighter[] = [];
  private sharedModifiers: TeamModifiers;
  private running: boolean = false;
  private onBattleEnd: BattleEndCallback;
  private battleStartTime: number = 0;
  private maxBattleDuration: number = 30000; // 30 seconds max
  private lastFrameTime: number = 0;
  private animationFrameId: number | null = null;

  // Hex grid
  private hexGrid: HexGrid;
  private fighterHexes: Map<Fighter, HexCoord> = new Map();

  // Arena bounds (centered in canvas)
  private arenaTop: number;
  private arenaBottom: number;
  private arenaLeft: number;
  private arenaRight: number;

  // Positioning mode
  private positioningMode: boolean = false;
  private draggedFighter: Fighter | null = null;
  private hoveredHex: HexCoord | null = null;
  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;

  constructor(canvas: HTMLCanvasElement, onBattleEnd: BattleEndCallback) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.onBattleEnd = onBattleEnd;
    this.sharedModifiers = new TeamModifiers();

    // Define arena bounds - centered on the poker table
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    // Arena is in the center area of the poker table
    this.arenaLeft = centerX - 350;
    this.arenaRight = centerX + 350;
    this.arenaTop = centerY - 180;
    this.arenaBottom = centerY + 180;

    // Calculate hex size for 6x6 grid
    const hexSize = 32;

    // Center the 6x6 grid in the arena
    const gridWidth = 6 * Math.sqrt(3) * hexSize;
    const gridHeight = 6 * hexSize * 1.5;
    const originX = centerX - gridWidth / 2 + hexSize * 0.866;
    const originY = centerY - gridHeight / 2 + hexSize;

    this.hexGrid = new HexGrid(6, 6, hexSize, originX, originY);

    // Bind mouse event handlers
    this.boundMouseDown = this.handleMouseDown.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseUp = this.handleMouseUp.bind(this);
  }

  // Priority order for front row placement (lower = front)
  private static readonly UNIT_PRIORITY: Record<string, number> = {
    knight: 0,
    swordsman: 1,
    mage: 2,
    archer: 3,
    healer: 4
  };

  setupBattle(config: BattleConfig): void {
    // Clear previous state
    this.playerTeam = [];
    this.opponentTeam = [];
    this.fighterHexes.clear();
    this.hexGrid.clearOccupied();
    this.sharedModifiers = new TeamModifiers();

    // Apply all community modifier cards to shared modifiers
    for (const card of config.modifiers) {
      this.sharedModifiers.applyCard(card);
    }

    const UNITS_PER_CARD = 3;

    // Collect all unit types for each team
    const opponentUnitTypes: string[] = [];
    const playerUnitTypes: string[] = [];

    for (const unitCard of config.opponentUnits) {
      for (let j = 0; j < UNITS_PER_CARD; j++) {
        opponentUnitTypes.push(unitCard.type);
      }
    }
    for (const unitCard of config.playerUnits) {
      for (let j = 0; j < UNITS_PER_CARD; j++) {
        playerUnitTypes.push(unitCard.type);
      }
    }

    // Sort by priority (knights first, healers last)
    opponentUnitTypes.sort((a, b) => BattleArena.UNIT_PRIORITY[a] - BattleArena.UNIT_PRIORITY[b]);
    playerUnitTypes.sort((a, b) => BattleArena.UNIT_PRIORITY[a] - BattleArena.UNIT_PRIORITY[b]);

    // Place opponent units (top team)
    // Row 2 is front (closer to center), Row 1 is back
    // Units centered in columns 1-3 (middle of 6-wide grid)
    for (let i = 0; i < opponentUnitTypes.length && i < 6; i++) {
      const row = i < 3 ? 2 : 1; // First 3 in front row (row 2), rest in back row (row 1)
      const col = (i % 3) + 1; // Offset by 1 to center (columns 1, 2, 3)
      const hex = { col, row };
      const pos = this.hexGrid.hexToPixel(hex);

      const fighter = this.createFighterByType(opponentUnitTypes[i], 'top', pos.x, pos.y);
      fighter.applyModifiers(this.sharedModifiers);
      this.opponentTeam.push(fighter);
      this.fighterHexes.set(fighter, hex);
      // Don't mark as occupied - keep opponent positions hidden during positioning
    }

    // Place player units (bottom team)
    // Row 3 is front (closer to center), Row 4 is back
    // Units centered in columns 1-3 (middle of 6-wide grid)
    for (let i = 0; i < playerUnitTypes.length && i < 6; i++) {
      const row = i < 3 ? 3 : 4; // First 3 in front row (row 3), rest in back row (row 4)
      const col = (i % 3) + 1; // Offset by 1 to center (columns 1, 2, 3)
      const hex = { col, row };
      const pos = this.hexGrid.hexToPixel(hex);

      const fighter = this.createFighterByType(playerUnitTypes[i], 'bottom', pos.x, pos.y);
      fighter.applyModifiers(this.sharedModifiers);
      this.playerTeam.push(fighter);
      this.fighterHexes.set(fighter, hex);
      this.hexGrid.setOccupied(hex, true);
    }
  }

  private createFighterByType(unitType: string, team: Team, x: number, y: number): Fighter {
    const canvasHeight = this.canvas.height;
    let fighter: Fighter;

    switch (unitType) {
      case 'knight':
        fighter = new Knight(team, x, canvasHeight);
        break;
      case 'swordsman':
        fighter = new Swordsman(team, x, canvasHeight);
        break;
      case 'archer':
        fighter = new Archer(team, x, canvasHeight);
        break;
      case 'mage':
        fighter = new Mage(team, x, canvasHeight);
        break;
      case 'healer':
        fighter = new Healer(team, x, canvasHeight);
        break;
      default:
        fighter = new Swordsman(team, x, canvasHeight);
    }

    fighter.x = x;
    fighter.y = y;

    return fighter;
  }


  // Positioning mode methods
  startPositioning(): void {
    this.positioningMode = true;

    // Add mouse event listeners
    this.canvas.addEventListener('mousedown', this.boundMouseDown);
    this.canvas.addEventListener('mousemove', this.boundMouseMove);
    this.canvas.addEventListener('mouseup', this.boundMouseUp);
    this.canvas.addEventListener('mouseleave', this.boundMouseUp);

    // Set cursor style
    this.canvas.style.cursor = 'default';

    // Draw initial state
    this.drawPositioning();
  }

  stopPositioning(): void {
    this.positioningMode = false;
    this.draggedFighter = null;
    this.hoveredHex = null;

    // Remove mouse event listeners
    this.canvas.removeEventListener('mousedown', this.boundMouseDown);
    this.canvas.removeEventListener('mousemove', this.boundMouseMove);
    this.canvas.removeEventListener('mouseup', this.boundMouseUp);
    this.canvas.removeEventListener('mouseleave', this.boundMouseUp);

    this.canvas.style.cursor = 'default';
  }

  private getMousePos(e: MouseEvent): { x: number; y: number } {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY
    };
  }

  private handleMouseDown(e: MouseEvent): void {
    if (!this.positioningMode) return;

    const pos = this.getMousePos(e);

    // Check if clicking on a player fighter
    for (const fighter of this.playerTeam) {
      const dx = pos.x - fighter.x;
      const dy = pos.y - fighter.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 25) { // Hit radius
        this.draggedFighter = fighter;
        this.canvas.style.cursor = 'grabbing';

        // Remove from current hex
        const currentHex = this.fighterHexes.get(fighter);
        if (currentHex) {
          this.hexGrid.setOccupied(currentHex, false);
        }

        this.drawPositioning();
        return;
      }
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    if (!this.positioningMode) return;

    const pos = this.getMousePos(e);
    const hex = this.hexGrid.getNearestHex(pos);

    if (this.draggedFighter) {
      // Update hovered hex for preview
      if (this.hexGrid.isPlayerHalf(hex) && !this.hexGrid.isOccupied(hex)) {
        this.hoveredHex = hex;
      } else {
        this.hoveredHex = null;
      }

      // Move fighter to mouse position for visual feedback
      this.draggedFighter.x = pos.x;
      this.draggedFighter.y = pos.y;

      this.drawPositioning();
    } else {
      // Update cursor based on hover
      let overFighter = false;
      for (const fighter of this.playerTeam) {
        const dx = pos.x - fighter.x;
        const dy = pos.y - fighter.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        if (distance < 25) {
          overFighter = true;
          break;
        }
      }
      this.canvas.style.cursor = overFighter ? 'grab' : 'default';
    }
  }

  private handleMouseUp(e: MouseEvent): void {
    if (!this.draggedFighter) return;

    const pos = this.getMousePos(e);
    const hex = this.hexGrid.getNearestHex(pos);

    // Check if valid placement (player half, not occupied)
    if (this.hexGrid.isPlayerHalf(hex) && !this.hexGrid.isOccupied(hex)) {
      // Place on new hex
      const newPos = this.hexGrid.hexToPixel(hex);
      this.draggedFighter.x = newPos.x;
      this.draggedFighter.y = newPos.y;
      this.fighterHexes.set(this.draggedFighter, hex);
      this.hexGrid.setOccupied(hex, true);
    } else {
      // Return to original hex
      const originalHex = this.fighterHexes.get(this.draggedFighter);
      if (originalHex) {
        const originalPos = this.hexGrid.hexToPixel(originalHex);
        this.draggedFighter.x = originalPos.x;
        this.draggedFighter.y = originalPos.y;
        this.hexGrid.setOccupied(originalHex, true);
      }
    }

    this.draggedFighter = null;
    this.hoveredHex = null;
    this.canvas.style.cursor = 'default';
    this.drawPositioning();
  }

  private drawPokerTable(): void {
    const { width, height } = this.canvas;
    const padding = 40;

    // Outer border (wood)
    this.ctx.fillStyle = '#8B4513';
    this.ctx.beginPath();
    this.ctx.roundRect(padding - 10, padding - 10, width - 2 * padding + 20, height - 2 * padding + 20, 20);
    this.ctx.fill();

    // Green felt
    this.ctx.fillStyle = '#1a472a';
    this.ctx.beginPath();
    this.ctx.roundRect(padding, padding, width - 2 * padding, height - 2 * padding, 15);
    this.ctx.fill();

    // Inner shadow/gradient
    const gradient = this.ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, 400);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.3)');
    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.roundRect(padding, padding, width - 2 * padding, height - 2 * padding, 15);
    this.ctx.fill();

    // Team labels
    this.ctx.font = 'bold 14px monospace';
    this.ctx.textAlign = 'center';

    this.ctx.fillStyle = '#4a90d9';
    this.ctx.fillText('OPPONENT', width / 2, padding + 25);

    this.ctx.fillStyle = '#d94a4a';
    this.ctx.fillText('YOU', width / 2, height - padding - 15);
  }

  private drawPositioning(): void {
    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw poker table background
    this.drawPokerTable();

    // Draw hex grid
    this.hexGrid.draw(this.ctx, true);

    // Draw hovered hex highlight
    if (this.hoveredHex) {
      this.hexGrid.drawHighlightedHex(this.ctx, this.hoveredHex, 'rgba(34, 197, 94, 0.4)');
    }

    // Draw "DRAG TO POSITION" text
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = 'bold 16px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('DRAG YOUR UNITS TO POSITION (1 per hex)', this.canvas.width / 2, 25);

    // Draw mystery indicators for opponent units (hidden positions)
    this.ctx.fillStyle = 'rgba(74, 144, 217, 0.3)';
    this.ctx.font = 'bold 24px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`? ? ?  ${this.opponentTeam.length} enemy units  ? ? ?`, this.canvas.width / 2, 85);

    // Don't draw opponent fighters - keep their positions hidden
    // Draw player fighters only
    for (const fighter of this.playerTeam) {
      fighter.draw(this.ctx);

      // Draw grab indicator for player units (if not being dragged)
      if (this.draggedFighter !== fighter) {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();
        this.ctx.arc(fighter.x, fighter.y, 22, 0, Math.PI * 2);
        this.ctx.stroke();
      }
    }

    // Draw highlight on dragged fighter
    if (this.draggedFighter) {
      this.ctx.strokeStyle = '#ffd700';
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(this.draggedFighter.x, this.draggedFighter.y, 25, 0, Math.PI * 2);
      this.ctx.stroke();
    }

    // Draw Start Battle button
    this.drawStartBattleButton();
  }

  private drawStartBattleButton(): void {
    const btnWidth = 150;
    const btnHeight = 40;
    const btnX = this.canvas.width / 2 - btnWidth / 2;
    const btnY = this.canvas.height - 60;

    // Button background
    const gradient = this.ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnHeight);
    gradient.addColorStop(0, '#ef4444');
    gradient.addColorStop(1, '#dc2626');

    this.ctx.fillStyle = gradient;
    this.ctx.beginPath();
    this.ctx.roundRect(btnX, btnY, btnWidth, btnHeight, 8);
    this.ctx.fill();

    // Button text
    this.ctx.fillStyle = '#fff';
    this.ctx.font = 'bold 16px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('START BATTLE!', this.canvas.width / 2, btnY + 26);
  }

  getStartBattleButtonBounds(): { x: number; y: number; width: number; height: number } {
    const btnWidth = 150;
    const btnHeight = 40;
    return {
      x: this.canvas.width / 2 - btnWidth / 2,
      y: this.canvas.height - 60,
      width: btnWidth,
      height: btnHeight
    };
  }

  isPositioning(): boolean {
    return this.positioningMode;
  }

  start(): void {
    if (this.running) return;

    // Stop positioning mode if active
    if (this.positioningMode) {
      this.stopPositioning();
    }

    this.running = true;
    this.battleStartTime = Date.now();
    this.lastFrameTime = performance.now();

    this.gameLoop();
  }

  private gameLoop = (): void => {
    if (!this.running) return;

    const now = performance.now();
    const deltaTime = now - this.lastFrameTime;
    this.lastFrameTime = now;

    this.update(deltaTime);
    this.draw();

    // Check win condition
    const winner = this.checkWinCondition();
    if (winner !== null) {
      this.end(winner);
      return;
    }

    // Check timeout
    if (Date.now() - this.battleStartTime > this.maxBattleDuration) {
      this.resolveByHealth();
      return;
    }

    this.animationFrameId = requestAnimationFrame(this.gameLoop);
  };

  private update(deltaTime: number): void {
    // Update all fighters
    for (const fighter of this.opponentTeam) {
      if (!fighter.isDead) {
        fighter.update(this.playerTeam, deltaTime, this.opponentTeam);
      }
    }

    for (const fighter of this.playerTeam) {
      if (!fighter.isDead) {
        fighter.update(this.opponentTeam, deltaTime, this.playerTeam);
      }
    }

    // Update damage numbers
    DamageNumberManager.update(deltaTime);

    // Keep fighters in arena bounds
    this.constrainToArena();
  }

  private constrainToArena(): void {
    const allFighters = [...this.playerTeam, ...this.opponentTeam];
    for (const fighter of allFighters) {
      if (fighter.x < this.arenaLeft) fighter.x = this.arenaLeft;
      if (fighter.x > this.arenaRight) fighter.x = this.arenaRight;
      if (fighter.y < this.arenaTop) fighter.y = this.arenaTop;
      if (fighter.y > this.arenaBottom) fighter.y = this.arenaBottom;
    }
  }

  private draw(): void {
    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw poker table background
    this.drawPokerTable();

    // Draw hex grid (faded during battle)
    this.ctx.globalAlpha = 0.2;
    this.hexGrid.draw(this.ctx, false);
    this.ctx.globalAlpha = 1;

    // Draw all fighters
    for (const fighter of this.opponentTeam) {
      fighter.draw(this.ctx);
    }
    for (const fighter of this.playerTeam) {
      fighter.draw(this.ctx);
    }

    // Draw damage numbers
    DamageNumberManager.draw(this.ctx);

    // Draw battle timer
    this.drawBattleTimer();
  }

  private drawBattleTimer(): void {
    const elapsed = Date.now() - this.battleStartTime;
    const remaining = Math.max(0, this.maxBattleDuration - elapsed);
    const seconds = Math.ceil(remaining / 1000);

    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(this.canvas.width / 2 - 40, 10, 80, 30);

    this.ctx.fillStyle = seconds <= 10 ? '#ef4444' : '#ffffff';
    this.ctx.font = 'bold 18px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText(`${seconds}s`, this.canvas.width / 2, 32);
  }

  private checkWinCondition(): PlayerPosition | 'tie' | null {
    const playerAlive = this.playerTeam.filter(f => !f.isDead).length;
    const opponentAlive = this.opponentTeam.filter(f => !f.isDead).length;

    if (playerAlive === 0 && opponentAlive === 0) return 'tie';
    if (playerAlive === 0) return 'opponent';
    if (opponentAlive === 0) return 'player';
    return null; // Battle continues
  }

  private resolveByHealth(): void {
    // Calculate total health percentage for each team
    const playerHealth = this.calculateTeamHealthPercent(this.playerTeam);
    const opponentHealth = this.calculateTeamHealthPercent(this.opponentTeam);

    const diff = Math.abs(playerHealth - opponentHealth);

    if (diff < 0.05) {
      // Within 5% - tie
      this.end('tie');
    } else if (playerHealth > opponentHealth) {
      this.end('player');
    } else {
      this.end('opponent');
    }
  }

  private calculateTeamHealthPercent(team: Fighter[]): number {
    let totalCurrent = 0;
    let totalMax = 0;

    for (const fighter of team) {
      totalCurrent += Math.max(0, fighter.health);
      totalMax += fighter.maxHealth;
    }

    return totalMax > 0 ? totalCurrent / totalMax : 0;
  }

  private end(winner: PlayerPosition | 'tie'): void {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.onBattleEnd(winner);
  }

  stop(): void {
    this.running = false;
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  reset(): void {
    this.stop();
    this.playerTeam = [];
    this.opponentTeam = [];
    this.fighterHexes.clear();
    this.hexGrid.clearOccupied();
    this.sharedModifiers = new TeamModifiers();
  }

  isRunning(): boolean {
    return this.running;
  }

  // Get team info for UI display
  getPlayerTeam(): Fighter[] {
    return this.playerTeam;
  }

  getOpponentTeam(): Fighter[] {
    return this.opponentTeam;
  }

  getModifiers(): TeamModifiers {
    return this.sharedModifiers;
  }
}

import type { Team, PlayerPosition } from './types';
import type { Card } from './Card';
import { TeamModifiers } from './Card';
import type { UnitCard } from './UnitCardDeck';
import type { GodCard, GodPowerType } from './GodCardDeck';
import { Fighter } from './Fighter';
import { Knight } from './Knight';
import { Swordsman } from './Swordsman';
import { Archer } from './Archer';
import { Mage } from './Mage';
import { Healer } from './Healer';
import { DamageNumberManager } from './DamageNumber';
import { HexGrid, type HexCoord } from './HexGrid';
import { SoundManager } from './SoundManager';
import { SlotManager } from './AttackSlotSystem';

// Team unit configurations for 6-team battles
export interface TeamUnits {
  team: Team;
  units: UnitCard[];
}

export interface BattleConfig {
  playerUnits: UnitCard[];        // bottom team (player)
  opponentUnits: UnitCard[];      // top team
  leftUnits?: UnitCard[];         // topLeft team (optional)
  topRightUnits?: UnitCard[];     // topRight team (optional)
  bottomRightUnits?: UnitCard[];  // bottomRight team (optional)
  bottomLeftUnits?: UnitCard[];   // bottomLeft team (optional)
  modifiers: Card[];              // Shared modifiers (community cards) - apply to all
  teamModifiers?: {               // Per-team modifiers (kept cards) - apply only to that team
    player?: Card[];
    opponent?: Card[];
    topLeft?: Card[];
    topRight?: Card[];
    bottomLeft?: Card[];
    bottomRight?: Card[];
  };
  playerGodCards: GodCard[];
  opponentGodCards: GodCard[];
}

interface GodPowerEffect {
  type: GodPowerType;
  x: number;
  y: number;
  startTime: number;
  duration: number;
  radius?: number;
}

type BattleEndCallback = (winner: PlayerPosition | 'tie') => void;

interface TeamSummary {
  team: Team;
  totalKills: number;
  killsByType: Map<string, number>;
  unitsRemaining: number;
  totalUnits: number;
}

interface BattleSummary {
  winner: PlayerPosition | 'tie';
  teams: TeamSummary[];
  battleDuration: number;
}

export class BattleArena {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  // 6 teams positioned around hexagon edges
  private teams: Map<Team, Fighter[]> = new Map();
  private teamKills: Map<Team, number> = new Map(); // Kill scores per team
  private teamKillsByType: Map<Team, Map<string, number>> = new Map(); // Kills by unit type per team
  private lastAliveCount: Map<Team, number> = new Map(); // For tracking kills
  private sharedModifiers: TeamModifiers;
  private perTeamModifiers: Map<Team, TeamModifiers> = new Map();
  private battleSummary: BattleSummary | null = null;
  private running: boolean = false;
  private onBattleEnd: BattleEndCallback;
  private battleStartTime: number = 0;
  private maxBattleDuration: number = 120000; // 120 seconds max for large armies
  private lastFrameTime: number = 0;
  private animationFrameId: number | null = null;
  private lastAggroIncreaseTime: number = 0;
  private readonly AGGRO_INCREASE_INTERVAL: number = 10000; // 10 seconds
  private readonly AGGRO_INCREASE_MULTIPLIER: number = 1.25; // 25% increase

  // Hex grid
  private hexGrid: HexGrid;
  private fighterHexes: Map<Fighter, HexCoord> = new Map();

  // Arena center and hexagon geometry
  private arenaCenterX: number;
  private arenaCenterY: number;
  private hexRadius: number; // Distance from center to edge midpoints


  // Positioning mode
  private positioningMode: boolean = false;
  private playerFormations: { units: Fighter[]; centerX: number; centerY: number }[] = [];
  private draggingFormation: number = -1;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;

  // God cards (Note: AI god card usage not yet implemented)
  private playerGodCards: GodCard[] = [];
  private godCardCooldowns: Map<string, number> = new Map();
  private selectedGodCard: GodCard | null = null;
  private godPowerEffects: GodPowerEffect[] = [];
  private teleportSourceUnit: Fighter | null = null;
  private showingSummary: boolean = false;
  private lastBattleWinner: PlayerPosition | 'tie' | null = null;

  constructor(canvas: HTMLCanvasElement, onBattleEnd: BattleEndCallback) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.onBattleEnd = onBattleEnd;
    this.sharedModifiers = new TeamModifiers();

    // Initialize teams map and kill tracking
    const allTeams: Team[] = ['blue', 'purple', 'pink', 'red', 'orange', 'green'];
    for (const team of allTeams) {
      this.teams.set(team, []);
      this.teamKills.set(team, 0);
      this.teamKillsByType.set(team, new Map());
      this.lastAliveCount.set(team, 0);
    }

    // Arena center
    this.arenaCenterX = canvas.width / 2;
    this.arenaCenterY = canvas.height / 2;

    // Hexagon radius (distance from center to edge midpoints) - fits within canvas
    this.hexRadius = Math.min(canvas.width, canvas.height) / 2 - 40;

    // Hex grid for positioning (larger grid for big armies)
    const hexSize = 20;
    const gridWidth = 16 * Math.sqrt(3) * hexSize;
    const gridHeight = 12 * hexSize * 1.5;
    const originX = this.arenaCenterX - gridWidth / 2 + hexSize * 0.866;
    const originY = this.arenaCenterY - gridHeight / 2 + hexSize;

    this.hexGrid = new HexGrid(16, 12, hexSize, originX, originY);
  }

  // Get the angle for each team's position on the hexagon (0 = right, counterclockwise)
  private getTeamAngle(team: Team): number {
    const angles: Record<Team, number> = {
      blue: Math.PI / 2,           // 90 degrees (top)
      green: Math.PI * 5 / 6,   // 150 degrees
      orange: Math.PI * 7 / 6, // 210 degrees
      red: Math.PI * 3 / 2,     // 270 degrees (bottom)
      pink: Math.PI * 11 / 6, // 330 degrees
      purple: Math.PI / 6        // 30 degrees
    };
    return angles[team];
  }

  // Get the spawn position for a team (inside the arena)
  private getTeamSpawnPosition(team: Team): { x: number; y: number; angle: number } {
    const angle = this.getTeamAngle(team);
    const spawnRadius = this.hexRadius * 0.8; // Spawn inside arena
    return {
      x: this.arenaCenterX + Math.cos(angle) * spawnRadius,
      y: this.arenaCenterY - Math.sin(angle) * spawnRadius,
      angle
    };
  }

  setupBattle(config: BattleConfig): void {
    // Clear previous state
    for (const team of this.teams.keys()) {
      this.teams.set(team, []);
      this.teamKills.set(team, 0);
      this.teamKillsByType.set(team, new Map());
      this.lastAliveCount.set(team, 0);
    }
    this.playerFormations = [];
    this.battleSummary = null;
    this.fighterHexes.clear();
    this.hexGrid.clearOccupied();
    this.sharedModifiers = new TeamModifiers();
    this.perTeamModifiers.clear();
    this.godPowerEffects = [];
    this.godCardCooldowns.clear();
    this.selectedGodCard = null;
    this.teleportSourceUnit = null;
    this.draggingFormation = -1;
    SlotManager.reset(); // Reset attack slot system

    // Store god cards (AI god card usage not yet implemented)
    this.playerGodCards = config.playerGodCards || [];

    // Apply all community modifier cards to shared modifiers (apply to everyone)
    for (const card of config.modifiers) {
      this.sharedModifiers.applyCard(card);
    }

    // Apply per-team modifiers (only apply to that team's units)
    if (config.teamModifiers) {
      // NOTE: 'player' position maps to 'red' team (bottom, labeled "YOU")
      const teamMapping: Record<string, Team> = {
        player: 'red',
        opponent: 'blue',
        topLeft: 'green',
        topRight: 'pink',
        bottomLeft: 'orange',
        bottomRight: 'purple'
      };

      for (const [position, cards] of Object.entries(config.teamModifiers)) {
        if (cards && cards.length > 0) {
          const team = teamMapping[position];
          if (team) {
            const teamMods = new TeamModifiers();
            for (const card of cards) {
              teamMods.applyCard(card);
              console.log(`[BattleArena] Applied card "${card.name}" to team ${team}`);
            }
            console.log(`[BattleArena] Team ${team} modifiers:`, {
              archerFanAbility: teamMods.archerFanAbility,
              swordsmanSweepAbility: teamMods.swordsmanSweepAbility
            });
            this.perTeamModifiers.set(team, teamMods);
          }
        }
      }
    }

    // Units per card by type
    const UNITS_PER_TYPE: Record<string, number> = {
      swordsman: 10,
      mage: 5,
      knight: 10,
      archer: 10,
      healer: 5
    };
    const UNIT_SPACING = 10; // Spacing for units in group
    const FORMATION_WIDTH = 5; // Units per row

    // Create group for a team on a hexagon edge
    const createHexFormation = (unitType: string, count: number, team: Team, formationIndex: number, totalFormations: number) => {
      const fighters: Fighter[] = [];
      const spawnPos = this.getTeamSpawnPosition(team);

      // Direction vectors: forward points towards center, right is perpendicular
      const forwardX = Math.cos(spawnPos.angle + Math.PI);
      const forwardY = Math.sin(spawnPos.angle + Math.PI);
      const rightX = -forwardY;
      const rightY = forwardX;

      // Offset along the edge for multiple formations
      const formationSpread = 80;
      const formationOffset = (formationIndex - (totalFormations - 1) / 2) * formationSpread;

      const baseX = spawnPos.x + rightX * formationOffset;
      const baseY = spawnPos.y + rightY * formationOffset;

      // Calculate grid dimensions
      const cols = Math.min(count, FORMATION_WIDTH);
      const rows = Math.ceil(count / FORMATION_WIDTH);

      for (let i = 0; i < count; i++) {
        const row = Math.floor(i / FORMATION_WIDTH);
        const col = i % FORMATION_WIDTH;

        // Grid offsets centered on (0,0)
        const gridX = (col - (cols - 1) / 2) * UNIT_SPACING;
        const gridY = (row - (rows - 1) / 2) * UNIT_SPACING;

        // Transform to world position
        const x = baseX + rightX * gridX + forwardX * gridY;
        const y = baseY + rightY * gridX + forwardY * gridY;

        const fighter = this.createFighterByType(unitType, team, x, y);
        fighter.arenaCenterX = this.arenaCenterX;
        fighter.arenaCenterY = this.arenaCenterY;
        // Combine shared modifiers (community cards) with team-specific modifiers (kept cards)
        const teamMods = this.perTeamModifiers.get(team);
        const combinedMods = teamMods
          ? this.sharedModifiers.combine(teamMods)
          : this.sharedModifiers;
        fighter.applyModifiers(combinedMods);

        // Set group offset for formation maintenance
        fighter.groupOffsetX = gridX;
        fighter.groupOffsetY = gridY;

        fighters.push(fighter);
      }

      // Link all fighters in this group to each other
      for (const fighter of fighters) {
        fighter.groupMembers = fighters;
      }

      return { fighters, centerX: baseX, centerY: baseY };
    };

    // Helper to add units for a team
    const addTeamUnits = (units: UnitCard[] | undefined, team: Team, isPlayer: boolean = false) => {
      if (!units || units.length === 0) return;

      const teamFighters = this.teams.get(team) || [];
      for (let i = 0; i < units.length; i++) {
        const unitCard = units[i];
        const unitCount = UNITS_PER_TYPE[unitCard.type] || 20;
        const { fighters, centerX, centerY } = createHexFormation(unitCard.type, unitCount, team, i, units.length);
        teamFighters.push(...fighters);

        // Track player formations for dragging
        if (isPlayer) {
          this.playerFormations.push({ units: fighters, centerX, centerY });
        }
      }
      this.teams.set(team, teamFighters);
    };

    // Add all teams
    addTeamUnits(config.opponentUnits, 'blue');
    addTeamUnits(config.topRightUnits, 'purple');
    addTeamUnits(config.bottomRightUnits, 'pink');
    addTeamUnits(config.playerUnits, 'red', true);
    addTeamUnits(config.bottomLeftUnits, 'orange');
    addTeamUnits(config.leftUnits, 'green');
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
    this.canvas.style.cursor = 'default';

    // Draw initial state (no individual unit dragging with 100 units)
    this.drawPositioning();
  }

  stopPositioning(): void {
    this.positioningMode = false;
    this.canvas.style.cursor = 'default';
  }

  private drawPositioning(): void {
    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw battle arena background
    this.drawBattleBackground();

    // Draw title
    this.ctx.fillStyle = '#ffd700';
    this.ctx.font = 'bold 24px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillText('BATTLE PREVIEW', this.canvas.width / 2, 35);

    // Draw instruction
    this.ctx.fillStyle = '#888';
    this.ctx.font = '14px monospace';
    this.ctx.fillText('Drag formations to reposition your army', this.canvas.width / 2, 55);

    // Draw team counts around the hexagon
    this.drawTeamCounts();

    // Draw all fighters
    for (const [, fighters] of this.teams) {
      for (const fighter of fighters) {
        fighter.draw(this.ctx);
      }
    }

    // Draw formation selection boxes for player formations
    for (let i = 0; i < this.playerFormations.length; i++) {
      const formation = this.playerFormations[i];
      const bounds = this.getFormationBounds(formation.units);
      const isSelected = this.draggingFormation === i;

      this.ctx.strokeStyle = isSelected ? '#ffd700' : 'rgba(220, 38, 38, 0.5)';
      this.ctx.lineWidth = isSelected ? 3 : 2;
      this.ctx.setLineDash(isSelected ? [] : [5, 5]);
      this.ctx.strokeRect(bounds.x - 10, bounds.y - 10, bounds.width + 20, bounds.height + 20);
      this.ctx.setLineDash([]);
    }

    // Draw Start Battle button
    this.drawStartBattleButton();
  }

  private drawTeamCounts(): void {
    const teamColors: Record<Team, string> = {
      blue: '#2563eb',
      purple: '#7c3aed',
      pink: '#db2777',
      red: '#dc2626',
      orange: '#ea580c',
      green: '#16a34a'
    };

    const teamLabels: Record<Team, string> = {
      blue: 'BLUE',
      purple: 'PURPLE',
      pink: 'PINK',
      red: 'YOU',
      orange: 'ORANGE',
      green: 'GREEN'
    };

    this.ctx.font = 'bold 12px monospace';

    for (const [team, fighters] of this.teams) {
      if (fighters.length === 0) continue;

      const pos = this.getTeamSpawnPosition(team);
      const alive = fighters.filter(f => !f.isDead).length;
      this.ctx.fillStyle = teamColors[team];
      this.ctx.textAlign = 'center';
      this.ctx.fillText(`${teamLabels[team]}: ${alive}/${fighters.length}`, pos.x, pos.y - 30);
    }
  }

  private drawTeamScores(): void {
    const teamColors: Record<Team, string> = {
      blue: '#2563eb',
      purple: '#7c3aed',
      pink: '#db2777',
      red: '#dc2626',
      orange: '#ea580c',
      green: '#16a34a'
    };

    // Draw kill scores at hexagon corners
    const allTeams: Team[] = ['blue', 'purple', 'pink', 'red', 'orange', 'green'];

    for (let i = 0; i < 6; i++) {
      const team = allTeams[i];
      const fighters = this.teams.get(team) || [];
      if (fighters.length === 0) continue;

      const kills = this.teamKills.get(team) || 0;

      // Get corner position (between this team's edge and the next)
      const angle = (Math.PI / 3) * i - Math.PI / 2;
      const cornerX = this.arenaCenterX + Math.cos(angle) * (this.hexRadius + 35);
      const cornerY = this.arenaCenterY + Math.sin(angle) * (this.hexRadius + 35);

      // Draw score background
      this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
      this.ctx.beginPath();
      this.ctx.arc(cornerX, cornerY, 20, 0, Math.PI * 2);
      this.ctx.fill();

      // Draw border in team color
      this.ctx.strokeStyle = teamColors[team];
      this.ctx.lineWidth = 3;
      this.ctx.beginPath();
      this.ctx.arc(cornerX, cornerY, 20, 0, Math.PI * 2);
      this.ctx.stroke();

      // Draw kill count
      this.ctx.fillStyle = '#fff';
      this.ctx.font = 'bold 16px monospace';
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText(`${kills}`, cornerX, cornerY);
    }

    // Reset text baseline
    this.ctx.textBaseline = 'alphabetic';
  }

  private getFormationBounds(units: Fighter[]): { x: number; y: number; width: number; height: number } {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const unit of units) {
      if (unit.x < minX) minX = unit.x;
      if (unit.y < minY) minY = unit.y;
      if (unit.x > maxX) maxX = unit.x;
      if (unit.y > maxY) maxY = unit.y;
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  // Positioning mouse handlers
  handlePositioningMouseDown(x: number, y: number): boolean {
    if (!this.positioningMode) return false;

    // Check if clicking on a player formation
    for (let i = 0; i < this.playerFormations.length; i++) {
      const formation = this.playerFormations[i];
      const bounds = this.getFormationBounds(formation.units);

      if (x >= bounds.x - 10 && x <= bounds.x + bounds.width + 10 &&
          y >= bounds.y - 10 && y <= bounds.y + bounds.height + 10) {
        this.draggingFormation = i;
        this.dragOffsetX = x - formation.centerX;
        this.dragOffsetY = y - formation.centerY;
        this.canvas.style.cursor = 'grabbing';
        return true;
      }
    }

    return false;
  }

  handlePositioningMouseMove(x: number, y: number): void {
    if (!this.positioningMode) return;

    if (this.draggingFormation >= 0) {
      const formation = this.playerFormations[this.draggingFormation];
      const newCenterX = x - this.dragOffsetX;
      const newCenterY = y - this.dragOffsetY;

      // Calculate movement delta
      const dx = newCenterX - formation.centerX;
      const dy = newCenterY - formation.centerY;

      // Constrain to hexagonal arena and player's spawn area (bottom section)
      let validDx = dx;
      let validDy = dy;

      // Check if new position would be in valid area (within hexagon)
      const newX = formation.centerX + dx;
      const newY = formation.centerY + dy;
      const distFromCenter = Math.sqrt(
        Math.pow(newX - this.arenaCenterX, 2) +
        Math.pow(newY - this.arenaCenterY, 2)
      );

      // Keep within hexagon and prefer player's side (bottom half)
      if (distFromCenter > this.hexRadius - 30) {
        // Scale back the movement to stay inside
        const scale = (this.hexRadius - 30) / distFromCenter;
        const adjustedX = this.arenaCenterX + (newX - this.arenaCenterX) * scale;
        const adjustedY = this.arenaCenterY + (newY - this.arenaCenterY) * scale;
        validDx = adjustedX - formation.centerX;
        validDy = adjustedY - formation.centerY;
      }

      // Move all units in formation
      for (const unit of formation.units) {
        unit.x += validDx;
        unit.y += validDy;
      }

      formation.centerX += validDx;
      formation.centerY += validDy;

      this.drawPositioning();
    } else {
      // Check for hover over formations
      let hovering = false;
      for (const formation of this.playerFormations) {
        const bounds = this.getFormationBounds(formation.units);
        if (x >= bounds.x - 10 && x <= bounds.x + bounds.width + 10 &&
            y >= bounds.y - 10 && y <= bounds.y + bounds.height + 10) {
          hovering = true;
          break;
        }
      }
      this.canvas.style.cursor = hovering ? 'grab' : 'default';
    }
  }

  handlePositioningMouseUp(): void {
    if (!this.positioningMode) return;

    this.draggingFormation = -1;
    this.canvas.style.cursor = 'default';
    this.drawPositioning();
  }

  private drawBattleBackground(): void {
    // Draw circular arena
    const ctx = this.ctx;
    const arenaRadius = this.hexRadius + 20;

    // Draw circle background
    ctx.fillStyle = '#0d1117';
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, arenaRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw circle border
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, arenaRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Draw team spawn zone indicators (colored arcs)
    const teamColors: Record<Team, string> = {
      blue: '#2563eb',
      purple: '#7c3aed',
      pink: '#db2777',
      red: '#dc2626',
      orange: '#ea580c',
      green: '#16a34a'
    };

    const teams: Team[] = ['blue', 'purple', 'pink', 'red', 'orange', 'green'];

    for (let i = 0; i < 6; i++) {
      const team = teams[i];
      const fighters = this.teams.get(team) || [];
      if (fighters.length === 0) continue;

      // Draw arc for this team's zone
      const startAngle = (Math.PI / 3) * i - Math.PI / 2 - Math.PI / 6;
      const endAngle = (Math.PI / 3) * i - Math.PI / 2 + Math.PI / 6;

      ctx.strokeStyle = teamColors[team];
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(this.arenaCenterX, this.arenaCenterY, arenaRadius, startAngle, endAngle);
      ctx.stroke();
    }

    // Draw center marker
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.arc(this.arenaCenterX, this.arenaCenterY, 10, 0, Math.PI * 2);
    ctx.fill();
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

    // Initialize alive counts for kill tracking
    for (const [team, fighters] of this.teams) {
      this.lastAliveCount.set(team, fighters.filter(f => !f.isDead).length);
    }

    this.running = true;
    this.battleStartTime = Date.now();
    this.lastFrameTime = performance.now();
    this.lastAggroIncreaseTime = Date.now();
    Fighter.resetAggroRange(); // Reset aggro range at battle start

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
    // Increase aggro range every 10 seconds
    const now = Date.now();
    if (now - this.lastAggroIncreaseTime >= this.AGGRO_INCREASE_INTERVAL) {
      Fighter.increaseAggroRange(this.AGGRO_INCREASE_MULTIPLIER);
      this.lastAggroIncreaseTime = now;
    }

    // In a 6-way battle, everyone fights everyone else
    const allTeams: Team[] = ['blue', 'purple', 'pink', 'red', 'orange', 'green'];

    // Track alive counts before update
    const aliveBeforeUpdate = new Map<Team, Set<Fighter>>();
    for (const team of allTeams) {
      const fighters = this.teams.get(team) || [];
      aliveBeforeUpdate.set(team, new Set(fighters.filter(f => !f.isDead)));
    }

    // Collect all fighters and build enemy lists per team
    const allFighters: Fighter[] = [];
    const enemiesByTeam = new Map<Team, Fighter[]>();
    for (const team of allTeams) {
      const fighters = this.teams.get(team) || [];
      allFighters.push(...fighters);

      // Build enemy list for this team (everyone not on this team)
      const enemies: Fighter[] = [];
      for (const otherTeam of allTeams) {
        if (otherTeam !== team) {
          enemies.push(...(this.teams.get(otherTeam) || []));
        }
      }
      enemiesByTeam.set(team, enemies);
    }

    // STEP 1: Update targets for ALL fighters FIRST (before slot assignment)
    // This ensures slot grouping uses fresh target info
    for (const fighter of allFighters) {
      if (!fighter.isDead) {
        const enemies = enemiesByTeam.get(fighter.team) || [];
        fighter.findTarget(enemies);
      }
    }

    // STEP 2: Group attackers by their FRESH targets
    const attackersByTarget = new Map<Fighter, Fighter[]>();
    for (const fighter of allFighters) {
      if (fighter.isDead || !fighter.target || fighter.target.isDead) continue;
      const group = attackersByTarget.get(fighter.target) || [];
      group.push(fighter);
      attackersByTarget.set(fighter.target, group);
    }

    // STEP 3: Assign slots greedily for each target (closest units pick first)
    for (const [target, attackers] of attackersByTarget) {
      SlotManager.assignSlotsGreedy(attackers, target, allFighters);
    }

    // STEP 4: Update all fighters (skip target finding since we already did it)
    for (const team of allTeams) {
      const fighters = this.teams.get(team) || [];
      if (fighters.length === 0) continue;

      const enemies = enemiesByTeam.get(team) || [];

      for (const fighter of fighters) {
        if (!fighter.isDead) {
          fighter.update(enemies, deltaTime, fighters, true); // skipTargetFind = true
        }
      }
    }

    // Track kills - check which units died this frame
    for (const team of allTeams) {
      const aliveBefore = aliveBeforeUpdate.get(team) || new Set();
      for (const fighter of aliveBefore) {
        if (fighter.isDead && fighter.lastAttackerTeam) {
          // Credit kill to the attacker's team
          const attackerTeam = fighter.lastAttackerTeam;
          const currentKills = this.teamKills.get(attackerTeam) || 0;
          this.teamKills.set(attackerTeam, currentKills + 1);

          // Track kill by unit type (what type of unit made the kill)
          const killsByType = this.teamKillsByType.get(attackerTeam) || new Map();
          // Track what type of unit killed this fighter
          const killerType = fighter.lastAttackerType || 'unknown';
          const currentTypeKills = killsByType.get(killerType) || 0;
          killsByType.set(killerType, currentTypeKills + 1);
          this.teamKillsByType.set(attackerTeam, killsByType);

          // Clean up attack slots for dead target
          SlotManager.cleanupDeadTarget(fighter);
        }
      }
    }

    // Update damage numbers
    DamageNumberManager.update(deltaTime);

    // Keep fighters in arena bounds
    this.constrainToArena();
  }

  private constrainToArena(): void {
    // Keep fighters strictly inside the circular arena
    const maxDist = this.hexRadius; // Strict boundary at arena edge
    for (const [, fighters] of this.teams) {
      for (const fighter of fighters) {
        const dx = fighter.x - this.arenaCenterX;
        const dy = fighter.y - this.arenaCenterY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > maxDist) {
          // Hard clamp to edge - no exceptions
          fighter.x = this.arenaCenterX + (dx / dist) * maxDist;
          fighter.y = this.arenaCenterY + (dy / dist) * maxDist;
        }
      }
    }
  }

  private draw(): void {
    // Clear canvas
    this.ctx.fillStyle = '#1a1a2e';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw battle arena background
    this.drawBattleBackground();

    // Draw all fighters
    for (const [, fighters] of this.teams) {
      for (const fighter of fighters) {
        fighter.draw(this.ctx);
      }
    }

    // Draw god power effects
    this.drawGodPowerEffects();

    // Draw damage numbers
    DamageNumberManager.draw(this.ctx);

    // Draw team counts around the hexagon
    this.drawTeamCounts();

    // Draw kill scores at corners
    this.drawTeamScores();

    // Draw live unit counts on right side
    this.drawLiveUnitCounts();

    // Draw god cards UI
    this.drawGodCards();

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

  private drawLiveUnitCounts(): void {
    const ctx = this.ctx;
    const panelX = this.canvas.width - 160;
    const panelY = 50;
    const panelWidth = 150;

    const teamColors: Record<Team, string> = {
      blue: '#2563eb',
      purple: '#7c3aed',
      pink: '#db2777',
      red: '#dc2626',
      orange: '#ea580c',
      green: '#16a34a'
    };

    const teamNames: Record<Team, string> = {
      blue: 'Blue',
      purple: 'Purple',
      pink: 'Pink',
      red: 'You',
      orange: 'Orange',
      green: 'Green'
    };

    const unitIcons: Record<string, string> = {
      knight: '🛡',
      swordsman: '⚔',
      archer: '🏹',
      mage: '🔮',
      healer: '💚'
    };

    // Get teams with units, sorted by total alive
    const teamData: { team: Team; alive: number; byType: Map<string, number> }[] = [];

    for (const [team, fighters] of this.teams) {
      if (fighters.length === 0) continue;

      const byType = new Map<string, number>();
      let alive = 0;

      for (const fighter of fighters) {
        if (!fighter.isDead) {
          alive++;
          const type = fighter.getType();
          byType.set(type, (byType.get(type) || 0) + 1);
        }
      }

      if (alive > 0 || fighters.length > 0) {
        teamData.push({ team, alive, byType });
      }
    }

    // Sort by alive count descending
    teamData.sort((a, b) => b.alive - a.alive);

    // Draw panel background
    const panelHeight = 20 + teamData.length * 45;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
    ctx.fillRect(panelX - 5, panelY - 5, panelWidth + 10, panelHeight);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.strokeRect(panelX - 5, panelY - 5, panelWidth + 10, panelHeight);

    // Title
    ctx.fillStyle = '#888';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('UNITS ALIVE', panelX, panelY + 8);

    // Draw each team
    let y = panelY + 25;
    for (const data of teamData) {
      // Team name and total
      ctx.fillStyle = teamColors[data.team];
      ctx.font = 'bold 11px monospace';
      ctx.fillText(`${teamNames[data.team]}`, panelX, y);

      ctx.fillStyle = data.alive > 0 ? '#fff' : '#666';
      ctx.font = '11px monospace';
      ctx.fillText(`${data.alive}`, panelX + 55, y);

      // Unit types breakdown
      const typeStrings: string[] = [];
      for (const [type, count] of data.byType) {
        const icon = unitIcons[type] || '?';
        typeStrings.push(`${icon}${count}`);
      }

      if (typeStrings.length > 0) {
        ctx.fillStyle = '#888';
        ctx.font = '9px monospace';
        ctx.fillText(typeStrings.join(' '), panelX, y + 12);
      }

      y += 45;
    }
  }

  private checkWinCondition(): PlayerPosition | 'tie' | null {
    // Count alive fighters per team
    const teamsWithAlive: Team[] = [];
    for (const [team, fighters] of this.teams) {
      const alive = fighters.filter(f => !f.isDead).length;
      if (alive > 0) {
        teamsWithAlive.push(team);
      }
    }

    // If only one team remains, determine winner
    if (teamsWithAlive.length <= 1) {
      if (teamsWithAlive.includes('red')) return 'player';
      if (teamsWithAlive.includes('blue')) return 'opponent';
      // Any other team winning, or all dead = tie
      return 'tie';
    }

    return null; // Battle continues (2+ teams still fighting)
  }

  private resolveByHealth(): void {
    // Calculate total health percentage for each team
    const healthByTeam = new Map<Team, number>();
    for (const [team, fighters] of this.teams) {
      if (fighters.length > 0) {
        healthByTeam.set(team, this.calculateTeamHealthPercent(fighters));
      }
    }

    // Find the team with highest health
    let bestTeam: Team | null = null;
    let bestHealth = -1;
    for (const [team, health] of healthByTeam) {
      if (health > bestHealth) {
        bestHealth = health;
        bestTeam = team;
      }
    }

    // Convert to PlayerPosition result
    if (bestTeam === 'red') {
      this.end('player');
    } else if (bestTeam === 'blue') {
      this.end('opponent');
    } else {
      // Any other team winning counts as tie for now
      this.end('tie');
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

    // Create battle summary
    const allTeams: Team[] = ['blue', 'purple', 'pink', 'red', 'orange', 'green'];
    const teamSummaries: TeamSummary[] = [];

    for (const team of allTeams) {
      const fighters = this.teams.get(team) || [];
      if (fighters.length === 0) continue;

      teamSummaries.push({
        team,
        totalKills: this.teamKills.get(team) || 0,
        killsByType: this.teamKillsByType.get(team) || new Map(),
        unitsRemaining: fighters.filter(f => !f.isDead).length,
        totalUnits: fighters.length
      });
    }

    // Sort by kills (highest first)
    teamSummaries.sort((a, b) => b.totalKills - a.totalKills);

    this.battleSummary = {
      winner,
      teams: teamSummaries,
      battleDuration: Date.now() - this.battleStartTime
    };

    // Show summary screen (persists until rematch clicked)
    this.showingSummary = true;
    this.lastBattleWinner = winner;
    this.drawBattleSummary();
  }

  // Get battle rankings as player positions (1st place = winner, 6th = worst)
  getBattleRankings(): PlayerPosition[] {
    if (!this.battleSummary) return [];

    // Must match the teamMapping in setupBattle()
    const teamToPosition: Record<Team, PlayerPosition> = {
      'red': 'player',
      'blue': 'opponent',
      'green': 'topLeft',
      'pink': 'topRight',
      'orange': 'bottomLeft',
      'purple': 'bottomRight'
    };

    // Sort by units remaining (primary), then kills (secondary)
    const sorted = [...this.battleSummary.teams].sort((a, b) => {
      if (b.unitsRemaining !== a.unitsRemaining) {
        return b.unitsRemaining - a.unitsRemaining;
      }
      return b.totalKills - a.totalKills;
    });

    return sorted.map(summary => teamToPosition[summary.team]);
  }

  private drawBattleSummary(): void {
    if (!this.battleSummary) return;

    const ctx = this.ctx;
    const { width, height } = this.canvas;

    // Dark overlay
    ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
    ctx.fillRect(0, 0, width, height);

    const teamColors: Record<Team, string> = {
      blue: '#2563eb',
      purple: '#7c3aed',
      pink: '#db2777',
      red: '#dc2626',
      orange: '#ea580c',
      green: '#16a34a'
    };

    const teamNames: Record<Team, string> = {
      blue: 'Blue',
      purple: 'Purple',
      pink: 'Pink',
      red: 'You',
      orange: 'Orange',
      green: 'Green'
    };

    // Title
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 32px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('BATTLE COMPLETE', width / 2, 50);

    // Winner announcement
    let winnerText = '';
    let winnerColor = '#fff';
    if (this.battleSummary.winner === 'player') {
      winnerText = 'VICTORY!';
      winnerColor = '#22c55e';
    } else if (this.battleSummary.winner === 'opponent') {
      winnerText = 'DEFEAT';
      winnerColor = '#ef4444';
    } else {
      winnerText = 'TIE';
      winnerColor = '#f59e0b';
    }

    ctx.fillStyle = winnerColor;
    ctx.font = 'bold 28px monospace';
    ctx.fillText(winnerText, width / 2, 90);

    // Battle duration
    const durationSecs = Math.floor(this.battleSummary.battleDuration / 1000);
    ctx.fillStyle = '#888';
    ctx.font = '14px monospace';
    ctx.fillText(`Battle Duration: ${durationSecs}s`, width / 2, 115);

    // Team stats
    const startY = 150;
    const rowHeight = 100;
    const colWidth = width / 3;

    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#fff';
    ctx.fillText('TEAM SCOREBOARD', width / 2, startY);

    // Draw each team's stats
    for (let i = 0; i < this.battleSummary.teams.length; i++) {
      const summary = this.battleSummary.teams[i];
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = colWidth * col + colWidth / 2;
      const y = startY + 30 + row * rowHeight;

      // Team name and total kills
      ctx.fillStyle = teamColors[summary.team];
      ctx.font = 'bold 18px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${teamNames[summary.team]}`, x, y);

      ctx.fillStyle = '#fff';
      ctx.font = 'bold 24px monospace';
      ctx.fillText(`${summary.totalKills} kills`, x, y + 25);

      // Units remaining
      ctx.fillStyle = '#888';
      ctx.font = '12px monospace';
      ctx.fillText(`${summary.unitsRemaining}/${summary.totalUnits} survived`, x, y + 45);

      // Kills by unit type (what type of unit got the kills)
      ctx.font = '10px monospace';
      const typeKills: string[] = [];
      const unitTypeIcons: Record<string, string> = {
        knight: '🛡️',
        swordsman: '⚔️',
        archer: '🏹',
        mage: '🔮',
        healer: '💚'
      };
      for (const [unitType, count] of summary.killsByType) {
        if (count > 0) {
          const icon = unitTypeIcons[unitType] || '';
          typeKills.push(`${icon}${count}`);
        }
      }
      if (typeKills.length > 0) {
        ctx.fillStyle = '#aaa';
        ctx.fillText('Kills by:', x, y + 58);
        ctx.fillStyle = '#888';
        ctx.fillText(typeKills.join('  '), x, y + 72);
      }
    }

    // Rematch button
    this.drawRematchButton();
  }

  private drawRematchButton(): void {
    const ctx = this.ctx;
    const btnWidth = 150;
    const btnHeight = 45;
    const btnX = this.canvas.width / 2 - btnWidth / 2;
    const btnY = this.canvas.height - 70;

    // Button background
    const gradient = ctx.createLinearGradient(btnX, btnY, btnX, btnY + btnHeight);
    gradient.addColorStop(0, '#22c55e');
    gradient.addColorStop(1, '#16a34a');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnWidth, btnHeight, 8);
    ctx.fill();

    // Button border
    ctx.strokeStyle = '#4ade80';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Button text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('CONTINUE', this.canvas.width / 2, btnY + 29);
  }

  getRematchButtonBounds(): { x: number; y: number; width: number; height: number } {
    const btnWidth = 150;
    const btnHeight = 45;
    return {
      x: this.canvas.width / 2 - btnWidth / 2,
      y: this.canvas.height - 70,
      width: btnWidth,
      height: btnHeight
    };
  }

  isShowingSummary(): boolean {
    return this.showingSummary;
  }

  handleRematchClick(x: number, y: number): boolean {
    if (!this.showingSummary) return false;

    const btn = this.getRematchButtonBounds();
    if (x >= btn.x && x <= btn.x + btn.width &&
        y >= btn.y && y <= btn.y + btn.height) {
      // Trigger the callback and reset summary state
      this.showingSummary = false;
      if (this.lastBattleWinner !== null) {
        this.onBattleEnd(this.lastBattleWinner);
      }
      return true;
    }
    return false;
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
    for (const team of this.teams.keys()) {
      this.teams.set(team, []);
    }
    this.fighterHexes.clear();
    this.hexGrid.clearOccupied();
    this.sharedModifiers = new TeamModifiers();
    SlotManager.reset(); // Reset attack slot system
  }

  isRunning(): boolean {
    return this.running;
  }

  // Get team info for UI display
  getPlayerTeam(): Fighter[] {
    return this.teams.get('red') || [];
  }

  getOpponentTeam(): Fighter[] {
    return this.teams.get('blue') || [];
  }

  getTeam(team: Team): Fighter[] {
    return this.teams.get(team) || [];
  }

  getModifiers(): TeamModifiers {
    return this.sharedModifiers;
  }

  getPlayerGodCards(): GodCard[] {
    return this.playerGodCards;
  }

  getSelectedGodCard(): GodCard | null {
    return this.selectedGodCard;
  }

  isOnCooldown(cardId: string): boolean {
    const cooldownEnd = this.godCardCooldowns.get(cardId);
    return cooldownEnd ? Date.now() < cooldownEnd : false;
  }

  getCooldownRemaining(cardId: string): number {
    const cooldownEnd = this.godCardCooldowns.get(cardId);
    if (!cooldownEnd) return 0;
    return Math.max(0, cooldownEnd - Date.now());
  }

  selectGodCard(card: GodCard | null): void {
    if (card && this.isOnCooldown(card.id)) return;
    this.selectedGodCard = card;
    this.teleportSourceUnit = null;
  }

  private executeGodPower(card: GodCard, x: number, y: number): void {
    // Set cooldown
    this.godCardCooldowns.set(card.id, Date.now() + card.cooldown);

    // Add visual effect
    this.godPowerEffects.push({
      type: card.type,
      x,
      y,
      startTime: Date.now(),
      duration: 1000,
      radius: card.radius
    });

    // Execute the power
    switch (card.type) {
      case 'meteor_strike':
        this.executeMeteorStrike(x, y, card.radius || 60);
        break;
      case 'divine_teleport':
        this.executeTeleport(x, y);
        break;
      case 'healing_rain':
        this.executeHealingRain(x, y, card.radius || 80);
        break;
      case 'lightning_bolt':
        this.executeLightningBolt(x, y, card.radius || 80);
        break;
      case 'time_freeze':
        this.executeTimeFreeze(x, y, card.radius || 70);
        break;
      case 'shield_wall':
        this.executeShieldWall();
        SoundManager.playShield();
        break;
      case 'earthquake':
        this.executeEarthquake(x, y, card.radius || 90);
        break;
      case 'holy_smite':
        this.executeHolySmite(x, y, card.radius || 40);
        break;
    }

    SoundManager.playHit();
    this.selectedGodCard = null;
    this.teleportSourceUnit = null;
  }

  private executeMeteorStrike(x: number, y: number, radius: number): void {
    // Damage all enemies (everyone except player's team)
    for (const [team, fighters] of this.teams) {
      if (team === 'red') continue; // Skip player's team
      for (const fighter of fighters) {
        if (fighter.isDead) continue;
        const dx = fighter.x - x;
        const dy = fighter.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          const damage = 40 - (dist / radius) * 20; // 40 at center, 20 at edge
          fighter.takeDamage(damage);
          DamageNumberManager.spawn(fighter.x, fighter.y - 10, Math.round(damage), '#ef4444');
        }
      }
    }
  }

  private executeTeleport(x: number, y: number): void {
    if (this.teleportSourceUnit) {
      this.teleportSourceUnit.x = x;
      this.teleportSourceUnit.y = y;
    }
  }

  private executeHealingRain(x: number, y: number, radius: number): void {
    const playerTeam = this.teams.get('red') || [];
    for (const fighter of playerTeam) {
      if (fighter.isDead) continue;
      const dx = fighter.x - x;
      const dy = fighter.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= radius) {
        const heal = 25;
        fighter.health = Math.min(fighter.maxHealth, fighter.health + heal);
        DamageNumberManager.spawn(fighter.x, fighter.y - 10, heal, '#22d3ee');
      }
    }
  }

  private executeLightningBolt(x: number, y: number, radius: number): void {
    // Damage all enemies
    for (const [team, fighters] of this.teams) {
      if (team === 'red') continue;
      for (const fighter of fighters) {
        if (fighter.isDead) continue;
        const dx = fighter.x - x;
        const dy = fighter.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          const damage = 35;
          fighter.takeDamage(damage);
          DamageNumberManager.spawn(fighter.x, fighter.y - 10, damage, '#fbbf24');
        }
      }
    }
  }

  private executeTimeFreeze(x: number, y: number, radius: number): void {
    const freezeDuration = 3000;
    // Freeze all enemies
    for (const [team, fighters] of this.teams) {
      if (team === 'red') continue;
      for (const fighter of fighters) {
        if (fighter.isDead) continue;
        const dx = fighter.x - x;
        const dy = fighter.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          fighter.statusEffects.frozenUntil = Date.now() + freezeDuration;
        }
      }
    }
  }

  private executeShieldWall(): void {
    const playerTeam = this.teams.get('red') || [];
    for (const fighter of playerTeam) {
      if (fighter.isDead) continue;
      // Add temporary health boost
      fighter.health += 30;
      DamageNumberManager.spawn(fighter.x, fighter.y - 10, 30, '#f59e0b');
    }
  }

  private executeEarthquake(x: number, y: number, radius: number): void {
    // Damage and knockback all enemies
    for (const [team, fighters] of this.teams) {
      if (team === 'red') continue;
      for (const fighter of fighters) {
        if (fighter.isDead) continue;
        const dx = fighter.x - x;
        const dy = fighter.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= radius) {
          // Damage
          const damage = 25;
          fighter.takeDamage(damage);
          DamageNumberManager.spawn(fighter.x, fighter.y - 10, damage, '#a16207');

          // Knockback
          if (dist > 0) {
            const knockback = 50;
            fighter.x += (dx / dist) * knockback;
            fighter.y += (dy / dist) * knockback;
          }
        }
      }
    }
  }

  private executeHolySmite(x: number, y: number, radius: number): void {
    // Damage enemies
    for (const [team, fighters] of this.teams) {
      if (team === 'red') continue;
      for (const fighter of fighters) {
        if (fighter.isDead) continue;
        const dx = fighter.x - x;
        const dy = fighter.y - y;
        if (Math.sqrt(dx * dx + dy * dy) <= radius) {
          const damage = 30;
          fighter.takeDamage(damage);
          DamageNumberManager.spawn(fighter.x, fighter.y - 10, damage, '#fef08a');
        }
      }
    }
    // Heal allies
    const playerTeam = this.teams.get('red') || [];
    for (const fighter of playerTeam) {
      if (fighter.isDead) continue;
      const dx = fighter.x - x;
      const dy = fighter.y - y;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        const heal = 20;
        fighter.health = Math.min(fighter.maxHealth, fighter.health + heal);
        DamageNumberManager.spawn(fighter.x, fighter.y - 10, heal, '#22d3ee');
      }
    }
  }

  private drawGodPowerEffects(): void {
    const now = Date.now();

    this.godPowerEffects = this.godPowerEffects.filter(effect => {
      const elapsed = now - effect.startTime;
      if (elapsed >= effect.duration) return false;

      const progress = elapsed / effect.duration;
      const alpha = 1 - progress;

      this.ctx.save();

      switch (effect.type) {
        case 'meteor_strike':
          // Expanding orange/red circle
          const meteorRadius = (effect.radius || 60) * (0.5 + progress * 0.5);
          const gradient = this.ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, meteorRadius);
          gradient.addColorStop(0, `rgba(255, 100, 0, ${alpha})`);
          gradient.addColorStop(0.5, `rgba(255, 50, 0, ${alpha * 0.5})`);
          gradient.addColorStop(1, `rgba(100, 0, 0, 0)`);
          this.ctx.fillStyle = gradient;
          this.ctx.beginPath();
          this.ctx.arc(effect.x, effect.y, meteorRadius, 0, Math.PI * 2);
          this.ctx.fill();
          break;

        case 'lightning_bolt':
          // Vertical lightning bolt
          this.ctx.strokeStyle = `rgba(255, 255, 100, ${alpha})`;
          this.ctx.lineWidth = 4;
          this.ctx.beginPath();
          this.ctx.moveTo(effect.x, effect.y - 100);
          this.ctx.lineTo(effect.x - 10, effect.y - 50);
          this.ctx.lineTo(effect.x + 10, effect.y - 30);
          this.ctx.lineTo(effect.x, effect.y);
          this.ctx.stroke();
          break;

        case 'healing_rain':
          // Blue circles expanding
          this.ctx.strokeStyle = `rgba(34, 211, 238, ${alpha})`;
          this.ctx.lineWidth = 3;
          this.ctx.beginPath();
          this.ctx.arc(effect.x, effect.y, (effect.radius || 80) * progress, 0, Math.PI * 2);
          this.ctx.stroke();
          break;

        case 'time_freeze':
          // Expanding ice ring
          this.ctx.strokeStyle = `rgba(150, 200, 255, ${alpha})`;
          this.ctx.lineWidth = 5;
          this.ctx.beginPath();
          this.ctx.arc(effect.x, effect.y, (effect.radius || 70) * progress, 0, Math.PI * 2);
          this.ctx.stroke();
          break;

        case 'shield_wall':
          // Golden pulse on all allies (draw at center)
          this.ctx.strokeStyle = `rgba(245, 158, 11, ${alpha})`;
          this.ctx.lineWidth = 3;
          const playerTeamFighters = this.teams.get('red') || [];
          for (const fighter of playerTeamFighters) {
            if (fighter.isDead) continue;
            this.ctx.beginPath();
            this.ctx.arc(fighter.x, fighter.y, 20 + progress * 10, 0, Math.PI * 2);
            this.ctx.stroke();
          }
          break;

        case 'earthquake':
          // Brown shockwave
          this.ctx.strokeStyle = `rgba(161, 98, 7, ${alpha})`;
          this.ctx.lineWidth = 6;
          this.ctx.beginPath();
          this.ctx.arc(effect.x, effect.y, (effect.radius || 90) * progress, 0, Math.PI * 2);
          this.ctx.stroke();
          break;

        case 'divine_teleport':
          // Sparkle effect
          this.ctx.fillStyle = `rgba(168, 85, 247, ${alpha})`;
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2 + progress * Math.PI;
            const dist = 20 + progress * 30;
            const px = effect.x + Math.cos(angle) * dist;
            const py = effect.y + Math.sin(angle) * dist;
            this.ctx.beginPath();
            this.ctx.arc(px, py, 3, 0, Math.PI * 2);
            this.ctx.fill();
          }
          break;

        case 'holy_smite':
          // Golden beam
          const beamGradient = this.ctx.createRadialGradient(effect.x, effect.y, 0, effect.x, effect.y, effect.radius || 40);
          beamGradient.addColorStop(0, `rgba(254, 240, 138, ${alpha})`);
          beamGradient.addColorStop(1, `rgba(254, 240, 138, 0)`);
          this.ctx.fillStyle = beamGradient;
          this.ctx.beginPath();
          this.ctx.arc(effect.x, effect.y, effect.radius || 40, 0, Math.PI * 2);
          this.ctx.fill();
          break;
      }

      this.ctx.restore();
      return true;
    });
  }

  private drawGodCards(): void {
    const cardWidth = 60;
    const cardHeight = 80;
    const startX = 20;
    const startY = this.canvas.height - cardHeight - 20;

    this.ctx.font = 'bold 10px monospace';
    this.ctx.textAlign = 'center';
    this.ctx.fillStyle = '#fff';
    this.ctx.fillText('GOD POWERS', startX + (this.playerGodCards.length * (cardWidth + 10)) / 2, startY - 8);

    for (let i = 0; i < this.playerGodCards.length; i++) {
      const card = this.playerGodCards[i];
      const x = startX + i * (cardWidth + 10);
      const y = startY;
      const isSelected = this.selectedGodCard?.id === card.id;
      const onCooldown = this.isOnCooldown(card.id);

      // Card background
      this.ctx.fillStyle = onCooldown ? '#333' : '#2d2d44';
      this.ctx.strokeStyle = isSelected ? '#ffd700' : card.color;
      this.ctx.lineWidth = isSelected ? 3 : 2;
      this.ctx.beginPath();
      this.ctx.roundRect(x, y, cardWidth, cardHeight, 6);
      this.ctx.fill();
      this.ctx.stroke();

      // Icon
      this.ctx.font = '24px serif';
      this.ctx.fillStyle = onCooldown ? '#666' : '#fff';
      this.ctx.fillText(card.icon, x + cardWidth / 2, y + 35);

      // Name
      this.ctx.font = 'bold 8px monospace';
      this.ctx.fillStyle = onCooldown ? '#666' : card.color;
      this.ctx.fillText(card.name.split(' ')[0], x + cardWidth / 2, y + cardHeight - 8);

      // Cooldown overlay
      if (onCooldown) {
        const remaining = this.getCooldownRemaining(card.id);
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
        this.ctx.fillRect(x, y, cardWidth, cardHeight);
        this.ctx.font = 'bold 14px monospace';
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText(`${Math.ceil(remaining / 1000)}s`, x + cardWidth / 2, y + cardHeight / 2 + 5);
      }
    }

    // Show targeting hint
    if (this.selectedGodCard) {
      this.ctx.fillStyle = '#ffd700';
      this.ctx.font = 'bold 12px monospace';
      this.ctx.textAlign = 'center';
      let hint = 'Click to target';
      if (this.selectedGodCard.type === 'divine_teleport') {
        hint = this.teleportSourceUnit ? 'Click destination' : 'Click unit to teleport';
      } else if (this.selectedGodCard.targetType === 'none') {
        hint = 'Click anywhere to activate';
      } else if (this.selectedGodCard.targetType === 'unit') {
        hint = 'Click enemy to target';
      }
      this.ctx.fillText(hint, this.canvas.width / 2, this.canvas.height - 5);
    }
  }

  handleGodCardClick(x: number, y: number): boolean {
    if (!this.running) return false;

    const cardWidth = 60;
    const cardHeight = 80;
    const startX = 20;
    const startY = this.canvas.height - cardHeight - 20;

    for (let i = 0; i < this.playerGodCards.length; i++) {
      const card = this.playerGodCards[i];
      const cardX = startX + i * (cardWidth + 10);
      const cardY = startY;

      if (x >= cardX && x <= cardX + cardWidth && y >= cardY && y <= cardY + cardHeight) {
        if (!this.isOnCooldown(card.id)) {
          this.selectGodCard(this.selectedGodCard?.id === card.id ? null : card);
        }
        return true;
      }
    }

    return false;
  }

  // Handle clicks on the battlefield for targeting god powers
  handleBattlefieldClick(x: number, y: number): void {
    if (!this.running || !this.selectedGodCard) return;

    const card = this.selectedGodCard;

    // Handle different target types
    if (card.targetType === 'none') {
      this.executeGodPower(card, x, y);
      return;
    }

    if (card.targetType === 'unit') {
      // For teleport, we need to select a unit first, then a destination
      if (card.type === 'divine_teleport') {
        if (!this.teleportSourceUnit) {
          // Find clicked friendly unit (with larger radius for small units)
          const playerTeam = this.teams.get('red') || [];
          for (const fighter of playerTeam) {
            if (fighter.isDead) continue;
            const dx = x - fighter.x;
            const dy = y - fighter.y;
            if (Math.sqrt(dx * dx + dy * dy) < 50) {
              this.teleportSourceUnit = fighter;
              return;
            }
          }
        } else {
          // Teleport to clicked location
          this.executeGodPower(card, x, y);
          return;
        }
      }
    }

    // All point/area targeting (including lightning bolt now)
    if (card.targetType === 'point' || card.targetType === 'area') {
      this.executeGodPower(card, x, y);
    }
  }
}

import type { Team, FighterType } from './types';

export class Building {
  team: Team;
  slot: number;
  type: FighterType;
  x: number;
  y: number;
  width: number = 40;
  height: number = 35;
  cap: number = 2; // How many units this building can produce

  constructor(team: Team, slot: number, type: FighterType, canvasWidth: number, canvasHeight: number) {
    this.team = team;
    this.slot = slot;
    this.type = type;

    // Calculate position based on slot (10 slots spread across width)
    const slotWidth = canvasWidth / 10;
    this.x = slotWidth * slot + slotWidth / 2;
    this.y = team === 'blue' ? 25 : canvasHeight - 25;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const colors: Partial<Record<FighterType, string>> = {
      swordsman: '#3b82f6',
      archer: '#22c55e',
      mage: '#a855f7',
      knight: '#f59e0b',
      healer: '#22d3ee'
    };

    const icons: Partial<Record<FighterType, string>> = {
      swordsman: '⚔',
      archer: '🏹',
      mage: '✨',
      knight: '🛡',
      healer: '✚'
    };

    // Building base
    ctx.fillStyle = colors[this.type] || '#888888';
    ctx.fillRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);

    // Border
    ctx.strokeStyle = this.team === 'blue' ? '#4a90d9' : '#d94a4a';
    ctx.lineWidth = 3;
    ctx.strokeRect(this.x - this.width / 2, this.y - this.height / 2, this.width, this.height);

    // Icon
    ctx.fillStyle = '#fff';
    ctx.font = '14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(icons[this.type] || '?', this.x, this.y - 4);

    // Cap number
    ctx.font = 'bold 10px Arial';
    ctx.fillStyle = '#fff';
    ctx.fillText(`x${this.cap}`, this.x, this.y + 10);
  }
}

export interface BuildingChoice {
  type: FighterType;
  name: string;
  description: string;
  color: string;
}

export const BUILDING_TYPES: BuildingChoice[] = [
  { type: 'swordsman', name: 'Barracks', description: 'Produces Swordsmen', color: '#3b82f6' },
  { type: 'archer', name: 'Archery Range', description: 'Produces Archers', color: '#22c55e' },
  { type: 'mage', name: 'Mage Tower', description: 'Produces Mages', color: '#a855f7' },
  { type: 'knight', name: 'Knight Hall', description: 'Produces Knights', color: '#f59e0b' },
  { type: 'healer', name: 'Sanctuary', description: 'Produces Healers', color: '#22d3ee' },
];

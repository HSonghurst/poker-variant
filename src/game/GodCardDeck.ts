// God Cards - powerful abilities usable during battle

export type GodPowerType =
  | 'meteor_strike'
  | 'divine_teleport'
  | 'healing_rain'
  | 'lightning_bolt'
  | 'time_freeze'
  | 'shield_wall'
  | 'earthquake'
  | 'holy_smite';

export interface GodCard {
  id: string;
  name: string;
  type: GodPowerType;
  description: string;
  icon: string;
  color: string;
  cooldown: number; // ms before can use again
  targetType: 'point' | 'unit' | 'area' | 'none';
  radius?: number; // for area effects
}

export const GOD_CARDS: GodCard[] = [
  {
    id: 'meteor_strike',
    name: 'Meteor Strike',
    type: 'meteor_strike',
    description: 'Call down a meteor dealing massive AoE damage',
    icon: '☄️',
    color: '#ef4444',
    cooldown: 8000,
    targetType: 'point',
    radius: 150
  },
  {
    id: 'divine_teleport',
    name: 'Divine Teleport',
    type: 'divine_teleport',
    description: 'Instantly teleport a friendly unit to target location',
    icon: '✨',
    color: '#a855f7',
    cooldown: 5000,
    targetType: 'unit'
  },
  {
    id: 'healing_rain',
    name: 'Healing Rain',
    type: 'healing_rain',
    description: 'Heal all friendly units in an area over time',
    icon: '💧',
    color: '#22d3ee',
    cooldown: 10000,
    targetType: 'point',
    radius: 180
  },
  {
    id: 'lightning_bolt',
    name: 'Lightning Bolt',
    type: 'lightning_bolt',
    description: 'Strike enemy units in an area with lightning',
    icon: '⚡',
    color: '#fbbf24',
    cooldown: 4000,
    targetType: 'point',
    radius: 80
  },
  {
    id: 'time_freeze',
    name: 'Time Freeze',
    type: 'time_freeze',
    description: 'Freeze all enemy units in an area for 3 seconds',
    icon: '❄️',
    color: '#60a5fa',
    cooldown: 12000,
    targetType: 'point',
    radius: 160
  },
  {
    id: 'shield_wall',
    name: 'Shield Wall',
    type: 'shield_wall',
    description: 'Grant all friendly units a damage shield',
    icon: '🛡️',
    color: '#f59e0b',
    cooldown: 15000,
    targetType: 'none'
  },
  {
    id: 'earthquake',
    name: 'Earthquake',
    type: 'earthquake',
    description: 'Shake the ground, damaging and knocking back enemies',
    icon: '🌋',
    color: '#a16207',
    cooldown: 10000,
    targetType: 'point',
    radius: 200
  },
  {
    id: 'holy_smite',
    name: 'Holy Smite',
    type: 'holy_smite',
    description: 'Beam of light damages enemies and heals allies in a line',
    icon: '🌟',
    color: '#fef08a',
    cooldown: 7000,
    targetType: 'point',
    radius: 120
  }
];

export class GodCardDeck {
  private cards: GodCard[] = [];

  constructor() {
    this.reset();
  }

  reset(): void {
    // Create a copy of all god cards
    this.cards = [...GOD_CARDS];
    this.shuffle();
  }

  private shuffle(): void {
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal(count: number): GodCard[] {
    const dealt: GodCard[] = [];
    for (let i = 0; i < count && this.cards.length > 0; i++) {
      dealt.push(this.cards.pop()!);
    }
    return dealt;
  }

  remaining(): number {
    return this.cards.length;
  }
}

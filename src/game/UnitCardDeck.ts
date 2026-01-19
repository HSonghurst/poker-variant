import type { FighterType } from './types';

export interface UnitCard {
  id: number;
  type: FighterType;
  name: string;
  description: string;
  color: string;
}

// Unit card definitions with colors matching the existing style
const UNIT_DEFINITIONS: Record<FighterType, { name: string; description: string; color: string }> = {
  knight: {
    name: 'Knight',
    description: 'High HP, frost attacks, taunt ability',
    color: '#f59e0b' // Gold
  },
  swordsman: {
    name: 'Swordsman',
    description: 'Balanced melee, fire attacks, sweep ability',
    color: '#ef4444' // Red
  },
  archer: {
    name: 'Archer',
    description: 'Ranged attacks, poison arrows, piercing ability',
    color: '#22c55e' // Green
  },
  mage: {
    name: 'Mage',
    description: 'High damage ranged, void bolts, eruption ability',
    color: '#a855f7' // Purple
  },
  healer: {
    name: 'Healer',
    description: 'Heals allies, purify ability, support role',
    color: '#22d3ee' // Cyan
  }
};

export class UnitCardDeck {
  private cards: UnitCard[] = [];
  private dealtCards: UnitCard[] = [];

  constructor() {
    this.initializeDeck();
  }

  private initializeDeck(): void {
    const types: FighterType[] = ['knight', 'swordsman', 'archer', 'mage', 'healer'];
    let id = 1;

    // Create 2 cards of each unit type (10 total)
    for (const type of types) {
      for (let i = 0; i < 2; i++) {
        const def = UNIT_DEFINITIONS[type];
        this.cards.push({
          id: id++,
          type,
          name: def.name,
          description: def.description,
          color: def.color
        });
      }
    }
  }

  shuffle(): void {
    // Fisher-Yates shuffle
    for (let i = this.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.cards[i], this.cards[j]] = [this.cards[j], this.cards[i]];
    }
  }

  deal(count: number): UnitCard[] {
    const dealt: UnitCard[] = [];
    for (let i = 0; i < count && this.cards.length > 0; i++) {
      const card = this.cards.pop()!;
      dealt.push(card);
      this.dealtCards.push(card);
    }
    return dealt;
  }

  reset(): void {
    // Return all dealt cards back to deck
    this.cards.push(...this.dealtCards);
    this.dealtCards = [];
    this.shuffle();
  }

  getRemainingCount(): number {
    return this.cards.length;
  }

  getDealtCount(): number {
    return this.dealtCards.length;
  }
}

// Helper to get unit color for UI rendering
export function getUnitColor(type: FighterType): string {
  return UNIT_DEFINITIONS[type].color;
}

// Helper to get unit display name
export function getUnitName(type: FighterType): string {
  return UNIT_DEFINITIONS[type].name;
}

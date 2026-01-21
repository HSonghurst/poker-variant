import type { FighterType } from './types';

export interface CardEffect {
  // All multipliers compound (multiply together)
  damageMultiplier?: { type: FighterType | 'all'; value: number };
  healthMultiplier?: { type: FighterType | 'all'; value: number };
  speedMultiplier?: number;
  attackSpeedMultiplier?: number;
  rangeMultiplier?: { type: FighterType | 'all'; value: number };
  spawnWeight?: { type: FighterType; multiplier: number };

  // Class-specific status effect on-hit unlocks
  archerPoisonOnHit?: boolean;
  swordsmanFireOnHit?: boolean;
  knightFrostOnHit?: boolean;

  // Status effect DoT/duration multipliers (only work if class has on-hit unlocked)
  fireDoTMultiplier?: number;
  poisonDoTMultiplier?: number;
  frostDurationMultiplier?: number;
  voidDoTMultiplier?: number;

  // Other effects
  lifestealPercent?: number;
  splashMultiplier?: number;
  critChance?: number;
  thornsMultiplier?: number;
  regenMultiplier?: number;

  // Ability unlocks
  archerFanAbility?: boolean;
  swordsmanSweepAbility?: boolean;
  knightTauntAbility?: boolean;
  mageVoidEruptionAbility?: boolean;
  healerPurifyAbility?: boolean;

  // Healer-specific
  healPowerMultiplier?: number;
  healAoeMultiplier?: number;
}

export type CardRarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Card {
  id: number;
  name: string;
  description: string;
  effect: CardEffect;
  color: string;
  rarity: CardRarity;
  rarityColor: string;
}

// Rarity multipliers: common 1x, rare 2x, epic 3x, legendary 5x
const RARITY_MULTIPLIERS: Record<CardRarity, number> = {
  common: 1,
  rare: 2,
  epic: 3,
  legendary: 5
};

const RARITY_COLORS: Record<CardRarity, string> = {
  common: '#9ca3af',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b'
};

interface BaseCard {
  name: string;
  description: string;
  effect: CardEffect;
  color: string;
}

// Helper to scale a card effect by rarity multiplier
function scaleEffect(effect: CardEffect, multiplier: number): CardEffect {
  const scaled: CardEffect = {};

  if (effect.damageMultiplier) {
    const bonus = (effect.damageMultiplier.value - 1) * multiplier;
    scaled.damageMultiplier = { type: effect.damageMultiplier.type, value: 1 + bonus };
  }
  if (effect.healthMultiplier) {
    const bonus = effect.healthMultiplier.value - 1;
    if (bonus < 0) {
      scaled.healthMultiplier = { type: effect.healthMultiplier.type, value: 1 + bonus * multiplier };
    } else {
      scaled.healthMultiplier = { type: effect.healthMultiplier.type, value: 1 + bonus * multiplier };
    }
  }
  if (effect.speedMultiplier) {
    const bonus = (effect.speedMultiplier - 1) * multiplier;
    scaled.speedMultiplier = 1 + bonus;
  }
  if (effect.attackSpeedMultiplier) {
    const bonus = (effect.attackSpeedMultiplier - 1) * multiplier;
    scaled.attackSpeedMultiplier = 1 + bonus;
  }
  if (effect.rangeMultiplier) {
    const bonus = (effect.rangeMultiplier.value - 1) * multiplier;
    scaled.rangeMultiplier = { type: effect.rangeMultiplier.type, value: 1 + bonus };
  }

  // DoT multipliers scale
  if (effect.fireDoTMultiplier) {
    const bonus = (effect.fireDoTMultiplier - 1) * multiplier;
    scaled.fireDoTMultiplier = 1 + bonus;
  }
  if (effect.poisonDoTMultiplier) {
    const bonus = (effect.poisonDoTMultiplier - 1) * multiplier;
    scaled.poisonDoTMultiplier = 1 + bonus;
  }
  if (effect.frostDurationMultiplier) {
    const bonus = (effect.frostDurationMultiplier - 1) * multiplier;
    scaled.frostDurationMultiplier = 1 + bonus;
  }
  if (effect.voidDoTMultiplier) {
    const bonus = (effect.voidDoTMultiplier - 1) * multiplier;
    scaled.voidDoTMultiplier = 1 + bonus;
  }

  if (effect.lifestealPercent) {
    const bonus = (effect.lifestealPercent - 1) * multiplier;
    scaled.lifestealPercent = 1 + bonus;
  }
  if (effect.splashMultiplier) {
    const bonus = (effect.splashMultiplier - 1) * multiplier;
    scaled.splashMultiplier = 1 + bonus;
  }
  if (effect.critChance) {
    const bonus = (effect.critChance - 1) * multiplier;
    scaled.critChance = 1 + bonus;
  }
  if (effect.thornsMultiplier) {
    const bonus = (effect.thornsMultiplier - 1) * multiplier;
    scaled.thornsMultiplier = 1 + bonus;
  }
  if (effect.regenMultiplier) {
    const bonus = (effect.regenMultiplier - 1) * multiplier;
    scaled.regenMultiplier = 1 + bonus;
  }
  if (effect.healPowerMultiplier) {
    const bonus = (effect.healPowerMultiplier - 1) * multiplier;
    scaled.healPowerMultiplier = 1 + bonus;
  }
  if (effect.healAoeMultiplier) {
    const bonus = (effect.healAoeMultiplier - 1) * multiplier;
    scaled.healAoeMultiplier = 1 + bonus;
  }

  // Abilities and on-hit unlocks don't scale - they're boolean
  if (effect.archerPoisonOnHit) scaled.archerPoisonOnHit = true;
  if (effect.swordsmanFireOnHit) scaled.swordsmanFireOnHit = true;
  if (effect.knightFrostOnHit) scaled.knightFrostOnHit = true;
  if (effect.archerFanAbility) scaled.archerFanAbility = true;
  if (effect.swordsmanSweepAbility) scaled.swordsmanSweepAbility = true;
  if (effect.knightTauntAbility) scaled.knightTauntAbility = true;
  if (effect.mageVoidEruptionAbility) scaled.mageVoidEruptionAbility = true;
  if (effect.healerPurifyAbility) scaled.healerPurifyAbility = true;

  return scaled;
}

// Helper to generate description with scaled values
function scaleDescription(desc: string, multiplier: number): string {
  return desc.replace(/([+-]?\d+)%/g, (_, num) => {
    const scaled = Math.round(parseInt(num) * multiplier);
    return `${scaled >= 0 ? '+' : ''}${scaled}%`;
  });
}

// Generate all rarity variants from base cards
function generateCards(baseCards: BaseCard[]): Card[] {
  const cards: Card[] = [];
  let id = 1;
  const rarities: CardRarity[] = ['common', 'rare', 'epic', 'legendary'];

  for (const base of baseCards) {
    for (const rarity of rarities) {
      const multiplier = RARITY_MULTIPLIERS[rarity];
      const rarityPrefix = rarity === 'common' ? '' : `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} `;

      cards.push({
        id: id++,
        name: `${rarityPrefix}${base.name}`,
        description: scaleDescription(base.description, multiplier),
        effect: scaleEffect(base.effect, multiplier),
        color: base.color,
        rarity,
        rarityColor: RARITY_COLORS[rarity]
      });
    }
  }

  return cards;
}

// Base card definitions (common values - will be scaled by rarity)
const BASE_CARDS: BaseCard[] = [
  // Damage multipliers
  { name: "Sharp Arrows", description: "+5% Archer damage", effect: { damageMultiplier: { type: 'archer', value: 1.05 } }, color: '#ef4444' },
  { name: "Honed Blades", description: "+5% Swordsman damage", effect: { damageMultiplier: { type: 'swordsman', value: 1.05 } }, color: '#ef4444' },
  { name: "Void Staff", description: "+5% Mage damage", effect: { damageMultiplier: { type: 'mage', value: 1.05 } }, color: '#7c3aed' },
  { name: "Heavy Strikes", description: "+5% Knight damage", effect: { damageMultiplier: { type: 'knight', value: 1.05 } }, color: '#ef4444' },
  { name: "War Fury", description: "+4% all damage", effect: { damageMultiplier: { type: 'all', value: 1.04 } }, color: '#ef4444' },

  // Health multipliers
  { name: "Thick Armor", description: "+6% Swordsman health", effect: { healthMultiplier: { type: 'swordsman', value: 1.06 } }, color: '#22c55e' },
  { name: "Fortress Shield", description: "+8% Knight health", effect: { healthMultiplier: { type: 'knight', value: 1.08 } }, color: '#22c55e' },
  { name: "Arcane Barrier", description: "+6% Mage health", effect: { healthMultiplier: { type: 'mage', value: 1.06 } }, color: '#22c55e' },
  { name: "Fortitude", description: "+4% all health", effect: { healthMultiplier: { type: 'all', value: 1.04 } }, color: '#22c55e' },
  { name: "Ranger Endurance", description: "+6% Archer health", effect: { healthMultiplier: { type: 'archer', value: 1.06 } }, color: '#22c55e' },

  // Speed multipliers
  { name: "Swift Feet", description: "+6% movement speed", effect: { speedMultiplier: 1.06 }, color: '#3b82f6' },
  { name: "Battle Frenzy", description: "+5% attack speed", effect: { attackSpeedMultiplier: 1.05 }, color: '#3b82f6' },

  // Range multipliers
  { name: "Eagle Eye", description: "+8% Archer range", effect: { rangeMultiplier: { type: 'archer', value: 1.08 } }, color: '#a855f7' },
  { name: "Far Sight", description: "+8% Mage range", effect: { rangeMultiplier: { type: 'mage', value: 1.08 } }, color: '#a855f7' },

  // Class-specific on-hit status effect unlocks
  { name: "Poison Arrows", description: "Archer attacks apply poison", effect: { archerPoisonOnHit: true }, color: '#84cc16' },
  { name: "Flaming Blades", description: "Swordsman attacks ignite enemies", effect: { swordsmanFireOnHit: true }, color: '#f59e0b' },
  { name: "Frozen Edge", description: "Knight attacks freeze enemies", effect: { knightFrostOnHit: true }, color: '#06b6d4' },

  // Status effect DoT/duration multipliers
  { name: "Searing Flames", description: "+10% fire damage over time", effect: { fireDoTMultiplier: 1.10 }, color: '#f59e0b' },
  { name: "Toxic Venom", description: "+10% poison damage over time", effect: { poisonDoTMultiplier: 1.10 }, color: '#84cc16' },
  { name: "Deep Freeze", description: "+10% frost duration", effect: { frostDurationMultiplier: 1.10 }, color: '#06b6d4' },
  { name: "Void Corruption", description: "+10% void damage over time", effect: { voidDoTMultiplier: 1.10 }, color: '#7c3aed' },

  // Other effects
  { name: "Vampiric Strike", description: "+5% lifesteal", effect: { lifestealPercent: 1.05 }, color: '#dc2626' },
  { name: "Shattering Blow", description: "+4% splash damage", effect: { splashMultiplier: 1.04 }, color: '#ec4899' },
  { name: "Critical Mastery", description: "+4% crit chance", effect: { critChance: 1.04 }, color: '#fbbf24' },
  { name: "Thorns Aura", description: "+4% thorns damage", effect: { thornsMultiplier: 1.04 }, color: '#10b981' },
  { name: "Regeneration", description: "+5% regen rate", effect: { regenMultiplier: 1.05 }, color: '#14b8a6' },

  // Healer cards
  { name: "Blessed Hands", description: "+8% Healer healing power", effect: { healPowerMultiplier: 1.08 }, color: '#22d3ee' },
  { name: "Circle of Light", description: "+15% Healer AoE radius", effect: { healAoeMultiplier: 1.15 }, color: '#22d3ee' },
  { name: "Healer's Reach", description: "+10% Healer range", effect: { rangeMultiplier: { type: 'healer', value: 1.10 } }, color: '#22d3ee' },

  // Ability cards
  { name: "Piercing Shot", description: "Every 5th arrow pierces through all enemies (50% damage after first)", effect: { archerFanAbility: true }, color: '#22c55e' },
  { name: "Whirlwind Slash", description: "Swordsmen sweep all nearby enemies every 3 attacks", effect: { swordsmanSweepAbility: true }, color: '#3b82f6' },
  { name: "Guardian's Call", description: "Knights taunt enemies and become invulnerable (6s cooldown)", effect: { knightTauntAbility: true }, color: '#f59e0b' },
  { name: "Void Eruption", description: "Mages cause chain-reaction void blasts every 10 attacks", effect: { mageVoidEruptionAbility: true }, color: '#7c3aed' },
  { name: "Purifying Light", description: "Healers cleanse debuffs and burst heal all nearby allies (8s cooldown)", effect: { healerPurifyAbility: true }, color: '#22d3ee' },
];

// Generate all card variants
export const ALL_CARDS: Card[] = generateCards(BASE_CARDS);

// Base rarity weights for card selection (level 1)
export const BASE_RARITY_WEIGHTS: Record<CardRarity, number> = {
  common: 55,
  rare: 28,
  epic: 13,
  legendary: 4
};

// Helper to pick a random rarity based on weights, scaling with level
// Higher levels shift weights towards rarer cards
export function pickRandomRarity(level: number = 1): CardRarity {
  // Calculate level bonus (increases rarer card chances)
  // At level 1: no bonus, at level 20: significant bonus
  const levelFactor = Math.min((level - 1) / 15, 1); // 0 to 1 over 15 levels

  // Shift weights: reduce common, increase rare/epic/legendary
  const weights: Record<CardRarity, number> = {
    common: Math.max(20, BASE_RARITY_WEIGHTS.common - levelFactor * 35),      // 55 -> 20
    rare: BASE_RARITY_WEIGHTS.rare + levelFactor * 12,                         // 28 -> 40
    epic: BASE_RARITY_WEIGHTS.epic + levelFactor * 15,                         // 13 -> 28
    legendary: BASE_RARITY_WEIGHTS.legendary + levelFactor * 8                 // 4 -> 12
  };

  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let roll = Math.random() * total;

  for (const [rarity, weight] of Object.entries(weights) as [CardRarity, number][]) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return 'common';
}

export class TeamModifiers {
  // All multipliers start at 1.0 and compound
  damageMultiplier: Map<FighterType | 'all', number> = new Map();
  healthMultiplier: Map<FighterType | 'all', number> = new Map();
  rangeMultiplier: Map<FighterType | 'all', number> = new Map();
  spawnWeights: Map<FighterType, number> = new Map();
  speedMultiplier: number = 1;
  attackSpeedMultiplier: number = 1;

  // Class-specific on-hit unlocks
  archerPoisonOnHit: boolean = false;
  swordsmanFireOnHit: boolean = false;
  knightFrostOnHit: boolean = false;

  // Status effect DoT/duration multipliers
  fireDoTMultiplier: number = 1;
  poisonDoTMultiplier: number = 1;
  frostDurationMultiplier: number = 1;
  voidDoTMultiplier: number = 1;

  // Other multipliers
  lifestealPercent: number = 1;
  splashMultiplier: number = 1;
  critChance: number = 1;
  thornsMultiplier: number = 1;
  regenMultiplier: number = 1;

  // Ability unlocks
  archerFanAbility: boolean = false;
  swordsmanSweepAbility: boolean = false;
  knightTauntAbility: boolean = false;
  mageVoidEruptionAbility: boolean = false;
  healerPurifyAbility: boolean = false;

  // Healer-specific
  healPowerMultiplier: number = 1;
  healAoeMultiplier: number = 1;

  applyCard(card: Card): void {
    const e = card.effect;

    // All effects compound (multiply)
    if (e.damageMultiplier) {
      const current = this.damageMultiplier.get(e.damageMultiplier.type) || 1;
      this.damageMultiplier.set(e.damageMultiplier.type, current * e.damageMultiplier.value);
    }
    if (e.healthMultiplier) {
      const current = this.healthMultiplier.get(e.healthMultiplier.type) || 1;
      this.healthMultiplier.set(e.healthMultiplier.type, current * e.healthMultiplier.value);
    }
    if (e.rangeMultiplier) {
      const current = this.rangeMultiplier.get(e.rangeMultiplier.type) || 1;
      this.rangeMultiplier.set(e.rangeMultiplier.type, current * e.rangeMultiplier.value);
    }
    if (e.spawnWeight) {
      const current = this.spawnWeights.get(e.spawnWeight.type) || 1;
      this.spawnWeights.set(e.spawnWeight.type, current * e.spawnWeight.multiplier);
    }
    if (e.speedMultiplier) this.speedMultiplier *= e.speedMultiplier;
    if (e.attackSpeedMultiplier) this.attackSpeedMultiplier *= e.attackSpeedMultiplier;

    // On-hit unlocks
    if (e.archerPoisonOnHit) this.archerPoisonOnHit = true;
    if (e.swordsmanFireOnHit) this.swordsmanFireOnHit = true;
    if (e.knightFrostOnHit) this.knightFrostOnHit = true;

    // DoT/duration multipliers
    if (e.fireDoTMultiplier) this.fireDoTMultiplier *= e.fireDoTMultiplier;
    if (e.poisonDoTMultiplier) this.poisonDoTMultiplier *= e.poisonDoTMultiplier;
    if (e.frostDurationMultiplier) this.frostDurationMultiplier *= e.frostDurationMultiplier;
    if (e.voidDoTMultiplier) this.voidDoTMultiplier *= e.voidDoTMultiplier;

    // Other multipliers
    if (e.lifestealPercent) this.lifestealPercent *= e.lifestealPercent;
    if (e.splashMultiplier) this.splashMultiplier *= e.splashMultiplier;
    if (e.critChance) this.critChance *= e.critChance;
    if (e.thornsMultiplier) this.thornsMultiplier *= e.thornsMultiplier;
    if (e.regenMultiplier) this.regenMultiplier *= e.regenMultiplier;

    // Ability unlocks
    if (e.archerFanAbility) this.archerFanAbility = true;
    if (e.swordsmanSweepAbility) this.swordsmanSweepAbility = true;
    if (e.knightTauntAbility) this.knightTauntAbility = true;
    if (e.mageVoidEruptionAbility) this.mageVoidEruptionAbility = true;
    if (e.healerPurifyAbility) this.healerPurifyAbility = true;

    // Healer-specific
    if (e.healPowerMultiplier) this.healPowerMultiplier *= e.healPowerMultiplier;
    if (e.healAoeMultiplier) this.healAoeMultiplier *= e.healAoeMultiplier;
  }

  getDamageMultiplier(type: FighterType): number {
    return (this.damageMultiplier.get(type) || 1) * (this.damageMultiplier.get('all') || 1);
  }

  getHealthMultiplier(type: FighterType): number {
    return (this.healthMultiplier.get(type) || 1) * (this.healthMultiplier.get('all') || 1);
  }

  getRangeMultiplier(type: FighterType): number {
    return (this.rangeMultiplier.get(type) || 1) * (this.rangeMultiplier.get('all') || 1);
  }

  getSpawnWeight(type: FighterType): number {
    return this.spawnWeights.get(type) || 1;
  }

  /**
   * Combine this modifier set with another, returning a new combined set.
   * All multipliers are multiplied together.
   */
  combine(other: TeamModifiers): TeamModifiers {
    const combined = new TeamModifiers();

    // Combine damage multipliers
    const allDamageTypes = new Set([...this.damageMultiplier.keys(), ...other.damageMultiplier.keys()]);
    for (const type of allDamageTypes) {
      combined.damageMultiplier.set(type, (this.damageMultiplier.get(type) || 1) * (other.damageMultiplier.get(type) || 1));
    }

    // Combine health multipliers
    const allHealthTypes = new Set([...this.healthMultiplier.keys(), ...other.healthMultiplier.keys()]);
    for (const type of allHealthTypes) {
      combined.healthMultiplier.set(type, (this.healthMultiplier.get(type) || 1) * (other.healthMultiplier.get(type) || 1));
    }

    // Combine range multipliers
    const allRangeTypes = new Set([...this.rangeMultiplier.keys(), ...other.rangeMultiplier.keys()]);
    for (const type of allRangeTypes) {
      combined.rangeMultiplier.set(type, (this.rangeMultiplier.get(type) || 1) * (other.rangeMultiplier.get(type) || 1));
    }

    // Combine spawn weights
    const allSpawnTypes = new Set([...this.spawnWeights.keys(), ...other.spawnWeights.keys()]);
    for (const type of allSpawnTypes) {
      combined.spawnWeights.set(type, (this.spawnWeights.get(type) || 1) * (other.spawnWeights.get(type) || 1));
    }

    // Combine scalar multipliers
    combined.speedMultiplier = this.speedMultiplier * other.speedMultiplier;
    combined.attackSpeedMultiplier = this.attackSpeedMultiplier * other.attackSpeedMultiplier;
    combined.fireDoTMultiplier = this.fireDoTMultiplier * other.fireDoTMultiplier;
    combined.poisonDoTMultiplier = this.poisonDoTMultiplier * other.poisonDoTMultiplier;
    combined.frostDurationMultiplier = this.frostDurationMultiplier * other.frostDurationMultiplier;
    combined.voidDoTMultiplier = this.voidDoTMultiplier * other.voidDoTMultiplier;
    combined.lifestealPercent = this.lifestealPercent * other.lifestealPercent;
    combined.splashMultiplier = this.splashMultiplier * other.splashMultiplier;
    combined.critChance = this.critChance * other.critChance;
    combined.thornsMultiplier = this.thornsMultiplier * other.thornsMultiplier;
    combined.regenMultiplier = this.regenMultiplier * other.regenMultiplier;
    combined.healPowerMultiplier = this.healPowerMultiplier * other.healPowerMultiplier;
    combined.healAoeMultiplier = this.healAoeMultiplier * other.healAoeMultiplier;

    // Combine boolean unlocks (OR)
    combined.archerPoisonOnHit = this.archerPoisonOnHit || other.archerPoisonOnHit;
    combined.swordsmanFireOnHit = this.swordsmanFireOnHit || other.swordsmanFireOnHit;
    combined.knightFrostOnHit = this.knightFrostOnHit || other.knightFrostOnHit;
    combined.archerFanAbility = this.archerFanAbility || other.archerFanAbility;
    combined.swordsmanSweepAbility = this.swordsmanSweepAbility || other.swordsmanSweepAbility;
    combined.knightTauntAbility = this.knightTauntAbility || other.knightTauntAbility;
    combined.mageVoidEruptionAbility = this.mageVoidEruptionAbility || other.mageVoidEruptionAbility;
    combined.healerPurifyAbility = this.healerPurifyAbility || other.healerPurifyAbility;

    return combined;
  }
}

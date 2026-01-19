import type { PlayerAction, FighterType } from './types';
import type { Card } from './Card';
import type { UnitCard } from './UnitCardDeck';
import type { PokerGameState } from './PokerGame';

// Unit synergy bonuses for hand evaluation
const UNIT_BASE_STRENGTH: Record<FighterType, number> = {
  knight: 4,    // High HP, tanky
  swordsman: 3, // Balanced
  archer: 3,    // Good damage
  mage: 3,      // High damage but squishy
  healer: 2     // Support, weaker alone
};

// Synergy combinations that are stronger together
const SYNERGIES: Array<{ units: [FighterType, FighterType]; bonus: number; reason: string }> = [
  { units: ['knight', 'healer'], bonus: 4, reason: 'Tank + Support' },
  { units: ['knight', 'archer'], bonus: 3, reason: 'Tank + DPS' },
  { units: ['knight', 'mage'], bonus: 3, reason: 'Tank + DPS' },
  { units: ['swordsman', 'healer'], bonus: 2, reason: 'Melee + Support' },
  { units: ['archer', 'mage'], bonus: 2, reason: 'Double ranged' },
  { units: ['swordsman', 'swordsman'], bonus: 1, reason: 'Double melee pressure' },
  { units: ['knight', 'knight'], bonus: 3, reason: 'Double tank' },
  { units: ['healer', 'healer'], bonus: -2, reason: 'Low damage' },
];

export class AIOpponent {
  private aggression: number; // 0.0 to 1.0, higher = more aggressive betting

  constructor(aggression: number = 0.5) {
    this.aggression = Math.max(0, Math.min(1, aggression));
  }

  /**
   * Evaluate the strength of a hand (unit cards + community modifiers)
   * Returns a score from 0 to 20
   */
  evaluateHand(holeCards: UnitCard[], communityCards: Card[]): number {
    let score = 0;

    // Base unit strength
    for (const card of holeCards) {
      score += UNIT_BASE_STRENGTH[card.type];
    }

    // Check for synergies
    if (holeCards.length === 2) {
      const types: [FighterType, FighterType] = [holeCards[0].type, holeCards[1].type];
      for (const synergy of SYNERGIES) {
        if ((types[0] === synergy.units[0] && types[1] === synergy.units[1]) ||
            (types[0] === synergy.units[1] && types[1] === synergy.units[0])) {
          score += synergy.bonus;
          break;
        }
      }
    }

    // Evaluate modifier cards for synergy with our units
    for (const card of communityCards) {
      score += this.evaluateModifierForUnits(card, holeCards);
    }

    // Normalize to 0-20 range
    return Math.max(0, Math.min(20, score));
  }

  private evaluateModifierForUnits(card: Card, units: UnitCard[]): number {
    let bonus = 0;
    const effect = card.effect;

    for (const unit of units) {
      // Check for type-specific bonuses
      if (effect.damageMultiplier) {
        if (effect.damageMultiplier.type === unit.type || effect.damageMultiplier.type === 'all') {
          bonus += 0.5;
        }
      }
      if (effect.healthMultiplier) {
        if (effect.healthMultiplier.type === unit.type || effect.healthMultiplier.type === 'all') {
          bonus += 0.5;
        }
      }
      if (effect.rangeMultiplier) {
        if (effect.rangeMultiplier.type === unit.type || effect.rangeMultiplier.type === 'all') {
          bonus += 0.3;
        }
      }

      // Special ability unlocks are very valuable
      if (unit.type === 'archer' && effect.archerPoisonOnHit) bonus += 1;
      if (unit.type === 'archer' && effect.archerFanAbility) bonus += 1.5;
      if (unit.type === 'swordsman' && effect.swordsmanFireOnHit) bonus += 1;
      if (unit.type === 'swordsman' && effect.swordsmanSweepAbility) bonus += 1.5;
      if (unit.type === 'knight' && effect.knightFrostOnHit) bonus += 1;
      if (unit.type === 'knight' && effect.knightTauntAbility) bonus += 1.5;
      if (unit.type === 'mage' && effect.mageVoidEruptionAbility) bonus += 1.5;
      if (unit.type === 'healer' && effect.healerPurifyAbility) bonus += 1.5;
      if (unit.type === 'healer' && effect.healPowerMultiplier) bonus += 0.8;
    }

    // Universal bonuses
    if (effect.speedMultiplier && effect.speedMultiplier > 1) bonus += 0.3;
    if (effect.attackSpeedMultiplier && effect.attackSpeedMultiplier > 1) bonus += 0.4;
    if (effect.lifestealPercent && effect.lifestealPercent > 1) bonus += 0.6;
    if (effect.critChance && effect.critChance > 1) bonus += 0.4;

    return bonus;
  }

  /**
   * Decide what action to take based on game state
   */
  decideAction(state: PokerGameState): { action: PlayerAction; raiseAmount?: number } {
    const handStrength = this.evaluateHand(state.opponent.holeCards, state.communityCards);
    const normalizedStrength = handStrength / 20; // 0 to 1

    const potOdds = this.calculatePotOdds(state);
    const position = state.dealerPosition === 'opponent' ? 'dealer' : 'out_of_position';

    // Adjust thresholds based on aggression
    const foldThreshold = 0.25 - (this.aggression * 0.1);
    const raiseThreshold = 0.6 - (this.aggression * 0.15);

    // Calculate effective strength considering pot odds and position
    let effectiveStrength = normalizedStrength;
    if (position === 'dealer') {
      effectiveStrength += 0.05; // Position advantage
    }

    // Add some randomness for unpredictability
    effectiveStrength += (Math.random() - 0.5) * 0.1;

    // Decision logic
    const callAmount = state.currentBet - state.opponent.currentBet;
    const canCheck = callAmount === 0;

    // Fold weak hands when facing a bet
    if (!canCheck && effectiveStrength < foldThreshold && potOdds > 0.3) {
      return { action: 'fold' };
    }

    // Check if we can
    if (canCheck && effectiveStrength < raiseThreshold) {
      return { action: 'check' };
    }

    // Strong hands - raise
    if (effectiveStrength >= raiseThreshold && state.opponent.chips > callAmount) {
      const raiseSize = this.calculateRaiseSize(state, effectiveStrength);
      if (raiseSize > 0) {
        return { action: 'raise', raiseAmount: raiseSize };
      }
    }

    // Medium hands - call
    if (!canCheck && effectiveStrength >= foldThreshold) {
      // Check if we should just call or if we're pot committed
      if (callAmount >= state.opponent.chips * 0.5) {
        return { action: 'all_in' };
      }
      return { action: 'call' };
    }

    // Default to check if possible, otherwise fold
    return canCheck ? { action: 'check' } : { action: 'fold' };
  }

  private calculatePotOdds(state: PokerGameState): number {
    const callAmount = state.currentBet - state.opponent.currentBet;
    if (callAmount === 0) return 0;
    return callAmount / (state.pot + callAmount);
  }

  private calculateRaiseSize(state: PokerGameState, strength: number): number {
    const minRaise = state.bigBlind;
    const maxRaise = state.opponent.chips - (state.currentBet - state.opponent.currentBet);

    if (maxRaise < minRaise) return 0;

    // Scale raise size with hand strength and aggression
    const baseRatio = 0.3 + (strength * 0.4) + (this.aggression * 0.2);
    let raiseSize = Math.floor(state.pot * baseRatio);

    // Add some variance
    raiseSize = Math.floor(raiseSize * (0.8 + Math.random() * 0.4));

    // Clamp to valid range
    raiseSize = Math.max(minRaise, Math.min(maxRaise, raiseSize));

    // Round to nice numbers
    raiseSize = Math.round(raiseSize / 10) * 10;

    return Math.max(minRaise, raiseSize);
  }

  /**
   * Bluff occasionally with weak hands
   */
  shouldBluff(state: PokerGameState): boolean {
    // Only bluff sometimes based on aggression
    if (Math.random() > this.aggression * 0.3) return false;

    // More likely to bluff in position
    if (state.dealerPosition !== 'opponent') return false;

    // More likely to bluff with fewer community cards (more uncertainty)
    const bluffChance = 0.1 + (0.1 * (5 - state.communityCards.length));
    return Math.random() < bluffChance;
  }
}

export type Team = 'top' | 'bottom';
export type FighterType = 'swordsman' | 'archer' | 'mage' | 'knight' | 'healer';

export interface Position {
  x: number;
  y: number;
}

export interface FighterConfig {
  team: Team;
  x: number;
}

// Poker types
export type BettingRound = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'positioning' | 'battle' | 'hand_complete';
export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all_in';
export type PlayerPosition = 'player' | 'opponent';

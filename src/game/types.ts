// 6 teams positioned around a hexagon
export type Team = 'blue' | 'purple' | 'pink' | 'red' | 'orange' | 'green';
export type FighterType = 'swordsman' | 'archer' | 'mage' | 'knight' | 'healer';

// Team colors for rendering
export const TEAM_COLORS: Record<Team, string> = {
  blue: '#2563eb',
  purple: '#7c3aed',
  pink: '#db2777',
  red: '#dc2626',
  orange: '#ea580c',
  green: '#16a34a'
};

export interface Position {
  x: number;
  y: number;
}

export interface FighterConfig {
  team: Team;
  x: number;
}

// Poker types - new flow: draw -> table_reveal -> bidding -> bid_reveal -> battle -> choose
export type GamePhase = 'draw' | 'table_reveal' | 'bidding' | 'bid_reveal' | 'battle' | 'choose';
// Keep old type for backwards compatibility during refactor
export type BettingRound = 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'positioning' | 'battle' | 'hand_complete' | GamePhase;
export type PlayerAction = 'fold' | 'check' | 'call' | 'raise' | 'all_in';
export type PlayerPosition = 'player' | 'opponent' | 'topRight' | 'bottomRight' | 'bottomLeft' | 'topLeft';

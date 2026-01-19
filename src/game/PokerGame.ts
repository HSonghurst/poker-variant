import type { BettingRound, PlayerAction, PlayerPosition } from './types';
import type { Card } from './Card';
import { ALL_CARDS } from './Card';
import { UnitCardDeck, type UnitCard } from './UnitCardDeck';

export interface Player {
  position: PlayerPosition;
  chips: number;
  currentBet: number;
  holeCards: UnitCard[];
  hasFolded: boolean;
  isAllIn: boolean;
  hasActedThisRound: boolean;
}

export interface PokerGameState {
  round: BettingRound;
  pot: number;
  currentBet: number;
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
  player: Player;
  opponent: Player;
  dealerPosition: PlayerPosition;
  activePlayer: PlayerPosition;
  communityCards: Card[];
  lastAction: { player: PlayerPosition; action: PlayerAction; amount?: number } | null;
  battleResult: PlayerPosition | 'tie' | null;
  gameOver: boolean;
  winner: PlayerPosition | null;
}

export type StateChangeCallback = (state: PokerGameState) => void;

export class PokerGame {
  private state: PokerGameState;
  private unitDeck: UnitCardDeck;
  private modifierDeck: Card[];
  private onStateChange: StateChangeCallback;

  constructor(startingChips: number, onStateChange: StateChangeCallback) {
    this.onStateChange = onStateChange;
    this.unitDeck = new UnitCardDeck();
    this.modifierDeck = [];

    this.state = {
      round: 'preflop',
      pot: 0,
      currentBet: 0,
      smallBlind: 10,
      bigBlind: 20,
      handNumber: 0,
      player: {
        position: 'player',
        chips: startingChips,
        currentBet: 0,
        holeCards: [],
        hasFolded: false,
        isAllIn: false,
        hasActedThisRound: false
      },
      opponent: {
        position: 'opponent',
        chips: startingChips,
        currentBet: 0,
        holeCards: [],
        hasFolded: false,
        isAllIn: false,
        hasActedThisRound: false
      },
      dealerPosition: 'player',
      activePlayer: 'opponent', // Will be set properly in startNewHand
      communityCards: [],
      lastAction: null,
      battleResult: null,
      gameOver: false,
      winner: null
    };
  }

  getState(): PokerGameState {
    return { ...this.state };
  }

  private notify(): void {
    this.onStateChange(this.getState());
  }

  private shuffleModifierDeck(): void {
    this.modifierDeck = [...ALL_CARDS];
    // Fisher-Yates shuffle
    for (let i = this.modifierDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [this.modifierDeck[i], this.modifierDeck[j]] = [this.modifierDeck[j], this.modifierDeck[i]];
    }
  }

  private dealModifierCard(): Card {
    return this.modifierDeck.pop()!;
  }

  startNewHand(): void {
    // Reset for new hand
    this.state.handNumber++;
    this.state.round = 'preflop';
    this.state.pot = 0;
    this.state.currentBet = 0;
    this.state.communityCards = [];
    this.state.battleResult = null;
    this.state.lastAction = null;

    // Reset players
    this.state.player.holeCards = [];
    this.state.player.currentBet = 0;
    this.state.player.hasFolded = false;
    this.state.player.isAllIn = false;
    this.state.player.hasActedThisRound = false;

    this.state.opponent.holeCards = [];
    this.state.opponent.currentBet = 0;
    this.state.opponent.hasFolded = false;
    this.state.opponent.isAllIn = false;
    this.state.opponent.hasActedThisRound = false;

    // Alternate dealer
    this.state.dealerPosition = this.state.dealerPosition === 'player' ? 'opponent' : 'player';

    // Escalate blinds every 5 hands
    if (this.state.handNumber > 1 && (this.state.handNumber - 1) % 5 === 0) {
      this.state.smallBlind = Math.min(this.state.smallBlind + 10, 100);
      this.state.bigBlind = this.state.smallBlind * 2;
    }

    // Shuffle decks
    this.unitDeck.reset();
    this.shuffleModifierDeck();

    // Deal hole cards (unit cards)
    this.state.player.holeCards = this.unitDeck.deal(2);
    this.state.opponent.holeCards = this.unitDeck.deal(2);

    // Post blinds - in heads up, dealer posts small blind, other posts big blind
    const sbPlayer = this.state.dealerPosition === 'player' ? this.state.player : this.state.opponent;
    const bbPlayer = this.state.dealerPosition === 'player' ? this.state.opponent : this.state.player;

    this.postBlind(sbPlayer, this.state.smallBlind);
    this.postBlind(bbPlayer, this.state.bigBlind);

    this.state.currentBet = this.state.bigBlind;

    // In heads up preflop, dealer (SB) acts first
    this.state.activePlayer = this.state.dealerPosition;

    this.notify();
  }

  private postBlind(player: Player, amount: number): void {
    const actualAmount = Math.min(amount, player.chips);
    player.chips -= actualAmount;
    player.currentBet = actualAmount;
    this.state.pot += actualAmount;
    if (player.chips === 0) {
      player.isAllIn = true;
    }
  }

  private getActivePlayerObj(): Player {
    return this.state.activePlayer === 'player' ? this.state.player : this.state.opponent;
  }

  private switchActivePlayer(): void {
    this.state.activePlayer = this.state.activePlayer === 'player' ? 'opponent' : 'player';
  }

  canCheck(): boolean {
    const player = this.getActivePlayerObj();
    return player.currentBet === this.state.currentBet && !player.hasFolded && !player.isAllIn;
  }

  canCall(): boolean {
    const player = this.getActivePlayerObj();
    return player.currentBet < this.state.currentBet && !player.hasFolded && !player.isAllIn;
  }

  getCallAmount(): number {
    const player = this.getActivePlayerObj();
    return Math.min(this.state.currentBet - player.currentBet, player.chips);
  }

  canRaise(): boolean {
    const player = this.getActivePlayerObj();
    return !player.hasFolded && !player.isAllIn && player.chips > this.getCallAmount();
  }

  getMinRaise(): number {
    return this.state.bigBlind;
  }

  getMaxRaise(): number {
    const player = this.getActivePlayerObj();
    return player.chips - this.getCallAmount();
  }

  fold(): void {
    const player = this.getActivePlayerObj();
    player.hasFolded = true;
    this.state.lastAction = { player: this.state.activePlayer, action: 'fold' };

    // Award pot to other player
    const winner = this.state.activePlayer === 'player' ? this.state.opponent : this.state.player;
    winner.chips += this.state.pot;
    this.state.pot = 0;

    this.state.round = 'hand_complete';
    this.checkGameOver();
    this.notify();
  }

  check(): void {
    if (!this.canCheck()) return;

    const player = this.getActivePlayerObj();
    player.hasActedThisRound = true;
    this.state.lastAction = { player: this.state.activePlayer, action: 'check' };
    this.advanceAction();
  }

  call(): void {
    if (!this.canCall()) return;

    const player = this.getActivePlayerObj();
    const callAmount = this.getCallAmount();

    player.chips -= callAmount;
    player.currentBet += callAmount;
    this.state.pot += callAmount;
    player.hasActedThisRound = true;

    if (player.chips === 0) {
      player.isAllIn = true;
    }

    this.state.lastAction = { player: this.state.activePlayer, action: 'call', amount: callAmount };
    this.advanceAction();
  }

  raise(amount: number): void {
    if (!this.canRaise()) return;

    const player = this.getActivePlayerObj();
    const opponent = this.state.activePlayer === 'player' ? this.state.opponent : this.state.player;
    const callAmount = this.getCallAmount();
    const totalBet = callAmount + amount;

    if (amount < this.getMinRaise() || amount > this.getMaxRaise()) return;

    player.chips -= totalBet;
    player.currentBet += totalBet;
    this.state.pot += totalBet;
    this.state.currentBet = player.currentBet;
    player.hasActedThisRound = true;
    // Opponent needs to respond to the raise
    opponent.hasActedThisRound = false;

    if (player.chips === 0) {
      player.isAllIn = true;
    }

    this.state.lastAction = { player: this.state.activePlayer, action: 'raise', amount };
    this.switchActivePlayer();
    this.notify();
  }

  allIn(): void {
    const player = this.getActivePlayerObj();
    const opponent = this.state.activePlayer === 'player' ? this.state.opponent : this.state.player;
    if (player.hasFolded || player.isAllIn) return;

    const allInAmount = player.chips;
    const wasRaise = player.currentBet + allInAmount > this.state.currentBet;

    player.currentBet += allInAmount;
    this.state.pot += allInAmount;
    player.chips = 0;
    player.isAllIn = true;
    player.hasActedThisRound = true;

    if (player.currentBet > this.state.currentBet) {
      this.state.currentBet = player.currentBet;
      // If this was effectively a raise, opponent needs to respond
      if (wasRaise && !opponent.isAllIn) {
        opponent.hasActedThisRound = false;
      }
    }

    this.state.lastAction = { player: this.state.activePlayer, action: 'all_in', amount: allInAmount };
    this.advanceAction();
  }

  private advanceAction(): void {
    // Check if betting round is complete
    const betsEqual = this.state.player.currentBet === this.state.opponent.currentBet;
    const bothActed = this.state.player.hasActedThisRound && this.state.opponent.hasActedThisRound;
    const bothAllIn = this.state.player.isAllIn && this.state.opponent.isAllIn;
    const oneAllIn = this.state.player.isAllIn || this.state.opponent.isAllIn;

    // Advance if:
    // 1. Both players are all-in (neither can act anymore, regardless of bet amounts)
    // 2. One player is all-in and the other has acted (called or folded)
    // 3. Bets are equal and both have acted
    if (bothAllIn || (oneAllIn && bothActed) || (betsEqual && bothActed)) {
      this.advanceRound();
    } else {
      this.switchActivePlayer();
      this.notify();
    }
  }

  private advanceRound(): void {
    // Reset for new betting round
    this.state.player.currentBet = 0;
    this.state.opponent.currentBet = 0;
    this.state.currentBet = 0;
    this.state.lastAction = null;
    this.state.player.hasActedThisRound = false;
    this.state.opponent.hasActedThisRound = false;

    // Check if either player is all-in - if so, deal remaining cards and go to showdown
    // (In heads-up, there's no point continuing to bet when one player can't respond)
    if (this.state.player.isAllIn || this.state.opponent.isAllIn) {
      this.dealRemainingCards();
      this.state.round = 'showdown';
      this.notify();
      return;
    }

    switch (this.state.round) {
      case 'preflop':
        this.dealFlop();
        break;
      case 'flop':
        this.dealTurn();
        break;
      case 'turn':
        this.dealRiver();
        break;
      case 'river':
        this.state.round = 'showdown';
        this.notify();
        break;
    }
  }

  private dealRemainingCards(): void {
    while (this.state.communityCards.length < 5) {
      this.state.communityCards.push(this.dealModifierCard());
    }
  }

  private dealFlop(): void {
    this.state.round = 'flop';
    for (let i = 0; i < 3; i++) {
      this.state.communityCards.push(this.dealModifierCard());
    }
    // Post-flop, non-dealer acts first
    this.state.activePlayer = this.state.dealerPosition === 'player' ? 'opponent' : 'player';
    this.notify();
  }

  private dealTurn(): void {
    this.state.round = 'turn';
    this.state.communityCards.push(this.dealModifierCard());
    this.state.activePlayer = this.state.dealerPosition === 'player' ? 'opponent' : 'player';
    this.notify();
  }

  private dealRiver(): void {
    this.state.round = 'river';
    this.state.communityCards.push(this.dealModifierCard());
    this.state.activePlayer = this.state.dealerPosition === 'player' ? 'opponent' : 'player';
    this.notify();
  }

  startPositioning(): void {
    if (this.state.round !== 'showdown') return;
    this.state.round = 'positioning';
    this.notify();
  }

  startBattle(): void {
    if (this.state.round !== 'positioning') return;
    this.state.round = 'battle';
    this.notify();
  }

  resolveBattle(winner: PlayerPosition | 'tie'): void {
    this.state.battleResult = winner;

    if (winner === 'tie') {
      // Split pot
      const half = Math.floor(this.state.pot / 2);
      this.state.player.chips += half;
      this.state.opponent.chips += this.state.pot - half;
    } else {
      const winnerPlayer = winner === 'player' ? this.state.player : this.state.opponent;
      winnerPlayer.chips += this.state.pot;
    }

    this.state.pot = 0;
    this.state.round = 'hand_complete';
    this.checkGameOver();
    this.notify();
  }

  private checkGameOver(): void {
    if (this.state.player.chips <= 0) {
      this.state.gameOver = true;
      this.state.winner = 'opponent';
    } else if (this.state.opponent.chips <= 0) {
      this.state.gameOver = true;
      this.state.winner = 'player';
    }
  }

  isHandComplete(): boolean {
    return this.state.round === 'hand_complete';
  }

  isGameOver(): boolean {
    return this.state.gameOver;
  }

  isPlayerTurn(): boolean {
    return this.state.activePlayer === 'player' &&
           !this.state.player.hasFolded &&
           !this.state.player.isAllIn &&
           this.state.round !== 'showdown' &&
           this.state.round !== 'positioning' &&
           this.state.round !== 'battle' &&
           this.state.round !== 'hand_complete';
  }

  isShowdown(): boolean {
    return this.state.round === 'showdown';
  }

  isPositioning(): boolean {
    return this.state.round === 'positioning';
  }

  isBattlePhase(): boolean {
    return this.state.round === 'battle';
  }
}

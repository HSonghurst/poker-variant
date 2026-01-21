import type { BettingRound, PlayerAction, PlayerPosition } from './types';
import type { Card } from './Card';
import { ALL_CARDS } from './Card';
import { UnitCardDeck, type UnitCard } from './UnitCardDeck';
import { GodCardDeck, type GodCard } from './GodCardDeck';

export interface Player {
  position: PlayerPosition;
  chips: number;
  coins: number; // Currency for bidding on modifier cards
  health: number; // Player health (0 = eliminated)
  currentBet: number;
  holeCards: UnitCard[];
  godCards: GodCard[];
  keptCards: UnitCard[]; // Up to 4 cards kept across rounds
  keptModifierCards: Card[]; // Modifier cards won through bidding
  bids: Record<number, number>; // cardIndex -> coins bid
  hasFolded: boolean;
  isAllIn: boolean;
  hasActedThisRound: boolean;
  hasKeptCardThisRound: boolean; // Track if player has kept a card this round
}

export interface PokerGameState {
  round: BettingRound;
  pot: number;
  currentBet: number;
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
  players: Player[];
  // Legacy accessors for backwards compatibility
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
  private godCardDeck: GodCardDeck;
  private modifierDeck: Card[];
  private onStateChange: StateChangeCallback;

  private static readonly POSITIONS: PlayerPosition[] = [
    'player', 'opponent', 'topRight', 'bottomRight', 'bottomLeft', 'topLeft'
  ];

  constructor(startingChips: number, onStateChange: StateChangeCallback) {
    this.onStateChange = onStateChange;
    this.unitDeck = new UnitCardDeck();
    this.godCardDeck = new GodCardDeck();
    this.modifierDeck = [];

    const createPlayer = (position: PlayerPosition): Player => ({
      position,
      chips: startingChips,
      coins: 10, // Everyone starts with 10 coins
      health: 100, // Starting health
      currentBet: 0,
      holeCards: [],
      godCards: [],
      keptCards: [],
      keptModifierCards: [],
      bids: {},
      hasFolded: false,
      isAllIn: false,
      hasActedThisRound: false,
      hasKeptCardThisRound: false
    });

    const players = PokerGame.POSITIONS.map(pos => createPlayer(pos));

    this.state = {
      round: 'preflop',
      pot: 0,
      currentBet: 0,
      smallBlind: 10,
      bigBlind: 20,
      handNumber: 0,
      players,
      player: players[0],
      opponent: players[1],
      dealerPosition: 'player',
      activePlayer: 'opponent',
      communityCards: [],
      lastAction: null,
      battleResult: null,
      gameOver: false,
      winner: null
    };
  }

  getPlayer(position: PlayerPosition): Player {
    return this.state.players.find(p => p.position === position)!;
  }

  getState(): PokerGameState {
    return {
      ...this.state,
      player: this.state.players[0],
      opponent: this.state.players[1]
    };
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
    // Add 10 coins to everyone at start of each round (except first)
    if (this.state.handNumber > 0) {
      for (const player of this.state.players) {
        player.coins += 10;
      }
    }

    // Reset for new hand
    this.state.handNumber++;
    this.state.round = 'draw'; // Start with draw phase
    this.state.pot = 0;
    this.state.currentBet = 0;
    this.state.communityCards = [];
    this.state.battleResult = null;
    this.state.lastAction = null;

    // Reset all players (but keep keptCards and keptModifierCards across rounds)
    for (const player of this.state.players) {
      player.holeCards = [];
      player.godCards = [];
      player.bids = {}; // Reset bids each round
      // keptCards and keptModifierCards persist across rounds
      player.currentBet = 0;
      player.hasFolded = false;
      player.isAllIn = false;
      player.hasActedThisRound = false;
      player.hasKeptCardThisRound = false;
    }

    // Shuffle decks
    this.unitDeck.reset();
    this.godCardDeck.reset();
    this.shuffleModifierDeck();

    // Deal hole cards (unit cards) and god cards to all 6 players
    for (const player of this.state.players) {
      player.holeCards = this.unitDeck.deal(2);
      player.godCards = this.godCardDeck.deal(2);
    }

    // Deal all 5 community cards (modifier cards) - they'll be revealed one by one
    for (let i = 0; i < 5; i++) {
      this.state.communityCards.push(this.dealModifierCard());
    }

    this.notify();
  }

  // Advance to next phase
  advancePhase(): void {
    const phaseOrder: BettingRound[] = ['draw', 'table_reveal', 'bidding', 'bid_reveal', 'battle', 'choose'];
    const currentIndex = phaseOrder.indexOf(this.state.round);
    if (currentIndex >= 0 && currentIndex < phaseOrder.length - 1) {
      this.state.round = phaseOrder[currentIndex + 1];
      this.notify();
    }
  }

  // Set phase directly
  setPhase(phase: BettingRound): void {
    this.state.round = phase;
    this.notify();
  }

  // Place a bid on a community card
  placeBid(position: PlayerPosition, cardIndex: number, amount: number): boolean {
    const player = this.getPlayer(position);

    // Calculate total coins already bid (excluding current card)
    const otherBids = Object.entries(player.bids)
      .filter(([idx]) => parseInt(idx) !== cardIndex)
      .reduce((sum, [, amt]) => sum + amt, 0);

    // Check if player has enough coins
    const totalNeeded = otherBids + amount;
    if (totalNeeded > player.coins) return false;

    // Validate card index
    if (cardIndex < 0 || cardIndex >= 5) return false;

    // Set the bid (0 to remove bid)
    if (amount === 0) {
      delete player.bids[cardIndex];
    } else {
      player.bids[cardIndex] = amount;
    }

    this.notify();
    return true;
  }

  // Get total coins a player has bid
  getTotalBid(position: PlayerPosition): number {
    const player = this.getPlayer(position);
    return Object.values(player.bids).reduce((sum, amt) => sum + amt, 0);
  }

  // Get available coins (total - already bid)
  getAvailableCoins(position: PlayerPosition): number {
    const player = this.getPlayer(position);
    return player.coins - this.getTotalBid(position);
  }

  // AI places random bids
  placeAIBids(): void {
    for (const player of this.state.players) {
      if (player.position === 'player') continue; // Skip human player

      // AI randomly bids on 1-3 cards
      const numBids = Math.floor(Math.random() * 3) + 1;
      const cardIndices = [0, 1, 2, 3, 4].sort(() => Math.random() - 0.5).slice(0, numBids);

      let remainingCoins = player.coins;
      for (const cardIndex of cardIndices) {
        if (remainingCoins <= 0) break;
        // Bid 1-5 coins randomly
        const bid = Math.min(Math.floor(Math.random() * 5) + 1, remainingCoins);
        player.bids[cardIndex] = bid;
        remainingCoins -= bid;
      }
    }
    this.notify();
  }

  // Reveal bids and determine winners for each card
  revealBidsAndAwardCards(): Record<number, { winner: PlayerPosition; amount: number }> {
    const results: Record<number, { winner: PlayerPosition; amount: number }> = {};

    for (let cardIndex = 0; cardIndex < 5; cardIndex++) {
      let highestBid = 0;
      let winner: PlayerPosition | null = null;

      // Find highest bidder for this card
      for (const player of this.state.players) {
        const bid = player.bids[cardIndex] || 0;
        if (bid > highestBid) {
          highestBid = bid;
          winner = player.position;
        } else if (bid === highestBid && bid > 0) {
          // Tie - randomly pick winner (or first bidder wins)
          if (Math.random() > 0.5) {
            winner = player.position;
          }
        }
      }

      if (winner && highestBid > 0) {
        results[cardIndex] = { winner, amount: highestBid };

        // Award the card to winner
        const winningPlayer = this.getPlayer(winner);
        winningPlayer.keptModifierCards.push(this.state.communityCards[cardIndex]);
      }
    }

    // Deduct coins from all players for their bids
    for (const player of this.state.players) {
      const totalBid = Object.values(player.bids).reduce((sum, amt) => sum + amt, 0);
      player.coins -= totalBid;
    }

    this.notify();
    return results;
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

  // Keep a hole card (add to keptCards collection)
  keepCard(position: PlayerPosition, holeCardIndex: number, replaceIndex?: number): boolean {
    const player = this.getPlayer(position);

    // Can only keep once per round
    if (player.hasKeptCardThisRound) return false;

    // Validate hole card index
    if (holeCardIndex < 0 || holeCardIndex >= player.holeCards.length) return false;

    const cardToKeep = player.holeCards[holeCardIndex];

    if (player.keptCards.length < 4) {
      // Still have room, just add it
      player.keptCards.push(cardToKeep);
      player.hasKeptCardThisRound = true;
      this.notify();
      return true;
    } else if (replaceIndex !== undefined && replaceIndex >= 0 && replaceIndex < 4) {
      // Replace an existing kept card
      player.keptCards[replaceIndex] = cardToKeep;
      player.hasKeptCardThisRound = true;
      this.notify();
      return true;
    }

    return false;
  }

  // Check if player can keep a card (only after battle/choose phase)
  canKeepCard(position: PlayerPosition): boolean {
    const player = this.getPlayer(position);
    return !player.hasKeptCardThisRound && (this.state.round === 'hand_complete' || this.state.round === 'choose');
  }

  // AI players automatically keep a random card
  makeAIKeepCards(): void {
    const aiPositions: PlayerPosition[] = ['opponent', 'topLeft', 'topRight', 'bottomLeft', 'bottomRight'];

    for (const position of aiPositions) {
      const player = this.getPlayer(position);

      // Skip if already kept a card this round or no hole cards
      if (player.hasKeptCardThisRound || player.holeCards.length === 0) continue;

      // Pick a random hole card to keep
      const holeCardIndex = Math.floor(Math.random() * player.holeCards.length);

      if (player.keptCards.length < 4) {
        // Still have room, just keep it
        this.keepCard(position, holeCardIndex);
      } else {
        // Replace a random kept card
        const replaceIndex = Math.floor(Math.random() * 4);
        this.keepCard(position, holeCardIndex, replaceIndex);
      }
    }
  }

  // Check if keeper slots are full (need to replace)
  isKeeperSlotsFull(position: PlayerPosition): boolean {
    const player = this.getPlayer(position);
    return player.keptCards.length >= 4;
  }

  // Buy a community card (costs 2 coins)
  buyModifierCard(position: PlayerPosition, cardIndex: number): boolean {
    const player = this.getPlayer(position);
    const cost = 2;

    // Check if player has enough coins
    if (player.coins < cost) return false;

    // Check if card index is valid
    if (cardIndex < 0 || cardIndex >= this.state.communityCards.length) return false;

    const card = this.state.communityCards[cardIndex];

    // Check if already bought this card
    if (player.keptModifierCards.some(c => c.id === card.id)) return false;

    // Buy the card
    player.coins -= cost;
    player.keptModifierCards.push(card);
    this.notify();
    return true;
  }

  // Check if player can buy a modifier card
  canBuyModifierCard(position: PlayerPosition, cardIndex: number): boolean {
    const player = this.getPlayer(position);
    if (player.coins < 2) return false;
    if (cardIndex < 0 || cardIndex >= this.state.communityCards.length) return false;
    const card = this.state.communityCards[cardIndex];
    // Can't buy same card twice
    if (player.keptModifierCards.some(c => c.id === card.id)) return false;
    return this.state.round === 'hand_complete';
  }

  // Get player's coins
  getCoins(position: PlayerPosition): number {
    return this.getPlayer(position).coins;
  }

  // Get player's health
  getHealth(position: PlayerPosition): number {
    return this.getPlayer(position).health;
  }

  // Apply damage based on battle rankings
  // rankings[0] = 1st place (winner, no damage), rankings[5] = last place (most damage)
  // Damage scales with round number: baseDamage * (roundNumber ^ 1.3)
  applyBattleDamage(rankings: PlayerPosition[]): void {
    const roundNumber = this.state.handNumber;
    const DAMAGE_EXPONENT = 1.3;
    const roundMultiplier = Math.pow(roundNumber, DAMAGE_EXPONENT);

    // Base damage by position: 1st=0, 2nd=1, 3rd=2, 4th=3, 5th=4, 6th=5
    for (let i = 0; i < rankings.length; i++) {
      const position = rankings[i];
      const player = this.getPlayer(position);

      // 1st place (index 0) takes no damage
      if (i === 0) continue;

      const baseDamage = i; // 2nd place = 1, 3rd = 2, etc.
      const totalDamage = Math.round(baseDamage * roundMultiplier);

      player.health = Math.max(0, player.health - totalDamage);
    }

    this.notify();
  }

  // Check if a player is eliminated (health <= 0)
  isPlayerEliminated(position: PlayerPosition): boolean {
    return this.getPlayer(position).health <= 0;
  }

  // Get all eliminated players
  getEliminatedPlayers(): PlayerPosition[] {
    return this.state.players
      .filter(p => p.health <= 0)
      .map(p => p.position);
  }

  // Check if game should end (only one player remaining)
  checkHealthGameOver(): PlayerPosition | null {
    const alivePlayers = this.state.players.filter(p => p.health > 0);
    if (alivePlayers.length === 1) {
      return alivePlayers[0].position;
    }
    return null;
  }
}

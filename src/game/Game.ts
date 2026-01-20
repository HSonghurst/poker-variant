import { Fighter } from './Fighter';
import { DamageNumberManager } from './DamageNumber';
import { Swordsman } from './Swordsman';
import { Archer } from './Archer';
import { Mage } from './Mage';
import { Knight } from './Knight';
import { Healer } from './Healer';
import { XPOrb } from './XPOrb';
import { Tower } from './Tower';
import { Boss } from './Boss';
import { Wraith } from './Wraith';
import { Building, BUILDING_TYPES } from './Building';
import { ALL_CARDS, TeamModifiers, pickRandomRarity } from './Card';
import { SoundManager } from './SoundManager';
import { Player } from './Player';
import { Chest } from './Chest';
import { DPSTracker } from './DPSTracker';
import type { Card } from './Card';
import type { BuildingChoice } from './Building';
import type { Team, FighterType } from './types';

type SelectionType = 'card' | 'building';
type SelectionItem = Card | BuildingChoice;

// Fixed enemy building order
const ENEMY_BUILDING_ORDER: FighterType[] = [
  'swordsman', 'mage', 'swordsman', 'archer', 'healer',
  'knight', 'swordsman', 'mage', 'archer', 'knight'
];

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private topTeam: Fighter[] = [];
  private bottomTeam: Fighter[] = [];
  private topBuildings: (Building | null)[] = new Array(10).fill(null);
  private bottomBuildings: (Building | null)[] = new Array(10).fill(null);
  private topTower: Tower | null = null;
  private bottomTower: Tower | null = null;
  private xpOrbs: XPOrb[] = [];
  private chests: Chest[] = [];
  private topRespawnTimers: Map<FighterType, number> = new Map();
  private bottomRespawnTimers: Map<FighterType, number> = new Map();
  private respawnDelay: number = 0; // No respawn delay
  private topKills: number = 0;
  private bottomKills: number = 0;
  private topXP: number = 0;
  private bottomXP: number = 0;
  private topLevel: number = 1;
  private bottomLevel: number = 1;
  private running: boolean = false;
  private lastTime: number = 0;
  private gameTime: number = 0; // Elapsed game time in ms
  private updateCountsCallback: () => void;
  private onWinnerCallback: (team: Team) => void;
  private onSelectionCallback: (team: Team, items: SelectionItem[], type: SelectionType) => void;
  private topModifiers: TeamModifiers = new TeamModifiers();
  private bottomModifiers: TeamModifiers = new TeamModifiers();
  private selectingForTeam: Team | null = null;
  private selectionType: SelectionType | null = null;
  private pendingSelections: { team: Team; type: SelectionType }[] = [];
  private singlePlayerMode: boolean = false;
  private player: Player | null = null;
  private backgroundImage: HTMLImageElement | null = null;
  private topBoss: Boss | null = null;
  private bossSpawnCount: number = 0;
  private topWraith: Wraith | null = null;
  private wraithSpawnCount: number = 0;

  constructor(
    canvas: HTMLCanvasElement,
    updateCounts: () => void,
    onWinner: (team: Team) => void,
    onSelection: (team: Team, items: SelectionItem[], type: SelectionType) => void
  ) {
    this.canvas = canvas;
    this.canvas.width = 1100;
    this.canvas.height = 700;
    this.ctx = canvas.getContext('2d')!;
    this.updateCountsCallback = updateCounts;
    this.onWinnerCallback = onWinner;
    this.onSelectionCallback = onSelection;

    // Load background image
    this.backgroundImage = new Image();
    this.backgroundImage.src = '/grass-background.png';

    this.clear();

    // Set up keyboard listeners for player control
    window.addEventListener('keydown', (e) => {
      if (this.player && ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        this.player.handleKeyDown(e.key);
      }
    });
    window.addEventListener('keyup', (e) => {
      if (this.player) {
        this.player.handleKeyUp(e.key);
      }
    });
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    // Create towers
    this.topTower = new Tower('blue', this.canvas.width, this.canvas.height);
    this.bottomTower = new Tower('red', this.canvas.width, this.canvas.height);
    // Create player for bottom team (player-controlled)
    this.player = new Player('red', this.canvas.width, this.canvas.height);
    this.player.setModifiers(this.bottomModifiers);
    // Each team starts with building selection
    this.triggerSelection('blue', 'building');
    this.triggerSelection('red', 'building');
    this.gameLoop();
  }

  reset(): void {
    this.running = false;
    this.topTeam = [];
    this.bottomTeam = [];
    this.topBuildings = new Array(10).fill(null);
    this.bottomBuildings = new Array(10).fill(null);
    this.topTower = null;
    this.bottomTower = null;
    this.topBoss = null;
    this.bossSpawnCount = 0;
    this.topWraith = null;
    this.wraithSpawnCount = 0;
    this.player = null;
    this.xpOrbs = [];
    this.chests = [];
    DPSTracker.reset();
    this.topKills = 0;
    this.bottomKills = 0;
    this.topXP = 0;
    this.bottomXP = 0;
    this.topLevel = 1;
    this.bottomLevel = 1;
    this.gameTime = 0;
    this.topModifiers = new TeamModifiers();
    this.bottomModifiers = new TeamModifiers();
    this.topRespawnTimers = new Map();
    this.bottomRespawnTimers = new Map();
    this.selectingForTeam = null;
    this.selectionType = null;
    this.pendingSelections = [];
    DamageNumberManager.clear();
    this.clear();
    this.updateCountsCallback();
  }

  isGameRunning(): boolean {
    return this.running;
  }

  getTeamCount(team: Team): number {
    const fighters = team === 'blue' ? this.topTeam : this.bottomTeam;
    return fighters.filter(f => !f.isDead).length;
  }

  getBuildingCount(team: Team): number {
    const buildings = team === 'blue' ? this.topBuildings : this.bottomBuildings;
    return buildings.filter(b => b !== null).length;
  }

  getKills(team: Team): number {
    return team === 'blue' ? this.topKills : this.bottomKills;
  }

  getModifiers(team: Team): TeamModifiers {
    return team === 'blue' ? this.topModifiers : this.bottomModifiers;
  }

  isSelectingCard(): boolean {
    return this.selectingForTeam !== null;
  }

  setSinglePlayerMode(enabled: boolean): void {
    this.singlePlayerMode = enabled;
  }

  selectCard(card: Card): void {
    if (!this.selectingForTeam || this.selectionType !== 'card') return;

    const modifiers = this.selectingForTeam === 'blue' ? this.topModifiers : this.bottomModifiers;
    modifiers.applyCard(card);

    this.processNextSelection();
  }

  selectBuilding(building: BuildingChoice): void {
    if (!this.selectingForTeam || this.selectionType !== 'building') return;

    const buildings = this.selectingForTeam === 'blue' ? this.topBuildings : this.bottomBuildings;
    const emptySlot = buildings.findIndex(b => b === null);

    if (emptySlot !== -1) {
      buildings[emptySlot] = new Building(
        this.selectingForTeam,
        emptySlot,
        building.type,
        this.canvas.width,
        this.canvas.height
      );
    }

    this.processNextSelection();
  }

  private processNextSelection(): void {
    if (this.pendingSelections.length > 0) {
      const next = this.pendingSelections.shift()!;
      this.selectingForTeam = next.team;
      this.selectionType = next.type;
      this.showSelection(next.team, next.type);
    } else {
      this.selectingForTeam = null;
      this.selectionType = null;
    }
  }

  private createFighter(team: Team, type: FighterType, x: number): Fighter {
    const modifiers = team === 'blue' ? this.topModifiers : this.bottomModifiers;
    let fighter: Fighter;

    switch (type) {
      case 'archer':
        fighter = new Archer(team, x, this.canvas.height);
        break;
      case 'mage':
        fighter = new Mage(team, x, this.canvas.height);
        break;
      case 'knight':
        fighter = new Knight(team, x, this.canvas.height);
        break;
      case 'healer':
        fighter = new Healer(team, x, this.canvas.height);
        break;
      default:
        fighter = new Swordsman(team, x, this.canvas.height);
    }

    fighter.applyModifiers(modifiers);
    return fighter;
  }

  private gameLoop = (): void => {
    if (!this.running) return;

    const now = performance.now();
    const deltaTime = now - this.lastTime;
    this.lastTime = now;

    if (!this.selectingForTeam) {
      this.update(deltaTime);
    }
    this.draw();

    requestAnimationFrame(this.gameLoop);
  };

  private update(deltaTime: number): void {
    // Pause game timer when selecting cards/buildings
    if (!this.isSelectingCard()) {
      this.gameTime += deltaTime;
    }

    // Spawn enemy boss (ogre) at 3 minutes only
    const bossSpawnTimes = [180000]; // 3 min only
    if (this.bossSpawnCount < bossSpawnTimes.length && this.gameTime >= bossSpawnTimes[this.bossSpawnCount]) {
      this.topBoss = new Boss('blue', this.canvas.width / 2, this.canvas.height);
      this.bossSpawnCount++;
      SoundManager.playExplosion();
    }

    // Spawn enemy wraith at 3 minutes only
    const wraithSpawnTimes = [180000]; // 3 min only
    if (this.wraithSpawnCount < wraithSpawnTimes.length && this.gameTime >= wraithSpawnTimes[this.wraithSpawnCount]) {
      this.topWraith = new Wraith('blue', this.canvas.width / 2, this.canvas.height);
      this.wraithSpawnCount++;
      SoundManager.playFireball();
    }

    // Check win condition - player destroys enemy tower
    if (this.topTower?.isDead) {
      this.running = false;
      SoundManager.playVictory();
      this.onWinnerCallback('red');
      return;
    }

    // Check lose condition - enemy destroys player's tower
    if (this.bottomTower?.isDead) {
      this.running = false;
      SoundManager.playVictory();
      this.onWinnerCallback('blue');
      return;
    }

    // Player death = game over (top team wins)
    if (this.player?.isDead) {
      this.running = false;
      SoundManager.playVictory();
      this.onWinnerCallback('blue');
      return;
    }

    // Spawn units up to building cap
    this.spawnUnitsUpToCap('blue', deltaTime);
    this.spawnUnitsUpToCap('red', deltaTime);

    // Update fighters - include enemy tower as a target
    const aliveTop = this.topTeam.filter(f => !f.isDead);
    const aliveBottom = this.bottomTeam.filter(f => !f.isDead);

    // Create target lists that include towers, bosses, and player
    const topTargets: (Fighter | Tower)[] = [...aliveTop];
    const bottomTargets: (Fighter | Tower)[] = [...aliveBottom];
    if (this.topTower && !this.topTower.isDead) topTargets.push(this.topTower as unknown as Fighter);
    if (this.bottomTower && !this.bottomTower.isDead) bottomTargets.push(this.bottomTower as unknown as Fighter);
    // Add enemy bosses to targets (only top/enemy team has bosses)
    if (this.topBoss && !this.topBoss.isDead) topTargets.push(this.topBoss as Fighter);
    if (this.topWraith && !this.topWraith.isDead) topTargets.push(this.topWraith as Fighter);
    // Add player to targets (player is on bottom team, so top team can target them)
    if (this.player && !this.player.isDead) {
      bottomTargets.push(this.player as unknown as Fighter);
    }

    for (const fighter of this.topTeam) {
      fighter.update(bottomTargets as Fighter[], deltaTime, aliveTop);
    }
    for (const fighter of this.bottomTeam) {
      fighter.update(topTargets as Fighter[], deltaTime, aliveBottom);
    }

    // Update towers (shoot at enemies)
    if (this.topTower && !this.topTower.isDead) {
      this.topTower.update(aliveBottom);
    }
    if (this.bottomTower && !this.bottomTower.isDead) {
      this.bottomTower.update(aliveTop);
    }

    // Update enemy bosses and check for death to spawn chests
    const bossWasAlive = this.topBoss && !this.topBoss.isDead;
    const wraithWasAlive = this.topWraith && !this.topWraith.isDead;

    if (this.topBoss && !this.topBoss.isDead) {
      this.topBoss.update(bottomTargets as Fighter[], deltaTime, aliveTop);
    }
    if (this.topWraith && !this.topWraith.isDead) {
      this.topWraith.update(bottomTargets as Fighter[], deltaTime, aliveTop);
    }

    // Spawn chests when bosses die
    if (bossWasAlive && this.topBoss?.isDead) {
      this.chests.push(new Chest(this.topBoss.x, this.topBoss.y));
    }
    if (wraithWasAlive && this.topWraith?.isDead) {
      this.chests.push(new Chest(this.topWraith.x, this.topWraith.y));
    }

    // Update player (pass top team as enemies since player is on bottom team)
    if (this.player) {
      this.player.update(deltaTime, this.canvas.width, this.canvas.height, aliveTop);
    }

    // Update XP orbs (pass player for attraction)
    for (const orb of this.xpOrbs) {
      const wasCollected = orb.collected;
      orb.update(deltaTime, this.canvas.height, this.player || undefined);

      if (!wasCollected && orb.collected) {
        this.collectXP(orb.targetTeam, orb.value);
      }
    }
    this.xpOrbs = this.xpOrbs.filter(o => !o.collected);

    // Update chests
    for (const chest of this.chests) {
      chest.update(deltaTime, this.player);
    }
    this.chests = this.chests.filter(c => !c.isOpened);

    // Process deaths
    this.processDeaths();

    // Update damage numbers
    DamageNumberManager.update(deltaTime);

    // Clean up dead fighters periodically
    this.topTeam = this.topTeam.filter(f => !f.isDead || !('processed' in f));
    this.bottomTeam = this.bottomTeam.filter(f => !f.isDead || !('processed' in f));

    this.updateCountsCallback();
  }

  private spawnUnitsUpToCap(team: Team, deltaTime: number): void {
    const buildings = team === 'blue' ? this.topBuildings : this.bottomBuildings;
    const fighters = team === 'blue' ? this.topTeam : this.bottomTeam;
    const respawnTimers = team === 'blue' ? this.topRespawnTimers : this.bottomRespawnTimers;

    // Sum up caps by type (each building has its own cap value)
    const buildingCounts = new Map<FighterType, number>();
    for (const building of buildings) {
      if (building) {
        buildingCounts.set(building.type, (buildingCounts.get(building.type) || 0) + building.cap);
      }
    }

    // Count alive fighters by type
    const aliveCounts = new Map<FighterType, number>();
    for (const fighter of fighters) {
      if (!fighter.isDead) {
        const type = fighter.getType();
        aliveCounts.set(type, (aliveCounts.get(type) || 0) + 1);
      }
    }

    // Update respawn timers and spawn units
    for (const [type, cap] of buildingCounts) {
      const alive = aliveCounts.get(type) || 0;
      if (alive < cap) {
        // Check/update respawn timer
        const timer = respawnTimers.get(type) || 0;
        if (timer <= 0) {
          // Spawn unit
          const x = 100 + Math.random() * (this.canvas.width - 200);
          const fighter = this.createFighter(team, type, x);
          fighters.push(fighter);
          // Reset timer for next spawn
          respawnTimers.set(type, this.respawnDelay);
        } else {
          respawnTimers.set(type, timer - deltaTime);
        }
      }
    }
  }

  private processDeaths(): void {
    for (const fighter of this.topTeam) {
      if (fighter.isDead && !('processed' in fighter)) {
        (fighter as Fighter & { processed: boolean }).processed = true;
        this.bottomKills++;
        this.spawnXPOrb(fighter, 'red');
      }
    }
    for (const fighter of this.bottomTeam) {
      if (fighter.isDead && !('processed' in fighter)) {
        (fighter as Fighter & { processed: boolean }).processed = true;
        this.topKills++;
        this.spawnXPOrb(fighter, 'blue');
      }
    }
  }

  private spawnXPOrb(fighter: Fighter, forTeam: Team): void {
    const orb = new XPOrb(fighter.x, fighter.y, forTeam, 10);
    this.xpOrbs.push(orb);
  }

  private getXPRequired(level: number): number {
    // Polynomial curve: XP requirements grow steeper at higher levels
    return Math.round(45 * Math.pow(level, 0.9));
  }

  private collectXP(team: Team, amount: number): void {
    SoundManager.playXPCollect();
    if (team === 'blue') {
      this.topXP += amount;
      const required = this.getXPRequired(this.topLevel);
      if (this.topXP >= required) {
        this.topXP = 0;
        this.topLevel++;
        this.onLevelUp('blue', this.topLevel);
      }
    } else {
      this.bottomXP += amount;
      const required = this.getXPRequired(this.bottomLevel);
      if (this.bottomXP >= required) {
        this.bottomXP = 0;
        this.bottomLevel++;
        this.onLevelUp('red', this.bottomLevel);
      }
    }
  }

  private onLevelUp(team: Team, level: number): void {
    // Play level up sound
    SoundManager.playLevelUp();
    // Card selection every level
    this.triggerSelection(team, 'card');

    if (level <= 10) {
      // Levels 1-10: add new building slots
      this.triggerSelection(team, 'building');
    } else {
      // Levels 11+: increase building caps, cycling through buildings
      const buildings = team === 'blue' ? this.topBuildings : this.bottomBuildings;
      const slotIndex = (level - 11) % 10; // Cycle through 10 slots
      const building = buildings[slotIndex];
      if (building && building.cap < 10) {
        building.cap += 2;
      } else {
        // Find next building that can be upgraded
        for (let i = 0; i < 10; i++) {
          const idx = (slotIndex + i) % 10;
          const b = buildings[idx];
          if (b && b.cap < 10) {
            b.cap += 2;
            break;
          }
        }
      }
    }
  }

  private triggerSelection(team: Team, type: SelectionType): void {
    // Check if team has available slots for buildings
    if (type === 'building') {
      const buildings = team === 'blue' ? this.topBuildings : this.bottomBuildings;
      if (buildings.every(b => b !== null)) return; // No slots available
    }

    if (this.selectingForTeam) {
      this.pendingSelections.push({ team, type });
    } else {
      this.selectingForTeam = team;
      this.selectionType = type;
      this.showSelection(team, type);
    }
  }

  private showSelection(team: Team, type: SelectionType): void {
    // In single player mode, auto-select for blue team (top)
    if (this.singlePlayerMode && team === 'blue') {
      if (type === 'card') {
        const cards = this.getRandomCards(3, team);
        const randomCard = cards[Math.floor(Math.random() * cards.length)];
        this.topModifiers.applyCard(randomCard);
      } else {
        // Use fixed building order for enemy team
        const emptySlot = this.topBuildings.findIndex(b => b === null);
        if (emptySlot !== -1 && emptySlot < ENEMY_BUILDING_ORDER.length) {
          this.topBuildings[emptySlot] = new Building(
            'blue',
            emptySlot,
            ENEMY_BUILDING_ORDER[emptySlot],
            this.canvas.width,
            this.canvas.height
          );
        }
      }
      this.processNextSelection();
      return;
    }

    if (type === 'card') {
      const cards = this.getRandomCards(3, team);
      this.onSelectionCallback(team, cards, 'card');
    } else {
      const buildings = this.getRandomBuildings(3, team);
      this.onSelectionCallback(team, buildings, 'building');
    }
  }

  private getRandomCards(count: number, team?: Team): Card[] {
    const modifiers = team === 'blue' ? this.topModifiers : this.bottomModifiers;
    const buildings = team === 'blue' ? this.topBuildings : this.bottomBuildings;
    const level = team === 'blue' ? this.topLevel : this.bottomLevel;

    // Get unique fighter types from buildings
    const ownedTypes = new Set<string>();
    for (const building of buildings) {
      if (building) {
        ownedTypes.add(building.type);
      }
    }

    // Filter out cards we can't use
    const availableCards = ALL_CARDS.filter(card => {
      const e = card.effect;

      // Filter out ability cards we already have
      if (e.archerFanAbility && modifiers.archerFanAbility) return false;
      if (e.swordsmanSweepAbility && modifiers.swordsmanSweepAbility) return false;
      if (e.knightTauntAbility && modifiers.knightTauntAbility) return false;
      if (e.mageVoidEruptionAbility && modifiers.mageVoidEruptionAbility) return false;
      if (e.healerPurifyAbility && modifiers.healerPurifyAbility) return false;

      // Filter out ability cards for units we don't have
      if (e.archerFanAbility && !ownedTypes.has('archer')) return false;
      if (e.swordsmanSweepAbility && !ownedTypes.has('swordsman')) return false;
      if (e.knightTauntAbility && !ownedTypes.has('knight')) return false;
      if (e.mageVoidEruptionAbility && !ownedTypes.has('mage')) return false;
      if (e.healerPurifyAbility && !ownedTypes.has('healer')) return false;

      // Filter out healer-specific cards if we don't have healers
      if (e.healPowerMultiplier && !ownedTypes.has('healer')) return false;
      if (e.healAoeMultiplier && !ownedTypes.has('healer')) return false;

      // Filter out on-hit application cards we already have (can only pick once)
      if (e.archerPoisonOnHit && modifiers.archerPoisonOnHit) return false;
      if (e.swordsmanFireOnHit && modifiers.swordsmanFireOnHit) return false;
      if (e.knightFrostOnHit && modifiers.knightFrostOnHit) return false;

      // Filter out on-hit application cards for units we don't have
      if (e.archerPoisonOnHit && !ownedTypes.has('archer')) return false;
      if (e.swordsmanFireOnHit && !ownedTypes.has('swordsman')) return false;
      if (e.knightFrostOnHit && !ownedTypes.has('knight')) return false;

      // Filter out DoT/duration multiplier cards if we don't have the on-hit application
      // Poison DoT only useful if archer has poison on-hit
      if (e.poisonDoTMultiplier && !modifiers.archerPoisonOnHit) return false;
      // Fire DoT only useful if swordsman has fire on-hit
      if (e.fireDoTMultiplier && !modifiers.swordsmanFireOnHit) return false;
      // Frost duration only useful if knight has frost on-hit
      if (e.frostDurationMultiplier && !modifiers.knightFrostOnHit) return false;
      // Void DoT only useful if we have mages (they always apply void)
      if (e.voidDoTMultiplier && !ownedTypes.has('mage')) return false;

      // Filter out type-specific stat cards for units we don't have
      if (e.damageMultiplier && e.damageMultiplier.type !== 'all' && !ownedTypes.has(e.damageMultiplier.type)) return false;
      if (e.healthMultiplier && e.healthMultiplier.type !== 'all' && !ownedTypes.has(e.healthMultiplier.type)) return false;
      if (e.rangeMultiplier && e.rangeMultiplier.type !== 'all' && !ownedTypes.has(e.rangeMultiplier.type)) return false;

      return true;
    });

    // Pick cards using weighted rarity selection
    const selectedCards: Card[] = [];
    const usedBaseNames = new Set<string>(); // Prevent duplicate base cards

    for (let i = 0; i < count; i++) {
      const rarity = pickRandomRarity(level);
      const cardsOfRarity = availableCards.filter(c =>
        c.rarity === rarity && !usedBaseNames.has(this.getBaseName(c.name))
      );

      if (cardsOfRarity.length > 0) {
        const card = cardsOfRarity[Math.floor(Math.random() * cardsOfRarity.length)];
        selectedCards.push(card);
        usedBaseNames.add(this.getBaseName(card.name));
      } else {
        // Fallback: pick any available card of any rarity
        const remainingCards = availableCards.filter(c =>
          !usedBaseNames.has(this.getBaseName(c.name))
        );
        if (remainingCards.length > 0) {
          const card = remainingCards[Math.floor(Math.random() * remainingCards.length)];
          selectedCards.push(card);
          usedBaseNames.add(this.getBaseName(card.name));
        }
      }
    }

    return selectedCards;
  }

  private getBaseName(cardName: string): string {
    // Remove rarity prefix to get base card name
    const prefixes = ['Rare ', 'Epic ', 'Legendary '];
    for (const prefix of prefixes) {
      if (cardName.startsWith(prefix)) {
        return cardName.slice(prefix.length);
      }
    }
    return cardName;
  }

  private getRandomBuildings(count: number, team: Team): BuildingChoice[] {
    const buildings = team === 'blue' ? this.topBuildings : this.bottomBuildings;
    const hasAnyBuilding = buildings.some(b => b !== null);

    // Exclude healer if this is the first building (no units to heal yet)
    let availableTypes = [...BUILDING_TYPES];
    if (!hasAnyBuilding) {
      availableTypes = availableTypes.filter(b => b.type !== 'healer');
    }

    const shuffled = availableTypes.sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  private draw(): void {
    this.clear();

    // Draw building slots
    this.drawBuildingSlots();

    // Draw buildings
    for (const building of this.topBuildings) {
      if (building) building.draw(this.ctx);
    }
    for (const building of this.bottomBuildings) {
      if (building) building.draw(this.ctx);
    }

    // Draw battlefield line
    const ctx = this.ctx;
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(0, this.canvas.height / 2);
    ctx.lineTo(this.canvas.width, this.canvas.height / 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw XP orbs
    for (const orb of this.xpOrbs) {
      orb.draw(ctx);
    }

    // Draw chests
    for (const chest of this.chests) {
      chest.draw(ctx);
    }

    // Draw towers
    if (this.topTower) this.topTower.draw(ctx);
    if (this.bottomTower) this.bottomTower.draw(ctx);

    // Draw enemy bosses
    if (this.topBoss) this.topBoss.draw(ctx);
    if (this.topWraith) this.topWraith.draw(ctx);

    // Draw fighters
    for (const fighter of this.topTeam) {
      fighter.draw(ctx);
    }
    for (const fighter of this.bottomTeam) {
      fighter.draw(ctx);
    }

    // Draw player
    if (this.player) {
      this.player.draw(ctx);
    }

    // Draw damage numbers
    DamageNumberManager.draw(ctx);

    // Draw XP bars
    this.drawXPBar('blue');
    this.drawXPBar('red');

    // Draw game clock
    this.drawClock();

    // Draw DPS tracker on the right
    DPSTracker.draw(ctx, this.canvas.width - 150, 70);
  }

  private drawClock(): void {
    const ctx = this.ctx;
    const totalSeconds = Math.floor(this.gameTime / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const timeStr = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

    // Draw clock background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(this.canvas.width / 2 - 30, 2, 60, 20, 5);
    ctx.fill();

    // Draw time text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(timeStr, this.canvas.width / 2, 12);
  }

  private drawBuildingSlots(): void {
    const ctx = this.ctx;
    const slotWidth = this.canvas.width / 10;

    // Draw empty slots
    for (let i = 0; i < 10; i++) {
      const x = slotWidth * i + slotWidth / 2;

      // Top slots
      if (!this.topBuildings[i]) {
        ctx.strokeStyle = 'rgba(74, 144, 217, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(x - 20, 8, 40, 35);
        ctx.setLineDash([]);
      }

      // Bottom slots
      if (!this.bottomBuildings[i]) {
        ctx.strokeStyle = 'rgba(217, 74, 74, 0.3)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.strokeRect(x - 20, this.canvas.height - 43, 40, 35);
        ctx.setLineDash([]);
      }
    }
  }

  private drawXPBar(team: Team): void {
    const ctx = this.ctx;
    const xp = team === 'blue' ? this.topXP : this.bottomXP;
    const level = team === 'blue' ? this.topLevel : this.bottomLevel;
    const modifiers = team === 'blue' ? this.topModifiers : this.bottomModifiers;
    const buildingCount = this.getBuildingCount(team);
    const required = this.getXPRequired(level);
    const y = team === 'blue' ? 50 : this.canvas.height - 58;
    const barWidth = this.canvas.width - 40;
    const barHeight = 8;

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(20, y, barWidth, barHeight);

    // XP progress
    const progress = xp / required;
    ctx.fillStyle = team === 'blue' ? '#4a90d9' : '#d94a4a';
    ctx.fillRect(20, y, barWidth * progress, barHeight);

    // Border
    ctx.strokeStyle = '#666';
    ctx.lineWidth = 1;
    ctx.strokeRect(20, y, barWidth, barHeight);

    // Level & building count text
    ctx.fillStyle = '#fff';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Lv ${level} | Cap: ${buildingCount}`, this.canvas.width / 2, y + 7);

    // Draw ability icons on the right side
    const abilities: { has: boolean; color: string; label: string }[] = [
      { has: modifiers.archerFanAbility, color: '#22c55e', label: 'A' },
      { has: modifiers.swordsmanSweepAbility, color: '#3b82f6', label: 'S' },
      { has: modifiers.knightTauntAbility, color: '#f59e0b', label: 'K' },
      { has: modifiers.mageVoidEruptionAbility, color: '#7c3aed', label: 'M' },
    ];

    let iconX = this.canvas.width - 30;
    const iconY = y + 4;
    const iconSize = 12;

    for (const ability of abilities) {
      if (ability.has) {
        // Draw ability icon background
        ctx.fillStyle = ability.color;
        ctx.beginPath();
        ctx.arc(iconX, iconY, iconSize / 2, 0, Math.PI * 2);
        ctx.fill();

        // Draw ability letter
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 8px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ability.label, iconX, iconY);

        iconX -= iconSize + 4;
      }
    }
    ctx.textBaseline = 'alphabetic'; // Reset
  }

  private clear(): void {
    const ctx = this.ctx;

    // Draw background image if loaded, otherwise fallback to solid color
    if (this.backgroundImage && this.backgroundImage.complete) {
      ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
    } else {
      // Fallback to solid green while image loads
      ctx.fillStyle = '#228B22';
      ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    // Draw base areas (dirt paths near towers)
    ctx.fillStyle = '#8B7355';
    ctx.fillRect(this.canvas.width / 2 - 60, 40, 120, 60); // Top base area
    ctx.fillRect(this.canvas.width / 2 - 60, this.canvas.height - 100, 120, 60); // Bottom base area
  }
}

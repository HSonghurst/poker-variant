import { TEAM_COLORS, type Team, type Position, type FighterType } from './types';
import type { TeamModifiers } from './Card';
import { DamageNumberManager } from './DamageNumber';
import { SoundManager } from './SoundManager';
import { DPSTracker } from './DPSTracker';
import type { UnitType, DamageType } from './DPSTracker';
import { SlotManager, AttackState, findEnemyInRange } from './AttackSlotSystem';

export interface StatusEffects {
  burning: number;
  poison: number;
  frozen: number;
  frozenUntil: number;
  void: number;
  death: number;
}

export abstract class Fighter {
  // Global aggro range multiplier - increases over time during battle
  private static aggroRangeMultiplier: number = 1.0;
  private static readonly BASE_AGGRO_RANGE: number = 121;

  static getAggroRange(): number {
    return Fighter.BASE_AGGRO_RANGE * Fighter.aggroRangeMultiplier;
  }

  static increaseAggroRange(multiplier: number): void {
    Fighter.aggroRangeMultiplier *= multiplier;
  }

  static resetAggroRange(): void {
    Fighter.aggroRangeMultiplier = 1.0;
  }

  x: number;
  y: number;
  team: Team;
  health: number;
  maxHealth: number;
  baseSpeed: number;
  speed: number;
  baseDamage: number;
  damage: number;
  baseAttackRange: number;
  attackRange: number;
  baseAttackCooldown: number;
  attackCooldown: number;
  lastAttackTime: number = 0;
  width: number = 4;
  height: number = 5;
  isDead: boolean = false;
  isBoss: boolean = false;
  target: Fighter | null = null;
  modifiers: TeamModifiers | null = null;
  taunter: Fighter | null = null; // Used by Knight's taunt ability
  lastAttackerTeam: Team | null = null; // Track who last damaged this unit
  lastAttackerType: FighterType | null = null; // Track what type of unit last damaged this
  damageFlashUntil: number = 0; // Timestamp when damage flash ends
  focusedEnemyTeam: Team | null = null; // Team this unit's group is focusing on

  // Group movement - units maintain positions relative to group center
  groupMembers: Fighter[] = [];
  groupOffsetX: number = 0; // Offset from group center
  groupOffsetY: number = 0;

  // Arena center for movement (set by BattleArena)
  arenaCenterX: number = 600;
  arenaCenterY: number = 400;

  // Attack slot system state
  attackState: AttackState = AttackState.IDLE;
  private waitingStartTime: number = 0;

  statusEffects: StatusEffects = {
    burning: 0,
    poison: 0,
    frozen: 0,
    frozenUntil: 0,
    void: 0,
    death: 0
  };

  private lastStatusTick: number = 0;

  protected animationFrame: number = 0;
  protected animationTimer: number = 0;

  constructor(team: Team, x: number, canvasHeight: number) {
    this.team = team;
    this.x = x;
    // Default Y position (will be overridden in BattleArena)
    this.y = canvasHeight / 2;
    this.health = 80;
    this.maxHealth = 80;
    this.baseSpeed = 1.4;
    this.speed = 1.4;
    this.baseDamage = 5;
    this.damage = 5;
    this.baseAttackRange = 40;
    this.attackRange = 40;
    this.baseAttackCooldown = 1000;
    this.attackCooldown = 1000;
  }

  abstract getColor(): string;
  abstract getType(): FighterType;

  applyModifiers(modifiers: TeamModifiers): void {
    this.modifiers = modifiers;
    const type = this.getType();
    if (modifiers.archerFanAbility || modifiers.swordsmanSweepAbility) {
      console.log(`[Fighter] ${type} received modifiers:`, {
        archerFanAbility: modifiers.archerFanAbility,
        swordsmanSweepAbility: modifiers.swordsmanSweepAbility
      });
    }

    // Apply health multiplier
    const healthMult = modifiers.getHealthMultiplier(type);
    this.maxHealth = Math.round(this.maxHealth * healthMult);
    this.health = this.maxHealth;

    // Apply damage multiplier
    this.damage = Math.round(this.baseDamage * modifiers.getDamageMultiplier(type));

    // Apply range multiplier
    this.attackRange = Math.round(this.baseAttackRange * modifiers.getRangeMultiplier(type));

    // Apply speed multiplier
    this.speed = this.baseSpeed * modifiers.speedMultiplier;

    // Apply attack speed multiplier (higher = faster, so divide cooldown)
    this.attackCooldown = this.baseAttackCooldown / modifiers.attackSpeedMultiplier;
  }

  // Store nearby units for pathfinding
  private nearbyAllies: Fighter[] = [];
  private nearbyEnemies: Fighter[] = [];

  update(enemies: Fighter[], deltaTime: number, allies?: Fighter[], skipTargetFind: boolean = false): void {
    if (this.isDead) {
      // Release any slot we had when we die
      SlotManager.releaseSlot(this);
      return;
    }

    // Store references for pathfinding
    this.nearbyEnemies = enemies;
    this.nearbyAllies = allies || [];

    // Process status effects
    this.processStatusEffects(deltaTime);

    // Check if frozen
    if (Date.now() < this.statusEffects.frozenUntil) {
      return; // Can't act while frozen
    }

    // Regeneration from modifiers (base 2 HP/sec * multiplier)
    if (this.modifiers && this.modifiers.regenMultiplier > 1) {
      const baseRegen = 2;
      const regenPerFrame = (baseRegen * this.modifiers.regenMultiplier * deltaTime) / 1000;
      this.health = Math.min(this.maxHealth, this.health + regenPerFrame);
    }

    this.animationTimer += deltaTime;
    if (this.animationTimer > 150) {
      this.animationFrame = (this.animationFrame + 1) % 4;
      this.animationTimer = 0;
    }

    // Skip target finding if already done in batch (BattleArena pre-finds targets)
    if (!skipTargetFind) {
      this.findTarget(enemies);
    }

    // No target - idle state, move forward
    if (!this.target || this.target.isDead) {
      this.attackState = AttackState.IDLE;
      SlotManager.releaseSlot(this);
      this.moveForward();
      return;
    }

    // We have a target - use slot-based positioning
    // Slots are pre-assigned by greedy FCFS algorithm in BattleArena
    // (closest units to target pick their closest slot first)
    let assignment = SlotManager.getAssignment(this);

    // Check if assignment is for wrong target (target changed)
    if (assignment && assignment.targetFighter !== this.target) {
      SlotManager.releaseSlot(this);
      assignment = null;
    }

    if (assignment) {
      // We have a valid slot assignment
      const slotDist = Math.sqrt(
        Math.pow(assignment.slot.x - this.x, 2) +
        Math.pow(assignment.slot.y - this.y, 2)
      );

      const distToTarget = this.getDistanceTo(this.target);

      if (distToTarget <= this.attackRange) {
        // Close enough to attack
        this.attackState = AttackState.ATTACKING;
        SlotManager.occupySlot(this);
        this.attack(this.target, enemies);
        this.applySeparation();
      } else if (slotDist > 3) {
        // Need to move to our slot
        this.attackState = AttackState.MOVING_TO_SLOT;
        this.moveToSlot(assignment.slot);
      } else {
        // At slot but not in attack range (target moved) - update slots and follow
        SlotManager.updateSlotPositions(this.target, this.attackRange);
        this.attackState = AttackState.MOVING_TO_SLOT;
        this.moveToSlot(assignment.slot);
      }
    } else {
      // No slot available - try to get one while we wait
      const allUnits = [...this.nearbyAllies, ...this.nearbyEnemies];
      const slot = SlotManager.findBestSlot(this, this.target, allUnits);
      if (slot) {
        SlotManager.reserveSlot(this, slot, this.target, false);
        assignment = SlotManager.getAssignment(this);
      } else {
        // Try queue slot as fallback
        const queueSlots = SlotManager.getOrCreateQueueSlots(this.target, this.attackRange);
        for (const qSlot of queueSlots) {
          if (SlotManager.reserveSlot(this, qSlot, this.target, true)) {
            assignment = SlotManager.getAssignment(this);
            break;
          }
        }
      }

      // If we got a slot, use it
      if (assignment) {
        this.attackState = AttackState.MOVING_TO_SLOT;
        this.moveToSlot(assignment.slot);
      } else {
        // Still no slot - try opportunistic attack or wait
        const opportunisticTarget = findEnemyInRange(this, enemies);

        if (opportunisticTarget) {
          // Attack any enemy in range
          this.attackState = AttackState.OPPORTUNISTIC;
          this.attack(opportunisticTarget, enemies);
          this.applySeparation();
        } else {
          // No enemies in range, wait then move
          const wasWaiting = this.attackState === AttackState.WAITING;
          this.attackState = AttackState.WAITING;

          if (!wasWaiting) {
            // Just started waiting - record the time
            this.waitingStartTime = Date.now();
          }

          const waitDuration = Date.now() - this.waitingStartTime;
          if (waitDuration >= 2000) {
            // Waited long enough, move towards the fight
            this.moveForward();
          }
          // Otherwise stay in place
        }
      }
    }
  }

  private processStatusEffects(_deltaTime: number): void {
    const now = Date.now();
    if (now - this.lastStatusTick < 1000) return;
    this.lastStatusTick = now;

    // Burn damage (orange)
    if (this.statusEffects.burning > 0) {
      const burnDamage = this.statusEffects.burning;
      this.health -= burnDamage;
      DamageNumberManager.spawn(this.x, this.y - 10, burnDamage, '#ff6600');
      DPSTracker.recordDamage('swordsman', 'fire', burnDamage);
      this.statusEffects.burning = Math.max(0, this.statusEffects.burning - 1);
    }

    // Poison damage (green)
    if (this.statusEffects.poison > 0) {
      const poisonDamage = this.statusEffects.poison;
      this.health -= poisonDamage;
      DamageNumberManager.spawn(this.x, this.y - 10, poisonDamage, '#22c55e');
      DPSTracker.recordDamage('archer', 'poison', poisonDamage);
      this.statusEffects.poison = Math.max(0, this.statusEffects.poison - 0.5);
    }

    // Void damage (purple)
    if (this.statusEffects.void > 0) {
      const voidDamage = this.statusEffects.void;
      this.health -= voidDamage;
      DamageNumberManager.spawn(this.x, this.y - 10, voidDamage, '#a855f7');
      DPSTracker.recordDamage('mage', 'void', voidDamage);
      this.statusEffects.void = Math.max(0, this.statusEffects.void - 1.2);
    }

    // Death damage (white/gray) - 1 DPS, stacks represent seconds remaining
    if (this.statusEffects.death > 0) {
      const deathDamage = 1;
      this.health -= deathDamage;
      DamageNumberManager.spawn(this.x, this.y - 10, deathDamage, '#e5e5e5');
      DPSTracker.recordDamage('wraith', 'death', deathDamage);
      this.statusEffects.death = Math.max(0, this.statusEffects.death - 1);
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
    }
  }

  findTarget(enemies: Fighter[]): void {
    // If we have a taunter that's still alive, we must attack them
    if (this.taunter && !this.taunter.isDead) {
      this.target = this.taunter;
      return;
    }
    this.taunter = null; // Clear dead taunter

    const aliveEnemies = enemies.filter(e => !e.isDead);
    if (aliveEnemies.length === 0) {
      this.target = null;
      return;
    }

    // Aggro range - only target enemies within this distance (increases over time)
    const aggroRange = Fighter.getAggroRange();

    // Simple targeting: find the closest enemy within aggro range
    let closest: Fighter | null = null;
    let closestDist = Infinity;

    for (const enemy of aliveEnemies) {
      const dist = this.getDistanceTo(enemy);
      if (dist <= aggroRange && dist < closestDist) {
        closest = enemy;
        closestDist = dist;
      }
    }

    this.target = closest;
    this.focusedEnemyTeam = closest?.team || null;
  }

  protected getDistanceTo(other: Fighter): number {
    const dx = other.x - this.x;
    const dy = other.y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  protected moveTowards(target: Fighter): void {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      this.x += (dx / distance) * this.speed;
      this.y += (dy / distance) * this.speed;
    }
  }

  // Get the center position of this unit's group
  protected getGroupCenter(): { x: number; y: number } {
    if (this.groupMembers.length === 0) {
      return { x: this.x, y: this.y };
    }

    let sumX = 0;
    let sumY = 0;
    let count = 0;

    for (const member of this.groupMembers) {
      if (!member.isDead) {
        sumX += member.x;
        sumY += member.y;
        count++;
      }
    }

    if (count === 0) return { x: this.x, y: this.y };
    return { x: sumX / count, y: sumY / count };
  }

  // No-op - separation removed, relying on slot system for positioning
  protected applySeparation(): void {
    // Just clamp to arena bounds
    const maxDist = 540;
    const dx = this.x - this.arenaCenterX;
    const dy = this.y - this.arenaCenterY;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > maxDist) {
      this.x = this.arenaCenterX + (dx / d) * maxDist;
      this.y = this.arenaCenterY + (dy / d) * maxDist;
    }
  }

  // Move to a firing position around the target, spread out based on groupOffset
  protected moveTowardsFiringPosition(target: Fighter): void {
    // Direction from target to this unit (our approach angle)
    const fromTargetX = this.x - target.x;
    const fromTargetY = this.y - target.y;
    const fromTargetDist = Math.sqrt(fromTargetX * fromTargetX + fromTargetY * fromTargetY);

    if (fromTargetDist === 0) return;

    // Normalize approach direction
    const approachX = fromTargetX / fromTargetDist;
    const approachY = fromTargetY / fromTargetDist;

    // Perpendicular direction for spreading out
    const perpX = -approachY;
    const perpY = approachX;

    // Calculate firing position: at attack range, offset by groupOffsetX to spread out
    const firingDist = this.attackRange * 0.85; // Stay slightly inside attack range
    const spreadOffset = this.groupOffsetX * 1.5; // Spread based on formation position

    const firingPosX = target.x + approachX * firingDist + perpX * spreadOffset;
    const firingPosY = target.y + approachY * firingDist + perpY * spreadOffset;

    // Now path to the firing position with obstacle avoidance
    const toFiringX = firingPosX - this.x;
    const toFiringY = firingPosY - this.y;
    const toFiringDist = Math.sqrt(toFiringX * toFiringX + toFiringY * toFiringY);

    if (toFiringDist < 2) {
      // Close enough to firing position, just apply separation
      this.applySeparation();
      return;
    }

    // Desired direction to firing position
    const desiredX = toFiringX / toFiringDist;
    const desiredY = toFiringY / toFiringDist;

    // Predictive obstacle avoidance
    const lookAhead = 25;
    const avoidRadius = 12;
    let avoidX = 0;
    let avoidY = 0;

    const allUnits = [...this.nearbyAllies, ...this.nearbyEnemies];

    for (const other of allUnits) {
      if (other === this || other.isDead || other === target) continue;

      const toOtherX = other.x - this.x;
      const toOtherY = other.y - this.y;
      const toOtherDist = Math.sqrt(toOtherX * toOtherX + toOtherY * toOtherY);

      if (toOtherDist > lookAhead || toOtherDist < 0.1) continue;

      const dotAhead = toOtherX * desiredX + toOtherY * desiredY;
      if (dotAhead < 0) continue;

      const perpDist = Math.abs(toOtherX * (-desiredY) + toOtherY * desiredX);

      if (perpDist < avoidRadius) {
        const perpAvoidX = -desiredY;
        const perpAvoidY = desiredX;
        const side = toOtherX * perpAvoidX + toOtherY * perpAvoidY;
        const strength = (1 - toOtherDist / lookAhead) * (1 - perpDist / avoidRadius);

        if (side > 0) {
          avoidX -= perpAvoidX * strength;
          avoidY -= perpAvoidY * strength;
        } else {
          avoidX += perpAvoidX * strength;
          avoidY += perpAvoidY * strength;
        }
      }
    }

    let moveX = desiredX * 0.7 + avoidX * 1.2;
    let moveY = desiredY * 0.7 + avoidY * 1.2;

    // Boundary avoidance
    const boundaryRadius = 500;
    const bx = this.x - this.arenaCenterX;
    const by = this.y - this.arenaCenterY;
    const distFromCenter = Math.sqrt(bx * bx + by * by);

    if (distFromCenter > boundaryRadius && distFromCenter > 0) {
      const overshoot = distFromCenter - boundaryRadius;
      const force = Math.min(overshoot / 50, 3);
      moveX += (-bx / distFromCenter) * force;
      moveY += (-by / distFromCenter) * force;
    }

    // Normalize and move
    const moveMag = Math.sqrt(moveX * moveX + moveY * moveY);
    if (moveMag > 0) {
      this.x += (moveX / moveMag) * this.speed;
      this.y += (moveY / moveMag) * this.speed;
    }

    // Hard clamp
    const maxDist = 540;
    const clampDx = this.x - this.arenaCenterX;
    const clampDy = this.y - this.arenaCenterY;
    const clampD = Math.sqrt(clampDx * clampDx + clampDy * clampDy);
    if (clampD > maxDist) {
      this.x = this.arenaCenterX + (clampDx / clampD) * maxDist;
      this.y = this.arenaCenterY + (clampDy / clampD) * maxDist;
    }
  }

  // Move to an attack slot position with obstacle avoidance
  protected moveToSlot(slot: { x: number; y: number }): void {
    this.moveToPosition(slot.x, slot.y);
  }

  // Move to a specific position with obstacle avoidance
  protected moveToPosition(targetX: number, targetY: number): void {
    const toTargetX = targetX - this.x;
    const toTargetY = targetY - this.y;
    const toTargetDist = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);

    if (toTargetDist < 2) {
      // Close enough, just apply separation
      this.applySeparation();
      return;
    }

    // Desired direction
    const desiredX = toTargetX / toTargetDist;
    const desiredY = toTargetY / toTargetDist;

    // Predictive obstacle avoidance
    const lookAhead = 25;
    const avoidRadius = 12;
    let avoidX = 0;
    let avoidY = 0;

    const allUnits = [...this.nearbyAllies, ...this.nearbyEnemies];

    for (const other of allUnits) {
      if (other === this || other.isDead) continue;

      const toOtherX = other.x - this.x;
      const toOtherY = other.y - this.y;
      const toOtherDist = Math.sqrt(toOtherX * toOtherX + toOtherY * toOtherY);

      if (toOtherDist > lookAhead || toOtherDist < 0.1) continue;

      const dotAhead = toOtherX * desiredX + toOtherY * desiredY;
      if (dotAhead < 0) continue;

      const perpDist = Math.abs(toOtherX * (-desiredY) + toOtherY * desiredX);

      if (perpDist < avoidRadius) {
        const perpAvoidX = -desiredY;
        const perpAvoidY = desiredX;
        const side = toOtherX * perpAvoidX + toOtherY * perpAvoidY;
        const strength = (1 - toOtherDist / lookAhead) * (1 - perpDist / avoidRadius);

        if (side > 0) {
          avoidX -= perpAvoidX * strength;
          avoidY -= perpAvoidY * strength;
        } else {
          avoidX += perpAvoidX * strength;
          avoidY += perpAvoidY * strength;
        }
      }
    }

    let moveX = desiredX * 0.7 + avoidX * 1.2;
    let moveY = desiredY * 0.7 + avoidY * 1.2;

    // Boundary avoidance
    const boundaryRadius = 500;
    const bx = this.x - this.arenaCenterX;
    const by = this.y - this.arenaCenterY;
    const distFromCenter = Math.sqrt(bx * bx + by * by);

    if (distFromCenter > boundaryRadius && distFromCenter > 0) {
      const overshoot = distFromCenter - boundaryRadius;
      const force = Math.min(overshoot / 50, 3);
      moveX += (-bx / distFromCenter) * force;
      moveY += (-by / distFromCenter) * force;
    }

    // Normalize and move
    const moveMag = Math.sqrt(moveX * moveX + moveY * moveY);
    if (moveMag > 0) {
      this.x += (moveX / moveMag) * this.speed;
      this.y += (moveY / moveMag) * this.speed;
    }

    // Hard clamp
    const maxDist = 540;
    const clampDx = this.x - this.arenaCenterX;
    const clampDy = this.y - this.arenaCenterY;
    const clampD = Math.sqrt(clampDx * clampDx + clampDy * clampDy);
    if (clampD > maxDist) {
      this.x = this.arenaCenterX + (clampDx / clampD) * maxDist;
      this.y = this.arenaCenterY + (clampDy / clampD) * maxDist;
    }
  }

  protected moveTowardsWithAvoidance(target: Fighter): void {
    const toTargetX = target.x - this.x;
    const toTargetY = target.y - this.y;
    const toTargetDist = Math.sqrt(toTargetX * toTargetX + toTargetY * toTargetY);

    if (toTargetDist === 0) return;

    // Desired direction towards target
    const desiredX = toTargetX / toTargetDist;
    const desiredY = toTargetY / toTargetDist;

    // Predictive obstacle avoidance - look ahead and steer around units
    const lookAhead = 30; // How far ahead to check
    const avoidRadius = 15; // How wide to check
    let avoidX = 0;
    let avoidY = 0;

    const allUnits = [...this.nearbyAllies, ...this.nearbyEnemies];

    for (const other of allUnits) {
      if (other === this || other.isDead || other === target) continue;

      // Vector to the other unit
      const toOtherX = other.x - this.x;
      const toOtherY = other.y - this.y;
      const toOtherDist = Math.sqrt(toOtherX * toOtherX + toOtherY * toOtherY);

      if (toOtherDist > lookAhead || toOtherDist < 0.1) continue;

      // Check if other unit is ahead of us (dot product > 0)
      const dotAhead = toOtherX * desiredX + toOtherY * desiredY;
      if (dotAhead < 0) continue; // Behind us, ignore

      // Perpendicular distance from our path to the other unit
      const perpDist = Math.abs(toOtherX * (-desiredY) + toOtherY * desiredX);

      if (perpDist < avoidRadius) {
        // Unit is in our path - steer around it
        // Determine which side to steer (perpendicular to desired direction)
        const perpX = -desiredY;
        const perpY = desiredX;

        // Check which side the obstacle is on
        const side = toOtherX * perpX + toOtherY * perpY;

        // Steer to opposite side, stronger when closer
        const strength = (1 - toOtherDist / lookAhead) * (1 - perpDist / avoidRadius);
        if (side > 0) {
          avoidX -= perpX * strength;
          avoidY -= perpY * strength;
        } else {
          avoidX += perpX * strength;
          avoidY += perpY * strength;
        }
      }
    }

    // Combine desired direction with avoidance
    let moveX = desiredX * 0.7 + avoidX * 1.5;
    let moveY = desiredY * 0.7 + avoidY * 1.5;

    // Boundary avoidance
    const boundaryRadius = 500;
    const bx = this.x - this.arenaCenterX;
    const by = this.y - this.arenaCenterY;
    const distFromCenter = Math.sqrt(bx * bx + by * by);

    if (distFromCenter > boundaryRadius && distFromCenter > 0) {
      const overshoot = distFromCenter - boundaryRadius;
      const force = Math.min(overshoot / 50, 3);
      moveX += (-bx / distFromCenter) * force;
      moveY += (-by / distFromCenter) * force;
    }

    // Normalize and move
    const moveMag = Math.sqrt(moveX * moveX + moveY * moveY);
    if (moveMag > 0) {
      this.x += (moveX / moveMag) * this.speed;
      this.y += (moveY / moveMag) * this.speed;
    }

    // Hard clamp to arena bounds
    const maxDist = 540;
    const dx = this.x - this.arenaCenterX;
    const dy = this.y - this.arenaCenterY;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > maxDist) {
      this.x = this.arenaCenterX + (dx / d) * maxDist;
      this.y = this.arenaCenterY + (dy / d) * maxDist;
    }
  }

  protected moveForward(): void {
    // Move towards arena center
    const toCenterX = this.arenaCenterX - this.x;
    const toCenterY = this.arenaCenterY - this.y;
    const toCenterDist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);

    if (toCenterDist <= 1) return;

    const moveX = toCenterX / toCenterDist;
    const moveY = toCenterY / toCenterDist;

    this.x += moveX * this.speed;
    this.y += moveY * this.speed;

    // Hard clamp to arena bounds
    const maxDist = 540;
    const dx = this.x - this.arenaCenterX;
    const dy = this.y - this.arenaCenterY;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > maxDist) {
      this.x = this.arenaCenterX + (dx / d) * maxDist;
      this.y = this.arenaCenterY + (dy / d) * maxDist;
    }
  }

  // Helper method for subclasses to deal damage with crits and status effects
  protected dealDamage(target: Fighter, baseDamage: number, allEnemies?: Fighter[]): void {
    let finalDamage = baseDamage;
    let isCrit = false;

    // Critical hit check (base 5% * multiplier)
    const baseCritChance = 0.05;
    const critMultiplier = this.modifiers?.critChance || 1;
    if (Math.random() < baseCritChance * critMultiplier) {
      finalDamage *= 2;
      isCrit = true;
    }

    target.takeDamage(finalDamage, this, isCrit);

    // Apply class-specific on-hit status effects
    if (this.modifiers) {
      const type = this.getType();

      // Swordsman: Fire on hit
      if (type === 'swordsman' && this.modifiers.swordsmanFireOnHit) {
        const baseBurn = 3;
        const fireMultiplier = this.modifiers.fireDoTMultiplier;
        target.statusEffects.burning += baseBurn * fireMultiplier;
      }

      // Knight: Frost (freeze chance) on hit
      if (type === 'knight' && this.modifiers.knightFrostOnHit) {
        const baseFreezeChance = 0.15;
        const frostMultiplier = this.modifiers.frostDurationMultiplier;
        if (Math.random() < baseFreezeChance) {
          const baseDuration = 1500;
          target.statusEffects.frozenUntil = Date.now() + baseDuration * frostMultiplier;
          SoundManager.playFreeze();
        }
      }

      // Lifesteal (multiplier - 1 = actual percentage, e.g., 1.2 = 20% lifesteal)
      if (this.modifiers.lifestealPercent > 1) {
        const lifestealPercent = this.modifiers.lifestealPercent - 1;
        const healAmount = finalDamage * lifestealPercent;
        this.health = Math.min(this.maxHealth, this.health + healAmount);
      }

      // Splash damage (base 20% * multiplier) - works for all units
      if (this.modifiers.splashMultiplier > 1 && allEnemies) {
        const baseSplash = 0.2;
        for (const enemy of allEnemies) {
          if (enemy === target || enemy.isDead) continue;
          const dx = target.x - enemy.x;
          const dy = target.y - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 14) {
            enemy.takeDamage(finalDamage * baseSplash * this.modifiers.splashMultiplier, this);
          }
        }
      }
    }
  }

  protected attack(target: Fighter, allEnemies?: Fighter[]): void {
    const now = Date.now();
    if (now - this.lastAttackTime >= this.attackCooldown) {
      this.dealDamage(target, this.damage, allEnemies);
      this.lastAttackTime = now;
    }
  }

  isFlashing(): boolean {
    return Date.now() < this.damageFlashUntil;
  }

  takeDamage(amount: number, attacker?: Fighter, isCrit: boolean = false, damageType: DamageType = 'physical'): void {
    this.health -= amount;

    // Trigger damage flash
    this.damageFlashUntil = Date.now() + 100;

    // Track who last damaged this unit (for kill credit)
    if (attacker) {
      this.lastAttackerTeam = attacker.team;
      this.lastAttackerType = attacker.getType();
    }

    // Record damage to DPS tracker
    if (attacker) {
      const unitType = this.mapFighterToUnitType(attacker);
      DPSTracker.recordDamage(unitType, damageType, amount);
    }

    // Play hit sound
    if (isCrit) {
      SoundManager.playCritical();
    } else {
      SoundManager.playHit();
    }

    // Spawn floating damage number (yellow for crit, white otherwise)
    const color = isCrit ? '#fbbf24' : '#ffffff';
    DamageNumberManager.spawn(this.x, this.y - 10, amount, color);

    // Thorns damage (base 5 dmg * multiplier)
    if (this.modifiers && this.modifiers.thornsMultiplier > 1 && attacker) {
      const baseThorns = 5;
      const thornsDamage = baseThorns * this.modifiers.thornsMultiplier;
      attacker.health -= thornsDamage;
      DamageNumberManager.spawn(attacker.x, attacker.y - 10, thornsDamage);
      if (attacker.health <= 0) {
        attacker.health = 0;
        attacker.isDead = true;
      }
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
      SoundManager.playDeath();
    }
  }

  private mapFighterToUnitType(fighter: Fighter): UnitType {
    const type = fighter.getType();
    if (fighter.isBoss) {
      // Check if it's a wraith or boss based on class name or type
      if (type === 'mage' && fighter.isBoss) return 'wraith';
      return 'boss';
    }
    return type as UnitType;
  }

  getPosition(): Position {
    return { x: this.x, y: this.y };
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.isDead) return;

    const bobOffset = Math.sin(this.animationFrame * Math.PI / 2) * 0.5;

    // Draw frozen effect
    if (Date.now() < this.statusEffects.frozenUntil) {
      ctx.fillStyle = 'rgba(135, 206, 235, 0.5)';
      ctx.fillRect(
        this.x - this.width / 2 - 1,
        this.y - this.height / 2 + bobOffset - 1,
        this.width + 2,
        this.height + 2
      );
    }

    // Draw unit as small colored square with team outline
    ctx.fillStyle = this.getColor();
    ctx.fillRect(
      this.x - this.width / 2,
      this.y - this.height / 2 + bobOffset,
      this.width,
      this.height
    );

    // Team color outline
    ctx.strokeStyle = TEAM_COLORS[this.team];
    ctx.lineWidth = 1;
    ctx.strokeRect(
      this.x - this.width / 2,
      this.y - this.height / 2 + bobOffset,
      this.width,
      this.height
    );

    // Draw burn effect (smaller)
    if (this.statusEffects.burning > 0) {
      ctx.fillStyle = 'rgba(255, 100, 0, 0.6)';
      ctx.beginPath();
      ctx.arc(this.x, this.y + bobOffset, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw poison effect (smaller)
    if (this.statusEffects.poison > 0) {
      ctx.fillStyle = 'rgba(100, 255, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(this.x, this.y + 2 + bobOffset, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw void effect (smaller)
    if (this.statusEffects.void > 0) {
      ctx.fillStyle = 'rgba(139, 92, 246, 0.5)';
      ctx.beginPath();
      ctx.arc(this.x, this.y - 1 + bobOffset, 5, 0, Math.PI * 2);
      ctx.fill();
    }

    this.drawHealthBar(ctx);
  }

  protected drawStatusEffects(ctx: CanvasRenderingContext2D): void {
    const bobOffset = Math.sin(this.animationFrame * Math.PI / 2) * 2;

    // Draw frozen effect
    if (Date.now() < this.statusEffects.frozenUntil) {
      ctx.fillStyle = 'rgba(135, 206, 235, 0.5)';
      ctx.fillRect(
        this.x - this.width / 2 - 3,
        this.y - this.height / 2 + bobOffset - 3,
        this.width + 6,
        this.height + 6
      );
    }

    // Draw burn effect
    if (this.statusEffects.burning > 0) {
      ctx.fillStyle = 'rgba(255, 100, 0, 0.6)';
      ctx.beginPath();
      ctx.arc(this.x, this.y + bobOffset, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw poison effect
    if (this.statusEffects.poison > 0) {
      ctx.fillStyle = 'rgba(100, 255, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(this.x, this.y + 5 + bobOffset, 10, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw void effect (purple)
    if (this.statusEffects.void > 0) {
      ctx.fillStyle = 'rgba(139, 92, 246, 0.5)';
      ctx.beginPath();
      ctx.arc(this.x, this.y - 3 + bobOffset, 11, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw death effect - tiny skull above head
    if (this.statusEffects.death > 0) {
      const skullX = this.x;
      const skullY = this.y - 22 + bobOffset;
      const pulse = 0.8 + Math.sin(Date.now() / 200) * 0.2;

      ctx.save();
      ctx.globalAlpha = pulse;

      // Skull (5x5 pixels, scaled down)
      ctx.fillStyle = '#e5e5e5';
      // Skull top
      ctx.fillRect(skullX - 2, skullY - 3, 4, 2);
      // Skull middle (wider)
      ctx.fillRect(skullX - 3, skullY - 1, 6, 2);
      // Skull bottom (jaw)
      ctx.fillRect(skullX - 2, skullY + 1, 4, 1);

      // Eye sockets (black)
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(skullX - 2, skullY - 1, 1, 1);
      ctx.fillRect(skullX + 1, skullY - 1, 1, 1);

      ctx.restore();
    }
  }

  protected drawHealthBar(ctx: CanvasRenderingContext2D): void {
    const barWidth = 6;
    const barHeight = 1;
    const barX = this.x - barWidth / 2;
    // Position above unit's sprite
    const barY = this.y - 8;

    // Background (dark)
    ctx.fillStyle = '#000';
    ctx.fillRect(barX - 1, barY - 1, barWidth + 2, barHeight + 2);

    // Empty bar (gray)
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Health fill (colored based on health %)
    const healthPercent = this.health / this.maxHealth;
    const healthColor = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillStyle = healthColor;
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);
  }
}

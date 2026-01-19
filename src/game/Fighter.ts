import type { Team, Position, FighterType } from './types';
import type { TeamModifiers } from './Card';
import { DamageNumberManager } from './DamageNumber';
import { SoundManager } from './SoundManager';
import { DPSTracker } from './DPSTracker';
import type { UnitType, DamageType } from './DPSTracker';

export interface StatusEffects {
  burning: number;
  poison: number;
  frozen: number;
  frozenUntil: number;
  void: number;
  death: number;
}

export abstract class Fighter {
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
  width: number = 7;
  height: number = 9;
  isDead: boolean = false;
  isBoss: boolean = false;
  target: Fighter | null = null;
  modifiers: TeamModifiers | null = null;
  taunter: Fighter | null = null; // Used by Knight's taunt ability

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
    this.y = team === 'top' ? 50 : canvasHeight - 90;
    this.health = 100;
    this.maxHealth = 100;
    this.baseSpeed = 1;
    this.speed = 1;
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

  update(enemies: Fighter[], deltaTime: number, _allies?: Fighter[]): void {
    if (this.isDead) return;

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

    this.findTarget(enemies);

    if (this.target && !this.target.isDead) {
      const distance = this.getDistanceTo(this.target);

      if (distance > this.attackRange) {
        this.moveTowards(this.target);
      } else {
        this.attack(this.target, enemies);
      }
    } else {
      this.moveForward();
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

  protected findTarget(enemies: Fighter[]): void {
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

    let closest = aliveEnemies[0];
    let closestDist = this.getDistanceTo(closest);

    for (const enemy of aliveEnemies) {
      const dist = this.getDistanceTo(enemy);
      if (dist < closestDist) {
        closest = enemy;
        closestDist = dist;
      }
    }

    this.target = closest;
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

  protected moveForward(): void {
    if (this.team === 'top') {
      this.y += this.speed;
    } else {
      this.y -= this.speed;
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

  takeDamage(amount: number, attacker?: Fighter, isCrit: boolean = false, damageType: DamageType = 'physical'): void {
    this.health -= amount;

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

    ctx.fillStyle = this.getColor();
    ctx.fillRect(
      this.x - this.width / 2,
      this.y - this.height / 2 + bobOffset,
      this.width,
      this.height
    );

    ctx.fillStyle = this.team === 'top' ? '#2563eb' : '#dc2626';
    ctx.beginPath();
    ctx.arc(this.x, this.y - this.height / 2 - 8 + bobOffset, 10, 0, Math.PI * 2);
    ctx.fill();

    // Draw burn effect
    if (this.statusEffects.burning > 0) {
      ctx.fillStyle = 'rgba(255, 100, 0, 0.6)';
      ctx.beginPath();
      ctx.arc(this.x, this.y + bobOffset, 20, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw poison effect
    if (this.statusEffects.poison > 0) {
      ctx.fillStyle = 'rgba(100, 255, 0, 0.4)';
      ctx.beginPath();
      ctx.arc(this.x, this.y + 10 + bobOffset, 15, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw void effect
    if (this.statusEffects.void > 0) {
      ctx.fillStyle = 'rgba(139, 92, 246, 0.5)';
      ctx.beginPath();
      ctx.arc(this.x, this.y - 5 + bobOffset, 18, 0, Math.PI * 2);
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
    const barWidth = 20;
    const barHeight = 3;
    const barX = this.x - barWidth / 2;
    const barY = this.y - 18;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const healthPercent = this.health / this.maxHealth;
    const healthColor = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillStyle = healthColor;
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }
}

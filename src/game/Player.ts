import type { Team, FighterType, Position } from './types';
import type { TeamModifiers } from './Card';
import type { Fighter } from './Fighter';
import { SpriteRenderer } from './SpriteRenderer';
import { DamageNumberManager } from './DamageNumber';
import { SoundManager } from './SoundManager';
import { PlayerArrow } from './PlayerArrow';

export type Direction = 'up' | 'down' | 'left' | 'right';

export class Player {
  x: number;
  y: number;
  team: Team;
  speed: number = 1.8;
  width: number = 45;
  height: number = 30;
  attractRadius: number = 80;
  collectRadius: number = 18;

  // Health
  health: number = 1000;
  maxHealth: number = 1000;
  isDead: boolean = false;

  // Combat
  baseDamage: number = 20;
  damage: number = 20;
  attackRange: number = 120;
  attackCooldown: number = 400;
  lastAttackTime: number = 0;
  arrows: PlayerArrow[] = [];
  private target: Fighter | null = null;

  // Modifiers from cards
  modifiers: TeamModifiers | null = null;

  // Status effects (for compatibility with Fighter targeting)
  statusEffects = {
    burning: 0,
    poison: 0,
    frozen: 0,
    frozenUntil: 0,
    void: 0,
    death: 0
  };

  // Movement state
  private keys: Set<string> = new Set();
  private animationFrame: number = 0;
  private animationTimer: number = 0;
  private isMoving: boolean = false;
  private direction: Direction = 'down';
  private lastStatusTick: number = 0;

  constructor(team: Team, canvasWidth: number, canvasHeight: number) {
    this.team = team;
    this.x = canvasWidth / 2;
    // Position near the team's base
    this.y = team === 'top' ? 100 : canvasHeight - 140;
  }

  // Methods for Fighter targeting compatibility
  getType(): FighterType {
    return 'knight'; // Treated as a knight for targeting purposes
  }

  getPosition(): Position {
    return { x: this.x, y: this.y };
  }

  setModifiers(modifiers: TeamModifiers): void {
    this.modifiers = modifiers;
  }

  takeDamage(amount: number, attacker?: { health: number; isDead: boolean; x: number; y: number }, isCrit: boolean = false): void {
    if (this.isDead) return;

    this.health -= amount;

    // Play hit sound
    if (isCrit) {
      SoundManager.playCritical();
    } else {
      SoundManager.playHit();
    }

    // Spawn floating damage number
    const color = isCrit ? '#fbbf24' : '#ffffff';
    DamageNumberManager.spawn(this.x, this.y - 20, amount, color);

    // Thorns damage (base 5 dmg * multiplier)
    if (this.modifiers && this.modifiers.thornsMultiplier > 1 && attacker) {
      const baseThorns = 5;
      const thornsDamage = baseThorns * this.modifiers.thornsMultiplier;
      attacker.health -= thornsDamage;
      DamageNumberManager.spawn(attacker.x, attacker.y - 10, thornsDamage, '#10b981');
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

  handleKeyDown(key: string): void {
    this.keys.add(key.toLowerCase());
  }

  handleKeyUp(key: string): void {
    this.keys.delete(key.toLowerCase());
  }

  update(deltaTime: number, canvasWidth: number, canvasHeight: number, enemies?: Fighter[]): void {
    if (this.isDead) return;

    // Update arrows
    for (const arrow of this.arrows) {
      arrow.update();
    }
    this.arrows = this.arrows.filter(arrow => !arrow.isDead);

    // Process status effects (burn, poison)
    this.processStatusEffects();

    // Check if frozen
    if (Date.now() < this.statusEffects.frozenUntil) {
      return; // Can't move while frozen
    }

    // Regeneration from modifiers (base 2 HP/sec * multiplier)
    if (this.modifiers && this.modifiers.regenMultiplier > 1) {
      const baseRegen = 2;
      const regenPerFrame = (baseRegen * this.modifiers.regenMultiplier * deltaTime) / 1000;
      this.health = Math.min(this.maxHealth, this.health + regenPerFrame);
    }

    // Find target and attack
    if (enemies) {
      this.findTarget(enemies);
      if (this.target && !this.target.isDead) {
        this.tryAttack();
      }
    }

    const moveSpeed = this.speed * (deltaTime / 16); // Normalize to ~60fps

    let dx = 0;
    let dy = 0;

    if (this.keys.has('w') || this.keys.has('arrowup')) dy -= 1;
    if (this.keys.has('s') || this.keys.has('arrowdown')) dy += 1;
    if (this.keys.has('a') || this.keys.has('arrowleft')) dx -= 1;
    if (this.keys.has('d') || this.keys.has('arrowright')) dx += 1;

    // Normalize diagonal movement
    if (dx !== 0 && dy !== 0) {
      const factor = 1 / Math.sqrt(2);
      dx *= factor;
      dy *= factor;
    }

    this.isMoving = dx !== 0 || dy !== 0;

    // Update direction based on movement (prioritize horizontal for diagonal)
    if (dx < 0) this.direction = 'left';
    else if (dx > 0) this.direction = 'right';
    else if (dy < 0) this.direction = 'up';
    else if (dy > 0) this.direction = 'down';

    // Apply speed modifier
    let finalSpeed = moveSpeed;
    if (this.modifiers && this.modifiers.speedMultiplier > 1) {
      finalSpeed *= this.modifiers.speedMultiplier;
    }

    this.x += dx * finalSpeed;
    this.y += dy * finalSpeed;

    // Keep within canvas bounds
    const margin = 30;
    this.x = Math.max(margin, Math.min(canvasWidth - margin, this.x));
    this.y = Math.max(margin, Math.min(canvasHeight - margin, this.y));

    // Update animation
    if (this.isMoving) {
      this.animationTimer += deltaTime;
      if (this.animationTimer > 100) {
        this.animationFrame = (this.animationFrame + 1) % 4;
        this.animationTimer = 0;
      }
    }
  }

  private findTarget(enemies: Fighter[]): void {
    const aliveEnemies = enemies.filter(e => !e.isDead);
    if (aliveEnemies.length === 0) {
      this.target = null;
      return;
    }

    // Prefer bosses within range
    let closestBoss: Fighter | null = null;
    let closestBossDist = Infinity;
    let closest: Fighter | null = null;
    let closestDist = Infinity;

    for (const enemy of aliveEnemies) {
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= this.attackRange) {
        // Track closest boss
        if (enemy.isBoss && dist < closestBossDist) {
          closestBoss = enemy;
          closestBossDist = dist;
        }
        // Track closest enemy overall
        if (dist < closestDist) {
          closest = enemy;
          closestDist = dist;
        }
      }
    }

    // Prefer boss if one is in range, otherwise target closest enemy
    this.target = closestBoss || closest;
  }

  private tryAttack(): void {
    if (!this.target) return;

    const now = Date.now();
    if (now - this.lastAttackTime >= this.attackCooldown) {
      // Calculate damage with "all" damage multiplier (not archer-specific)
      let finalDamage = this.baseDamage;
      if (this.modifiers) {
        const allDamageMult = this.modifiers.damageMultiplier.get('all') || 1;
        finalDamage = Math.round(this.baseDamage * allDamageMult);
      }

      this.arrows.push(new PlayerArrow(this.x, this.y, this.target, finalDamage, this.team, this));
      SoundManager.playArrowShot();
      this.lastAttackTime = now;
    }
  }

  private processStatusEffects(): void {
    const now = Date.now();
    if (now - this.lastStatusTick < 1000) return;
    this.lastStatusTick = now;

    // Burn damage (orange)
    if (this.statusEffects.burning > 0) {
      const burnDamage = this.statusEffects.burning;
      this.health -= burnDamage;
      DamageNumberManager.spawn(this.x, this.y - 10, burnDamage, '#ff6600');
      this.statusEffects.burning = Math.max(0, this.statusEffects.burning - 1);
    }

    // Poison damage (green)
    if (this.statusEffects.poison > 0) {
      const poisonDamage = this.statusEffects.poison;
      this.health -= poisonDamage;
      DamageNumberManager.spawn(this.x, this.y - 10, poisonDamage, '#22c55e');
      this.statusEffects.poison = Math.max(0, this.statusEffects.poison - 0.5);
    }

    // Void damage (purple)
    if (this.statusEffects.void > 0) {
      const voidDamage = this.statusEffects.void;
      this.health -= voidDamage;
      DamageNumberManager.spawn(this.x, this.y - 10, voidDamage, '#a855f7');
      this.statusEffects.void = Math.max(0, this.statusEffects.void - 1.2);
    }

    // Death damage (white/gray)
    if (this.statusEffects.death > 0) {
      const deathDamage = this.statusEffects.death;
      this.health -= deathDamage;
      DamageNumberManager.spawn(this.x, this.y - 10, deathDamage, '#e5e5e5');
      this.statusEffects.death = Math.max(0, this.statusEffects.death - 1);
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
      SoundManager.playDeath();
    }
  }

  getDistanceTo(x: number, y: number): number {
    const dx = x - this.x;
    const dy = y - this.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Always draw arrows even if dead
    for (const arrow of this.arrows) {
      arrow.draw(ctx);
    }

    if (this.isDead) return;

    const color = this.team === 'top' ? '#4a90d9' : '#d94a4a';

    // Draw attract radius (subtle)
    ctx.strokeStyle = `${color}30`;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.attractRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw attack range indicator (even more subtle)
    ctx.strokeStyle = `${color}15`;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.attackRange, 0, Math.PI * 2);
    ctx.stroke();

    // Draw horseman sprite
    SpriteRenderer.drawHorseman(ctx, this.x, this.y, this.team, this.animationFrame, this.direction);

    // Draw status effects
    this.drawStatusEffects(ctx);

    // Draw health bar
    this.drawHealthBar(ctx);
  }

  private drawStatusEffects(ctx: CanvasRenderingContext2D): void {
    // Draw death effect - tiny skull above head
    if (this.statusEffects.death > 0) {
      const skullX = this.x;
      const skullY = this.y - 35;
      const pulse = 0.8 + Math.sin(Date.now() / 200) * 0.2;

      ctx.save();
      ctx.globalAlpha = pulse;

      // Skull (slightly larger for player)
      ctx.fillStyle = '#e5e5e5';
      // Skull top
      ctx.fillRect(skullX - 3, skullY - 4, 6, 3);
      // Skull middle (wider)
      ctx.fillRect(skullX - 4, skullY - 1, 8, 3);
      // Skull bottom (jaw)
      ctx.fillRect(skullX - 3, skullY + 2, 6, 2);

      // Eye sockets (black)
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(skullX - 2, skullY - 1, 2, 2);
      ctx.fillRect(skullX + 1, skullY - 1, 2, 2);

      ctx.restore();
    }
  }

  private drawHealthBar(ctx: CanvasRenderingContext2D): void {
    const barWidth = 40;
    const barHeight = 5;
    const barX = this.x - barWidth / 2;
    const barY = this.y - 28;

    // Background
    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Health fill
    const healthPercent = this.health / this.maxHealth;
    const healthColor = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillStyle = healthColor;
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    // Border
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);

    // Health text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 8px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(this.health)}`, this.x, barY - 2);
  }
}

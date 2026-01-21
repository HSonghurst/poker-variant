import { Fighter } from './Fighter';
import { Ghost } from './Ghost';
import { SpriteRenderer } from './SpriteRenderer';
import { SoundManager } from './SoundManager';
import { DamageNumberManager } from './DamageNumber';
import type { Team, FighterType } from './types';

export class Wraith extends Fighter {
  private attackAnimation: number = 0;
  private reapCooldown: number = 0;
  private readonly REAP_INTERVAL: number = 4000; // Soul reap every 4 seconds
  private ghostBurstCooldown: number = 0;
  private readonly GHOST_BURST_INTERVAL: number = 15000; // Ghost burst every 15 seconds
  ghosts: Ghost[] = [];

  constructor(team: Team, x: number, canvasHeight: number) {
    super(team, x, canvasHeight);
    this.health = 1500;
    this.maxHealth = 1500;
    this.baseSpeed = 0.5; // Faster than ogre
    this.speed = 0.5;
    this.baseDamage = 50; // Higher single target damage
    this.damage = 50;
    this.baseAttackRange = 40;
    this.attackRange = 40;
    this.baseAttackCooldown = 1000;
    this.attackCooldown = 1000;
    this.width = 20;
    this.height = 28;
    this.isBoss = true;

    // Position at the tower location
    this.y = team === 'blue' ? 70 : canvasHeight - 70;
  }

  getColor(): string {
    return this.team === 'blue' ? '#4b0082' : '#8b0000';
  }

  getType(): FighterType {
    return 'mage'; // Treated as mage for targeting
  }

  update(enemies: Fighter[], deltaTime: number, _allies?: Fighter[]): void {
    if (this.isDead) return;

    // Update ghosts
    for (const ghost of this.ghosts) {
      ghost.update(enemies);
    }
    this.ghosts = this.ghosts.filter(g => !g.isDead);

    // Process status effects
    this.processStatusEffectsPublic(deltaTime);

    // Check if frozen
    if (Date.now() < this.statusEffects.frozenUntil) {
      return;
    }

    // Wraith has slower regen but life steal
    const regenPerFrame = (2 * deltaTime) / 1000;
    this.health = Math.min(this.maxHealth, this.health + regenPerFrame);

    this.animationTimer += deltaTime;
    if (this.animationTimer > 150) { // Faster animation for ghostly effect
      this.animationFrame = (this.animationFrame + 1) % 4;
      this.animationTimer = 0;
    }

    // Soul reap cooldown
    this.reapCooldown -= deltaTime;
    if (this.reapCooldown <= 0 && enemies.length > 0) {
      this.soulReap(enemies);
      this.reapCooldown = this.REAP_INTERVAL;
    }

    // Ghost burst cooldown
    this.ghostBurstCooldown -= deltaTime;
    if (this.ghostBurstCooldown <= 0) {
      this.ghostBurst();
      this.ghostBurstCooldown = this.GHOST_BURST_INTERVAL;
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

    if (this.attackAnimation > 0) {
      this.attackAnimation--;
    }
  }

  private ghostBurst(): void {
    // Spawn 15 ghosts in a 360 degree circle
    const numGhosts = 15;
    const angleStep = (Math.PI * 2) / numGhosts;

    SoundManager.playFreeze();
    this.attackAnimation = 20;

    for (let i = 0; i < numGhosts; i++) {
      const angle = angleStep * i;
      this.ghosts.push(new Ghost(this.x, this.y, angle, this.damage, this.team, this));
    }
  }

  private processStatusEffectsPublic(_deltaTime: number): void {
    // Wraith takes reduced status effect damage
    const now = Date.now();
    const lastTick = (this as any).lastStatusTick || 0;
    if (now - lastTick < 1000) return;
    (this as any).lastStatusTick = now;

    if (this.statusEffects.burning > 0) {
      const burnDamage = Math.floor(this.statusEffects.burning * 0.5);
      this.health -= burnDamage;
      DamageNumberManager.spawn(this.x, this.y - 20, burnDamage, '#ff6600');
      this.statusEffects.burning = Math.max(0, this.statusEffects.burning - 1);
    }

    if (this.statusEffects.poison > 0) {
      const poisonDamage = Math.floor(this.statusEffects.poison * 0.5);
      this.health -= poisonDamage;
      DamageNumberManager.spawn(this.x, this.y - 20, poisonDamage, '#22c55e');
      this.statusEffects.poison = Math.max(0, this.statusEffects.poison - 0.5);
    }

    if (this.statusEffects.void > 0) {
      const voidDamage = Math.floor(this.statusEffects.void * 0.5);
      this.health -= voidDamage;
      DamageNumberManager.spawn(this.x, this.y - 20, voidDamage, '#a855f7');
      this.statusEffects.void = Math.max(0, this.statusEffects.void - 1.2);
    }

    if (this.statusEffects.death > 0) {
      const deathDamage = Math.floor(this.statusEffects.death * 0.5);
      this.health -= deathDamage;
      DamageNumberManager.spawn(this.x, this.y - 20, deathDamage, '#e5e5e5');
      this.statusEffects.death = Math.max(0, this.statusEffects.death - 1);
    }

    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
      SoundManager.playDeath();
    }
  }

  private soulReap(enemies: Fighter[]): void {
    SoundManager.playFireball();
    this.attackAnimation = 25;

    // Damage enemies in a cone and heal self
    const reapRadius = 60;
    const reapDamage = 35;
    let totalHealed = 0;

    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= reapRadius) {
        enemy.takeDamage(reapDamage, this);
        // Apply death DoT on soul reap (10 seconds) - skip structures
        if (!(enemy as any).isStructure) {
          enemy.statusEffects.death = Math.max(enemy.statusEffects.death, 10);
        }
        totalHealed += 15; // Heal per target hit
      }
    }

    // Heal wraith
    if (totalHealed > 0) {
      this.health = Math.min(this.maxHealth, this.health + totalHealed);
      DamageNumberManager.spawn(this.x, this.y - 30, totalHealed, '#22c55e');
    }
  }

  protected attack(target: Fighter, _allEnemies?: Fighter[]): void {
    const now = Date.now();
    if (now - this.lastAttackTime >= this.attackCooldown) {
      this.attackAnimation = 12;

      // Scythe attack with life steal
      const isCrit = Math.random() < 0.15; // 15% crit chance
      const damage = isCrit ? this.damage * 2 : this.damage;
      target.takeDamage(damage, this, isCrit);

      // Apply death DoT on melee (10 seconds) - skip structures
      if (!(target as any).isStructure) {
        target.statusEffects.death = Math.max(target.statusEffects.death, 10);
      }

      // Life steal on hit
      const lifeSteal = Math.floor(damage * 0.2);
      this.health = Math.min(this.maxHealth, this.health + lifeSteal);

      this.lastAttackTime = now;
    }
  }

  findTarget(enemies: Fighter[]): void {
    const aliveEnemies = enemies.filter(e => !e.isDead);
    if (aliveEnemies.length === 0) {
      this.target = null;
      return;
    }

    // Prioritize structures (towers) if in range
    let closestStructure: Fighter | null = null;
    let closestStructureDist = Infinity;
    let closest: Fighter | null = null;
    let closestDist = Infinity;

    for (const enemy of aliveEnemies) {
      const dist = this.getDistanceTo(enemy);

      // Track closest structure in range
      if ((enemy as any).isStructure && dist <= this.attackRange && dist < closestStructureDist) {
        closestStructure = enemy;
        closestStructureDist = dist;
      }

      // Track closest enemy overall
      if (dist < closestDist) {
        closest = enemy;
        closestDist = dist;
      }
    }

    // Prefer structure if one is in range, otherwise target closest enemy
    this.target = closestStructure || closest;
  }

  takeDamage(amount: number, attacker?: Fighter, isCrit: boolean = false): void {
    // Wraith takes slightly reduced damage (ethereal)
    const reducedAmount = Math.floor(amount * 0.85);
    super.takeDamage(reducedAmount, attacker, isCrit);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Draw ghosts
    for (const ghost of this.ghosts) {
      ghost.draw(ctx);
    }

    if (this.isDead) return;

    // Draw ghost burst indicator when about to burst
    if (this.ghostBurstCooldown < 1000 && this.ghostBurstCooldown > 0) {
      const warningAlpha = (1000 - this.ghostBurstCooldown) / 1000;
      ctx.strokeStyle = `rgba(255, 255, 255, ${warningAlpha * 0.6})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.arc(this.x, this.y, 30 + warningAlpha * 20, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw soul reap indicator when about to reap
    if (this.reapCooldown < 500 && this.reapCooldown > 0) {
      const warningAlpha = (500 - this.reapCooldown) / 500;
      ctx.fillStyle = `rgba(75, 0, 130, ${warningAlpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 60, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw reap shockwave
    if (this.attackAnimation > 15) {
      const progress = (25 - this.attackAnimation) / 10;
      const radius = 60 * progress;
      ctx.strokeStyle = `rgba(148, 0, 211, ${1 - progress})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    this.drawStatusEffects(ctx);
    SpriteRenderer.drawWraith(ctx, this.x, this.y, this.team, this.animationFrame);
    this.drawHealthBar(ctx);
  }

  protected drawHealthBar(ctx: CanvasRenderingContext2D): void {
    // Health bar for wraith
    const barWidth = 45;
    const barHeight = 5;
    const barX = this.x - barWidth / 2;
    const barY = this.y - 35;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const healthPercent = this.health / this.maxHealth;
    ctx.fillStyle = '#9333ea'; // Purple health bar
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }
}

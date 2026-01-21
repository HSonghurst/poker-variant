import { Fighter } from './Fighter';
import { SpriteRenderer } from './SpriteRenderer';
import { SoundManager } from './SoundManager';
import { DamageNumberManager } from './DamageNumber';
import type { Team, FighterType } from './types';

export class Boss extends Fighter {
  private attackAnimation: number = 0;
  private slamCooldown: number = 0;
  private readonly SLAM_INTERVAL: number = 5000; // Ground slam every 5 seconds
  private expungeCooldown: number = 0;
  private readonly EXPUNGE_INTERVAL: number = 10000; // Expunge every 10 seconds
  private expungeAnimation: number = 0;

  constructor(team: Team, x: number, canvasHeight: number) {
    super(team, x, canvasHeight);
    this.health = 2000;
    this.maxHealth = 2000;
    this.baseSpeed = 0.3;
    this.speed = 0.3;
    this.baseDamage = 40;
    this.damage = 40;
    this.baseAttackRange = 35;
    this.attackRange = 35;
    this.baseAttackCooldown = 1200;
    this.attackCooldown = 1200;
    this.width = 24;
    this.height = 32;
    this.isBoss = true;

    // Position at the tower location
    this.y = team === 'blue' ? 70 : canvasHeight - 70;
  }

  getColor(): string {
    return this.team === 'blue' ? '#1e40af' : '#991b1b';
  }

  getType(): FighterType {
    return 'knight'; // Treated as knight for targeting
  }

  update(enemies: Fighter[], deltaTime: number, _allies?: Fighter[]): void {
    if (this.isDead) return;

    // Process status effects
    this.processStatusEffectsPublic(deltaTime);

    // Check if frozen
    if (Date.now() < this.statusEffects.frozenUntil) {
      return;
    }

    // Regeneration (boss has built-in regen)
    const regenPerFrame = (5 * deltaTime) / 1000;
    this.health = Math.min(this.maxHealth, this.health + regenPerFrame);

    this.animationTimer += deltaTime;
    if (this.animationTimer > 200) {
      this.animationFrame = (this.animationFrame + 1) % 4;
      this.animationTimer = 0;
    }

    // Ground slam cooldown
    this.slamCooldown -= deltaTime;
    if (this.slamCooldown <= 0 && enemies.length > 0) {
      this.groundSlam(enemies);
      this.slamCooldown = this.SLAM_INTERVAL;
    }

    // Expunge cooldown - deal 500 damage to enemies with death DoT
    this.expungeCooldown -= deltaTime;
    if (this.expungeCooldown <= 0 && enemies.length > 0) {
      this.expunge(enemies);
      this.expungeCooldown = this.EXPUNGE_INTERVAL;
    }

    // Decay expunge animation
    if (this.expungeAnimation > 0) {
      this.expungeAnimation--;
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

  private processStatusEffectsPublic(_deltaTime: number): void {
    // Boss takes reduced status effect damage
    const now = Date.now();
    const lastTick = (this as any).lastStatusTick || 0;
    if (now - lastTick < 1000) return;
    (this as any).lastStatusTick = now;

    if (this.statusEffects.burning > 0) {
      const burnDamage = Math.floor(this.statusEffects.burning * 0.5); // 50% reduced
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

    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
      SoundManager.playDeath();
    }
  }

  private groundSlam(enemies: Fighter[]): void {
    SoundManager.playExplosion();
    this.attackAnimation = 30;

    // Damage all enemies in a large radius
    const slamRadius = 80;
    const slamDamage = 25;

    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= slamRadius) {
        enemy.takeDamage(slamDamage, this);
        // Knock back (skip structures like towers)
        if (!(enemy as any).isStructure) {
          const knockback = 20;
          const angle = Math.atan2(dy, dx);
          enemy.x += Math.cos(angle) * knockback;
          enemy.y += Math.sin(angle) * knockback;
        }
      }
    }
  }

  private expunge(enemies: Fighter[]): void {
    // Deal 500 damage to all enemies with death DoT (globally)
    SoundManager.playExplosion();
    this.expungeAnimation = 60; // Show skull for ~1 second

    let hitCount = 0;
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      if ((enemy as any).isStructure) continue; // Skip buildings
      if (enemy.statusEffects.death > 0) {
        enemy.takeDamage(500, this);
        DamageNumberManager.spawn(enemy.x, enemy.y - 30, 500, '#ffffff');
        hitCount++;
      }
    }

    // Heal boss for each target hit
    if (hitCount > 0) {
      const healAmount = hitCount * 50;
      this.health = Math.min(this.maxHealth, this.health + healAmount);
      DamageNumberManager.spawn(this.x, this.y - 50, healAmount, '#22c55e');
    }
  }

  protected attack(_target: Fighter, allEnemies?: Fighter[]): void {
    const now = Date.now();
    if (now - this.lastAttackTime >= this.attackCooldown) {
      this.attackAnimation = 15;

      // Boss cleave attack - hits multiple targets
      const cleaveRadius = 30;
      for (const enemy of allEnemies || []) {
        if (enemy.isDead) continue;
        const dx = enemy.x - this.x;
        const dy = enemy.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= this.attackRange + cleaveRadius) {
          const isCrit = Math.random() < 0.1; // 10% crit chance
          const damage = isCrit ? this.damage * 2 : this.damage;
          enemy.takeDamage(damage, this, isCrit);
        }
      }

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
    // Boss takes reduced damage
    const reducedAmount = Math.floor(amount * 0.8);
    super.takeDamage(reducedAmount, attacker, isCrit);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.isDead) return;

    // Draw ground slam indicator when about to slam
    if (this.slamCooldown < 500 && this.slamCooldown > 0) {
      const warningAlpha = (500 - this.slamCooldown) / 500;
      ctx.fillStyle = `rgba(255, 0, 0, ${warningAlpha * 0.3})`;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 80, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw slam shockwave
    if (this.attackAnimation > 20) {
      const progress = (30 - this.attackAnimation) / 10;
      const radius = 80 * progress;
      ctx.strokeStyle = `rgba(255, 100, 0, ${1 - progress})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw expunge skull above head
    if (this.expungeAnimation > 0) {
      const alpha = Math.min(1, this.expungeAnimation / 30);
      const scale = 1.5 + (60 - this.expungeAnimation) / 60 * 0.5; // Bigger skull, grows slightly
      const skullY = this.y - 60 - (60 - this.expungeAnimation) * 0.5; // Float up

      ctx.save();
      ctx.translate(this.x, skullY);
      ctx.scale(scale, scale);

      // Skull background glow (green for goblin)
      ctx.fillStyle = `rgba(100, 255, 100, ${alpha * 0.4})`;
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fill();

      // Skull shape
      ctx.fillStyle = `rgba(245, 245, 220, ${alpha})`; // Bone color

      // Skull top (cranium)
      ctx.beginPath();
      ctx.arc(0, -2, 14, Math.PI, 0, false);
      ctx.fill();

      // Skull face
      ctx.fillRect(-12, -4, 24, 16);

      // Jaw
      ctx.beginPath();
      ctx.moveTo(-10, 12);
      ctx.lineTo(-7, 17);
      ctx.lineTo(7, 17);
      ctx.lineTo(10, 12);
      ctx.closePath();
      ctx.fill();

      // Eye sockets (glowing green for goblin theme)
      ctx.fillStyle = `rgba(0, 255, 0, ${alpha})`;
      ctx.beginPath();
      ctx.arc(-5, 2, 4, 0, Math.PI * 2);
      ctx.arc(5, 2, 4, 0, Math.PI * 2);
      ctx.fill();

      // Eye socket outlines
      ctx.strokeStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(-5, 2, 4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(5, 2, 4, 0, Math.PI * 2);
      ctx.stroke();

      // Nose hole
      ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(0, 6);
      ctx.lineTo(-3, 11);
      ctx.lineTo(3, 11);
      ctx.closePath();
      ctx.fill();

      // Teeth
      ctx.fillStyle = `rgba(200, 200, 200, ${alpha})`;
      for (let i = -7; i <= 7; i += 3.5) {
        ctx.fillRect(i - 1, 12, 2.5, 4);
      }

      ctx.restore();
    }

    this.drawStatusEffects(ctx);
    SpriteRenderer.drawBoss(ctx, this.x, this.y, this.team, this.animationFrame);
    this.drawHealthBar(ctx);
  }

  protected drawHealthBar(ctx: CanvasRenderingContext2D): void {
    // Bigger health bar for boss
    const barWidth = 50;
    const barHeight = 6;
    const barX = this.x - barWidth / 2;
    const barY = this.y - 38;

    ctx.fillStyle = '#333';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    const healthPercent = this.health / this.maxHealth;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(barX, barY, barWidth * healthPercent, barHeight);

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }
}

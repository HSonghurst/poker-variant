import { Fighter } from './Fighter';
import { SoundManager } from './SoundManager';
import type { Team } from './types';

export class VoidBolt {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number = 2;
  damage: number;
  team: Team;
  target: Fighter | null;
  shooter: Fighter | null;
  isDead: boolean = false;
  angle: number;
  impactRadius: number = 10;
  isImpacting: boolean = false;
  impactFrame: number = 0;
  isGroundTargeted: boolean = false; // Artillery mode - doesn't track target

  constructor(x: number, y: number, target: Fighter | null, damage: number, team: Team, shooter?: Fighter, groundTargetX?: number, groundTargetY?: number) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.damage = damage;
    this.team = team;
    this.shooter = shooter || null;

    // Ground targeted mode (artillery)
    if (groundTargetX !== undefined && groundTargetY !== undefined) {
      this.targetX = groundTargetX;
      this.targetY = groundTargetY;
      this.isGroundTargeted = true;
    } else if (target) {
      this.targetX = target.x;
      this.targetY = target.y;
    } else {
      this.targetX = x;
      this.targetY = y;
    }

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    this.angle = Math.atan2(dy, dx);
  }

  update(enemies: Fighter[], allies?: Fighter[]): void {
    if (this.isDead) return;

    if (this.isImpacting) {
      this.impactFrame++;
      if (this.impactFrame > 12) {
        this.isDead = true;
      }
      return;
    }

    // Only track target if not ground-targeted (artillery mode)
    if (!this.isGroundTargeted && this.target && !this.target.isDead) {
      this.targetX = this.target.x;
      this.targetY = this.target.y;
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      this.angle = Math.atan2(dy, dx);
    }

    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 18) {
      this.impact(enemies, allies);
    }

    // Kill bolt if it goes way off screen (larger canvas bounds)
    if (this.x < -100 || this.x > 2000 || this.y < -100 || this.y > 1500) {
      this.isDead = true;
    }
  }

  private impact(enemies: Fighter[], allies?: Fighter[]): void {
    // Center explosion on target position
    this.x = this.targetX;
    this.y = this.targetY;

    this.isImpacting = true;
    SoundManager.playExplosion();
    const modifiers = this.shooter?.modifiers;

    // Damage all enemies in radius
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= this.impactRadius) {
        // Damage falls off with distance (min 75% at edge)
        const damageMultiplier = 1 - (dist / this.impactRadius) * 0.25;
        let finalDamage = Math.floor(this.damage * damageMultiplier);
        let isCrit = false;

        // Critical hit check (base 5% * multiplier)
        const baseCritChance = 0.05;
        const critMultiplier = modifiers?.critChance || 1;
        if (Math.random() < baseCritChance * critMultiplier) {
          finalDamage *= 2;
          isCrit = true;
        }

        enemy.takeDamage(finalDamage, this.shooter || undefined, isCrit);

        // Mages always apply void DoT on hit (enemies only)
        const baseVoidDamage = 4;
        const voidMultiplier = modifiers?.voidDoTMultiplier || 1;
        enemy.statusEffects.void += baseVoidDamage * voidMultiplier;

        // Lifesteal
        if (modifiers && modifiers.lifestealPercent > 1 && this.shooter) {
          const lifestealPercent = modifiers.lifestealPercent - 1;
          const healAmount = finalDamage * lifestealPercent;
          this.shooter.health = Math.min(this.shooter.maxHealth, this.shooter.health + healAmount);
        }
      }
    }

    // Friendly fire - damage allies (including shooter) in splash radius
    if (allies) {
      for (const ally of allies) {
        if (ally.isDead) continue;
        const dx = ally.x - this.x;
        const dy = ally.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= this.impactRadius) {
          // Damage falls off with distance (min 75% at edge)
          const damageMultiplier = 1 - (dist / this.impactRadius) * 0.25;
          const finalDamage = Math.floor(this.damage * damageMultiplier);
          ally.takeDamage(finalDamage, this.shooter || undefined, false);
          // No void DoT on allies
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.isDead) return;

    if (this.isImpacting) {
      // Draw void implosion effect
      const progress = this.impactFrame / 12;
      const radius = this.impactRadius * (1 - progress * 0.3);
      const alpha = 1 - progress;

      // Outer void ring
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.impactRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(124, 58, 237, ${alpha * 0.6})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Void fill (dark purple)
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(88, 28, 135, ${alpha * 0.5})`;
      ctx.fill();

      // Inner void core
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(139, 92, 246, ${alpha * 0.7})`;
      ctx.fill();

      // Center bright point
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(196, 181, 253, ${alpha})`;
      ctx.fill();
      return;
    }

    // Draw void bolt
    ctx.save();
    ctx.translate(this.x, this.y);

    // Outer glow (purple)
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 7);
    gradient.addColorStop(0, 'rgba(196, 181, 253, 1)');
    gradient.addColorStop(0.4, 'rgba(139, 92, 246, 0.8)');
    gradient.addColorStop(0.7, 'rgba(124, 58, 237, 0.5)');
    gradient.addColorStop(1, 'rgba(88, 28, 135, 0)');

    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Inner core (bright purple/white)
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#e9d5ff';
    ctx.fill();

    ctx.restore();
  }
}

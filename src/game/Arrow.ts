import { Fighter } from './Fighter';
import type { Team } from './types';

export class Arrow {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number = 8;
  damage: number;
  team: Team;
  target: Fighter;
  shooter: Fighter | null;
  isDead: boolean = false;
  angle: number;

  constructor(x: number, y: number, target: Fighter, damage: number, team: Team, shooter?: Fighter) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.targetX = target.x;
    this.targetY = target.y;
    this.damage = damage;
    this.team = team;
    this.shooter = shooter || null;

    const dx = this.targetX - this.x;
    const dy = this.targetY - this.y;
    this.angle = Math.atan2(dy, dx);
  }

  update(): void {
    if (this.isDead) return;

    if (!this.target.isDead) {
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

    if (distance < 15) {
      if (!this.target.isDead) {
        let finalDamage = this.damage;
        let isCrit = false;
        const modifiers = this.shooter?.modifiers;

        // Critical hit check (base 5% * multiplier)
        const baseCritChance = 0.05;
        const critMultiplier = modifiers?.critChance || 1;
        if (Math.random() < baseCritChance * critMultiplier) {
          finalDamage *= 2;
          isCrit = true;
        }

        this.target.takeDamage(finalDamage, this.shooter || undefined, isCrit);

        // Apply archer-specific poison on-hit
        if (modifiers) {
          if (modifiers.archerPoisonOnHit) {
            const basePoison = 2;
            const poisonMultiplier = modifiers.poisonDoTMultiplier;
            this.target.statusEffects.poison += basePoison * poisonMultiplier;
          }
          if (modifiers.lifestealPercent > 1 && this.shooter) {
            const lifestealPercent = modifiers.lifestealPercent - 1;
            const healAmount = finalDamage * lifestealPercent;
            this.shooter.health = Math.min(this.shooter.maxHealth, this.shooter.health + healAmount);
          }
        }
      }
      this.isDead = true;
    }

    if (this.x < -100 || this.x > 2000 || this.y < -100 || this.y > 1500) {
      this.isDead = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.isDead) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Arrow shaft
    ctx.strokeStyle = '#8B4513';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.lineTo(2, 0);
    ctx.stroke();

    // Arrowhead
    ctx.fillStyle = '#4a4a4a';
    ctx.beginPath();
    ctx.moveTo(3, 0);
    ctx.lineTo(1.5, -1);
    ctx.lineTo(1.5, 1);
    ctx.closePath();
    ctx.fill();

    // Fletching
    ctx.strokeStyle = '#a0522d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.lineTo(-4, -1);
    ctx.moveTo(-3, 0);
    ctx.lineTo(-4, 1);
    ctx.stroke();

    ctx.restore();
  }
}

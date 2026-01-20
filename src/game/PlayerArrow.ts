import type { Fighter } from './Fighter';
import type { Player } from './Player';
import type { Team } from './types';
import { SoundManager } from './SoundManager';

export class PlayerArrow {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number = 8;
  damage: number;
  team: Team;
  target: Fighter;
  shooter: Player;
  isDead: boolean = false;
  angle: number;

  constructor(x: number, y: number, target: Fighter, damage: number, team: Team, shooter: Player) {
    this.x = x;
    this.y = y;
    this.target = target;
    this.targetX = target.x;
    this.targetY = target.y;
    this.damage = damage;
    this.team = team;
    this.shooter = shooter;

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
        const modifiers = this.shooter.modifiers;

        // Critical hit check (base 5% * multiplier)
        const baseCritChance = 0.05;
        const critMultiplier = modifiers?.critChance || 1;
        if (Math.random() < baseCritChance * critMultiplier) {
          finalDamage *= 2;
          isCrit = true;
          SoundManager.playCritical();
        }

        // Pass undefined as attacker to avoid type issues (thorns won't apply to ranged attacks anyway)
        this.target.takeDamage(finalDamage, undefined, isCrit);

        // Player arrows only apply lifesteal (no class-specific status effects)
        if (modifiers && modifiers.lifestealPercent > 1) {
          const lifestealPercent = modifiers.lifestealPercent - 1;
          const healAmount = finalDamage * lifestealPercent;
          this.shooter.health = Math.min(this.shooter.maxHealth, this.shooter.health + healAmount);
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
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(4, 0);
    ctx.stroke();

    // Arrowhead (golden for player)
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(6, 0);
    ctx.lineTo(3, -2);
    ctx.lineTo(3, 2);
    ctx.closePath();
    ctx.fill();

    // Fletching
    ctx.strokeStyle = '#a0522d';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(-8, -2);
    ctx.moveTo(-6, 0);
    ctx.lineTo(-8, 2);
    ctx.stroke();

    ctx.restore();
  }
}

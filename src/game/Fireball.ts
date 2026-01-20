import { Fighter } from './Fighter';
import { SoundManager } from './SoundManager';
import type { Team } from './types';

export class Fireball {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number = 5;
  damage: number;
  team: Team;
  target: Fighter;
  shooter: Fighter | null;
  isDead: boolean = false;
  angle: number;
  explosionRadius: number = 30;
  isExploding: boolean = false;
  explosionFrame: number = 0;

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

  update(enemies: Fighter[]): void {
    if (this.isDead) return;

    if (this.isExploding) {
      this.explosionFrame++;
      if (this.explosionFrame > 15) {
        this.isDead = true;
      }
      return;
    }

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

    if (distance < 20) {
      this.explode(enemies);
    }

    if (this.x < -100 || this.x > 2000 || this.y < -100 || this.y > 1500) {
      this.isDead = true;
    }
  }

  private explode(enemies: Fighter[]): void {
    this.isExploding = true;
    SoundManager.playExplosion();
    const modifiers = this.shooter?.modifiers;

    // Damage all enemies in radius
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= this.explosionRadius) {
        // Damage falls off with distance (min 70% at edge)
        const damageMultiplier = 1 - (dist / this.explosionRadius) * 0.3;
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

        // Apply lifesteal only (Fireball is currently unused but kept for reference)
        if (modifiers && modifiers.lifestealPercent > 1 && this.shooter) {
          const lifestealPercent = modifiers.lifestealPercent - 1;
          const healAmount = finalDamage * lifestealPercent;
          this.shooter.health = Math.min(this.shooter.maxHealth, this.shooter.health + healAmount);
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.isDead) return;

    if (this.isExploding) {
      // Draw explosion
      const progress = this.explosionFrame / 15;
      const radius = this.explosionRadius * progress;
      const alpha = 1 - progress;

      // Outer radius indicator ring
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.explosionRadius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 150, 0, ${alpha * 0.8})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Explosion fill
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 100, 0, ${alpha * 0.6})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(this.x, this.y, radius * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 200, 0, ${alpha * 0.8})`;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(this.x, this.y, radius * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 200, ${alpha})`;
      ctx.fill();
      return;
    }

    // Draw fireball (smaller)
    ctx.save();
    ctx.translate(this.x, this.y);

    // Outer glow
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 6);
    gradient.addColorStop(0, 'rgba(255, 200, 0, 1)');
    gradient.addColorStop(0.5, 'rgba(255, 100, 0, 0.8)');
    gradient.addColorStop(1, 'rgba(255, 50, 0, 0)');

    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Inner core
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    ctx.restore();
  }
}

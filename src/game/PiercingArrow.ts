import { Fighter } from './Fighter';
import type { Team } from './types';

export class PiercingArrow {
  x: number;
  y: number;
  speed: number = 10;
  damage: number;
  team: Team;
  shooter: Fighter;
  isDead: boolean = false;
  angle: number;
  private hitEnemies: Set<Fighter> = new Set();
  private allEnemies: Fighter[];
  private isFirstHit: boolean = true;
  private travelDistance: number = 0;
  private maxDistance: number = 500;

  constructor(x: number, y: number, target: Fighter, damage: number, team: Team, shooter: Fighter, allEnemies: Fighter[]) {
    this.x = x;
    this.y = y;
    this.damage = damage;
    this.team = team;
    this.shooter = shooter;
    this.allEnemies = allEnemies;

    // Calculate angle to target - arrow will travel in this direction
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    this.angle = Math.atan2(dy, dx);
  }

  update(): void {
    if (this.isDead) return;

    // Move in straight line
    this.x += Math.cos(this.angle) * this.speed;
    this.y += Math.sin(this.angle) * this.speed;
    this.travelDistance += this.speed;

    // Check for hits with all enemies
    for (const enemy of this.allEnemies) {
      if (enemy.isDead || this.hitEnemies.has(enemy)) continue;

      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < 15) {
        this.hitEnemy(enemy);
      }
    }

    // Die if traveled too far or out of bounds
    if (this.travelDistance > this.maxDistance ||
        this.x < -50 || this.x > 1000 || this.y < -50 || this.y > 700) {
      this.isDead = true;
    }
  }

  private hitEnemy(enemy: Fighter): void {
    this.hitEnemies.add(enemy);

    // First hit does full damage, subsequent hits do 50%
    const damageMultiplier = this.isFirstHit ? 1 : 0.5;
    let finalDamage = Math.round(this.damage * damageMultiplier);
    let isCrit = false;

    const modifiers = this.shooter.modifiers;

    // Critical hit check (base 5% * multiplier)
    const baseCritChance = 0.05;
    const critMultiplier = modifiers?.critChance || 1;
    if (Math.random() < baseCritChance * critMultiplier) {
      finalDamage *= 2;
      isCrit = true;
    }

    enemy.takeDamage(finalDamage, this.shooter, isCrit);

    // Apply archer-specific poison on-hit
    if (modifiers) {
      if (modifiers.archerPoisonOnHit) {
        const basePoison = 2;
        const poisonMultiplier = modifiers.poisonDoTMultiplier;
        enemy.statusEffects.poison += basePoison * poisonMultiplier;
      }
      if (modifiers.lifestealPercent > 1) {
        const lifestealPercent = modifiers.lifestealPercent - 1;
        const healAmount = finalDamage * lifestealPercent;
        this.shooter.health = Math.min(this.shooter.maxHealth, this.shooter.health + healAmount);
      }
    }

    this.isFirstHit = false;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.isDead) return;

    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);

    // Longer, glowing arrow shaft for piercing arrow
    ctx.strokeStyle = '#fbbf24';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(6, 0);
    ctx.stroke();

    // Glowing arrowhead
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.moveTo(10, 0);
    ctx.lineTo(5, -3);
    ctx.lineTo(5, 3);
    ctx.closePath();
    ctx.fill();

    // Trail effect
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-10, 0);
    ctx.lineTo(-20, 0);
    ctx.stroke();

    ctx.restore();
  }
}

import type { Team, FighterType, Position } from './types';
import type { Fighter } from './Fighter';
import { Arrow } from './Arrow';
import { SpriteRenderer } from './SpriteRenderer';
import { DamageNumberManager } from './DamageNumber';

export class Tower {
  x: number;
  y: number;
  team: Team;
  health: number;
  maxHealth: number;
  width: number = 36;
  height: number = 39;
  isDead: boolean = false;
  isStructure: boolean = true; // Prevents knockback
  // Attack properties - much more powerful
  attackRange: number = 150; // Long range
  attackCooldown: number = 400; // Fast attack
  damage: number = 30; // High damage
  lastAttackTime: number = 0;
  arrows: Arrow[] = [];
  // Dummy properties to be compatible with Fighter targeting
  statusEffects = {
    burning: 0,
    poison: 0,
    frozen: 0,
    frozenUntil: 0,
    void: 0,
    death: 0
  };

  constructor(team: Team, canvasWidth: number, canvasHeight: number) {
    this.team = team;
    this.x = canvasWidth / 2;
    this.y = team === 'top' ? 70 : canvasHeight - 70;
    this.maxHealth = 15000;
    this.health = 15000;
  }

  // These methods make Tower compatible with Fighter targeting
  getType(): FighterType {
    return 'knight'; // Doesn't matter, just needs to return something
  }

  getPosition(): Position {
    return { x: this.x, y: this.y };
  }

  takeDamage(amount: number): void {
    this.health -= amount;
    DamageNumberManager.spawn(this.x, this.y - 20, amount);
    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
    }
  }

  update(enemies: Fighter[]): void {
    if (this.isDead) return;

    // Update arrows
    for (const arrow of this.arrows) {
      arrow.update();
    }
    this.arrows = this.arrows.filter(arrow => !arrow.isDead);

    // Find target and attack
    const target = this.findTarget(enemies);
    if (target) {
      this.attack(target);
    }
  }

  private findTarget(enemies: Fighter[]): Fighter | null {
    const aliveEnemies = enemies.filter(e => !e.isDead);
    if (aliveEnemies.length === 0) return null;

    let closest: Fighter | null = null;
    let closestDist = Infinity;

    for (const enemy of aliveEnemies) {
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist <= this.attackRange && dist < closestDist) {
        closest = enemy;
        closestDist = dist;
      }
    }

    return closest;
  }

  private attack(target: Fighter): void {
    const now = Date.now();
    if (now - this.lastAttackTime >= this.attackCooldown) {
      this.arrows.push(new Arrow(this.x, this.y, target, this.damage, this.team));
      this.lastAttackTime = now;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Always draw arrows even if tower is dead
    for (const arrow of this.arrows) {
      arrow.draw(ctx);
    }

    if (this.isDead) return;

    // Draw pixel art tower sprite
    SpriteRenderer.drawTower(ctx, this.x, this.y, this.team);

    // Health bar
    const barWidth = 50;
    const barHeight = 6;
    const barY = this.y - 45;

    ctx.fillStyle = '#333';
    ctx.fillRect(this.x - barWidth / 2, barY, barWidth, barHeight);

    const healthPercent = this.health / this.maxHealth;
    const healthColor = healthPercent > 0.5 ? '#22c55e' : healthPercent > 0.25 ? '#eab308' : '#ef4444';
    ctx.fillStyle = healthColor;
    ctx.fillRect(this.x - barWidth / 2, barY, barWidth * healthPercent, barHeight);

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeRect(this.x - barWidth / 2, barY, barWidth, barHeight);

    // Health text
    ctx.fillStyle = '#fff';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`${Math.round(this.health)}/${this.maxHealth}`, this.x, barY - 2);
  }
}

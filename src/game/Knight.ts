import { Fighter } from './Fighter';
import { SpriteRenderer } from './SpriteRenderer';
import { SoundManager } from './SoundManager';
import type { Team, FighterType } from './types';

export class Knight extends Fighter {
  private lastTauntTime: number = 0;
  private tauntCooldown: number = 6000; // 6 seconds
  private invulnerableUntil: number = 0;
  private isTaunting: boolean = false;
  private tauntRange: number = 50;

  constructor(team: Team, x: number, canvasHeight: number) {
    super(team, x, canvasHeight);
    this.health = 144;
    this.maxHealth = 144;
    this.baseSpeed = 0.3752;
    this.speed = 0.3752;
    this.baseDamage = 15;
    this.damage = 15;
    this.baseAttackRange = 12;
    this.attackRange = 12;
    this.baseAttackCooldown = 1200;
    this.attackCooldown = 1200;
    this.width = 8;
    this.height = 10;
  }

  getColor(): string {
    return this.team === 'blue' ? '#1e40af' : '#991b1b';
  }

  getType(): FighterType {
    return 'knight';
  }

  takeDamage(amount: number, attacker?: Fighter, isCrit: boolean = false): void {
    // If invulnerable, take no damage
    if (Date.now() < this.invulnerableUntil) {
      return;
    }
    // Knights have 25% damage reduction
    const reducedDamage = Math.floor(amount * 0.75);
    super.takeDamage(reducedDamage, attacker, isCrit);
  }

  update(enemies: Fighter[], deltaTime: number, allies?: Fighter[]): void {
    super.update(enemies, deltaTime, allies);

    // Check if taunt is off cooldown and ability is unlocked
    const now = Date.now();
    if (this.modifiers?.knightTauntAbility && now - this.lastTauntTime >= this.tauntCooldown) {
      this.activateTaunt(enemies);
      this.lastTauntTime = now;
      this.invulnerableUntil = now + 3000; // 3 seconds invulnerability
      this.isTaunting = true;
      SoundManager.playTaunt();
    }

    // Clear taunting visual after invuln ends
    if (now >= this.invulnerableUntil) {
      this.isTaunting = false;
    }
  }

  private activateTaunt(enemies: Fighter[]): void {
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dist = this.getDistanceTo(enemy);

      if (dist <= this.tauntRange) {
        enemy.taunter = this;
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

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.isDead) return;

    this.drawStatusEffects(ctx);

    // Draw invulnerability shield effect
    if (Date.now() < this.invulnerableUntil) {
      const pulse = Math.sin(Date.now() / 100) * 0.2 + 0.6;

      // Golden shield aura
      ctx.beginPath();
      ctx.arc(this.x, this.y, 15, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 215, 0, ${pulse * 0.3})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(255, 215, 0, ${pulse})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Taunt range indicator
      if (this.isTaunting) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.tauntRange, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 100, 0, 0.4)`;
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    SpriteRenderer.drawKnight(ctx, this.x, this.y, this.team, this.animationFrame, this.isFlashing());
    this.drawHealthBar(ctx);
  }
}

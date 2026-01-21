import { Fighter } from './Fighter';
import { SpriteRenderer } from './SpriteRenderer';
import { SoundManager } from './SoundManager';
import type { Team, FighterType } from './types';

export class Swordsman extends Fighter {
  private swingAngle: number = 0;
  private isSwinging: boolean = false;
  private isSweeping: boolean = false;
  private attackCount: number = 0;

  constructor(team: Team, x: number, canvasHeight: number) {
    super(team, x, canvasHeight);
    this.health = 230;
    this.maxHealth = 230;
    this.baseSpeed = 0.5355;
    this.speed = 0.5355;
    this.baseDamage = 21;
    this.damage = 21;
    this.baseAttackRange = 11;
    this.attackRange = 11;
    this.baseAttackCooldown = 800;
    this.attackCooldown = 800;
  }

  getColor(): string {
    return this.team === 'blue' ? '#3b82f6' : '#ef4444';
  }

  getType(): FighterType {
    return 'swordsman';
  }

  protected attack(target: Fighter, allEnemies?: Fighter[]): void {
    const now = Date.now();
    if (now - this.lastAttackTime >= this.attackCooldown) {
      this.attackCount++;

      // Check for sweep ability (every 3 attacks)
      if (this.modifiers?.swordsmanSweepAbility && this.attackCount % 3 === 0 && allEnemies) {
        this.performSweepAttack(allEnemies);
        this.isSweeping = true;
        SoundManager.playSweep();
      } else {
        this.dealDamage(target, this.damage, allEnemies);
        this.isSwinging = true;
        SoundManager.playSwordSwing();
      }

      this.lastAttackTime = now;
      this.swingAngle = 0;
    }
  }

  private performSweepAttack(allEnemies: Fighter[]): void {
    const sweepRange = this.attackRange * 2; // Sweep has larger range

    for (const enemy of allEnemies) {
      if (enemy.isDead) continue;
      const dist = this.getDistanceTo(enemy);

      if (dist <= sweepRange) {
        // Sweep does 75% damage to all enemies in range
        this.dealDamage(enemy, Math.floor(this.damage * 0.75));
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.isDead) return;

    // Draw status effects from parent
    this.drawStatusEffects(ctx);

    if (this.isSwinging || this.isSweeping) {
      this.swingAngle += 0.3;
      if (this.swingAngle > Math.PI) {
        this.isSwinging = false;
        this.isSweeping = false;
        this.swingAngle = 0;
      }
    }

    // Draw sweep effect
    if (this.isSweeping) {
      const sweepRange = this.attackRange * 2;
      const alpha = 0.3 * (1 - this.swingAngle / Math.PI);
      ctx.beginPath();
      ctx.arc(this.x, this.y, sweepRange, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100, 150, 255, ${alpha})`;
      ctx.fill();
      ctx.strokeStyle = `rgba(60, 130, 246, ${alpha * 2})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    SpriteRenderer.drawSwordsman(ctx, this.x, this.y, this.team, this.animationFrame, this.isFlashing());
    this.drawHealthBar(ctx);
  }
}

import { Fighter } from './Fighter';
import { Arrow } from './Arrow';
import { PiercingArrow } from './PiercingArrow';
import { SpriteRenderer } from './SpriteRenderer';
import { SoundManager } from './SoundManager';
import type { Team, FighterType } from './types';

export class Archer extends Fighter {
  arrows: (Arrow | PiercingArrow)[] = [];
  private attackCount: number = 0;

  constructor(team: Team, x: number, canvasHeight: number) {
    super(team, x, canvasHeight);
    this.health = 160;
    this.maxHealth = 160;
    this.baseSpeed = 0.191;
    this.speed = 0.191;
    this.baseDamage = 22;
    this.damage = 22;
    this.baseAttackRange = 65;
    this.attackRange = 65;
    this.baseAttackCooldown = 1500;
    this.attackCooldown = 1500;
  }

  getColor(): string {
    return this.team === 'blue' ? '#60a5fa' : '#f87171';
  }

  getType(): FighterType {
    return 'archer';
  }

  protected attack(target: Fighter, allEnemies?: Fighter[]): void {
    const now = Date.now();
    if (now - this.lastAttackTime >= this.attackCooldown) {
      this.attackCount++;

      // Check for piercing ability (every 5 attacks)
      if (this.modifiers?.archerFanAbility && this.attackCount % 5 === 0 && allEnemies) {
        this.firePiercingArrow(target, allEnemies);
      } else {
        this.arrows.push(new Arrow(this.x, this.y, target, this.damage, this.team, this));
      }

      SoundManager.playArrowShot();
      this.lastAttackTime = now;
    }
  }

  private firePiercingArrow(target: Fighter, allEnemies: Fighter[]): void {
    const aliveEnemies = allEnemies.filter(e => !e.isDead);
    this.arrows.push(new PiercingArrow(this.x, this.y, target, this.damage, this.team, this, aliveEnemies));
  }

  update(enemies: Fighter[], deltaTime: number, allies?: Fighter[]): void {
    // Always update arrows even if archer is dead (so they can finish)
    for (const arrow of this.arrows) {
      arrow.update();
    }
    this.arrows = this.arrows.filter(arrow => !arrow.isDead);

    // Use the base Fighter update which includes the slot system
    super.update(enemies, deltaTime, allies);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const arrow of this.arrows) {
      arrow.draw(ctx);
    }

    if (this.isDead) return;

    this.drawStatusEffects(ctx);
    SpriteRenderer.drawArcher(ctx, this.x, this.y, this.team, this.animationFrame, this.isFlashing());
    this.drawHealthBar(ctx);
  }
}

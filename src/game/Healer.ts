import { Fighter } from './Fighter';
import { SpriteRenderer } from './SpriteRenderer';
import { SoundManager } from './SoundManager';
import { DamageNumberManager } from './DamageNumber';
import { DPSTracker } from './DPSTracker';
import type { Team, FighterType } from './types';

export class Healer extends Fighter {
  private baseHealRange: number = 50;
  private healRange: number = 50;
  private baseHealAoe: number = 8; // Base AoE radius
  private healAoe: number = 8;
  private baseHealAmount: number = 7;
  private healAmount: number = 7;
  private healCooldown: number = 1000;
  private lastHealTime: number = 0;
  private healEffect: { x: number; y: number; frame: number }[] = [];
  private aoeAnimation: number = 0;

  // Purifying Light ability
  private purifyCooldown: number = 0;
  private readonly PURIFY_INTERVAL: number = 8000;
  private purifyAnimation: number = 0;

  constructor(team: Team, x: number, canvasHeight: number) {
    super(team, x, canvasHeight);
    this.health = 90;
    this.maxHealth = 90;
    this.baseSpeed = 0.56;
    this.speed = 0.56;
    this.baseDamage = 2;
    this.damage = 2;
    this.baseAttackRange = 14;
    this.attackRange = 14;
    this.baseAttackCooldown = 2000;
    this.attackCooldown = 2000;
  }

  getColor(): string {
    return this.team === 'blue' ? '#22d3ee' : '#fb923c';
  }

  getType(): FighterType {
    return 'healer';
  }

  update(enemies: Fighter[], deltaTime: number, allies?: Fighter[]): void {
    if (this.isDead) return;

    // Apply modifiers
    if (this.modifiers) {
      this.healAmount = Math.round(this.baseHealAmount * this.modifiers.healPowerMultiplier);
      this.healRange = Math.round(this.baseHealRange * this.modifiers.getRangeMultiplier('healer'));
      this.healAoe = Math.round(this.baseHealAoe * this.modifiers.healAoeMultiplier);
    }

    // Decay AoE animation
    if (this.aoeAnimation > 0) {
      this.aoeAnimation--;
    }

    // Update heal effects
    this.healEffect = this.healEffect.filter(e => {
      e.frame++;
      return e.frame < 20;
    });

    // Decay purify animation
    if (this.purifyAnimation > 0) {
      this.purifyAnimation--;
    }

    // Purifying Light ability cooldown
    this.purifyCooldown -= deltaTime;
    if (this.modifiers?.healerPurifyAbility && this.purifyCooldown <= 0 && allies && allies.length > 0) {
      this.purifyingLight(allies);
      this.purifyCooldown = this.PURIFY_INTERVAL;
    }

    // Try to heal allies
    if (allies) {
      this.tryHeal(allies);
    }

    // Animation
    this.animationTimer += deltaTime;
    if (this.animationTimer > 150) {
      this.animationFrame = (this.animationFrame + 1) % 4;
      this.animationTimer = 0;
    }

    // Healer behavior: Stay back with allies, don't chase enemies
    // Find ally that needs healing most
    const woundedAlly = this.findWoundedAlly(allies || []);

    // Separation from other healers to prevent bunching
    let sepX = 0, sepY = 0;
    const healerSeparationRadius = 10;
    if (allies) {
      for (const ally of allies) {
        if (ally === this || ally.isDead || ally.getType() !== 'healer') continue;
        const ox = this.x - ally.x;
        const oy = this.y - ally.y;
        const dist = Math.sqrt(ox * ox + oy * oy);
        if (dist < healerSeparationRadius && dist > 0.1) {
          const strength = (healerSeparationRadius - dist) / healerSeparationRadius;
          sepX += (ox / dist) * strength;
          sepY += (oy / dist) * strength;
        }
      }
    }

    if (woundedAlly) {
      // Move towards wounded ally if not in heal range
      const dx = woundedAlly.x - this.x;
      const dy = woundedAlly.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > this.healRange * 0.95) {
        // Move towards wounded ally with separation
        let moveX = (dx / dist) + sepX * 2;
        let moveY = (dy / dist) + sepY * 2;
        const moveMag = Math.sqrt(moveX * moveX + moveY * moveY);
        if (moveMag > 0) {
          this.x += (moveX / moveMag) * this.speed;
          this.y += (moveY / moveMag) * this.speed;
        }
      } else {
        // In range but apply separation
        this.x += sepX * this.speed * 0.5;
        this.y += sepY * this.speed * 0.5;
      }
    } else if (allies && allies.length > 0) {
      // No wounded allies - stay near the group center but slightly behind the front line
      const aliveNonHealerAllies = allies.filter(a => !a.isDead && a !== this && a.getType() !== 'healer');
      if (aliveNonHealerAllies.length > 0) {
        // Calculate average ally position
        let avgX = 0, avgY = 0;
        for (const ally of aliveNonHealerAllies) {
          avgX += ally.x;
          avgY += ally.y;
        }
        avgX /= aliveNonHealerAllies.length;
        avgY /= aliveNonHealerAllies.length;

        // In hexagonal arena, "behind" means away from arena center
        // Calculate direction from arena center to group center
        const fromCenterX = avgX - this.arenaCenterX;
        const fromCenterY = avgY - this.arenaCenterY;
        const fromCenterDist = Math.sqrt(fromCenterX * fromCenterX + fromCenterY * fromCenterY);

        // Target position: stay 25 units behind the group (further from center)
        let targetX = avgX;
        let targetY = avgY;
        if (fromCenterDist > 10) {
          const backOffset = 25;
          targetX = avgX + (fromCenterX / fromCenterDist) * backOffset;
          targetY = avgY + (fromCenterY / fromCenterDist) * backOffset;
        }

        let dx = targetX - this.x;
        let dy = targetY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > 15) {
          // Follow the group - use full speed to keep up
          let moveX = (dx / dist) + sepX * 2;
          let moveY = (dy / dist) + sepY * 2;
          const moveMag = Math.sqrt(moveX * moveX + moveY * moveY);
          if (moveMag > 0) {
            this.x += (moveX / moveMag) * this.speed;
            this.y += (moveY / moveMag) * this.speed;
          }
        } else {
          // Close enough, just apply separation
          this.x += sepX * this.speed * 0.5;
          this.y += sepY * this.speed * 0.5;
        }
      } else {
        // No non-healer allies - move towards nearest enemy
        this.moveTowardsNearestEnemy(enemies);
      }
    } else {
      // No allies at all - move towards nearest enemy
      this.moveTowardsNearestEnemy(enemies);
    }

    // Only attack if enemy is very close (self-defense)
    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= this.attackRange) {
        this.attack(enemy);
        break;
      }
    }
  }

  private moveTowardsNearestEnemy(enemies: Fighter[]): void {
    // Find nearest living enemy
    let nearestEnemy: Fighter | null = null;
    let nearestDist = Infinity;

    for (const enemy of enemies) {
      if (enemy.isDead) continue;
      const dx = enemy.x - this.x;
      const dy = enemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = enemy;
      }
    }

    if (nearestEnemy) {
      // Move towards the nearest enemy
      const dx = nearestEnemy.x - this.x;
      const dy = nearestEnemy.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > this.attackRange) {
        this.x += (dx / dist) * this.speed;
        this.y += (dy / dist) * this.speed;
      }
    } else {
      // No enemies, just move forward
      this.moveForward();
    }
  }

  private findWoundedAlly(allies: Fighter[]): Fighter | null {
    let mostWounded: Fighter | null = null;
    let lowestHealthPercent = 0.9; // Only consider allies below 90% health

    for (const ally of allies) {
      if (ally === this || ally.isDead) continue;

      const healthPercent = ally.health / ally.maxHealth;
      if (healthPercent < lowestHealthPercent) {
        // Check if within reasonable range (not too far)
        const dx = ally.x - this.x;
        const dy = ally.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 150) { // Only chase allies within 150 units
          lowestHealthPercent = healthPercent;
          mostWounded = ally;
        }
      }
    }

    return mostWounded;
  }

  private tryHeal(allies: Fighter[]): void {
    const now = Date.now();
    if (now - this.lastHealTime < this.healCooldown) return;

    // Find wounded allies within range to determine heal center
    let healTarget: Fighter | null = null;
    let closestDist = Infinity;

    for (const ally of allies) {
      if (ally === this || ally.isDead) continue;
      if (ally.getType() === 'healer') continue; // Don't heal other healers
      if (ally.health >= ally.maxHealth) continue;

      const dx = ally.x - this.x;
      const dy = ally.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= this.healRange && dist < closestDist) {
        healTarget = ally;
        closestDist = dist;
      }
    }

    if (!healTarget) return;

    // AoE heal centered on the target
    this.aoeAnimation = 20;
    let healedAny = false;

    for (const ally of allies) {
      if (ally.isDead) continue;
      if (ally.getType() === 'healer') continue; // Don't heal other healers
      if (ally.health >= ally.maxHealth) continue;

      const dx = ally.x - healTarget.x;
      const dy = ally.y - healTarget.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= this.healAoe) {
        const actualHeal = Math.min(ally.maxHealth - ally.health, this.healAmount);
        ally.health = Math.min(ally.maxHealth, ally.health + this.healAmount);
        this.healEffect.push({ x: ally.x, y: ally.y, frame: 0 });
        DamageNumberManager.spawn(ally.x, ally.y - 15, this.healAmount, '#22d3ee');
        DPSTracker.recordHealing(actualHeal);
        healedAny = true;
      }
    }

    if (healedAny) {
      this.lastHealTime = now;
      // Store heal center for drawing
      (this as any).lastHealCenter = { x: healTarget.x, y: healTarget.y };
    }
  }

  private purifyingLight(allies: Fighter[]): void {
    SoundManager.playFreeze(); // Use freeze sound for purify
    this.purifyAnimation = 40;

    const purifyRadius = 60;
    const burstHeal = Math.round(this.healAmount * 2); // Double heal for burst

    for (const ally of allies) {
      if (ally.isDead) continue;
      if (ally.getType() === 'healer') continue; // Don't heal other healers

      const dx = ally.x - this.x;
      const dy = ally.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= purifyRadius) {
        // Cleanse all debuffs
        ally.statusEffects.burning = 0;
        ally.statusEffects.poison = 0;
        ally.statusEffects.void = 0;
        ally.statusEffects.death = 0;
        ally.statusEffects.frozenUntil = 0;

        // Burst heal
        const healedAmount = Math.min(ally.maxHealth - ally.health, burstHeal);
        if (healedAmount > 0) {
          ally.health = Math.min(ally.maxHealth, ally.health + burstHeal);
          DamageNumberManager.spawn(ally.x, ally.y - 20, healedAmount, '#22d3ee');
          DPSTracker.recordHealing(healedAmount);
        }

        // Add heal effect
        this.healEffect.push({ x: ally.x, y: ally.y, frame: 0 });
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.isDead) return;

    // Draw AoE heal circle animation
    if (this.aoeAnimation > 0) {
      const healCenter = (this as any).lastHealCenter;
      if (healCenter) {
        const progress = (20 - this.aoeAnimation) / 20;
        const alpha = 0.4 * (1 - progress);
        const healColor = this.team === 'blue' ? `rgba(34, 255, 34, ${alpha})` : `rgba(34, 211, 238, ${alpha})`;

        // Filled circle
        ctx.fillStyle = healColor;
        ctx.beginPath();
        ctx.arc(healCenter.x, healCenter.y, this.healAoe, 0, Math.PI * 2);
        ctx.fill();

        // Border
        ctx.strokeStyle = this.team === 'blue' ? `rgba(34, 255, 34, ${alpha * 2})` : `rgba(34, 211, 238, ${alpha * 2})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(healCenter.x, healCenter.y, this.healAoe, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Draw purify ability indicator when about to cast
    if (this.modifiers?.healerPurifyAbility && this.purifyCooldown < 1000 && this.purifyCooldown > 0) {
      const warningAlpha = (1000 - this.purifyCooldown) / 1000;
      const healColor = this.team === 'blue' ? `rgba(34, 255, 34, ${warningAlpha * 0.3})` : `rgba(34, 211, 238, ${warningAlpha * 0.3})`;
      ctx.fillStyle = healColor;
      ctx.beginPath();
      ctx.arc(this.x, this.y, 60, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw purify shockwave
    if (this.purifyAnimation > 0) {
      const progress = (40 - this.purifyAnimation) / 40;
      const radius = 60 * progress;
      const healColor = this.team === 'blue' ? `rgba(34, 255, 34, ${1 - progress})` : `rgba(34, 211, 238, ${1 - progress})`;
      ctx.strokeStyle = healColor;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(this.x, this.y, radius, 0, Math.PI * 2);
      ctx.stroke();

      // Draw cross in center
      const crossAlpha = 1 - progress;
      const crossColor = this.team === 'blue' ? `rgba(34, 255, 34, ${crossAlpha})` : `rgba(34, 211, 238, ${crossAlpha})`;
      ctx.strokeStyle = crossColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(this.x - 15, this.y);
      ctx.lineTo(this.x + 15, this.y);
      ctx.moveTo(this.x, this.y - 15);
      ctx.lineTo(this.x, this.y + 15);
      ctx.stroke();
    }

    // Draw heal effects
    for (const effect of this.healEffect) {
      const alpha = 1 - effect.frame / 20;
      const size = 10 + effect.frame;

      // Green heal effect for goblin (top), cyan for human (bottom)
      const healColor = this.team === 'blue' ? `rgba(34, 255, 34, ${alpha})` : `rgba(34, 211, 238, ${alpha})`;
      ctx.strokeStyle = healColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(effect.x - size / 2, effect.y);
      ctx.lineTo(effect.x + size / 2, effect.y);
      ctx.moveTo(effect.x, effect.y - size / 2);
      ctx.lineTo(effect.x, effect.y + size / 2);
      ctx.stroke();
    }

    // Draw pixel art sprite
    SpriteRenderer.drawHealer(ctx, this.x, this.y, this.team, this.animationFrame, this.isFlashing());

    // Draw health bar
    this.drawHealthBar(ctx);
  }
}

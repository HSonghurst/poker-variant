import { Fighter } from './Fighter';
import { VoidBolt } from './VoidBolt';
import { SpriteRenderer } from './SpriteRenderer';
import { SoundManager } from './SoundManager';
import type { Team, FighterType } from './types';

interface VoidChain {
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  progress: number;
  damage: number;
  hitEnemies: Set<Fighter>;
  currentTarget: Fighter | null;
}

export class Mage extends Fighter {
  voidBolts: VoidBolt[] = [];
  private castAnimation: number = 0;
  private attackCount: number = 0;
  private voidChains: VoidChain[] = [];

  // Artillery charging system
  private chargeTime: number = 0;
  private readonly CHARGE_DURATION: number = 2000; // 2 seconds to charge
  private isCharging: boolean = false;
  private chargeTargetX: number = 0;
  private chargeTargetY: number = 0;

  constructor(team: Team, x: number, canvasHeight: number) {
    super(team, x, canvasHeight);
    this.health = 40; // Very weak
    this.maxHealth = 40;
    this.baseSpeed = 0.08; // Very slow
    this.speed = 0.08;
    this.baseDamage = 25; // High damage per shot
    this.damage = 25;
    this.baseAttackRange = 260; // 4x archer range (65 * 4)
    this.attackRange = 260;
    this.baseAttackCooldown = 100; // Not used, charge system instead
    this.attackCooldown = 100;
  }

  getColor(): string {
    return this.team === 'blue' ? '#a855f7' : '#f472b6';
  }

  getType(): FighterType {
    return 'mage';
  }

  private startVoidEruption(startTarget: Fighter, _allEnemies: Fighter[]): void {
    // Start a void chain from the mage to the target
    this.voidChains.push({
      x: this.x,
      y: this.y,
      targetX: startTarget.x,
      targetY: startTarget.y,
      progress: 0,
      damage: this.damage * 1.5, // Void eruption does 150% damage
      hitEnemies: new Set(),
      currentTarget: startTarget
    });
  }

  private updateVoidChains(allEnemies: Fighter[]): void {
    const modifiers = this.modifiers;
    const voidMultiplier = modifiers?.voidDoTMultiplier || 1;

    for (const chain of this.voidChains) {
      chain.progress += 0.15; // Speed of void chain

      if (chain.progress >= 1 && chain.currentTarget) {
        // Hit the current target
        if (!chain.hitEnemies.has(chain.currentTarget) && !chain.currentTarget.isDead) {
          chain.hitEnemies.add(chain.currentTarget);
          chain.currentTarget.takeDamage(chain.damage, this);
          // Apply strong void DoT
          chain.currentTarget.statusEffects.void += 6 * voidMultiplier;

          // Find next target to chain to
          let nextTarget: Fighter | null = null;
          let closestDist = 80; // Chain range

          for (const enemy of allEnemies) {
            if (enemy.isDead || chain.hitEnemies.has(enemy)) continue;
            const dx = enemy.x - chain.currentTarget.x;
            const dy = enemy.y - chain.currentTarget.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < closestDist) {
              closestDist = dist;
              nextTarget = enemy;
            }
          }

          if (nextTarget) {
            chain.x = chain.currentTarget.x;
            chain.y = chain.currentTarget.y;
            chain.targetX = nextTarget.x;
            chain.targetY = nextTarget.y;
            chain.currentTarget = nextTarget;
            chain.progress = 0;
            chain.damage *= 0.8; // Reduce damage per chain
          } else {
            chain.currentTarget = null; // End the chain
          }
        } else {
          // Target is dead or already hit - end the chain
          chain.currentTarget = null;
        }
      }
    }

    // Remove finished void chains
    this.voidChains = this.voidChains.filter(c => c.currentTarget !== null);
  }

  update(enemies: Fighter[], deltaTime: number, allies?: Fighter[]): void {
    // Always update projectiles even if mage is dead (so they can finish)
    // Pass allies for friendly fire splash damage
    for (const voidBolt of this.voidBolts) {
      voidBolt.update(enemies, allies);
    }
    this.voidBolts = this.voidBolts.filter(v => !v.isDead);

    // Update void chains even after death
    this.updateVoidChains(enemies);

    if (this.isDead) return;

    if (this.castAnimation > 0) {
      this.castAnimation--;
    }

    // Animation
    this.animationTimer += deltaTime;
    if (this.animationTimer > 150) {
      this.animationFrame = (this.animationFrame + 1) % 4;
      this.animationTimer = 0;
    }

    // If already charging, must complete the attack (cannot cancel)
    if (this.isCharging) {
      this.chargeTime += deltaTime;

      if (this.chargeTime >= this.CHARGE_DURATION) {
        // Fire!
        this.fireArtillery(enemies);
        this.isCharging = false;
        this.chargeTime = 0;
      }
      // Don't move or do anything else while charging
      return;
    }

    // Find target
    this.findTarget(enemies);

    if (this.target && !this.target.isDead) {
      const distance = this.getDistanceTo(this.target);

      if (distance > this.attackRange) {
        // Out of range - move towards target with mage separation
        this.moveWithSeparation(this.target, allies || []);
      } else {
        // In range - start charging (lock in target position)
        this.isCharging = true;
        this.chargeTime = 0;
        this.chargeTargetX = this.target.x;
        this.chargeTargetY = this.target.y;
      }
    } else {
      // No target - move forward with separation
      this.moveForwardWithSeparation(allies || []);
    }
  }

  // Move towards target while separating from other mages
  private moveWithSeparation(target: Fighter, allies: Fighter[]): void {
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist === 0) return;

    // Direction towards target
    let moveX = dx / dist;
    let moveY = dy / dist;

    // Add separation from other mages
    const sep = this.calculateMageSeparation(allies);
    moveX += sep.x;
    moveY += sep.y;

    // Normalize and move
    const moveMag = Math.sqrt(moveX * moveX + moveY * moveY);
    if (moveMag > 0) {
      this.x += (moveX / moveMag) * this.speed;
      this.y += (moveY / moveMag) * this.speed;
    }

    // Boundary clamp
    this.clampToArena();
  }

  // Move forward while separating from other mages
  private moveForwardWithSeparation(allies: Fighter[]): void {
    // Move towards arena center
    const toCenterX = this.arenaCenterX - this.x;
    const toCenterY = this.arenaCenterY - this.y;
    const toCenterDist = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY);

    if (toCenterDist <= 1) return;

    let moveX = toCenterX / toCenterDist;
    let moveY = toCenterY / toCenterDist;

    // Add separation from other mages
    const sep = this.calculateMageSeparation(allies);
    moveX += sep.x;
    moveY += sep.y;

    // Normalize and move
    const moveMag = Math.sqrt(moveX * moveX + moveY * moveY);
    if (moveMag > 0) {
      this.x += (moveX / moveMag) * this.speed;
      this.y += (moveY / moveMag) * this.speed;
    }

    // Boundary clamp
    this.clampToArena();
  }

  // Calculate separation force from other mages
  private calculateMageSeparation(allies: Fighter[]): { x: number; y: number } {
    const separationRadius = 12;
    let sepX = 0;
    let sepY = 0;

    for (const ally of allies) {
      if (ally === this || ally.isDead || ally.getType() !== 'mage') continue;

      const ox = this.x - ally.x;
      const oy = this.y - ally.y;
      const dist = Math.sqrt(ox * ox + oy * oy);

      if (dist < separationRadius && dist > 0.1) {
        const strength = (separationRadius - dist) / separationRadius;
        sepX += (ox / dist) * strength * 1.5;
        sepY += (oy / dist) * strength * 1.5;
      }
    }

    return { x: sepX, y: sepY };
  }

  // Clamp position to arena bounds
  private clampToArena(): void {
    const maxDist = 540;
    const dx = this.x - this.arenaCenterX;
    const dy = this.y - this.arenaCenterY;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > maxDist) {
      this.x = this.arenaCenterX + (dx / d) * maxDist;
      this.y = this.arenaCenterY + (dy / d) * maxDist;
    }
  }

  private fireArtillery(allEnemies: Fighter[]): void {
    this.attackCount++;

    // Check for void eruption ability (every 10 attacks)
    if (this.modifiers?.mageVoidEruptionAbility && this.attackCount % 10 === 0 && allEnemies && this.target) {
      this.startVoidEruption(this.target, allEnemies);
      SoundManager.playChainFire();
    } else {
      // Fire ground-targeted artillery bolt
      this.voidBolts.push(new VoidBolt(
        this.x, this.y,
        null, // No target tracking
        this.damage,
        this.team,
        this,
        this.chargeTargetX,
        this.chargeTargetY
      ));
      SoundManager.playFireball();
    }

    this.castAnimation = 20;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    for (const voidBolt of this.voidBolts) {
      voidBolt.draw(ctx);
    }

    // Draw void chains
    for (const chain of this.voidChains) {
      this.drawVoidChain(ctx, chain);
    }

    if (this.isDead) return;

    // Draw target indicator when charging
    if (this.isCharging) {
      const alpha = 0.3 + 0.2 * Math.sin(Date.now() / 100);
      ctx.beginPath();
      ctx.arc(this.chargeTargetX, this.chargeTargetY, 12, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(139, 92, 246, ${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    this.drawStatusEffects(ctx);
    SpriteRenderer.drawMage(ctx, this.x, this.y, this.team, this.castAnimation > 0 ? this.animationFrame + 1 : this.animationFrame, this.isFlashing());
    this.drawHealthBar(ctx);
    this.drawChargeBar(ctx);
  }

  private drawChargeBar(ctx: CanvasRenderingContext2D): void {
    if (!this.isCharging) return;

    const barWidth = 8;
    const barHeight = 2;
    const barX = this.x - barWidth / 2;
    const barY = this.y - 5; // Below health bar

    const chargeProgress = Math.min(this.chargeTime / this.CHARGE_DURATION, 1);

    // Background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(barX, barY, barWidth, barHeight);

    // Charge fill (purple)
    const gradient = ctx.createLinearGradient(barX, barY, barX + barWidth * chargeProgress, barY);
    gradient.addColorStop(0, '#7c3aed');
    gradient.addColorStop(1, '#a855f7');
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, barY, barWidth * chargeProgress, barHeight);

    // Border
    ctx.strokeStyle = '#4c1d95';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(barX, barY, barWidth, barHeight);
  }

  private drawVoidChain(ctx: CanvasRenderingContext2D, chain: VoidChain): void {
    const currentX = chain.x + (chain.targetX - chain.x) * chain.progress;
    const currentY = chain.y + (chain.targetY - chain.y) * chain.progress;

    // Draw void trail
    ctx.save();

    // Draw line from source to current position (purple void colors)
    const gradient = ctx.createLinearGradient(chain.x, chain.y, currentX, currentY);
    gradient.addColorStop(0, 'rgba(88, 28, 135, 0.2)');
    gradient.addColorStop(0.5, 'rgba(139, 92, 246, 0.8)');
    gradient.addColorStop(1, 'rgba(196, 181, 253, 1)');

    ctx.strokeStyle = gradient;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(chain.x, chain.y);
    ctx.lineTo(currentX, currentY);
    ctx.stroke();

    // Draw void head
    const headGradient = ctx.createRadialGradient(currentX, currentY, 0, currentX, currentY, 8);
    headGradient.addColorStop(0, 'rgba(233, 213, 255, 1)');
    headGradient.addColorStop(0.4, 'rgba(167, 139, 250, 1)');
    headGradient.addColorStop(1, 'rgba(124, 58, 237, 0)');

    ctx.beginPath();
    ctx.arc(currentX, currentY, 8, 0, Math.PI * 2);
    ctx.fillStyle = headGradient;
    ctx.fill();

    ctx.restore();
  }
}

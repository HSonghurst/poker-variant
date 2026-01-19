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

  constructor(team: Team, x: number, canvasHeight: number) {
    super(team, x, canvasHeight);
    this.health = 60;
    this.maxHealth = 60;
    this.baseSpeed = 0.4;
    this.speed = 0.4;
    this.baseDamage = 17;
    this.damage = 17;
    this.baseAttackRange = 60;
    this.attackRange = 60;
    this.baseAttackCooldown = 800;
    this.attackCooldown = 800;
  }

  getColor(): string {
    return this.team === 'top' ? '#a855f7' : '#f472b6';
  }

  getType(): FighterType {
    return 'mage';
  }

  protected attack(target: Fighter, allEnemies?: Fighter[]): void {
    const now = Date.now();
    if (now - this.lastAttackTime >= this.attackCooldown) {
      this.attackCount++;

      // Check for void eruption ability (every 10 attacks)
      if (this.modifiers?.mageVoidEruptionAbility && this.attackCount % 10 === 0 && allEnemies) {
        this.startVoidEruption(target, allEnemies);
        SoundManager.playChainFire();
      } else {
        this.voidBolts.push(new VoidBolt(this.x, this.y, target, this.damage, this.team, this));
        SoundManager.playFireball();
      }

      this.lastAttackTime = now;
      this.castAnimation = 20;
    }
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
    super.update(enemies, deltaTime, allies);

    for (const voidBolt of this.voidBolts) {
      voidBolt.update(enemies);
    }

    this.voidBolts = this.voidBolts.filter(v => !v.isDead);

    // Update void chains
    this.updateVoidChains(enemies);

    if (this.castAnimation > 0) {
      this.castAnimation--;
    }
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

    this.drawStatusEffects(ctx);
    SpriteRenderer.drawMage(ctx, this.x, this.y, this.team, this.castAnimation > 0 ? this.animationFrame + 1 : this.animationFrame);
    this.drawHealthBar(ctx);
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

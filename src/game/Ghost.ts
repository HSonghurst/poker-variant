import { Fighter } from './Fighter';
import { SoundManager } from './SoundManager';
import type { Team } from './types';

export class Ghost {
  x: number;
  y: number;
  speed: number = 3;
  damage: number;
  team: Team;
  shooter: Fighter | null;
  isDead: boolean = false;
  angle: number;
  wobbleOffset: number = 0;
  trailParticles: { x: number; y: number; alpha: number }[] = [];

  // Chaining state
  isChaining: boolean = false;
  chainTarget: Fighter | null = null;
  hitEnemies: Set<Fighter> = new Set();

  constructor(x: number, y: number, angle: number, damage: number, team: Team, shooter?: Fighter) {
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.damage = damage;
    this.team = team;
    this.shooter = shooter || null;
  }

  update(enemies: Fighter[]): void {
    if (this.isDead) return;

    // Add trail particle
    if (Math.random() < 0.5) {
      this.trailParticles.push({
        x: this.x + (Math.random() - 0.5) * 6,
        y: this.y + (Math.random() - 0.5) * 6,
        alpha: 0.8
      });
    }

    // Update trail particles
    this.trailParticles = this.trailParticles
      .map(p => ({ ...p, alpha: p.alpha - 0.05 }))
      .filter(p => p.alpha > 0);

    // Wobble for ghostly movement
    this.wobbleOffset += 0.3;

    if (this.isChaining && this.chainTarget) {
      // Chaining mode - home in on target
      if (this.chainTarget.isDead) {
        // Target died, find new one or die
        this.findNextChainTarget(enemies);
        if (!this.chainTarget) {
          this.isDead = true;
          return;
        }
      }

      const dx = this.chainTarget.x - this.x;
      const dy = this.chainTarget.y - this.y;
      this.angle = Math.atan2(dy, dx);
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Move towards target
      const chainSpeed = this.speed * 1.5;
      this.x += Math.cos(this.angle) * chainSpeed;
      this.y += Math.sin(this.angle) * chainSpeed;

      // Check if hit target
      if (distance < 15) {
        this.hitChainTarget(enemies);
      }
    } else {
      // Free flight mode - travel in straight line with wobble
      const wobbleX = Math.sin(this.wobbleOffset) * 1.5;
      const wobbleY = Math.cos(this.wobbleOffset * 1.3) * 1.5;

      this.x += Math.cos(this.angle) * this.speed + wobbleX * 0.2;
      this.y += Math.sin(this.angle) * this.speed + wobbleY * 0.2;

      // Check collision with any enemy
      for (const enemy of enemies) {
        if (enemy.isDead || this.hitEnemies.has(enemy)) continue;
        const dx = enemy.x - this.x;
        const dy = enemy.y - this.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < 15) {
          // Start chaining from this enemy
          this.startChaining(enemy, enemies);
          break;
        }
      }
    }

    // Remove if way off screen
    if (this.x < -200 || this.x > 1200 || this.y < -200 || this.y > 900) {
      this.isDead = true;
    }
  }

  private startChaining(firstTarget: Fighter, enemies: Fighter[]): void {
    this.isChaining = true;
    this.hitEnemies.add(firstTarget);

    // Deal damage and apply death DoT (10 seconds) - skip structures
    const isCrit = Math.random() < 0.1;
    const finalDamage = isCrit ? this.damage * 2 : this.damage;
    firstTarget.takeDamage(finalDamage, this.shooter || undefined, isCrit);
    if (!(firstTarget as any).isStructure) {
      firstTarget.statusEffects.death = Math.max(firstTarget.statusEffects.death, 10);
    }
    SoundManager.playFreeze();

    // Life steal for the wraith
    if (this.shooter) {
      const healAmount = Math.floor(finalDamage * 0.1);
      this.shooter.health = Math.min(this.shooter.maxHealth, this.shooter.health + healAmount);
    }

    // Find next target to chain to
    this.findNextChainTarget(enemies, firstTarget);

    // If no target found, ghost dies
    if (!this.chainTarget) {
      this.isDead = true;
    }
  }

  private hitChainTarget(enemies: Fighter[]): void {
    if (!this.chainTarget) return;

    this.hitEnemies.add(this.chainTarget);

    // Deal reduced damage per chain and apply death DoT (10 seconds) - skip structures
    this.damage *= 0.85;
    const isCrit = Math.random() < 0.1;
    const finalDamage = isCrit ? Math.floor(this.damage * 2) : Math.floor(this.damage);
    this.chainTarget.takeDamage(finalDamage, this.shooter || undefined, isCrit);
    if (!(this.chainTarget as any).isStructure) {
      this.chainTarget.statusEffects.death = Math.max(this.chainTarget.statusEffects.death, 10);
    }

    // Life steal
    if (this.shooter) {
      const healAmount = Math.floor(finalDamage * 0.1);
      this.shooter.health = Math.min(this.shooter.maxHealth, this.shooter.health + healAmount);
    }

    // Find next target
    const previousTarget = this.chainTarget;
    this.findNextChainTarget(enemies, previousTarget);

    // If no target found, ghost dies
    if (!this.chainTarget) {
      this.isDead = true;
    }
  }

  private findNextChainTarget(enemies: Fighter[], fromTarget?: Fighter): void {
    const sourceX = fromTarget ? fromTarget.x : this.x;
    const sourceY = fromTarget ? fromTarget.y : this.y;

    let closest: Fighter | null = null;
    let closestDist = 80; // Chain range

    for (const enemy of enemies) {
      if (enemy.isDead || this.hitEnemies.has(enemy)) continue;
      const dx = enemy.x - sourceX;
      const dy = enemy.y - sourceY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < closestDist) {
        closestDist = dist;
        closest = enemy;
      }
    }

    this.chainTarget = closest;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.isDead) return;

    // Draw trail particles
    for (const particle of this.trailParticles) {
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 255, 255, ${particle.alpha * 0.5})`;
      ctx.fill();
    }

    ctx.save();
    ctx.translate(this.x, this.y);

    // Outer ethereal glow (brighter when chaining)
    const glowIntensity = this.isChaining ? 1 : 0.7;
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 10);
    gradient.addColorStop(0, `rgba(255, 255, 255, ${0.9 * glowIntensity})`);
    gradient.addColorStop(0.3, `rgba(220, 220, 255, ${0.6 * glowIntensity})`);
    gradient.addColorStop(0.6, `rgba(180, 180, 220, ${0.3 * glowIntensity})`);
    gradient.addColorStop(1, 'rgba(150, 150, 200, 0)');

    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Ghost body (small, cute ghost shape)
    ctx.fillStyle = `rgba(255, 255, 255, ${0.9 * glowIntensity})`;
    ctx.beginPath();
    ctx.arc(0, -2, 5, Math.PI, 0, false); // Head
    ctx.lineTo(5, 4);
    // Wavy bottom
    ctx.quadraticCurveTo(3, 2, 2, 5);
    ctx.quadraticCurveTo(0, 3, -2, 5);
    ctx.quadraticCurveTo(-3, 2, -5, 4);
    ctx.lineTo(-5, -2);
    ctx.fill();

    // Eyes (dark, hollow)
    ctx.fillStyle = '#333';
    ctx.beginPath();
    ctx.arc(-2, -1, 1.5, 0, Math.PI * 2);
    ctx.arc(2, -1, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Mouth (small O shape)
    ctx.beginPath();
    ctx.arc(0, 2, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }
}

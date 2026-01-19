import type { Team } from './types';
import type { Player } from './Player';

export type XPOrbTier = 'common' | 'uncommon' | 'rare' | 'epic';

// Tier configuration
const TIER_CONFIG: Record<XPOrbTier, { multiplier: number; radius: number; color: string; glowColor: string }> = {
  common: { multiplier: 1, radius: 3, color: '#ffffff', glowColor: '#88ff88' },
  uncommon: { multiplier: 5, radius: 5, color: '#4ade80', glowColor: '#22c55e' },
  rare: { multiplier: 50, radius: 7, color: '#a855f7', glowColor: '#9333ea' },
  epic: { multiplier: 200, radius: 10, color: '#fbbf24', glowColor: '#f59e0b' }
};

// Drop rates (must sum to 100)
const TIER_WEIGHTS: { tier: XPOrbTier; weight: number }[] = [
  { tier: 'common', weight: 80 },
  { tier: 'uncommon', weight: 18 },
  { tier: 'rare', weight: 1.9 },
  { tier: 'epic', weight: 0.1 }
];

export function pickRandomTier(): XPOrbTier {
  const roll = Math.random() * 100;
  let cumulative = 0;
  for (const { tier, weight } of TIER_WEIGHTS) {
    cumulative += weight;
    if (roll < cumulative) return tier;
  }
  return 'common';
}

export class XPOrb {
  x: number;
  y: number;
  targetTeam: Team; // Team that will collect this orb
  value: number;
  tier: XPOrbTier;
  speed: number = 0.03;
  radius: number;
  collected: boolean = false;
  attractedToPlayer: boolean = false;
  private pulsePhase: number = Math.random() * Math.PI * 2;

  constructor(x: number, y: number, targetTeam: Team, baseValue: number = 10, tier?: XPOrbTier) {
    this.x = x;
    this.y = y;
    this.targetTeam = targetTeam;
    this.tier = tier || pickRandomTier();
    const config = TIER_CONFIG[this.tier];
    this.value = baseValue * config.multiplier;
    this.radius = config.radius;
  }

  update(deltaTime: number, canvasHeight: number, player?: Player): void {
    if (this.collected) return;

    // Check if player is within attract radius
    if (player && player.team === this.targetTeam) {
      const dist = player.getDistanceTo(this.x, this.y);

      // Collect if within collect radius
      if (dist <= player.collectRadius) {
        this.collected = true;
        return;
      }

      // Attract if within attract radius
      if (dist <= player.attractRadius) {
        this.attractedToPlayer = true;
        const attractSpeed = 0.15 * deltaTime;
        const dx = player.x - this.x;
        const dy = player.y - this.y;
        this.x += (dx / dist) * attractSpeed;
        this.y += (dy / dist) * attractSpeed;
        return;
      }
    }

    this.attractedToPlayer = false;

    // Drift toward the target team's side
    const direction = this.targetTeam === 'top' ? -1 : 1;

    this.y += direction * this.speed * deltaTime;

    // Check if reached collection zone
    if (this.targetTeam === 'top' && this.y <= 80) {
      this.collected = true;
    } else if (this.targetTeam === 'bottom' && this.y >= canvasHeight - 80) {
      this.collected = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.collected) return;

    const config = TIER_CONFIG[this.tier];
    this.pulsePhase += 0.1;
    const pulse = 1 + Math.sin(this.pulsePhase) * 0.2;

    // Outer glow for rare+ orbs
    if (this.tier !== 'common') {
      const glowRadius = this.radius * 3 * pulse;
      const glowGradient = ctx.createRadialGradient(
        this.x, this.y, 0,
        this.x, this.y, glowRadius
      );
      glowGradient.addColorStop(0, `${config.glowColor}60`);
      glowGradient.addColorStop(0.5, `${config.glowColor}30`);
      glowGradient.addColorStop(1, 'transparent');

      ctx.fillStyle = glowGradient;
      ctx.beginPath();
      ctx.arc(this.x, this.y, glowRadius, 0, Math.PI * 2);
      ctx.fill();
    }

    // Main orb gradient
    const gradient = ctx.createRadialGradient(
      this.x, this.y, 0,
      this.x, this.y, this.radius * pulse
    );

    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(0.4, config.color);
    gradient.addColorStop(0.8, config.glowColor);
    gradient.addColorStop(1, 'transparent');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 2 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Inner bright core
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius * 0.4, 0, Math.PI * 2);
    ctx.fill();

    // Sparkle effect for epic orbs
    if (this.tier === 'epic') {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const angle = this.pulsePhase + (i * Math.PI / 2);
        const sparkleX = this.x + Math.cos(angle) * this.radius * 1.5;
        const sparkleY = this.y + Math.sin(angle) * this.radius * 1.5;
        ctx.beginPath();
        ctx.moveTo(sparkleX - 3, sparkleY);
        ctx.lineTo(sparkleX + 3, sparkleY);
        ctx.moveTo(sparkleX, sparkleY - 3);
        ctx.lineTo(sparkleX, sparkleY + 3);
        ctx.stroke();
      }
    }
  }
}

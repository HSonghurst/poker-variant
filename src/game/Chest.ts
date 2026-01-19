import { SoundManager } from './SoundManager';
import type { Player } from './Player';

export class Chest {
  x: number;
  y: number;
  width: number = 20;
  height: number = 16;
  isOpened: boolean = false;
  collectRadius: number = 25;

  // Animation
  private bobOffset: number = 0;
  private bobTimer: number = 0;
  private sparkleTimer: number = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  update(deltaTime: number, player: Player | null): void {
    if (this.isOpened) return;

    // Bob animation
    this.bobTimer += deltaTime;
    this.bobOffset = Math.sin(this.bobTimer / 300) * 2;

    // Sparkle timer
    this.sparkleTimer += deltaTime;

    // Check if player walks over chest
    if (player && !player.isDead) {
      const dx = player.x - this.x;
      const dy = player.y - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= this.collectRadius) {
        this.open();
      }
    }
  }

  private open(): void {
    this.isOpened = true;
    // Play ding sound (using level up sound as placeholder)
    SoundManager.playLevelUp();
    // TODO: Give player item
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.isOpened) return;

    const drawY = this.y + this.bobOffset;

    // Draw chest base (brown wooden chest)
    ctx.fillStyle = '#8B4513'; // Saddle brown
    ctx.fillRect(this.x - this.width / 2, drawY - this.height / 2, this.width, this.height);

    // Chest lid (darker brown)
    ctx.fillStyle = '#654321';
    ctx.fillRect(this.x - this.width / 2, drawY - this.height / 2, this.width, this.height / 3);

    // Gold trim
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(this.x - 3, drawY - this.height / 2, 6, this.height);
    ctx.fillRect(this.x - this.width / 2, drawY - 2, this.width, 4);

    // Lock
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(this.x, drawY, 3, 0, Math.PI * 2);
    ctx.fill();

    // Sparkle effect
    const sparklePhase = (this.sparkleTimer / 500) % 1;
    const sparkleAlpha = Math.sin(sparklePhase * Math.PI);

    ctx.fillStyle = `rgba(255, 255, 200, ${sparkleAlpha * 0.8})`;
    const sparkleOffsets = [
      { x: -8, y: -10 },
      { x: 10, y: -8 },
      { x: -6, y: 8 },
      { x: 8, y: 6 },
    ];

    for (let i = 0; i < sparkleOffsets.length; i++) {
      const offset = sparkleOffsets[i];
      const phase = (sparklePhase + i * 0.25) % 1;
      const alpha = Math.sin(phase * Math.PI);
      if (alpha > 0.3) {
        ctx.fillStyle = `rgba(255, 255, 200, ${alpha * 0.6})`;
        const size = 2 + alpha * 2;
        ctx.fillRect(this.x + offset.x - size / 2, drawY + offset.y - size / 2, size, size);
      }
    }

    // Glow effect
    const gradient = ctx.createRadialGradient(this.x, drawY, 0, this.x, drawY, 30);
    gradient.addColorStop(0, 'rgba(255, 215, 0, 0.2)');
    gradient.addColorStop(1, 'rgba(255, 215, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(this.x, drawY, 30, 0, Math.PI * 2);
    ctx.fill();
  }
}

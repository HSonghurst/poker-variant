export class DamageNumber {
  x: number;
  y: number;
  value: number;
  age: number = 0;
  maxAge: number = 800; // milliseconds
  isDead: boolean = false;
  color: string;

  constructor(x: number, y: number, value: number, color?: string) {
    this.x = x + (Math.random() - 0.5) * 10; // Slight random offset
    this.y = y;
    this.value = Math.round(value);
    this.color = color || '#ffffff';
  }

  update(deltaTime: number): void {
    if (this.isDead) return;

    this.age += deltaTime;
    this.y -= deltaTime * 0.03; // Float upward

    if (this.age >= this.maxAge) {
      this.isDead = true;
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.isDead) return;

    const alpha = 0.5 * (1 - (this.age / this.maxAge)); // 50% opacity, fading out
    const scale = 1 + (this.age / this.maxAge) * 0.3; // Grow slightly

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.font = `bold ${Math.round(7 * scale)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Outline
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.strokeText(`${this.value}`, this.x, this.y);

    // Fill
    ctx.fillStyle = this.color;
    ctx.fillText(`${this.value}`, this.x, this.y);

    ctx.restore();
  }
}

// Global damage number manager
export class DamageNumberManager {
  private static numbers: DamageNumber[] = [];

  static spawn(x: number, y: number, value: number, color?: string): void {
    this.numbers.push(new DamageNumber(x, y, value, color));
  }

  static update(deltaTime: number): void {
    for (const num of this.numbers) {
      num.update(deltaTime);
    }
    this.numbers = this.numbers.filter(n => !n.isDead);
  }

  static draw(ctx: CanvasRenderingContext2D): void {
    for (const num of this.numbers) {
      num.draw(ctx);
    }
  }

  static clear(): void {
    this.numbers = [];
  }
}

// Hexagon grid system for unit placement
// Uses "pointy-top" hexagons with offset coordinates (odd-q)

export interface HexCoord {
  col: number;
  row: number;
}

export interface PixelCoord {
  x: number;
  y: number;
}

export class HexGrid {
  private cols: number;
  private rows: number;
  private hexSize: number; // Distance from center to corner
  private originX: number;
  private originY: number;
  private occupied: Map<string, boolean> = new Map();

  // Hex dimensions
  private hexWidth: number;
  private hexHeight: number;
  private vertSpacing: number;
  private horizSpacing: number;

  constructor(cols: number, rows: number, hexSize: number, originX: number, originY: number) {
    this.cols = cols;
    this.rows = rows;
    this.hexSize = hexSize;
    this.originX = originX;
    this.originY = originY;

    // Calculate hex dimensions for pointy-top hexagons
    this.hexWidth = Math.sqrt(3) * hexSize;
    this.hexHeight = 2 * hexSize;
    this.horizSpacing = this.hexWidth;
    this.vertSpacing = this.hexHeight * 0.75;
  }

  // Get pixel coordinates for the center of a hex
  hexToPixel(hex: HexCoord): PixelCoord {
    const x = this.originX + hex.col * this.horizSpacing + (hex.row % 2 === 1 ? this.horizSpacing / 2 : 0);
    const y = this.originY + hex.row * this.vertSpacing;
    return { x, y };
  }

  // Get hex coordinates from pixel coordinates
  pixelToHex(pixel: PixelCoord): HexCoord {
    // Adjust for origin
    const px = pixel.x - this.originX;
    const py = pixel.y - this.originY;

    // Approximate row
    const row = Math.round(py / this.vertSpacing);

    // Adjust x for odd rows
    const adjustedX = px - (row % 2 === 1 ? this.horizSpacing / 2 : 0);
    const col = Math.round(adjustedX / this.horizSpacing);

    // Clamp to grid bounds
    return {
      col: Math.max(0, Math.min(this.cols - 1, col)),
      row: Math.max(0, Math.min(this.rows - 1, row))
    };
  }

  // Get the nearest valid hex to a pixel position
  getNearestHex(pixel: PixelCoord): HexCoord {
    return this.pixelToHex(pixel);
  }

  // Check if a hex is within bounds
  isValidHex(hex: HexCoord): boolean {
    return hex.col >= 0 && hex.col < this.cols && hex.row >= 0 && hex.row < this.rows;
  }

  // Check if a hex is in the player's half (bottom half)
  isPlayerHalf(hex: HexCoord): boolean {
    return hex.row >= Math.floor(this.rows / 2);
  }

  // Check if a hex is in the opponent's half (top half)
  isOpponentHalf(hex: HexCoord): boolean {
    return hex.row < Math.floor(this.rows / 2);
  }

  // Occupation management
  private hexKey(hex: HexCoord): string {
    return `${hex.col},${hex.row}`;
  }

  setOccupied(hex: HexCoord, occupied: boolean): void {
    if (occupied) {
      this.occupied.set(this.hexKey(hex), true);
    } else {
      this.occupied.delete(this.hexKey(hex));
    }
  }

  isOccupied(hex: HexCoord): boolean {
    return this.occupied.has(this.hexKey(hex));
  }

  clearOccupied(): void {
    this.occupied.clear();
  }

  // Get all hexes
  getAllHexes(): HexCoord[] {
    const hexes: HexCoord[] = [];
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        hexes.push({ col, row });
      }
    }
    return hexes;
  }

  // Get player half hexes
  getPlayerHexes(): HexCoord[] {
    return this.getAllHexes().filter(h => this.isPlayerHalf(h));
  }

  // Get opponent half hexes
  getOpponentHexes(): HexCoord[] {
    return this.getAllHexes().filter(h => this.isOpponentHalf(h));
  }

  // Draw the grid
  draw(ctx: CanvasRenderingContext2D, highlightPlayerHalf: boolean = false): void {
    for (let row = 0; row < this.rows; row++) {
      for (let col = 0; col < this.cols; col++) {
        const hex = { col, row };
        const center = this.hexToPixel(hex);
        const isPlayer = this.isPlayerHalf(hex);
        const isOccupied = this.isOccupied(hex);

        // Draw hexagon
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const angle = (Math.PI / 3) * i - Math.PI / 6; // Pointy-top
          const hx = center.x + this.hexSize * Math.cos(angle);
          const hy = center.y + this.hexSize * Math.sin(angle);
          if (i === 0) {
            ctx.moveTo(hx, hy);
          } else {
            ctx.lineTo(hx, hy);
          }
        }
        ctx.closePath();

        // Fill based on state
        if (isOccupied) {
          ctx.fillStyle = 'rgba(255, 215, 0, 0.2)';
        } else if (highlightPlayerHalf && isPlayer) {
          ctx.fillStyle = 'rgba(217, 74, 74, 0.15)';
        } else {
          ctx.fillStyle = 'rgba(0, 0, 0, 0.1)';
        }
        ctx.fill();

        // Stroke
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }
  }

  // Draw a highlighted hex (for hover/selection)
  drawHighlightedHex(ctx: CanvasRenderingContext2D, hex: HexCoord, color: string): void {
    const center = this.hexToPixel(hex);

    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI / 3) * i - Math.PI / 6;
      const hx = center.x + this.hexSize * Math.cos(angle);
      const hy = center.y + this.hexSize * Math.sin(angle);
      if (i === 0) {
        ctx.moveTo(hx, hy);
      } else {
        ctx.lineTo(hx, hy);
      }
    }
    ctx.closePath();

    ctx.fillStyle = color;
    ctx.fill();

    ctx.strokeStyle = '#ffd700';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Getters
  getCols(): number { return this.cols; }
  getRows(): number { return this.rows; }
  getHexSize(): number { return this.hexSize; }
  getHexWidth(): number { return this.hexWidth; }
  getHexHeight(): number { return this.hexHeight; }
}

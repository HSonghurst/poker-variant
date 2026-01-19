import type { Team } from './types';

// Pixel art sprite renderer for units
export class SpriteRenderer {
  // Draw a pixel at a specific position (scaled)
  private static pixel(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string): void {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, size, size);
  }

  static drawTower(ctx: CanvasRenderingContext2D, x: number, y: number, team: Team): void {
    const p = 4; // pixel size for tower (larger)
    const baseX = x - 6 * p;
    const baseY = y - 10 * p;

    const stone = team === 'top' ? '#4a5568' : '#78716c';
    const stoneDark = team === 'top' ? '#2d3748' : '#57534e';
    const stoneLight = team === 'top' ? '#718096' : '#a8a29e';
    const accent = team === 'top' ? '#3b82f6' : '#ef4444';
    const accentDark = team === 'top' ? '#1d4ed8' : '#b91c1c';
    const window = '#1a1a2e';

    // Tower top battlements
    this.pixel(ctx, baseX + 0*p, baseY, p, stoneDark);
    this.pixel(ctx, baseX + 1*p, baseY, p, stone);
    this.pixel(ctx, baseX + 3*p, baseY, p, stoneDark);
    this.pixel(ctx, baseX + 4*p, baseY, p, stone);
    this.pixel(ctx, baseX + 6*p, baseY, p, stoneDark);
    this.pixel(ctx, baseX + 7*p, baseY, p, stone);
    this.pixel(ctx, baseX + 9*p, baseY, p, stoneDark);
    this.pixel(ctx, baseX + 10*p, baseY, p, stone);

    // Second row battlements
    this.pixel(ctx, baseX + 0*p, baseY + p, p, stone);
    this.pixel(ctx, baseX + 1*p, baseY + p, p, stoneLight);
    this.pixel(ctx, baseX + 3*p, baseY + p, p, stone);
    this.pixel(ctx, baseX + 4*p, baseY + p, p, stoneLight);
    this.pixel(ctx, baseX + 6*p, baseY + p, p, stone);
    this.pixel(ctx, baseX + 7*p, baseY + p, p, stoneLight);
    this.pixel(ctx, baseX + 9*p, baseY + p, p, stone);
    this.pixel(ctx, baseX + 10*p, baseY + p, p, stoneLight);

    // Flag pole and flag
    this.pixel(ctx, baseX + 5*p, baseY - 3*p, p, '#8B4513');
    this.pixel(ctx, baseX + 5*p, baseY - 2*p, p, '#8B4513');
    this.pixel(ctx, baseX + 5*p, baseY - p, p, '#8B4513');
    this.pixel(ctx, baseX + 6*p, baseY - 3*p, p, accent);
    this.pixel(ctx, baseX + 7*p, baseY - 3*p, p, accent);
    this.pixel(ctx, baseX + 6*p, baseY - 2*p, p, accentDark);

    // Main tower body
    for (let row = 2; row < 12; row++) {
      this.pixel(ctx, baseX + p, baseY + row*p, p, stoneDark);
      for (let col = 2; col < 10; col++) {
        const isLightRow = row % 2 === 0;
        const isLightCol = col % 2 === 0;
        const color = (isLightRow === isLightCol) ? stone : stoneLight;
        this.pixel(ctx, baseX + col*p, baseY + row*p, p, color);
      }
      this.pixel(ctx, baseX + 10*p, baseY + row*p, p, stoneDark);
    }

    // Windows
    this.pixel(ctx, baseX + 4*p, baseY + 4*p, p, window);
    this.pixel(ctx, baseX + 7*p, baseY + 4*p, p, window);
    this.pixel(ctx, baseX + 4*p, baseY + 5*p, p, window);
    this.pixel(ctx, baseX + 7*p, baseY + 5*p, p, window);

    // Door
    this.pixel(ctx, baseX + 5*p, baseY + 9*p, p, accentDark);
    this.pixel(ctx, baseX + 6*p, baseY + 9*p, p, accentDark);
    this.pixel(ctx, baseX + 5*p, baseY + 10*p, p, accent);
    this.pixel(ctx, baseX + 6*p, baseY + 10*p, p, accent);
    this.pixel(ctx, baseX + 5*p, baseY + 11*p, p, accent);
    this.pixel(ctx, baseX + 6*p, baseY + 11*p, p, accent);

    // Base foundation
    this.pixel(ctx, baseX, baseY + 12*p, p, stoneDark);
    for (let col = 1; col < 11; col++) {
      this.pixel(ctx, baseX + col*p, baseY + 12*p, p, stoneDark);
    }
    this.pixel(ctx, baseX + 11*p, baseY + 12*p, p, stoneDark);
  }

  static drawSwordsman(ctx: CanvasRenderingContext2D, x: number, y: number, team: Team, frame: number): void {
    const p = 4; // pixel size (larger for full-screen canvas)
    const baseX = x - 5 * p;
    const baseY = y - 6 * p;
    const bobOffset = Math.sin(frame * Math.PI / 2) * 1;

    if (team === 'top') {
      // Goblin Warrior - green skin, crude armor, jagged sword
      const skin = '#4a7c3f';
      const skinDark = '#3d6634';
      const armor = '#5c4033';
      const armorDark = '#3d2817';
      const sword = '#8b8b8b';

      // Pointy ears
      this.pixel(ctx, baseX + 2*p, baseY + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 7*p, baseY + bobOffset, p, skinDark);

      // Head (no helmet, bald)
      this.pixel(ctx, baseX + 3*p, baseY + bobOffset, p, skin);
      this.pixel(ctx, baseX + 4*p, baseY + bobOffset, p, skin);
      this.pixel(ctx, baseX + 5*p, baseY + bobOffset, p, skin);
      this.pixel(ctx, baseX + 6*p, baseY + bobOffset, p, skin);

      // Face with angry eyes
      this.pixel(ctx, baseX + 3*p, baseY + p + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 4*p, baseY + p + bobOffset, p, '#ff0000'); // Red eye
      this.pixel(ctx, baseX + 5*p, baseY + p + bobOffset, p, '#ff0000'); // Red eye
      this.pixel(ctx, baseX + 6*p, baseY + p + bobOffset, p, skinDark);

      // Body (leather armor)
      this.pixel(ctx, baseX + 3*p, baseY + 2*p + bobOffset, p, armorDark);
      this.pixel(ctx, baseX + 4*p, baseY + 2*p + bobOffset, p, armor);
      this.pixel(ctx, baseX + 5*p, baseY + 2*p + bobOffset, p, armor);
      this.pixel(ctx, baseX + 6*p, baseY + 2*p + bobOffset, p, armorDark);
      this.pixel(ctx, baseX + 3*p, baseY + 3*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 4*p, baseY + 3*p + bobOffset, p, armor);
      this.pixel(ctx, baseX + 5*p, baseY + 3*p + bobOffset, p, armor);
      this.pixel(ctx, baseX + 6*p, baseY + 3*p + bobOffset, p, skin);

      // Legs
      this.pixel(ctx, baseX + 3*p, baseY + 4*p + bobOffset, p, armorDark);
      this.pixel(ctx, baseX + 4*p, baseY + 4*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 5*p, baseY + 4*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 6*p, baseY + 4*p + bobOffset, p, armorDark);
      this.pixel(ctx, baseX + 4*p, baseY + 5*p + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 5*p, baseY + 5*p + bobOffset, p, skinDark);

      // Crude jagged sword
      const swordOffset = frame % 2 === 0 ? 0 : p;
      this.pixel(ctx, baseX + 8*p, baseY + 2*p + bobOffset - swordOffset, p, sword);
      this.pixel(ctx, baseX + 8*p, baseY + 1*p + bobOffset - swordOffset, p, sword);
      this.pixel(ctx, baseX + 9*p, baseY + bobOffset - swordOffset, p, sword);
      this.pixel(ctx, baseX + 8*p, baseY + 3*p + bobOffset - swordOffset, p, '#3d2817');
    } else {
      // Human Swordsman
      const skin = '#ffd5b5';
      const armor = '#ef4444';
      const armorDark = '#b91c1c';
      const sword = '#c0c0c0';
      const swordHilt = '#8B4513';

      // Helmet
      this.pixel(ctx, baseX + 3*p, baseY + bobOffset, p, armorDark);
      this.pixel(ctx, baseX + 4*p, baseY + bobOffset, p, armor);
      this.pixel(ctx, baseX + 5*p, baseY + bobOffset, p, armor);
      this.pixel(ctx, baseX + 6*p, baseY + bobOffset, p, armorDark);

      // Face
      this.pixel(ctx, baseX + 3*p, baseY + p + bobOffset, p, armor);
      this.pixel(ctx, baseX + 4*p, baseY + p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 5*p, baseY + p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 6*p, baseY + p + bobOffset, p, armor);

      // Body
      for (let i = 0; i < 3; i++) {
        this.pixel(ctx, baseX + 3*p, baseY + (2+i)*p + bobOffset, p, armorDark);
        this.pixel(ctx, baseX + 4*p, baseY + (2+i)*p + bobOffset, p, armor);
        this.pixel(ctx, baseX + 5*p, baseY + (2+i)*p + bobOffset, p, armor);
        this.pixel(ctx, baseX + 6*p, baseY + (2+i)*p + bobOffset, p, armorDark);
      }

      // Legs
      this.pixel(ctx, baseX + 3*p, baseY + 5*p + bobOffset, p, armorDark);
      this.pixel(ctx, baseX + 4*p, baseY + 5*p + bobOffset, p, armorDark);
      this.pixel(ctx, baseX + 5*p, baseY + 5*p + bobOffset, p, armorDark);
      this.pixel(ctx, baseX + 6*p, baseY + 5*p + bobOffset, p, armorDark);

      // Sword (animated)
      const swordOffset = frame % 2 === 0 ? 0 : p;
      this.pixel(ctx, baseX + 8*p, baseY + 2*p + bobOffset - swordOffset, p, sword);
      this.pixel(ctx, baseX + 8*p, baseY + 1*p + bobOffset - swordOffset, p, sword);
      this.pixel(ctx, baseX + 8*p, baseY + bobOffset - swordOffset, p, sword);
      this.pixel(ctx, baseX + 8*p, baseY + 3*p + bobOffset - swordOffset, p, swordHilt);
    }
  }

  static drawArcher(ctx: CanvasRenderingContext2D, x: number, y: number, team: Team, frame: number): void {
    const p = 4;
    const baseX = x - 5 * p;
    const baseY = y - 6 * p;
    const bobOffset = Math.sin(frame * Math.PI / 2) * 1;

    if (team === 'top') {
      // Goblin Archer - green skin, crude short bow
      const skin = '#4a7c3f';
      const skinDark = '#3d6634';
      const cloth = '#5c4033';
      const clothDark = '#3d2817';
      const bow = '#6b4423';

      // Pointy ears
      this.pixel(ctx, baseX + 2*p, baseY + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 7*p, baseY + bobOffset, p, skinDark);

      // Head (no hood, bald)
      this.pixel(ctx, baseX + 3*p, baseY + bobOffset, p, skin);
      this.pixel(ctx, baseX + 4*p, baseY + bobOffset, p, skin);
      this.pixel(ctx, baseX + 5*p, baseY + bobOffset, p, skin);
      this.pixel(ctx, baseX + 6*p, baseY + bobOffset, p, skin);

      // Face with yellow eyes
      this.pixel(ctx, baseX + 3*p, baseY + p + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 4*p, baseY + p + bobOffset, p, '#ffff00'); // Yellow eye
      this.pixel(ctx, baseX + 5*p, baseY + p + bobOffset, p, '#ffff00'); // Yellow eye
      this.pixel(ctx, baseX + 6*p, baseY + p + bobOffset, p, skinDark);

      // Body (leather vest)
      this.pixel(ctx, baseX + 4*p, baseY + 2*p + bobOffset, p, cloth);
      this.pixel(ctx, baseX + 5*p, baseY + 2*p + bobOffset, p, cloth);
      this.pixel(ctx, baseX + 3*p, baseY + 2*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 6*p, baseY + 2*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 4*p, baseY + 3*p + bobOffset, p, clothDark);
      this.pixel(ctx, baseX + 5*p, baseY + 3*p + bobOffset, p, clothDark);

      // Legs
      this.pixel(ctx, baseX + 4*p, baseY + 4*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 5*p, baseY + 4*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 4*p, baseY + 5*p + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 5*p, baseY + 5*p + bobOffset, p, skinDark);

      // Crude short bow
      this.pixel(ctx, baseX + 7*p, baseY + 1*p + bobOffset, p, bow);
      this.pixel(ctx, baseX + 8*p, baseY + 2*p + bobOffset, p, bow);
      this.pixel(ctx, baseX + 8*p, baseY + 3*p + bobOffset, p, bow);
      this.pixel(ctx, baseX + 7*p, baseY + 4*p + bobOffset, p, bow);
    } else {
      // Human Archer
      const skin = '#ffd5b5';
      const cloth = '#f97316';
      const clothDark = '#c2410c';
      const hair = '#5c3317';
      const bow = '#8B4513';

      // Hair/Hood
      this.pixel(ctx, baseX + 3*p, baseY + bobOffset, p, clothDark);
      this.pixel(ctx, baseX + 4*p, baseY + bobOffset, p, cloth);
      this.pixel(ctx, baseX + 5*p, baseY + bobOffset, p, cloth);
      this.pixel(ctx, baseX + 6*p, baseY + bobOffset, p, clothDark);

      // Face
      this.pixel(ctx, baseX + 3*p, baseY + p + bobOffset, p, hair);
      this.pixel(ctx, baseX + 4*p, baseY + p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 5*p, baseY + p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 6*p, baseY + p + bobOffset, p, hair);

      // Body (slimmer)
      this.pixel(ctx, baseX + 4*p, baseY + 2*p + bobOffset, p, cloth);
      this.pixel(ctx, baseX + 5*p, baseY + 2*p + bobOffset, p, cloth);
      this.pixel(ctx, baseX + 4*p, baseY + 3*p + bobOffset, p, clothDark);
      this.pixel(ctx, baseX + 5*p, baseY + 3*p + bobOffset, p, clothDark);

      // Legs
      this.pixel(ctx, baseX + 4*p, baseY + 4*p + bobOffset, p, clothDark);
      this.pixel(ctx, baseX + 5*p, baseY + 4*p + bobOffset, p, clothDark);
      this.pixel(ctx, baseX + 4*p, baseY + 5*p + bobOffset, p, '#3d2817');
      this.pixel(ctx, baseX + 5*p, baseY + 5*p + bobOffset, p, '#3d2817');

      // Bow
      this.pixel(ctx, baseX + 7*p, baseY + 1*p + bobOffset, p, bow);
      this.pixel(ctx, baseX + 8*p, baseY + 2*p + bobOffset, p, bow);
      this.pixel(ctx, baseX + 8*p, baseY + 3*p + bobOffset, p, bow);
      this.pixel(ctx, baseX + 7*p, baseY + 4*p + bobOffset, p, bow);
    }
  }

  static drawMage(ctx: CanvasRenderingContext2D, x: number, y: number, team: Team, frame: number): void {
    const p = 4;
    const baseX = x - 5 * p;
    const baseY = y - 6 * p;
    const bobOffset = Math.sin(frame * Math.PI / 2) * 1;

    if (team === 'top') {
      // Goblin Shaman - green skin, skull staff, tribal markings
      const skin = '#4a7c3f';
      const skinDark = '#3d6634';
      const loincloth = '#5c4033';
      const staff = '#4a2f18';
      const skull = '#f5f5dc';
      const warpaint = '#8b0000';

      // Pointy ears
      this.pixel(ctx, baseX + 2*p, baseY + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 7*p, baseY + bobOffset, p, skinDark);

      // Head (bald with tribal markings)
      this.pixel(ctx, baseX + 3*p, baseY + bobOffset, p, skin);
      this.pixel(ctx, baseX + 4*p, baseY + bobOffset, p, warpaint); // War paint
      this.pixel(ctx, baseX + 5*p, baseY + bobOffset, p, warpaint); // War paint
      this.pixel(ctx, baseX + 6*p, baseY + bobOffset, p, skin);

      // Face with glowing green eyes
      this.pixel(ctx, baseX + 3*p, baseY + p + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 4*p, baseY + p + bobOffset, p, '#00ff00'); // Green glowing eye
      this.pixel(ctx, baseX + 5*p, baseY + p + bobOffset, p, '#00ff00'); // Green glowing eye
      this.pixel(ctx, baseX + 6*p, baseY + p + bobOffset, p, skinDark);

      // Bare torso with tribal paint
      this.pixel(ctx, baseX + 3*p, baseY + 2*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 4*p, baseY + 2*p + bobOffset, p, warpaint);
      this.pixel(ctx, baseX + 5*p, baseY + 2*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 6*p, baseY + 2*p + bobOffset, p, skin);

      this.pixel(ctx, baseX + 3*p, baseY + 3*p + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 4*p, baseY + 3*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 5*p, baseY + 3*p + bobOffset, p, warpaint);
      this.pixel(ctx, baseX + 6*p, baseY + 3*p + bobOffset, p, skinDark);

      // Loincloth
      this.pixel(ctx, baseX + 3*p, baseY + 4*p + bobOffset, p, loincloth);
      this.pixel(ctx, baseX + 4*p, baseY + 4*p + bobOffset, p, loincloth);
      this.pixel(ctx, baseX + 5*p, baseY + 4*p + bobOffset, p, loincloth);
      this.pixel(ctx, baseX + 6*p, baseY + 4*p + bobOffset, p, loincloth);

      // Legs
      this.pixel(ctx, baseX + 4*p, baseY + 5*p + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 5*p, baseY + 5*p + bobOffset, p, skinDark);

      // Skull staff
      this.pixel(ctx, baseX + 8*p, baseY + 2*p + bobOffset, p, staff);
      this.pixel(ctx, baseX + 8*p, baseY + 3*p + bobOffset, p, staff);
      this.pixel(ctx, baseX + 8*p, baseY + 4*p + bobOffset, p, staff);

      // Skull on top (animated glow)
      const glowColor = frame % 2 === 0 ? skull : '#22ff22';
      this.pixel(ctx, baseX + 8*p, baseY + bobOffset, p, glowColor);
      this.pixel(ctx, baseX + 8*p, baseY + p + bobOffset, p, skull);
    } else {
      // Human Mage
      const skin = '#ffd5b5';
      const robe = '#f472b6';
      const robeDark = '#db2777';
      const staff = '#8B4513';
      const orb = '#fbbf24';

      // Hat point
      this.pixel(ctx, baseX + 4*p, baseY - p + bobOffset, p, robeDark);
      this.pixel(ctx, baseX + 5*p, baseY - p + bobOffset, p, robeDark);

      // Hat brim
      this.pixel(ctx, baseX + 2*p, baseY + bobOffset, p, robe);
      this.pixel(ctx, baseX + 3*p, baseY + bobOffset, p, robe);
      this.pixel(ctx, baseX + 4*p, baseY + bobOffset, p, robe);
      this.pixel(ctx, baseX + 5*p, baseY + bobOffset, p, robe);
      this.pixel(ctx, baseX + 6*p, baseY + bobOffset, p, robe);
      this.pixel(ctx, baseX + 7*p, baseY + bobOffset, p, robe);

      // Face
      this.pixel(ctx, baseX + 4*p, baseY + p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 5*p, baseY + p + bobOffset, p, skin);

      // Robe body
      this.pixel(ctx, baseX + 3*p, baseY + 2*p + bobOffset, p, robeDark);
      this.pixel(ctx, baseX + 4*p, baseY + 2*p + bobOffset, p, robe);
      this.pixel(ctx, baseX + 5*p, baseY + 2*p + bobOffset, p, robe);
      this.pixel(ctx, baseX + 6*p, baseY + 2*p + bobOffset, p, robeDark);

      this.pixel(ctx, baseX + 2*p, baseY + 3*p + bobOffset, p, robeDark);
      this.pixel(ctx, baseX + 3*p, baseY + 3*p + bobOffset, p, robe);
      this.pixel(ctx, baseX + 4*p, baseY + 3*p + bobOffset, p, robe);
      this.pixel(ctx, baseX + 5*p, baseY + 3*p + bobOffset, p, robe);
      this.pixel(ctx, baseX + 6*p, baseY + 3*p + bobOffset, p, robe);
      this.pixel(ctx, baseX + 7*p, baseY + 3*p + bobOffset, p, robeDark);

      // Robe bottom
      this.pixel(ctx, baseX + 3*p, baseY + 4*p + bobOffset, p, robeDark);
      this.pixel(ctx, baseX + 4*p, baseY + 4*p + bobOffset, p, robe);
      this.pixel(ctx, baseX + 5*p, baseY + 4*p + bobOffset, p, robe);
      this.pixel(ctx, baseX + 6*p, baseY + 4*p + bobOffset, p, robeDark);

      // Staff with orb
      this.pixel(ctx, baseX + 8*p, baseY + 2*p + bobOffset, p, staff);
      this.pixel(ctx, baseX + 8*p, baseY + 3*p + bobOffset, p, staff);
      this.pixel(ctx, baseX + 8*p, baseY + 4*p + bobOffset, p, staff);

      // Glowing orb (animated)
      const glowColor = frame % 2 === 0 ? orb : '#fcd34d';
      this.pixel(ctx, baseX + 8*p, baseY + p + bobOffset, p, glowColor);
    }
  }

  static drawKnight(ctx: CanvasRenderingContext2D, x: number, y: number, team: Team, frame: number): void {
    const p = 4;
    const baseX = x - 5 * p;
    const baseY = y - 6 * p;
    const bobOffset = Math.sin(frame * Math.PI / 2) * 1;

    if (team === 'top') {
      // Goblin Brute - green skin, crude spiked helmet, wooden shield
      const skin = '#4a7c3f';
      const skinDark = '#3d6634';
      const helmet = '#4a4a4a';
      const helmetDark = '#2d2d2d';
      const spike = '#6b6b6b';
      const shield = '#6b4423';
      const shieldDark = '#4a2f18';

      // Spiked helmet
      this.pixel(ctx, baseX + 3*p, baseY - p + bobOffset, p, spike);
      this.pixel(ctx, baseX + 5*p, baseY - 2*p + bobOffset, p, spike);
      this.pixel(ctx, baseX + 6*p, baseY - p + bobOffset, p, spike);

      // Helmet
      this.pixel(ctx, baseX + 3*p, baseY + bobOffset, p, helmetDark);
      this.pixel(ctx, baseX + 4*p, baseY + bobOffset, p, helmet);
      this.pixel(ctx, baseX + 5*p, baseY + bobOffset, p, helmet);
      this.pixel(ctx, baseX + 6*p, baseY + bobOffset, p, helmetDark);

      // Face (visible through helmet)
      this.pixel(ctx, baseX + 3*p, baseY + p + bobOffset, p, helmetDark);
      this.pixel(ctx, baseX + 4*p, baseY + p + bobOffset, p, '#ff0000'); // Red angry eye
      this.pixel(ctx, baseX + 5*p, baseY + p + bobOffset, p, '#ff0000'); // Red angry eye
      this.pixel(ctx, baseX + 6*p, baseY + p + bobOffset, p, helmetDark);

      // Body (bulky, some armor)
      this.pixel(ctx, baseX + 2*p, baseY + 2*p + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 3*p, baseY + 2*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 4*p, baseY + 2*p + bobOffset, p, helmet);
      this.pixel(ctx, baseX + 5*p, baseY + 2*p + bobOffset, p, helmet);
      this.pixel(ctx, baseX + 6*p, baseY + 2*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 7*p, baseY + 2*p + bobOffset, p, skinDark);

      this.pixel(ctx, baseX + 2*p, baseY + 3*p + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 3*p, baseY + 3*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 4*p, baseY + 3*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 5*p, baseY + 3*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 6*p, baseY + 3*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 7*p, baseY + 3*p + bobOffset, p, skinDark);

      // Legs
      this.pixel(ctx, baseX + 3*p, baseY + 4*p + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 4*p, baseY + 4*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 5*p, baseY + 4*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 6*p, baseY + 4*p + bobOffset, p, skinDark);

      this.pixel(ctx, baseX + 3*p, baseY + 5*p + bobOffset, p, '#333');
      this.pixel(ctx, baseX + 4*p, baseY + 5*p + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 5*p, baseY + 5*p + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 6*p, baseY + 5*p + bobOffset, p, '#333');

      // Crude wooden shield
      this.pixel(ctx, baseX + p, baseY + 2*p + bobOffset, p, shield);
      this.pixel(ctx, baseX + p, baseY + 3*p + bobOffset, p, shield);
      this.pixel(ctx, baseX, baseY + 2*p + bobOffset, p, shieldDark);
      this.pixel(ctx, baseX, baseY + 3*p + bobOffset, p, shieldDark);
    } else {
      // Human Knight
      const armor = '#78716c';
      const armorLight = '#a8a29e';
      const armorDark = '#44403c';
      const plume = '#dc2626';
      const shield = '#fbbf24';

      // Helmet plume
      this.pixel(ctx, baseX + 4*p, baseY - p + bobOffset, p, plume);
      this.pixel(ctx, baseX + 5*p, baseY - p + bobOffset, p, plume);

      // Helmet
      this.pixel(ctx, baseX + 3*p, baseY + bobOffset, p, armorDark);
      this.pixel(ctx, baseX + 4*p, baseY + bobOffset, p, armor);
      this.pixel(ctx, baseX + 5*p, baseY + bobOffset, p, armor);
      this.pixel(ctx, baseX + 6*p, baseY + bobOffset, p, armorDark);

      // Visor
      this.pixel(ctx, baseX + 3*p, baseY + p + bobOffset, p, armorDark);
      this.pixel(ctx, baseX + 4*p, baseY + p + bobOffset, p, '#1a1a2e');
      this.pixel(ctx, baseX + 5*p, baseY + p + bobOffset, p, '#1a1a2e');
      this.pixel(ctx, baseX + 6*p, baseY + p + bobOffset, p, armorDark);

      // Body (bulky)
      this.pixel(ctx, baseX + 2*p, baseY + 2*p + bobOffset, p, armorDark);
      this.pixel(ctx, baseX + 3*p, baseY + 2*p + bobOffset, p, armor);
      this.pixel(ctx, baseX + 4*p, baseY + 2*p + bobOffset, p, armorLight);
      this.pixel(ctx, baseX + 5*p, baseY + 2*p + bobOffset, p, armorLight);
      this.pixel(ctx, baseX + 6*p, baseY + 2*p + bobOffset, p, armor);
      this.pixel(ctx, baseX + 7*p, baseY + 2*p + bobOffset, p, armorDark);

      this.pixel(ctx, baseX + 2*p, baseY + 3*p + bobOffset, p, armorDark);
      this.pixel(ctx, baseX + 3*p, baseY + 3*p + bobOffset, p, armor);
      this.pixel(ctx, baseX + 4*p, baseY + 3*p + bobOffset, p, armor);
      this.pixel(ctx, baseX + 5*p, baseY + 3*p + bobOffset, p, armor);
      this.pixel(ctx, baseX + 6*p, baseY + 3*p + bobOffset, p, armor);
      this.pixel(ctx, baseX + 7*p, baseY + 3*p + bobOffset, p, armorDark);

      // Legs
      this.pixel(ctx, baseX + 3*p, baseY + 4*p + bobOffset, p, armorDark);
      this.pixel(ctx, baseX + 4*p, baseY + 4*p + bobOffset, p, armor);
      this.pixel(ctx, baseX + 5*p, baseY + 4*p + bobOffset, p, armor);
      this.pixel(ctx, baseX + 6*p, baseY + 4*p + bobOffset, p, armorDark);

      this.pixel(ctx, baseX + 3*p, baseY + 5*p + bobOffset, p, armorDark);
      this.pixel(ctx, baseX + 4*p, baseY + 5*p + bobOffset, p, armorDark);
      this.pixel(ctx, baseX + 5*p, baseY + 5*p + bobOffset, p, armorDark);
      this.pixel(ctx, baseX + 6*p, baseY + 5*p + bobOffset, p, armorDark);

      // Shield
      this.pixel(ctx, baseX + p, baseY + 2*p + bobOffset, p, shield);
      this.pixel(ctx, baseX + p, baseY + 3*p + bobOffset, p, shield);
      this.pixel(ctx, baseX, baseY + 2*p + bobOffset, p, armorDark);
      this.pixel(ctx, baseX, baseY + 3*p + bobOffset, p, armorDark);
    }
  }

  static drawHorseman(ctx: CanvasRenderingContext2D, x: number, y: number, team: Team, frame: number, direction: 'up' | 'down' | 'left' | 'right' = 'right'): void {
    const p = 4; // pixel size (larger for full-screen canvas)
    const bobOffset = Math.sin(frame * Math.PI / 2) * 1;

    // Colors
    const skin = '#ffd5b5';
    const armor = team === 'top' ? '#3b82f6' : '#ef4444';
    const armorDark = team === 'top' ? '#1d4ed8' : '#b91c1c';
    const armorLight = team === 'top' ? '#60a5fa' : '#f87171';
    const cape = team === 'top' ? '#1e40af' : '#991b1b';
    const horse = '#8b4513';
    const horseDark = '#5c3317';
    const horseLight = '#a0522d';
    const mane = '#2d1810';
    const crown = '#fbbf24';
    const crownDark = '#d97706';

    if (direction === 'right') {
      this.drawHorsemanRight(ctx, x, y, p, bobOffset, frame, skin, armor, armorDark, armorLight, cape, horse, horseDark, horseLight, mane, crown, crownDark);
    } else if (direction === 'left') {
      this.drawHorsemanLeft(ctx, x, y, p, bobOffset, frame, skin, armor, armorDark, armorLight, cape, horse, horseDark, horseLight, mane, crown, crownDark);
    } else if (direction === 'up') {
      this.drawHorsemanUp(ctx, x, y, p, bobOffset, frame, skin, armor, armorDark, armorLight, cape, horse, horseDark, horseLight, mane, crown, crownDark);
    } else {
      this.drawHorsemanDown(ctx, x, y, p, bobOffset, frame, skin, armor, armorDark, armorLight, cape, horse, horseDark, horseLight, mane, crown, crownDark);
    }
  }

  private static drawHorsemanRight(ctx: CanvasRenderingContext2D, x: number, y: number, p: number, bobOffset: number, frame: number,
    skin: string, armor: string, armorDark: string, armorLight: string, cape: string,
    horse: string, horseDark: string, horseLight: string, mane: string, crown: string, crownDark: string): void {
    const baseX = x - 8 * p;
    const baseY = y - 10 * p;

    // === RIDER ===
    // Crown
    this.pixel(ctx, baseX + 7*p, baseY - p + bobOffset, p, crownDark);
    this.pixel(ctx, baseX + 8*p, baseY - 2*p + bobOffset, p, crown);
    this.pixel(ctx, baseX + 9*p, baseY - p + bobOffset, p, crown);
    this.pixel(ctx, baseX + 10*p, baseY - 2*p + bobOffset, p, crown);
    this.pixel(ctx, baseX + 11*p, baseY - p + bobOffset, p, crownDark);

    // Head
    this.pixel(ctx, baseX + 8*p, baseY + bobOffset, p, skin);
    this.pixel(ctx, baseX + 9*p, baseY + bobOffset, p, skin);
    this.pixel(ctx, baseX + 10*p, baseY + bobOffset, p, skin);
    this.pixel(ctx, baseX + 10*p, baseY + bobOffset, p, '#333'); // Eye

    // Body/Armor
    this.pixel(ctx, baseX + 7*p, baseY + p + bobOffset, p, armorDark);
    this.pixel(ctx, baseX + 8*p, baseY + p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 9*p, baseY + p + bobOffset, p, armorLight);
    this.pixel(ctx, baseX + 10*p, baseY + p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 11*p, baseY + p + bobOffset, p, armorDark);

    this.pixel(ctx, baseX + 7*p, baseY + 2*p + bobOffset, p, armorDark);
    this.pixel(ctx, baseX + 8*p, baseY + 2*p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 9*p, baseY + 2*p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 10*p, baseY + 2*p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 11*p, baseY + 2*p + bobOffset, p, armorDark);

    // Cape (flowing behind)
    this.pixel(ctx, baseX + 5*p, baseY + p + bobOffset, p, cape);
    this.pixel(ctx, baseX + 4*p, baseY + 2*p + bobOffset, p, cape);
    this.pixel(ctx, baseX + 5*p, baseY + 2*p + bobOffset, p, cape);

    // Legs on horse
    this.pixel(ctx, baseX + 7*p, baseY + 3*p + bobOffset, p, armorDark);
    this.pixel(ctx, baseX + 11*p, baseY + 3*p + bobOffset, p, armorDark);

    // === HORSE ===
    // Horse head (facing right)
    this.pixel(ctx, baseX + 14*p, baseY + 3*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 15*p, baseY + 3*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 16*p, baseY + 3*p + bobOffset, p, horseDark);

    this.pixel(ctx, baseX + 14*p, baseY + 4*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 15*p, baseY + 4*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 16*p, baseY + 4*p + bobOffset, p, horseDark);
    this.pixel(ctx, baseX + 17*p, baseY + 4*p + bobOffset, p, horseDark);

    // Horse eye
    this.pixel(ctx, baseX + 16*p, baseY + 3*p + bobOffset, p, '#111');

    // Horse mane
    this.pixel(ctx, baseX + 13*p, baseY + 2*p + bobOffset, p, mane);
    this.pixel(ctx, baseX + 13*p, baseY + 3*p + bobOffset, p, mane);
    this.pixel(ctx, baseX + 14*p, baseY + 2*p + bobOffset, p, mane);

    // Horse body
    this.pixel(ctx, baseX + 6*p, baseY + 4*p + bobOffset, p, horseDark);
    this.pixel(ctx, baseX + 7*p, baseY + 4*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 8*p, baseY + 4*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 9*p, baseY + 4*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 10*p, baseY + 4*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 11*p, baseY + 4*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 12*p, baseY + 4*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 13*p, baseY + 4*p + bobOffset, p, horseLight);

    this.pixel(ctx, baseX + 6*p, baseY + 5*p + bobOffset, p, horseDark);
    this.pixel(ctx, baseX + 7*p, baseY + 5*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 8*p, baseY + 5*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 9*p, baseY + 5*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 10*p, baseY + 5*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 11*p, baseY + 5*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 12*p, baseY + 5*p + bobOffset, p, horseDark);

    // Saddle
    this.pixel(ctx, baseX + 8*p, baseY + 3*p + bobOffset, p, armorDark);
    this.pixel(ctx, baseX + 9*p, baseY + 3*p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 10*p, baseY + 3*p + bobOffset, p, armorDark);

    // Horse legs (animated)
    const legOffset = frame % 2 === 0 ? 0 : p;
    // Front legs
    this.pixel(ctx, baseX + 12*p, baseY + 6*p + bobOffset + legOffset, p, horseDark);
    this.pixel(ctx, baseX + 12*p, baseY + 7*p + bobOffset + legOffset, p, horse);
    this.pixel(ctx, baseX + 12*p, baseY + 8*p + bobOffset + legOffset, p, '#333');

    this.pixel(ctx, baseX + 13*p, baseY + 6*p + bobOffset - legOffset, p, horseDark);
    this.pixel(ctx, baseX + 13*p, baseY + 7*p + bobOffset - legOffset, p, horse);
    this.pixel(ctx, baseX + 13*p, baseY + 8*p + bobOffset - legOffset, p, '#333');

    // Back legs
    this.pixel(ctx, baseX + 6*p, baseY + 6*p + bobOffset - legOffset, p, horseDark);
    this.pixel(ctx, baseX + 6*p, baseY + 7*p + bobOffset - legOffset, p, horse);
    this.pixel(ctx, baseX + 6*p, baseY + 8*p + bobOffset - legOffset, p, '#333');

    this.pixel(ctx, baseX + 7*p, baseY + 6*p + bobOffset + legOffset, p, horseDark);
    this.pixel(ctx, baseX + 7*p, baseY + 7*p + bobOffset + legOffset, p, horse);
    this.pixel(ctx, baseX + 7*p, baseY + 8*p + bobOffset + legOffset, p, '#333');

    // Horse tail
    this.pixel(ctx, baseX + 5*p, baseY + 4*p + bobOffset, p, mane);
    this.pixel(ctx, baseX + 4*p, baseY + 5*p + bobOffset, p, mane);
    this.pixel(ctx, baseX + 4*p, baseY + 6*p + bobOffset, p, mane);
  }

  private static drawHorsemanLeft(ctx: CanvasRenderingContext2D, x: number, y: number, p: number, bobOffset: number, frame: number,
    skin: string, armor: string, armorDark: string, armorLight: string, cape: string,
    horse: string, horseDark: string, horseLight: string, mane: string, crown: string, crownDark: string): void {
    const baseX = x - 8 * p;
    const baseY = y - 10 * p;

    // === RIDER ===
    // Crown
    this.pixel(ctx, baseX + 5*p, baseY - p + bobOffset, p, crownDark);
    this.pixel(ctx, baseX + 6*p, baseY - 2*p + bobOffset, p, crown);
    this.pixel(ctx, baseX + 7*p, baseY - p + bobOffset, p, crown);
    this.pixel(ctx, baseX + 8*p, baseY - 2*p + bobOffset, p, crown);
    this.pixel(ctx, baseX + 9*p, baseY - p + bobOffset, p, crownDark);

    // Head
    this.pixel(ctx, baseX + 6*p, baseY + bobOffset, p, skin);
    this.pixel(ctx, baseX + 7*p, baseY + bobOffset, p, skin);
    this.pixel(ctx, baseX + 8*p, baseY + bobOffset, p, skin);
    this.pixel(ctx, baseX + 6*p, baseY + bobOffset, p, '#333'); // Eye

    // Body/Armor
    this.pixel(ctx, baseX + 5*p, baseY + p + bobOffset, p, armorDark);
    this.pixel(ctx, baseX + 6*p, baseY + p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 7*p, baseY + p + bobOffset, p, armorLight);
    this.pixel(ctx, baseX + 8*p, baseY + p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 9*p, baseY + p + bobOffset, p, armorDark);

    this.pixel(ctx, baseX + 5*p, baseY + 2*p + bobOffset, p, armorDark);
    this.pixel(ctx, baseX + 6*p, baseY + 2*p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 7*p, baseY + 2*p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 8*p, baseY + 2*p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 9*p, baseY + 2*p + bobOffset, p, armorDark);

    // Cape (flowing behind)
    this.pixel(ctx, baseX + 11*p, baseY + p + bobOffset, p, cape);
    this.pixel(ctx, baseX + 11*p, baseY + 2*p + bobOffset, p, cape);
    this.pixel(ctx, baseX + 12*p, baseY + 2*p + bobOffset, p, cape);

    // Legs on horse
    this.pixel(ctx, baseX + 5*p, baseY + 3*p + bobOffset, p, armorDark);
    this.pixel(ctx, baseX + 9*p, baseY + 3*p + bobOffset, p, armorDark);

    // === HORSE ===
    // Horse head (facing left)
    this.pixel(ctx, baseX + p, baseY + 3*p + bobOffset, p, horseDark);
    this.pixel(ctx, baseX + 2*p, baseY + 3*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 3*p, baseY + 3*p + bobOffset, p, horseLight);

    this.pixel(ctx, baseX, baseY + 4*p + bobOffset, p, horseDark);
    this.pixel(ctx, baseX + p, baseY + 4*p + bobOffset, p, horseDark);
    this.pixel(ctx, baseX + 2*p, baseY + 4*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 3*p, baseY + 4*p + bobOffset, p, horse);

    // Horse eye
    this.pixel(ctx, baseX + p, baseY + 3*p + bobOffset, p, '#111');

    // Horse mane
    this.pixel(ctx, baseX + 3*p, baseY + 2*p + bobOffset, p, mane);
    this.pixel(ctx, baseX + 4*p, baseY + 2*p + bobOffset, p, mane);
    this.pixel(ctx, baseX + 4*p, baseY + 3*p + bobOffset, p, mane);

    // Horse body
    this.pixel(ctx, baseX + 4*p, baseY + 4*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 5*p, baseY + 4*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 6*p, baseY + 4*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 7*p, baseY + 4*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 8*p, baseY + 4*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 9*p, baseY + 4*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 10*p, baseY + 4*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 11*p, baseY + 4*p + bobOffset, p, horseDark);

    this.pixel(ctx, baseX + 5*p, baseY + 5*p + bobOffset, p, horseDark);
    this.pixel(ctx, baseX + 6*p, baseY + 5*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 7*p, baseY + 5*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 8*p, baseY + 5*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 9*p, baseY + 5*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 10*p, baseY + 5*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 11*p, baseY + 5*p + bobOffset, p, horseDark);

    // Saddle
    this.pixel(ctx, baseX + 6*p, baseY + 3*p + bobOffset, p, armorDark);
    this.pixel(ctx, baseX + 7*p, baseY + 3*p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 8*p, baseY + 3*p + bobOffset, p, armorDark);

    // Horse legs (animated)
    const legOffset = frame % 2 === 0 ? 0 : p;
    // Front legs
    this.pixel(ctx, baseX + 4*p, baseY + 6*p + bobOffset + legOffset, p, horseDark);
    this.pixel(ctx, baseX + 4*p, baseY + 7*p + bobOffset + legOffset, p, horse);
    this.pixel(ctx, baseX + 4*p, baseY + 8*p + bobOffset + legOffset, p, '#333');

    this.pixel(ctx, baseX + 5*p, baseY + 6*p + bobOffset - legOffset, p, horseDark);
    this.pixel(ctx, baseX + 5*p, baseY + 7*p + bobOffset - legOffset, p, horse);
    this.pixel(ctx, baseX + 5*p, baseY + 8*p + bobOffset - legOffset, p, '#333');

    // Back legs
    this.pixel(ctx, baseX + 10*p, baseY + 6*p + bobOffset - legOffset, p, horseDark);
    this.pixel(ctx, baseX + 10*p, baseY + 7*p + bobOffset - legOffset, p, horse);
    this.pixel(ctx, baseX + 10*p, baseY + 8*p + bobOffset - legOffset, p, '#333');

    this.pixel(ctx, baseX + 11*p, baseY + 6*p + bobOffset + legOffset, p, horseDark);
    this.pixel(ctx, baseX + 11*p, baseY + 7*p + bobOffset + legOffset, p, horse);
    this.pixel(ctx, baseX + 11*p, baseY + 8*p + bobOffset + legOffset, p, '#333');

    // Horse tail
    this.pixel(ctx, baseX + 12*p, baseY + 4*p + bobOffset, p, mane);
    this.pixel(ctx, baseX + 13*p, baseY + 5*p + bobOffset, p, mane);
    this.pixel(ctx, baseX + 13*p, baseY + 6*p + bobOffset, p, mane);
  }

  private static drawHorsemanUp(ctx: CanvasRenderingContext2D, x: number, y: number, p: number, bobOffset: number, frame: number,
    _skin: string, _armor: string, _armorDark: string, _armorLight: string, cape: string,
    horse: string, horseDark: string, horseLight: string, mane: string, crown: string, crownDark: string): void {
    const baseX = x - 5 * p;
    const baseY = y - 10 * p;

    // === HORSE (from behind, going up) ===
    // Horse ears
    this.pixel(ctx, baseX + 3*p, baseY + bobOffset, p, horse);
    this.pixel(ctx, baseX + 7*p, baseY + bobOffset, p, horse);

    // Horse head (back of head)
    this.pixel(ctx, baseX + 4*p, baseY + p + bobOffset, p, horseDark);
    this.pixel(ctx, baseX + 5*p, baseY + p + bobOffset, p, mane);
    this.pixel(ctx, baseX + 6*p, baseY + p + bobOffset, p, horseDark);

    // Horse mane
    this.pixel(ctx, baseX + 5*p, baseY + 2*p + bobOffset, p, mane);

    // === RIDER ===
    // Crown (back view)
    this.pixel(ctx, baseX + 4*p, baseY + 2*p + bobOffset, p, crownDark);
    this.pixel(ctx, baseX + 5*p, baseY + p + bobOffset, p, crown);
    this.pixel(ctx, baseX + 6*p, baseY + 2*p + bobOffset, p, crownDark);

    // Head (back)
    this.pixel(ctx, baseX + 4*p, baseY + 3*p + bobOffset, p, '#5c3317');
    this.pixel(ctx, baseX + 5*p, baseY + 3*p + bobOffset, p, '#5c3317');
    this.pixel(ctx, baseX + 6*p, baseY + 3*p + bobOffset, p, '#5c3317');

    // Cape (prominent from behind)
    this.pixel(ctx, baseX + 3*p, baseY + 4*p + bobOffset, p, cape);
    this.pixel(ctx, baseX + 4*p, baseY + 4*p + bobOffset, p, cape);
    this.pixel(ctx, baseX + 5*p, baseY + 4*p + bobOffset, p, cape);
    this.pixel(ctx, baseX + 6*p, baseY + 4*p + bobOffset, p, cape);
    this.pixel(ctx, baseX + 7*p, baseY + 4*p + bobOffset, p, cape);

    this.pixel(ctx, baseX + 3*p, baseY + 5*p + bobOffset, p, cape);
    this.pixel(ctx, baseX + 4*p, baseY + 5*p + bobOffset, p, cape);
    this.pixel(ctx, baseX + 5*p, baseY + 5*p + bobOffset, p, cape);
    this.pixel(ctx, baseX + 6*p, baseY + 5*p + bobOffset, p, cape);
    this.pixel(ctx, baseX + 7*p, baseY + 5*p + bobOffset, p, cape);

    // Horse body (from behind)
    this.pixel(ctx, baseX + 2*p, baseY + 6*p + bobOffset, p, horseDark);
    this.pixel(ctx, baseX + 3*p, baseY + 6*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 4*p, baseY + 6*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 5*p, baseY + 6*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 6*p, baseY + 6*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 7*p, baseY + 6*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 8*p, baseY + 6*p + bobOffset, p, horseDark);

    this.pixel(ctx, baseX + 2*p, baseY + 7*p + bobOffset, p, horseDark);
    this.pixel(ctx, baseX + 3*p, baseY + 7*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 4*p, baseY + 7*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 5*p, baseY + 7*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 6*p, baseY + 7*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 7*p, baseY + 7*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 8*p, baseY + 7*p + bobOffset, p, horseDark);

    // Horse legs (animated)
    const legOffset = frame % 2 === 0 ? 0 : p;
    this.pixel(ctx, baseX + 2*p, baseY + 8*p + bobOffset + legOffset, p, horseDark);
    this.pixel(ctx, baseX + 2*p, baseY + 9*p + bobOffset + legOffset, p, '#333');

    this.pixel(ctx, baseX + 4*p, baseY + 8*p + bobOffset - legOffset, p, horse);
    this.pixel(ctx, baseX + 4*p, baseY + 9*p + bobOffset - legOffset, p, '#333');

    this.pixel(ctx, baseX + 6*p, baseY + 8*p + bobOffset - legOffset, p, horse);
    this.pixel(ctx, baseX + 6*p, baseY + 9*p + bobOffset - legOffset, p, '#333');

    this.pixel(ctx, baseX + 8*p, baseY + 8*p + bobOffset + legOffset, p, horseDark);
    this.pixel(ctx, baseX + 8*p, baseY + 9*p + bobOffset + legOffset, p, '#333');

    // Horse tail
    this.pixel(ctx, baseX + 5*p, baseY + 8*p + bobOffset, p, mane);
    this.pixel(ctx, baseX + 5*p, baseY + 9*p + bobOffset, p, mane);
    this.pixel(ctx, baseX + 5*p, baseY + 10*p + bobOffset, p, mane);
  }

  private static drawHorsemanDown(ctx: CanvasRenderingContext2D, x: number, y: number, p: number, bobOffset: number, frame: number,
    skin: string, armor: string, armorDark: string, armorLight: string, _cape: string,
    horse: string, horseDark: string, horseLight: string, mane: string, crown: string, crownDark: string): void {
    const baseX = x - 5 * p;
    const baseY = y - 10 * p;

    // === RIDER ===
    // Crown
    this.pixel(ctx, baseX + 3*p, baseY + bobOffset, p, crownDark);
    this.pixel(ctx, baseX + 4*p, baseY - p + bobOffset, p, crown);
    this.pixel(ctx, baseX + 5*p, baseY + bobOffset, p, crown);
    this.pixel(ctx, baseX + 6*p, baseY - p + bobOffset, p, crown);
    this.pixel(ctx, baseX + 7*p, baseY + bobOffset, p, crownDark);

    // Head (front view)
    this.pixel(ctx, baseX + 4*p, baseY + p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 5*p, baseY + p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 6*p, baseY + p + bobOffset, p, skin);
    // Eyes
    this.pixel(ctx, baseX + 4*p, baseY + p + bobOffset, p, '#333');
    this.pixel(ctx, baseX + 6*p, baseY + p + bobOffset, p, '#333');

    // Body/Armor
    this.pixel(ctx, baseX + 3*p, baseY + 2*p + bobOffset, p, armorDark);
    this.pixel(ctx, baseX + 4*p, baseY + 2*p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 5*p, baseY + 2*p + bobOffset, p, armorLight);
    this.pixel(ctx, baseX + 6*p, baseY + 2*p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 7*p, baseY + 2*p + bobOffset, p, armorDark);

    this.pixel(ctx, baseX + 3*p, baseY + 3*p + bobOffset, p, armorDark);
    this.pixel(ctx, baseX + 4*p, baseY + 3*p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 5*p, baseY + 3*p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 6*p, baseY + 3*p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 7*p, baseY + 3*p + bobOffset, p, armorDark);

    // Legs on saddle
    this.pixel(ctx, baseX + 2*p, baseY + 4*p + bobOffset, p, armorDark);
    this.pixel(ctx, baseX + 8*p, baseY + 4*p + bobOffset, p, armorDark);

    // === HORSE ===
    // Horse head (front)
    this.pixel(ctx, baseX + 4*p, baseY + 8*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 5*p, baseY + 8*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 6*p, baseY + 8*p + bobOffset, p, horse);

    this.pixel(ctx, baseX + 4*p, baseY + 9*p + bobOffset, p, horseDark);
    this.pixel(ctx, baseX + 5*p, baseY + 9*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 6*p, baseY + 9*p + bobOffset, p, horseDark);

    // Horse eyes
    this.pixel(ctx, baseX + 4*p, baseY + 8*p + bobOffset, p, '#111');
    this.pixel(ctx, baseX + 6*p, baseY + 8*p + bobOffset, p, '#111');

    // Horse ears
    this.pixel(ctx, baseX + 3*p, baseY + 7*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 7*p, baseY + 7*p + bobOffset, p, horse);

    // Horse mane
    this.pixel(ctx, baseX + 5*p, baseY + 7*p + bobOffset, p, mane);

    // Saddle
    this.pixel(ctx, baseX + 4*p, baseY + 4*p + bobOffset, p, armorDark);
    this.pixel(ctx, baseX + 5*p, baseY + 4*p + bobOffset, p, armor);
    this.pixel(ctx, baseX + 6*p, baseY + 4*p + bobOffset, p, armorDark);

    // Horse body (front view)
    this.pixel(ctx, baseX + 2*p, baseY + 5*p + bobOffset, p, horseDark);
    this.pixel(ctx, baseX + 3*p, baseY + 5*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 4*p, baseY + 5*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 5*p, baseY + 5*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 6*p, baseY + 5*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 7*p, baseY + 5*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 8*p, baseY + 5*p + bobOffset, p, horseDark);

    this.pixel(ctx, baseX + 2*p, baseY + 6*p + bobOffset, p, horseDark);
    this.pixel(ctx, baseX + 3*p, baseY + 6*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 4*p, baseY + 6*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 5*p, baseY + 6*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 6*p, baseY + 6*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 7*p, baseY + 6*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 8*p, baseY + 6*p + bobOffset, p, horseDark);

    this.pixel(ctx, baseX + 3*p, baseY + 7*p + bobOffset, p, horse);
    this.pixel(ctx, baseX + 4*p, baseY + 7*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 5*p, baseY + 7*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 6*p, baseY + 7*p + bobOffset, p, horseLight);
    this.pixel(ctx, baseX + 7*p, baseY + 7*p + bobOffset, p, horse);

    // Horse legs (animated) - front view shows 2 legs
    const legOffset = frame % 2 === 0 ? 0 : p;
    this.pixel(ctx, baseX + 3*p, baseY + 10*p + bobOffset + legOffset, p, horseDark);
    this.pixel(ctx, baseX + 3*p, baseY + 11*p + bobOffset + legOffset, p, '#333');

    this.pixel(ctx, baseX + 7*p, baseY + 10*p + bobOffset - legOffset, p, horseDark);
    this.pixel(ctx, baseX + 7*p, baseY + 11*p + bobOffset - legOffset, p, '#333');
  }

  static drawBoss(ctx: CanvasRenderingContext2D, x: number, y: number, _team: Team, frame: number): void {
    const p = 4; // Bigger pixel size for ogre
    const baseX = x - 6 * p;
    const baseY = y - 10 * p;
    const bobOffset = Math.sin(frame * Math.PI / 2) * 2;

    // Ogre colors - green skin
    const skin = '#4a7c3f';
    const skinDark = '#3d6634';
    const skinLight = '#5a9c4f';
    const belly = '#5a8c4f';
    const eyes = '#ffff00';
    const tusk = '#f5f5dc';
    const loincloth = '#8B4513';
    const club = '#6b4423';
    const clubDark = '#4a2f18';

    // Ears (pointy)
    this.pixel(ctx, baseX + 0*p, baseY + 1*p + bobOffset, p, skinDark);
    this.pixel(ctx, baseX + 10*p, baseY + 1*p + bobOffset, p, skinDark);

    // Head (big and round)
    this.pixel(ctx, baseX + 2*p, baseY + 0*p + bobOffset, p, skinDark);
    this.pixel(ctx, baseX + 3*p, baseY + 0*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 4*p, baseY + 0*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 5*p, baseY + 0*p + bobOffset, p, skinLight);
    this.pixel(ctx, baseX + 6*p, baseY + 0*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 7*p, baseY + 0*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 8*p, baseY + 0*p + bobOffset, p, skinDark);

    // Face row 1
    this.pixel(ctx, baseX + 1*p, baseY + 1*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 2*p, baseY + 1*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 3*p, baseY + 1*p + bobOffset, p, skinLight);
    this.pixel(ctx, baseX + 4*p, baseY + 1*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 5*p, baseY + 1*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 6*p, baseY + 1*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 7*p, baseY + 1*p + bobOffset, p, skinLight);
    this.pixel(ctx, baseX + 8*p, baseY + 1*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 9*p, baseY + 1*p + bobOffset, p, skin);

    // Face with eyes
    this.pixel(ctx, baseX + 1*p, baseY + 2*p + bobOffset, p, skinDark);
    this.pixel(ctx, baseX + 2*p, baseY + 2*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 3*p, baseY + 2*p + bobOffset, p, eyes);
    this.pixel(ctx, baseX + 4*p, baseY + 2*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 5*p, baseY + 2*p + bobOffset, p, skinDark);
    this.pixel(ctx, baseX + 6*p, baseY + 2*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 7*p, baseY + 2*p + bobOffset, p, eyes);
    this.pixel(ctx, baseX + 8*p, baseY + 2*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 9*p, baseY + 2*p + bobOffset, p, skinDark);

    // Lower face with tusks
    this.pixel(ctx, baseX + 2*p, baseY + 3*p + bobOffset, p, tusk);
    this.pixel(ctx, baseX + 3*p, baseY + 3*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 4*p, baseY + 3*p + bobOffset, p, skinDark);
    this.pixel(ctx, baseX + 5*p, baseY + 3*p + bobOffset, p, skinDark);
    this.pixel(ctx, baseX + 6*p, baseY + 3*p + bobOffset, p, skinDark);
    this.pixel(ctx, baseX + 7*p, baseY + 3*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 8*p, baseY + 3*p + bobOffset, p, tusk);

    // Neck (thick)
    this.pixel(ctx, baseX + 3*p, baseY + 4*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 4*p, baseY + 4*p + bobOffset, p, skinLight);
    this.pixel(ctx, baseX + 5*p, baseY + 4*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 6*p, baseY + 4*p + bobOffset, p, skinLight);
    this.pixel(ctx, baseX + 7*p, baseY + 4*p + bobOffset, p, skin);

    // Shoulders (massive)
    this.pixel(ctx, baseX + 0*p, baseY + 5*p + bobOffset, p, skinDark);
    this.pixel(ctx, baseX + 1*p, baseY + 5*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 2*p, baseY + 5*p + bobOffset, p, skinLight);
    this.pixel(ctx, baseX + 3*p, baseY + 5*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 4*p, baseY + 5*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 5*p, baseY + 5*p + bobOffset, p, belly);
    this.pixel(ctx, baseX + 6*p, baseY + 5*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 7*p, baseY + 5*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 8*p, baseY + 5*p + bobOffset, p, skinLight);
    this.pixel(ctx, baseX + 9*p, baseY + 5*p + bobOffset, p, skin);
    this.pixel(ctx, baseX + 10*p, baseY + 5*p + bobOffset, p, skinDark);

    // Big belly
    for (let row = 6; row <= 8; row++) {
      this.pixel(ctx, baseX + 1*p, baseY + row*p + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 2*p, baseY + row*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 3*p, baseY + row*p + bobOffset, p, belly);
      this.pixel(ctx, baseX + 4*p, baseY + row*p + bobOffset, p, belly);
      this.pixel(ctx, baseX + 5*p, baseY + row*p + bobOffset, p, skinLight);
      this.pixel(ctx, baseX + 6*p, baseY + row*p + bobOffset, p, belly);
      this.pixel(ctx, baseX + 7*p, baseY + row*p + bobOffset, p, belly);
      this.pixel(ctx, baseX + 8*p, baseY + row*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 9*p, baseY + row*p + bobOffset, p, skinDark);
    }

    // Loincloth
    this.pixel(ctx, baseX + 3*p, baseY + 9*p + bobOffset, p, loincloth);
    this.pixel(ctx, baseX + 4*p, baseY + 9*p + bobOffset, p, loincloth);
    this.pixel(ctx, baseX + 5*p, baseY + 9*p + bobOffset, p, loincloth);
    this.pixel(ctx, baseX + 6*p, baseY + 9*p + bobOffset, p, loincloth);
    this.pixel(ctx, baseX + 7*p, baseY + 9*p + bobOffset, p, loincloth);

    // Legs (thick)
    const legOffset = frame % 2 === 0 ? 0 : p;
    this.pixel(ctx, baseX + 3*p, baseY + 10*p + bobOffset + legOffset, p, skin);
    this.pixel(ctx, baseX + 4*p, baseY + 10*p + bobOffset + legOffset, p, skinDark);
    this.pixel(ctx, baseX + 3*p, baseY + 11*p + bobOffset + legOffset, p, skinDark);
    this.pixel(ctx, baseX + 4*p, baseY + 11*p + bobOffset + legOffset, p, skin);
    this.pixel(ctx, baseX + 3*p, baseY + 12*p + bobOffset + legOffset, p, '#333');
    this.pixel(ctx, baseX + 4*p, baseY + 12*p + bobOffset + legOffset, p, '#333');

    this.pixel(ctx, baseX + 6*p, baseY + 10*p + bobOffset - legOffset, p, skinDark);
    this.pixel(ctx, baseX + 7*p, baseY + 10*p + bobOffset - legOffset, p, skin);
    this.pixel(ctx, baseX + 6*p, baseY + 11*p + bobOffset - legOffset, p, skin);
    this.pixel(ctx, baseX + 7*p, baseY + 11*p + bobOffset - legOffset, p, skinDark);
    this.pixel(ctx, baseX + 6*p, baseY + 12*p + bobOffset - legOffset, p, '#333');
    this.pixel(ctx, baseX + 7*p, baseY + 12*p + bobOffset - legOffset, p, '#333');

    // Arms (animated, holding club)
    const armSwing = frame % 2 === 0 ? 0 : p;

    // Left arm
    this.pixel(ctx, baseX + 0*p, baseY + 6*p + bobOffset + armSwing, p, skin);
    this.pixel(ctx, baseX + 0*p, baseY + 7*p + bobOffset + armSwing, p, skinDark);
    this.pixel(ctx, baseX + 0*p, baseY + 8*p + bobOffset + armSwing, p, skin);

    // Right arm with club
    this.pixel(ctx, baseX + 10*p, baseY + 6*p + bobOffset - armSwing, p, skin);
    this.pixel(ctx, baseX + 10*p, baseY + 7*p + bobOffset - armSwing, p, skinDark);
    this.pixel(ctx, baseX + 10*p, baseY + 8*p + bobOffset - armSwing, p, skin);

    // Club
    this.pixel(ctx, baseX + 11*p, baseY + 5*p + bobOffset - armSwing, p, club);
    this.pixel(ctx, baseX + 11*p, baseY + 6*p + bobOffset - armSwing, p, clubDark);
    this.pixel(ctx, baseX + 11*p, baseY + 7*p + bobOffset - armSwing, p, club);
    this.pixel(ctx, baseX + 11*p, baseY + 8*p + bobOffset - armSwing, p, clubDark);
    this.pixel(ctx, baseX + 12*p, baseY + 4*p + bobOffset - armSwing, p, club);
    this.pixel(ctx, baseX + 12*p, baseY + 5*p + bobOffset - armSwing, p, clubDark);
    this.pixel(ctx, baseX + 12*p, baseY + 6*p + bobOffset - armSwing, p, club);
  }

  static drawWraith(ctx: CanvasRenderingContext2D, x: number, y: number, _team: Team, frame: number): void {
    const p = 4; // Pixel size
    const baseX = x - 8 * p;
    const baseY = y - 12 * p;

    // Floating bob effect (more pronounced for ghostly feel)
    const floatOffset = Math.sin(frame * Math.PI / 2) * 3;

    // Wraith colors - dark purple/black ethereal
    const robe = '#1a0a2e';
    const robeDark = '#0d0518';
    const robeLight = '#2d1b4e';
    const glow = '#9333ea';
    const glowBright = '#a855f7';
    const eyes = '#ff0000';
    const scytheHandle = '#3d2817';
    const scytheBlade = '#c0c0c0';
    const scytheBladeEdge = '#e8e8e8';

    // Ethereal glow effect behind wraith
    ctx.fillStyle = `rgba(147, 51, 234, ${0.2 + Math.sin(frame * Math.PI / 2) * 0.1})`;
    ctx.beginPath();
    ctx.arc(x, y - 5 + floatOffset, 18, 0, Math.PI * 2);
    ctx.fill();

    // Hood top
    this.pixel(ctx, baseX + 5*p, baseY + 0*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 6*p, baseY + 0*p + floatOffset, p, robe);
    this.pixel(ctx, baseX + 7*p, baseY + 0*p + floatOffset, p, robe);
    this.pixel(ctx, baseX + 8*p, baseY + 0*p + floatOffset, p, robe);
    this.pixel(ctx, baseX + 9*p, baseY + 0*p + floatOffset, p, robeDark);

    // Hood row 2
    this.pixel(ctx, baseX + 4*p, baseY + 1*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 5*p, baseY + 1*p + floatOffset, p, robe);
    this.pixel(ctx, baseX + 6*p, baseY + 1*p + floatOffset, p, robeLight);
    this.pixel(ctx, baseX + 7*p, baseY + 1*p + floatOffset, p, robe);
    this.pixel(ctx, baseX + 8*p, baseY + 1*p + floatOffset, p, robeLight);
    this.pixel(ctx, baseX + 9*p, baseY + 1*p + floatOffset, p, robe);
    this.pixel(ctx, baseX + 10*p, baseY + 1*p + floatOffset, p, robeDark);

    // Face shadow with glowing eyes
    this.pixel(ctx, baseX + 4*p, baseY + 2*p + floatOffset, p, robe);
    this.pixel(ctx, baseX + 5*p, baseY + 2*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 6*p, baseY + 2*p + floatOffset, p, eyes);
    this.pixel(ctx, baseX + 7*p, baseY + 2*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 8*p, baseY + 2*p + floatOffset, p, eyes);
    this.pixel(ctx, baseX + 9*p, baseY + 2*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 10*p, baseY + 2*p + floatOffset, p, robe);

    // Lower hood
    this.pixel(ctx, baseX + 4*p, baseY + 3*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 5*p, baseY + 3*p + floatOffset, p, robe);
    this.pixel(ctx, baseX + 6*p, baseY + 3*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 7*p, baseY + 3*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 8*p, baseY + 3*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 9*p, baseY + 3*p + floatOffset, p, robe);
    this.pixel(ctx, baseX + 10*p, baseY + 3*p + floatOffset, p, robeDark);

    // Shoulders
    this.pixel(ctx, baseX + 3*p, baseY + 4*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 4*p, baseY + 4*p + floatOffset, p, robe);
    this.pixel(ctx, baseX + 5*p, baseY + 4*p + floatOffset, p, robeLight);
    this.pixel(ctx, baseX + 6*p, baseY + 4*p + floatOffset, p, robe);
    this.pixel(ctx, baseX + 7*p, baseY + 4*p + floatOffset, p, glow);
    this.pixel(ctx, baseX + 8*p, baseY + 4*p + floatOffset, p, robe);
    this.pixel(ctx, baseX + 9*p, baseY + 4*p + floatOffset, p, robeLight);
    this.pixel(ctx, baseX + 10*p, baseY + 4*p + floatOffset, p, robe);
    this.pixel(ctx, baseX + 11*p, baseY + 4*p + floatOffset, p, robeDark);

    // Body
    for (let row = 5; row <= 8; row++) {
      this.pixel(ctx, baseX + 3*p, baseY + row*p + floatOffset, p, robeDark);
      this.pixel(ctx, baseX + 4*p, baseY + row*p + floatOffset, p, robe);
      this.pixel(ctx, baseX + 5*p, baseY + row*p + floatOffset, p, robeLight);
      this.pixel(ctx, baseX + 6*p, baseY + row*p + floatOffset, p, robe);
      this.pixel(ctx, baseX + 7*p, baseY + row*p + floatOffset, p, row === 6 ? glowBright : glow);
      this.pixel(ctx, baseX + 8*p, baseY + row*p + floatOffset, p, robe);
      this.pixel(ctx, baseX + 9*p, baseY + row*p + floatOffset, p, robeLight);
      this.pixel(ctx, baseX + 10*p, baseY + row*p + floatOffset, p, robe);
      this.pixel(ctx, baseX + 11*p, baseY + row*p + floatOffset, p, robeDark);
    }

    // Lower robe (tattered, fading)
    const fadeAlpha = 0.8;
    ctx.globalAlpha = fadeAlpha;
    this.pixel(ctx, baseX + 4*p, baseY + 9*p + floatOffset, p, robe);
    this.pixel(ctx, baseX + 5*p, baseY + 9*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 6*p, baseY + 9*p + floatOffset, p, robe);
    this.pixel(ctx, baseX + 7*p, baseY + 9*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 8*p, baseY + 9*p + floatOffset, p, robe);
    this.pixel(ctx, baseX + 9*p, baseY + 9*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 10*p, baseY + 9*p + floatOffset, p, robe);

    ctx.globalAlpha = fadeAlpha * 0.7;
    this.pixel(ctx, baseX + 4*p, baseY + 10*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 6*p, baseY + 10*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 8*p, baseY + 10*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 10*p, baseY + 10*p + floatOffset, p, robeDark);

    ctx.globalAlpha = fadeAlpha * 0.4;
    this.pixel(ctx, baseX + 5*p, baseY + 11*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 7*p, baseY + 11*p + floatOffset, p, robeDark);
    this.pixel(ctx, baseX + 9*p, baseY + 11*p + floatOffset, p, robeDark);

    ctx.globalAlpha = 1;

    // Scythe (big, held on right side)
    const scytheSwing = frame % 2 === 0 ? 0 : p;

    // Handle (long pole)
    for (let i = 0; i < 10; i++) {
      this.pixel(ctx, baseX + 12*p, baseY + (2 + i)*p + floatOffset - scytheSwing, p, scytheHandle);
    }

    // Blade (curved)
    this.pixel(ctx, baseX + 11*p, baseY + 1*p + floatOffset - scytheSwing, p, scytheBlade);
    this.pixel(ctx, baseX + 12*p, baseY + 1*p + floatOffset - scytheSwing, p, scytheBladeEdge);
    this.pixel(ctx, baseX + 10*p, baseY + 2*p + floatOffset - scytheSwing, p, scytheBlade);
    this.pixel(ctx, baseX + 11*p, baseY + 2*p + floatOffset - scytheSwing, p, scytheBladeEdge);
    this.pixel(ctx, baseX + 9*p, baseY + 3*p + floatOffset - scytheSwing, p, scytheBlade);
    this.pixel(ctx, baseX + 10*p, baseY + 3*p + floatOffset - scytheSwing, p, scytheBladeEdge);
    this.pixel(ctx, baseX + 8*p, baseY + 4*p + floatOffset - scytheSwing, p, scytheBlade);
    this.pixel(ctx, baseX + 9*p, baseY + 4*p + floatOffset - scytheSwing, p, scytheBladeEdge);

    // Left arm (skeletal, holding scythe)
    this.pixel(ctx, baseX + 2*p, baseY + 5*p + floatOffset + scytheSwing, p, '#e8e8e8');
    this.pixel(ctx, baseX + 2*p, baseY + 6*p + floatOffset + scytheSwing, p, '#d0d0d0');
    this.pixel(ctx, baseX + 2*p, baseY + 7*p + floatOffset + scytheSwing, p, '#e8e8e8');
  }

  static drawHealer(ctx: CanvasRenderingContext2D, x: number, y: number, team: Team, frame: number): void {
    const p = 4;
    const baseX = x - 5 * p;
    const baseY = y - 6 * p;
    const bobOffset = Math.sin(frame * Math.PI / 2) * 1;

    if (team === 'top') {
      // Goblin Witch Doctor - green skin, bone staff, tribal mask
      const skin = '#4a7c3f';
      const skinDark = '#3d6634';
      const mask = '#f5f5dc';
      const maskDark = '#d4c4a8';
      const staff = '#e8e8e8'; // Bone staff
      const staffDark = '#c0c0c0';
      const feather = '#ff4444';

      // Feathers on head
      this.pixel(ctx, baseX + 3*p, baseY - p + bobOffset, p, feather);
      this.pixel(ctx, baseX + 6*p, baseY - p + bobOffset, p, feather);

      // Tribal mask
      this.pixel(ctx, baseX + 3*p, baseY + bobOffset, p, maskDark);
      this.pixel(ctx, baseX + 4*p, baseY + bobOffset, p, mask);
      this.pixel(ctx, baseX + 5*p, baseY + bobOffset, p, mask);
      this.pixel(ctx, baseX + 6*p, baseY + bobOffset, p, maskDark);

      // Mask face with eye holes
      this.pixel(ctx, baseX + 3*p, baseY + p + bobOffset, p, mask);
      this.pixel(ctx, baseX + 4*p, baseY + p + bobOffset, p, '#00ff00'); // Glowing green eye
      this.pixel(ctx, baseX + 5*p, baseY + p + bobOffset, p, '#00ff00'); // Glowing green eye
      this.pixel(ctx, baseX + 6*p, baseY + p + bobOffset, p, mask);

      // Body (bare chest with necklace)
      this.pixel(ctx, baseX + 3*p, baseY + 2*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 4*p, baseY + 2*p + bobOffset, p, '#f5f5dc'); // Bone necklace
      this.pixel(ctx, baseX + 5*p, baseY + 2*p + bobOffset, p, '#f5f5dc');
      this.pixel(ctx, baseX + 6*p, baseY + 2*p + bobOffset, p, skin);

      this.pixel(ctx, baseX + 3*p, baseY + 3*p + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 4*p, baseY + 3*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 5*p, baseY + 3*p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 6*p, baseY + 3*p + bobOffset, p, skinDark);

      // Loincloth
      this.pixel(ctx, baseX + 3*p, baseY + 4*p + bobOffset, p, '#5c4033');
      this.pixel(ctx, baseX + 4*p, baseY + 4*p + bobOffset, p, '#5c4033');
      this.pixel(ctx, baseX + 5*p, baseY + 4*p + bobOffset, p, '#5c4033');
      this.pixel(ctx, baseX + 6*p, baseY + 4*p + bobOffset, p, '#5c4033');

      // Legs
      this.pixel(ctx, baseX + 4*p, baseY + 5*p + bobOffset, p, skinDark);
      this.pixel(ctx, baseX + 5*p, baseY + 5*p + bobOffset, p, skinDark);

      // Bone staff with skull
      this.pixel(ctx, baseX + 8*p, baseY + 2*p + bobOffset, p, staff);
      this.pixel(ctx, baseX + 8*p, baseY + 3*p + bobOffset, p, staffDark);
      this.pixel(ctx, baseX + 8*p, baseY + 4*p + bobOffset, p, staff);

      // Skull on staff (glowing green)
      const glowColor = frame % 2 === 0 ? '#22ff22' : '#00dd00';
      this.pixel(ctx, baseX + 8*p, baseY + bobOffset, p, glowColor);
      this.pixel(ctx, baseX + 8*p, baseY + p + bobOffset, p, staff);
    } else {
      // Human Healer - white robes, healing staff
      const skin = '#ffd5b5';
      const robe = '#e0f2fe';
      const robeDark = '#7dd3fc';
      const staff = '#deb887';
      const crystal = '#22d3ee';

      // Hood/hair
      this.pixel(ctx, baseX + 3*p, baseY + bobOffset, p, robeDark);
      this.pixel(ctx, baseX + 4*p, baseY + bobOffset, p, robe);
      this.pixel(ctx, baseX + 5*p, baseY + bobOffset, p, robe);
      this.pixel(ctx, baseX + 6*p, baseY + bobOffset, p, robeDark);

      // Face
      this.pixel(ctx, baseX + 3*p, baseY + p + bobOffset, p, robe);
      this.pixel(ctx, baseX + 4*p, baseY + p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 5*p, baseY + p + bobOffset, p, skin);
      this.pixel(ctx, baseX + 6*p, baseY + p + bobOffset, p, robe);

      // Robe body
      this.pixel(ctx, baseX + 3*p, baseY + 2*p + bobOffset, p, robeDark);
      this.pixel(ctx, baseX + 4*p, baseY + 2*p + bobOffset, p, robe);
      this.pixel(ctx, baseX + 5*p, baseY + 2*p + bobOffset, p, robe);
      this.pixel(ctx, baseX + 6*p, baseY + 2*p + bobOffset, p, robeDark);

      this.pixel(ctx, baseX + 2*p, baseY + 3*p + bobOffset, p, robeDark);
      this.pixel(ctx, baseX + 3*p, baseY + 3*p + bobOffset, p, robe);
      this.pixel(ctx, baseX + 4*p, baseY + 3*p + bobOffset, p, robe);
      this.pixel(ctx, baseX + 5*p, baseY + 3*p + bobOffset, p, robe);
      this.pixel(ctx, baseX + 6*p, baseY + 3*p + bobOffset, p, robe);
      this.pixel(ctx, baseX + 7*p, baseY + 3*p + bobOffset, p, robeDark);

      // Robe bottom
      this.pixel(ctx, baseX + 3*p, baseY + 4*p + bobOffset, p, robeDark);
      this.pixel(ctx, baseX + 4*p, baseY + 4*p + bobOffset, p, robe);
      this.pixel(ctx, baseX + 5*p, baseY + 4*p + bobOffset, p, robe);
      this.pixel(ctx, baseX + 6*p, baseY + 4*p + bobOffset, p, robeDark);

      // Staff with crystal
      this.pixel(ctx, baseX + 8*p, baseY + 2*p + bobOffset, p, staff);
      this.pixel(ctx, baseX + 8*p, baseY + 3*p + bobOffset, p, staff);
      this.pixel(ctx, baseX + 8*p, baseY + 4*p + bobOffset, p, staff);

      // Healing crystal (animated glow)
      const glowColor = frame % 2 === 0 ? crystal : '#67e8f9';
      this.pixel(ctx, baseX + 8*p, baseY + bobOffset, p, glowColor);
      this.pixel(ctx, baseX + 8*p, baseY + p + bobOffset, p, crystal);
    }
  }
}

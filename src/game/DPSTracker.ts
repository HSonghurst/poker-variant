export type DamageType = 'physical' | 'fire' | 'poison' | 'frost' | 'void' | 'death' | 'splash';
export type UnitType = 'swordsman' | 'archer' | 'mage' | 'knight' | 'healer' | 'player' | 'boss' | 'wraith' | 'tower';

interface DamageEntry {
  amount: number;
  timestamp: number;
}

class DPSTrackerClass {
  // Track damage by unit type
  private unitDamage: Map<UnitType, DamageEntry[]> = new Map();
  // Track damage by damage type
  private typeDamage: Map<DamageType, DamageEntry[]> = new Map();
  // Track healing
  private healingEntries: DamageEntry[] = [];

  // Time window for DPS calculation (in ms)
  private readonly DPS_WINDOW = 5000; // 5 seconds

  // Track totals
  private totalDamageDealt: number = 0;
  private totalHealing: number = 0;

  constructor() {
    this.reset();
  }

  reset(): void {
    this.unitDamage.clear();
    this.typeDamage.clear();
    this.healingEntries = [];
    this.totalDamageDealt = 0;
    this.totalHealing = 0;
  }

  recordDamage(unitType: UnitType, damageType: DamageType, amount: number): void {
    const now = Date.now();
    const entry: DamageEntry = { amount, timestamp: now };

    // Record by unit type
    if (!this.unitDamage.has(unitType)) {
      this.unitDamage.set(unitType, []);
    }
    this.unitDamage.get(unitType)!.push(entry);

    // Record by damage type
    if (!this.typeDamage.has(damageType)) {
      this.typeDamage.set(damageType, []);
    }
    this.typeDamage.get(damageType)!.push(entry);

    this.totalDamageDealt += amount;
  }

  recordHealing(amount: number): void {
    const now = Date.now();
    this.healingEntries.push({ amount, timestamp: now });
    this.totalHealing += amount;
  }

  private cleanOldEntries(): void {
    const now = Date.now();
    const cutoff = now - this.DPS_WINDOW;

    // Clean unit damage entries
    for (const [key, entries] of this.unitDamage) {
      this.unitDamage.set(key, entries.filter(e => e.timestamp > cutoff));
    }

    // Clean type damage entries
    for (const [key, entries] of this.typeDamage) {
      this.typeDamage.set(key, entries.filter(e => e.timestamp > cutoff));
    }

    // Clean healing entries
    this.healingEntries = this.healingEntries.filter(e => e.timestamp > cutoff);
  }

  private calculateDPS(entries: DamageEntry[]): number {
    if (entries.length === 0) return 0;
    const total = entries.reduce((sum, e) => sum + e.amount, 0);
    return Math.round(total / (this.DPS_WINDOW / 1000)); // Per second
  }

  getUnitDPS(): Map<UnitType, number> {
    this.cleanOldEntries();
    const result = new Map<UnitType, number>();
    for (const [unit, entries] of this.unitDamage) {
      const dps = this.calculateDPS(entries);
      if (dps > 0) {
        result.set(unit, dps);
      }
    }
    return result;
  }

  getTypeDPS(): Map<DamageType, number> {
    this.cleanOldEntries();
    const result = new Map<DamageType, number>();
    for (const [type, entries] of this.typeDamage) {
      const dps = this.calculateDPS(entries);
      if (dps > 0) {
        result.set(type, dps);
      }
    }
    return result;
  }

  getHealingPS(): number {
    this.cleanOldEntries();
    return this.calculateDPS(this.healingEntries);
  }

  getTotalDamage(): number {
    return this.totalDamageDealt;
  }

  getTotalHealing(): number {
    return this.totalHealing;
  }

  getTotalDPS(): number {
    this.cleanOldEntries();
    let total = 0;
    for (const entries of this.unitDamage.values()) {
      total += entries.reduce((sum, e) => sum + e.amount, 0);
    }
    return Math.round(total / (this.DPS_WINDOW / 1000));
  }

  draw(ctx: CanvasRenderingContext2D, x: number, y: number): void {
    const unitDPS = this.getUnitDPS();
    const typeDPS = this.getTypeDPS();
    const healingPS = this.getHealingPS();
    const totalDPS = this.getTotalDPS();

    const panelWidth = 140;
    const lineHeight = 14;
    let currentY = y;

    // Background panel
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    const panelHeight = 200;
    ctx.fillRect(x, y, panelWidth, panelHeight);

    // Border
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, panelWidth, panelHeight);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px Arial';
    ctx.textAlign = 'left';
    currentY += 15;
    ctx.fillText('DPS Tracker', x + 5, currentY);

    // Total DPS
    ctx.font = '10px Arial';
    currentY += lineHeight;
    ctx.fillStyle = '#fbbf24';
    ctx.fillText(`Total DPS: ${totalDPS}`, x + 5, currentY);

    // Unit DPS section
    currentY += lineHeight + 2;
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px Arial';
    ctx.fillText('By Unit:', x + 5, currentY);

    const unitColors: Record<UnitType, string> = {
      swordsman: '#3b82f6',
      archer: '#22c55e',
      mage: '#a855f7',
      knight: '#f59e0b',
      healer: '#22d3ee',
      player: '#ef4444',
      boss: '#dc2626',
      wraith: '#7c3aed',
      tower: '#6b7280'
    };

    ctx.font = '9px Arial';
    const sortedUnits = [...unitDPS.entries()].sort((a, b) => b[1] - a[1]);
    for (const [unit, dps] of sortedUnits.slice(0, 5)) {
      currentY += lineHeight - 2;
      ctx.fillStyle = unitColors[unit] || '#ffffff';
      ctx.fillText(`${unit}: ${dps}`, x + 10, currentY);
    }

    // Damage Type section
    currentY += lineHeight + 2;
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px Arial';
    ctx.fillText('By Type:', x + 5, currentY);

    const typeColors: Record<DamageType, string> = {
      physical: '#ffffff',
      fire: '#ff6600',
      poison: '#22c55e',
      frost: '#87ceeb',
      void: '#a855f7',
      death: '#e5e5e5',
      splash: '#fbbf24'
    };

    ctx.font = '9px Arial';
    const sortedTypes = [...typeDPS.entries()].sort((a, b) => b[1] - a[1]);
    for (const [type, dps] of sortedTypes.slice(0, 4)) {
      currentY += lineHeight - 2;
      ctx.fillStyle = typeColors[type] || '#ffffff';
      ctx.fillText(`${type}: ${dps}`, x + 10, currentY);
    }

    // Healing section
    currentY += lineHeight + 2;
    ctx.fillStyle = '#22d3ee';
    ctx.font = 'bold 9px Arial';
    ctx.fillText(`Healing/s: ${healingPS}`, x + 5, currentY);

    // Totals
    currentY += lineHeight + 2;
    ctx.fillStyle = '#64748b';
    ctx.font = '8px Arial';
    ctx.fillText(`Total Dmg: ${this.formatNumber(this.totalDamageDealt)}`, x + 5, currentY);
    currentY += lineHeight - 4;
    ctx.fillText(`Total Heal: ${this.formatNumber(this.totalHealing)}`, x + 5, currentY);
  }

  private formatNumber(num: number): string {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  }
}

export const DPSTracker = new DPSTrackerClass();

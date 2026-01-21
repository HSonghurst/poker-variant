import type { Fighter } from './Fighter';

/**
 * Attack Slot System
 *
 * Manages attack positions around targets to prevent units from stacking.
 * Each target has N slots around it where attackers can stand.
 * Units reserve slots and path to them. If blocked, they attack opportunistically.
 *
 * SINGLE SOURCE OF TRUTH: All slot ownership is tracked via attackerAssignments Map.
 * No redundant reservedBy field on slots - eliminates desync bugs.
 */

export interface AttackSlot {
  id: number;
  x: number;
  y: number;
  targetId: number;
  isOccupied: boolean; // Whether the attacker has physically arrived at the slot
}

export interface SlotAssignment {
  slot: AttackSlot;
  targetFighter: Fighter;
  isQueueSlot: boolean; // Whether this is a queue slot (outer ring) or attack slot (inner ring)
  reservationTime: number; // When the slot was reserved
}

// Global slot manager - tracks slots for all targets
class SlotManagerClass {
  // Map from target fighter to their attack slots (inner ring)
  private targetSlots: Map<Fighter, AttackSlot[]> = new Map();

  // Map from target fighter to their queue slots (outer ring)
  private targetQueueSlots: Map<Fighter, AttackSlot[]> = new Map();

  // Map from attacker to their assigned slot - SINGLE SOURCE OF TRUTH
  private attackerAssignments: Map<Fighter, SlotAssignment> = new Map();

  // Configuration
  private readonly UNIT_SPACING = 10; // Approximate space each unit needs
  private readonly QUEUE_SLOT_MULTIPLIER = 1.5; // Queue slots at 1.5x attack range
  private readonly RESERVATION_TIMEOUT = 3000; // ms

  /**
   * Check if a slot is available (not reserved by a living unit, or reservation timed out)
   * SINGLE SOURCE OF TRUTH - only checks the Map
   */
  private isSlotAvailable(slot: AttackSlot, excludeFighter?: Fighter): boolean {
    const now = Date.now();

    for (const [fighter, assignment] of this.attackerAssignments) {
      if (assignment.slot === slot) {
        // If we're checking for a specific fighter, they can use their own slot
        if (excludeFighter && fighter === excludeFighter) {
          return true;
        }

        // Dead fighters don't hold slots
        if (fighter.isDead) {
          this.attackerAssignments.delete(fighter);
          return true;
        }

        // Check if reservation timed out
        if (now - assignment.reservationTime > this.RESERVATION_TIMEOUT) {
          this.attackerAssignments.delete(fighter);
          return true;
        }

        // Slot is reserved by a living unit
        return false;
      }
    }

    // No one has this slot
    return true;
  }

  /**
   * Get the fighter who owns a slot (or null if available)
   */
  private getSlotOwner(slot: AttackSlot): Fighter | null {
    for (const [fighter, assignment] of this.attackerAssignments) {
      if (assignment.slot === slot && !fighter.isDead) {
        return fighter;
      }
    }
    return null;
  }

  /**
   * Calculate number of slots based on attack range
   * More range = larger circle = more slots
   */
  private calculateSlotCount(attackRange: number): number {
    const slotDistance = attackRange * 0.85;
    const circumference = 2 * Math.PI * slotDistance;
    const slots = Math.floor(circumference / this.UNIT_SPACING);
    // Clamp between 4 and 40 slots
    return Math.max(4, Math.min(40, slots));
  }

  /**
   * Get or create attack slots around a target (inner ring)
   */
  getOrCreateSlots(target: Fighter, attackRange: number): AttackSlot[] {
    let slots = this.targetSlots.get(target);

    if (!slots) {
      slots = this.generateSlots(target, attackRange, false);
      this.targetSlots.set(target, slots);
    }

    return slots;
  }

  /**
   * Get or create queue slots around a target (outer ring)
   */
  getOrCreateQueueSlots(target: Fighter, attackRange: number): AttackSlot[] {
    let slots = this.targetQueueSlots.get(target);

    if (!slots) {
      slots = this.generateSlots(target, attackRange, true);
      this.targetQueueSlots.set(target, slots);
    }

    return slots;
  }

  /**
   * Generate slots around a target (attack or queue ring)
   */
  private generateSlots(target: Fighter, attackRange: number, isQueue: boolean): AttackSlot[] {
    const slots: AttackSlot[] = [];
    const slotDistance = isQueue
      ? attackRange * this.QUEUE_SLOT_MULTIPLIER  // Queue: outer ring
      : attackRange * 0.85;                        // Attack: inner ring
    const slotCount = this.calculateSlotCount(attackRange);

    for (let i = 0; i < slotCount; i++) {
      const angle = (2 * Math.PI * i) / slotCount;
      // Offset queue slots by half a slot to stagger them
      const angleOffset = isQueue ? Math.PI / slotCount : 0;
      slots.push({
        id: isQueue ? i + 1000 : i, // Queue slots have IDs starting at 1000
        x: target.x + Math.cos(angle + angleOffset) * slotDistance,
        y: target.y + Math.sin(angle + angleOffset) * slotDistance,
        targetId: i,
        isOccupied: false
      });
    }

    return slots;
  }

  /**
   * Update slot positions when target moves
   */
  updateSlotPositions(target: Fighter, attackRange: number): void {
    const attackSlots = this.targetSlots.get(target);
    const queueSlots = this.targetQueueSlots.get(target);

    if (attackSlots) {
      const slotDistance = attackRange * 0.85;
      const slotCount = attackSlots.length;

      for (let i = 0; i < slotCount; i++) {
        const angle = (2 * Math.PI * i) / slotCount;
        attackSlots[i].x = target.x + Math.cos(angle) * slotDistance;
        attackSlots[i].y = target.y + Math.sin(angle) * slotDistance;
      }
    }

    if (queueSlots) {
      const slotDistance = attackRange * this.QUEUE_SLOT_MULTIPLIER;
      const slotCount = queueSlots.length;

      for (let i = 0; i < slotCount; i++) {
        const angle = (2 * Math.PI * i) / slotCount;
        const angleOffset = Math.PI / slotCount; // Stagger queue slots
        queueSlots[i].x = target.x + Math.cos(angle + angleOffset) * slotDistance;
        queueSlots[i].y = target.y + Math.sin(angle + angleOffset) * slotDistance;
      }
    }
  }

  /**
   * Greedy FCFS (First-Come-First-Serve) slot assignment
   *
   * Algorithm:
   * 1. Sort units by distance to target (closest first)
   * 2. For each unit in order, assign the closest available attack slot
   * 3. Units that can't get attack slots get assigned to queue slots (outer ring)
   *
   * This produces intuitive behavior: units that COULD arrive first DO arrive first.
   */
  assignSlotsGreedy(attackers: Fighter[], target: Fighter, allUnits: Fighter[]): void {
    if (attackers.length === 0 || target.isDead) return;

    // Use average attack range for slot generation (group similar units)
    const avgRange = attackers.reduce((sum, a) => sum + a.attackRange, 0) / attackers.length;
    const attackSlots = this.getOrCreateSlots(target, avgRange);
    const queueSlots = this.getOrCreateQueueSlots(target, avgRange);

    // Update slot positions in case target moved
    this.updateSlotPositions(target, avgRange);

    const now = Date.now();
    const attackerSet = new Set(attackers);

    // Get available attack slots
    const availableAttackSlots = new Set(attackSlots.filter(slot => {
      const owner = this.getSlotOwner(slot);
      if (owner === null) return true;
      // If owner is in our group, we'll reassign
      if (attackerSet.has(owner)) return true;
      // Check timeout
      const assignment = this.attackerAssignments.get(owner);
      if (assignment && now - assignment.reservationTime > this.RESERVATION_TIMEOUT) {
        this.attackerAssignments.delete(owner);
        return true;
      }
      return false;
    }));

    // Get available queue slots
    const availableQueueSlots = new Set(queueSlots.filter(slot => {
      const owner = this.getSlotOwner(slot);
      if (owner === null) return true;
      if (attackerSet.has(owner)) return true;
      const assignment = this.attackerAssignments.get(owner);
      if (assignment && now - assignment.reservationTime > this.RESERVATION_TIMEOUT) {
        this.attackerAssignments.delete(owner);
        return true;
      }
      return false;
    }));

    // Release slots for attackers in this group (we're reassigning)
    for (const attacker of attackers) {
      const assignment = this.attackerAssignments.get(attacker);
      if (assignment && assignment.targetFighter === target) {
        // Add slot back to available if it was theirs
        if (assignment.isQueueSlot) {
          availableQueueSlots.add(assignment.slot);
        } else {
          availableAttackSlots.add(assignment.slot);
        }
        assignment.slot.isOccupied = false;
        this.attackerAssignments.delete(attacker);
      }
    }

    // Sort attackers by distance to target (closest first) - GREEDY FCFS
    const sortedAttackers = [...attackers].sort((a, b) => {
      const distA = Math.sqrt((a.x - target.x) ** 2 + (a.y - target.y) ** 2);
      const distB = Math.sqrt((b.x - target.x) ** 2 + (b.y - target.y) ** 2);
      return distA - distB;
    });

    // Track units that couldn't get attack slots
    const unassignedAttackers: Fighter[] = [];

    // First pass: Assign attack slots greedily
    for (const attacker of sortedAttackers) {
      if (availableAttackSlots.size === 0) {
        unassignedAttackers.push(attacker);
        continue;
      }

      // Filter to unblocked slots for this attacker
      const unblockedSlots = [...availableAttackSlots].filter(
        slot => !this.isSlotBlocked(slot, attacker, allUnits)
      );

      const slotsToConsider = unblockedSlots.length > 0 ? unblockedSlots : [...availableAttackSlots];
      if (slotsToConsider.length === 0) {
        unassignedAttackers.push(attacker);
        continue;
      }

      // Find closest slot to THIS attacker
      let bestSlot: AttackSlot | null = null;
      let bestDist = Infinity;

      for (const slot of slotsToConsider) {
        const dx = slot.x - attacker.x;
        const dy = slot.y - attacker.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < bestDist) {
          bestDist = dist;
          bestSlot = slot;
        }
      }

      if (bestSlot) {
        // Reserve this slot for the attacker
        this.attackerAssignments.set(attacker, {
          slot: bestSlot,
          targetFighter: target,
          isQueueSlot: false,
          reservationTime: now
        });
        bestSlot.isOccupied = false;
        availableAttackSlots.delete(bestSlot);
      } else {
        unassignedAttackers.push(attacker);
      }
    }

    // Second pass: Assign queue slots to remaining attackers
    for (const attacker of unassignedAttackers) {
      if (availableQueueSlots.size === 0) break;

      // Find closest queue slot to this attacker
      let bestSlot: AttackSlot | null = null;
      let bestDist = Infinity;

      for (const slot of availableQueueSlots) {
        const dx = slot.x - attacker.x;
        const dy = slot.y - attacker.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < bestDist) {
          bestDist = dist;
          bestSlot = slot;
        }
      }

      if (bestSlot) {
        this.attackerAssignments.set(attacker, {
          slot: bestSlot,
          targetFighter: target,
          isQueueSlot: true,
          reservationTime: now
        });
        bestSlot.isOccupied = false;
        availableQueueSlots.delete(bestSlot);
      }
    }
  }

  /**
   * Try to promote a queued unit to an attack slot
   * Checks ALL attack slots across ALL targets, not just the queued target
   */
  tryPromoteFromQueue(attacker: Fighter, allUnits: Fighter[]): AttackSlot | null {
    const assignment = this.attackerAssignments.get(attacker);
    if (!assignment || !assignment.isQueueSlot) return null;

    const now = Date.now();

    // Check all targets for available attack slots
    for (const [target, slots] of this.targetSlots) {
      if (target.isDead) continue;

      for (const slot of slots) {
        // Check if slot is available
        if (!this.isSlotAvailable(slot, attacker)) continue;

        // Check if slot is blocked
        if (this.isSlotBlocked(slot, attacker, allUnits)) continue;

        // Found an available slot! Release queue slot and take this one
        assignment.slot.isOccupied = false;

        this.attackerAssignments.set(attacker, {
          slot,
          targetFighter: target,
          isQueueSlot: false,
          reservationTime: now
        });
        slot.isOccupied = false;

        return slot;
      }
    }

    return null;
  }

  /**
   * Find the best available slot for an attacker (fallback for individual requests)
   */
  findBestSlot(attacker: Fighter, target: Fighter, allUnits: Fighter[]): AttackSlot | null {
    const slots = this.getOrCreateSlots(target, attacker.attackRange);

    // Filter to available slots
    const availableSlots = slots.filter(slot => this.isSlotAvailable(slot, attacker));

    if (availableSlots.length === 0) return null;

    // Filter out slots that are blocked by enemies
    const unblocked = availableSlots.filter(slot => {
      return !this.isSlotBlocked(slot, attacker, allUnits);
    });

    const slotsToConsider = unblocked.length > 0 ? unblocked : availableSlots;

    // Find closest slot to attacker
    let bestSlot: AttackSlot | null = null;
    let bestDist = Infinity;

    for (const slot of slotsToConsider) {
      const dx = slot.x - attacker.x;
      const dy = slot.y - attacker.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < bestDist) {
        bestDist = dist;
        bestSlot = slot;
      }
    }

    return bestSlot;
  }

  /**
   * Check if a slot is blocked by an enemy unit
   */
  isSlotBlocked(slot: AttackSlot, attacker: Fighter, allUnits: Fighter[]): boolean {
    const blockRadius = 8; // How close an enemy needs to be to block a slot

    for (const unit of allUnits) {
      if (unit === attacker || unit.isDead || unit.team === attacker.team) continue;

      const dx = unit.x - slot.x;
      const dy = unit.y - slot.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < blockRadius) {
        return true;
      }
    }

    return false;
  }

  /**
   * Reserve a slot for an attacker
   */
  reserveSlot(attacker: Fighter, slot: AttackSlot, target: Fighter, isQueueSlot: boolean = false): boolean {
    // Check if slot is available for this attacker
    if (!this.isSlotAvailable(slot, attacker)) {
      return false;
    }

    // Release any previous slot
    this.releaseSlot(attacker);

    this.attackerAssignments.set(attacker, {
      slot,
      targetFighter: target,
      isQueueSlot,
      reservationTime: Date.now()
    });
    slot.isOccupied = false;

    return true;
  }

  /**
   * Mark that attacker has arrived at their slot
   */
  occupySlot(attacker: Fighter): void {
    const assignment = this.attackerAssignments.get(attacker);
    if (assignment) {
      assignment.slot.isOccupied = true;
    }
  }

  /**
   * Release a slot (when attacker dies, changes target, etc.)
   */
  releaseSlot(attacker: Fighter): void {
    const assignment = this.attackerAssignments.get(attacker);
    if (assignment) {
      assignment.slot.isOccupied = false;
      this.attackerAssignments.delete(attacker);
    }
  }

  /**
   * Get the current slot assignment for an attacker
   */
  getAssignment(attacker: Fighter): SlotAssignment | null {
    return this.attackerAssignments.get(attacker) || null;
  }

  /**
   * Check if attacker has a valid slot that isn't blocked
   */
  hasValidSlot(attacker: Fighter, allUnits: Fighter[]): boolean {
    const assignment = this.attackerAssignments.get(attacker);
    if (!assignment) return false;

    // Check if slot is blocked
    return !this.isSlotBlocked(assignment.slot, attacker, allUnits);
  }

  /**
   * Clean up dead targets
   */
  cleanupDeadTarget(target: Fighter): void {
    // Release all slots for this target
    this.targetSlots.delete(target);
    this.targetQueueSlots.delete(target);

    // Remove assignments to this target
    for (const [attacker, assignment] of this.attackerAssignments) {
      if (assignment.targetFighter === target) {
        this.attackerAssignments.delete(attacker);
      }
    }
  }

  /**
   * Get count of available slots for a target
   */
  getAvailableSlotCount(target: Fighter, attackRange: number): number {
    const slots = this.getOrCreateSlots(target, attackRange);
    return slots.filter(slot => this.isSlotAvailable(slot)).length;
  }

  /**
   * Clear all data (for game reset)
   */
  reset(): void {
    this.targetSlots.clear();
    this.targetQueueSlots.clear();
    this.attackerAssignments.clear();
  }
}

// Export singleton instance
export const SlotManager = new SlotManagerClass();

/**
 * Attack states for units
 */
export const AttackState = {
  IDLE: 'idle',
  MOVING_TO_SLOT: 'moving_to_slot',
  ATTACKING: 'attacking',
  WAITING: 'waiting',
  OPPORTUNISTIC: 'opportunistic' // Attacking any enemy in range
} as const;

export type AttackState = typeof AttackState[keyof typeof AttackState];

/**
 * Find any enemy in attack range (for opportunistic attacks)
 */
export function findEnemyInRange(attacker: Fighter, enemies: Fighter[]): Fighter | null {
  let closest: Fighter | null = null;
  let closestDist = Infinity;

  for (const enemy of enemies) {
    if (enemy.isDead) continue;

    const dx = enemy.x - attacker.x;
    const dy = enemy.y - attacker.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= attacker.attackRange && dist < closestDist) {
      closest = enemy;
      closestDist = dist;
    }
  }

  return closest;
}

/**
 * Calculate staging position for waiting units
 * (Position behind the front line, not pushing into the blob)
 */
export function calculateStagingPosition(
  attacker: Fighter,
  target: Fighter,
  allies: Fighter[]
): { x: number; y: number } {
  // Direction from target to attacker (away from fight)
  const dx = attacker.x - target.x;
  const dy = attacker.y - target.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist === 0) {
    return { x: attacker.x, y: attacker.y };
  }

  // Staging distance - behind the attack range
  const stagingDist = attacker.attackRange * 2;

  // Base position directly behind
  let stagingX = target.x + (dx / dist) * stagingDist;
  let stagingY = target.y + (dy / dist) * stagingDist;

  // Offset based on nearby allies to spread out
  const perpX = -dy / dist;
  const perpY = dx / dist;

  // Count allies on each side to decide which way to offset
  let leftCount = 0;
  let rightCount = 0;

  for (const ally of allies) {
    if (ally === attacker || ally.isDead) continue;

    const toAllyX = ally.x - attacker.x;
    const toAllyY = ally.y - attacker.y;
    const side = toAllyX * perpX + toAllyY * perpY;

    if (side > 0) rightCount++;
    else leftCount++;
  }

  // Offset to less crowded side
  const offset = (leftCount > rightCount ? 1 : -1) * 10;
  stagingX += perpX * offset;
  stagingY += perpY * offset;

  return { x: stagingX, y: stagingY };
}

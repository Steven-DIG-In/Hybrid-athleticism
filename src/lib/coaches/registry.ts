// src/lib/coaches/registry.ts
import type { CoachConfig } from './types'
import type { CoachDomain } from '@/lib/skills/types'

export class CoachRegistry {
  private coaches = new Map<CoachDomain, CoachConfig>()

  register(config: CoachConfig): void {
    this.coaches.set(config.id, config)
  }

  getCoach(id: CoachDomain): CoachConfig | undefined {
    return this.coaches.get(id)
  }

  getAllCoaches(): CoachConfig[] {
    return Array.from(this.coaches.values())
  }

  getAlwaysActiveCoaches(): CoachConfig[] {
    return this.getAllCoaches().filter(c => c.alwaysActive)
  }

  getSelectableCoaches(): CoachConfig[] {
    return this.getAllCoaches().filter(c => !c.alwaysActive)
  }
}

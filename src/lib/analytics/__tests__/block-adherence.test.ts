import { describe, it, expect } from 'vitest'
import { rollupHeatmapCells } from '../block-adherence'

describe('block-adherence rollupHeatmapCells', () => {
  it('classifies each session by status × training_day × slot', () => {
    const sessions = [
      { training_day: 1, session_slot: 1, status: 'completed', delta_magnitude_pct: 3 },
      { training_day: 1, session_slot: 2, status: 'completed', delta_magnitude_pct: 12 },
      { training_day: 2, session_slot: 1, status: 'missed', delta_magnitude_pct: null },
      { training_day: 3, session_slot: 1, status: 'scheduled', delta_magnitude_pct: null },
    ]
    const cells = rollupHeatmapCells(sessions)
    expect(cells).toHaveLength(4)
    expect(cells.find(c => c.training_day === 1 && c.session_slot === 1)?.state).toBe('on_track')
    expect(cells.find(c => c.training_day === 1 && c.session_slot === 2)?.state).toBe('off_track')
    expect(cells.find(c => c.training_day === 2)?.state).toBe('missed')
    expect(cells.find(c => c.training_day === 3)?.state).toBe('pending')
  })
})

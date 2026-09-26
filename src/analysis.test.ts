import { describe, expect, it } from 'vitest'
import { afterlife, classifySnapshots } from './analysis'

const snapshots = Array.from({ length: 16 }, (_, i) => ({ date: `2026-01-${String(i + 1).padStart(2, '0')}`, value_usd: 1, balance_24h_percent_change: i < 8 ? 0.1 : 0 }))
describe('alpha lifecycle analysis', () => {
  it('keeps the OOS dead signal separate from training data', () => expect(classifySnapshots(snapshots).status).toBe('DEAD'))
  it('abstains when the afterlife sample is too small', () => expect(afterlife(snapshots.slice(0, 10)).label).toBe('ABSTAIN'))
})

export type Snapshot = { date: string; value_usd: number; balance_24h_percent_change?: number }
export type Status = 'LIVE' | 'DECAYING' | 'DEAD' | 'UNKNOWN'
export const ROUND_TRIP_COST = 0.001

export function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function classifySnapshots(snapshots: Snapshot[]) {
  const ordered = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))
  if (ordered.length < 8) return { status: 'UNKNOWN' as Status, reason: 'Need at least 8 daily snapshots', halfLifeDays: null, confidence: 0 }
  const changes = ordered.map((x) => (x.balance_24h_percent_change ?? 0) - ROUND_TRIP_COST)
  const train = changes.slice(0, Math.floor(changes.length * 0.6))
  const test = changes.slice(Math.floor(changes.length * 0.6))
  const baseline = median(train) ?? 0
  const oos = median(test) ?? 0
  const ratio = Math.abs(baseline) < 0.0001 ? 0 : oos / baseline
  const status: Status = Math.abs(oos) < 0.01 ? 'DEAD' : ratio < 0.5 ? 'DECAYING' : 'LIVE'
  const halfLifeDays = status === 'LIVE' ? null : Math.max(1, Math.round(test.length / 2))
  return { status, reason: `OOS median ${oos.toFixed(3)} vs train ${baseline.toFixed(3)}`, halfLifeDays, confidence: Math.min(0.99, 0.5 + ordered.length / 100) }
}

export function afterlife(snapshots: Snapshot[]) {
  const ordered = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))
  if (ordered.length < 12) return { label: 'ABSTAIN', reason: 'Insufficient post-death observations' }
  const tail = ordered.slice(-4).map((x) => x.balance_24h_percent_change ?? 0)
  const signal = median(tail) ?? 0
  if (Math.abs(signal) < 0.01) return { label: 'NEUTRAL', reason: 'No stable post-death direction' }
  return { label: signal < 0 ? 'INVERTED' : 'REBORN', reason: `Tail median ${signal.toFixed(3)}` }
}

export function crowding(snapshots: Snapshot[]) {
  if (snapshots.length < 8) return { score: null, disagreement: null }
  const changes = snapshots.map((x) => x.balance_24h_percent_change ?? 0)
  const positive = changes.filter((x) => x > 0.01).length / changes.length
  const negative = changes.filter((x) => x < -0.01).length / changes.length
  const score = Math.round(Math.max(positive, negative) * 100)
  return { score, disagreement: Math.round(Math.min(positive, negative) * 100) }
}

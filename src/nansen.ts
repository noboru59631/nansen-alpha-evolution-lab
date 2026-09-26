import type { Snapshot } from './analysis'

const base = import.meta.env.VITE_NANSEN_API_BASE || 'https://api.nansen.ai/api/v1'
const key = import.meta.env.VITE_NANSEN_API_KEY

export const hasLiveKey = Boolean(key)

export async function getHistoricalHoldings(chain: string, from: string, to: string): Promise<Snapshot[]> {
  if (!key) return []
  const response = await fetch(`${base}/smart-money/historical-holdings`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', apiKey: key },
    body: JSON.stringify({ date_range: { from, to }, chains: [chain], filters: { include_smart_money_labels: ['Fund', 'Smart Trader'] }, pagination: { page: 1, per_page: 100 }, order_by: [{ field: 'date', direction: 'ASC' }] })
  })
  if (!response.ok) throw new Error(`Nansen API ${response.status}`)
  const payload = await response.json() as { data?: Snapshot[] }
  return payload.data ?? []
}

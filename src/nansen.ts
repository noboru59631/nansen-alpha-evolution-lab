import type { HistoricalHolding } from './analysis'

export type NansenMeta = { endpoint: string; creditsUsed: string | null; creditsRemaining: string | null; requestId: string | null }
type ApiResponse = { data: HistoricalHolding[]; pagination: { page: number; per_page: number; is_last_page: boolean }; meta: NansenMeta }

async function post(body: Record<string, unknown>): Promise<ApiResponse> {
  const response = await fetch('/api/nansen/historical-holdings', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.message || `Nansen API ${response.status}`)
  return payload
}

export async function getApiStatus(): Promise<{ configured: boolean }> {
  const response = await fetch('/api/nansen/status')
  if (!response.ok) return { configured: false }
  return response.json()
}

export function discoverTokens(chain: string, date: string) {
  return post({
    date_range: { from: date, to: date }, chains: [chain],
    filters: { include_smart_money_labels: ['Fund', 'Smart Trader'], include_stablecoins: false, include_native_tokens: false, holders_count: { min: 3 } },
    pagination: { page: 1, per_page: 1000 }, order_by: [{ field: 'value_usd', direction: 'DESC' }],
  })
}

export function getTokenHistory(chain: string, tokenAddress: string, from: string, to: string) {
  return post({
    date_range: { from, to }, chains: [chain],
    filters: { include_smart_money_labels: ['Fund', 'Smart Trader'], include_stablecoins: false, include_native_tokens: false, token_address: tokenAddress },
    pagination: { page: 1, per_page: 1000 }, order_by: [{ field: 'date', direction: 'ASC' }],
  })
}

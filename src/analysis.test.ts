import { describe, expect, it } from 'vitest'
import { auditToken, type HistoricalHolding } from './analysis'

function series(days: number, signal = 0.05, dailyReturn = 0.02): HistoricalHolding[] {
  return Array.from({ length: days }, (_, index) => ({
    date: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), chain: 'solana',
    token_address: 'token', token_symbol: 'TEST', token_sectors: [], smart_money_labels: ['Smart Trader'],
    balance_24h_percent_change: signal, market_cap_usd: 100 * (1 + dailyReturn) ** index,
    holders_count: 10 + index, share_of_holdings_percent: 0.1 + index / 1000, token_age_days: 100 + index,
  }))
}

describe('point-in-time alpha audit', () => {
  it('uses signal at t only with the next consecutive day return', () => {
    const result = auditToken(series(40))
    expect(result.sampleSize).toBe(39)
    expect(result.oosExpectancy).toBeCloseTo(0.019, 5)
  })

  it('abstains when sample size is insufficient', () => {
    const result = auditToken(series(10))
    expect(result.status).toBe('UNKNOWN')
    expect(result.afterlife).toBe('ABSTAIN')
    expect(result.metaState).toBe('ABSTAIN')
  })

  it('does not bridge missing calendar days', () => {
    const rows = series(25)
    rows.splice(12, 1)
    expect(auditToken(rows).sampleSize).toBe(22)
  })

  it('marks a statistically persistent positive edge live', () => {
    expect(auditToken(series(50)).status).toBe('LIVE')
  })
})

import type { AuditResult, HistoricalHolding } from './analysis'

export const SAVED_TOKEN_ADDRESS = 'saved:PERCOLATOR'

export const savedToken: HistoricalHolding = {
  date: '2026-09-23', chain: 'solana', token_address: SAVED_TOKEN_ADDRESS, token_symbol: 'PERCOLATOR', token_sectors: [], smart_money_labels: ['Fund', 'Smart Trader'],
}

export const savedResult: AuditResult = {
  status: 'DEAD', afterlife: 'INVERTED', metaState: 'FADE',
  reason: 'Verified 90-day study: the OOS interval is fully below zero after costs; reversed signal is positive after death.',
  sampleSize: 90, trainSize: 54, oosSize: 36, signalAgeDays: null,
  trainExpectancy: 0.0040686545779102905, oosExpectancy: -0.0574275813464392, costAdjustedExpectancy: -0.0574275813464392,
  oosCi: [-0.11124714979532947, -0.0036080128975489317], alphaHalfLifeDays: 9,
  crowdingPressure: 0.266304347826087, agentAgreement: 0.5, agentDisagreement: 0.5, latestFlow: -0.1362,
  agents: [], curve: [],
  trace: [
    { source: 'saved research', fields: 'PERCOLATOR · Solana · 90 settled pairs', formula: 'fixed universe at window start', value: 'verified 2026-09-27 UTC' },
    { source: 'walk-forward', fields: '60% train / 40% untouched OOS', formula: 'mean(sign(signal) × next return − cost)', value: 'train +0.41% · OOS −5.74%' },
    { source: 'confidence interval', fields: '36 OOS pairs', formula: '95% interval around OOS expectancy', value: '−11.12% to −0.36%' },
    { source: 'afterlife test', fields: 'post-death observations', formula: 'reverse signal after confirmed death', value: 'INVERTED' },
    { source: 'crowding proxy', fields: 'agreement + SM share percentile', formula: '(agreement + concentration percentile) / 2', value: '27 / 100 score' },
    { source: 'agent panel', fields: 'four deterministic agents', formula: '1 − largest vote share', value: '50% disagreement' },
  ],
}

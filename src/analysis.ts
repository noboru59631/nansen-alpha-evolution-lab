export type HistoricalHolding = {
  date: string
  chain: string
  token_address: string
  token_symbol: string
  token_sectors: string[]
  smart_money_labels: string[]
  balance?: number | null
  value_usd?: number | null
  balance_24h_percent_change?: number | null
  holders_count?: number | null
  share_of_holdings_percent?: number | null
  token_age_days?: number | null
  market_cap_usd?: number | null
}

export type LifecycleStatus = 'LIVE' | 'DECAYING' | 'DEAD' | 'UNKNOWN'
export type AfterlifeStatus = 'NEUTRAL' | 'INVERTED' | 'REBORN' | 'ABSTAIN'
export type AgentDirection = 'BULLISH' | 'BEARISH' | 'NEUTRAL'
export type MetaState = 'FOLLOW' | 'WAIT' | 'ABSTAIN' | 'FADE'

export const ROUND_TRIP_COST_BPS = 10
export const MIN_PAIRED_OBSERVATIONS = 20
const DAY_MS = 86_400_000

type PairedObservation = {
  date: string
  signal: number
  forwardReturn: number
  grossEdge: number
  netEdge: number
}

export type AuditResult = {
  status: LifecycleStatus
  afterlife: AfterlifeStatus
  metaState: MetaState
  reason: string
  sampleSize: number
  trainSize: number
  oosSize: number
  signalAgeDays: number | null
  trainExpectancy: number | null
  oosExpectancy: number | null
  costAdjustedExpectancy: number | null
  oosCi: [number, number] | null
  alphaHalfLifeDays: number | null
  crowdingPressure: number | null
  agentAgreement: number | null
  agentDisagreement: number | null
  latestFlow: number | null
  agents: { name: string; direction: AgentDirection; evidence: string }[]
  curve: { date: string; value: number; phase: 'TRAIN' | 'OOS' }[]
  trace: { source: string; fields: string; formula: string; value: string }[]
}

export function mean(values: number[]) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null
}

export function median(values: number[]) {
  if (!values.length) return null
  const sorted = [...values].sort((left, right) => left - right)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

function confidenceInterval(values: number[]): [number, number] | null {
  const average = mean(values)
  if (average === null || values.length < 2) return null
  const variance = values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1)
  const margin = 1.96 * Math.sqrt(variance / values.length)
  return [average - margin, average + margin]
}

function direction(value: number, neutralBand = 0): AgentDirection {
  if (value > neutralBand) return 'BULLISH'
  if (value < -neutralBand) return 'BEARISH'
  return 'NEUTRAL'
}

function isConsecutiveDay(current: string, next: string) {
  return (Date.parse(next) - Date.parse(current)) / DAY_MS === 1
}

function buildPairs(rows: HistoricalHolding[], cost: number): PairedObservation[] {
  const byDate = new Map(rows.map((row) => [row.date, row]))
  const ordered = [...byDate.values()].sort((left, right) => left.date.localeCompare(right.date))
  const pairs: PairedObservation[] = []
  for (let index = 0; index < ordered.length - 1; index += 1) {
    const current = ordered[index]
    const next = ordered[index + 1]
    if (!isConsecutiveDay(current.date, next.date)) continue
    if (!current.market_cap_usd || !next.market_cap_usd || current.balance_24h_percent_change == null) continue
    const signalDirection = Math.sign(current.balance_24h_percent_change)
    if (signalDirection === 0) continue
    const forwardReturn = next.market_cap_usd / current.market_cap_usd - 1
    const grossEdge = signalDirection * forwardReturn
    pairs.push({ date: current.date, signal: current.balance_24h_percent_change, forwardReturn, grossEdge, netEdge: grossEdge - cost })
  }
  return pairs
}

function buildAgents(rows: HistoricalHolding[]) {
  const ordered = [...rows].sort((left, right) => left.date.localeCompare(right.date))
  const latest = ordered.at(-1)
  const previous = ordered.at(-2)
  const prior = ordered.at(-4)
  if (!latest || !previous) return []
  const recentFlow = median(ordered.slice(-3).flatMap((row) => row.balance_24h_percent_change == null ? [] : [row.balance_24h_percent_change])) ?? 0
  const priceTrend = prior?.market_cap_usd && latest.market_cap_usd ? latest.market_cap_usd / prior.market_cap_usd - 1 : 0
  const holderBreadth = latest.holders_count != null && previous.holders_count != null ? latest.holders_count - previous.holders_count : 0
  const historicalShare = median(ordered.flatMap((row) => row.share_of_holdings_percent == null ? [] : [row.share_of_holdings_percent]))
  const concentration = historicalShare != null && latest.share_of_holdings_percent != null ? latest.share_of_holdings_percent - historicalShare : 0
  return [
    { name: 'Flow momentum', direction: direction(recentFlow), evidence: `3D median balance change ${formatPercent(recentFlow)}` },
    { name: 'Price trend', direction: direction(priceTrend, 0.001), evidence: `3D market-cap return ${formatPercent(priceTrend)}` },
    { name: 'Holder breadth', direction: direction(holderBreadth), evidence: `Daily SM holder change ${holderBreadth >= 0 ? '+' : ''}${holderBreadth}` },
    { name: 'Concentration', direction: direction(concentration), evidence: `SM share vs history ${formatNumber(concentration, 3)}pp` },
  ]
}

function formatPercent(value: number | null) {
  return value == null ? '—' : `${(value * 100).toFixed(2)}%`
}

function formatNumber(value: number | null, digits = 2) {
  return value == null ? '—' : value.toFixed(digits)
}

export function auditToken(rows: HistoricalHolding[], costBps = ROUND_TRIP_COST_BPS): AuditResult {
  const ordered = [...rows].sort((left, right) => left.date.localeCompare(right.date))
  const cost = costBps / 10_000
  const pairs = buildPairs(ordered, cost)
  const agents = buildAgents(ordered)
  const directionCounts = agents.reduce<Record<AgentDirection, number>>((counts, agent) => ({ ...counts, [agent.direction]: counts[agent.direction] + 1 }), { BULLISH: 0, BEARISH: 0, NEUTRAL: 0 })
  const agreement = agents.length ? Math.max(...Object.values(directionCounts)) / agents.length : null
  const disagreement = agreement == null ? null : 1 - agreement
  const latest = ordered.at(-1)
  const shares = ordered.flatMap((row) => row.share_of_holdings_percent == null ? [] : [row.share_of_holdings_percent]).sort((a, b) => a - b)
  const sharePercentile = latest?.share_of_holdings_percent != null && shares.length
    ? shares.filter((value) => value <= latest.share_of_holdings_percent!).length / shares.length
    : null
  const crowding = agreement == null || sharePercentile == null ? null : (agreement + sharePercentile) / 2
  const base = {
    sampleSize: pairs.length,
    signalAgeDays: latest?.token_age_days ?? null,
    crowdingPressure: crowding,
    agentAgreement: agreement,
    agentDisagreement: disagreement,
    latestFlow: latest?.balance_24h_percent_change ?? null,
    agents,
  }

  if (pairs.length < MIN_PAIRED_OBSERVATIONS) {
    return {
      ...base, status: 'UNKNOWN', afterlife: 'ABSTAIN', metaState: 'ABSTAIN',
      reason: `Need ${MIN_PAIRED_OBSERVATIONS} consecutive signal→next-day pairs; found ${pairs.length}.`,
      trainSize: 0, oosSize: 0, trainExpectancy: null, oosExpectancy: null, costAdjustedExpectancy: null,
      oosCi: null, alphaHalfLifeDays: null, curve: [],
      trace: buildTrace(pairs.length, null, null, costBps, crowding, disagreement),
    }
  }

  const trainSize = Math.floor(pairs.length * 0.6)
  const train = pairs.slice(0, trainSize)
  const oos = pairs.slice(trainSize)
  const trainExpectancy = mean(train.map((pair) => pair.netEdge))!
  const oosExpectancy = mean(oos.map((pair) => pair.netEdge))!
  const oosCi = confidenceInterval(oos.map((pair) => pair.netEdge))!
  const retention = trainExpectancy > 0 ? oosExpectancy / trainExpectancy : null
  let status: LifecycleStatus
  let reason: string
  if (trainExpectancy <= 0) {
    status = 'UNKNOWN'
    reason = 'The training window did not establish a positive cost-adjusted edge.'
  } else if (oosCi[0] > 0 && retention != null && retention >= 0.5) {
    status = 'LIVE'
    reason = 'OOS edge remains positive and retains at least half of training expectancy.'
  } else if (oosExpectancy > 0) {
    status = 'DECAYING'
    reason = 'OOS expectancy is positive, but weaker or statistically uncertain.'
  } else if (oosCi[1] < 0) {
    status = 'DEAD'
    reason = 'The full 95% OOS interval is below zero after costs.'
  } else {
    status = 'UNKNOWN'
    reason = 'OOS evidence crosses zero; the lifecycle state is unresolved.'
  }

  const rollingWindow = Math.min(5, oos.length)
  let halfLifeDays: number | null = null
  let deathIndex = -1
  for (let index = rollingWindow - 1; index < oos.length; index += 1) {
    const rolling = mean(oos.slice(index - rollingWindow + 1, index + 1).map((pair) => pair.netEdge))!
    if (halfLifeDays == null && trainExpectancy > 0 && rolling <= trainExpectancy / 2) halfLifeDays = index + 1
    if (deathIndex < 0 && rolling <= 0) deathIndex = trainSize + index
  }

  let afterlife: AfterlifeStatus = 'ABSTAIN'
  if (status === 'DEAD' && deathIndex >= 0) {
    const postDeath = pairs.slice(deathIndex + 1)
    if (postDeath.length >= 8) {
      const original = postDeath.map((pair) => pair.netEdge)
      const inverted = postDeath.map((pair) => -pair.grossEdge - cost)
      const recentOriginal = original.slice(-5)
      const invertedCi = confidenceInterval(inverted)
      const rebornCi = confidenceInterval(recentOriginal)
      if (invertedCi && invertedCi[0] > 0) afterlife = 'INVERTED'
      else if (rebornCi && rebornCi[0] > 0) afterlife = 'REBORN'
      else afterlife = 'NEUTRAL'
    }
  }

  const metaState: MetaState = status === 'LIVE'
    ? crowding != null && crowding >= 0.75 ? 'WAIT' : 'FOLLOW'
    : status === 'DECAYING' ? 'WAIT'
      : status === 'DEAD' && afterlife === 'INVERTED' ? 'FADE' : 'ABSTAIN'
  let cumulative = 0
  const curve = pairs.map((pair, index) => {
    cumulative += pair.netEdge
    return { date: pair.date, value: cumulative, phase: index < trainSize ? 'TRAIN' as const : 'OOS' as const }
  })

  return {
    ...base, status, afterlife, metaState, reason, trainSize, oosSize: oos.length,
    trainExpectancy, oosExpectancy, costAdjustedExpectancy: oosExpectancy, oosCi,
    alphaHalfLifeDays: halfLifeDays, curve,
    trace: buildTrace(pairs.length, trainExpectancy, oosExpectancy, costBps, crowding, disagreement),
  }
}

function buildTrace(sample: number, train: number | null, oos: number | null, costBps: number, crowding: number | null, disagreement: number | null) {
  return [
    { source: 'historical-holdings', fields: 'balance_24h_percent_change(t)', formula: 'sign(SM balance change)', value: `${sample} valid signal days` },
    { source: 'historical-holdings', fields: 'market_cap_usd(t), market_cap_usd(t+1)', formula: 'MCap(t+1) / MCap(t) − 1', value: `${sample} consecutive next-day returns` },
    { source: 'walk-forward', fields: '60% train / 40% untouched OOS', formula: 'mean(sign(signal) × next return − cost)', value: `train ${formatPercent(train)} · OOS ${formatPercent(oos)}` },
    { source: 'cost model', fields: 'fixed disclosed hurdle', formula: `gross edge − ${costBps} bps`, value: `${costBps} bps per observed signal` },
    { source: 'crowding proxy', fields: 'agent consensus + SM share percentile', formula: '(agreement + concentration percentile) / 2', value: formatPercent(crowding) },
    { source: 'agent panel', fields: 'flow, trend, breadth, concentration', formula: '1 − largest vote share', value: formatPercent(disagreement) },
  ]
}

import { readFile, writeFile } from 'node:fs/promises'
import { auditToken, type HistoricalHolding } from '../src/analysis.ts'

const endpoint = 'https://api.nansen.ai/api/v1/smart-money/historical-holdings'
const limitArgument = process.argv.find((argument) => argument.startsWith('--limit='))
const offsetArgument = process.argv.find((argument) => argument.startsWith('--offset='))
const daysArgument = process.argv.find((argument) => argument.startsWith('--days='))
const outputArgument = process.argv.find((argument) => argument.startsWith('--output='))
const limit = Math.max(1, Math.min(100, Number(limitArgument?.split('=')[1] ?? 12)))
const offset = Math.max(0, Number(offsetArgument?.split('=')[1] ?? 0))
const windowDays = Math.max(30, Math.min(365, Number(daysArgument?.split('=')[1] ?? 94)))
const output = outputArgument?.slice('--output='.length) || 'research/latest-findings.json'

function isoDaysAgo(days: number) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - days)
  return date.toISOString().slice(0, 10)
}

async function apiKey() {
  const env = await readFile('.env.local', 'utf8')
  const line = env.split(/\r?\n/).find((candidate) => /^(VITE_)?NANSEN_API_KEY=/.test(candidate))
  const key = line?.slice(line.indexOf('=') + 1).trim()
  if (!key) throw new Error('Nansen API key is missing from .env.local')
  return key
}

async function call(key: string, body: Record<string, unknown>) {
  const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', apikey: key }, body: JSON.stringify(body) })
  const payload = await response.json() as { data?: HistoricalHolding[]; message?: string }
  if (!response.ok) throw new Error(payload.message || `Nansen API ${response.status}`)
  return {
    data: payload.data ?? [],
    creditsUsed: Number(response.headers.get('x-nansen-credits-used') ?? 0),
    creditsRemaining: response.headers.get('x-nansen-credits-remaining'),
  }
}

const key = await apiKey()
const end = isoDaysAgo(3)
const start = isoDaysAgo(windowDays)
let callsMade = 0
let creditsUsed = 0
let creditsRemaining: string | null = null

const discovery = await call(key, {
  date_range: { from: start, to: start }, chains: ['solana'],
  filters: { include_smart_money_labels: ['Fund', 'Smart Trader'], include_stablecoins: false, include_native_tokens: false, holders_count: { min: 3 } },
  pagination: { page: 1, per_page: 1000 }, order_by: [{ field: 'value_usd', direction: 'DESC' }],
})
callsMade += 1
creditsUsed += discovery.creditsUsed
creditsRemaining = discovery.creditsRemaining

const candidates = discovery.data.filter((row) => row.token_address && row.market_cap_usd).slice(offset, offset + limit)
const tokens = []
for (const candidate of candidates) {
  const history = await call(key, {
    date_range: { from: start, to: end }, chains: ['solana'],
    filters: { include_smart_money_labels: ['Fund', 'Smart Trader'], include_stablecoins: false, include_native_tokens: false, token_address: candidate.token_address },
    pagination: { page: 1, per_page: 1000 }, order_by: [{ field: 'date', direction: 'ASC' }],
  })
  callsMade += 1
  creditsUsed += history.creditsUsed
  creditsRemaining = history.creditsRemaining
  const audit = auditToken(history.data)
  tokens.push({
    symbol: candidate.token_symbol,
    snapshots: history.data.length,
    pairedObservations: audit.sampleSize,
    status: audit.status,
    afterlife: audit.afterlife,
    metaState: audit.metaState,
    trainExpectancy: audit.trainExpectancy,
    oosExpectancy: audit.oosExpectancy,
    oosCi: audit.oosCi,
    alphaHalfLifeDays: audit.alphaHalfLifeDays,
    crowdingPressure: audit.crowdingPressure,
    agentDisagreement: audit.agentDisagreement,
  })
}

const countBy = (field: 'status' | 'afterlife') => Object.fromEntries([...new Set(tokens.map((token) => token[field]))].sort().map((value) => [value, tokens.filter((token) => token[field] === value).length]))
const report = {
  generatedAt: new Date().toISOString(),
  source: endpoint,
  chain: 'solana',
  settledWindow: { from: start, to: end },
  methodology: 'Universe fixed at window start; signal at t = sign(balance_24h_percent_change); return = market_cap_usd(t+1)/market_cap_usd(t)-1; 10 bps cost; chronological 60/40 split.',
  callsMade,
  creditsUsed,
  creditsRemaining,
  analyzedTokens: tokens.length,
  universeOffset: offset,
  lifecycleCounts: countBy('status'),
  afterlifeCounts: countBy('afterlife'),
  invertedCases: tokens.filter((token) => token.afterlife === 'INVERTED').map((token) => token.symbol),
  tokens,
}

await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, 'utf8')
console.log(JSON.stringify({ output, callsMade, creditsUsed, creditsRemaining, lifecycleCounts: report.lifecycleCounts, afterlifeCounts: report.afterlifeCounts, invertedCases: report.invertedCases }, null, 2))

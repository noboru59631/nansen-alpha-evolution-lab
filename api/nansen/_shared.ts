const CACHE_TTL_MS = 60_000
const RATE_WINDOW_MS = 10 * 60_000
const MAX_REQUESTS_PER_WINDOW = 12

type CacheEntry = { expiresAt: number; payload: unknown; status: number }
type InFlight = Promise<{ payload: unknown; status: number }>

type RuntimeState = {
  cache: Map<string, CacheEntry>
  inFlight: Map<string, InFlight>
  rate: Map<string, { startedAt: number; count: number }>
}

const runtime = globalThis as typeof globalThis & { __alphaLabRuntime?: RuntimeState }

export function getRuntime(): RuntimeState {
  runtime.__alphaLabRuntime ??= { cache: new Map(), inFlight: new Map(), rate: new Map() }
  return runtime.__alphaLabRuntime
}

export function clientKey(request: any) {
  const forwarded = request.headers?.['x-forwarded-for']
  return (typeof forwarded === 'string' ? forwarded.split(',')[0] : request.socket?.remoteAddress) || 'unknown'
}

export function rateLimit(request: any) {
  const state = getRuntime()
  const key = clientKey(request)
  const now = Date.now()
  const previous = state.rate.get(key)
  const current = !previous || now - previous.startedAt >= RATE_WINDOW_MS
    ? { startedAt: now, count: 1 }
    : { ...previous, count: previous.count + 1 }
  state.rate.set(key, current)
  return { allowed: current.count <= MAX_REQUESTS_PER_WINDOW, retryAfter: Math.ceil((current.startedAt + RATE_WINDOW_MS - now) / 1000) }
}

export function requestBody(request: any): Record<string, unknown> | null {
  if (request.body && typeof request.body === 'object') return request.body
  if (typeof request.body === 'string') {
    try { return JSON.parse(request.body) } catch { return null }
  }
  return null
}

export function validate(body: Record<string, unknown> | null) {
  if (!body || typeof body !== 'object') return 'A JSON request body is required.'
  const dateRange = body.date_range as Record<string, unknown> | undefined
  const chains = body.chains
  if (!dateRange || typeof dateRange.from !== 'string' || typeof dateRange.to !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateRange.from) || !/^\d{4}-\d{2}-\d{2}$/.test(dateRange.to)) return 'date_range.from and date_range.to must be ISO dates.'
  const span = (Date.parse(dateRange.to) - Date.parse(dateRange.from)) / 86_400_000
  if (!Number.isFinite(span) || span < 0 || span > 120) return 'The requested date window must be between 0 and 120 days.'
  if (!Array.isArray(chains) || chains.length !== 1 || !['solana', 'ethereum', 'base'].includes(String(chains[0]))) return 'Exactly one supported chain is required.'
  const filters = body.filters as Record<string, unknown> | undefined
  if (!filters || typeof filters !== 'object') return 'filters are required.'
  if (filters.token_address != null && (typeof filters.token_address !== 'string' || !/^[A-Za-z0-9:_-]{1,128}$/.test(filters.token_address))) return 'token_address is invalid.'
  const pagination = body.pagination as Record<string, unknown> | undefined
  if (!pagination || pagination.page !== 1 || typeof pagination.per_page !== 'number' || !Number.isInteger(pagination.per_page) || pagination.per_page < 1 || pagination.per_page > 1000) return 'Only page 1 with per_page between 1 and 1000 is supported.'
  return null
}

export async function upstream(body: Record<string, unknown>, apiKey: string) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 20_000)
  try {
    const response = await fetch('https://api.nansen.ai/api/v1/smart-money/historical-holdings', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', apikey: apiKey }, body: JSON.stringify(body), signal: controller.signal,
    })
    const text = await response.text()
    let payload: unknown
    try { payload = JSON.parse(text) } catch { payload = { message: 'Nansen returned a non-JSON response.' } }
    return {
      status: response.status,
      payload: {
        ...(payload as object),
        meta: {
          endpoint: '/api/v1/smart-money/historical-holdings',
          creditsUsed: response.headers.get('x-nansen-credits-used'),
          creditsRemaining: response.headers.get('x-nansen-credits-remaining'),
          requestId: response.headers.get('x-request-id'),
        },
      },
    }
  } finally { clearTimeout(timer) }
}

export async function cachedUpstream(body: Record<string, unknown>, apiKey: string) {
  const state = getRuntime()
  const key = JSON.stringify(body)
  const cached = state.cache.get(key)
  if (cached && cached.expiresAt > Date.now()) return { status: cached.status, payload: cached.payload, cached: true }
  const pending = state.inFlight.get(key)
  if (pending) return { ...(await pending), cached: true }
  const request = upstream(body, apiKey)
  state.inFlight.set(key, request)
  try {
    const result = await request
    if (result.status >= 200 && result.status < 300) state.cache.set(key, { ...result, expiresAt: Date.now() + CACHE_TTL_MS })
    return { ...result, cached: false }
  } finally { state.inFlight.delete(key) }
}

export function send(response: any, status: number, payload: unknown, extraHeaders: Record<string, string> = {}) {
  response.setHeader('Cache-Control', 'no-store')
  for (const [name, value] of Object.entries(extraHeaders)) response.setHeader(name, value)
  response.status(status).json(payload)
}

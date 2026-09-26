import { cachedUpstream, rateLimit, requestBody, send, validate } from './_shared.ts'

export default async function handler(request: any, response: any) {
  if (request.method !== 'POST') return send(response, 405, { message: 'Method not allowed.' }, { Allow: 'POST' })
  const limit = rateLimit(request)
  if (!limit.allowed) return send(response, 429, { message: 'Too many live audits. Please try again later.' }, { 'Retry-After': String(limit.retryAfter) })
  const body = requestBody(request)
  const validationError = validate(body)
  if (validationError) return send(response, 400, { message: validationError })
  const apiKey = process.env.NANSEN_API_KEY
  if (!apiKey) return send(response, 503, { message: 'Live audit is not configured on this deployment.' })
  try {
    const result = await cachedUpstream(body!, apiKey)
    return send(response, result.status, result.payload, { 'X-Alpha-Lab-Cache': result.cached ? 'HIT' : 'MISS' })
  } catch (error) {
    const message = error instanceof Error && error.name === 'AbortError' ? 'Nansen request timed out.' : 'Nansen upstream request failed.'
    return send(response, 502, { message })
  }
}

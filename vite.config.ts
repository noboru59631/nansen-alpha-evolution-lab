import { defineConfig, loadEnv, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function nansenProxy(apiKey: string | undefined): Plugin {
  const install = (server: { middlewares: { use: (path: string, handler: (request: any, response: any) => void) => void } }) => {
    server.middlewares.use('/api/nansen', async (request, response) => {
      response.setHeader('Content-Type', 'application/json')
      if (request.url === '/status') {
        response.end(JSON.stringify({ configured: Boolean(apiKey) }))
        return
      }
      if (!apiKey) {
        response.statusCode = 503
        response.end(JSON.stringify({ message: 'Nansen API key is not configured.' }))
        return
      }
      if (request.method !== 'POST' || request.url !== '/historical-holdings') {
        response.statusCode = 404
        response.end(JSON.stringify({ message: 'Unknown local API route.' }))
        return
      }
      let rawBody = ''
      request.on('data', (chunk: Buffer) => { rawBody += chunk.toString() })
      request.on('end', async () => {
        try {
          const upstream = await fetch('https://api.nansen.ai/api/v1/smart-money/historical-holdings', {
            method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', apikey: apiKey }, body: rawBody,
          })
          const payload = await upstream.json()
          response.statusCode = upstream.status
          response.end(JSON.stringify({
            ...(payload as object),
            meta: {
              endpoint: '/api/v1/smart-money/historical-holdings',
              creditsUsed: upstream.headers.get('x-nansen-credits-used'),
              creditsRemaining: upstream.headers.get('x-nansen-credits-remaining'),
              requestId: upstream.headers.get('x-request-id'),
            },
          }))
        } catch {
          response.statusCode = 502
          response.end(JSON.stringify({ message: 'Nansen upstream request failed.' }))
        }
      })
    })
  }
  return { name: 'local-nansen-proxy', configureServer: install, configurePreviewServer: install }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return { plugins: [react(), nansenProxy(env.NANSEN_API_KEY || env.VITE_NANSEN_API_KEY)] }
})

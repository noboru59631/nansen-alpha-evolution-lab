export default function handler(_request: any, response: any) {
  response.setHeader('Cache-Control', 'no-store')
  response.status(200).json({ configured: Boolean(process.env.NANSEN_API_KEY) })
}

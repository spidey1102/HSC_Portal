import { handleOpenRouterRequest } from '../openrouterHandler.js'
import { requireApiAuth } from '../server/api/requireApiAuth.js'

export default async function handler(req, res) {
  const user = await requireApiAuth(req, res)
  if (!user) return
  // Delegate to the shared handler; Vercel will provide process.env.
  await handleOpenRouterRequest(req, res, process.env.OPENROUTER_API_KEY)
}

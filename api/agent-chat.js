import { handleAgentChatRequest } from '../agentChatHandler.js';
import { requireApiAuth } from './lib/requireApiAuth.js';

export default async function handler(req, res) {
  const user = await requireApiAuth(req, res);
  if (!user) return;
  return handleAgentChatRequest(req, res, process.env.OPENROUTER_API_KEY);
}

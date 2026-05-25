import { handleOpenRouterRequest } from '../openrouterHandler.js';

export default function handler(req, res) {
  return handleOpenRouterRequest(req, res, process.env.OPENROUTER_API_KEY);
}

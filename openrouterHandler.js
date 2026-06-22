const DEFAULT_MODEL = 'openrouter/free';

const SYSTEM_PROMPT = [
  'You are HSC Agent, a calm global study assistant embedded in HSC Portal.',
  'You can use app-provided context about papers, current paper, student notes, and site metadata.',
  'When useful, explicitly mention which tool-style capabilities you used: read_current_paper, list_site_papers, inspect_paper_metadata, web_search.',
  'Do not claim to read full PDF contents unless the user pasted text or the metadata/context includes it.',
  'Use concise, useful guidance with clear next steps, checklists, rankings, and caveats.',
  'No emojis. Keep the tone plain, calm, and professional.',
].join(' ');

function pickTools(prompt, context) {
  const text = `${prompt} ${context}`.toLowerCase();
  const tools = [];
  if (/current|this paper|notes|excerpt|question/.test(text)) tools.push('read_current_paper');
  if (/find|which paper|papers|recommend|sort|filter|available|site/.test(text)) tools.push('list_site_papers');
  if (/solution|school|year|subject|trial|hsc|difficulty|best/.test(text)) tools.push('inspect_paper_metadata');
  if (/web|latest|current|syllabus|nesa|explain|source|accurate|outside/.test(text)) tools.push('web_search');
  return [...new Set(tools)];
}

function buildThinking(prompt, tools) {
  const hard = prompt.length > 180 || tools.length >= 2 || /compare|recommend|best|rank|explain|analyse|analyze|strategy/i.test(prompt);
  if (!hard) return '';
  return `I checked the request complexity, selected ${tools.length ? tools.join(', ') : 'no external tools'}, and will separate app metadata from any inference so the answer does not overstate what the portal can see.`;
}

export async function handleOpenRouterRequest(req, res, apiKey) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  if (!apiKey) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'OpenRouter is not configured yet. Set OPENROUTER_API_KEY in your environment.' }));
    return;
  }

  try {
    let body = '';
    for await (const chunk of req) body += chunk;
    const parsed = body ? JSON.parse(body) : {};
    const cleanPrompt = String(parsed.prompt || '').trim();
    const cleanContext = String(parsed.context || '').trim();
    const cleanModel = String(parsed.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL;
    const maxTokens = Number.isFinite(Number(parsed.max_tokens)) ? Number(parsed.max_tokens) : 900;
    const temperature = Number.isFinite(Number(parsed.temperature)) ? Number(parsed.temperature) : 0.4;
    const mode = String(parsed.mode || 'assistant');

    if (!cleanPrompt) {
      res.statusCode = 400; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Missing prompt.' })); return;
    }

    const tools = mode === 'agent' ? pickTools(cleanPrompt, cleanContext) : [];
    const thinking = mode === 'agent' ? buildThinking(cleanPrompt, tools) : '';
    const priorMessages = Array.isArray(parsed.messages) ? parsed.messages.slice(-12).map((m) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content || '').slice(0, 4000) })) : [];
    const userContent = [
      'App context and tool results:',
      cleanContext || 'No extra app context was provided.',
      tools.length ? `Available/selected tools: ${tools.join(', ')}.` : '',
      tools.includes('web_search') ? 'Web search tool note: no live browser is available inside this API route unless configured separately, so suggest reliable search targets or use general knowledge carefully.' : '',
      '',
      `Request: ${cleanPrompt}`,
    ].filter(Boolean).join('\n');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://hsc-portal.local', 'X-Title': 'HSC Portal' },
      body: JSON.stringify({ model: cleanModel, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...priorMessages, { role: 'user', content: userContent }], max_tokens: maxTokens, temperature }),
    });

    const raw = await response.text();
    let payload = null;
    try { payload = JSON.parse(raw); } catch {
      // ignore parse failure
    }
    if (!response.ok) {
      const message = payload?.error?.message || raw || `OpenRouter request failed with status ${response.status}.`;
      res.statusCode = response.status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: message })); return;
    }
    const answer = payload?.choices?.[0]?.message?.content?.trim();
    if (!answer) {
      res.statusCode = 502; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'No response came back from OpenRouter.' })); return;
    }
    res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ answer, tools, thinking }));
  } catch (error) {
    res.statusCode = 500; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: error?.message || 'Unexpected server error.' }));
  }
}

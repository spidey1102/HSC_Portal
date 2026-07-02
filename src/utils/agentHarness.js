/**
 * agentHarness.js
 *
 * Client-side agentic execution loop.
 * Manages the conversation history and repeatedly calls /api/agent-chat
 * until the model returns a final text response (no more tool calls).
 */

import { getPaperIdentity } from './paperIdentity.js';
import { findAgenticPaperMatches } from './agenticPaperSearch.js';

// ─── Tool Definitions (OpenAI function-calling schema) ────────────────────────

export const AGENT_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_papers',
      description: 'Search the HSC paper database and return matching papers. Use this whenever the user asks to find, search, show, or look up papers.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language search query, e.g. "2022 Chemistry trial with solutions"',
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return. Defaults to 10.',
          },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_bookmarks',
      description: 'Returns a list of paper IDs that the student has currently bookmarked.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'bookmark_paper',
      description: 'Bookmarks a paper by its paper_id (the "viewno" field). Use after searching to find the right paper_id.',
      parameters: {
        type: 'object',
        properties: {
          paper_id: {
            type: 'string',
            description: 'The paper\'s unique identifier (v + "_" + n, as returned by search_papers)',
          },
          paper_name: {
            type: 'string',
            description: 'Human-readable name of the paper, for confirmation.',
          },
        },
        required: ['paper_id', 'paper_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_bookmark',
      description: 'Removes a paper from bookmarks by its paper_id.',
      parameters: {
        type: 'object',
        properties: {
          paper_id: {
            type: 'string',
            description: 'The paper\'s unique identifier',
          },
          paper_name: {
            type: 'string',
            description: 'Human-readable name of the paper, for confirmation.',
          },
        },
        required: ['paper_id', 'paper_name'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_calendar_event',
      description: 'Adds a study session, exam, or reminder to the calendar.',
      parameters: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'The event title, e.g. "Physics Study Session" or "Chemistry HSC Exam"',
          },
          date_string: {
            type: 'string',
            description: 'ISO 8601 date string, e.g. "2025-11-01" or "2025-11-01T16:00:00"',
          },
          description: {
            type: 'string',
            description: 'Optional notes or details for the event.',
          },
          color: {
            type: 'string',
            description: 'Optional color for the event. One of: "blue", "green", "red", "purple", "yellow", "orange"',
            enum: ['blue', 'green', 'red', 'purple', 'yellow', 'orange'],
          },
        },
        required: ['title', 'date_string'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_study_stats',
      description: 'Returns the student\'s study statistics: how many papers they\'ve viewed, completed, and bookmarked.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  },
];

// ─── Tool Executor ─────────────────────────────────────────────────────────────

/**
 * Executes a tool call locally with full access to React state.
 *
 * @param {string} toolName - The tool function name
 * @param {object} args - The parsed arguments from the model
 * @param {object} appContext - Live app state and callbacks passed from React
 * @returns {object} - The tool result object to append to conversation
 */
export async function executeTool(toolName, args, appContext) {
  const {
    papers = [],
    subjects = [],
    schools = [],
    bookmarks = new Set(),
    toggleBookmark,
    addCalendarEvent,
    selectedLevel,
  } = appContext;

  switch (toolName) {
    case 'search_papers': {
      const limit = typeof args.limit === 'number' ? Math.min(args.limit, 30) : 10;
      const result = findAgenticPaperMatches(
        args.query,
        papers,
        subjects,
        schools,
        { limit, defaultLevel: selectedLevel }
      );

      if (!result.applied || result.papers.length === 0) {
        return { found: 0, papers: [], summary: 'No papers matched the query.' };
      }

      // Return a simplified view of the papers (not full objects to save tokens)
      const simplified = result.papers.slice(0, limit).map(({ paper, score, reasons }) => ({
        paper_id: `${paper.v}_${paper.n}`,
        name: paper.n,
        subject: subjects[paper.s] || 'Unknown',
        school: schools[paper.h] || null,
        year: paper.y,
        category: paper.c === 'H' ? 'HSC Official' : paper.c === 'T' ? 'Trial' : 'Assessment',
        has_solutions: paper.w === 1,
        level: paper.l,
        score,
        reasons,
      }));

      return {
        found: result.total,
        returned: simplified.length,
        summary: result.summary,
        papers: simplified,
      };
    }

    case 'get_bookmarks': {
      const bookmarkedIds = Array.from(bookmarks);
      if (bookmarkedIds.length === 0) {
        return { count: 0, bookmarks: [], message: 'No papers are currently bookmarked.' };
      }

      // Resolve paper IDs to paper objects
      const resolved = bookmarkedIds.map((id) => {
        // paper_id format: v + "_" + n
        const underscoreIdx = id.indexOf('_');
        if (underscoreIdx === -1) return { paper_id: id, name: id };
        const v = id.substring(0, underscoreIdx);
        const n = id.substring(underscoreIdx + 1);
        const paper = papers.find((p) => String(p.v) === v && p.n === n);
        if (!paper) return { paper_id: id, name: n };
        return {
          paper_id: id,
          name: paper.n,
          subject: subjects[paper.s] || 'Unknown',
          year: paper.y,
          category: paper.c,
        };
      });

      return { count: resolved.length, bookmarks: resolved };
    }

    case 'bookmark_paper': {
      const { paper_id, paper_name } = args;
      if (!paper_id) return { success: false, error: 'No paper_id provided.' };

      if (bookmarks.has(paper_id)) {
        return { success: true, already_bookmarked: true, message: `"${paper_name}" is already bookmarked.` };
      }

      if (typeof toggleBookmark === 'function') {
        toggleBookmark(paper_id);
        return { success: true, message: `Bookmarked "${paper_name}".` };
      }

      return { success: false, error: 'Bookmark action not available.' };
    }

    case 'remove_bookmark': {
      const { paper_id, paper_name } = args;
      if (!paper_id) return { success: false, error: 'No paper_id provided.' };

      if (!bookmarks.has(paper_id)) {
        return { success: false, message: `"${paper_name}" is not currently bookmarked.` };
      }

      if (typeof toggleBookmark === 'function') {
        toggleBookmark(paper_id);
        return { success: true, message: `Removed bookmark for "${paper_name}".` };
      }

      return { success: false, error: 'Bookmark action not available.' };
    }

    case 'add_calendar_event': {
      const { title, date_string, description = '', color = 'blue' } = args;

      if (!title || !date_string) {
        return { success: false, error: 'Both title and date_string are required.' };
      }

      const date = new Date(date_string);
      if (isNaN(date.getTime())) {
        return { success: false, error: `Invalid date: "${date_string}". Use ISO 8601 format.` };
      }

      if (typeof addCalendarEvent === 'function') {
        addCalendarEvent({ title, date: date_string, description, color });
        return {
          success: true,
          message: `Added "${title}" to calendar on ${date.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}.`,
        };
      }

      return { success: false, error: 'Calendar action not available.' };
    }

    case 'get_study_stats': {
      try {
        const viewed = JSON.parse(localStorage.getItem('hsc_viewed_papers') || '[]');
        const completed = JSON.parse(localStorage.getItem('hsc_completed_papers') || '[]');
        const bookmarkedCount = bookmarks.size;

        return {
          papers_viewed: Array.isArray(viewed) ? viewed.length : 0,
          papers_completed: Array.isArray(completed) ? completed.length : 0,
          papers_bookmarked: bookmarkedCount,
          total_papers_available: papers.length,
        };
      } catch {
        return { papers_viewed: 0, papers_completed: 0, papers_bookmarked: bookmarks.size };
      }
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

// ─── Agent Execution Loop ──────────────────────────────────────────────────────

const MAX_TURNS = 6; // prevent infinite loops

/**
 * Runs the full agentic execution loop.
 *
 * @param {string} userMessage - The user's request
 * @param {object} appContext - Live React state and callbacks
 * @param {object} options
 * @param {function} options.onStep - Called on each step: { type, label, data }
 * @param {AbortSignal} options.signal - Abort signal to cancel mid-run
 * @returns {Promise<{ answer: string, steps: Array }>}
 */
export async function runAgent(userMessage, appContext, { onStep, signal } = {}) {
  const steps = [];

  const emit = (step) => {
    steps.push(step);
    if (typeof onStep === 'function') onStep(step);
  };

  const messages = [
    { role: 'user', content: userMessage },
  ];

  emit({ type: 'thinking', label: 'Thinking…' });

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    if (signal?.aborted) {
      throw new DOMException('Agent was cancelled.', 'AbortError');
    }

    let response;
    try {
      response = await fetch('/api/agent-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal,
        body: JSON.stringify({
          messages,
          tools: AGENT_TOOLS,
          tool_choice: 'auto',
        }),
      });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      throw new Error(`Network error: ${err.message}`);
    }

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `API error ${response.status}`);
    }

    const completion = await response.json();
    const message = completion?.choices?.[0]?.message;

    if (!message) {
      throw new Error('No response from agent.');
    }

    // Always push the assistant message to the conversation
    messages.push(message);

    // ── Case 1: Model wants to call tools ──
    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const toolCall of message.tool_calls) {
        const toolName = toolCall.function?.name;
        let toolArgs = {};
        try {
          toolArgs = JSON.parse(toolCall.function?.arguments || '{}');
        } catch {
          // keep empty args
        }

        emit({
          type: 'tool_call',
          label: formatToolLabel(toolName, toolArgs),
          tool: toolName,
          args: toolArgs,
        });

        let toolResult;
        try {
          toolResult = await executeTool(toolName, toolArgs, appContext);
        } catch (err) {
          toolResult = { error: err.message };
        }

        emit({
          type: 'tool_result',
          label: formatToolResultLabel(toolName, toolResult),
          tool: toolName,
          result: toolResult,
        });

        // Append tool result to conversation
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(toolResult),
        });
      }

      // Continue the loop so the model can respond with the results
      emit({ type: 'thinking', label: 'Processing results…' });
      continue;
    }

    // ── Case 2: Final text response ──
    const answer = message.content?.trim();
    if (answer) {
      emit({ type: 'answer', label: answer });
      return { answer, steps };
    }

    // Edge case: empty content and no tool calls
    throw new Error('Agent returned an empty response.');
  }

  throw new Error('Agent reached maximum turns without a final response.');
}

// ─── Label Formatters ──────────────────────────────────────────────────────────

function formatToolLabel(toolName, args) {
  switch (toolName) {
    case 'search_papers':
      return `Searching for "${args.query}"…`;
    case 'get_bookmarks':
      return 'Fetching your bookmarks…';
    case 'bookmark_paper':
      return `Bookmarking "${args.paper_name}"…`;
    case 'remove_bookmark':
      return `Removing bookmark for "${args.paper_name}"…`;
    case 'add_calendar_event':
      return `Adding "${args.title}" to calendar…`;
    case 'get_study_stats':
      return 'Checking your study statistics…';
    default:
      return `Running ${toolName}…`;
  }
}

function formatToolResultLabel(toolName, result) {
  switch (toolName) {
    case 'search_papers':
      if (result.found === 0) return 'No matching papers found.';
      return `Found ${result.found} paper${result.found === 1 ? '' : 's'} — showing top ${result.returned}.`;
    case 'get_bookmarks':
      return `You have ${result.count} bookmarked paper${result.count === 1 ? '' : 's'}.`;
    case 'bookmark_paper':
      return result.success ? result.message : `Failed: ${result.error}`;
    case 'remove_bookmark':
      return result.success ? result.message : `Failed: ${result.error || result.message}`;
    case 'add_calendar_event':
      return result.success ? result.message : `Failed: ${result.error}`;
    case 'get_study_stats':
      return `${result.papers_completed} completed, ${result.papers_viewed} viewed, ${result.papers_bookmarked} bookmarked.`;
    default:
      return result.success ? 'Done.' : (result.error || 'Unknown result.');
  }
}

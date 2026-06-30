import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { handleOpenRouterRequest } from './openrouterHandler.js'
<<<<<<< HEAD
import { handleAgentSearchRequest } from './agentSearchHandler.js'
=======
import { generateMockAnswer } from './openrouterHandler.js'
import fs from 'fs'
import { resolve } from 'path'
>>>>>>> 181888c (Add Vercel serverless API endpoints for OpenRouter and agent (find/extract/ask); wire PracticeRoom to auto-load questions)

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),

      

      {
        name: 'openrouter-dev-route',
        configureServer(server) {
          // OpenRouter proxy / mock
          server.middlewares.use('/api/openrouter', async (req, res, next) => {
            if (req.method !== 'POST') {
              next()
              return
            }

            await handleOpenRouterRequest(
              req,
              res,
              env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY
            )
          })

<<<<<<< HEAD
          server.middlewares.use('/api/agent-search', async (req, res, next) => {
            if (req.method !== 'POST') {
              next()
              return
            }

            await handleAgentSearchRequest(
              req,
              res,
              env.OPENROUTER_API_KEY || process.env.OPENROUTER_API_KEY
            )
=======
          // Simple agent endpoints for prototype
          server.middlewares.use('/api/agent/find', async (req, res, next) => {
            try {
              const url = new URL(req.url, 'http://localhost')
              const q = url.searchParams.get('q') || url.searchParams.get('query') || ''
              const raw = fs.readFileSync(resolve(process.cwd(), 'public', 'papers.json'), 'utf-8')
              const data = JSON.parse(raw)
              const papers = data.papers || []
              const subjects = data.subjects || []
              const ql = q.toLowerCase()
              const matches = papers.filter(p => {
                return String(p.n || '').toLowerCase().includes(ql) ||
                       (subjects[p.s] || '').toLowerCase().includes(ql)
              }).slice(0, 12).map(p => ({ v: p.v, n: p.n, s: subjects[p.s] || p.s, y: p.y }))
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ results: matches }))
            } catch (e) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: String(e) }))
            }
          })

          server.middlewares.use('/api/agent/extract', async (req, res, next) => {
            try {
              const url = new URL(req.url, 'http://localhost')
              const pid = url.searchParams.get('paperId') || url.searchParams.get('paper')
              const raw = fs.readFileSync(resolve(process.cwd(), 'public', 'papers.json'), 'utf-8')
              const data = JSON.parse(raw)
              const papers = data.papers || []
              const paper = papers.find(p => String(p.v) === String(pid))
              if (!paper) {
                res.statusCode = 404
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'paper not found' }))
                return
              }

              // Fake question extraction: split title into up to 6 chunks as demo
              const text = String(paper.n || '')
              const parts = text.split(/[:;-]|\.\s+/).map(s => s.trim()).filter(Boolean)
              const questions = parts.slice(0, 6).map((t, i) => ({ id: i+1, qnum: i+1, text: `Question ${i+1}: ${t}`, page: 1 }))
              if (questions.length === 0) questions.push({ id: 1, qnum: 1, text: `Question 1: ${paper.n}`, page: 1 })

              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ paperId: paper.v, questions }))
            } catch (e) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: String(e) }))
            }
          })

          server.middlewares.use('/api/agent/ask', async (req, res, next) => {
            if (req.method !== 'POST') return next()
            try {
              let body = ''
              for await (const chunk of req) body += chunk
              const parsed = body ? JSON.parse(body) : {}
              const paperId = parsed.paperId
              const questionId = parsed.questionId
              const prompt = String(parsed.prompt || '').trim()

              const raw = fs.readFileSync(resolve(process.cwd(), 'public', 'papers.json'), 'utf-8')
              const data = JSON.parse(raw)
              const papers = data.papers || []
              const paper = papers.find(p => String(p.v) === String(paperId))
              const paperTitle = paper ? paper.n : 'Unknown paper'
              const questionText = parsed.questionText || (questionId ? `Question ${questionId} from ${paperTitle}` : '')

              const context = [`Paper title: ${paperTitle}`, `Question: ${questionText}`].join('\n')

              const answer = generateMockAnswer(prompt || '', context)
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ answer }))
            } catch (e) {
              res.statusCode = 500
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: String(e) }))
            }
>>>>>>> 181888c (Add Vercel serverless API endpoints for OpenRouter and agent (find/extract/ask); wire PracticeRoom to auto-load questions)
          })
        },
      },
    ],
  }
})
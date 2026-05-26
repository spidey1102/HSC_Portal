import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { handleOpenRouterRequest } from './openrouterHandler.js'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),

      

      {
        name: 'openrouter-dev-route',
        configureServer(server) {
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
        },
      },
    ],
  }
})
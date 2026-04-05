import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api/coingecko': {
          target: 'https://pro-api.coingecko.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/coingecko/, '/api/v3/coins/markets'),
          headers: { 'x-cg-demo-api-key': env.CG_KEY },
        },
        '/api/cmc': {
          target: 'https://pro-api.coinmarketcap.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/cmc/, '/v1/cryptocurrency/listings/latest'),
          headers: { 'X-CMC_PRO_API_KEY': env.CMC_KEY },
        },
      },
    },
  }
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/cg-api': {
        target: 'https://pro-api.coingecko.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cg-api/, ''),
      },
      '/cmc-api': {
        target: 'https://pro-api.coinmarketcap.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/cmc-api/, ''),
      },
    },
  },
})

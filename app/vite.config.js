import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,          // expose on all network interfaces
    allowedHosts: 'all', // allow any hostname (Cloudflare tunnel, ngrok, etc.)
  },
})

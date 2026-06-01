import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5200,          // fixed port — keeps it clear of Market Map (5173)
    host: true,          // expose on all network interfaces
    allowedHosts: true,  // Vite 8: true = allow all hosts (fixes Cloudflare tunnel)
  },
})

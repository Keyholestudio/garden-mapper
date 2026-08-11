import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    port: 5200,          // fixed port — keeps it clear of Market Map (5173)
    host: true,          // expose on all network interfaces
    allowedHosts: true,  // Vite 8: true = allow all hosts (fixes Cloudflare tunnel)
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Heavy vendor libs — split into separate chunks so main bundle shrinks
          if (id.includes('node_modules/konva') || id.includes('node_modules/react-konva')) return 'vendor-konva'
          if (id.includes('node_modules/@supabase')) return 'vendor-supabase'
          if (id.includes('node_modules/@stripe')) return 'vendor-stripe'
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) return 'vendor-pdf'
          if (id.includes('node_modules/@capacitor') || id.includes('node_modules/@revenuecat')) return 'vendor-capacitor'
        },
      },
    },
    chunkSizeWarningLimit: 600,  // suppress warning for intentionally large vendor chunks
  },
})

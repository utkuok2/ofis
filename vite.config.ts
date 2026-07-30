import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Ofis - AI Çalışma Alanı',
        short_name: 'Ofis',
        description: 'OpenCode ücretsiz AI modelleri ile sanal ofis',
        theme_color: '#1a202c',
        background_color: '#1a202c',
        display: 'standalone',
        start_url: '.',
        icons: [
          {
            src: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y=".9em" font-size="90">🏢</text></svg>',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  root: 'src/renderer',
  base: './',
  build: {
    outDir: '../../dist',
    emptyOutDir: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
    },
  },
})

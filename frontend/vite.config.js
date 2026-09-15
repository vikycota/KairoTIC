import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // En producción Caddy expone el backend bajo /api (ver caddy/Caddyfile).
      // Replicamos lo mismo acá para que el front hable siempre con /api,
      // sin importar si corre con `npm run dev` o detrás de Caddy.
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
})

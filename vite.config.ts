import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://ronistern.github.io/curriculum-builder/ on GitHub Pages.
  base: '/curriculum-builder/',
  plugins: [react()],
})

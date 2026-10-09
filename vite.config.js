import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { env } from 'node:process'

// https://vitejs.dev/config/
export default defineConfig({
  base: env.GITHUB_ACTIONS === 'true' ? '/bitex/' : '/',
  plugins: [react()],
})
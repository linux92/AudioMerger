import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  // Allow large audio files to be served during development
  assetsInclude: ['**/*.wav', '**/*.mp3', '**/*.ogg', '**/*.m4a', '**/*.flac'],
})

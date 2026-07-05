import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  const rootEnvDir = path.resolve(__dirname, '..')
  const env = loadEnv(mode, rootEnvDir, '')
  return {
  envDir: rootEnvDir,
  plugins: [
    react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@assets': path.resolve(__dirname, './assets'),
    },
  },
  server: {
    port: 3000,
  },
  define: {
    'import.meta.env.MODEL_API': JSON.stringify(env.MODEL_API ?? ''),
    'import.meta.env.MODEL_NAME': JSON.stringify(env.MODEL_NAME ?? ''),
  },
}
})

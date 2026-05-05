import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    // Detectar automáticamente el entorno según el archivo de test
    environment: 'node', // Por defecto node para tests de integración
    globals: true,
    setupFiles: './tests/setup.ts',
    pool: 'forks',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData',
        'src/app/**', // Excluir Next.js app routes del coverage
        'scripts/',
        'drizzle/',
      ],
    },
    testTimeout: 30000, // 30 segundos para tests de integración
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@/core': path.resolve(__dirname, './src/core'),
      '@/features': path.resolve(__dirname, './src/features'),
      '@/shared': path.resolve(__dirname, './src/shared'),
      '@/app': path.resolve(__dirname, './src/app'),
    },
  },
})

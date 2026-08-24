import { resolve } from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve('src/shared'),
      '@ai': resolve('src/ai')
    }
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts']
  }
})
